import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { safeHref, WikiLink } from "./primitives";

describe("safeHref", () => {
  it("allows http(s) and mailto links from the JSON", () => {
    expect(safeHref("https://5e.tools/spells.html#fireball")).toBe("https://5e.tools/spells.html#fireball");
    expect(safeHref("http://example.com/")).toBe("http://example.com/");
    expect(safeHref("mailto:dm@example.com")).toBe("mailto:dm@example.com");
  });

  it("rejects script/data/other dangerous schemes (XSS via a malicious character.json)", () => {
    expect(safeHref("javascript:alert(document.cookie)")).toBeNull();
    expect(safeHref("  javascript:alert(1)")).toBeNull(); // leading whitespace
    expect(safeHref("JaVaScRiPt:alert(1)")).toBeNull(); // case-insensitive scheme
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHref("vbscript:msgbox(1)")).toBeNull();
    expect(safeHref("not a url at all")).toBeNull();
  });
});

describe("WikiLink", () => {
  it("renders an anchor with safe rel for a valid URL", () => {
    render(<WikiLink link="https://example.com/x">Fireball</WikiLink>);
    const a = screen.getByRole("link", { name: "Fireball" });
    expect(a).toHaveAttribute("href", "https://example.com/x");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
    expect(a).toHaveAttribute("target", "_blank");
  });

  it("renders inert text (no anchor) for a dangerous or missing link", () => {
    const { rerender } = render(<WikiLink link="javascript:alert(1)">Fireball</WikiLink>);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Fireball")).toBeInTheDocument();

    rerender(<WikiLink link={null}>Fireball</WikiLink>);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Fireball")).toBeInTheDocument();
  });
});
