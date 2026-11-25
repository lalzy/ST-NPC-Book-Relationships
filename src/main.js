// Registers Relationships with NPC Book. Data: ext.relationships = { list: [{ to, type, attitude, note, origin? }] } on NPC
// cards (starting relationships) and on each chat's NPC copies. Cards and chats saved before this extension existed keep
// them in NPC Book's old top-level `relationships` field; they are read from there until saved here.

import { EXT_ID, USER_REF, api, clone, ctx, indent, lib, relsOf, storedRels, xa, xt } from './host.js';
import { chatPeople, libraryPeople, whoInChat, whoInLibrary } from './people.js';
import { cleanRelationships, mountRelationships } from './relationshipEditor.js';
import { openRelationshipView } from './relationshipView.js';
import { applyRelationshipChanges, mirrorRelationship, normalizeRelationshipChanges, relationshipTypeNames, relationshipsForInstance, resolveRelationshipTarget } from './relationships.js';
import { mountSettings, settings } from './settings.js';

export async function register() {
    api.registerExtension({
        id: EXT_ID,
        label: 'Relationships',
        defaultData: () => ({}),
        sheetLabel: 'Relationships',
        cardTab: {
            label: 'Relationships',
            icon: 'fa-users-viewfinder',
            render(host, { data, template, id, scope }) {
                if (!Array.isArray(data.list)) data.list = clone(relsOf(null, template));
                const chat = scope === 'instance';
                const scene = chat ? api.getChatScene() : null;
                host.html(`<small class="npcb-dim">${chat ? 'This chat\'s copy. The Library card is not touched.' : 'Starting relationships. Each new chat copies them; the chat\'s copy changes from there.'}</small><div class="npcbr-host"></div>`);
                mountRelationships(host.find('.npcbr-host'), data.list, {
                    self: id,
                    chat,
                    who: chat ? (to) => whoInChat(scene, to) : whoInLibrary,
                    people: chat ? () => chatPeople(scene, id) : () => libraryPeople(id),
                    onWeb: (list) => openRelationshipView({ root: id || '__new__', rootRels: cleanRelationships(list), mode: chat ? 'chat' : 'library' }),
                });
            },
            // After NPC Book saved the list: drop the editor-only "both directions" marks, and give each marked person
            // the relationship back (on their card, or their copy in this chat), unless they already have one.
            onSave({ id, scope, data }) {
                const list = Array.isArray(data?.list) ? data.list : [];
                const marked = list.filter(r => r.mirror && r.to && r.to !== id && r.to !== USER_REF);
                if (!list.some(r => 'mirror' in r)) return;
                const types = settings().relationshipTypes;
                api.setExtData(id, EXT_ID, { ...data, list: cleanRelationships(list) }, { scope });
                for (const r of marked) {
                    const other = scope === 'template' ? lib()[r.to] : api.getChatScene()?.instances?.[r.to];
                    if (!other) continue;
                    const back = mirrorRelationship(storedRels(other), id, r, types).list;
                    api.setExtData(r.to, EXT_ID, { ...(other.ext?.[EXT_ID] || {}), list: back }, { scope });
                }
            },
        },
        // Also a tab in a chat NPC's popover, next to State and Outfit (saved with that popover's Save).
        chatTab: { wide: true },

        // A chat's copy remembers where each relationship started, so the sheet can show what changed in this chat.
        onInstanceCreate: ({ template, data }) => ({ ...(data || {}), list: relationshipsForInstance(relsOf(data, template)) }),

        // The AI's changes: {"relationships": {"user": {...}, "bram": {...}}} on a character's entry.
        onTrackerEntry({ kind, entry, data, instance, scene }) {
            const s = settings();
            if (kind !== 'char' || !s.track || !entry.relationships) return undefined;
            const people = { ...lib(), ...(scene?.instances || {}) };
            const rc = applyRelationshipChanges(relsOf(data, instance), normalizeRelationshipChanges(entry.relationships), {
                attitudes: s.attitudes, types: relationshipTypeNames(s.relationshipTypes), self: instance.id,
                resolve: (ref) => resolveRelationshipTarget(ref, people, ctx().name1),
            });
            if (rc.rejected.length) console.info(`[NPC Book — Relationships] ${instance.name}: ignored`, rc.rejected);
            return rc.changed.length ? { ...(data || {}), list: rc.list } : undefined;
        },
        entryKeys: ['relationships'],

        // Only relationships with you and with characters in the scene right now, to keep the context small.
        sceneXmlAlways: true,
        sceneXml({ kind, data, instance, scene }) {
            if (kind !== 'char' || !settings().track || !scene) return '';
            const rels = relsOf(data, instance).filter(r => r?.to && (r.to === USER_REF || scene.active.includes(r.to)));
            if (!rels.length) return '';
            const nameOf = (to) => (to === USER_REF ? ctx().name1 : scene.instances[to]?.name ?? to);
            return ['<relationships>', ...rels.map(r => {
                const attrs = ` to="${xa(r.to)}" name="${xa(nameOf(r.to))}"${r.type ? ` type="${xa(r.type)}"` : ''}${r.attitude ? ` attitude="${xa(r.attitude)}"` : ''}`;
                return indent(r.note ? `<rel${attrs}>${xt(r.note)}</rel>` : `<rel${attrs}/>`, 2);
            }), '</relationships>'].join('\n');
        },
        instructions() {
            const s = settings();
            if (!s.track) return '';
            return String(s.rule || '')
                .replaceAll('[[REL_TYPES]]', relationshipTypeNames(s.relationshipTypes).join(', '))
                .replaceAll('[[ATTITUDES]]', (s.attitudes || []).join(', '));
        },
        placeholders: {
            REL_TYPES: () => relationshipTypeNames(settings().relationshipTypes).join(', '),
            ATTITUDES: () => (settings().attitudes || []).join(', '),
        },
    });
    mountSettings(api);
}
