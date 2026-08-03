import type { ReactNode } from "react";
import { safeHref } from "./format";

/** Renders a wiki link when the URL is present and safe, otherwise plain content.
 *  Links are the soul of the sheet — but only http(s)/mailto ones (see safeHref). */
export function WikiLink({ link, children }: { link?: string | null; children: ReactNode }) {
  const href = link ? safeHref(link) : null;
  if (!href) return <>{children}</>;
  const parsed = new URL(href);
  const destination = parsed.hostname || parsed.protocol.replace(":", "");
  return (
    <a
      className="wikilink"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={destination}
      data-external-host={destination}
    >
      {children}
    </a>
  );
}

/**
 * A section card. Returns null when `hidden`, so empty sections disappear.
 * `plain` drops the visible card chrome (background/border/shadow) while keeping the
 * box model, so the section reads as the prominent/primary one. `title` is optional —
 * omit it for a chrome-less group with no heading.
 */
export function Panel({
  title,
  id,
  hidden,
  plain,
  children,
}: {
  title?: string;
  id?: string;
  hidden?: boolean;
  plain?: boolean;
  children: ReactNode;
}) {
  if (hidden) return null;
  return (
    <section className={plain ? "panel panel-plain" : "panel"} id={id}>
      {title && <h2 className="panel-title">{title}</h2>}
      {children}
    </section>
  );
}

/** A rounded disclosure chevron that rotates 90° when open. Used by expandable rows. */
export function Caret({ open }: { open: boolean }) {
  return (
    <svg
      className={open ? "caret is-open" : "caret"}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Generic table; cells are arbitrary nodes. Empty cells fall back to an em dash. */
export function DataTable({
  headers,
  rows,
  caption,
}: {
  headers: ReactNode[];
  rows: ReactNode[][];
  caption?: string;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell === "" || cell == null ? "—" : cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
