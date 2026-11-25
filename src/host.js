// NPC Book's public API, and the pieces of it this extension uses. Loaded only after NPC Book is ready.

export const api = window.NPCBook;
export const { esc, xa, xt, clone, normalize, pickEnum, cleanId, indent } = api.util;
export const { avatarHtml, injectStyle, closePopovers, openCard, openInstanceEditor, personaAvatar } = api.ui;
export const ctx = () => SillyTavern.getContext();
export const lib = () => api.getLibrary();
export const USER_REF = 'user';

/** A character's relationship list: this extension's data, else NPC Book's older top-level `relationships`. */
export function relsOf(data, subject) {
    if (Array.isArray(data?.list)) return data.list;
    return Array.isArray(subject?.relationships) ? subject.relationships : [];
}
export const EXT_ID = 'relationships';
/** Someone's relationships as stored (template or chat instance). */
export const storedRels = (obj) => relsOf(obj?.ext?.[EXT_ID], obj);
