# Struttura Modulare - D&D Manager

## Panoramica della refactorizzazione

Il codice originale monolitico (~2441 righe) è stato suddiviso in una struttura modulare più mantenibile:

### File HTML

- **`index.html`** - Documento HTML principale (contiene markup, referenzia CSS esterno e moduli JS)

### Fogli di stile

- **`styles/main.css`** - Tutti gli stili CSS (~880 righe, estratti dal file originale)

### Moduli JavaScript (Modular ES6)

#### Moduli core

- **`js/state.js`** - Stato globale e riferimenti ai DOM elements
- **`js/utils.js`** - Funzioni di utilità (escapeHtml, linkify, renderSimpleTable, ecc.)

#### Gestione dati e storage

- **`js/storage.js`** - IndexedDB e file system (salvataggio/caricamento)
- **`js/character-data.js`** - Logica di caricamento/sincronizzazione del personaggio
- **`js/image-handler.js`** - Gestione della cartella immagini e manifest

#### UI e rendering

- **`js/render.js`** - Funzione principale `renderCharacter()` e rendering contenuti
- **`js/ui-controls.js`** - Gestione TOC (table of contents) e responsività
- **`js/lightbox.js`** - Visualizzatore immagini lightbox
- **`js/portrait.js`** - Carosello ritratti e navigazione

#### Stato della sessione

- **`js/session.js`** - Risorse sessione (HP, slot, inventario, monete)

#### Event handling

- **`js/events.js`** - Binding di tutti gli event listener

#### Entry point

- **`js/main.js`** - Coordinatore principale che inizializza i moduli

## Benefici della struttura modulare

1. **Separazione delle responsabilità** - Ogni modulo ha una funzione specifica
2. **Riusabilità** - I moduli possono essere importati e usati in altri progetti
3. **Manutenibilità** - Più facile trovare e modificare funzionalità specifiche
4. **Testing** - Ogni modulo può essere testato in isolamento
5. **Performance** - Possibilità di code splitting e lazy loading
6. **Scalabilità** - Più facile aggiungere nuove funzionalità

## Come usare

1. Apri `index.html` nel browser
2. Il file carica automaticamente `js/main.js` come modulo ES6
3. Tutti i moduli si caricano e si inizializzano automaticamente
4. In alternativa, esegui l'app desktop con `npm start` (Electron)

## Note importanti

- `index.html` è il nuovo file di entry point consigliato
- Il CSS è ora esternalizzato e può essere facilmente customizzato
- I moduli JS usano ES6 modules e `import`/`export`

## Struttura delle directory

```
dnd-manager/
├── index.html            (nuovo file HTML modulare)
├── README.md
├── styles/
│   └── main.css          (CSS estratto)
├── js/
│   ├── main.js           (entry point)
│   ├── state.js          (stato e elementi DOM)
│   ├── utils.js          (funzioni utility)
│   ├── storage.js        (IndexedDB e file system)
│   ├── character-data.js (logica dati personaggio)
│   ├── image-handler.js  (gestione immagini)
│   ├── render.js         (rendering)
│   ├── ui-controls.js    (TOC e UI)
│   ├── lightbox.js       (lightbox image viewer)
│   ├── portrait.js       (portrait carousel)
│   ├── session.js        (risorse sessione)
│   └── events.js         (event binding)
└── pg.example/           (template carattere)
    ├── character.json
    └── images/
```
