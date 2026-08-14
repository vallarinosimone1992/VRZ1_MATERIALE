# VRZ1 Materiale

Webapp per la gestione e la ricerca del materiale disponibile nelle sedi scout di Ragioneria.

## Funzioni previste

- ricerca testuale del materiale;
- classificazione per branca, unità e, per E/G, squadriglia;
- stanza e posizione fisica opzionale;
- quantità gestita con operazioni **Consuma** e **Aggiungi**;
- note permanenti e note operative;
- storico dei movimenti di quantità;
- audit delle modifiche;
- autenticazione e permessi differenziati per Admin, Capi, R/S ed E/G.

La matrice completa dei permessi e la struttura organizzativa sono documentate in [`docs/permissions.md`](docs/permissions.md).

## Stack

- React + TypeScript + Vite
- Supabase: PostgreSQL, Auth e Row Level Security
- GitHub Pages per il frontend
- GitHub Actions per il deploy

## Avvio locale

Richiede Node.js recente.

```bash
npm install
cp .env.example .env.local
npm run dev
```

In `.env.local` vanno impostati:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

La chiave `service_role` **non deve mai essere inserita nel frontend o nei secret Vite**.

## Database Supabase

Le migration sono in `supabase/migrations/`.

Per la prima configurazione:

1. creare un progetto Supabase;
2. applicare in ordine le migration SQL;
3. creare il primo utente in Supabase Auth;
4. inserire il relativo profilo con ruolo `admin` come indicato in fondo alla migration `001_initial_schema.sql`;
5. copiare Project URL e Publishable Key in `.env.local`.

Gli account successivi saranno gestiti dall'admin dell'app. La creazione sicura degli utenti Auth richiederà una funzione server-side/Edge Function, che verrà aggiunta senza esporre credenziali privilegiate al browser.

## Deploy GitHub Pages

Il workflow `.github/workflows/deploy-pages.yml` pubblica `main` su GitHub Pages.

Prima del deploy configurare nella repository i secret:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

E abilitare GitHub Pages con **GitHub Actions** come sorgente.

## Stato attuale

La base della v1 comprende:

- login email/password;
- caricamento del profilo e del ruolo;
- ricerca degli oggetti consentiti dal ruolo;
- visualizzazione di quantità, branca/unità/squadriglia, stanza e posizione;
- pulsanti `Consuma` e `Aggiungi` dove l'utente dispone del permesso USE;
- schema SQL con RLS, log e struttura organizzativa precompilata.

Da implementare nelle prossime iterazioni: scheda dettagliata dell'oggetto, UI per note e cronologia, editor per Capi/R/S, pannello Admin, gestione account e rifinitura UX.
