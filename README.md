# VRZ1 Materiale

Webapp per la gestione e la ricerca del materiale disponibile nelle sedi scout di Ragioneria.

## Funzioni v1

- ricerca testuale del materiale;
- classificazione per branca, unità e, per E/G, squadriglia;
- collocazione fisica strutturata `Sede → Stanza → Posizione → Sottoposizione`;
- quantità gestita esclusivamente tramite **Consuma** e **Aggiungi**;
- note permanenti e note operative;
- scheda dettagliata dell'oggetto;
- storico dei movimenti di quantità e audit delle modifiche;
- autenticazione e permessi differenziati per Admin, Capi, R/S ed E/G;
- pannello Admin per materiale, luoghi e utenti.

La matrice completa dei permessi e la struttura organizzativa sono documentate in [`docs/permissions.md`](docs/permissions.md).

## Stack

- React + TypeScript + Vite
- Supabase: PostgreSQL, Auth, Row Level Security ed Edge Functions
- GitHub Pages per il frontend
- GitHub Actions per CI e deploy

## Avvio locale

Richiede Node.js recente.

```bash
npm install
cp .env.example .env.local
npm run dev
```

In `.env.local`:

```text
VITE_SUPABASE_URL=https://qofktbuzwnfcstnzjfit.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key del progetto>
```

`.env.local` è ignorato da Git. La chiave `service_role` **non deve mai essere inserita nel frontend o nella repository**.

Per rendere il server Vite raggiungibile dal telefono sulla stessa rete:

```bash
npm run dev -- --host
```

## Database e backend Supabase

Le migration versionate sono in `supabase/migrations/` e sono già applicate al progetto corrente.

Il backend comprende:

- struttura organizzativa Branche/Unità/Squadriglie;
- sedi `Ragioneria` e `Diga` con le stanze iniziali;
- posizioni fisiche gerarchiche configurabili dall'Admin;
- RLS per VIEW/USE/EDIT/MANAGE;
- funzione atomica `apply_stock_movement`;
- `stock_movements` e `audit_log`;
- Edge Function `admin-users` per creare nuovi account senza esporre credenziali privilegiate.

La sorgente della Edge Function è in `supabase/functions/admin-users/`.

## Pannello Admin

L'account con ruolo `admin` vede la voce **Amministrazione** con tre aree.

### Materiale

- `+ Nuovo materiale`;
- modifica di anagrafica, appartenenza e collocazione;
- quantità iniziale impostabile solo alla creazione;
- quantità successive modificate con Consuma/Aggiungi.

### Sedi e posizioni

- aggiunta/rinomina sedi;
- aggiunta/rinomina stanze;
- aggiunta/rinomina posizioni e sottoposizioni gerarchiche.

### Utenti

- creazione account con password temporanea;
- assegnazione ruolo;
- associazione a unità/squadriglia;
- attivazione/disattivazione profilo.

## Test v1 consigliato

Prima del deploy pubblico:

1. aggiungere 20–30 oggetti reali tramite il pannello Admin;
2. distribuire gli oggetti fra Comune, R/S, E/G e alcune squadriglie;
3. creare almeno un utente di prova per ruolo;
4. verificare VIEW/USE/EDIT con ciascun ruolo;
5. fare Consuma/Aggiungi su materiale consumabile e non consumabile;
6. aggiungere note operative;
7. spostare alcuni oggetti tra stanze/posizioni e verificare la cronologia;
8. provare da desktop e smartphone.

Non inseriremo automaticamente materiale fittizio nel database di produzione: il test va fatto con oggetti effettivamente presenti nelle sedi.

## CI

`.github/workflows/ci.yml` esegue `npm install` e `npm run build` a ogni push sulle branch diverse da `main` e sulle pull request verso `main`.

## Deploy GitHub Pages

Il workflow `.github/workflows/deploy-pages.yml` pubblica `main` su GitHub Pages.

Prima del deploy configurare in **Settings → Secrets and variables → Actions**:

- `VITE_SUPABASE_URL` = `https://qofktbuzwnfcstnzjfit.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = publishable key del progetto Supabase

Quando saremo pronti:

1. rendere pubblica la repository;
2. **Settings → Pages → Source: GitHub Actions**;
3. merge della branch di sviluppo in `main`;
4. controllo del workflow in **Actions**;
5. apertura dell'URL GitHub Pages prodotto dal deploy.
