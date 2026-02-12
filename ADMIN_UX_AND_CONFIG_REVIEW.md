# Admin UX Review & Confirm/Probe Backend Support

## Part 1: UX Review of the Admin Panel

### Strengths
- **Clear information architecture**: Journey Templates, Journeys, Settings, Users are separated; Templates is the primary surface and defaults on load.
- **Consistent design system**: Uses `max-design-tokens` and `max-components`; typography and spacing feel consistent.
- **Useful empty states**: "No saved templates yet", "Select a completed journey to preview" set expectations.
- **Mobile considered**: Hamburger menu, mobile-only sidebar toggles ("Templates", "List"), and responsive layout.
- **Confirmation/Probe controls are present**: Each identity/journey variable has a Confirmation Mode (Bypass / Ask Verification); Phases and Swimlanes have Probe dropdowns (Trust Admin / Auto Probe / Always Probe).
- **Generated URL** with copy button supports sharing and testing templates.
- **Auth domains hint** on the login card reduces support burden when redirect issues occur.

### UX Improvements to Consider

1. **Density and scannability**
   - The template editor is long (many param-rows). Consider collapsible sections (e.g. "Identity", "Journey context", "Structure", "Prompts & persona") so admins can focus on one area.
   - "Confirmation Mode" and probe selects are easy to miss; a short inline help tip (e.g. "Bypass = use value without asking; Confirm = ask 'Is that correct?'") would clarify intent.

2. **Labels and hierarchy**
   - Param rows use "Provided by User" for many items; that’s redundant. Consider removing or replacing with a short behavioral note (e.g. "Pre-fill; user can override").
   - Phases/Swimlanes probe dropdown has no label, only `title="Probing Strategy"`. Add a visible label: e.g. "When pre-filled: Trust / Auto probe / Always ask".

3. **Save and feedback**
   - Save is a single primary button; no "Saved" or "Saving…" state. Add a brief toast or inline "Saved" after success and disable/loading state during save.
   - Delete (template/journey) uses `confirm()`; acceptable, but a small modal with "Delete template?" and Cancel/Delete would feel more consistent with the rest of the UI.

4. **Journeys module**
   - "Select a Journey" is clear; the Chat history panel is hidden by default, which is good. Consider showing a short message when no journey is selected (e.g. "Select a journey from the list to preview the map and conversation").

5. **Settings and Users**
   - Settings (Agent Name, AI Model, Global Auto-Active) are simple and clear.
   - Users table is super-admin only; ensure "Global Auto-Active" has a one-line explanation (e.g. "New sign-ins get access without manual approval").

6. **Login (when auth is re-enabled)**
   - Auth domains box is helpful; keep it. When re-enabling auth, consider moving it into a collapsible "Troubleshooting" section so the main card stays minimal.

7. **Accessibility**
   - Icon-only buttons (e.g. New Template, Copy URL, Logout) have or need `aria-label`/`title` for screen readers.
   - Form fields should be explicitly associated with labels (`for`/`id`) where missing.

8. **Probe threshold**
   - `probeThreshold` (0–1) exists in the data model and backend but is not exposed in the admin UI; phases/swimlanes use a default of 1.0. For "Auto Probe", a future slider or number input would allow tuning when to skip probing.

---

## Part 2: Confirm/Bypass and Probe Settings – Do They Exist in the Backend?

### Short answer
**Yes.** The backend has full support for confirmation modes (CONFIRM / BYPASS) and probe modes (NEVER_PROBE / AUTO_PROBE / ALWAYS_PROBE). The admin UI saves them, and the prompts and auto-execution logic use them. **One important gap:** when a user opens a journey via a **template link** (`?id=...`), the main app does **not** send the nested `identity`, `journey`, and `structure` config to the API, so at runtime the backend falls back to defaults (BYPASS and NEVER_PROBE) and the template’s saved confirm/probe settings are not applied.

---

### Confirm / Bypass (identity and journey)

| Layer | Status | Notes |
|-------|--------|------|
| **Admin UI** | ✅ | Name, Role, Journey Name, Journey Description each have a "Confirmation Mode" select: **Silent (Bypass)** / **Ask Verification**. |
| **Admin save/load** | ✅ | `getActiveConfig()` and template load in `script.js` read/write `identity.name.confirmationMode`, `identity.role.confirmationMode`, `journey.name.confirmationMode`, `journey.description.confirmationMode` and persist them in the link. |
| **Backend types** | ✅ | `SessionConfig`, `ConfigItem<T>`, `ConfirmationMode = 'CONFIRM' \| 'BYPASS'` in `api-mcp/src/ai/prompts.ts`. |
| **Backend prompts** | ✅ | `buildStep1(config)` uses `config.identity?.name?.confirmationMode` and `config.identity?.role?.confirmationMode` to choose BYPASS (silent, call tool immediately) vs CONFIRM (ask "Is that correct?" then call tool). `buildStep3(config)` does the same for `config.journey?.name?.confirmationMode` and `config.journey?.description?.confirmationMode`. |
| **Runtime config from template** | ⚠️ **Gap** | When the user enters the app via `?id=templateId`, the main app fetches the link but builds a **flat** `state.sessionConfig` (e.g. `name`, `role`, `journeyName`, `phases`, `swimlanes`) and does **not** pass `identity`, `journey`, or `structure` with confirmation/probe fields. So the backend receives no `config.identity` / `config.journey` and uses defaults (BYPASS). |

---

### Probe (phases and swimlanes)

| Layer | Status | Notes |
|-------|--------|------|
| **Admin UI** | ✅ | Phases and Swimlanes each have a probe dropdown: **Trust Admin (Fast)** / **Auto Probe (Smart)** / **Always Probe (Deep)** (values: NEVER_PROBE, AUTO_PROBE, ALWAYS_PROBE). |
| **Admin save/load** | ✅ | `getActiveConfig()` and template load write/read `structure.phases.probeMode`, `structure.swimlanes.probeMode` (and default `probeThreshold: 1.0`). |
| **Backend types** | ✅ | `GateConfig<T>`, `ProbeMode = 'ALWAYS_PROBE' \| 'NEVER_PROBE' \| 'AUTO_PROBE'` in `prompts.ts`. |
| **Backend prompts** | ✅ | `buildStep5(config)` and `buildStep7(config)` use `config.structure?.phases?.probeMode` and `config.structure?.swimlanes?.probeMode` to tailor instructions (trust pre-fill vs ask for details vs probe only when incomplete). |
| **Backend auto-execution** | ✅ | In `server.ts`, `shouldAutoExecute()` reads `configGroup.probeMode` for phases and swimlanes: **ALWAYS_PROBE** → never auto-run (AI must ask). **AUTO_PROBE** → auto-run only if all items have descriptions. **NEVER_PROBE** → auto-run when data is complete. |
| **Runtime config from template** | ⚠️ **Gap** | Same as above: loading by `?id=templateId` does not send `structure.phases` / `structure.swimlanes` (with `probeMode`). Backend falls back to `config.phases` / `config.swimlanes` (data only) and default `probeMode` **NEVER_PROBE**, so the template’s probe settings are not applied. |

---

### What was fixed (implemented)

1. **Main app (`front-end/index.html`)**  
   When loading a template via `?id=...`:
   - `remoteConfig` now includes nested `identity`, `journey`, and `structure` from `linkData` (with fallbacks to flat fields for legacy links), respecting toggles.
   - `state.sessionConfig` now receives `identity`, `journey`, and `structure` so the chat API gets `confirmationMode` and `probeMode`. URL params still override flat values (name, role, etc.) while keeping the template’s confirm/probe settings.

2. **Admin save payload (`front-end/admin/script.js`)**  
   - The payload previously set `journey` twice (nested object then legacy string), so the string overwrote the nested object. Legacy flat field is now `journeyName` so `journey` remains the nested object with `name`, `description`, `prompt`, and confirmation modes.
   - `probeThreshold: 1.0` is now included in `structure.phases` and `structure.swimlanes` when saving.

3. **API**  
   `/api/links/:id` already returns the full stored link; no change. New/updated templates now store and return the nested shape correctly.

---

## Summary

- **UX**: Admin is usable and well-structured; the main levers (confirm/bypass, probe) are present. Improvements: collapsible sections, clearer labels for probe, save feedback, and optional probe threshold in the UI.
- **Backend**: Confirm and probe logic is implemented and used in prompts and auto-execution. Fix applied: the main app now passes the full nested config when loading via ?id=... and the admin save payload was corrected. Previously the missing piece was ensuring the **main app passes the full nested config** when loading a template via `?id=...` so that the template’s confirm and probe settings are actually used at runtime.
