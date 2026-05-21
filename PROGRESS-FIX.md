# HACCPrint — Progress & Fix Tracking

Documento di riferimento per gli sviluppi successivi all'audit del 2026-05-21.
Stato: app Tauri 2 + React + TS + Rust per stampa etichette HACCP Brother QL-800 su Windows.

---

## ✅ Fix completati

### F-001 · GDI multi-pagina (Problema 2 mitigato + Problema 1 risolto)
**Data:** 2026-05-21
**File toccati:** [src-tauri/src/lib.rs](src-tauri/src/lib.rs), [src-tauri/Cargo.toml](src-tauri/Cargo.toml)

**Cosa è stato fatto**
- Spostato `StartDocW` / `EndDoc` fuori dal loop copie in `print_png`. Ora 1 job spooler per N copie invece di N job separati.
- Aggiunto `DcGuard` RAII per garantire `DeleteDC` anche in caso di early-return.
- Aggiunta feature `windef` a `winapi` per il tipo `HDC`.
- `cargo check --release` passa pulito.

**Effetto atteso**
- Gap tra copie consecutive: ~2.8 s → ~0.3-0.8 s (solo feed/cut meccanico).
- L'errore "Impossibile aprire la porta USB. Errore Windows 3" sparisce dopo `npm run tauri build` + reinstall, perché il sorgente era già stato ripristinato a GDI mentre il binario installato (apr 2026) conteneva ancora il vecchio tentativo USB raster.

**Note per il rilascio**
- Richiede rebuild + reinstall dell'eseguibile sul PC target.
- Verificare con 5 e 10 copie consecutive che il gap sia effettivamente sceso sotto il secondo.

---

## 📋 Audit completo (2026-05-21)

Criticità divise per severità. Numerazione stabile per riferimenti futuri.

### 🔴 Bloccanti (B-xxx)

| ID | File / Riga | Descrizione |
|----|-------------|-------------|
| B-001 | `src-tauri/src/lib.rs:146-166` | `StartDoc/EndDoc` dentro al loop copie → gap 2.8s tra etichette. **FIX in F-001.** |
| B-002 | Build pipeline | Eseguibile installato (4 apr 2026) disallineato dal sorgente (21 mag 2026). Causa apparente dell'errore USB 3. **FIX dopo rebuild di F-001.** |

### 🟠 Sicurezza (S-xxx)

| ID | File / Riga | Descrizione |
|----|-------------|-------------|
| S-001 | `src/lib/supabaseClient.ts:4` | Anon key Supabase nel client (di per sé ok). **Da verificare urgentemente** che esistano RLS policy `auth.uid() = user_id` su `templates`, `print_jobs`, `categories`, `settings`, `accounts`. Senza RLS qualunque utente legge/scrive dati altrui. |
| S-002 | `src/lib/licenseService.ts:38-78` | `licenses/activate` chiamato dal client. Risposta `{success:true, plan:"premium"}` scritta su Supabase senza verifica server-side. Un utente con devtools può intercettare `setLicense({plan:"premium"})` e attivare premium gratis. Serve Edge Function proxy con API key Lemon Squeezy server-side. |
| S-003 | `src/lib/licenseService.ts:7-24` | `getDeviceId()` hash di userAgent+screen — su due PC identici (es. flotta ristoranti) ritorna lo stesso ID. Inutile come fingerprint per binding licenza→device. |
| S-004 | `src-tauri/capabilities/default.json` | Le invoke `print_label_image` e `list_printers` non sono nelle capabilities Tauri 2. Funziona oggi perché Tauri 2 espone comandi custom di default, ma se in futuro stringi capabilities romperai la stampa silenziosamente. |
| S-005 | `src-tauri/tauri.conf.json:42-47` | `pubkey: ""` nell'updater → **aggiornamenti non firmati**. Qualunque MITM può servire binario malevolo a tutti i clienti. Generare keypair con `tauri signer generate`. |

### 🟡 Bug logici / pattern (L-xxx)

| ID | File / Riga | Descrizione |
|----|-------------|-------------|
| L-001 | `src/App.tsx:71-89` | `initDone` è var di closure, non `useRef`. Funziona per fortuna; con StrictMode o re-render rapidi può rompersi. |
| L-002 | `src/store/useStore.ts:166-184` | `updateSettings` ottimistico senza rollback se upsert Supabase fallisce — UI mostra stato sbagliato per sempre. |
| L-003 | `src/store/useStore.ts:186-215` | Stesso problema di L-002 per `addTemplate`, `pinTemplate`, `addCategory`, `addPrintJob`, `deleteTemplate`, `updateTemplate`. |
| L-004 | `src/store/useStore.ts:300` | `setLicense` aggiorna solo stato locale, **non persiste** su Supabase. La persistenza avviene solo in `activateLicense` ([licenseService.ts:69-78](src/lib/licenseService.ts#L69-L78)). |
| L-005 | `src/pages/HomePage.tsx:362` | Riga morta: `templates.find((t) => t.id === job.templateId);` — risultato scartato. Residuo di refactor. |
| L-006 | `src/store/useStore.ts:43-50` | `SupabaseError` / `SupabaseResult` ridefiniti a mano invece di usare `PostgrestError`/`PostgrestResponse` esposti dall'SDK. Eliminano type safety. |
| L-007 | `src/lib/printService.ts:33` | `labelWMM = 62.0` hardcoded. Se in futuro supporti 29/38/102 mm devi ricordarti di toccare anche questo file. Dovrebbe venire dalle settings. |
| L-008 | `src/lib/labelRenderer.ts:99-135` | `calcHeight` crea un canvas nuovo per misurare il testo, chiamato due volte per stampa (anche da `calcLabelHeightMM`). Inefficiente. |
| L-009 | `src/lib/labelRenderer.ts:108` vs `:174-177` | Calcolo altezza vs render reale: discrepanza di mezzo gap fra altezza calcolata e effettiva. |
| L-010 | `src-tauri/src/lib.rs` (post-F-001) | Se `StartPage`/`StretchDIBits`/`EndPage` falliscono internamente, non c'è `EndDoc` di pulizia → job sospeso nello spooler. Mitigato in parte dal `DcGuard` ma `EndDoc` non viene chiamato. |
| L-011 | `src-tauri/src/lib.rs:30-40` | `EnumPrintersW` non controlla `GetLastError`. Se `ok==0` per `ERROR_INSUFFICIENT_BUFFER` ritorna vec vuoto → "nessuna stampante" silenzioso. |
| L-012 | `src/components/labels/PrintModal.tsx:26-37` | `useEffect` ricrea canvas DOM con `innerHTML=""`. Anti-pattern React, possibile flicker su modal aperto/chiuso rapidamente. Meglio `<canvas>` JSX con ref. |
| L-013 | `src/store/useStore.ts:62` + `src/App.tsx:55-79` | Dopo login `loadFromCloud` parte sia da `App.tsx` sia da `onAuthStateChange` → doppio fetch a ogni login. |
| L-014 | `src/lib/printService.ts:37` | `await import("@tauri-apps/api/core")` ad ogni stampa. In app desktop il modulo è già caricato — spostare in cima al file. |
| L-015 | `src-tauri/src/lib.rs:80-92` | `dmPaperSize = 256` (DMPAPER_USER) con `dmPaperWidth` in decimi di mm. Funziona perché `StretchDIBits` ridimensiona a `HORZRES/VERTRES`, ma se il driver Brother non rispetta il DEVMODE custom il rendering può venire schiacciato. |

### 🟢 Performance / risorse (P-xxx)

| ID | File / Riga | Descrizione |
|----|-------------|-------------|
| P-001 | `src/lib/labelRenderer.ts:4` + pipeline | SCALE=3 → canvas ~2196×~1500 px = ~13 MB raw RGBA → base64 ~17 MB stringa per ogni invoke. Su stampa singola non si nota; su 10 stampe rapide sì. Opzioni: `Channel<Vec<u8>>` Tauri 2, oppure rendering in Rust con `tiny-skia`. |
| P-002 | `src/components/UpdateChecker.tsx:73-128` | Testo banner aggiornamento **solo in italiano** ("Aggiornamento disponibile", "Aggiorna ora"). Resto dell'app è en/hu — inconsistente. |
| P-003 | `bridge/app.py` | File Python `brother_ql`+`pyusb` obsoleto, non più referenziato. Eliminabile. |
| P-004 | `src/store/useStore.ts` (8 occorrenze) | `eslint-disable @typescript-eslint/no-explicit-any` + cast `as any`. Tipi Supabase generabili con `supabase gen types typescript`. |
| P-005 | `src-tauri/src/main.rs:5` | Stub Tauri 2 standard che chiama `lib::run()`. Unificabile, non urgente. |
| P-006 | `src/lib/supabaseClient.ts` | URL e anon key hardcoded — niente `.env` con `VITE_SUPABASE_URL` significa impossibile gestire dev/prod senza rebuild. |

---

## 🛠️ Fix pianificati

Priorità in tre livelli: **P0** = fai subito, **P1** = entro 2-4 settimane, **P2** = backlog.

### Sicurezza

| ID | Priorità | Stima | Note |
|----|----------|-------|------|
| S-001 (RLS Supabase) | **P0** | 30 min | Verifica + creazione policy `auth.uid()=user_id` su 5 tabelle. Bloccante per privacy multi-tenant. |
| S-002 (bypass licenza) | **P0** | 4-6 h | Edge Function Supabase che fa proxy verso Lemon Squeezy con API key server-side. La key Pro viene scritta solo via Edge Function autenticata. |
| S-005 (updater non firmato) | **P0** | 1 h | `tauri signer generate` → mettere pubkey in `tauri.conf.json`, firmare i bundle in CI. Prima del prossimo rilascio. |
| S-003 (deviceId debole) | **P1** | 2 h | Su Tauri usare un identificatore stabile (es. `machine-uid` crate o GUID generato e salvato in AppData) invece di hash userAgent. |
| S-004 (capabilities) | **P2** | 15 min | Aggiungere allowlist esplicito `print_label_image`, `list_printers`. Cosmetico oggi, importante se si stringono le capabilities domani. |

### Bug logici

| ID | Priorità | Stima | Note |
|----|----------|-------|------|
| L-010 (EndDoc su errore) | **P1** | 30 min | Estendere il `DcGuard` per chiamare anche `EndDoc` se il job è stato avviato. Evita job sospesi nello spooler. |
| L-002 / L-003 (rollback Zustand) | **P1** | 2-3 h | Wrappare le mutazioni in un helper `mutateWithRollback(localUpdate, remoteCall, revert)` per ripristinare lo stato se la chiamata Supabase fallisce. |
| L-004 (`setLicense` non persiste) | **P1** | 30 min | O `setLicense` persiste su Supabase, o lo rimuoviamo dall'interfaccia pubblica e si passa solo da `activateLicense`/`removeLicense`. |
| L-013 (doppio fetch) | **P1** | 30 min | Lasciare il caricamento solo dentro `onAuthStateChange` (con evento `INITIAL_SESSION` di Supabase v2) e togliere quello manuale in `init()`. |
| L-001 (initDone closure) | **P2** | 15 min | Sostituire con `useRef<boolean>`. |
| L-005 (riga morta HomePage) | **P2** | 1 min | Eliminare riga `templates.find(...)`. |
| L-006 (tipi Supabase) | **P2** | 1 h | `supabase gen types typescript --project-id <id> > src/lib/database.types.ts` + sostituire `as any`. |
| L-008 / L-009 (calcHeight) | **P2** | 1 h | Funzione `measure(ctx, …)` riusabile, eliminare canvas usa-e-getta, allineare altezza calcolata a quella renderizzata. |
| L-011 (EnumPrinters) | **P2** | 15 min | Loop `while GetLastError()==ERROR_INSUFFICIENT_BUFFER`. |
| L-012 (canvas in PrintModal) | **P2** | 30 min | Componente con `<canvas ref={…}>` e disegno nel ref. |
| L-014 (import dinamico) | **P2** | 5 min | Spostare `import { invoke }` in top-level di `printService.ts`. |
| L-015 (DMPAPER_USER) | **P2** | 30 min | Testare su driver Brother con dmPaperSize specifico se disponibile, altrimenti documentare e lasciare. |
| L-007 (label width hardcoded) | **P2** | 1 h | Spostare `labelWMM` in `AppSettings` come `labelWidthMm: 29|38|62|102`. |

### Performance / qualità

| ID | Priorità | Stima | Note |
|----|----------|-------|------|
| P-005 (main.rs) | **P2** | 5 min | Niente di urgente. |
| P-006 (env Supabase) | **P1** | 30 min | `.env` con `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, leggere via `import.meta.env`. |
| P-002 (i18n updater) | **P1** | 15 min | Aggiungere chiavi `updater_*` a `src/lib/i18n.ts` e usarle. |
| P-003 (bridge Python) | **P2** | 1 min | Eliminare `bridge/app.py` (e cartella se vuota). |
| P-004 (tipi any in store) | **P2** | 1 h | Da fare insieme a L-006. |
| P-001 (pipeline PNG→base64) | **P2** | 1 giorno | Solo se le metriche mostrano lentezza percepita. Vedi anche roadmap stampa. |

---

## 🗺️ Roadmap stampa

### Stato attuale (post F-001)
- **GDI multi-pagina** via spooler Windows: 1 job, N pagine.
- Gap tra copie atteso: 0.3-0.8 s (feed + cut meccanico).
- Zero dipendenze native esterne, funziona con qualunque driver installato.

### Opzione B — Raster Brother nativo via spooler

**Quando implementarla:** quando il gap residuo (0.3-0.8 s) diventa un problema reale in produzione, p.es. workflow da 10+ etichette consecutive. **Non prima.** L'opzione A copre il 90% dei casi reali.

**Cosa fa**
- Genera in Rust il bytestream raster Brother QL-800 secondo lo *Brother QL Raster Command Reference*:
  - `\x00 × 200` (invalidate)
  - `ESC @` (initialize)
  - `ESC i a 0x01` (raster mode)
  - `ESC i z` (page info: media type, width 0x3E=62mm, length, ecc.)
  - `ESC i M` (auto cut on/off, ogni N etichette)
  - Per ogni raster line: `g 0x00 0x5A <90 bytes>` (90 byte = 720 pin / 8, di cui 696 attivi + 12 margine sx + 12 dx)
  - `\x1A` finale (print + cut)
- Manda il bytestream via **spooler Windows** con:
  - `OpenPrinterW` → `DOC_INFO_1{ pDatatype: "RAW" }` → `StartDocPrinterW` → `StartPagePrinter` → `WritePrinter` → `EndPagePrinter` → `EndDocPrinter` → `ClosePrinter`.

**Vantaggi vs Opzione C (CreateFileW diretto)**
- Niente `\\.\USBPRINT\…` da risolvere a mano (causa dell'errore Windows 3 di aprile).
- Niente conflitto di accesso esclusivo col driver Brother.
- Lo spooler gestisce la coda, i retry, e gli stati offline/error.

**Vantaggi vs Opzione A (attuale)**
- Una sola "pagina" raster contenente N etichette consecutive senza margini interni.
- Gap meccanico ridotto al minimo fisico (~50 ms).
- Controllo fine su cut (auto-cut ogni etichetta vs solo a fine job).

**Costo stimato**
- 2-3 ore: scrittura modulo `brother_raster.rs` (init + raster lines + cut).
- 1-2 ore: integrazione `WritePrinter` + gestione errori + test.
- Totale ~1 giorno con test su QL-800 reale.

**Prerequisiti tecnici**
- Aggiungere a `winapi` features: `winspool` (già presente) — non servono nuove feature.
- Conversione PNG → bitmap monocromatica 1-bit con threshold (es. 70%): si può fare con `image` crate (già dependency) usando `.to_luma8()` + threshold manuale.
- Decidere il `media_type` e `media_width` corretti per il nastro 62mm continuo (riferimento: §4 del Brother QL Raster Command Reference).

**Rischi**
- Se il driver Brother è in modalità "exclusive" con una sua coda interna, RAW potrebbe non bypassare quella coda — da verificare con un test pilota.
- I valori esatti di `ESC i z` cambiano tra QL-500/700/800/820 — codice da parametrizzare per modello.

### Opzione C — USB diretto (CreateFileW + SetupDi)

**Quando implementarla:** mai, salvo richieste specifiche per stampanti senza driver Windows (improbabile per Brother). L'opzione B copre tutti i casi pratici senza i problemi di permessi/path/esclusività.

Documentazione conservata solo per memoria:
- Path corretto richiede `SetupDiGetClassDevs(GUID_DEVINTERFACE_USBPRINT)` → `SetupDiEnumDeviceInterfaces` → `SetupDiGetDeviceInterfaceDetail` per ottenere il vero `DevicePath`.
- La stringa vista in Device Manager (`\\.\USBPRINT\BROTHERQL-800\6&348600CD&0&USB001`) è `LocationInformation`, non `DevicePath`: usarla con `CreateFileW` ritorna ERROR 3.
- Anche con il path corretto, se il driver Brother ha già aperto la porta in modalità esclusiva, `CreateFileW` ritorna ERROR_SHARING_VIOLATION (32).

---

## 📌 Convenzioni per i prossimi aggiornamenti

- Quando un'item viene fixato, spostarla da "Fix pianificati" a "Fix completati" con data e file toccati.
- Mantenere stabili gli ID (B-xxx, S-xxx, L-xxx, P-xxx) per poterli citare nei commit (`fix: rollback Zustand su L-002/L-003`).
- Nuove criticità trovate dopo l'audit: aggiungere alla sezione corrispondente con il prossimo numero libero.
