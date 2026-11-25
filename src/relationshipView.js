// Relationship view: a popup showing the relationships around one person, as a Web (radial) or a Tree (grouped list).
// Opened from the relationship tab of the Library card (starting relationships) or the in-chat card (this chat's copy).
// Click a person to centre the view on them; Back returns; "Open card" opens the centred person's card.

import { USER_REF, api, avatarHtml, closePopovers, ctx, esc, injectStyle, lib, openCard, openInstanceEditor, personaAvatar, storedRels } from './host.js';
import { attitudeColor, buildRelationshipGraph, groupTree, layoutWeb } from './relationshipGraph.js';
import { relationshipDrift, relationshipTypeNames } from './relationships.js';
import { save, settings } from './settings.js';

const VIEW_STYLE = `
.npcb-relview{display:flex;flex-direction:column;gap:8px;text-align:left}
.npcb-relview-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.npcb-relview-head .menu_button{width:auto;margin:0}
.npcb-relview-seg{display:flex;border:1px solid var(--SmartThemeBorderColor,#3a3d46);border-radius:6px;overflow:hidden}
.npcb-relview-seg .menu_button{border:0;border-radius:0;opacity:.65}
.npcb-relview-seg .menu_button.on{opacity:1;font-weight:600;background:var(--black30a,rgba(0,0,0,.3))}
.npcb-web{position:relative;width:100%;aspect-ratio:860/520;min-height:320px;overflow:hidden;touch-action:none;cursor:grab;border:1px solid var(--SmartThemeBorderColor,#3a3d46);border-radius:8px;user-select:none}
.npcb-web.dragging{cursor:grabbing}
.npcb-web-stage{position:absolute;inset:0;transform-origin:0 0}
.npcb-web-zoom{position:absolute;right:8px;bottom:8px;display:flex;gap:4px;z-index:2}
.npcb-web-zoom .menu_button{width:auto;margin:0;padding:4px 8px}
.npcb-web svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.npcb-web-node{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;max-width:130px;text-align:center}
.npcb-web-node .npcb-web-ava{border-radius:50%;padding:2px;border:2px solid var(--npcb-c,#8a8f9c);display:flex}
/* Portraits are square: cut them to the circle inside the ring (clip-path too, so a theme's avatar radius cannot undo it). */
.npcb-web-node .npcb-web-ava .npcb-ava{display:block;width:48px;height:48px;border-radius:50% !important;clip-path:circle(50%);object-fit:cover;overflow:hidden}
/* No portrait: the initials fill the circle instead of shrinking. */
.npcb-web-node .npcb-web-ava .npcb-ava-fallback{display:flex;align-items:center;justify-content:center;line-height:1;font-size:19px;font-weight:700}
.npcb-web-node.inscene .npcb-web-ava{box-shadow:0 0 0 3px #90be6d}
.npcb-web-node.root .npcb-web-ava .npcb-ava{width:64px;height:64px}
.npcb-web-node.root .npcb-web-ava .npcb-ava-fallback{font-size:26px}
.npcb-web-node.second{opacity:.8}
.npcb-web-node b{font-size:.85em;line-height:1.1}
.npcb-web-node small{opacity:.7;font-size:.72em}
.npcb-web-label{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:4px;padding:1px 7px;border-radius:10px;font-size:.75em;white-space:nowrap;background:var(--SmartThemeBlurTintColor,#1f2126);border:1px solid var(--SmartThemeBorderColor,#3a3d46);pointer-events:none}
.npcb-web-label.second{opacity:.75;font-size:.7em}
.npcb-dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex:0 0 auto}
.npcb-tree-group{font-size:.78em;text-transform:uppercase;letter-spacing:.05em;opacity:.7;margin:8px 0 2px}
.npcb-tree-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:4px 6px;border-radius:8px;cursor:pointer}
.npcb-tree-row:hover{background:var(--black30a,rgba(0,0,0,.25))}
.npcb-tree-kids{margin-left:22px;padding-left:10px;border-left:1px solid var(--SmartThemeBorderColor,#3a3d46)}
.npcb-tree-chip{font-size:.78em;padding:1px 7px;border-radius:10px;border:1px solid var(--SmartThemeBorderColor,#3a3d46)}
.npcb-tree-att{display:inline-flex;align-items:center;gap:4px;font-size:.8em}
.npcb-tree-note{opacity:.7;font-size:.8em}
.npcb-relview-legend{display:flex;flex-wrap:wrap;gap:10px;font-size:.78em;opacity:.85;border-top:1px solid var(--SmartThemeBorderColor,#3a3d46);padding-top:6px}
`;


/** Where people and their relationships come from: this chat (its instances) or the Library (templates). */
function makeSource(mode, root, rootRels) {
    const scene = mode === 'chat' ? api.getChatScene() : null;
    const you = () => {
        const url = personaAvatar();
        return { name: mode === 'chat' ? (ctx().name1 || 'You') : 'You', card: url ? { portrait: url, color: '#8ecae6' } : { color: '#8ecae6' }, sub: 'you', inScene: mode === 'chat' };
    };
    const person = (id) => {
        if (id === USER_REF) return you();
        if (scene) {
            const i = scene.instances[id];
            if (i) return { name: i.name, card: i, inScene: scene.active.includes(id), sub: scene.active.includes(id) ? 'in scene' : 'not in scene' };
            const t = lib()[id];
            return { name: t?.name ?? id, card: t ?? null, inScene: false, sub: t ? 'not met in this chat' : 'unknown' };
        }
        const t = lib()[id];
        return { name: t?.name ?? id, card: t ?? null, inScene: false, sub: t?.folder || (t ? '' : 'not in the library') };
    };
    const relsOf = (id) => {
        if (id === root) return rootRels;
        if (id === USER_REF) return [];
        return storedRels(scene ? scene.instances[id] : lib()[id]);
    };
    const canOpen = (id) => (id !== USER_REF && (scene ? scene.active.includes(id) : !!lib()[id]));
    return { scene, person, relsOf, canOpen };
}

/**
 * Open the view.
 *   root      the person in the centre (an NPC id)
 *   rootRels  their relationships right now (the editor's draft, so unsaved changes show)
 *   mode      'chat' (this chat's instances) or 'library' (templates)
 */
export async function openRelationshipView({ root, rootRels, mode = 'chat' }) {
    injectStyle('npcb_relview_style', VIEW_STYLE);
    const c = ctx();
    const s = settings();
    const src = makeSource(mode, root, rootRels);
    const st = { center: root, history: [], layout: s.relViewLayout === 'tree' ? 'tree' : 'web', depth: Number(s.relViewDepth) === 1 ? 1 : 2 };
    // Web pan / zoom: the stage is moved by (x, y) px and scaled by k; `moved` tells a drag from a click.
    const view = { x: 0, y: 0, k: 1, moved: 0 };
    const MIN_K = 0.4, MAX_K = 3;
    const stageTransform = () => `transform:translate(${view.x}px, ${view.y}px) scale(${view.k})`;
    const applyView = () => box.find('.npcb-web-stage').attr('style', stageTransform());
    const resetView = () => { view.x = 0; view.y = 0; view.k = 1; };
    /** Zoom by `factor` keeping the point under (clientX, clientY) where it is. */
    const zoomAt = (clientX, clientY, factor) => {
        const web = box.find('.npcb-web')[0];
        if (!web) return;
        const rect = web.getBoundingClientRect();
        const px = clientX - rect.left, py = clientY - rect.top;
        const k = Math.min(MAX_K, Math.max(MIN_K, view.k * factor));
        const f = k / view.k;
        view.x = px - (px - view.x) * f;
        view.y = py - (py - view.y) * f;
        view.k = k;
        applyView();
    };
    const box = $('<div class="npcb-relview"></div>');
    const attitudes = () => settings().attitudes || [];
    const color = (att) => attitudeColor(att, attitudes());
    const label = (r, mutual) => `${esc(r.type || '—')}${mutual ? ' ⇄' : ''} · ${esc(r.attitude || '—')}`;

    const webHtml = (g) => {
        const L = layoutWeb(g, { w: 860, h: 520 });
        const at = new Map(L.nodes.map(n => [n.id, n]));
        const pct = (n) => `left:${(n.x / L.w) * 100}%;top:${(n.y / L.h) * 100}%`;
        const lines = L.edges.map(e => {
            const a = at.get(e.from), b = at.get(e.to);
            return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color(e.rel.attitude)}" stroke-width="2" vector-effect="non-scaling-stroke"${e.level === 2 ? ' stroke-dasharray="6 5" opacity=".75"' : ''}></line>`;
        }).join('');
        const labels = L.edges.map(e => {
            const a = at.get(e.from), b = at.get(e.to);
            const t = e.level === 1 ? 0.55 : 0.5;
            const m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
            return `<div class="npcb-web-label ${e.level === 2 ? 'second' : ''}" style="${pct(m)}" title="${esc(e.rel.note || '')}"><span class="npcb-dot" style="background:${color(e.rel.attitude)}"></span>${label(e.rel, e.mutual)}</div>`;
        }).join('');
        const nodes = L.nodes.map(n => {
            const p = src.person(n.id);
            const cls = [n.level === 0 ? 'root' : '', n.level === 2 ? 'second' : '', p.inScene ? 'inscene' : ''].join(' ');
            return `<div class="npcb-web-node ${cls}" data-id="${esc(n.id)}" style="${pct(n)};--npcb-c:${esc(p.card?.color || '#8a8f9c')}" title="${esc(p.name)}">
                <div class="npcb-web-ava">${avatarHtml(p.card, p.name, n.level === 0 ? 'npcb-ava-md' : 'npcb-ava-sm')}</div><b>${esc(p.name)}</b>${p.sub ? `<small>${esc(p.sub)}</small>` : ''}</div>`;
        }).join('');
        return `<div class="npcb-web"><div class="npcb-web-stage" style="${stageTransform()}"><svg viewBox="0 0 ${L.w} ${L.h}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${labels}${nodes}</div>
            <div class="npcb-web-zoom"><div class="menu_button" data-zoom="in" title="Zoom in" aria-label="Zoom in"><i class="fa-solid fa-plus"></i></div><div class="menu_button" data-zoom="out" title="Zoom out" aria-label="Zoom out"><i class="fa-solid fa-minus"></i></div><div class="menu_button" data-zoom="reset" title="Reset view" aria-label="Reset view"><i class="fa-solid fa-expand"></i></div></div></div>`;
    };

    const treeHtml = (g) => {
        const isRoot = st.center === root && mode === 'chat';
        const row = (r, mutual, withDrift) => {
            const p = src.person(r.to);
            const drift = withDrift ? relationshipDrift(r) : '';
            const badge = drift === 'new' ? 'new in this chat' : drift === 'changed' ? 'changed' : '';
            return `<div class="npcb-tree-row" data-id="${esc(r.to)}">${avatarHtml(p.card, p.name, 'npcb-ava-sm')}<b>${esc(p.name)}</b>
                <span class="npcb-tree-chip">${esc(r.type || '—')}</span>
                <span class="npcb-tree-att"><span class="npcb-dot" style="background:${color(r.attitude)}"></span>${esc(r.attitude || '—')}</span>
                ${mutual ? '<span title="Both directions">⇄</span>' : ''}
                ${p.sub ? `<small class="npcb-dim">${esc(p.sub)}</small>` : ''}
                ${badge ? `<span class="npcb-rel-badge">${esc(badge)}</span>` : ''}
                ${r.note ? `<span class="npcb-tree-note">${esc(r.note)}</span>` : ''}</div>`;
        };
        const groups = groupTree(g, relationshipTypeNames(settings().relationshipTypes));
        if (!groups.length) return '<div class="npcb-empty">No relationships yet.</div>';
        return groups.map(gr => `<div class="npcb-tree-group">${esc(gr.type || 'No type')} · ${gr.items.length}</div>${gr.items.map(it => `${row(it.rel, it.mutual, isRoot)}${it.children.length ? `<div class="npcb-tree-kids">${it.children.map(k => row(k, false, false)).join('')}</div>` : ''}`).join('')}`).join('');
    };

    const draw = () => {
        const g = buildRelationshipGraph(st.center, src.relsOf(st.center), { relsOf: src.relsOf, depth: st.depth });
        const me = src.person(st.center);
        const seg = (act, items) => `<div class="npcb-relview-seg">${items.map(([v, t, on]) => `<div class="menu_button ${on ? 'on' : ''}" data-act="${act}" data-v="${v}">${t}</div>`).join('')}</div>`;
        box.html(`<div class="npcb-relview-head">
                ${st.history.length ? '<div class="menu_button" data-act="back" title="Back"><i class="fa-solid fa-arrow-left"></i></div>' : ''}
                ${avatarHtml(me.card, me.name, 'npcb-ava-sm')}<b>${esc(me.name)}'s relationships</b>
                <small class="npcb-dim">${mode === 'chat' ? 'this chat' : 'starting relationships'}</small>
                <span class="npcb-spacer" style="flex:1"></span>
                ${st.center !== root && src.canOpen(st.center) ? '<div class="menu_button" data-act="open" title="Open this card"><i class="fa-solid fa-id-card"></i> Open card</div>' : ''}
                ${seg('depth', [[1, 'Direct', st.depth === 1], [2, '+ their links', st.depth === 2]])}
                ${seg('layout', [['web', '<i class="fa-solid fa-circle-nodes"></i> Web', st.layout === 'web'], ['tree', '<i class="fa-solid fa-sitemap"></i> Tree', st.layout === 'tree']])}
            </div>
            ${g.edges.length ? (st.layout === 'web' ? webHtml(g) : treeHtml(g)) : '<div class="npcb-empty">No relationships yet.</div>'}
            <div class="npcb-relview-legend"><span>Attitude:</span>${attitudes().map(a => `<span><span class="npcb-dot" style="background:${color(a)}"></span> ${esc(a)}</span>`).join('')}
                <span style="flex:1"></span><span>${st.layout === 'web' ? 'Solid: own · dashed: their links · green ring: in scene · Drag to move, scroll or pinch to zoom · ' : ''}Click someone to centre on them</span></div>`);
    };

    let afterClose = null;
    const popup = new c.Popup(box, c.POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true, okButton: 'Close' });
    box.on('click', '[data-act="depth"]', (e) => { st.depth = Number($(e.currentTarget).data('v')); s.relViewDepth = st.depth; save(); draw(); });
    box.on('click', '[data-act="layout"]', (e) => { st.layout = String($(e.currentTarget).data('v')); s.relViewLayout = st.layout; save(); draw(); });
    box.on('click', '[data-act="back"]', () => { st.center = st.history.pop() ?? root; resetView(); draw(); });
    // Drag to pan (mouse, pen or one finger), pinch with two fingers or scroll to zoom.
    const pointers = new Map();
    let pinch = null; // { dist, mid } of the last two-finger frame
    const two = () => { const [a, b] = [...pointers.values()]; return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; };
    box.on('pointerdown', '.npcb-web', (e) => {
        const ev = e.originalEvent;
        if ($(ev.target).closest('.npcb-web-zoom').length || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
        pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (pointers.size === 1) view.moved = 0;
        if (pointers.size === 2) pinch = two();
    });
    box.on('pointermove', '.npcb-web', (e) => {
        const ev = e.originalEvent;
        const prev = pointers.get(ev.pointerId);
        if (!prev) return;
        pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (pointers.size === 1) {
            const dx = ev.clientX - prev.x, dy = ev.clientY - prev.y;
            view.moved += Math.abs(dx) + Math.abs(dy);
            if (view.moved < 4) return; // still a click
            // Capture only once it is a drag, so a plain click still reaches the person under it.
            if (!e.currentTarget.hasPointerCapture?.(ev.pointerId)) { e.currentTarget.setPointerCapture?.(ev.pointerId); $(e.currentTarget).addClass('dragging'); }
            view.x += dx;
            view.y += dy;
            applyView();
        } else if (pointers.size === 2 && pinch) {
            const now = two();
            view.moved += 10;
            view.x += now.mid.x - pinch.mid.x;
            view.y += now.mid.y - pinch.mid.y;
            zoomAt(now.mid.x, now.mid.y, pinch.dist ? now.dist / pinch.dist : 1);
            pinch = now;
        }
    });
    box.on('pointerup pointercancel', '.npcb-web', (e) => {
        pointers.delete(e.originalEvent.pointerId);
        if (pointers.size < 2) pinch = null;
        if (!pointers.size) $(e.currentTarget).removeClass('dragging');
    });
    box.on('wheel', '.npcb-web', (e) => {
        const ev = e.originalEvent;
        ev.preventDefault();
        zoomAt(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0015)));
    });
    box.on('click', '[data-zoom]', (e) => {
        const z = $(e.currentTarget).data('zoom');
        if (z === 'reset') { resetView(); applyView(); return; }
        const r = box.find('.npcb-web')[0]?.getBoundingClientRect();
        if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, z === 'in' ? 1.25 : 0.8);
    });
    box.on('click', '.npcb-web-node, .npcb-tree-row', (e) => {
        if ($(e.currentTarget).is('.npcb-web-node') && view.moved >= 4) { view.moved = 0; return; } // the end of a drag, not a click
        const id = String($(e.currentTarget).data('id'));
        if (!id || id === st.center || id === USER_REF) return; // you have no relationship list of your own
        st.history.push(st.center);
        st.center = id;
        resetView();
        draw();
    });
    box.on('click', '[data-act="open"]', () => {
        const id = st.center;
        afterClose = () => {
            if (mode === 'library') { openCard(id, 'ext:relationships'); return; }
            closePopovers();
            const card = $('#npcb_roster .npcb-roster-cards .npcb-card').filter((_, el) => String($(el).data('id')) === id)[0];
            if (card) openInstanceEditor(id, card);
        };
        popup.complete(c.POPUP_RESULT.AFFIRMATIVE);
    });
    draw();
    await popup.show();
    afterClose?.();
}
