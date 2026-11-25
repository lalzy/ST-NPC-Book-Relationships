// String helpers (a copy of NPC Book's logic/text.js): normalisation, slugs and unique ids, enum picking, colors.

export function normalize(s) {
    return String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s_-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function slugify(s) {
    const slug = normalize(s).replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/^_+|_+$/g, '');
    return slug || 'npc';
}

export function uniqueId(base, taken) {
    let id = slugify(base);
    if (!taken(id)) return id;
    let n = 2;
    while (taken(`${id}_${n}`)) n++;
    return `${id}_${n}`;
}

export const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export function pickEnum(value, list, fallback) {
    if (value === undefined || value === null || String(value).trim() === '') return fallback;
    const v = normalize(value);
    const hit = (list || []).find(x => normalize(x) === v);
    return hit ?? fallback;
}

/** Tidy an id the model wrote: lower case, no stray punctuation around it ("-archmagetaxon-" → "archmagetaxon"). */
export function cleanId(id) {
    return String(id ?? '').trim().toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}

/** Normalise a CSS/HTML color to lowercase #rrggbb (or '' if unknown). */
export function normColor(c) {
    let v = String(c ?? '').trim().toLowerCase().replace(/^["']|["']$/g, '');
    if (/^[0-9a-f]{6}$/.test(v) || /^[0-9a-f]{3}$/.test(v)) v = `#${v}`;
    if (/^#[0-9a-f]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    const rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgb) v = `#${[rgb[1], rgb[2], rgb[3]].map(x => Number(x).toString(16).padStart(2, '0')).join('')}`;
    return /^#[0-9a-f]{6}$/.test(v) ? v : '';
}
