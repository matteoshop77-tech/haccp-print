# HACCPrint

Professional label printing for restaurants, hotels, bakeries and more.
Built with React + Tauri. Supports Brother QL-800.

---

## Quick start (development — browser only, no Rust needed)

```bash
npm install
npm run dev
```

Open http://localhost:1420 in your browser.
For UI development you don't need the printer at all — printing
invokes are only available in the desktop build (Tauri).

---

## Full desktop app (requires Rust + Tauri CLI)

### Prerequisites

1. **Node.js** 18+ — https://nodejs.org
2. **Rust** — https://rustup.rs  
   Run: `rustup update stable`
3. **Tauri CLI**  
   Run: `npm install` (it's in devDependencies)
4. **Visual Studio C++ Build Tools** (Windows)  
   Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/  
   Install workload: "Desktop development with C++"
5. **WebView2** — already on Windows 11, or download from Microsoft

### Run in dev mode (hot reload)

```bash
npm run tauri dev
```

### Build installer (.exe)

```bash
npm run tauri build
```

The installer will be at:
`src-tauri/target/release/bundle/nsis/HACCPrint_1.0.0_x64-setup.exe`

---

## Printer setup

1. Download Brother QL-800 drivers from https://support.brother.com
2. Install normally — the printer will appear in Windows as "Brother QL-800"
3. Load 62mm continuous label roll
4. HACCPrint will auto-detect it

No Zadig, no WinUSB, no Python needed.

---

## Project structure

```
src/
  components/
    layout/     AppShell, sidebar navigation
    labels/     PrintModal, label preview
  pages/
    HomePage    Quick print dashboard
    LabelsPage  Browse & manage templates
    LogPage     HACCP compliance log
    SettingsPage Industry profiles, language, license
  lib/
    types.ts        Core TypeScript types
    i18n.ts         EN + HU translations
    printService.ts Print logic (Tauri + dev fallback)
  store/
    useStore.ts     Zustand global state (persisted)

src-tauri/
  src/
    lib.rs      Print command, auto-detect Brother printer
    main.rs     Entry point
```

---

## Adding a new label type

1. Add the type to `src/lib/types.ts` → `LabelType`
2. Add translations in `src/lib/i18n.ts` → `type_*` keys
3. Add the build logic in `src/lib/printService.ts` → `buildLabelLines()`
4. Done — it appears automatically in the UI

## System templates

Most label types are user-created templates stored per account. One type —
**Opening date** (`type: "bontas"`, "Bontás napja" in Hungarian) — is a **system
template**: a real row in `templates` with `is_system_template = true`, auto-provisioned
once per account (no longer a hardcoded synthetic `"bontas-fixed"` card).

- A database trigger on `auth.users` creates the Opening date system template for every
  new account; existing accounts were backfilled.
- It is hidden from the Home grid, the Labels list and the Unassigned-labels panel to
  avoid showing it twice (the Home `BontasCard` already renders it).
- It prints like any other template: the desktop print-queue listener resolves it
  store-first, and external apps receive it through `GET /templates` as a regular
  `type: "bontas"` entry. It is auto-assigned to active connected apps.
- Guardrails against editing/deleting it are currently **UI-only**; a database-level
  (RLS) hard block is a planned follow-up.

## Adding a new language

1. Add the language code to `src/lib/types.ts` → `Language`
2. Add the translations object in `src/lib/i18n.ts`
3. Add the language button in `src/pages/SettingsPage.tsx`
