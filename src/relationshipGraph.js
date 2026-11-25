// NPC Book — Relationships: pure logic (no DOM / no SillyTavern imports), moved from NPC Book. Testable in Node.
// The relationships around one person, as a small graph, plus the two layouts that draw it (web and tree).

/**
 * Build the graph around `root`.
 *   rootRels        the root's relationships (may be an unsaved draft)
 *   relsOf(id)      anyone else's relationships ([] when unknown)
 *   depth           1 = the root's own relationships, 2 = also theirs ("+ their links")
 *   maxSecond       cap on extra people at depth 2, so a big cast stays readable
 * Returns { root, nodes: [{ id, level, parent }], edges: [{ from, to, rel, level, mutual }] }.
 * A relationship pointing back at someone already linked is shown once, marked mutual.
 */
export function buildRelationshipGraph(root, rootRels, { relsOf = () => [], depth = 2, maxSecond = 24 } = {}) {
    const nodes = new Map([[root, { id: root, level: 0, parent: null }]]);
    const edges = [];
    const findEdge = (a, b) => edges.find(e => (e.from === a && e.to === b) || (e.from === b && e.to === a));
    for (const r of rootRels || []) {
        if (!r?.to || r.to === root || nodes.has(r.to)) continue;
        nodes.set(r.to, { id: r.to, level: 1, parent: root });
        const back = (relsOf(r.to) || []).some(x => x?.to === root);
        edges.push({ from: root, to: r.to, rel: r, level: 1, mutual: back });
    }
    if (depth >= 2) {
        let extra = 0;
        for (const n of [...nodes.values()].filter(x => x.level === 1)) {
            for (const r of relsOf(n.id) || []) {
                if (!r?.to || r.to === n.id || r.to === root) continue;
                const existing = findEdge(n.id, r.to);
                if (existing) { existing.mutual = true; continue; }
                if (!nodes.has(r.to)) {
                    if (extra >= maxSecond) continue;
                    nodes.set(r.to, { id: r.to, level: 2, parent: n.id });
                    extra++;
                }
                edges.push({ from: n.id, to: r.to, rel: r, level: 2, mutual: false });
            }
        }
    }
    return { root, nodes: [...nodes.values()], edges };
}

/**
 * Radial layout in a w×h box: root in the centre, its people on an ellipse around it,
 * second-level people fanned out behind the person they belong to. Adds x, y (box units) to each node.
 */
export function layoutWeb(graph, { w = 860, h = 520 } = {}) {
    const cx = w / 2, cy = h / 2;
    const first = graph.nodes.filter(n => n.level === 1);
    const r1x = w * (first.length > 8 ? 0.35 : 0.31), r1y = h * 0.32;
    const r2x = w * 0.46, r2y = h * 0.44;
    const angle = new Map();
    const pos = new Map([[graph.root, { x: cx, y: cy }]]);
    first.forEach((n, i) => {
        const a = -90 + (i * 360) / Math.max(1, first.length);
        angle.set(n.id, a);
        pos.set(n.id, { x: cx + r1x * Math.cos(a * Math.PI / 180), y: cy + r1y * Math.sin(a * Math.PI / 180) });
    });
    const byParent = new Map();
    for (const n of graph.nodes.filter(x => x.level === 2)) byParent.set(n.parent, [...(byParent.get(n.parent) || []), n]);
    const spread = Math.max(10, Math.min(22, 200 / Math.max(1, first.length * 2)));
    for (const [parent, kids] of byParent) {
        const base = angle.get(parent) ?? 0;
        kids.forEach((n, j) => {
            const a = base + (j - (kids.length - 1) / 2) * spread;
            pos.set(n.id, {
                x: Math.min(w - 40, Math.max(40, cx + r2x * Math.cos(a * Math.PI / 180))),
                y: Math.min(h - 34, Math.max(34, cy + r2y * Math.sin(a * Math.PI / 180))),
            });
        });
    }
    return { ...graph, w, h, nodes: graph.nodes.map(n => ({ ...n, ...pos.get(n.id) })) };
}

/**
 * Tree layout: the root's relationships grouped by type (in the order of `types`, others after, untyped last),
 * each person with their own links underneath (depth 2). Returns [{ type, items: [{ rel, mutual, children: [rel] }] }].
 */
export function groupTree(graph, types = []) {
    const kids = (id) => graph.edges.filter(e => e.level === 2 && e.from === id).map(e => e.rel);
    const items = graph.edges.filter(e => e.level === 1).map(e => ({ rel: e.rel, mutual: e.mutual, children: kids(e.to) }));
    const order = (t) => { const i = types.indexOf(t); return i >= 0 ? i : t ? types.length : types.length + 1; };
    const groups = new Map();
    for (const it of items) {
        const t = it.rel.type || '';
        groups.set(t, [...(groups.get(t) || []), it]);
    }
    return [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0])).map(([type, list]) => ({ type, items: list }));
}

const SCALE = ['#ef476f', '#f28482', '#e9c46a', '#a7abb5', '#90be6d', '#06d6a0', '#8ecae6', '#c77dff'];

/** A colour for an attitude by its place in the (worst → best) list; unknown ones are grey. */
export function attitudeColor(attitude, attitudes = []) {
    const i = attitudes.indexOf(attitude);
    if (i < 0) return '#8a8f9c';
    if (attitudes.length < 2) return SCALE[4];
    return SCALE[Math.round((i * (SCALE.length - 1)) / (attitudes.length - 1))];
}
