import type { Character } from "../schema";
import { Panel, DataTable } from "./primitives";

type Custom = Character["customSections"][number];

export function CustomSections({ c }: { c: Character }) {
  if (c.customSections.length === 0) return null;
  return (
    <>
      {c.customSections.map((s) => (
        <Panel key={s.id || s.title} title={s.title || "Sezione"} id={`custom-${s.id}`}>
          <Layout section={s} />
        </Panel>
      ))}
    </>
  );
}

/** Renders a user-defined section by its `layout` hint — zero code per new section. */
function Layout({ section }: { section: Custom }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = section.items as any[];

  switch (section.layout) {
    case "text":
      return <p>{section.content}</p>;

    case "list":
      return (
        <ul className="bullets">
          {items.map((it, i) => (
            <li key={i}>{typeof it === "string" ? it : (it?.label ?? JSON.stringify(it))}</li>
          ))}
        </ul>
      );

    case "checklist":
      return (
        <ul className="checklist">
          {items.map((it, i) => (
            <li key={i}>
              {it?.done ? "☑" : "☐"} {it?.label ?? String(it)}
            </li>
          ))}
        </ul>
      );

    case "keyValue":
      return (
        <dl className="kv">
          {items.map((it, i) => {
            const key = it?.key ?? Object.keys(it ?? {})[0];
            const value = it?.value ?? Object.values(it ?? {})[0];
            return (
              <div key={i} className="kv-row">
                <dt>{String(key ?? "")}</dt>
                <dd>{String(value ?? "")}</dd>
              </div>
            );
          })}
        </dl>
      );

    case "cards":
      return (
        <div className="cards">
          {items.map((it, i) => (
            <div key={i} className="mini-card">
              <strong>{it?.title ?? it?.name}</strong>
              <p>{it?.text ?? it?.description}</p>
            </div>
          ))}
        </div>
      );

    case "table": {
      const columns = section.columns.length > 0 ? section.columns : Object.keys(items[0] ?? {});
      return (
        <DataTable
          headers={columns}
          rows={items.map((it) => columns.map((col) => it?.[col]))}
        />
      );
    }

    default:
      return null;
  }
}
