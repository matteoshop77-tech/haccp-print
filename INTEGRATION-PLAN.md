# INTEGRATION-PLAN.md — HACCPrint ↔ App esterne

> **Fonte di verità unica** del progetto "integrazione HACCPrint con app esterne".
> Caso d'uso primario: **Planivo HUB**. Pattern riutilizzabile da qualunque app esterna futura.
>
> All'inizio di ogni sessione: **leggere questo file**. Alla chiusura di ogni milestone:
> **aggiornare la sezione [2. Stato avanzamento](#2-stato-avanzamento)**.
>
> Stato documento: **PIANIFICAZIONE** — nessuna riga di codice scritta, nessuna migration
> applicata, cartella `supabase/` non ancora creata. Si parte con M0 solo dopo conferma utente.

---

## 0. Indice navigabile

- [1. Visione e obiettivo](#1-visione-e-obiettivo)
- [2. Stato avanzamento](#2-stato-avanzamento)
  - [2.1 Checklist milestone](#21-checklist-milestone)
  - [2.2 Sotto-sezioni di chiusura milestone](#22-sotto-sezioni-di-chiusura-milestone)
- [3. Stato attuale di HACCPrint (vincoli di design)](#3-stato-attuale-di-haccprint-vincoli-di-design)
- [4. Decisione architetturale chiave](#4-decisione-architetturale-chiave)
- [5. Schema DB](#5-schema-db)
  - [5.1 Tabella `connected_apps`](#51-tabella-connected_apps)
  - [5.2 Tabella `template_visibility`](#52-tabella-template_visibility)
  - [5.3 Tabella `print_queue`](#53-tabella-print_queue)
  - [5.4 RLS policies](#54-rls-policies)
  - [5.5 Indici e publication Realtime](#55-indici-e-publication-realtime)
  - [5.6 Estensione tabella `print_jobs` esistente](#56-estensione-tabella-print_jobs-esistente)
- [6. Edge functions](#6-edge-functions)
  - [6.1 POST /connect](#61-post-connect)
  - [6.2 GET /templates](#62-get-templates)
  - [6.3 POST /print](#63-post-print)
  - [6.4 CORS e rate limiting](#64-cors-e-rate-limiting)
- [7. Modello token](#7-modello-token)
- [8. Listener desktop Realtime](#8-listener-desktop-realtime)
  - [8.1 Dove vive](#81-dove-vive)
  - [8.2 Le 3 fasi](#82-le-3-fasi)
  - [8.3 Race conditions](#83-race-conditions)
  - [8.4 Riuso codice esistente](#84-riuso-codice-esistente)
  - [8.5 HACCP log](#85-haccp-log)
- [9. UI HACCPrint](#9-ui-haccprint)
  - [9.1 Pagina "Connected apps" in Settings](#91-pagina-connected-apps-in-settings)
  - [9.2 Sezione "Visible to:" in LabelForm](#92-sezione-visible-to-in-labelform)
- [10. i18n EN + HU](#10-i18n-en--hu)
- [11. Decisioni prodotto (le 6 risposte)](#11-decisioni-prodotto-le-6-risposte)
- [12. Rischi e mitigazioni](#12-rischi-e-mitigazioni)
- [13. Stima tempi](#13-stima-tempi)
- [14. Ordine di lavoro e regole operative](#14-ordine-di-lavoro-e-regole-operative)
- [15. Glossario](#15-glossario)

---

## 1. Visione e obiettivo

### Cosa stiamo costruendo
HACCPrint diventa **"stampabile da fuori"**: app esterne possono connettersi, leggere i template
autorizzati per la loro organizzazione e accodare job di stampa. Il PC del ristorante (sempre
acceso, stampante Brother QL-800 collegata) ascolta una coda via Supabase Realtime e stampa
fisicamente le etichette, con **fedeltà identica** a una stampa manuale fatta dal desktop.

### Caso d'uso primario — Planivo HUB
La postazione HUB di un locale (es. "Oinos") si collega a un account HACCPrint con
email+password, dichiara il proprio nome organizzazione, riceve un token, e da quel momento può:
1. vedere la lista dei template HACCPrint **assegnati a "Oinos"**;
2. premere "Stampa" → un job entra nella `print_queue` del Supabase HACCPrint;
3. il desktop HACCPrint del locale processa il job e stampa.

### Caso d'uso futuro
Il pattern (token opaco + edge function) è **generico**: qualunque altra app esterna potrà
collegarsi con lo stesso meccanismo, senza modifiche all'architettura. "Connected app" non è
legato a Planivo: Planivo è solo il primo client.

### Cosa NON è (confini espliciti)
- **Niente create/update/delete** di template da app esterne. Solo **read + print**.
- Le app esterne **non** gestiscono categorie, settings, licenze, account.
- Le app esterne **non** renderizzano etichette: mandano solo un *riferimento* a un template +
  dati dinamici minimi (copie, data preparazione). Il rendering avviene sul desktop.
- HACCPrint **non** espone la UI di `/connect`: la connessione la inizia l'app esterna. Lato
  HACCPrint c'è solo **visualizzazione + revoca** delle connessioni.

---

## 2. Stato avanzamento

> ⚠️ **Sezione viva.** Va aggiornata alla chiusura di ogni milestone con data, commit, file
> toccati, test eseguiti, note operative. È la prima cosa da leggere a inizio sessione per sapere
> "dove eravamo".

### 2.1 Checklist milestone

- [x] **M0** — Schema DB + infra `supabase/` (cartella, CLI, secrets, pipeline deploy)
- [x] **M1** — Edge `/connect` + UI "Connected apps" in Settings
- [x] **M2** — Edge `/templates` + `/print` + token model
- [x] **M4** — Listener desktop + stampa end-to-end (visibility assegnata via SQL grezzo)
- [x] **M3** — UI "Visible to:" nei template
- [x] **M5** — Error handling, idempotency end-to-end, retention, polish

> ✅ **Tutte le 6 milestone chiuse e testate end-to-end (28 giugno 2026).** Merge in `master`.
> HACCPrint è ora "stampabile da fuori": app esterne (Planivo HUB) possono connettersi,
> leggere i template autorizzati e accodare stampe processate dal listener desktop.

**Sequenza scelta:** `M0 → M1 → M2 → M4 → M3 → M5`
**Razionale ordine M4 prima di M3:** vogliamo dimostrare il giro di stampa end-to-end (un job
che arriva e stampa davvero) con una visibility assegnata *a mano via SQL*, **prima** di costruire
la UI di assegnazione. M3 è "solo UI" sopra una primitiva già verificata: costruirla prima
significherebbe debuggare due cose nuove insieme.

### 2.2 Sotto-sezioni di chiusura milestone

> Ogni milestone, a chiusura, compila il proprio blocco. Finché è aperta resta "— non ancora chiusa —".

#### M0 — Schema DB + infra supabase/
- **Stato:** ✅ CHIUSA
- **Data di chiusura:** 28 giugno 2026
- **Commit di chiusura:** `99daf30`
- **File creati/modificati:**
  - `supabase/config.toml` (nuovo)
  - `supabase/migrations/20260628120000_integration_external_apps.sql` (nuovo)
  - DB Supabase: 3 tabelle nuove (`connected_apps`, `template_visibility`, `print_queue`), indici, RLS + policy `owner_all_*`, estensione `print_jobs` (`source`, `requested_by_org`), `print_queue` aggiunta alla publication realtime
- **Test eseguiti:**
  - 3 tabelle nuove esistono ✅
  - `print_queue` in publication realtime ✅
  - Colonne `source` (NOT NULL default `'desktop'`) e `requested_by_org` (nullable) su `print_jobs` ✅
  - RLS attiva con 1 policy `owner_all_*` per tabella ✅
- **Note operative:**
  - Deviazione consapevole dal plan: `print_queue.connected_app_id` nullable (NON `NOT NULL`). Motivo: `ON DELETE SET NULL` su `NOT NULL` è contraddittorio. Lo snapshot `org_name` preserva la traccia. Deviazione approvata dall'utente.
  - Prima migration del progetto.

#### M1 — Edge /connect + UI Connected apps
- **Stato:** ✅ CHIUSA
- **Data di chiusura:** 28 giugno 2026
- **Commit di chiusura:** `e036361`
- **File creati/modificati:**
  - `supabase/functions/connect/index.ts` (nuovo)
  - `src/lib/i18n.ts` (10 chiavi nuove EN+HU, HU best-effort)
  - `src/components/settings/ConnectedAppsSection.tsx` (nuovo)
  - `src/pages/SettingsPage.tsx` (aggiunto gruppo Integrations)
- **Test eseguiti:**
  - `/connect` 401 con credenziali fake ✅
  - `/connect` 400 con body vuoto ✅
  - `/connect` 400 con JSON malformato ✅
  - Happy path `/connect` via PowerShell: token emesso, riga in `connected_apps` con `token_hash` SHA-256 (64 char hex), `token_prefix` corretto (16 char), token raw non in chiaro ✅
  - UI: connessione visibile in Settings, revoca funzionante via `window.confirm` ✅
  - `tsc --noEmit` pulito ✅
- **Note operative:**
  - Edge function `verify_jwt=false` (endpoint pubblico di auth).
  - CORS `"*"` e rate-limit con TODO M5 (poi implementati in M5).

#### M2 — Edge /templates + /print + token model
- **Stato:** ✅ CHIUSA
- **Data di chiusura:** 28 giugno 2026
- **Commit di chiusura:** `c4d795f`
- **File creati/modificati:**
  - `supabase/functions/_shared/auth.ts` (nuovo: `corsHeaders`, `json`, `sha256Hex`, `createAdminClient`, `validateToken` con `AuthError`, update `last_used_at`)
  - `supabase/functions/connect/index.ts` (refactor per usare gli helper condivisi, logica invariata)
  - `supabase/functions/templates/index.ts` (nuovo)
  - `supabase/functions/print/index.ts` (nuovo)
- **Test eseguiti:**
  - `/templates` 401 senza Authorization ✅
  - `/templates` 401 con token fake ✅
  - `/print` 401 senza header ✅
  - `/print` 401 con body vuoto + header fake ✅
  - Happy path `/templates` con token reale: array con 1 template (`vaj`), solo campi pubblici (`id, name, type, category, shelf_life_days, description, allergens, profile`), nessun campo privato ✅
  - Happy path `/print`: HTTP 201 + `job_id`, status `pending` ✅
  - Idempotency replay: stesso `job_id`, HTTP 200 ✅
  - 403 con `template_id` non assegnato ✅
  - Verifica DB via MCP: 1 sola riga in `print_queue` per `idempotency_key`, `last_used_at` aggiornato ✅
- **Note operative:**
  - Edge functions deployate `verify_jwt=false`: connect v2, templates v1, print v1.
  - `/print` usa `.maybeSingle()` per verifica visibility (idiomatico supabase-js, equivalente al raw `SELECT 1`).

#### M4 — Listener desktop + stampa end-to-end
- **Stato:** ✅ CHIUSA
- **Data di chiusura:** 28 giugno 2026
- **Commit di chiusura:** `9d7248b`
- **File creati/modificati:**
  - `src/lib/printQueueListener.ts` (nuovo)
  - `src/App.tsx` (nuovo `useEffect` dedicato al listener, fuori dal lock auth)
- **Test eseguiti:**
  - Catch-up: job pending lasciato da M2 (`test-m2-001`) → stampa fisica prima etichetta "Csípős húsgolyó paradicsomszósszal" su Brother QL-800 ✅
  - Realtime: nuovo job via PowerShell (`test-m4-realtime`) → stampa fisica seconda etichetta "vaj" senza interazione UI ✅
  - DB post-stampa: `print_queue.status='done'`, `printed_at` valorizzato, `claimed_by` con UUID istanza ✅
  - `print_jobs`: 2 righe nuove con `source='api'`, `requested_by_org='oinos-test-m2'`, `expiry_date` corretto (+`shelf_life_days`) ✅
- **Note operative:**
  - Deviazione subscribe-first vs catch-up-first: catch-up eseguito su evento `SUBSCRIBED`, elimina il gap "job perso tra SELECT e subscribe". Dedup via `seen`-set + claim atomico.
  - Riuso `printLabel()` invece di reimplementare render+invoke (R1: nessuna modifica al pipeline GDI).
  - INSERT diretto in `print_jobs` (non `store.addPrintJob`, che non supporta `source`/`requested_by_org`). `addPrintJob` esistente invariato (R3).
  - Guard Tauri (`__TAURI_INTERNALS__`) → listener inerte in browser.

#### M3 — UI "Visible to:" nei template
- **Stato:** ✅ CHIUSA
- **Data di chiusura:** 28 giugno 2026
- **Commit di chiusura:** `c82c846`
- **File creati/modificati:**
  - `src/store/useStore.ts` (additivo: `connectedApps`, `templateVisibility`, +query in `loadFromCloud`, reset su logout, `addTemplate`/`updateTemplate` con param `visibleToAppIds` opzionale, `assignVisibilityBulk`, `unassignVisibility`)
  - `src/components/labels/LabelForm.tsx` (sezione "Visible to")
  - `src/components/settings/UnassignedLabelsPanel.tsx` (nuovo: ricerca, select-all/clear, assign multi-app, Apply)
  - `src/components/settings/ConnectedAppsSection.tsx` (integrazione `UnassignedLabelsPanel`)
  - `src/pages/HomePage.tsx` (icona `Link2` teal + tooltip)
  - `src/lib/i18n.ts` (chiavi nuove EN+HU, HU best-effort)
  - `src/pages/LabelsPage.tsx` (2 handler aggiornati per compilare, sezione A funziona anche lì)
- **Test eseguiti:**
  - Indicatore C: icona link teal su `vaj` + `Csípős húsgolyó` (assegnate dai test M2) ✅
  - Form A: sezione "Visible to" presente in Edit con checkbox `oinos-test-m2` spuntata ✅
  - Pannello B: ricerca "lasa" filtra 7 lasagne, select all + Apply → assegnate, sparite dalla lista ✅
  - Rimozione visibility da form: togli checkbox + Save → icona link sparisce, etichetta riappare nel bulk ✅
  - R11 regression: creazione etichetta nuova senza toccare "Visible to" → comportamento invariato, nessuna riga in `template_visibility` ✅
  - Diff insert/delete verificato via MCP ✅
- **Note operative:**
  - `LabelsPage.tsx` (non nelle route `App.tsx`) usa anch'esso `LabelForm` → aggiornati i 2 handler per compilare. Indicatore C scoped a HomePage (LabelsPage non agganciata alle route).
  - Limite noto: icona link ghost dopo revoca + revoca senza refresh store → entrambi fixati in M5.

#### M5 — Error handling, idempotency, retention, polish
- **Stato:** ✅ CHIUSA
- **Data di chiusura:** 28 giugno 2026
- **Commit di chiusura:** `e84d093`
- **File creati/modificati:**
  - `supabase/migrations/20260628130000_rate_limiting.sql` (nuovo: tabella `api_rate_limits` + funzione `check_rate_limit`)
  - `supabase/functions/_shared/auth.ts` (rate-limit per-token in `validateToken`)
  - `supabase/functions/connect/index.ts` (v3: rate-limit per IP)
  - `supabase/functions/templates/index.ts` (v2: rate-limit per token via `validateToken`)
  - `supabase/functions/print/index.ts` (v2: rate-limit per token via `validateToken`)
  - `src/lib/printQueueListener.ts` (`runRetention()` prima del catch-up)
  - `src/store/useStore.ts` (action `refreshConnectedApps`)
  - `src/components/settings/ConnectedAppsSection.tsx` (refresh post-revoca)
  - `src/pages/HomePage.tsx` (filtro client-side: solo app attive per indicatore link)
  - `src/components/settings/UnassignedLabelsPanel.tsx` (filtro: assigned = ha visibility verso ≥1 app attiva)
- **Test eseguiti:**
  - `/connect` spam 12 richieste → 401×10 → 429 ✅
  - `check_rate_limit` SQL: 10 true → false ✅
  - Retention DELETE: job `done` >30g cancellato, recenti intatti ✅
  - Revoca via UI: card sparisce subito senza riavvio (refresh store) ✅
  - Bug ghost icon: icona link sparita dalle card `vaj` + `Csípős húsgolyó` dopo revoca `oinos-test-m2` ✅
  - `tsc --noEmit` pulito ✅
- **Note operative:**
  - Tabella generica `api_rate_limits` (non `rate_limit_connect` dedicata): copre sia IP che token con stesso pattern.
  - Rate-limit per-token centralizzato in `validateToken` (DRY).
  - Fail-open sul limiter: se la SQL function fallisce, la richiesta passa (no caduta API per glitch limiter).
  - CORS `"*"` mantenuto definitivamente con commento di rationale (Planivo chiama server-to-server, token-protetto).
  - Retention solo per `status='done'`. Failed tenuti per debug.

---

## 3. Stato attuale di HACCPrint (vincoli di design)

Fatti verificati nel codice — **vincolano** il design, non sono opinioni.

1. **Single-tenant per utente auth.** Tutto (`templates`, `settings`, `print_jobs`,
   `categories`, `accounts`) è scopato su `user_id = auth.uid()`
   (`src/store/useStore.ts:64-100`). **Un account HACCPrint È un utente `auth.users`.** Non
   esiste alcun concetto di "organizzazione proprietaria" multi-utente.

2. **`accounts.organization_name` è un singolo campo testo**, impostato alla registrazione
   (`src/App.tsx:61`, `src/pages/AuthPage.tsx:30`). ⚠️ **NON confonderlo con `org_name` delle
   connected_apps**: sono concetti diversi (vedi [Glossario](#15-glossario)). Uno è il nome
   dell'attività del proprietario HACCPrint; l'altro è il nome che l'app esterna si auto-assegna
   al connect.

3. **ZERO infrastruttura Supabase nel repo.** Non esiste cartella `supabase/`, nessuna migration
   `.sql`, nessuna edge function. Lo schema è gestito a mano dal dashboard. ⚠️ **Costo nascosto
   significativo:** le edge function sono infrastruttura *completamente nuova* (CLI, secrets,
   pipeline di deploy, CORS). Non c'è un pattern esistente da copiare. M0 lo mette in conto.

4. **`supabaseClient` è autenticato come l'utente** (anon key + sessione utente,
   `src/lib/supabaseClient.ts:13`). Il PC del ristorante è già loggato come `account_id`: il
   **listener Realtime userà la sessione del proprietario** (RLS), **non** i token delle
   connected apps. I token servono solo alle app esterne via edge function.

5. **`renderLabelToPNG(template, date, lang)` e `invoke("print_label_image", …)` sono puri e
   riusabili headless** (`src/lib/printService.ts:33`). Non dipendono dalla UI React / dal
   `PrintModal`. Il listener può renderizzare e stampare senza montare componenti. **Rischio
   basso** sul riuso.

6. **L'auth gira dentro un lock GoTrueClient.** Ci sono già state battaglie con i deadlock
   (commit `cae959b`, `src/App.tsx:23-48`): il pattern attuale separa "Effetto 1 = solo stato
   auth, niente await Supabase nel callback" da "Effetto 2 = caricamento dati fuori dal lock".
   ⚠️ **Il listener NON deve fare query Supabase dentro callback auth o dentro callback
   Realtime**, altrimenti reintroduce il deadlock / spinner infinito.

7. **Comando di stampa Tauri (firma reale):**
   `invoke("print_label_image", { pngBase64, copies, printerName, labelWMm, labelHMm })`.
   Disponibile solo nel build desktop (Tauri); in browser `printService` usa un fallback.
   Il listener gira **solo in build Tauri**.

---

## 4. Decisione architetturale chiave

**Problema:** le app esterne **non hanno una sessione `auth.users` su HACCPrint**. Quindi non
possono usare RLS direttamente.

Due strade:

- **(A) Token opaco + edge function con `service_role`** ✅ **SCELTA**
  L'app esterna chiama edge function con header `Authorization: Bearer hcp_…`. La function valida
  il token, ricava `account_id` + `connected_app_id`, ed esegue le query **bypassando RLS** con
  service_role. Tutto il controllo accessi è in TypeScript dentro le function: facile da
  ragionare, loggare, rate-limitare.

- (B) JWT custom firmato accettato da PostgREST ❌ **SCARTATA**
  Più "elegante" (Planivo parlerebbe direttamente con l'API REST sotto RLS) ma richiede gestione
  della signing key, scadenza/refresh, claim custom, e policy RLS che leggono i claim. Molto più
  superficie d'errore per **zero vantaggio**: i volumi sono bassissimi (lista template + insert
  job).

**Mantra operativo:** *"RLS = proprietario; edge function = mondo esterno."*
Un solo modello di auth, un solo invariante mentale.

---

## 5. Schema DB

Tutte le nuove tabelle sono scopate su `account_id` (= `auth.uid()` del proprietario HACCPrint),
coerentemente con lo schema esistente. Gli snippet SQL sono **pseudo-spec** (la migration vera la
scriviamo in M0).

### 5.1 Tabella `connected_apps`

Registro delle app esterne collegate a un account HACCPrint.

```sql
CREATE TABLE connected_apps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_name      text NOT NULL,                 -- dichiarato dall'app esterna al /connect
  token_hash    text NOT NULL UNIQUE,          -- SHA-256 del token raw (mai il raw)
  token_prefix  text NOT NULL,                 -- es. "hcp_live_a1b2…" per la UI
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,                   -- aggiornato a ogni request autenticata
  revoked_at    timestamptz                    -- soft revoke, NULL = attiva
);

-- org_name unico per account FRA LE CONNESSIONI ATTIVE (decisione prodotto #2).
-- Indice parziale: il vincolo vale solo finché revoked_at IS NULL.
CREATE UNIQUE INDEX connected_apps_active_org_unique
  ON connected_apps (account_id, org_name)
  WHERE revoked_at IS NULL;
```

Note:
- `token_hash UNIQUE` permette il lookup diretto per hash in `/templates` e `/print`.
- `token_prefix` serve **solo** alla UI (mostrare "hcp_live_a1b2…" senza esporre il token).
- La revoca è **soft** (`revoked_at = now()`), così resta lo storico; un token revocato non passa
  più i check perché ogni request filtra `revoked_at IS NULL`.

### 5.2 Tabella `template_visibility`

Relazione M:N tra template e connected app: "questo template è visibile a questa app".

```sql
CREATE TABLE template_visibility (
  template_id       uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  connected_app_id  uuid NOT NULL REFERENCES connected_apps(id) ON DELETE CASCADE,
  account_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- denormalizzato per RLS
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, connected_app_id)
);
```

Note:
- `account_id` è **denormalizzato** apposta, per scrivere policy RLS semplici
  (`account_id = auth.uid()`) senza join.
- Un template **senza alcuna riga** qui = invisibile a tutte le app esterne (visibile solo nel
  desktop). È il default voluto.

### 5.3 Tabella `print_queue`

Coda dei job di stampa richiesti dalle app esterne.

```sql
CREATE TABLE print_queue (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_app_id  uuid NOT NULL REFERENCES connected_apps(id) ON DELETE SET NULL,
  org_name          text NOT NULL,             -- snapshot: sopravvive a revoca/rename
  template_id       uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  copies            int  NOT NULL DEFAULT 1 CHECK (copies >= 1 AND copies <= 200),
  prepared_date     date,                      -- default = oggi lato desktop se NULL
  idempotency_key   text NOT NULL,             -- anti-doppione, generato dall'app esterna
  status            text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','printing','done','failed')),
  claimed_by        text,                      -- id istanza desktop che ha preso il job
  error             text,                      -- messaggio se status='failed'
  created_at        timestamptz NOT NULL DEFAULT now(),
  printed_at        timestamptz                -- valorizzato a done/failed
);

-- Idempotenza: lo stesso idempotency_key per lo stesso account non crea doppioni.
CREATE UNIQUE INDEX print_queue_idem_unique
  ON print_queue (account_id, idempotency_key);

-- Lookup veloce dei pending per il catch-up all'avvio.
CREATE INDEX print_queue_pending_idx
  ON print_queue (account_id, status)
  WHERE status = 'pending';
```

Note:
- `org_name` è **snapshot** (copiato dal connected_app al momento dell'insert): se la connessione
  viene revocata o rinominata, il job mantiene la traccia di chi l'ha chiesto.
- `claimed_by` è la chiave del [claim atomico](#83-race-conditions) per il multi-istanza.
- `idempotency_key` UNIQUE su `(account_id, idempotency_key)`: un retry di rete di Planivo
  ritorna il job esistente invece di crearne uno nuovo.

### 5.4 RLS policies

**Principio:** RLS protegge **solo l'accesso del proprietario** (desktop + UI Settings +
LabelForm). Le app esterne **non passano mai da RLS** — entrano solo via edge function
`service_role`, che bypassa RLS by design.

```sql
-- Abilita RLS su tutte e tre.
ALTER TABLE connected_apps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_queue        ENABLE ROW LEVEL SECURITY;

-- Pattern unico per tutte: il proprietario vede/gestisce solo le proprie righe.
CREATE POLICY owner_all_connected_apps ON connected_apps
  FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

CREATE POLICY owner_all_template_visibility ON template_visibility
  FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

CREATE POLICY owner_all_print_queue ON print_queue
  FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
```

Cosa garantisce questo:
- Il **desktop** (sessione utente) legge i `pending` e fa il claim/update su `print_queue` →
  ✅ permesso da `owner_all_print_queue`.
- La **UI Settings** legge/revoca `connected_apps` → ✅.
- Il **LabelForm** legge/scrive `template_visibility` → ✅.
- Le **edge function** usano `service_role` → bypassano RLS, fanno i propri check in TypeScript.

### 5.5 Indici e publication Realtime

- Indice su `template_visibility (connected_app_id)` per la query "template visibili a org X":
  ```sql
  CREATE INDEX template_visibility_app_idx ON template_visibility (connected_app_id);
  ```
  Con N=10 app e M=1000 template è una join indicizzata su numeri minuscoli → **nessun problema
  di performance**.
- ⚠️ **`print_queue` va aggiunta alla publication Realtime**, altrimenti il listener non riceve
  nulla:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE print_queue;
  ```
  **Passaggio facile da dimenticare in deploy** → è in [checklist M0](#22-sotto-sezioni-di-chiusura-milestone)
  e nei [rischi](#12-rischi-e-mitigazioni).

### 5.6 Estensione tabella `print_jobs` esistente

Per la compliance HACCP (decisione prodotto #4), le stampe da coda vanno loggate in `print_jobs`
come tutte le altre. Servono due colonne nuove **additive** (nullable, non rompono il flusso v1.2.0):

```sql
ALTER TABLE print_jobs
  ADD COLUMN source           text NOT NULL DEFAULT 'desktop'  -- 'desktop' | 'api'
    CHECK (source IN ('desktop','api')),
  ADD COLUMN requested_by_org text;                            -- org_name, solo per source='api'
```

Note:
- `source='desktop'` di default → tutte le righe storiche e le stampe manuali restano coerenti
  senza migrazione dati.
- `source='api'` + `requested_by_org='<org_name>'` per le stampe accodate. L'`operator_name`
  potrà riportare l'org o restare null (da decidere in M4).

---

## 6. Edge functions

Tutte sotto `supabase/functions/` (creato in M0). Pseudo-design, **niente codice ancora**.

### 6.1 POST /connect

```
Input:  { email, password, org_name }
Output: { token, org_name }      // token RAW restituito UNA volta sola

Passi:
  1. Valida credenziali: signInWithPassword(email, password) → user.id  (altrimenti 401)
  2. Check org_name unico attivo per account (vincolo 5.1):
       se esiste connected_apps attiva con stesso (account_id, org_name) → 409 Conflict
       messaggio: "Esiste già una connessione con questo nome, revoca quella
                   precedente per riconnettere."
  3. Genera token raw (32 byte random, prefisso "hcp_live_")
  4. Calcola token_hash = SHA-256(raw), token_prefix = primi ~12 char
  5. INSERT connected_apps { account_id, org_name, token_hash, token_prefix }
  6. Ritorna { token: raw, org_name }
```

⚠️ È un **endpoint di auth pubblico** → bersaglio brute-force / credential stuffing. Vedi
[6.4](#64-cors-e-rate-limiting).

### 6.2 GET /templates

```
Auth:   header Authorization: Bearer hcp_…
Output: [ { id, name, type, category, shelf_life_days, description, allergens, … } ]

Passi:
  1. Estrai token dall'header → hash → lookup connected_apps
       WHERE token_hash = ? AND revoked_at IS NULL    (altrimenti 401)
  2. Ricava account_id + connected_app_id
  3. UPDATE last_used_at = now() su quella connected_app
  4. SELECT template per account_id che hanno riga in template_visibility
     per quel connected_app_id (join indicizzata)
  5. Ritorna solo i campi necessari (sola lettura)
```

### 6.3 POST /print

```
Auth:   header Authorization: Bearer hcp_…
Input:  { template_id, copies, prepared_date?, idempotency_key }
Output: { job_id, status }

Passi:
  1. Valida token (come 6.2) → account_id + connected_app_id + org_name
  2. UPDATE last_used_at
  3. ⚠️ RI-VERIFICA AUTORIZZAZIONE: il template_id DEVE essere visibile a QUEL
     connected_app_id (riga in template_visibility). NON fidarsi del fatto che il
     client l'abbia ottenuto da /templates. Altrimenti un'app può stampare
     qualsiasi template indovinando l'UUID. (altrimenti 403)
  4. INSERT print_queue {
       account_id, connected_app_id, org_name (snapshot),
       template_id, copies, prepared_date, idempotency_key, status='pending'
     }
     ON CONFLICT (account_id, idempotency_key) → ritorna il job esistente (idempotenza)
  5. Ritorna { job_id, status: 'pending' }
```

### 6.4 CORS e rate limiting

- **CORS:** allowlist degli origin di Planivo (e future app). Niente `*`.
- **Rate limiting su `/connect`:** throttle **per IP** e **per email** + lockout dopo N
  tentativi falliti ravvicinati. Supabase Auth ha protezioni native, ma stiamo *avvolgendo*
  l'auth: aggiungere un throttle esplicito (anche semplice, basato su tabella/contatore).
- **Rate limiting su `/templates` e `/print`:** throttle per token, soglia generosa (i volumi
  legittimi sono bassi). Serve a contenere abusi se un token trapela.

---

## 7. Modello token

- **Formato:** token opaco random, **32 byte**, prefisso `hcp_live_` (es.
  `hcp_live_a1b2c3d4e5f6…`). Nessuna struttura/claim: è una stringa casuale, non un JWT.
- **In DB:** si salva **solo lo SHA-256** (`token_hash`) + `token_prefix` (primi ~12 char, per la
  UI). **Mai il raw.**
- **Restituzione:** il raw è mostrato **UNA volta sola**, nella risposta del `/connect`. Se
  perso, si revoca e si rifà il connect.
- **Validazione:** ogni request → SHA-256 dell'header → lookup `token_hash` →
  check `revoked_at IS NULL` → aggiorna `last_used_at`.
- **Revoca:** **immediata**. Ogni request controlla `revoked_at` sul DB (niente cache), quindi
  una revoca ha effetto al primo request successivo.
- **Scadenza:** **nessuna scadenza automatica** (decisione prodotto #1). Vita illimitata fino a
  revoca manuale. `last_used_at` esposto in UI per accorgersi di anomalie.

---

## 8. Listener desktop Realtime

### 8.1 Dove vive
Nuovo modulo **`src/lib/printQueueListener.ts`**. Avviato da un `useEffect` in `src/App.tsx`
**dopo** che `user` è settato (riuso del pattern "Effetto 2", fuori dal lock auth) e **solo nel
build Tauri** (in browser non c'è stampante — stesso criterio del fallback di `printService`).
⚠️ **Niente query Supabase dentro callback auth/realtime** (vincolo #6 della sezione 3).

### 8.2 Le 3 fasi
Realtime da solo **non basta**: consegna solo eventi *live*, quindi i job arrivati mentre il PC
era spento verrebbero ignorati per sempre. Servono tre fasi:

1. **Catch-up all'avvio:**
   `SELECT * FROM print_queue WHERE account_id = <mio> AND status = 'pending'` → processa.
2. **Subscribe Realtime** su `print_queue` filtrato `account_id=eq.<mio>` (RLS lo garantisce già,
   ma mettiamo anche il filtro). Richiede la tabella in publication (vedi [5.5](#55-indici-e-publication-realtime)).
3. **Claim atomico prima di stampare** (vedi sotto) → render → `invoke print_label_image` →
   aggiorna `status` a `done` (o `failed` + `error`) + `printed_at`.

### 8.3 Race conditions
**Multi-istanza** (2 desktop sullo stesso account, raro ma possibile) e **doppia consegna
Realtime** si risolvono entrambe con il **claim atomico**:

```sql
UPDATE print_queue
   SET status = 'printing', claimed_by = <istanza>
 WHERE id = ? AND status = 'pending'
RETURNING *;
```

Solo l'istanza che **riceve indietro la riga** stampa. L'altra vede 0 righe e passa oltre →
**niente doppia stampa**. Stampe multiple ravvicinate = righe separate processate in ordine
(è una coda, nessun problema).

### 8.4 Riuso codice esistente
- `renderLabelToPNG(template, preparedDate, lang)` — `src/lib/printService.ts:33`
- `calcLabelHeightMM(template, lang)` — per `labelHMm`
- `invoke("print_label_image", { pngBase64, copies, printerName, labelWMm, labelHMm })`

Tutto **headless**, senza montare `PrintModal`. Il listener deve avere a disposizione il template
completo (lo prende dallo store già caricato, o con una query per `template_id`) + i dati dinamici
dal job (`copies`, `prepared_date`).

### 8.5 HACCP log
Ogni stampa da coda (decisione prodotto #4) viene loggata in `print_jobs` con:
- `source = 'api'`
- `requested_by_org = '<org_name>'` (snapshot dal job)

così le stampe esterne **non** creano un buco di compliance. Il logging avviene **dopo** la
stampa riuscita (coerente con come `addPrintJob` funziona oggi).

---

## 9. UI HACCPrint

### 9.1 Pagina "Connected apps" in Settings
- Nuova voce nell'array `sections` di `src/pages/SettingsPage.tsx:51`, gruppo nuovo
  **`Integrations`** (o dentro `Account`), key `connected_apps`. Nuovo componente
  `<ConnectedAppsSection>`.
- **Lista connessioni attive:** `org_name`, `created_at`, `last_used_at`, `token_prefix` (mai il
  token pieno).
- **Bottone "Revoke" per riga** → `UPDATE connected_apps SET revoked_at = now()`. Effetto
  immediato (vedi [7](#7-modello-token)). Con conferma (`connected_apps_revoke_confirm`).
- **Stato vuoto:** "No apps connected" (`connected_apps_empty`).
- ⚠️ **NIENTE form di creazione qui.** Il `/connect` lo fa l'app esterna (Planivo), non
  HACCPrint. Questa pagina è **sola visualizzazione + revoca**.

### 9.2 Sezione "Visible to:" in LabelForm
- In `src/components/labels/LabelForm.tsx`, dopo i campi esistenti.
- Carica le `connected_apps` **attive** (da store o query dedicata).
- **Se 0 connected app → la sezione NON appare** (zero complicazione UI, come da spec).
- **Se ≥1 → blocco "Visible to:"** con una **checkbox per ogni app** (`org_name`).
- **Salvataggio:** estende `addTemplate` / `updateTemplate` (`src/store/useStore.ts:208,244`) per
  scrivere anche `template_visibility` con un **diff insert/delete** (aggiungi le nuove
  selezioni, rimuovi le deselezionate). ⚠️ **RISCHIO REGRESSIONE:** è il punto in cui si tocca
  il path create/update template, che è in produzione. Va fatto con cura e test smoke dedicati.
- **Default:** nessuna assegnazione = template invisibile a tutte le app esterne (solo desktop).

---

## 10. i18n EN + HU

Solo l'**elenco delle chiavi nuove** da aggiungere a entrambi i blocchi (`en` e `hu`) di
`src/lib/i18n.ts`. I **testi ungheresi si scrivono in fase di implementazione** (non si inventano
qui):

- `settings_connected_apps`
- `connected_apps_title`
- `connected_apps_sub`
- `connected_apps_empty`
- `connected_apps_connected_on`
- `connected_apps_last_used`
- `connected_apps_never_used`
- `connected_apps_revoke`
- `connected_apps_revoke_confirm`
- `connected_apps_revoked`
- `labels_form_visible_to`
- `labels_form_visible_to_sub`
- `labels_form_visible_to_none`

---

## 11. Decisioni prodotto (le 6 risposte)

1. **Token — vita:** **ILLIMITATA** + revoca manuale. Pattern standard dei token API
   self-hosted. `last_used_at` esposto per individuare anomalie. Nessuna scadenza/rotazione
   automatica.
2. **`org_name` unico per account:** **SÌ.** Si rifiuta `/connect` se esiste già una connessione
   **attiva** con lo stesso nome (vincolo indice parziale 5.1). Messaggio: *"Esiste già una
   connessione con questo nome, revoca quella precedente per riconnettere."*
3. **Re-`/connect` con stessa org:** **non si pone** — per il punto 2 il `/connect` viene proprio
   rifiutato (409). Per riconnettere bisogna prima revocare.
4. **Stampe da coda in `print_jobs`:** **SÌ**, per compliance HACCP. Nuovi campi `source`
   (`'desktop'`/`'api'`) e `requested_by_org` (snapshot org_name). Vedi [5.6](#56-estensione-tabella-print_jobs-esistente).
5. **Retry automatico stampante offline:** **NO.** Solo manuale. `status = 'failed'` + `error`;
   l'utente ristampa da Planivo quando vuole. (Un auto-retry rischia di sfornare etichette a
   raffica quando la stampante torna online.)
6. **Infra `supabase/`:** **da ZERO.** M0 include setup completo: cartella `supabase/`, CLI,
   secrets, pipeline deploy, CORS.

---

## 12. Rischi e mitigazioni

| # | Rischio | Mitigazione |
|---|---------|-------------|
| 1 | **Brute-force / credential stuffing su `/connect`** | Rate limit per IP + per email, lockout dopo N tentativi falliti. Vedi [6.4](#64-cors-e-rate-limiting). |
| 2 | **Token salvato in Planivo, se Planivo viene bucato** | Scope naturalmente limitato (solo read template + print, nessun altro dato/azione). Cripta il token a riposo lato Planivo. Revoca facile e immediata lato HACCPrint. |
| 3 | **Cambio password HACCPrint** | Le connessioni **sopravvivono**: i token sono indipendenti (in `connected_apps`, non derivati dalla password). Unico effetto: per un *nuovo* `/connect` serve la password aggiornata. Nessun fix, solo da documentare. |
| 4 | **Idempotency — retry di rete = doppia stampa** | `idempotency_key` generato dall'app esterna, UNIQUE su `(account_id, idempotency_key)`. Un retry ritorna il job esistente. |
| 5 | **Autorizzazione `/print` aggirabile** | Ri-verifica server-side che `template_id` sia visibile a quel `connected_app_id`. Non fidarsi del client. Vedi [6.3](#63-post-print). |
| 6 | **Retention coda — accumulo `done`/`failed`** | Policy pulizia: cancella job `done` più vecchi di 30 giorni (job/cron in M5). |
| 7 | **Multi-istanza desktop** | Claim atomico (`UPDATE … WHERE status='pending' RETURNING *`). Vedi [8.3](#83-race-conditions). |
| 8 | **Org spoofing** | `org_name` unico per account mitiga le collisioni, **ma chi possiede la password può comunque dichiarare qualsiasi nome**. Limite intrinseco accettato. |
| 9 | **Publication Realtime dimenticata in deploy** | In checklist M0: `ALTER PUBLICATION supabase_realtime ADD TABLE print_queue;` + verifica RLS SELECT per il proprietario. |
| 10 | **Versioning produzione** | HACCPrint v1.2.0 è sui PC reali: finché il desktop non viene aggiornato con il listener, i job restano `pending` in coda (ripresi al primo update dalla fase di catch-up). **La feature è inerte finché il PC non aggiorna.** Da mettere in conto nel rollout. |
| 11 | **Regressione su create/update template** | La scrittura di `template_visibility` tocca `addTemplate`/`updateTemplate` in produzione. Test smoke dedicati in M3. |
| 12 | **Deadlock auth (storico)** | Il listener non fa query dentro callback auth/realtime. Vedi vincolo #6 in [sezione 3](#3-stato-attuale-di-haccprint-vincoli-di-design). |

---

## 13. Stima tempi

Dev singolo, giornate-uomo realistiche.

| Fase | Contenuto | Stima |
|------|-----------|-------|
| **M0** | Schema DB (3 tabelle + RLS + indici + publication) + estensione `print_jobs`. Setup `supabase/` + CLI + secrets (infra da zero). | **1 – 1.5 g** |
| **M1** | Edge `/connect` (con rate-limit base) + UI "Connected apps" (lista + revoca). | **2 – 3 g** |
| **M2** | Edge `/templates` + `/print` + modello token (hash, validazione, last_used) + CORS. | **2 – 3 g** |
| **M4** | Listener Realtime: catch-up + subscribe + claim atomico + riuso renderer/print + logging HACCP. | **2.5 – 3.5 g** |
| **M3** | UI "Visible to:" nel LabelForm + estensione store per `template_visibility` (rischio regressione). | **1.5 – 2.5 g** |
| **M5** | Error handling, offline/failed, idempotency end-to-end, retention coda, polish, test su PC reale. | **2 – 3 g** |

**Totale ≈ 11 – 16.5 giornate.** Dominato da M4 (unica parte con vera concorrenza) e dal costo
nascosto infra in M0/M1. Se l'infra edge function dà problemi (secrets, deploy, CORS), M0–M2
possono gonfiare.

---

## 14. Ordine di lavoro e regole operative

### 14.1 Sequenza
`M0 → M1 → M2 → M4 → M3 → M5`
(M4 prima di M3: validare il giro di stampa end-to-end con visibility assegnata via SQL grezzo,
prima di costruire la UI di assegnazione.)

### 14.2 Regole di sessione
- **All'inizio di ogni sessione:** rileggere questo file (`INTEGRATION-PLAN.md`).
- **Alla chiusura di ogni milestone:** aggiornare la [sezione 2](#2-stato-avanzamento)
  (checklist + sotto-sezione di chiusura: data, commit, file, test, note).
- **Branch dedicato:** `cantiere-integration-haccprint-external` (da creare **prima** del primo
  commit di M0).
- **Una milestone alla volta:** completata e testata prima di iniziare la successiva.
- **Modifiche additive:** HACCPrint v1.2.0 è in produzione. Non rompere il flusso esistente
  (stampa manuale, login, sync). Colonne nuove nullable / con default, niente breaking change.

### 14.3 Test
Ogni milestone include **test smoke documentati** nella propria sotto-sezione di stato. Minimo:
- **M0:** tabelle create, RLS attiva, publication contiene `print_queue`, insert/select via SQL.
- **M1:** `/connect` ritorna token; connessione visibile in Settings; revoca funziona.
- **M2:** `/templates` filtra per org; `/print` rifiuta template non visibili; idempotency_key
  blocca i doppioni.
- **M4:** job inserito via SQL → desktop stampa; claim atomico testato con doppio trigger; job in
  `print_jobs` con `source='api'`.
- **M3:** assegnazione visibility da UI scrive/cancella in `template_visibility`; create/update
  template **non regredisce**.
- **M5:** stampante offline → `failed`; retention pulisce i `done` vecchi; retry di rete →
  nessun doppione.

---

## 15. Glossario

- **Account HACCPrint** — utente Supabase Auth (`auth.users`), proprietario delle etichette e di
  tutto ciò che è scopato su `user_id = auth.uid()`.
- **Connected app** — app esterna (es. Planivo) registrata via `/connect` con un `org_name` e un
  token. Vive in `connected_apps`.
- **`org_name`** — nome dichiarato dall'app esterna al momento del connect (es. "Oinos").
  ⚠️ **DIVERSO da `accounts.organization_name`** (il nome dell'attività del proprietario).
- **Token** — stringa `hcp_live_…` restituita **una sola volta** al `/connect`; in DB se ne salva
  solo l'hash SHA-256 + il prefisso per la UI.
- **Print job** — riga in `print_queue`, processata dal listener desktop.
- **Claim atomico** — `UPDATE … SET status='printing' WHERE status='pending' RETURNING *`:
  garantisce che **un solo** listener processi un dato job (anti multi-istanza / doppia consegna).
- **Catch-up** — query dei `pending` all'avvio del desktop, per recuperare i job arrivati mentre
  il PC era spento (Realtime consegna solo eventi live).
- **`source`** (in `print_jobs`) — `'desktop'` (stampa manuale) | `'api'` (stampa da coda esterna).
- **`requested_by_org`** (in `print_jobs`) — snapshot dell'`org_name` per le stampe `source='api'`.

---

*Fine documento. Aggiornare la [sezione 2](#2-stato-avanzamento) a ogni milestone chiusa.*
