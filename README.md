# NPC Book — Relationships

A sister extension for [NPC Book](https://github.com/lalzy/ST-NPC-Book) (needs NPC Book 2.0, API 8+).

Who each NPC knows and how they feel about them:

- A **Relationships** tab on every NPC card (starting relationships) and a **Relationships** tab in each chat NPC's popover (that chat's own copy, showing what changed in this chat).
- Types and attitudes come from fixed lists you set (Friend, Rival, Employer <> Employee…), so the AI's wording cannot drift.
- **⇄ Both directions**: give the other person the relationship back (the paired type, e.g. Employer → Employee) when you save.
- **Web / tree view** of the relationships around someone, two levels deep.
- **Track relationships**: each NPC in the scene sends its relationships with you and with the others present, and the AI reports changes. These are kept per chat and roll back with swipes.

Settings: **Extensions** → **NPC Book — Relationships**.

## Install
Install it like any SillyTavern extension (Extensions → Install extension, or copy this folder to `SillyTavern/data/<your-user>/extensions/`), next to NPC Book.

## Upgrading from NPC Book 1.x
Relationships, types, attitudes and the relationship rule you set in NPC Book 1.x are read as they are. Tracking is on once this extension is installed; switch it off in its settings to keep the tabs without sending anything.

## How it is built
Only through NPC Book's public API (`window.NPCBook`), so it is also a full example for writing your own sister extension. See NPC Book's `EXTENDING.md`. Hooks used: `cardTab` (with `onSave` and `chatTab`), `onInstanceCreate`, `onTrackerEntry`, `entryKeys`, `sceneXml` (`sceneXmlAlways`), `instructions`, `placeholders`.
