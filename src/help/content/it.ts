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
      summary: "Crea, modifica e valida i tuoi personaggi con il tuo chatbot preferito, poi aprili e giocaci con JUGALE.",
      sections: [
        {
          title: "Cosa ti serve",
          intro: "Per creare il tuo personaggio in JUGALE, prepara una cartella e poi aprila dalla schermata iniziale con Apri cartella. La cartella resta sempre tua e contiene:",
          files: [
            { name: "character.json", description: "La scheda del personaggio. Puoi crearla con il tuo chatbot preferito usando i prompt che trovi in {book}." },
            { name: "images/", description: "Le immagini che vuoi vedere nella scheda, mostrate in ordine alfabetico." },
            { name: "history/", description: "Le versioni cronologiche del personaggio. È opzionale: JUGALE la crea automaticamente al primo salvataggio di una versione." },
          ],
          note: "Puoi anche aprire soltanto character.json: la scheda funziona, ma senza immagini e senza lo storico delle versioni.",
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
            "Premi una volta +, −, Danno o Cura per un singolo passo, oppure tieni premuto per modifiche ripetute più rapide. Se fai scorrere il dito, la pagina si muove senza cambiare il valore.",
            "Usa Riposo breve o Riposo lungo per recuperare ciò che è configurato per quel riposo.",
            "Premi il grande dado floating in basso a destra ogni volta che serve un tiro.",
            "Usa + condizione e Ispirazione in Gioco per tenere visibile la situazione attuale.",
          ],
        },
        {
          title: "Lancia e sposta i dadi",
          intro: "Il grande pulsante dei dadi è floating in basso a destra per impostazione predefinita. In Impostazioni → Pulsante dei dadi puoi spostarlo in basso a sinistra oppure inserirlo nella barra in alto.",
          bullets: [
            "Premi il pulsante dei dadi, poi scegli quello da lanciare. Il menu di selezione resta sempre davanti ai dadi già presenti sulla scheda.",
            "Trascina un risultato per spostarlo; premilo per rimuoverlo.",
            "I dadi restano sotto l'intera barra superiore, sopra la barra di stato inferiore e lontani dal pulsante floating, anche quando cambi la Scala interfaccia o lo zoom del browser.",
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
          intro: "Quando il chatbot ha terminato, scarica il character.json completo. Da File o Download, condividi quel file e scegli JUGALE oppure JUGALE Dev. JUGALE mostra sempre un'anteprima prima di modificare qualcosa.",
          steps: ["Se hai già un personaggio aperto, JUGALE propone la sua cartella come destinazione. Controlla entrambi i nomi prima di continuare.", "Se non hai un personaggio aperto, premi Scegli cartella personaggio e seleziona la cartella da aggiornare.", "Usa Scegli un altro personaggio quando la destinazione proposta non è quella corretta.", "Conferma soltanto quando personaggio ricevuto e destinazione sono corretti. Le immagini già presenti nella cartella restano al loro posto."],
          details: [{ title: "Il chatbot ha risposto con il JSON nel messaggio, non con un file", paragraphs: ["Copia tutto il JSON in un file di testo chiamato character.json, poi condividi quel file verso JUGALE."] }],
        },
        {
          title: "Su web o desktop",
          steps: ["Apri Prompt e scegli il tipo di lavoro.", "Premi Scarica accanto al prompt. JUGALE salva un unico file di testo con prompt, schema e, se presente, il personaggio aperto.", "Allega quel file di testo alla conversazione con il chatbot.", "Salva la risposta finale come character.json, poi apri quel file oppure rimettilo nella cartella del personaggio."],
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
          steps: ["Apri JSON grezzo dalla barra in alto.", "Fai la modifica senza rimuovere le altre sezioni.", "Correggi tutti gli errori di sintassi o validazione mostrati dall'editor, poi chiudilo per tornare alla scheda."],
          details: [
            { title: "Perché lo stato indica Non salvato", paragraphs: ["JUGALE conserva un draft invalido per permetterti di correggerlo, ma non sostituisce character.json finché il draft non supera la validazione. Un file creato da una versione più recente di JUGALE non viene modificato e può essere esportato intatto."] },
            { title: "Esempio minimo valido", paragraphs: ["{ \"meta\": { \"name\": \"Il mio personaggio\" } }"] },
          ],
        },
        {
          title: "Usa lo Schema JSON",
          intro: "Scarica character.schema.json da Prompt quando un editor o un chatbot deve conoscere l'elenco esatto dei campi accettati. Descrive il formato; non è il tuo personaggio.",
          bullets: ["Conserva character.json come file con cui giochi.", "Esporta o salva una versione prima di una grossa modifica manuale.", "Se un file non si apre più, ripristina una versione oppure correggi la sintassi JSON in un editor di testo."],
        },
        {
          title: "Contenuti regolistici, licenze e privacy",
          intro: "JUGALE è indipendente e non è affiliato, approvato, sponsorizzato né avallato da Wizards of the Coast. Gli esempi inclusi usano SRD 5.1 (le regole 2014) con licenza CC BY 4.0; SRD 5.2.1 è una linea di regole revisionata diversa e va indicata esplicitamente. I tuoi file restano tuoi e JUGALE non ha account, pubblicità o un backend di analytics.",
          details: [
            {
              title: "Attribuzione SRD 5.1 e modifiche",
              paragraphs: [
                "This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.",
                "JUGALE seleziona, abbrevia, traduce, adatta e codifica in forma strutturata parti di quel materiale. Per il materiale SRD si basa su CC BY 4.0, non sulla Fan Content Policy.",
              ],
            },
            {
              title: "Contenuti esterni e chatbot",
              paragraphs: ["Sei responsabile dei contenuti e dei link che aggiungi. JUGALE non recupera le pagine collegate. I contenuti escono da JUGALE solo quando li esporti o condividi esplicitamente; da quel momento valgono termini e privacy del servizio ricevente."],
            },
            {
              title: "Licenze del software e delle dipendenze",
              paragraphs: ["Il codice di JUGALE è sotto licenza MIT. Le immagini di esempio e documentazione del progetto hanno termini CC BY 4.0 separati. Ogni build include THIRD_PARTY_NOTICES.txt e una SBOM SPDX con l'insieme esatto delle dipendenze JavaScript e Rust bloccate e le rispettive licenze."],
            },
          ],
        },
      ],
    },
  ],
});
