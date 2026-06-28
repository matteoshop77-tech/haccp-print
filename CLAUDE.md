# CLAUDE.md — Costituzione operativa HACCPrint

> Regole ferree del progetto. Si applicano a OGNI lavoro, non solo a una feature specifica.
> File correlati: INTEGRATION-PLAN.md (piano integrazione app esterne), PROGRESS-FIX.md (log bug/audit), README.md (intro progetto).

---

## 🏛️ REGOLE FERREE

### 🔴 R1 — Il pipeline di stampa GDI è INTOCCABILE senza piano testato

Il rendering Canvas → PNG base64 → Rust GDI (CreateDCW → StartDoc → StretchDIBits → EndDoc) è il risultato di significativo lavoro di stabilizzazione. Funziona ma è fragile.

**Vietato**:
- Modificare `printService.ts`, `labelRenderer.ts`, `customLabelRenderer.ts` senza un piano dettagliato approvato dall'utente
- "Migliorare" il rendering perché "sembra più pulito così"
- Toccare il codice Rust in `src-tauri/src/lib.rs` relativo a stampa

**Lezione storica**: Il fix anti-clipping del preview (giugno 2026) ha rotto la stampa fisica producendo "-01" invece di "KH-01". Abbiamo dovuto fare rollback parziale.

Prima di QUALSIASI modifica al rendering:
1. Spiegare esattamente cosa cambia e perché
2. Spiegare cosa potrebbe rompersi
3. Avere un piano di rollback chiaro
4. Test sulla stampa fisica reale (non solo preview canvas)

### 🔴 R2 — Preview e stampa DEVONO usare lo stesso codice

Se due percorsi di rendering separati esistono per "stesso output", prima o poi divergono. Una funzione `drawXOnCanvas` per il preview e una `renderXToPNG` per la stampa devono passare per la STESSA funzione di disegno. Mai duplicare logica di rendering.

### 🔴 R3 — Modifiche additive, mai distruttive

HACCPrint v1.2.0 è in produzione al ristorante. Ogni modifica deve essere:
- Additiva (aggiunge senza togliere)
- Backward-compatible (gli utenti esistenti non perdono dati o accesso)
- Testabile in isolamento (non rompe altre feature)

**Vietato**: refactor del codice esistente "perché ho un'idea migliore". Se l'idea è davvero migliore, va proposta come progetto separato e discussa.

### 🔴 R4 — Verifica il codice REALE prima di proporre modifiche

Non citare mai codice che non hai verificato esistere nel repo. Prima di proporre "in questo file, modifica questa funzione", fai un read del file e conferma che la funzione esiste come la pensi.

**Lezione storica**: Più volte CC ha proposto find-and-replace su codice che non era come immaginato → frustrazione dell'utente e tempo perso.

### 🔴 R5 — Milestone, non micro-step

L'utente preferisce procedere a milestone (es. "scrivi tutti i file di M1") piuttosto che file-per-file con conferma tra ognuno. Procedere a micro-step:
- File 1 → conferma → File 2 → conferma → ...

è VIETATO salvo richiesta esplicita dell'utente.

L'eccezione è quando l'utente dice esplicitamente "andiamo passo passo" o quando la modifica è particolarmente delicata (es. tocca il pipeline GDI o la migrazione DB).

### 🔴 R6 — Brainstorming = ZERO codice

Quando il task è esplicitamente "analisi", "brainstorming", "proposta", "design":
- NON scrivere codice
- NON applicare migrations
- NON modificare file
- Solo lettura del codice esistente, ragionamento, scrittura di testo

L'utente decide quando passare dalla fase di design alla fase di implementazione.

### 🔴 R7 — Domande prima di assumere

Se una richiesta dell'utente è ambigua o ha più interpretazioni possibili:
- FERMA: non scrivere codice
- Fai 1-3 domande specifiche per disambiguare
- Aspetta le risposte
- Solo dopo, procedi

Vietato: "io ho interpretato così, dimmi se va bene" mentre proponi già una soluzione completa.

### 🔴 R8 — Branch dedicato per ogni cantiere

Prima di iniziare un cantiere multi-step (qualsiasi cosa che richieda più di 1-2 file modificati):
1. `git status` → working tree pulito
2. `git checkout -b cantiere-<nome>` (es. `cantiere-integration-external-apps`)
3. `git branch --show-current` → conferma del nome
4. SOLO ALLORA inizia a modificare codice

Mai dare per scontato di essere sul branch giusto.

### 🔴 R9 — Workflow utente: full file replace, non find-and-replace

L'utente è non-tecnico e lavora copiando interi file in VS Code con Ctrl+A → paste. NON fornire istruzioni tipo "trova questa riga e cambiala in...". Salvo modifiche minimali esplicitamente richieste, fornisci sempre il file completo per copy-paste.

Quando applichi modifiche direttamente al workspace (hai accesso in scrittura), avvisa l'utente che la modifica è già stata applicata e non serve copy-paste.

### 🔴 R10 — Tutto in italiano, salvo i18n strings

Il file CLAUDE.md, INTEGRATION-PLAN.md, e ogni altra documentazione del progetto è in italiano. I commenti nel codice possono essere in inglese o italiano (preferibilmente inglese per consistenza con la comunità open source). Le stringhe i18n hanno il loro file dedicato (`src/lib/i18n.ts`) con EN + HU.

---

## 📋 PREFLIGHT CHECK (obbligatorio prima di lavorare)

Prima di scrivere QUALSIASI codice nel progetto, conferma a te stesso:

1. **Sto modificando il pipeline GDI/rendering?** Se SÌ → STOP, richiedo piano dettagliato (R1)
2. **Sto duplicando logica di rendering preview vs stampa?** Se SÌ → STOP, unifica (R2)
3. **Sto rifacendo codice esistente invece di aggiungere?** Se SÌ → STOP, proponi come progetto separato (R3)
4. **Sto citando codice che non ho letto?** Se SÌ → STOP, leggi prima (R4)
5. **Sto procedendo file-by-file senza richiesta esplicita?** Se SÌ → STOP, raggruppa in milestone (R5)
6. **Sto scrivendo codice in fase di brainstorming?** Se SÌ → STOP, solo testo (R6)
7. **L'utente è stato chiaro al 100% sulla richiesta?** Se NO → STOP, fai domande (R7)
8. **Sono sul branch giusto?** Se NON SO → STOP, controlla (R8)

Se anche UN solo controllo è SÌ → fermati, segnala all'utente, ridiscuti prima di procedere.

---

## 🗂️ FILE DI RIFERIMENTO

- `INTEGRATION-PLAN.md` — piano dettagliato integrazione HACCPrint ↔ app esterne. Da leggere quando si lavora su quella feature.
- `PROGRESS-FIX.md` — log storico di bug, fix, audit. Tracker dei lavori passati.
- `README.md` — descrizione progetto, setup dev, comandi build.
- `package.json` — stack: React + TypeScript + Tailwind v3 + Zustand + Tauri 2 + Supabase.
- `src-tauri/tauri.conf.json` — configurazione build desktop.

---

## 🛠️ COMANDI UTILI

```bash
npm run tauri dev      # avvia in dev (apre app desktop con hot reload)
npm run tauri build    # build di produzione (MSI + NSIS in src-tauri/target/release/bundle/)
npm run dev            # solo browser, ma invoke Tauri NON funziona (la stampa fallisce)
```

Output build:
- MSI: `src-tauri/target/release/bundle/msi/HACCPrint_X.Y.Z_x64_en-US.msi`
- NSIS (consigliato per distribuzione): `src-tauri/target/release/bundle/nsis/HACCPrint_X.Y.Z_x64-setup.exe`

---

## 📌 NOTE OPERATIVE STORICHE

- HACCPrint v1.2.0 in produzione al ristorante (Brother QL-800, USB)
- Stack stampa: Canvas 3× scale → PNG base64 → Rust GDI via Tauri `invoke("print_label_image", ...)`
- Auth Supabase email+password, single-tenant per utente (user_id = auth.uid())
- HACCPrint NON ha cartella `supabase/` nel repo — schema gestito da dashboard. Edge functions e migrations da introdurre nel cantiere integration.
