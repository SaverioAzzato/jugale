import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RecentEntry } from "../storage/recents";
import type { TFn } from "../i18n/useI18n";
import { EmptyState } from "./EmptyState";

const recent = (key: string): RecentEntry => ({
  platform: "web",
  kind: "folder",
  name: `Character ${key}`,
  key,
  lastOpenedAt: 1,
});

const t = ((key: string) =>
  key === "recents.remove" ? "Remove from recent" : key) as TFn;

describe("EmptyState recents", () => {
  it("dismisses one recent without opening it", () => {
    const onReopenRecent = vi.fn();
    const onRemoveRecent = vi.fn();
    render(
      <EmptyState
        onOpenJson={vi.fn()}
        onOpenFolder={vi.fn()}
        onSample={vi.fn()}
        recents={[recent("one"), recent("two")]}
        onReopenRecent={onReopenRecent}
        onRemoveRecent={onRemoveRecent}
        onClearRecents={vi.fn()}
        t={t}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove from recent: Character one" }));

    expect(onRemoveRecent).toHaveBeenCalledWith("one");
    expect(onReopenRecent).not.toHaveBeenCalled();
  });

  it("puts all recent rows in the bounded scrolling list", () => {
    const { container } = render(
      <EmptyState
        onOpenJson={vi.fn()}
        onOpenFolder={vi.fn()}
        onSample={vi.fn()}
        recents={Array.from({ length: 6 }, (_, index) => recent(String(index)))}
        onReopenRecent={vi.fn()}
        onRemoveRecent={vi.fn()}
        onClearRecents={vi.fn()}
        t={t}
      />,
    );

    expect(container.querySelector(".empty-recents-list")?.children).toHaveLength(6);
  });

  it("shows gradients only toward directions that still have scrollable content", () => {
    const { container } = render(
      <EmptyState
        onOpenJson={vi.fn()}
        onOpenFolder={vi.fn()}
        onSample={vi.fn()}
        recents={Array.from({ length: 6 }, (_, index) => recent(String(index)))}
        onReopenRecent={vi.fn()}
        onRemoveRecent={vi.fn()}
        onClearRecents={vi.fn()}
        t={t}
      />,
    );
    const scroller = container.querySelector<HTMLElement>(".empty-recents-list")!;
    const gradients = container.querySelector<HTMLElement>(".empty-recents-scroll")!;
    Object.defineProperties(scroller, {
      clientHeight: { configurable: true, value: 158 },
      scrollHeight: { configurable: true, value: 240 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });

    fireEvent.scroll(scroller);
    expect(gradients).not.toHaveClass("can-scroll-up");
    expect(gradients).toHaveClass("can-scroll-down");

    scroller.scrollTop = 40;
    fireEvent.scroll(scroller);
    expect(gradients).toHaveClass("can-scroll-up");
    expect(gradients).toHaveClass("can-scroll-down");

    scroller.scrollTop = 82;
    fireEvent.scroll(scroller);
    expect(gradients).toHaveClass("can-scroll-up");
    expect(gradients).not.toHaveClass("can-scroll-down");
  });
});
