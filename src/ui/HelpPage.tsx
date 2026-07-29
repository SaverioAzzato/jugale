import { useCallback, useEffect, useRef, useState } from "react";
import { helpEn } from "../help/content/en";
import { helpIt } from "../help/content/it";
import { HELP_TOPIC_IDS, type HelpCatalog, type HelpTopicId } from "../help/model";
import { useI18n, useT } from "../i18n/useI18n";
import { useUiBackHandler } from "./uiBack";
import { BookIcon, PencilIcon } from "./AppIcons";

export function HelpButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      className="btn btn-icon help-button"
      title={label ?? t("help.title")}
      aria-label={label ?? t("help.title")}
      data-overlay-trigger="help"
      onClick={onClick}
    >
      ?
    </button>
  );
}

const CATALOGS = { en: helpEn, it: helpIt } satisfies Record<string, HelpCatalog>;

function topicFromHash(): HelpTopicId | null {
  const match = window.location.hash.match(/^#help\/([a-z-]+)$/);
  return match && HELP_TOPIC_IDS.includes(match[1] as HelpTopicId) ? match[1] as HelpTopicId : null;
}

function HelpIcon({ id }: { id: HelpTopicId }) {
  const paths: Record<HelpTopicId, string[]> = {
    start: ["M4 5h16v14H4z", "M8 9h8M8 13h5"],
    play: ["M8 8h8l3 4-2 6-4-2h-2l-4 2-2-6z", "M9 11v3M7.5 12.5h3M15 12h.01"],
    manage: ["M4 20h4l11-11-4-4L4 16z", "m13 7 4 4"],
    chatbots: ["M4 5h16v12H9l-5 3z", "M8 9h8M8 13h5"],
    files: ["M3 6h7l2 2h9v11H3z", "M8 12h8M8 15h5"],
    json: ["M8 3H5v18h14V7l-4-4z", "M14 3v5h5", "m10 12-2 2 2 2m4-4 2 2-2 2"],
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[id].map((path) => <path key={path} d={path} />)}
    </svg>
  );
}

export function HelpPage() {
  const locale = useI18n((state) => state.locale);
  const t = useT();
  const catalog = CATALOGS[locale];
  const [topicId, setTopicId] = useState<HelpTopicId | null>(() => topicFromHash());
  const topicHeadingRef = useRef<HTMLHeadingElement>(null);
  const lastTopicRef = useRef<HelpTopicId | null>(topicId);
  const topic = topicId ? catalog.topics.find((item) => item.id === topicId) ?? null : null;

  const openTopic = useCallback((id: HelpTopicId) => {
    lastTopicRef.current = id;
    window.history.replaceState(null, "", `#help/${id}`);
    setTopicId(id);
  }, []);
  const openHome = useCallback(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setTopicId(null);
  }, []);

  useUiBackHandler(topic !== null, () => {
    openHome();
    return true;
  });

  useEffect(() => {
    const onHash = () => setTopicId(topicFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (topicId) {
        lastTopicRef.current = topicId;
        topicHeadingRef.current?.focus({ preventScroll: true });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        return;
      }
      const lastTopic = lastTopicRef.current;
      if (lastTopic) {
        document.querySelector<HTMLButtonElement>(`.help-card[data-help-topic="${lastTopic}"]`)?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [topicId]);

  if (!topic) {
    return (
      <main className="help-center help-home" aria-labelledby="help-home-title">
        <header className="help-hero">
          <h1 id="help-home-title">{catalog.heroTitle}</h1>
        </header>
        <nav className="help-topic-grid" aria-label={t("help.allSections")}>
          {catalog.topics.map((item) => <TopicCard key={item.id} topic={item} onOpen={openTopic} />)}
        </nav>
      </main>
    );
  }

  return (
    <main className="help-center help-topic" aria-labelledby="help-topic-title">
      <nav className="help-breadcrumb" aria-label={t("help.breadcrumb")}>
        <button type="button" onClick={openHome}>{t("help.sections")}</button>
        <span aria-hidden="true">›</span>
        <span>{topic.title}</span>
      </nav>
      <header className="help-topic-header">
        <span className="help-topic-icon"><HelpIcon id={topic.id} /></span>
        <div><h1 id="help-topic-title" ref={topicHeadingRef} tabIndex={-1}>{topic.title}</h1><p>{topic.summary}</p></div>
      </header>
      {topic.sections.map((section, sectionIndex) => (
        <section className="help-article" key={section.title} aria-labelledby={`help-section-${sectionIndex}`}>
          <h2 id={`help-section-${sectionIndex}`}>{section.title}</h2>
          {section.intro && <p><HelpText text={section.intro} /></p>}
          {section.media && <HelpFigure media={section.media} />}
          {section.steps && <ol className="help-steps">{section.steps.map((step) => <li key={step}><HelpText text={step} /></li>)}</ol>}
          {section.bullets && <ul>{section.bullets.map((item) => <li key={item}><HelpText text={item} /></li>)}</ul>}
          {section.gallery && (
            <div className="help-tour-grid">
              {section.gallery.map((item) => (
                <article className="help-tour-card" key={item.title}>
                  <HelpFigure media={item.media} />
                  <div><h3>{item.title}</h3><p><HelpText text={item.body} /></p></div>
                </article>
              ))}
            </div>
          )}
          {section.flow && (
            <ol className="help-flow" aria-label={section.title}>
              {section.flow.map((step, index) => <li key={step}><span>{index + 1}</span><strong>{step}</strong></li>)}
            </ol>
          )}
          {section.files && (
            <div className="help-file-tree">
              {section.files.map((file) => <div key={file.name}><code>{file.name}</code><span><HelpText text={file.description} /></span></div>)}
            </div>
          )}
          {section.note && <p className="help-note"><HelpText text={section.note} /></p>}
          {section.links && (
            <nav className="help-section-links" aria-label={t("help.relatedTopics")}>
              {section.links.map((link) => (
                <a key={link.topicId} href={`#help/${link.topicId}`} onClick={(event) => { event.preventDefault(); openTopic(link.topicId); }}>
                  {link.label}<span aria-hidden="true">→</span>
                </a>
              ))}
            </nav>
          )}
          {section.details?.map((detail, detailIndex) => (
            <details className="help-details" key={detail.title}>
              <summary id={`help-detail-${sectionIndex}-${detailIndex}`}>{detail.title}</summary>
              <div>
                {detail.paragraphs?.map((paragraph) => <p key={paragraph}><HelpText text={paragraph} /></p>)}
                {detail.bullets && <ul>{detail.bullets.map((item) => <li key={item}><HelpText text={item} /></li>)}</ul>}
              </div>
            </details>
          ))}
        </section>
      ))}
    </main>
  );
}

function HelpText({ text }: { text: string }) {
  const t = useT();
  return text.split(/(\{book\}|\{pencil\})/g).map((part, index) => {
    if (part === "{book}") {
      return <span className="help-inline-icon" data-help-icon="book" role="img" aria-label={t("prompts.title")} key={`${part}-${index}`}><BookIcon /></span>;
    }
    if (part === "{pencil}") {
      return <span className="help-inline-icon" data-help-icon="pencil" role="img" aria-label={t("edit.toggle")} key={`${part}-${index}`}><PencilIcon /></span>;
    }
    return part;
  });
}

function HelpFigure({ media }: { media: NonNullable<HelpCatalog["topics"][number]["sections"][number]["media"]> }) {
  return (
    <figure className="help-figure">
      <div className="help-figure-frame">
        <img src={media.src} alt={media.alt} loading="lazy" />
      </div>
      <figcaption><HelpText text={media.caption} /></figcaption>
    </figure>
  );
}

function TopicCard({ topic, onOpen }: { topic: HelpCatalog["topics"][number]; onOpen: (id: HelpTopicId) => void }) {
  return (
    <button type="button" className={topic.id === "start" ? "help-card help-card-featured" : "help-card"} data-help-topic={topic.id} onClick={() => onOpen(topic.id)}>
      <span className="help-card-icon"><HelpIcon id={topic.id} /></span>
      <span><strong>{topic.title}</strong><small>{topic.summary}</small></span>
      <span className="help-card-arrow" aria-hidden="true">›</span>
    </button>
  );
}
