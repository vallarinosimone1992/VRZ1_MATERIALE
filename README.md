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

## Stato Supabase

Il progetto Supabase di produzione è già stato creato e inizializzato. Le migration in `supabase/migrations/` rappresentano lo schema versionato e devono restare la fonte di verità per le modifiche future al database.

Sono già configurati:

- schema iniziale e struttura organizzativa;
- RLS e matrice dei permessi;
- funzione atomica `apply_stock_movement` per **Consuma/Aggiungi**;
- audit log e storico movimenti;
- bootstrap del primo account Admin.

## Avvio locale

Richiede Node.js recente.

```bash
npm install
cp .env.example .env.local
npm run dev
```

In `.env.local` vanno impostati:

```text
VITE_SUPABASE_URL=https://qofktbuzwnfcstnzjfit.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key del progetto>
```

`.env.local` è ignorato da Git e non deve essere committato.

La chiave `service_role` **non deve mai essere inserita nel frontend, nella repository o nei secret Vite**.

## Primo test locale

1. clonare la repository e passare alla branch di sviluppo;
2. creare `.env.local` dai valori indicati sopra;
3. eseguire `npm install`;
4. eseguire `npm run dev`;
5. aprire l'URL locale mostrato da Vite;
6. accedere con l'account Admin creato in Supabase Auth;
7. verificare che venga mostrato il profilo `ADMIN` e che la ricerca dell'inventario si carichi senza errori.

Finché non sono presenti oggetti, la schermata mostrerà correttamente `Nessun materiale trovato`.

## Database Supabase

Le migration sono in `supabase/migrations/` e sono già state applicate al progetto corrente.

Per installare lo stesso schema su un eventuale nuovo progetto Supabase, applicare le migration in ordine numerico e poi creare il primo utente Admin in Auth e il corrispondente record in `public.profiles`.

Gli account successivi saranno gestiti dall'admin dell'app. La creazione sicura degli utenti Auth richiederà una funzione server-side/Edge Function, che verrà aggiunta senza esporre credenziali privilegiate al browser.

## Deploy GitHub Pages

Il workflow `.github/workflows/deploy-pages.yml` pubblica `main` su GitHub Pages.

Prima del deploy configurare nella repository GitHub, in **Settings → Secrets and variables → Actions**, questi repository secrets:

- `VITE_SUPABASE_URL` = `https://qofktbuzwnfcstnzjfit.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = publishable key del progetto Supabase

Poi, dopo che la repository sarà pubblica:

1. aprire **Settings → Pages**;
2. impostare **Source: GitHub Actions**;
3. fare merge della branch di sviluppo in `main`;
4. controllare il workflow nella scheda **Actions**;
5. aprire l'URL GitHub Pages prodotto dal deploy.

## Stato attuale

La base della v1 comprende:

- login email/password;
- caricamento del profilo e del ruolo;
- ricerca degli oggetti consentiti dal ruolo;
- visualizzazione di quantità, branca/unità/squadriglia, stanza e posizione;
- pulsanti `Consuma` e `Aggiungi` dove l'utente dispone del permesso USE;
- schema SQL con RLS, log e struttura organizzativa precompilata.

Da implementare nelle prossime iterazioni: scheda dettagliata dell'oggetto, UI per note e cronologia, editor per Capi/R/S, pannello Admin, gestione account e rifinitura UX.
