# VRZ1 Materiale v2 — Cloudflare Workers + D1

## Obiettivo

La v1.x resta su `main` e continua a usare Supabase. La v2 viene sviluppata esclusivamente su `devel` e sostituisce il backend con Cloudflare Workers + D1, mantenendo per quanto possibile la stessa UX.

## Principi

- nessun cambiamento distruttivo alla v1 durante lo sviluppo;
- nessun accesso diretto del browser a D1: tutte le operazioni passano dal Worker;
- autorizzazioni applicate lato API, non solo nella UI;
- quantità modificabili solo tramite movimento atomico;
- audit completo mantenuto;
- dipendenze runtime ridotte al minimo;
- nessuna credenziale privilegiata nel frontend o nel repository.

## Architettura prevista

```
GitHub Pages (React)
        |
        | HTTPS / JSON
        v
Cloudflare Worker
  - autenticazione/sessioni
  - autorizzazioni
  - API inventario
  - movimenti quantità
  - audit
  - amministrazione
        |
        v
Cloudflare D1
```

## Stato iniziale

Il Worker contiene per ora solo `GET /api/v2/health`. Il frontend v1 continua a parlare esclusivamente con Supabase.

Lo schema D1 iniziale è in `worker/migrations/0001_initial.sql`.

## Roadmap

1. Creare account Cloudflare, Worker e database D1.
2. Applicare lo schema D1 e verificare `/api/v2/health`.
3. Implementare autenticazione email/password:
   - PBKDF2 tramite Web Crypto;
   - salt casuale per account;
   - session token casuale, memorizzato nel DB solo come hash;
   - cookie `HttpOnly; Secure; SameSite=Lax`;
   - scadenza e revoca sessioni.
4. Implementare endpoint read-only per reference data e inventario.
5. Implementare permessi Admin/Capo/R/S/E/G nel Worker.
6. Implementare CREATE/EDIT/USE, movimento quantità atomico tramite D1 `batch()`, note e audit.
7. Implementare registrazione/approvazione e gestione utenti.
8. Implementare bug report.
9. Scrivere procedura di export Supabase -> import D1.
10. Collegare il frontend al nuovo layer API e fare beta test.
11. Solo dopo equivalenza funzionale verificata, promuovere la v2 su `main`.

## Compatibilità dei permessi

La matrice resta invariata:

- Admin: tutto + gestione utenti/luoghi.
- Capo: VIEW/USE/EDIT/CREATE su tutto.
- R/S: VIEW/USE su tutto; EDIT/CREATE su Comune e R/S.
- E/G: VIEW su tutto; USE/EDIT/CREATE solo per la propria squadriglia.

## Note Cloudflare Free

Workers Free prevede 100.000 richieste/giorno. D1 Free prevede 500 MB per database, 5 GB totali, 5 milioni di righe lette/giorno e 100.000 righe scritte/giorno. Questi limiti sono ampi per il carico previsto, ma le query dovranno essere indicizzate e monitorate.


## Primo amministratore (bootstrap manuale)

Non esiste un endpoint HTTP pubblico per creare amministratori. Il primo Admin
deve essere promosso una sola volta tramite accesso amministrativo a D1 con
Wrangler, dopo essersi registrato con un indirizzo email reale.

Verificare prima che l'account sia quello corretto:

```bash
npx wrangler d1 execute vrz1-materiale-v2 --remote --command "SELECT id, email FROM accounts WHERE email = 'EMAIL_ADMIN';"
```

Poi eseguire (sostituendo EMAIL_ADMIN con l'indirizzo verificato):

```bash
npx wrangler d1 execute vrz1-materiale-v2 --remote --command "INSERT INTO profiles (id, role, active) SELECT id, 'admin', 1 FROM accounts WHERE email = 'EMAIL_ADMIN' AND NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = accounts.id); UPDATE registration_requests SET status = 'approved', reviewed_at = datetime('now') WHERE email = 'EMAIL_ADMIN' AND status = 'pending';"
```

Verificare che sia stato creato **esattamente un** profilo admin. Non usare
account fittizi o password condivise per il bootstrap. L'accesso a D1 tramite
Wrangler richiede le credenziali Cloudflare dell'operatore.

## API di approvazione (solo Admin)

- `GET /api/v2/admin/registrations`: richieste pending.
- `POST /api/v2/admin/registrations/:id/review` con
  `{"action":"approve","unit_id":"...","squad_id":"..."}` oppure
  `{"action":"reject"}`.
- Richiedono `Authorization: Bearer <token>` di un account Admin attivo.
- Per E/G unità e squadriglia sono obbligatorie e devono essere coerenti.
- L'approvazione crea il profilo; la richiesta viene marcata come esaminata.
