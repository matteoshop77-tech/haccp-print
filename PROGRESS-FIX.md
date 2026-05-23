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

### F-003 · Opzione B — Brother QL-800 raster nativo via WritePrinter RAW
**Data:** 2026-05-22
**File toccati:** [src-tauri/src/lib.rs](src-tauri/src/lib.rs)

**Contesto**
Con 20 copie la pipeline GDI accumulava ~40-50 s di attesa prima che la stampante iniziasse: ogni `StretchDIBits` mandava ~13 MB di BGRA al driver Brother, che ri-eseguiva la conversione GDI→raster proprietario per ogni singola copia (260 MB totali su 20 copie) e bufferizzava internamente prima di aprire la porta USB. Bottleneck driver-side, non Rust-side.

**Cosa è stato fatto**
- **Generazione raster diretta in Rust** (`build_brother_raster_62mm`): PNG decoded, resized a 696 px di larghezza con `image::imageops::FilterType::Triangle`, convertito a luma8, threshold a 128, packed MSB-first a 90 byte/riga con offset di 12 pin di margine sinistro per centrare sulla testina da 720 pin.
- **Comand sequence Brother**: 200×`0x00` + `ESC @` (init), `ESC i a 0x01` (raster mode), `ESC i z` con flags `0x8E` + media type `0x0A` (continuous) + width `62` + length `0` + raster_number LE, `ESC i M 0x40` (auto-cut on), `ESC i A 0x01` (cut ogni etichetta), `M 0x00` (compression uncompressed, richiesto dal QL-800 prima del primo `g`), N×raster line `0x67 0x00 0x5A` + 90 byte, terminatore `0x1A`.
- **Spedizione RAW** (`send_raw_to_printer`): `OpenPrinterW` → `StartDocPrinterW` con `DOC_INFO_1W{ pDatatype: "RAW" }` → `StartPagePrinter` → `WritePrinter` × N sul medesimo buffer (render once, send N times) → `EndPagePrinter` → `EndDocPrinter` → `ClosePrinter`. Tutte le risorse spooler gestite via RAII guard (PrinterGuard, DocGuard, PageGuard) — drop order LIFO garantisce teardown corretto anche su early-return.
- **Rimosso** tutto il GDI path: `CreateDCW`, `DEVMODEW`, `StretchDIBits`, `StartDocW`/`EndDoc`, `DcGuard`. Eliminati import `wingdi::*` e `shared::windef`.
- **Signature pubblica `print_png` invariata** per compatibilità con `print_label_image`: `label_w_mm`/`label_h_mm` ora unused ma mantenuti per estensione futura su nastri 29/38/102 mm (vedi L-007).

**Effetto atteso**
- Prima etichetta inizia a stampare in ~200-300 ms invece di 40-50 s su 20 copie.
- Buffer per etichetta ~25-50 KB invece di 13 MB. Per 20 copie: ~500 KB-1 MB totali transferiti allo spooler vs 260 MB di BGRA.
- Gap tra etichette dominato dal cutter meccanico (~200 ms con auto-cut on, ~50 ms senza).
- Spooler RAW = pass-through: la stampa parte non appena il primo `WritePrinter` flusha verso USB.

**Note per il rilascio**
- Richiede rebuild + reinstall sul PC target. `cargo check --release` passa pulito (zero warning).
- Valori `ESC i z` validi per nastro continuo 62 mm. Per supportare 29/38/102 mm serve parametrizzare `media_width` e calcolare `LEFT_MARGIN_PINS` corretto per ogni formato — collegare con L-007.
- Test pilota consigliato: 1 copia per validare orientamento/threshold, poi 20 copie per validare il fix di latenza.
- Se il driver Brother è installato ma la stampante è offline, `OpenPrinterW` riesce comunque ma il job resta in coda; `WritePrinter` ritorna ok ma niente esce dalla stampante. Comportamento corretto (lo spooler gestisce la coda).
- Risolve anche L-010 (EndDoc su errore) — il vecchio GDI path non chiamava `EndDoc` su fail di `StretchDIBits`. La nuova versione usa RAII per garantire teardown in ogni branch.
- Rende obsoleto L-015 (DMPAPER_USER) — niente più `DEVMODE`, il formato carta è specificato nel raster command stesso.

### F-004 · Fix mirror orizzontale nel raster encoding
**Data:** 2026-05-22
**File toccati:** [src-tauri/src/lib.rs](src-tauri/src/lib.rs)

**Contesto**
Subito dopo F-003 la stampa usciva specchiata orizzontalmente: testo leggibile ma riflesso (es. "ABC" → "CBA"). L'ordine verticale era corretto, quindi il problema era localizzato al solo bit packing all'interno di ogni raster line.

**Cosa è stato fatto**
- In `build_brother_raster_62mm`, lettura del PNG da destra a sinistra: `let src_col = PRINT_PINS - 1 - col;` prima di `luma.get_pixel(src_col, row)`. Il pin mapping `col + LEFT_MARGIN_PINS` e il bit packing MSB-first restano invariati.

**Diagnosi**
Il QL-800 mappa "pin 0" (= bit 7 del primo byte di ogni raster line) sul bordo che a etichetta espulsa l'utente vede come **destro**, non sinistro come assumeva il codice iniziale. La libreria `brother_ql` Python aggira questo aspetto applicando rotazioni preventive nell'auto-orientamento dell'immagine; noi lavoriamo su un PNG già in orientamento portrait corretto per la lettura umana e quindi serve un flip orizzontale esplicito al packing.

**Scartate**
- `dyn_img.fliph()` prima del resize → O(W×H) di overhead inutile.
- Inversione LSB/MSB nel byte → produrrebbe scramble a gruppi di 8 px, non un mirror pulito (non è la causa).
- Riempimento `line[BYTES_PER_LINE - 1 - byte_idx]` → confonde il lettore senza guadagno.

### F-005 · Fix leggibilità etichette "Prepared:" / "Use by:" su stampa
**Data:** 2026-05-22
**File toccati:** [src/lib/labelRenderer.ts](src/lib/labelRenderer.ts)

**Contesto**
Le label "Prepared:" / "Use by:" / "Opened:" (e gli equivalenti ungheresi "Elkészítve:" / "Felhasználható:" / "Bontás dátuma:") uscivano sbiadite o spezzate sul nastro Brother — leggibili a schermo ma quasi invisibili sul printed.

**Diagnosi**
`COL_LABEL = "#777777"` ha luma 119, appena sotto il threshold a 128 di `build_brother_raster_62mm`. Dopo il resize 2196 → 696 px con filtro Triangle, i tratti sottili del peso regular (`fontR(F_LABEL)`) venivano attenuati e una parte significativa dei pixel finiva sopra il threshold → bianchi.

**Cosa è stato fatto**
- `COL_LABEL` da `#777777` a `#000000`. Unico punto di utilizzo: `drawDateRow`. Niente altre modifiche.

**Note**
- La gerarchia visiva (label vs valore) resta differenziata dal **peso del font**: label in regular, valori in medium/bold. Black + regular ≠ Black + bold visivamente.
- Considerare in futuro se anche `COL_ALLERG = "#444444"` (luma 68) abbia problemi simili. Sotto threshold ma con stesso meccanismo di attenuazione su resize.

### F-002 · Zero-config printer detection
**Data:** 2026-05-21
**File toccati:** [src-tauri/src/lib.rs](src-tauri/src/lib.rs), [src/App.tsx](src/App.tsx), [src/pages/HomePage.tsx](src/pages/HomePage.tsx), [src/pages/SettingsPage.tsx](src/pages/SettingsPage.tsx), [src/lib/i18n.ts](src/lib/i18n.ts)

**Cosa è stato fatto**
- **Rust — match prioritario**: nuova funzione `win_print::pick_best_brother(&[String]) -> Option<String>` con priorità `ql-800` > `ql-` > `brother`. Usata sia nel fallback di `print_label_image` sia nella nuova invoke `find_brother_printer`.
- **Rust — nuova invoke `find_brother_printer`**: ritorna `Option<String>` con la migliore Brother trovata o `null`. Registrata in `tauri::generate_handler!`.
- **Frontend — auto-pick all'avvio**: in [App.tsx](src/App.tsx) helper `autoPickPrinterIfMissing` chiamato dopo `loadFromCloud` sia in `init()` sia nel listener `SIGNED_IN`. Se `settings.printerName === null` chiama l'invoke e salva via `updateSettings`. L'utente non vede mai la pagina Settings al primo avvio se ha il driver Brother installato.
- **HomePage — badge reattivo**: il badge hardcoded "Brother QL-800 · Online" è stato sostituito da uno reattivo. Se `settings.printerName` è settato → badge verde con nome reale e "Ready"; altrimenti → bottone rosso "Driver not detected" che linka a `/settings`.
- **SettingsPage — banner driver**: in `DeviceSection` due banner distinti:
  - Rosso se zero stampanti installate (link a brother.com)
  - Arancio se ci sono stampanti ma nessuna Brother/QL- rilevata
- **i18n — nuove chiavi**: `printer_ready`, `printer_no_driver`, `printer_no_brother` in en + hu.

**Effetto atteso**
- **Flusso "happy path"**: utente installa driver Brother → lancia app → fa login → stampa. Zero interazione con Settings.
- **Flusso "driver mancante"**: utente vede subito sulla HomePage il bottone rosso "Driver not detected" che porta direttamente alla Settings → Printer con istruzioni e link al sito Brother.
- `cargo check --release` + `tsc --noEmit` puliti.

**Note**
- L'auto-pick avviene anche dopo aver fatto SIGNED_OUT + SIGNED_IN (utile se l'utente cambia macchina).
- Se in futuro l'utente avesse più stampanti Brother (es. QL-800 + QL-820), viene preferita la QL-800 grazie al match prioritario; può comunque cambiarla manualmente da Settings.
- Risolve in anticipo parte del lavoro previsto per S-004 (capabilities): la nuova invoke `find_brother_printer` andrà aggiunta all'allowlist se/quando si stringono le capabilities.

### F-006 · S-005 firma updater Tauri 2
**Data:** 2026-05-22 (commit `a24122b` + `2b467f0`)
**File toccati:** [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json), [.gitignore](/.gitignore), [build-release.ps1](build-release.ps1)

- Generata keypair ed25519 via `tauri signer generate`, salvata in `$HOME\.tauri\haccprint.key` (cifrata con password).
- Pubkey base64 in `plugins.updater.pubkey` di `tauri.conf.json`. Da ora i client embeddano la pubkey e accettano solo update firmati con la corrispondente private key.
- `.gitignore` esteso a `*.key` e `*.key.pub`. Verificato che nessuna chiave sia mai stata committata.
- Aggiunto [build-release.ps1](build-release.ps1) che setta `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (Read-Host -AsSecureString) e lancia `npm run tauri build`. `try/finally` pulisce le env var anche su Ctrl+C.

**Note**
- Per il primo rilascio firmato: caricare installer + `.sig` sulla GitHub Release, generare `latest.json` con `signature` inline.
- Backup di private key + password **non negoziabile**: perdere entrambe = niente più update per i clienti esistenti.
- Non risolve i warning SmartScreen Windows ("Unknown Publisher") — quello richiede Authenticode separato.

### F-007 · L-013 + L-001 fetch unificato in onAuthStateChange
**Data:** 2026-05-22 (commit `24646e1`)
**File toccati:** [src/App.tsx](src/App.tsx)

- Rimossa `init()` (~30 righe) e flag `initDone`. La gestione auth è ora interamente reattiva su `supabase.auth.onAuthStateChange`.
- `INITIAL_SESSION` (Supabase v2: fired all'avvio con sessione ripristinata o `null`) condivide lo stesso branch di `SIGNED_IN`, eliminando il doppio fetch.
- Effetto collaterale: anche **L-001** (`initDone` closure non protetta da StrictMode) è risolto, perché `initDone` non esiste più.
- **Regressione introdotta**: il caricamento dati awaitato dentro al callback ha causato deadlock col lock auth di GoTrueClient — il callback awaita le query, le query richiedono il lock già tenuto dal callback stesso → fetch mai inviato, spinner infinito. Risolto in **F-012** (2026-05-23, commit `cae959b`) spostando il caricamento in `useEffect` separato basato su `user?.id`.

### F-008 · L-002 + L-003 rollback ottimistico Zustand
**Data:** 2026-05-22 (commit `9a379cc`)
**File toccati:** [src/store/useStore.ts](src/store/useStore.ts)

- Pattern uniforme applicato a 7 funzioni (`updateSettings`, `addTemplate`, `updateTemplate`, `deleteTemplate`, `pinTemplate`, `addCategory`, `addPrintJob`):
  1. Snapshot della slice rilevante prima del `set` ottimistico.
  2. Se la chiamata Supabase ritorna `error`: log + ripristino dello snapshot.
- `addPrintJob` cattura sia `printJobs` che `templates` (per il `printCount` incrementato).
- Limite noto: in caso di race fra due mutazioni sulla stessa slice di cui una fallisce, il rollback riporta lo stato pre-prima sovrascrivendo anche la seconda. Accettabile per app single-user low-write.

### F-009 · P-006 config Supabase in env vars
**Data:** 2026-05-22 (commit `d99c0f6`)
**File toccati:** [src/lib/supabaseClient.ts](src/lib/supabaseClient.ts), `.env`, [.env.example](/.env.example), [src/vite-env.d.ts](src/vite-env.d.ts)

- URL e anon key letti da `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- Throw esplicito all'init se mancanti, messaggio rimanda a `.env.example`.
- `.env.example` (committato) per documentare i nomi delle var. `.env` è gitignored.
- `src/vite-env.d.ts` aggiunto: prima non esisteva, necessario per il typing di `ImportMetaEnv`.

**Nota sicurezza**: l'anon key resta visibile nel bundle prodotto (Vite la inlinea — il prefisso `VITE_` la rende pubblica per design). Il beneficio è la separazione config/sorgente e la possibilità di rotazione senza patch del codice. La protezione vera contro accessi cross-tenant sono le RLS policy Supabase (vedi **S-001**, ancora aperto).

### F-010 · Batch P2 cleanup (P-002, P-003, L-005, L-014, S-004)
**Data:** 2026-05-22
**File toccati:** [src/components/UpdateChecker.tsx](src/components/UpdateChecker.tsx), [src/lib/i18n.ts](src/lib/i18n.ts), [src/pages/HomePage.tsx](src/pages/HomePage.tsx), [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json), [README.md](README.md), `bridge/` (rimossa)

- **P-002 (i18n updater)**: 6 chiavi `updater_*` aggiunte a `i18n.ts` (en + hu). `UpdateChecker.tsx` legge `lang` da `useStore` e usa `t(...)` invece dei literal italiani precedenti ("Aggiornamento disponibile", "Dopo", "Aggiorna ora", ecc.).
- **P-003 (bridge Python)**: rimosso `bridge/app.py` (script Python `brother_ql` + `pyusb`, non più referenziato a runtime dopo F-003). Rimossa la cartella `bridge/` (vuota dopo). Aggiornato `README.md` per togliere il riferimento obsoleto al "Python print bridge on port 8013".
- **L-005 (riga morta)**: rimossa `templates.find((t) => t.id === job.templateId);` da `HomePage.tsx` — espressione con risultato scartato, residuo di refactor. Side-effect-free, delete sicura.
- **L-014 (import dinamico Tauri)**: già risolto a inizio sessione (incluso in commit `afc56c7`), `await import("@tauri-apps/api/core")` sostituito con import statico in `printService.ts`, `SettingsPage.tsx`, `App.tsx`. Catalogato qui per chiusura del ticket.
- **S-004 (capabilities)**: aggiunto `description` esteso in `default.json` che documenta i custom invoke esposti (`print_label_image`, `list_printers`, `find_brother_printer`). **In Tauri 2 non esiste sintassi di per-command allowlist per non-plugin invoke**, quindi questo fix è documentativo — la formulazione originale del ticket era basata sul modello Tauri 1. Il tightening reale (rimuovere `core:default` granulare) richiede audit dedicato — fuori da questo P2.

### F-011 · Batch L1: setLicense persistence, EnumPrinters retry, canvas React-controlled
**Data:** 2026-05-22
**File toccati:** [src/store/useStore.ts](src/store/useStore.ts), [src-tauri/src/lib.rs](src-tauri/src/lib.rs), [src-tauri/Cargo.toml](src-tauri/Cargo.toml), [src/lib/labelRenderer.ts](src/lib/labelRenderer.ts), [src/components/labels/PrintModal.tsx](src/components/labels/PrintModal.tsx)

- **L-004 (setLicense persiste)**: `setLicense(l)` ora fa l'upsert su `accounts` (license_key/plan/expires_at/activated_at) quando `l` non è null, con rollback dello stato locale se Supabase ritorna error (stesso pattern di F-008). Su `null` resta locale-only — la persistenza del clear passa da `removeLicense`. L'upsert duplicato con `activateLicense` (che già scriveva) è idempotente, niente effetto collaterale visibile.

- **L-011 (EnumPrinters error handling)**: la double-call ignorava `GetLastError`. Riscritto come retry loop a 3 tentativi (pattern Win32 canonico):
  1. Prima call con buffer NULL fallisce con `ERROR_INSUFFICIENT_BUFFER` (atteso), popola `needed`.
  2. Allocazione + retry. Se la lista è cresciuta nel frattempo, altro `ERROR_INSUFFICIENT_BUFFER` → resize + retry.
  3. Errori non-buffer → `eprintln` + return vec vuoto (vs il "silent empty" precedente).
  - Aggiunte feature `errhandlingapi` e `winerror` a `Cargo.toml` per `GetLastError` e `ERROR_INSUFFICIENT_BUFFER`.
  - Signature pubblica invariata (`Vec<String>` — Tauri-friendly). Gli errori vanno in stderr, frontend continua a vedere "0 printers" come fallback comportamentale.

- **L-012 (canvas React-controlled)**: estratto `drawLabelOnCanvas(canvas, template, preparedDate, lang)` da `labelRenderer.ts`. `renderLabelToCanvas` esistente ora è un thin wrapper (`document.createElement("canvas") + drawLabelOnCanvas`), backward-compatible con `renderLabelToPNG` chiamato da `printService.ts`. `LabelPreview` in `PrintModal.tsx` riscritto: ora ha `<canvas ref={canvasRef} />` JSX e in `useEffect` chiama `drawLabelOnCanvas(canvasRef.current, ...)` + style scaling. Eliminato il pattern `innerHTML="" + appendChild` (anti-pattern React: ogni re-render distruggeva/ricreava il DOM child).
  - **Verifica visiva consigliata**: stampare 1 etichetta prima e dopo per confermare che il PNG generato sia bit-per-bit identico (la pipeline raster non è cambiata, solo il container in cui il canvas vive).

### F-012 · L-016 deadlock loadFromCloud (lock auth GoTrueClient)
**Data:** 2026-05-23 (commit `cae959b`)
**File toccati:** [src/App.tsx](src/App.tsx), [src/store/useStore.ts](src/store/useStore.ts)

**Diagnosi**
`loadFromCloud` era awaitato dentro il callback di `supabase.auth.onAuthStateChange`. Il callback gira mentre il lock interno di GoTrueClient (`navigator.locks`, storageKey `haccprint-auth`) è tenuto. Ogni `supabase.from(...).select(...)` chiama internamente `auth.getSession()` per allegare l'header `Authorization`, e `getSession()` deve acquisire **lo stesso lock** → deadlock. Sintomo: log `"loadFromCloud called with userId: ..."` in console, **zero chiamate verso supabase.co** nella Network tab (il fetch non viene mai inviato), `Promise.allSettled` non si risolve mai, `setChecking(false)` mai raggiunto → spinner infinito.

**Cosa è stato fatto**
- **App.tsx**: callback `onAuthStateChange` reso **sincrono** — fa solo `setAuth` / `resetStore` / `clearAuth` / `setChecking(false)`. Niente più `await` su Supabase dentro al callback.
- **App.tsx**: caricamento dati (`loadAccountData`, `loadFromCloud`, `autoPickPrinterIfMissing`) spostato in un `useEffect` separato con dep `[user?.id]`, eseguito quindi fuori dal lock. `user?.id` (non `user`) come dep per evitare doppio fetch su `setAuth` ripetuti con stessa identità (es. `TOKEN_REFRESHED`).
- **useStore.ts**: difesa in profondità — `Promise.race` fra `Promise.allSettled` delle 5 query e un timeout di 10s. Il `catch` esistente cattura l'eventuale timeout e setta `loaded: true`, sbloccando lo store.
- **App.tsx**: spinner gated su `checking || (user && !loaded)`. Disaccoppia il blocco render dal completamento di `loadFromCloud`: `loaded` viene settato sempre (successo, errore, timeout), quindi il gate si chiude in al più 10 secondi anche nello scenario peggiore.

**Note**
- **Bug introdotto dal commit `24646e1` (entry F-007)** quando il caricamento dati è stato consolidato dentro `onAuthStateChange`. Il pattern pre-F-007 (useEffect separato) non aveva il problema; F-012 lo ripristina mantenendo la deduplicazione del fetch via `user?.id` come dep.
- Supabase documenta esplicitamente: *"Avoid making any async Supabase calls inside the [onAuthStateChange] callback. Wrap them in `setTimeout(..., 0)` to break out of the lock context."* Lo `useEffect` separato è equivalente e più pulito del `setTimeout(0)`.
- Verifica manuale post-fix: app carica, dati appaiono, nessuna regressione su login/logout/refresh. `tsc --noEmit` pulito.

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
| L-016 | `src/App.tsx:56-65` (post F-007) | `loadFromCloud` awaitato dentro callback `onAuthStateChange` → deadlock col lock auth di GoTrueClient (ogni query Supabase richiede a sua volta il lock già tenuto). Sintomo: log "loadFromCloud called…" ma zero traffico verso supabase.co, spinner infinito. **FIX in F-012.** |

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
| ~~S-005~~ (updater non firmato) | ✅ done | — | Risolto in F-006: pubkey ed25519 embedded in `tauri.conf.json`, build firmati via `build-release.ps1`. |
| S-003 (deviceId debole) | **P1** | 2 h | Su Tauri usare un identificatore stabile (es. `machine-uid` crate o GUID generato e salvato in AppData) invece di hash userAgent. |
| ~~S-004~~ (capabilities) | ✅ done | — | Documentato in F-010. Tauri 2 non ha sintassi di per-command allowlist per non-plugin invoke; il fix originale del ticket era basato su modello Tauri 1. |

### Bug logici

| ID | Priorità | Stima | Note |
|----|----------|-------|------|
| ~~L-010~~ (EndDoc su errore) | ✅ done | — | Risolto in F-003: il nuovo path RAW usa `DocGuard`/`PageGuard` RAII che garantiscono `EndDocPrinter`/`EndPagePrinter` in ogni branch. |
| ~~L-002 / L-003~~ (rollback Zustand) | ✅ done | — | Risolto in F-008: snapshot+restore inline per le 7 mutazioni ottimistiche di useStore. |
| ~~L-004~~ (`setLicense` non persiste) | ✅ done | — | Risolto in F-011: upsert su `accounts` quando license non-null + rollback su error. `null` resta locale-only (per il clear esiste `removeLicense`). |
| ~~L-013~~ (doppio fetch) | ✅ done | — | Risolto in F-007: rimossa `init()` manuale, tutto su `onAuthStateChange` con `INITIAL_SESSION`. |
| ~~L-001~~ (initDone closure) | ✅ done | — | Risolto in F-007 come effetto collaterale di L-013 (rimosso `initDone` insieme a `init()`). |
| ~~L-005~~ (riga morta HomePage) | ✅ done | — | Risolto in F-010: riga `templates.find(...)` eliminata. |
| L-006 (tipi Supabase) | **P2** | 1 h | `supabase gen types typescript --project-id <id> > src/lib/database.types.ts` + sostituire `as any`. |
| L-008 / L-009 (calcHeight) | **P2** | 1 h | Funzione `measure(ctx, …)` riusabile, eliminare canvas usa-e-getta, allineare altezza calcolata a quella renderizzata. |
| ~~L-011~~ (EnumPrinters) | ✅ done | — | Risolto in F-011: retry loop a 3 tentativi con check `GetLastError() == ERROR_INSUFFICIENT_BUFFER`, errori loggati a stderr. |
| ~~L-012~~ (canvas in PrintModal) | ✅ done | — | Risolto in F-011: estratto `drawLabelOnCanvas`, `LabelPreview` ora ha `<canvas ref>` JSX, niente più `innerHTML=""` + `appendChild`. |
| ~~L-014~~ (import dinamico) | ✅ done | — | Risolto in F-010: import statico di `@tauri-apps/api/core` in `printService.ts`, `SettingsPage.tsx`, `App.tsx`. |
| ~~L-015~~ (DMPAPER_USER) | ✅ done | — | Obsoleto post F-003: il path RAW non usa più `DEVMODE`; il formato è specificato nel raster command (`ESC i z`). |
| L-007 (label width hardcoded) | **P2** | 1 h | Spostare `labelWMM` in `AppSettings` come `labelWidthMm: 29|38|62|102`. |

### Performance / qualità

| ID | Priorità | Stima | Note |
|----|----------|-------|------|
| P-005 (main.rs) | **P2** | 5 min | Niente di urgente. |
| ~~P-006~~ (env Supabase) | ✅ done | — | Risolto in F-009: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` via `import.meta.env`, `.env.example` committato, `vite-env.d.ts` per il typing. |
| ~~P-002~~ (i18n updater) | ✅ done | — | Risolto in F-010: chiavi `updater_*` (en + hu), UpdateChecker.tsx ora usa `t(...)`. |
| ~~P-003~~ (bridge Python) | ✅ done | — | Risolto in F-010: `bridge/app.py` + cartella rimossi, riferimento in README aggiornato. |
| P-004 (tipi any in store) | **P2** | 1 h | Da fare insieme a L-006. |
| P-001 (pipeline PNG→base64) | **P2** | 1 giorno | Solo se le metriche mostrano lentezza percepita. Vedi anche roadmap stampa. |

---

## 🗺️ Roadmap stampa

### Stato attuale (post F-003)
- **WritePrinter RAW** con raster Brother nativo generato in Rust. 1 job spooler, N `WritePrinter` sullo stesso buffer.
- Latenza iniziale: ~200-300 ms (era 40-50 s su 20 copie con GDI).
- Gap tra etichette: ~200 ms con auto-cut, dominato dal cutter meccanico.
- Niente più dipendenza dal driver Brother per la conversione raster — bypassata via datatype "RAW".
- Vincolo attuale: 62 mm continuous tape. Altri formati richiedono parametrizzazione di `media_width` + offset margine.

### Opzione B — Raster Brother nativo via spooler

✅ **Implementata in F-003 (2026-05-22)**. Dettagli sotto conservati per riferimento.

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
