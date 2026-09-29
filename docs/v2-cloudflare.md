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
