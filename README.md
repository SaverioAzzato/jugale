# Character Sheet Platform

Piattaforma general purpose per la gestione di personaggi da tavolo con source of truth JSON.

## File canonici

- `character.json`: dati completi del personaggio e stato di sessione.
- `home.html`: interfaccia visuale che legge e aggiorna il JSON.
- `images/`: cartella asset per i ritratti e le immagini di supporto.

## Come funziona

`home.html` non contiene i dati del personaggio in modo statico. La pagina è un renderer/editor che carica `character.json`, mostra la scheda e sincronizza i cambi nel JSON quando apri il file in modalità live.

Se il browser supporta la File System Access API, puoi aprire `character.json` in lettura/scrittura e ogni modifica ai campi di sessione viene salvata direttamente sul file.

Se il browser non ha accesso in scrittura, puoi comunque importare un JSON e poi esportarne una copia aggiornata.

Le immagini del personaggio stanno dentro `images/` e il JSON contiene il manifest `assets.images`. La UI le ordina alfabeticamente per nome file e ti lascia scegliere quale immagine usare come ritratto attivo.

## Workflow consigliato

1. Apri `home.html` nel browser.
2. Usa il pulsante per aprire `character.json` in modalità live.
3. Modifica solo i campi di sessione quando sei al tavolo.
4. Quando cambi build, livelli, inventario strutturale, spell, privilegi o altra informazione permanente, aggiorna `character.json`.
5. Se vuoi un backup, usa l'esportazione JSON.
6. Se aggiungi o cambi immagini, metti i file in `images/` e aggiorna `assets.images` nel JSON.

## Regola pratica per gli aggiornamenti

- I dati permanenti stanno nel JSON.
- La UI HTML è stateless rispetto al contenuto del personaggio.
- Qualsiasi livello, aggiunta di incantesimo, modifica di inventario o correzione di build deve passare dal JSON.
- I valori di sessione restano sincronizzati nel JSON e sono gli unici campi che la UI modifica di continuo.

## Per gli agenti

Quando devi generare o aggiornare un personaggio:

1. Leggi prima `character.json`.
2. Modifica direttamente il JSON, non la UI HTML, salvo interventi sul layout o sui controlli.
3. Mantieni intatti i campi già presenti se non esiste una richiesta esplicita di rimuoverli.
4. Preserva i link cliccabili nelle proprietà `link` di spell, feat, armi, background, class features e simili.
5. Se devi cambiare lo stato di sessione, aggiorna `session.resources` e `inventory.currencies` nel JSON.
6. Se devi fare un level-up, aggiorna le sezioni `identity`, `build`, `combat`, `spellSections`, `features`, `inventory`, `origin`, `narrative` e `corrections` senza perdere nessuna informazione.
7. Se cambi immagini o ritratti, aggiorna `meta.portrait` e `assets.images`, mantenendo i file dentro `images/`.

## Struttura del JSON

- `schemaVersion`: versione dello schema dati.
- `platform`: metadati del progetto.
- `meta`: nome, giocatore, riepilogo e ritratto.
- `identity`: scheda anagrafica e collegamenti.
- `build`: caratteristiche, TS, abilità, competenze.
- `combat`: attacchi, spellcasting e note di combattimento.
- `spellSections`: trucchetti, spell di livello, rituali e relative tabelle.
- `reminders`: promemoria di build e di uso al tavolo.
- `features`: privilegi, invocazioni, checklist di livello.
- `inventory`: oggetti, monete e note di inventario.
- `origin`: lingue, razza, background e note correlate.
- `narrative`: tratti, aspetto, storia e campi non compilati.
- `corrections`: note di correzione e allineamento.
- `session`: stato di sessione e valori modificabili durante la partita.

## Nota sul personaggio attuale

Il JSON iniziale contiene già Christ Han-Desic con tutte le informazioni migrate dalla vecchia scheda, senza perdita di contenuto.
