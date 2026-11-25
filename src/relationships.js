// NPC Book — Relationships: pure logic (no DOM / no SillyTavern imports), moved from NPC Book. Testable in Node.
// Relationships: who an NPC knows and how they feel about them.
//
//   relationship = { to, type, attitude, note, origin? }
//   to       = an NPC id, or "user" (the persona, whoever it is)
//   origin   = what it was when this chat's instance was created ({type, attitude, note}); absent = new in this chat
//
// A template holds the starting relationships; an instance copies them (with origin) and only the copy changes.

import { cleanId, normalize, pickEnum } from './text.js';

export const USER_REF = 'user';
const USER_WORDS = ['user', 'you', 'persona', 'player'];

/** Copy a template's relationships into a new instance, remembering where each one started. */
export function relationshipsForInstance(list) {
    return (Array.isArray(list) ? list : []).filter(r => r?.to).map(r => ({
        to: r.to, type: String(r.type ?? ''), attitude: String(r.attitude ?? ''), note: String(r.note ?? ''),
        origin: { type: String(r.type ?? ''), attitude: String(r.attitude ?? ''), note: String(r.note ?? '') },
    }));
}

/** How a relationship differs from where it started in this chat: 'new' | 'changed' | ''. */
export function relationshipDrift(r) {
    if (!r?.origin) return 'new';
    const o = r.origin;
    return (o.type !== r.type || o.attitude !== r.attitude || o.note !== r.note) ? 'changed' : '';
}

/**
 * Relationship changes as the LLM wrote them → [{ref, type?, attitude?, note?, remove?}].
 * Accepts {"user": {...}, "bram": {...}} or [{"to"|"id"|"name": ..., ...}]; a null value or {"remove": true} removes.
 */
export function normalizeRelationshipChanges(raw) {
    const out = [];
    const one = (ref, v) => {
        ref = String(ref ?? '').trim();
        if (!ref) return;
        if (v === null || v === false || v?.remove === true || v?.left === true) { out.push({ ref, remove: true }); return; }
        if (typeof v === 'string') { out.push({ ref, attitude: v }); return; }
        if (!v || typeof v !== 'object') return;
        const c = { ref };
        for (const k of ['type', 'attitude', 'note']) if (v[k] !== undefined && v[k] !== null && String(v[k]).trim() !== '') c[k] = String(v[k]).trim();
        if (c.type === undefined && v.relation !== undefined) c.type = String(v.relation).trim();
        if (c.attitude === undefined && v.feeling !== undefined) c.attitude = String(v.feeling).trim();
        out.push(c);
    };
    if (Array.isArray(raw)) for (const v of raw) one(v?.to ?? v?.id ?? v?.name, v);
    else if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) one(k, v);
    return out;
}

/**
 * Resolve a relationship target written by the LLM: "user"/"you"/the persona name → "user";
 * otherwise an id or exact name among `people` ({id: {name}}), else a cleaned id of what was written.
 */
export function resolveRelationshipTarget(ref, people, userName = '') {
    const n = normalize(ref);
    if (!n) return '';
    if (USER_WORDS.includes(n) || (userName && n === normalize(userName))) return USER_REF;
    const id = String(ref).trim().toLowerCase();
    if (people?.[id]) return id;
    const hit = Object.values(people || {}).find(p => normalize(p?.name) === n);
    return hit?.id ?? cleanId(ref).replace(/[^a-z0-9_-]+/g, '_');
}

/**
 * A value from a fixed list (case-insensitive; a plural like "friends" finds "Friend"), or null when it is not on it.
 * An empty list accepts nothing, so the model can never invent a value.
 */
export function pickListed(value, list) {
    const hit = pickEnum(value, list, null);
    if (hit !== null) return hit;
    const v = normalize(value);
    return (list || []).find(x => { const n = normalize(x); return v === `${n}s` || v === `${n}es`; }) ?? null;
}

/**
 * Apply changes to a relationship list (returns a new list). "type" and "attitude" must come from the settings lists:
 * a value that is not on its list is ignored (and reported in `rejected`), so wording cannot drift
 * ("Friend" → "Good friends" → "became friends with…"). A new relationship needs a listed type.
 * Returns { list, changed: [to], rejected: ["to: field \"value\""] }.
 */
export function applyRelationshipChanges(list, changes, { attitudes = [], types = [], resolve = (r) => r, self = '' } = {}) {
    const cur = (Array.isArray(list) ? list : []).map(r => ({ ...r }));
    const changed = [];
    const rejected = [];
    for (const c of changes || []) {
        const to = resolve(c.ref);
        if (!to || to === self) continue;
        const at = cur.findIndex(r => r.to === to);
        if (c.remove) { if (at >= 0) { cur.splice(at, 1); changed.push(to); } continue; }
        const type = c.type !== undefined ? pickListed(c.type, types) : undefined;
        const attitude = c.attitude !== undefined ? pickListed(c.attitude, attitudes) : undefined;
        if (type === null) rejected.push(`${to}: type "${c.type}"`);
        if (attitude === null) rejected.push(`${to}: attitude "${c.attitude}"`);
        if (at < 0 && !type) { if (type === undefined) rejected.push(`${to}: new relationship without a type`); continue; }
        const r = at >= 0 ? cur[at] : { to, type: '', attitude: '', note: '' };
        let touched = false;
        if (type) { r.type = type; touched = true; }
        if (attitude) { r.attitude = attitude; touched = true; }
        if (c.note !== undefined) { r.note = c.note; touched = true; }
        if (!touched) continue;
        if (at < 0) cur.push(r);
        changed.push(to);
    }
    return { list: cur, changed, rejected };
}

const PAIR_SEP = /\s*(?:<->|<>|↔|⇄)\s*/;

/**
 * The relationship type list from settings. A line is one type, the same both ways ("Friend"), or a pair of types
 * that are each other's reverse ("Employer <> Employee", "Master <> Slave"; "<->", "↔" and "⇄" also work).
 * Returns { types: [every single type, in order], reverse: Map(type → its reverse) }.
 */
export function parseRelationshipTypes(lines) {
    const types = [];
    const reverse = new Map();
    for (const line of Array.isArray(lines) ? lines : []) {
        const [a, b = a] = String(line ?? '').split(PAIR_SEP).map(x => x.trim()).filter(Boolean);
        if (!a) continue;
        for (const t of [a, b]) if (!types.includes(t)) types.push(t);
        reverse.set(a, b);
        reverse.set(b, a);
    }
    return { types, reverse };
}

/** The single types of the settings list (for validation, the prompt and dropdowns). */
export function relationshipTypeNames(lines) { return parseRelationshipTypes(lines).types; }

/** What a type is seen as from the other side: "Employer" → "Employee"; an unpaired or unknown type stays as it is. */
export function reverseRelationshipType(type, lines) {
    const { reverse } = parseRelationshipTypes(lines);
    const key = [...reverse.keys()].find(k => normalize(k) === normalize(type));
    return key !== undefined ? reverse.get(key) : String(type ?? '');
}

/**
 * The reverse entry for "both directions": `to` gets a relationship back to `from` (created once, never overwritten),
 * with the paired type from the settings list (Employer → Employee) and the same attitude.
 */
export function mirrorRelationship(targetList, from, rel, typeLines = []) {
    const list = Array.isArray(targetList) ? targetList.map(r => ({ ...r })) : [];
    if (!from || list.some(r => r.to === from)) return { list, added: false };
    list.push({ to: from, type: reverseRelationshipType(rel?.type ?? '', typeLines), attitude: String(rel?.attitude ?? ''), note: '' });
    return { list, added: true };
}
