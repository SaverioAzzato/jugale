import attributesImage from "../assets/it/attributes.png";
import editImage from "../assets/it/edit.png";
import inventoryImage from "../assets/it/inventory.png";
import playImage from "../assets/it/play.png";
import promptsImage from "../assets/it/prompts.png";
import rawJsonImage from "../assets/it/raw-json.png";
import storyImage from "../assets/it/story.png";
import welcomeImage from "../assets/it/welcome.png";
import { assertHelpCatalog, type HelpCatalog } from "../model";

export const helpIt: HelpCatalog = assertHelpCatalog({
  heroTitle: "Come usare :JUGALE",
  topics: [
    {
      id: "start",
      title: "Inizia con JUGALE",
      summary: "Crea o apri il tuo personaggio, poi siediti al tavolo.",
      sections: [
        {
          title: "Cosa ti serve",
          intro: "Un personaggio JUGALE è una cartella che resta tua: puoi conservarla, copiarla e aprirla su qualsiasi dispositivo supportato. Nella cartella del personaggio trovi:",
          files: [
            { name: "character.json", description: "La scheda e i dati con cui giochi." },
            { name: "images/", description: "Ritratto e galleria opzionali." },
            { name: "history/", description: "Versioni salvate opzionali, create quando salvi una versione." },
          ],
          links: [
            { topicId: "files", label: "Scopri com'è fatta la cartella" },
            { topicId: "json", label: "Scopri cosa contiene character.json" },
          ],
        },
        {
          title: "Crea il tuo primo personaggio",
          intro: "character.json è un testo leggibile che puoi modificare da solo o creare con un GPT. JUGALE prepara per te il prompt e il formato esatto del file.",
          links: [
            { topicId: "chatbots", label: "Crealo con un GPT" },
            { topicId: "json", label: "Capisci il file JSON" },
          ],
        },
        {
          title: "Aprilo e gioca",
          intro: "Scegli Apri cartella e seleziona quella che contiene character.json. Usa Apri JSON soltanto quando hai il file senza la sua cartella.",
          media: {
            src: welcomeImage,
            alt: "Schermata iniziale di JUGALE con i pulsanti Apri cartella e Apri JSON",
            caption: "Apri cartella tiene insieme personaggio, immagini e versioni.",
          },
          steps: [
            "Resta in Gioco per gestire PF, risorse, riposi, attacchi e incantesimi.",
            "Usa le tab in alto per vedere attributi, inventario e storia.",
            "Premi {pencil} quando vuoi cambiare i contenuti della scheda.",
          ],
          links: [
            { topicId: "play", label: "Scopri come funziona la scheda" },
            { topicId: "manage", label: "Modifica e salva" },
          ],
        },
        {
          title: "Vuoi soltanto curiosare?",
          intro: "Apri Prova un esempio nella schermata iniziale. Puoi esplorare ogni sezione senza toccare i tuoi file.",
        },
      ],
    },
    {
      id: "play",
      title: "Usa la scheda",
      summary: "Trova subito PF, tiri, caratteristiche, equipaggiamento e storia.",
      sections: [
        {
          title: "Le quattro sezioni",
          intro: "Tutto è raccolto in quattro tab. Inventario o Storia possono comparire dopo che aggiungi contenuti in modalità Modifica.",
          gallery: [
            {
              title: "Gioco",
              body: "Usa Danno e Cura per i PF. Nella stessa pagina trovi PF temporanei, riposi, condizioni, risorse, attacchi e incantesimi.",
              media: { src: playImage, alt: "Tab Gioco con PF e azioni della sessione", caption: "Gioco è la pagina da tenere aperta al tavolo." },
            },
            {
              title: "Attributi",
              body: "Controlla caratteristiche, tiri salvezza, abilità, sensi, competenze, privilegi e talenti.",
              media: { src: attributesImage, alt: "Tab Attributi con caratteristiche e abilità", caption: "Bonus e tiri salvezza sono già calcolati." },
            },
            {
              title: "Inventario",
              body: "Equipaggia armi e armature, usa consumabili e aggiorna quantità e denaro con più e meno.",
              media: { src: inventoryImage, alt: "Tab Inventario con equipaggiamento, consumabili e valuta", caption: "Equipaggiamento e quantità restano insieme in Inventario." },
            },
            {
              title: "Storia",
              body: "Guarda ritratto, galleria, descrizione, background e note personali.",
              media: { src: storyImage, alt: "Tab Storia con ritratto e galleria", caption: "Le immagini compaiono qui quando apri una cartella personaggio." },
            },
          ],
        },
        {
          title: "Azioni utili durante una partita",
          bullets: [
            "Premi un attacco o un incantesimo per aprirne tutti i dettagli.",
            "Usa Riposo breve o Riposo lungo per recuperare ciò che è configurato per quel riposo.",
            "Premi il dado nella barra in alto ogni volta che serve un tiro.",
            "Usa + condizione e Ispirazione in Gioco per tenere visibile la situazione attuale.",
          ],
        },
      ],
    },
    {
      id: "manage",
      title: "Modifica e salva",
      summary: "Cambia la scheda, conserva un checkpoint e annulla un aggiornamento sbagliato.",
      sections: [
        {
          title: "Cambia il personaggio",
          media: {
            src: editImage,
            alt: "Scheda in modalità Modifica con campi editabili e pulsanti Aggiungi",
            caption: "La matita evidenziata indica che la modalità Modifica è attiva.",
          },
          steps: ["Premi {pencil} nella barra in alto.", "Apri la sezione che ti serve e cambia i campi.", "Premi di nuovo {pencil} quando hai finito."],
        },
        {
          title: "Conserva e ripristina le versioni",
          bullets: [
            "Salva versione crea un checkpoint. Puoi dargli un titolo breve oppure lasciarlo senza nome.",
            "Versioni mostra i checkpoint. Da lì puoi ripristinarne o eliminarne uno.",
            "Prima del ripristino, JUGALE chiede se vuoi conservare anche lo stato attuale.",
          ],
          details: [{ title: "Non trovo Salva versione", paragraphs: ["Le versioni sono disponibili quando JUGALE può salvare direttamente nella cartella del personaggio. Apri la cartella completa invece di una singola copia esportata."] }],
        },
        {
          title: "Assicurati che le modifiche restino",
          intro: "Un personaggio aperto dalla sua cartella viene salvato mentre lavori. Se JUGALE propone invece Esporta JSON, usalo prima di chiudere e conserva il file scaricato.",
        },
      ],
    },
    {
      id: "chatbots",
      title: "Aggiorna con un chatbot",
      summary: "Invia il materiale corretto al chatbot che usi già e riporta il risultato in JUGALE.",
      sections: [
        {
          title: "Scegli cosa vuoi fare",
          intro: "Apri {book} e scegli cosa vuoi fare. JUGALE prepara tutto per il chatbot che usi già.",
          media: {
            src: promptsImage,
            alt: "Pagina Prompt con parametri del personaggio e azioni sui prompt",
            caption: "Usa {book} nella barra in alto per aprire Prompt.",
          },
          bullets: [
            "Crea avvia un nuovo personaggio.",
            "Sali di livello modifica il personaggio aperto dopo un passaggio di livello.",
            "Valida controlla e corregge un personaggio.",
            "Migra aggiorna un personaggio creato per un vecchio formato JUGALE.",
            "Personalizzato aggiunge una tua richiesta.",
          ],
        },
        {
          title: "Su Android",
          flow: ["Apri Prompt", "Premi Condividi", "Scegli un chatbot", "Completa l'aggiornamento", "Condividi character.json verso JUGALE"],
          steps: ["Controlla il nome del personaggio e la destinazione mostrati da JUGALE.", "Se serve, scegli un'altra cartella personaggio.", "Conferma soltanto quando entrambi sono corretti."],
          details: [{ title: "Il chatbot ha risposto con il JSON nel messaggio, non con un file", paragraphs: ["Copia tutto il JSON in un file di testo chiamato character.json, poi condividi quel file verso JUGALE."] }],
        },
        {
          title: "Su web o desktop",
          steps: ["Apri Prompt e scegli il tipo di lavoro.", "Copia il prompt e scarica i file proposti da JUGALE.", "Allegali alla conversazione con il chatbot.", "Salva la risposta finale come character.json, poi apri quel file oppure rimettilo nella cartella del personaggio."],
        },
      ],
    },
    {
      id: "files",
      title: "Aggiungi immagini e gestisci i file",
      summary: "Aggiungi un ritratto, sposta un personaggio completo e usa Recenti.",
      sections: [
        {
          title: "Aggiungi un ritratto o una galleria",
          media: {
            src: storyImage,
            alt: "Tab Storia con ritratto e miniature della galleria",
            caption: "La prima immagine in ordine alfabetico diventa il ritratto; le altre formano la galleria.",
          },
          steps: ["Apri la cartella del personaggio sul dispositivo.", "Crea una cartella images accanto a character.json, se non esiste.", "Inserisci le immagini e assegna nomi ordinati come 01-ritratto.jpg e 02-gruppo.png.", "Riapri la cartella del personaggio in JUGALE."],
        },
        {
          title: "Cosa copiare quando sposti un personaggio",
          files: [
            { name: "character.json", description: "Il personaggio. Conserva sempre questo file." },
            { name: "images/", description: "Ritratto e galleria opzionali." },
            { name: "history/", description: "Versioni salvate opzionali. Copiala se vuoi mantenerle." },
          ],
          intro: "In una cartella personaggio completa trovi gli elementi qui sotto. Copia tutta la cartella se vuoi ritrovare lo stesso personaggio, le immagini e le versioni su un altro dispositivo.",
        },
        {
          title: "Personaggi recenti",
          bullets: ["Premi una voce in Recenti per riaprirla velocemente.", "Rimuovere una voce da Recenti non elimina il personaggio originale né le immagini."],
          links: [{ topicId: "manage", label: "Come funzionano le versioni" }],
        },
      ],
    },
    {
      id: "json",
      title: "Avanzato: JSON e schema",
      summary: "Per chi vuole modificare character.json a mano o usare un editor esterno.",
      sections: [
        {
          title: "Di solito puoi ignorare questa sezione",
          intro: "La scheda normale e la modalità Modifica bastano per l'uso quotidiano. JSON grezzo serve soltanto se vuoi controllare direttamente il file sorgente.",
        },
        {
          title: "Modifica direttamente la sorgente",
          media: {
            src: rawJsonImage,
            alt: "Editor JSON grezzo con un file personaggio valido",
            caption: "L'editor indica se il JSON è valido prima di tornare alla scheda.",
          },
          steps: ["Apri JSON grezzo dalla barra in alto.", "Fai la modifica senza rimuovere le altre sezioni.", "Correggi gli eventuali errori di sintassi mostrati dall'editor, poi chiudilo per tornare alla scheda."],
          details: [{ title: "Esempio minimo valido", paragraphs: ["{ \"meta\": { \"name\": \"Il mio personaggio\" } }"] }],
        },
        {
          title: "Usa lo Schema JSON",
          intro: "Scarica character.schema.json da Prompt quando un editor o un chatbot deve conoscere l'elenco esatto dei campi accettati. Descrive il formato; non è il tuo personaggio.",
          bullets: ["Conserva character.json come file con cui giochi.", "Esporta o salva una versione prima di una grossa modifica manuale.", "Se un file non si apre più, ripristina una versione oppure correggi la sintassi JSON in un editor di testo."],
        },
      ],
    },
  ],
});
