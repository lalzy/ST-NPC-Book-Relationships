// NPC Book — Relationships: a sister extension for NPC Book (API 7+).
// Who each NPC knows and how they feel about them: a Relationships tab on NPC cards and in-chat sheets, a web/tree view,
// relationships sent to the AI for everyone in the scene, and the AI's reported changes (per chat, rolled back on swipe).
// Built only on NPC Book's public API (window.NPCBook): see NPC Book's EXTENDING.md.

const MIN_API = 8;

async function start(api) {
    if (!(api?.apiVersion >= MIN_API)) {
        console.warn(`[NPC Book — Relationships] needs NPC Book API ${MIN_API}+, found ${api?.apiVersion}`);
        toastr.warning('NPC Book — Relationships needs a newer NPC Book.', 'NPC Book — Relationships');
        return;
    }
    const { register } = await import('./src/main.js');
    await register(api);
}

if (window.NPCBook) start(window.NPCBook);
else document.addEventListener('npcbook:ready', (e) => start(e.detail), { once: true });
