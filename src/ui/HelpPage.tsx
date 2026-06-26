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
  introTitle: string;
  introBody: string;
  gptTitle: string;
  gptBody: string;
  schemaTitle: string;
  schemaIntro: string;
  schemaFields: SchemaField[];
  miscTitle: string;
  miscItems: string[];
}

const CONTENT: Record<Locale, HelpContent> = {
  en: {
    introTitle: "What this app is",
    introBody:
      "Your character lives in one character.json file (plus, optionally, an images/ folder next to it) — a plain, open format that's fully yours. This app is just a viewer and editor for that file: open a folder or a single JSON to load a character, play your session (HP, resources, conditions, rests…), then export it back, or let the app keep saving live if your browser or device supports it. The same file works identically on web, desktop, and mobile, and nothing about it locks you into this app — any text editor or AI chatbot can read and write it too.",
    gptTitle: "Building, leveling up, or validating a character with AI",
    gptBody:
      "Open the Prompts page (the book icon) for four ready-made prompts — Base, Create, Level up, Validate — written so any chatbot (ChatGPT, Claude, Gemini…) walks you through 5e rules and this app's conventions one decision at a time, instead of dumping a finished sheet on you. Fill in which rule guides are in scope (the free SRD by default) and, optionally, a class or race to focus on — the prompts update automatically. Download the JSON Schema from the same page and give it to the chatbot together with whichever prompt you need (Base is just the shared foundation the other three build on, not something you use by itself) — it pins down the exact field names, types, and allowed values, so the character.json you get back is far more likely to load here without a single issue flagged. Save what the chatbot gives you, then open it from this screen.",
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
        body: "One entry per class — multiclassing just means more entries. Each has a name, level, optional subclass, hit die, and, for casters, a spellcasting block (ability, known vs. prepared, slot progression). Total level, proficiency bonus, and the multiclass spell-slot table are all calculated from this list — never set those by hand.",
      },
      {
        key: "abilities",
        body: "The six ability scores, each flagged for saving-throw proficiency. Modifiers and save bonuses are calculated automatically; a modifierOverride escape hatch exists for homebrew rules that change how modifiers work.",
      },
      {
        key: "proficiencies",
        body: "Skill proficiencies and expertise, languages, tools, armor and weapon proficiencies, and an optional manual override for proficiency bonus (normally derived from total level).",
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
        body: "Spell save DC and attack bonus are calculated from your caster class(es) — don't set them by hand. Your actual spell lists live in spellSections, grouped however you like (cantrips, 1st level, a subclass's expanded list…), each spell carrying its range, components, and — most usefully — the roll you make versus the roll your enemy makes.",
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
    miscTitle: "A few other things worth knowing",
    miscItems: [
      "Live sync vs. export: if your browser or device can keep writing to your chosen folder live, changes save themselves; otherwise (or with a single JSON file) hit Export JSON to keep what you changed.",
      "If live sync isn't possible — or it was working and a save then fails — the status bar switches to a yellow \"Read-only · Export to save\" notice. Nothing is lost: just hit Export to download your latest changes as JSON.",
      "Switch theme, language, or units anytime from Settings (the gear icon).",
      "The chip in the bottom-right corner, when it appears, flags validation issues — schema problems or 5e inconsistencies — without ever blocking you from playing.",
      "The dice icon rolls any of the 7 standard dice, independently of any character being loaded.",
      "The same character.json works identically on web, desktop, and mobile — it's just a file.",
    ],
  },
  it: {
    introTitle: "Cos'è questa app",
    introBody:
      "Il tuo personaggio vive in un file character.json (più, opzionalmente, una cartella images/ accanto) — un formato aperto e semplice che è davvero tuo. Questa app è solo un visualizzatore ed editor per quel file: apri una cartella o un singolo JSON per caricare un personaggio, gioca la sessione (PF, risorse, condizioni, riposi…), poi esportalo, oppure lascia che l'app salvi in automatico se il tuo browser o dispositivo lo supporta. Lo stesso file funziona identico su web, desktop e mobile, e niente ti lega a questa app: anche un editor di testo o un chatbot AI possono leggerlo e scriverlo.",
    gptTitle: "Costruire, far salire di livello o validare un personaggio con l'AI",
    gptBody:
      "Apri la pagina Prompt (l'icona del libro) per quattro prompt pronti all'uso — Base, Crea, Sali di livello, Valida — scritti perché qualsiasi chatbot (ChatGPT, Claude, Gemini…) ti guidi tra le regole 5e e le convenzioni di questa app una decisione alla volta, invece di consegnarti una scheda già finita. Compila quali guide sono in ambito (la SRD gratuita di default) e, opzionalmente, una classe o razza su cui concentrarsi — i prompt si aggiornano automaticamente. Scarica lo JSON Schema dalla stessa pagina e forniscilo al chatbot insieme al prompt che ti serve (Base è solo la base condivisa su cui si costruiscono gli altri tre, non si usa da solo) — fissa i nomi esatti dei campi, i tipi e i valori permessi, così il character.json che ottieni ha molte più probabilità di caricarsi qui senza nessun problema segnalato. Salva quello che ti dà il chatbot, poi aprilo da questa schermata.",
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
        body: "Una voce per classe — il multiclasse significa solo più voci. Ognuna ha nome, livello, sottoclasse opzionale, dado vita, e, per gli incantatori, un blocco spellcasting (caratteristica, conosciuti vs preparati, progressione slot). Livello totale, bonus competenza e la tabella slot multiclasse sono tutti calcolati da questa lista — non vanno mai impostati a mano.",
      },
      {
        key: "abilities",
        body: "I sei punteggi di caratteristica, ciascuno con il flag di competenza nei tiri salvezza. Modificatori e bonus ai tiri salvezza sono calcolati automaticamente; esiste un modifierOverride come scappatoia per regole homebrew che cambiano come funzionano i modificatori.",
      },
      {
        key: "proficiencies",
        body: "Competenze e expertise nelle abilità, lingue, strumenti, competenze in armature e armi, e un override manuale opzionale per il bonus competenza (normalmente derivato dal livello totale).",
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
        body: "CD incantesimi e bonus d'attacco sono calcolati dalle tue classi incantatrici — non impostarli a mano. Le tue liste di incantesimi vivono in spellSections, raggruppate come preferisci (trucchetti, primo livello, la lista estesa di una sottoclasse…), ciascun incantesimo con gittata, componenti, e — la cosa più utile — il tiro che fai tu contro quello che fa il nemico.",
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
    miscTitle: "Qualche altra cosa utile da sapere",
    miscItems: [
      "Sync live vs esportazione: se il tuo browser o dispositivo può continuare a scrivere nella cartella scelta, le modifiche si salvano da sole; altrimenti (o con un singolo file JSON) usa Esporta JSON per non perdere quello che hai cambiato.",
      "Se la sync live non è possibile — o era attiva e un salvataggio poi fallisce — la status bar passa all'avviso giallo \"Solo lettura · Esporta per salvare\". Non perdi nulla: basta premere Esporta per scaricare le ultime modifiche come JSON.",
      "Cambia tema, lingua o unità in qualsiasi momento da Impostazioni (l'icona dell'ingranaggio).",
      "Il chip in basso a destra, quando appare, segnala problemi di validazione — di schema o di coerenza con le regole 5e — senza mai impedirti di giocare.",
      "L'icona dei dadi lancia uno qualsiasi dei 7 dadi standard, indipendentemente da qualsiasi personaggio caricato.",
      "Lo stesso character.json funziona identico su web, desktop e mobile — è solo un file.",
    ],
  },
};

export function HelpPage() {
  const locale = useI18n((s) => s.locale);
  const c = CONTENT[locale];

  return (
    <div className="settings-page help-page">
      <Panel title={c.introTitle}>
        <p>{c.introBody}</p>
      </Panel>
      <Panel title={c.gptTitle}>
        <p>{c.gptBody}</p>
      </Panel>
      <Panel title={c.schemaTitle}>
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
      </Panel>
      <Panel title={c.miscTitle}>
        <ul className="bullets">
          {c.miscItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
