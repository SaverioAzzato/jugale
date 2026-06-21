import type { ReactNode } from "react";

/** Renders a wiki link when present, otherwise plain content. Links are the soul of the sheet. */
export function WikiLink({ link, children }: { link?: string | null; children: ReactNode }) {
  if (!link) return <>{children}</>;
  return (
    <a className="wikilink" href={link} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** A titled section card. Returns null when `hidden`, so empty sections disappear. */
export function Panel({
  title,
  id,
  hidden,
  children,
}: {
  title: string;
  id?: string;
  hidden?: boolean;
  children: ReactNode;
}) {
  if (hidden) return null;
  return (
    <section className="panel" id={id}>
      <h2 className="panel-title">{title}</h2>
      {children}
    </section>
  );
}

export const fmtMod = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

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
