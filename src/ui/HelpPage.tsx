import type { ReactNode } from "react";
import { Panel } from "../render/primitives";
import { useI18n, useT, type Locale } from "../i18n/useI18n";

/** "?" icon button — opens the full Help page. Gold, and shown only on the empty/welcome
 *  screen (App owns the open/close state), since that's the one place a newcomer needs it. */
export function HelpButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      className="btn btn-icon help-button"
      aria-label={t("help.title")}
      data-overlay-trigger="help"
      onClick={onClick}
    >
      ?
    </button>
  );
}

interface SchemaField {
  key: string;
  body: string;
}

interface HelpContent {
  tocLabel: string;
  whatTitle: string;
  whatBody: string;
  characterTitle: string;
  characterBody: string;
  aiTitle: string;
  aiBody: string;
  manualTitle: string;
  manualBody: string;
  miscTitle: string;
  miscItems: string[];
  schemaTitle: string;
  schemaIntro: string;
  schemaFields: SchemaField[];
}

const CONTENT: Record<Locale, HelpContent> = {
  en: {
    tocLabel: "On this page",
    whatTitle: "What this app is",
    whatBody:
      "A viewer and editor for your character — nothing more. Your character is one open character.json file (optionally with an images/ folder beside it for the portrait and gallery). Open a single JSON, or a whole folder, and play your session: HP, resources, conditions, rests. The same file works identically on web, desktop, and mobile, and nothing locks you in — any text editor or AI chatbot can read and write it too.",
    characterTitle: "What a character is made of",
    characterBody:
      "Just a JSON file that follows one schema — that's the whole character. A folder simply bundles that character.json with an images/ subfolder (images are ordered by filename and the first is the portrait, so the JSON itself names no images). You don't have to memorize the format: download the schema from the Prompts page (the book icon) to hand to a chatbot, and see the field-by-field breakdown at the bottom of this page if you ever edit one by hand.",
    aiTitle: "Create a character — with AI",
    aiBody:
      "The fastest way. Open the Prompts page (the book icon) for four ready-made prompts — Base, Create, Level up, Validate — that make any chatbot (ChatGPT, Claude, Gemini…) walk you through 5e rules and this app's conventions one decision at a time, instead of dumping a finished sheet on you. Pick which rule guides are in scope (the free SRD by default) and, optionally, a class or race to focus on; download the JSON Schema from the same page and give it to the chatbot alongside the prompt, so the file comes back clean. Save what you get, then open it from the welcome screen.",
    manualTitle: "Create a character — by hand",
    manualBody:
      "Prefer full control? Turn on Edit mode (the pencil in the top bar) to fill the whole sheet in inside the app — add and remove classes, resources, items, spells, features and more, all in the same layout you play in. Or write the character.json directly in a text editor, using the JSON Schema (Prompts page) and the section-by-section reference at the bottom of this page as your guide.",
    miscTitle: "Other things worth knowing",
    miscItems: [
      "Saving: if your browser or device can keep writing to your chosen folder, changes save themselves; otherwise (a single JSON file, or if a live save ever fails) the status bar shows a yellow \"Read-only · Export to save\" — hit Export JSON and nothing is lost.",
      "Switch theme, language, or units anytime from Settings (the gear icon).",
      "The chip in the bottom-right corner, when it appears, flags validation issues — schema problems or 5e inconsistencies — without ever blocking you from playing.",
      "The dice icon rolls any of the 7 standard dice, with or without a character loaded.",
      "The welcome screen keeps a Recent list so you can reopen a character in one click. Where the platform can keep a live link to your file (desktop, and Chromium browsers) it reopens writable; where it can't (Firefox, Safari) it keeps a read-only snapshot so the character still shows up — you just export to save. It's purely local: only a reference (or that snapshot) is kept on your device, never sent anywhere. Clear it anytime with Clear; an entry that no longer opens (file moved or deleted) is dropped automatically.",
      "Everything stays on your device: JUGALE has no server and no tracking, and sends nothing anywhere. Your character lives in its file; recents, settings, and theme are saved locally in your browser or app only.",
    ],
    schemaTitle: "The character.json fields, section by section",
    schemaIntro:
      "You'll only need this if you're reading or editing a character.json by hand — the app never requires it, and a chatbot using the JSON Schema already knows all of this.",
    schemaFields: [
      {
        key: "meta",
        body: "The file's identity card: the character's name (the only field that's actually required, along with schemaVersion), an optional player name, a one-line summary, and ruleset — the rule guides in scope, defaulting to the free SRD. No image fields ever live here: the app reads the images/ folder next to character.json in alphabetical filename order and uses the first one as the portrait.",
      },
      {
        key: "identity",
        body: "Who the character is at a glance — race, background, alignment, size, age, and similar facts. Known fields get their own spot on the sheet; anything else you add is kept and shown generically.",
      },
      {
        key: "classes",
        body: "One entry per class — multiclassing just means more entries. Each has a name, level, optional subclass, hit die, and, for casters, a spellcasting block (ability, known vs. prepared, slot progression). Total level and proficiency bonus are calculated from this list — never set those by hand. Spell slots, though, aren't auto-calculated: you track them as resources (see below), one per slot level.",
      },
      {
        key: "abilities",
        body: "The six ability scores, each flagged for saving-throw proficiency. Modifiers and save bonuses are calculated automatically; a modifierOverride escape hatch exists for homebrew rules that change how modifiers work.",
      },
      {
        key: "proficiencies",
        body: "Skill proficiencies and expertise, languages, tools, armor and weapon proficiencies, and an optional manual override for proficiency bonus (normally derived from total level). Languages live only here — not under origin.",
      },
      {
        key: "senses / defenses",
        body: "Special senses (darkvision, blindsight…) as free strings with their range, plus damage resistances, immunities and vulnerabilities and condition immunities. Their own clear home instead of being buried in a feature's text. Passive Perception isn't here — it's worked out from your Perception skill.",
      },
      {
        key: "combat",
        body: "Armor Class, speed, initiative, hit points, and any innate physical attacks (natural weapons, unarmed strikes — never spells, those belong in spellSections). AC is usually built up from your equipped armor/shield items rather than set here directly — see inventory below.",
      },
      {
        key: "resources",
        body: "The one tracker for anything you spend and recover: spell slots of any kind, ki, rage, sorcery points, channel divinity, arrows, anything at all. Each entry has a current/max, a category that picks how it's displayed, and a resetOn (short rest, long rest, dawn, manual) that drives the rest buttons.",
      },
      {
        key: "spellcasting / spellSections",
        body: "Spell save DC and attack bonus are calculated from your caster class(es) — don't set them by hand. Your actual spell lists live in spellSections, grouped however you like (cantrips, 1st level, a subclass's expanded list…). Each spell carries its casting time (action / bonus / reaction / a longer time), whether it's a ritual, its V·S·M components with a materials list (cost and whether the spell consumes them), range, duration/concentration, damage and its type, the “at higher levels” scaling, and — most usefully — the roll you make versus the roll your enemy makes.",
      },
      {
        key: "features",
        body: "Every class, subclass, race, background, or feat feature goes here — invocations, metamagic, maneuvers, fighting styles, racial traits, all of it. Tag each with where it comes from, and optionally link it to a resource so the sheet can show its remaining charges inline.",
      },
      {
        key: "inventory",
        body: "Your items, with quantity, weight, value, and whether they're equipped. A weapon item carries its own attack profiles; an armor or shield item carries its own AC contribution — equip it and the sheet adds it to your Armor Class automatically. Currencies (gp, sp, etc.) live here too.",
      },
      {
        key: "origin / narrative",
        body: "The roleplay side: racial traits and your background's signature feature in origin; personality, ideals, bonds, flaws, appearance, and backstory in narrative. All free text.",
      },
      {
        key: "customSections",
        body: "Anything the schema didn't think of — a table of spell components, a downtime checklist, a list of house-rule notes. Pick a layout (text, list, checklist, table, cards…) and the app renders it with zero extra code.",
      },
      {
        key: "actions",
        body: "Buttons for short/long rest and any custom one-tap effect (like spending a hit die), each defined by a small formula — e.g. heal 1d8 plus your Constitution modifier, then spend a hit die. You'll only touch this when building a character by hand or with a chatbot; the app just runs whatever formulas are there.",
      },
      {
        key: "session",
        body: "Purely temporary play state: active conditions, inspiration, death save counts, session notes. Nothing here is ever derived — it's yours to clear whenever a session ends.",
      },
    ],
  },
  it: {
    tocLabel: "In questa pagina",
    whatTitle: "Cos'è questa app",
    whatBody:
      "Un visualizzatore ed editor per il tuo personaggio — niente di più. Il tuo personaggio è un file character.json aperto (opzionalmente con una cartella images/ accanto per ritratto e galleria). Apri un singolo JSON, o un'intera cartella, e gioca la sessione: PF, risorse, condizioni, riposi. Lo stesso file funziona identico su web, desktop e mobile, e niente ti lega: anche un editor di testo o un chatbot AI possono leggerlo e scriverlo.",
    characterTitle: "Com'è fatto un personaggio",
    characterBody:
      "Semplicemente un file JSON che segue uno schema — è tutto qui il personaggio. Una cartella non fa che unire quel character.json a una sottocartella images/ (le immagini sono ordinate per nome file e la prima è il ritratto, quindi il JSON non nomina nessuna immagine). Non devi imparare il formato a memoria: scarica lo schema dalla pagina Prompt (l'icona del libro) da dare a un chatbot, e consulta la scomposizione campo per campo in fondo a questa pagina se mai ne modifichi uno a mano.",
    aiTitle: "Creare un personaggio — con l'AI",
    aiBody:
      "Il modo più rapido. Apri la pagina Prompt (l'icona del libro) per quattro prompt pronti all'uso — Base, Crea, Sali di livello, Valida — che fanno sì che qualsiasi chatbot (ChatGPT, Claude, Gemini…) ti guidi tra le regole 5e e le convenzioni di questa app una decisione alla volta, invece di consegnarti una scheda già finita. Scegli quali guide sono in ambito (la SRD gratuita di default) e, opzionalmente, una classe o razza su cui concentrarti; scarica lo JSON Schema dalla stessa pagina e forniscilo al chatbot insieme al prompt, così il file torna pulito. Salva quello che ottieni, poi aprilo dalla schermata iniziale.",
    manualTitle: "Creare un personaggio — a mano",
    manualBody:
      "Preferisci il controllo totale? Attiva la modalità Modifica (la matita nella barra in alto) per compilare l'intera scheda dentro l'app — aggiungi e rimuovi classi, risorse, oggetti, incantesimi, privilegi e altro, nello stesso layout in cui giochi. Oppure scrivi il character.json direttamente in un editor di testo, usando come guida lo JSON Schema (pagina Prompt) e la scomposizione sezione per sezione in fondo a questa pagina.",
    miscTitle: "Qualche altra cosa utile da sapere",
    miscItems: [
      "Salvataggio: se il tuo browser o dispositivo può continuare a scrivere nella cartella scelta, le modifiche si salvano da sole; altrimenti (un singolo file JSON, o se un salvataggio live fallisce) la status bar mostra un avviso giallo \"Solo lettura · Esporta per salvare\" — premi Esporta JSON e non perdi nulla.",
      "Cambia tema, lingua o unità in qualsiasi momento da Impostazioni (l'icona dell'ingranaggio).",
      "Il chip in basso a destra, quando appare, segnala problemi di validazione — di schema o di coerenza con le regole 5e — senza mai impedirti di giocare.",
      "L'icona dei dadi lancia uno qualsiasi dei 7 dadi standard, con o senza un personaggio caricato.",
      "La schermata iniziale tiene un elenco Recenti per riaprire un personaggio con un clic. Dove la piattaforma può mantenere un collegamento vivo al file (desktop e browser Chromium) lo riapre in scrittura; dove non può (Firefox, Safari) salva uno snapshot in sola lettura, così il personaggio compare comunque — basta esportare per salvare. È tutto locale: sul dispositivo resta solo un riferimento (o quello snapshot), mai inviato da nessuna parte. Puoi svuotarlo quando vuoi con Svuota; una voce che non si apre più (file spostato o eliminato) viene rimossa in automatico.",
      "Tutto resta sul tuo dispositivo: JUGALE non ha server né tracciamento e non invia nulla da nessuna parte. Il personaggio vive nel suo file; recenti, impostazioni e tema sono salvati solo in locale nel browser o nell'app.",
    ],
    schemaTitle: "I campi di character.json, sezione per sezione",
    schemaIntro:
      "Ti serve solo se leggi o modifichi un character.json a mano — l'app non lo richiede mai, e un chatbot che usa lo JSON Schema conosce già tutto questo.",
    schemaFields: [
      {
        key: "meta",
        body: "La carta d'identità del file: il nome del personaggio (l'unico campo davvero obbligatorio, insieme a schemaVersion), un nome giocatore opzionale, un riassunto in una riga, e ruleset — le guide di regole in ambito, di default la sola SRD gratuita. Nessun campo immagine vive qui: l'app legge la cartella images/ accanto a character.json in ordine alfabetico di nome file e usa la prima come ritratto.",
      },
      {
        key: "identity",
        body: "Chi è il personaggio a colpo d'occhio — razza, background, allineamento, taglia, età e fatti simili. I campi noti hanno un loro posto nella scheda; qualsiasi altro campo aggiunto viene conservato e mostrato in modo generico.",
      },
      {
        key: "classes",
        body: "Una voce per classe — il multiclasse significa solo più voci. Ognuna ha nome, livello, sottoclasse opzionale, dado vita, e, per gli incantatori, un blocco spellcasting (caratteristica, conosciuti vs preparati, progressione slot). Livello totale e bonus competenza sono calcolati da questa lista — non vanno mai impostati a mano. Gli slot incantesimo invece non sono auto-calcolati: si tracciano come risorse (vedi sotto), uno per livello di slot.",
      },
      {
        key: "abilities",
        body: "I sei punteggi di caratteristica, ciascuno con il flag di competenza nei tiri salvezza. Modificatori e bonus ai tiri salvezza sono calcolati automaticamente; esiste un modifierOverride come scappatoia per regole homebrew che cambiano come funzionano i modificatori.",
      },
      {
        key: "proficiencies",
        body: "Competenze e expertise nelle abilità, lingue, strumenti, competenze in armature e armi, e un override manuale opzionale per il bonus competenza (normalmente derivato dal livello totale). Le lingue vivono solo qui — non sotto origin.",
      },
      {
        key: "senses / defenses",
        body: "Sensi speciali (scurovisione, vista cieca…) come stringhe libere con la loro gittata, più resistenze, immunità e vulnerabilità ai danni e immunità alle condizioni. Una casa chiara invece di nasconderli nel testo di un privilegio. La Percezione passiva non è qui — si ricava dalla tua abilità di Percezione.",
      },
      {
        key: "combat",
        body: "Classe Armatura, velocità, iniziativa, punti ferita, e qualsiasi attacco fisico innato (armi naturali, attacchi senz'armi — mai incantesimi, quelli vanno in spellSections). La CA di solito si costruisce dagli oggetti armatura/scudo equipaggiati invece di impostarla qui direttamente — vedi inventory più sotto.",
      },
      {
        key: "resources",
        body: "L'unico tracker per qualsiasi cosa si spenda e recuperi: slot incantesimo di qualsiasi tipo, ki, rabbia, punti stregoneria, channel divinity, frecce, qualsiasi cosa. Ogni voce ha un current/max, una category che decide come viene mostrata, e un resetOn (riposo breve, lungo, all'alba, manuale) che guida i bottoni di riposo.",
      },
      {
        key: "spellcasting / spellSections",
        body: "CD incantesimi e bonus d'attacco sono calcolati dalle tue classi incantatrici — non impostarli a mano. Le tue liste di incantesimi vivono in spellSections, raggruppate come preferisci (trucchetti, primo livello, la lista estesa di una sottoclasse…). Ogni incantesimo porta il tempo di lancio (azione / bonus / reazione / un tempo più lungo), se è un rituale, i componenti V·S·M con la lista dei materiali (costo e se l'incantesimo li consuma), gittata, durata/concentrazione, danno e tipo, lo scaling “ai livelli superiori”, e — la cosa più utile — il tiro che fai tu contro quello che fa il nemico.",
      },
      {
        key: "features",
        body: "Ogni privilegio di classe, sottoclasse, razza, background o talento va qui — invocazioni, metamagia, manovre, stili di combattimento, tratti razziali, tutto. Etichetta ognuno con la sua provenienza, e opzionalmente collegalo a una risorsa così la scheda può mostrarne le cariche rimanenti in linea.",
      },
      {
        key: "inventory",
        body: "I tuoi oggetti, con quantità, peso, valore, e se sono equipaggiati. Un'arma porta i propri profili d'attacco; un'armatura o uno scudo porta il proprio contributo alla CA — equipaggialo e la scheda lo somma automaticamente alla Classe Armatura. Anche le valute (mo, ma, ecc.) vivono qui.",
      },
      {
        key: "origin / narrative",
        body: "Il lato di interpretazione: tratti razziali e il privilegio del background in origin; personalità, ideali, legami, difetti, aspetto e storia in narrative. Tutto testo libero.",
      },
      {
        key: "customSections",
        body: "Qualsiasi cosa lo schema non avesse previsto — una tabella di componenti per incantesimi, una checklist di downtime, un elenco di note homebrew. Scegli un layout (testo, lista, checklist, tabella, cards…) e l'app lo mostra senza scrivere codice.",
      },
      {
        key: "actions",
        body: "Bottoni per riposo breve/lungo e qualsiasi effetto custom a un tocco (come spendere un dado vita), ognuno definito da una piccola formula — es. curare 1d8 più il modificatore di Costituzione, poi spendere un dado vita. Lo tocchi solo costruendo un personaggio a mano o con un chatbot; l'app esegue semplicemente le formule presenti.",
      },
      {
        key: "session",
        body: "Stato di gioco puramente temporaneo: condizioni attive, ispirazione, conteggio tiri salvezza contro la morte, note di sessione. Niente qui è mai derivato — sta a te azzerarlo quando finisce una sessione.",
      },
    ],
  },
};

export function HelpPage() {
  const locale = useI18n((s) => s.locale);
  const c = CONTENT[locale];

  const sections: { id: string; title: string; content: ReactNode }[] = [
    { id: "help-what", title: c.whatTitle, content: <p>{c.whatBody}</p> },
    { id: "help-character", title: c.characterTitle, content: <p>{c.characterBody}</p> },
    { id: "help-ai", title: c.aiTitle, content: <p>{c.aiBody}</p> },
    { id: "help-manual", title: c.manualTitle, content: <p>{c.manualBody}</p> },
    {
      id: "help-misc",
      title: c.miscTitle,
      content: (
        <ul className="bullets">
          {c.miscItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ),
    },
    {
      id: "help-schema",
      title: c.schemaTitle,
      content: (
        <>
          <p className="muted">{c.schemaIntro}</p>
          <dl className="help-schema-list">
            {c.schemaFields.map((f) => (
              <div className="help-schema-item" key={f.key}>
                <dt>
                  <code>{f.key}</code>
                </dt>
                <dd>{f.body}</dd>
              </div>
            ))}
          </dl>
        </>
      ),
    },
  ];

  return (
    <div className="settings-page help-page">
      <nav className="help-toc" aria-label={c.tocLabel}>
        <span className="help-toc-label">{c.tocLabel}</span>
        <ol>
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((s) => (
        <Panel key={s.id} id={s.id} title={s.title}>
          {s.content}
        </Panel>
      ))}
    </div>
  );
}
