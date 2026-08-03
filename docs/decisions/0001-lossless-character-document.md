# ADR 0001 — Pipeline lossless del documento personaggio

- **Stato:** accettata
- **Data:** 2026-08-03
- **Ambito:** caricamento, editing, validazione, migrazione e persistenza di `character.json`

## Contesto

`character.json` è la fonte canonica del personaggio, ma il renderer ha bisogno di un valore
completo anche quando il documento è incompleto o contiene errori. L'implementazione precedente
esponeva un solo `Character`: sui fallimenti di schema `loadCharacter` costruiva un personaggio
minimo con default, e store e flussi di sostituzione potevano poi scrivere quel fallback. Un errore
isolato poteva quindi eliminare sezioni valide, chiavi sconosciute e lo stesso valore invalido.

Questa decisione separa il documento che l'utente possiede dalla vista tollerante usata dalla UI.
La separazione è un requisito di sicurezza dei dati, non un dettaglio del renderer.

## Decisione

### Le quattro rappresentazioni

1. **Source document** — il valore JSON appena letto da file, import, snapshot o share, prima di
   migrazioni e normalizzazioni. È conservato semanticamente lossless: tutte le chiavi e tutti i
   valori restano disponibili. JSON non conserva commenti, spaziatura o duplicati di chiave, quindi
   la garanzia non è byte-per-byte.
2. **Draft document** — il valore JSON di lavoro. Nasce dal source dopo le sole migrazioni
   applicabili oppure, per un documento già corrente, dal source stesso. Raw editor, inline editor e
   azioni di gioco modificano il draft; validazione e rendering non lo sostituiscono con output
   parsati o default-filled. È l'unico candidato a diventare il prossimo documento canonico.
3. **Validation result** — prova esplicita dello stato del draft. È una union discriminata:

   ```ts
   type CharacterValidation =
     | { kind: "valid"; persistable: PersistableCharacterDocument; issues: Issue[] }
     | { kind: "schema-invalid"; issues: Issue[] }
     | { kind: "future-schema"; schemaVersion: string; issues: Issue[] };
   ```

   `PersistableCharacterDocument` è costruibile soltanto dal validatore quando il draft soddisfa
   lo schema supportato e non dichiara una versione futura. Gli adapter di storage ricevono questo
   tipo, o il suo valore estratto dal coordinator, non un generico `Character` renderizzabile.
4. **Render projection** — un `Character` sicuro per la UI, derivato dal draft. Può applicare
   default locali e recuperare best-effort le sezioni valide quando il documento non supera lo
   schema. Non è mai una sorgente persistibile, esportabile come documento canonico o utilizzabile
   per una snapshot. I valori derivati restano soltanto nella proiezione.

Lo stato applicativo conserva inoltre **last persisted**, il documento che il coordinator sa essere
stato scritto con successo nel provider corrente. Serve per dirty tracking, snapshot e recovery;
non è una seconda fonte canonica: è una copia in memoria del contenuto canonico noto.

### Ownership

| Valore | Owner | Può essere modificato da | Può raggiungere una write canonica |
|---|---|---|---|
| Source | bootstrap/open/import coordinator | nessuno; viene sostituito al prossimo load | No |
| Buffer testuale sintatticamente invalido | raw editor | raw editor | No |
| Draft | character store/document coordinator | raw editor dopo `JSON.parse`, comandi inline e live | Solo tramite `valid.persistable` |
| Validation result | validator, ricalcolato dal draft | nessuno direttamente | Solo il ramo `valid` |
| Render projection | projection builder | nessuno direttamente | No, anche se appare completo |
| Last persisted | persistence coordinator, dopo read/write riuscita | solo coordinator | Snapshot/recovery del valore già canonico |

Le mutazioni UI devono essere comandi sul draft. La projection non viene modificata e poi promossa:
viene rigenerata dopo ogni modifica del draft.

### Stati e policy

| Input/stato | Comportamento UI | Auto-save canonico | Export esplicito |
|---|---|---|---|
| JSON sintatticamente invalido nel raw editor | Il testo resta nel buffer dell'editor; draft e projection restano all'ultimo JSON parsabile | Sospeso; uscire dall'overlay non committa il testo né un fallback | Può esistere in futuro un export di recovery del testo, chiaramente non canonico |
| JSON valido e schema valido/supportato | Draft lossless, projection completa, warning di regole non bloccanti | Consentito dal valore `persistable` | Esporta il draft validato |
| JSON valido ma schema-invalido | Draft lossless e projection best-effort; errori visibili | Bloccato finché il draft non torna valido | Consentito soltanto come **draft/source recovery**, con stato invalido esplicito |
| File esterno con sintassi invalida | L'apertura fallisce senza sostituire il personaggio corrente | Nessuna write | Il file originale resta intatto fuori dall'app |
| File esterno parsabile ma schema-invalido | Si apre come draft lossless con projection best-effort | Bloccato | Recovery lossless consentita |
| Versione schema futura | Nessuna migrazione; source=draft, vista best-effort in modalità read-only | Sempre bloccato | Esporta una copia lossless del documento futuro |

Gli errori di coerenza delle regole 5e sono warning: non rendono il draft non persistibile. Gli
errori di schema sono errori e bloccano ogni write verso il documento canonico.

Quando un draft schema-invalido viene corretto, il validatore produce un nuovo valore
`persistable`; il debounce accoda una sola write del draft corretto. Nessun fallback intermedio
entra nella coda. Uscire da un overlay non costituisce un consenso a perdere o sostituire dati.

### Migrazioni e versioni future

- Il confronto di `schemaVersion` avviene prima di qualunque migrazione.
- Una versione precedente supportata viene migrata in un nuovo draft. Il source originale resta
  disponibile fino a quando una write reale riesce; la migrazione non scrive durante l'apertura.
- Ogni step di migrazione preserva le chiavi non consumate. Il risultato deve superare lo schema
  corrente prima di ottenere `persistable`.
- Una versione superiore a `SCHEMA_VERSION` non viene migrata, normalizzata o sovrascritta, anche
  se i campi noti sarebbero accettati dallo schema corrente.
- Lo script offline può creare il backup dell'input prima della validazione finale, ma sovrascrive
  il file soltanto con un risultato migrato persistibile. Un backup creato seguito da validazione
  fallita viene riportato come recovery, non come migrazione riuscita.

### Censimento dei flussi di write

| Flusso | Trigger | Valore da scrivere dopo questa decisione | Comportamento non persistibile |
|---|---|---|---|
| Live play / inline edit | mutazione + debounce | `validation.persistable` del draft corrente | dirty draft mantenuto, auto-save sospeso |
| Flush prima di snapshot/replace | azione esplicita | ultimo draft persistibile, una volta | operazione dipendente abortita; il draft non viene perso |
| Raw editor | ultimo JSON parsabile dopo debounce | draft corretto, solo quando persistibile | sintassi resta nel buffer; schema invalido resta nel draft senza write |
| Export normale | Save a copy | draft persistibile | offre solo recovery lossless chiaramente etichettata |
| Checkpoint | Save version | `lastPersisted` dopo un flush riuscito | nessuna snapshot del fallback o di un draft invalido |
| Replace/import/incoming share | conferma utente | draft del payload validato come persistibile | preview consentita, Apply bloccato |
| Incoming share verso cartella vuota | conferma utente | draft del payload validato come persistibile | `character.json` non viene creato |
| Restore | conferma utente | draft dello snapshot validato come persistibile | destinazione invariata; errori mostrati nel preview |
| Migrazione in-app | prima successiva write reale | draft migrato e validato | nessuna write automatica |
| `scripts/migrate-character.ts` | invocazione CLI | draft migrato e validato | backup possibile, file originale non sovrascritto, exit non-zero |

Le implementazioni host-specific (`File System Access`, Tauri fs e Android SAF) serializzano il
valore ricevuto e non decidono se sia valido. La prova di persistibilità appartiene al coordinator e
deve esistere prima della chiamata all'adapter.

### Preservazione delle chiavi sconosciute

La validazione osserva il draft ma non usa l'output trasformato di Zod come nuovo draft. Le
`.passthrough()` restano una difesa utile per le projection valide, ma la garanzia lossless deriva
dal mantenere e modificare direttamente il documento originale/migrato. Un comando aggiorna solo il
path richiesto; sibling, elementi di array e chiavi sconosciute annidate restano invariati. Le sole
trasformazioni ammesse sono migrazioni versionate e modifiche esplicite dell'utente.

## Conseguenze e trade-off

- Store e API di persistence avranno più stati, ma gli stati distruttivi diventano non
  rappresentabili al confine di write.
- Il renderer best-effort richiede una strategia di projection per sezione; non deve essere
  perfetto per consentire recovery, mentre la conservazione del draft deve esserlo.
- Un draft invalido può restare dirty e non salvato. La UI dovrà comunicarlo in EN/IT e impedire
  operazioni che lo scarterebbero senza conferma/recovery.
- L'export recovery può produrre volontariamente un file invalido o futuro, ma è una nuova
  destinazione scelta dall'utente e non una sovrascrittura silenziosa del canonical source.
- La Fase 2 sceglierà i nomi definitivi dei tipi, mantenendo obbligatoria la separazione semantica e
  la prova di persistibilità qui definite.

## Criteri per i regression test della Fase 1

- Un errore top-level, uno annidato e uno dentro un array mantengono nel draft valore originale,
  sezioni sane e unknown keys top-level/annidate.
- Nessuna combinazione di debounce, chiusura raw editor o flush passa una projection fallback a
  `StorageProvider.write`.
- La correzione del draft genera una sola write del documento corretto e il round-trip conserva le
  chiavi sconosciute.
- Replace, incoming share, restore e creazione di cartella vuota lasciano la destinazione invariata
  per payload non persistibili.
- Lo script di migrazione non sovrascrive un risultato invalido e non annuncia successo.
- Una versione futura resta invariata e non viene scritta automaticamente.
