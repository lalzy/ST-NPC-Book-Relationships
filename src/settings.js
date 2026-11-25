// This extension's settings (its own entry in SillyTavern's extension settings) and its panel.

import { ctx, esc } from './host.js';

export const MODULE = 'npc_book_relationships';

export const DEFAULT_RULE = `Relationships:
- When your reply changes how a character feels about someone ([[USER]] or another character), or they form a new bond, add "relationships" to that character's entry with only what changed, e.g. {"id": "...", "relationships": {"user": {"type": "Friend", "attitude": "Friendly", "note": "Saved her from the bandit."}}}.
- Use "user" for [[USER]] and the id for anyone else. Give "type" only for a new or changed bond; "note" is one short line.
- "type" is one of: [[REL_TYPES]]
- "attitude" is one of: [[ATTITUDES]]
- Use these exact words. Anything else is ignored.`;

/** The first relationship rule (free-text types): copies that still hold it exactly move to the current one. */
const DEFAULT_RULE_V1 = `Relationships:
- When your reply changes how a character feels about someone ([[USER]] or another character), or they form a new bond, add "relationships" to that character's entry with only what changed, e.g. {"id": "...", "relationships": {"user": {"attitude": "Friendly", "note": "Saved her from the bandit."}}}.
- Use "user" for [[USER]] and the id for anyone else. Give "type" (friend, sister, rival, employer...) only for a new or changed bond; "note" is one short line.
- "attitude" is one of: [[ATTITUDES]]`;
const TYPES_V1 = ['Stranger', 'Acquaintance', 'Friend', 'Close friend', 'Lover', 'Spouse', 'Family', 'Sibling', 'Parent', 'Child', 'Mentor', 'Student', 'Employer', 'Employee', 'Colleague', 'Rival', 'Enemy'];

const DEFAULTS = {
    track: true, // send relationships and ask the AI for changes
    attitudes: ['Hostile', 'Distrustful', 'Wary', 'Neutral', 'Friendly', 'Warm', 'Close', 'Devoted'],
    // One type per line; "A <> B" pairs two types that are each other's reverse (used by the ⇄ link).
    relationshipTypes: ['Stranger', 'Acquaintance', 'Friend', 'Close friend', 'Lover', 'Spouse', 'Family', 'Sibling', 'Parent <> Child', 'Mentor <> Student', 'Employer <> Employee', 'Colleague', 'Rival', 'Enemy'],
    rule: DEFAULT_RULE,
    relViewLayout: 'web', // relationship view: 'web' | 'tree' (remembered)
    relViewDepth: 2, // 1 = direct only, 2 = + their links
};

/** Settings, created on first use from NPC Book's older relationship settings when there are any. */
export function settings() {
    const es = ctx().extensionSettings;
    if (!es[MODULE]) {
        const old = es.npc_book || {};
        const s = structuredClone(DEFAULTS);
        for (const k of ['attitudes', 'relationshipTypes', 'relViewLayout', 'relViewDepth']) if (old[k] !== undefined) s[k] = structuredClone(old[k]);
        if (typeof old.relationshipRule === 'string' && old.relationshipRule.trim()) s.rule = old.relationshipRule;
        es[MODULE] = s;
    }
    const s = es[MODULE];
    for (const [k, v] of Object.entries(DEFAULTS)) if (s[k] === undefined) s[k] = structuredClone(v);
    if (JSON.stringify(s.relationshipTypes) === JSON.stringify(TYPES_V1)) s.relationshipTypes = structuredClone(DEFAULTS.relationshipTypes);
    if (typeof s.rule === 'string' && s.rule.trim() === DEFAULT_RULE_V1.trim()) s.rule = DEFAULT_RULE;
    return s;
}

export const save = () => ctx().saveSettingsDebounced();

/** Drawer in Extensions → settings. */
export function mountSettings(api) {
    if ($('#npcbr_settings').length) return;
    const s = settings();
    const html = $(`<div id="npcbr_settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header"><b><i class="fa-solid fa-users-viewfinder"></i> NPC Book — Relationships</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
            <div class="inline-drawer-content">
                <label class="checkbox_label"><input type="checkbox" data-k="track"> Track relationships <i class="fa-solid fa-circle-info" title="Each NPC in the scene sends its relationships with you and with the others present, and the AI reports changes. Costs context. Off: the Relationships tabs stay, nothing is sent."></i></label>
                <div class="flex-container">
                    <label style="flex:1">Types <i class="fa-solid fa-circle-info" title="The only relationship types allowed, one per line. The AI must use one of these exact words; anything else is ignored. Pair two types with &lt;&gt; when each is the other's reverse (Employer &lt;&gt; Employee): the ⇄ link then gives the other person the paired type."></i><textarea data-list="relationshipTypes" class="text_pole textarea_compact" rows="8"></textarea></label>
                    <label style="flex:1">Attitudes <i class="fa-solid fa-circle-info" title="How an NPC feels about someone, one per line, worst to best. Enforced the same way as types."></i><textarea data-list="attitudes" class="text_pole textarea_compact" rows="8"></textarea></label>
                </div>
                <div class="menu_button" data-prompt="rule" style="width:fit-content"><i class="fa-solid fa-pen-to-square"></i> Relationship rule</div>
            </div>
        </div>
    </div>`);
    html.find('[data-k="track"]').prop('checked', !!s.track);
    html.on('change', '[data-k="track"]', (e) => { s.track = e.target.checked; save(); api.refreshScene(); });
    html.find('[data-list]').each((_, el) => { $(el).val((s[$(el).data('list')] || []).join('\n')); });
    html.on('input', '[data-list]', (e) => {
        s[$(e.target).data('list')] = String(e.target.value).split(/\n|,/).map(x => x.trim()).filter(Boolean);
        save();
        api.refreshPrompts();
    });
    html.on('click', '[data-prompt]', async () => {
        const c = ctx();
        const box = $(`<div style="text-align:left;display:flex;flex-direction:column;gap:6px"><small>${esc('Added to NPC Book\'s tracking rules while relationships are tracked. Placeholders: [[REL_TYPES]] [[ATTITUDES]] [[USER]].')}</small><textarea class="text_pole" rows="12"></textarea><div class="menu_button npcbr-reset" style="width:fit-content"><i class="fa-solid fa-rotate-left"></i> Reset to default</div></div>`);
        const ta = box.find('textarea').val(String(s.rule ?? ''));
        box.on('click', '.npcbr-reset', () => ta.val(DEFAULT_RULE));
        if (!await c.callGenericPopup(box, c.POPUP_TYPE.CONFIRM, '', { wide: true, large: true, okButton: 'Save', cancelButton: 'Cancel' })) return;
        s.rule = String(ta.val());
        save();
        api.refreshPrompts();
    });
    $('#extensions_settings2').append(html);
}
