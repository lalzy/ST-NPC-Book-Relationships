// Who a relationship can point at, and how to show them: in the Library (templates) or in a chat (its instances first).

import { USER_REF, lib } from './host.js';

const YOU = { group: 'You', id: USER_REF, name: 'You', sub: 'your persona, whoever it is', card: null };

/** Library card editor: you, and every other library NPC (grouped by folder). */
export function libraryPeople(self) {
    const npcs = Object.values(lib()).filter(t => t.id !== self).sort((a, b) => a.name.localeCompare(b.name))
        .map(t => ({ group: t.folder ? `Library · ${t.folder}` : 'Library', id: t.id, name: t.name, sub: t.id, card: t }));
    return [YOU, ...npcs];
}

export function whoInLibrary(to) {
    if (to === USER_REF) return YOU;
    const t = lib()[to];
    return t ? { name: t.name, sub: t.id, card: t } : { name: to, sub: 'not in the library', card: null };
}

/** In-chat card: you, the chat's own NPCs (who is here now first), then library NPCs this chat has not met. */
export function chatPeople(scene, self) {
    const met = Object.values(scene.instances).filter(i => i.id !== self)
        .sort((a, b) => (scene.active.includes(b.id) - scene.active.includes(a.id)) || a.name.localeCompare(b.name))
        .map(i => ({ group: 'Met in this chat', id: i.id, name: i.name, sub: scene.active.includes(i.id) ? 'in scene' : 'not in scene', card: i }));
    const fresh = Object.values(lib()).filter(t => t.id !== self && !scene.instances[t.id]).sort((a, b) => a.name.localeCompare(b.name))
        .map(t => ({ group: 'Library', id: t.id, name: t.name, sub: t.id, card: t }));
    return [YOU, ...met, ...fresh];
}

export function whoInChat(scene, to) {
    if (to === USER_REF) return { ...YOU, sub: 'in scene' };
    const i = scene.instances[to];
    if (i) return { name: i.name, sub: scene.active.includes(to) ? 'in scene' : 'not in scene', card: i };
    const t = lib()[to];
    return t ? { name: t.name, sub: 'not met in this chat', card: t } : { name: to, sub: 'unknown', card: null };
}
