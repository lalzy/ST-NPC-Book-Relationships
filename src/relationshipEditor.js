// Relationship list editor, shared by the Library card (template) and the in-chat card (instance).
// Rows: person, type, attitude, note, ⇄ both directions, delete. "Add relationship" opens an inline people picker
// (inline, so it never closes the popover it lives in).

import { USER_REF, avatarHtml, esc, injectStyle, normalize } from './host.js';
import { relationshipDrift, relationshipTypeNames, reverseRelationshipType } from './relationships.js';
import { settings } from './settings.js';

const EDITOR_STYLE = `
.npcb-rel-list{display:flex;flex-direction:column;gap:6px}
.npcb-rel-bar{display:flex;align-items:center;gap:6px;margin-bottom:6px}
.npcb-rel-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px;border:1px solid var(--SmartThemeBorderColor,#3a3d46);border-radius:8px}
.npcb-rel-who{display:flex;align-items:center;gap:6px;flex:1 1 150px;min-width:0}
.npcb-rel-who b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.npcb-rel-row .text_pole{margin:0}
.npcb-rel-type{flex:1 1 110px;min-width:90px}
.npcb-rel-att{flex:0 1 120px;min-width:100px}
.npcb-rel-note{flex:3 1 200px;min-width:140px}
.npcb-rel-btn{flex:0 0 auto;width:auto;margin:0;padding:4px 8px}
.npcb-rel-mirror.on{outline:1px solid var(--SmartThemeQuoteColor,#90be6d)}
.npcb-rel-badge{font-size:.75em;padding:0 5px;border-radius:4px;border:1px solid currentColor;opacity:.85;white-space:nowrap}
.npcb-rel-was{flex:1 1 100%;font-size:.8em;opacity:.75}
.npcb-rel-picker{border:1px solid var(--SmartThemeBorderColor,#3a3d46);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:4px;max-height:260px;overflow:auto}
.npcb-rel-group{font-size:.8em;opacity:.75;padding:4px 2px 0}
.npcb-rel-pick{display:flex;align-items:center;gap:6px;padding:4px;border-radius:6px;cursor:pointer}
.npcb-rel-pick:hover{background:var(--black30a,rgba(0,0,0,.25))}
`;


/**
 * Mount the editor. `list` is mutated in place (a draft the caller saves). Rows may carry `mirror: true`
 * ("both directions"), which the caller applies on save and strips.
 *   self      the owner's id (never offered as a target)
 *   who(to)   → { name, sub, card } for a row's person (card = what avatarHtml shows)
 *   people()  → [{ group, id, name, sub, card }] everyone who can be added (existing targets are filtered out here)
 *   chat      true in the in-chat card: shows how each relationship drifted in this chat
 *   onChange  called after every change (e.g. to update a tab count)
 *   onWeb     when given, an icon button opens the relationship web/tree view
 */
export function mountRelationships(host, list, { self = '', who, people, chat = false, onChange, onWeb } = {}) {
    injectStyle('npcb_rel_style', EDITOR_STYLE);
    const st = { picking: false, q: '' };
    const attitudes = () => settings().attitudes || [];
    const changed = () => onChange?.(list);
    // Type and attitude are picked from the settings lists; a value from before the lists existed stays selectable.
    const types = () => relationshipTypeNames(settings().relationshipTypes);
    const listOptions = (list, cur) => {
        const all = [...list];
        if (cur && !all.includes(cur)) all.unshift(cur);
        if (!cur) all.unshift('');
        return all.map(x => `<option value="${esc(x)}" ${x === cur ? 'selected' : ''}>${esc(x || '—')}</option>`).join('');
    };
    const attOptions = (cur) => {
        const all = [...attitudes()];
        if (cur && !all.includes(cur)) all.unshift(cur);
        if (!cur) all.unshift('');
        return all.map(x => `<option value="${esc(x)}" ${x === cur ? 'selected' : ''}>${esc(x || '—')}</option>`).join('');
    };
    const mirrorTitle = (name, type) => `Link: ${name} gets ${type ? `"${reverseRelationshipType(type, settings().relationshipTypes)}"` : 'the reverse relationship'} back (on Save)`;
    const rowHtml = (r, i) => {
        const p = who(r.to) || { name: r.to, sub: r.to };
        const drift = chat ? relationshipDrift(r) : '';
        const badge = drift === 'new' ? 'new in this chat' : drift === 'changed' ? 'changed' : '';
        const was = chat && drift === 'changed' ? `Started as: ${[r.origin.type, r.origin.attitude].filter(Boolean).join(' · ') || '—'}${r.origin.note ? ` — ${r.origin.note}` : ''}` : '';
        return `<div class="npcb-rel-row" data-i="${i}">
            <div class="npcb-rel-who">${avatarHtml(p.card, p.name, 'npcb-ava-sm')}<div style="min-width:0"><b>${esc(p.name)}</b><br><small class="npcb-dim">${esc(p.sub || '')}</small></div>${badge ? `<span class="npcb-rel-badge">${esc(badge)}</span>` : ''}</div>
            <select class="text_pole npcb-rel-type" aria-label="Relationship type">${listOptions(types(), r.type || '')}</select>
            <select class="text_pole npcb-rel-att" aria-label="Attitude">${attOptions(r.attitude || '')}</select>
            <input class="text_pole npcb-rel-note" value="${esc(r.note || '')}" placeholder="note (optional, sent to the LLM)" aria-label="Note">
            ${r.to !== USER_REF ? `<div class="menu_button npcb-rel-btn npcb-rel-mirror ${r.mirror ? 'on' : ''}" title="${esc(mirrorTitle(p.name, r.type))}"><i class="fa-solid fa-right-left"></i></div>` : ''}
            <div class="menu_button npcb-rel-btn npcb-rel-del" title="Remove relationship"><i class="fa-solid fa-trash-can"></i></div>
            ${was ? `<div class="npcb-rel-was">${esc(was)}</div>` : ''}
        </div>`;
    };
    const pickerHtml = () => {
        const taken = new Set([self, ...list.map(r => r.to)]);
        const q = normalize(st.q);
        const cands = people().filter(p => !taken.has(p.id) && (!q || normalize(`${p.name} ${p.id} ${p.sub || ''}`).includes(q)));
        const groups = [...new Set(cands.map(p => p.group))];
        return `<div class="npcb-rel-picker">
            <input type="search" class="text_pole npcb-rel-q" placeholder="Search people…" value="${esc(st.q)}">
            ${cands.length ? groups.map(g => `<div class="npcb-rel-group">${esc(g)}</div>${cands.filter(p => p.group === g).map(p => `<div class="npcb-rel-pick" data-id="${esc(p.id)}">${avatarHtml(p.card, p.name, 'npcb-ava-sm')}<span>${esc(p.name)}</span><small class="npcb-dim">${esc(p.sub || '')}</small></div>`).join('')}`).join('') : '<div class="npcb-empty">Nobody to add.</div>'}
        </div>`;
    };
    const draw = () => {
        host.html(`<div class="npcb-row npcb-rel-bar"><div class="menu_button npcb-rel-add"><i class="fa-solid fa-plus"></i> Add relationship</div>
                ${onWeb ? '<span class="npcb-spacer" style="flex:1"></span><div class="menu_button npcb-rel-btn npcb-rel-web" title="Relationship web" aria-label="Relationship web"><i class="fa-solid fa-circle-nodes"></i></div>' : ''}</div>
            ${st.picking ? pickerHtml() : ''}
            <div class="npcb-rel-list">${list.length ? list.map(rowHtml).join('') : '<div class="npcb-empty">No relationships yet.</div>'}</div>`);
        if (st.picking) host.find('.npcb-rel-q').trigger('focus');
    };
    const at = (el) => list[Number($(el).closest('.npcb-rel-row').data('i'))];
    host.off('.rel');
    host.on('click.rel', '.npcb-rel-add', () => { st.picking = !st.picking; st.q = ''; draw(); });
    host.on('click.rel', '.npcb-rel-web', () => onWeb?.(list));
    host.on('input.rel', '.npcb-rel-q', (e) => {
        st.q = String(e.target.value);
        const pos = e.target.selectionStart;
        host.find('.npcb-rel-picker').replaceWith(pickerHtml());
        const q = host.find('.npcb-rel-q')[0];
        if (q) { q.focus(); q.setSelectionRange(pos, pos); }
    });
    host.on('click.rel', '.npcb-rel-pick', (e) => {
        const def = attitudes().includes('Neutral') ? 'Neutral' : (attitudes()[0] ?? '');
        list.push({ to: String($(e.currentTarget).data('id')), type: '', attitude: def, note: '' });
        st.picking = false;
        draw(); changed();
        host.find('.npcb-rel-row').last().find('.npcb-rel-type').trigger('focus');
    });
    host.on('change.rel', '.npcb-rel-type', (e) => {
        const r = at(e.target);
        if (!r) return;
        r.type = String(e.target.value);
        $(e.target).closest('.npcb-rel-row').find('.npcb-rel-mirror').attr('title', mirrorTitle(who(r.to)?.name ?? r.to, r.type));
        changed();
    });
    host.on('change.rel', '.npcb-rel-att', (e) => { const r = at(e.target); if (r) { r.attitude = String(e.target.value); changed(); } });
    host.on('input.rel', '.npcb-rel-note', (e) => { const r = at(e.target); if (r) { r.note = String(e.target.value).trim(); changed(); } });
    host.on('click.rel', '.npcb-rel-mirror', (e) => { const r = at(e.target); if (r) { r.mirror = !r.mirror; $(e.currentTarget).toggleClass('on', r.mirror); } });
    host.on('click.rel', '.npcb-rel-del', (e) => { const i = Number($(e.target).closest('.npcb-rel-row').data('i')); list.splice(i, 1); draw(); changed(); });
    draw();
    return { refresh: draw };
}

/** A draft list ready to store: no empty targets, no UI-only flags. */
export function cleanRelationships(list) {
    return (list || []).filter(r => r?.to).map((r) => { const o = { ...r }; delete o.mirror; return o; });
}
