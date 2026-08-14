# Modello permessi

## Operazioni

- **VIEW**: cercare e consultare materiale, collocazione, quantità, note e cronologia visibile.
- **USE**: eseguire `Consuma` / `Aggiungi` e aggiungere note operative.
- **EDIT**: modificare i metadati di un oggetto (nome, descrizione, categoria, appartenenza, stanza, posizione, unità di misura, nota permanente).
- **MANAGE**: amministrazione completa, compresa gestione utenti e struttura organizzativa.

## Ruoli

| Ruolo | VIEW | USE | EDIT | MANAGE |
|---|---|---|---|---|
| Admin | Tutto | Tutto | Tutto | Sì |
| Capo | Tutto | Tutto | Tutto | No |
| R/S | Tutto | Tutto | Materiale della branca R/S | No |
| E/G | Tutto il materiale E/G | Solo propria squadriglia | No | No |

Le autorizzazioni sono applicate nel database con PostgreSQL Row Level Security e, per i movimenti di quantità, nella funzione `apply_stock_movement`.

## Gerarchia

```text
Branca
└── Unità
    └── Squadriglia (solo E/G)
```

### Branche

- Comune
- Castorini
- L/C
- E/G
- R/S

Ogni branca dispone di una voce di unità `Comune`, in modo da rappresentare il materiale condiviso a quel livello.

### Unità

**Castorini**
- Comune
- Colonia Terra di Betula

**L/C**
- Comune
- Branco Seeonee
- Branco San Domenico Savio

**E/G**
- Comune
- Reparto Mulino
- Reparto Don Bosco

**R/S**
- Comune
- Noviziato
- Clan Ad Navalia
- Clan Ingegner Novelli

**Comune**
- Comune

### Squadriglie E/G

**Reparto Mulino**
- Cobra
- Falchi
- Pantere
- Tigri

**Reparto Don Bosco**
- Aquile
- Antilopi
- Castori
- Scoiattoli

## Quantità

La colonna `items.quantity` non è modificabile direttamente dagli utenti autenticati. Le variazioni passano da:

```text
apply_stock_movement(item, delta, nota)
```

- `delta > 0`: **Aggiungi**
- `delta < 0`: **Consuma**

La funzione blocca la riga del materiale durante l'operazione, controlla il permesso USE, impedisce quantità negative e registra quantità precedente e successiva in `stock_movements`.

## Log

Sono previsti due livelli:

1. `stock_movements`: log specifico delle variazioni di quantità;
2. `audit_log`: storico delle creazioni e modifiche di oggetti e note.

Questo permette di ricostruire chi ha modificato una voce, quando e quali valori sono cambiati.
