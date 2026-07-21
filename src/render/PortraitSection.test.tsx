import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { loadCharacter } from "../schema";
import { useCharacter } from "../state/store";
import { PortraitSection } from "./PortraitSection";
import { handleTransientBack } from "../ui/uiBack";
import { useSettings } from "../ui/useSettings";

const { character } = loadCharacter({ meta: { name: "Gallery hero" } });
const images = [
  { name: "A portrait.jpg", url: "blob:portrait" },
  { name: "B scene.jpg", url: "blob:scene" },
];

describe("PortraitSection lightbox gestures", () => {
  beforeEach(() => {
    useCharacter.setState({ images });
    useSettings.getState().setUiScale(100);
  });

  it("closes the lightbox on UI Back", () => {
    render(<PortraitSection c={character} />);
    fireEvent.click(screen.getByRole("button", { name: "Gallery hero" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    act(() => expect(handleTransientBack()).toBe(true));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("changes image on a horizontal swipe inside the lightbox", () => {
    render(<PortraitSection c={character} />);
    fireEvent.click(screen.getByRole("button", { name: "Gallery hero" }));
    const image = screen.getAllByRole("img", { name: "Gallery hero" }).at(-1)!;

    fireEvent.touchStart(image, { touches: [{ clientX: 220, clientY: 100 }] });
    fireEvent.touchEnd(image, {
      touches: [],
      changedTouches: [{ clientX: 100, clientY: 105 }],
    });

    expect(image).toHaveAttribute("src", "blob:scene");
  });

  it("pinch-zooms the active image and marks the overlay as owned by the gallery", () => {
    const { container } = render(<PortraitSection c={character} />);
    fireEvent.click(screen.getByRole("button", { name: "Gallery hero" }));
    const image = screen.getAllByRole("img", { name: "Gallery hero" }).at(-1)!;

    fireEvent.touchStart(image, {
      touches: [{ clientX: 100, clientY: 100 }, { clientX: 200, clientY: 100 }],
    });
    fireEvent.touchMove(image, {
      touches: [{ clientX: 50, clientY: 100 }, { clientX: 250, clientY: 100 }],
    });

    expect(image).toHaveClass("is-zoomed");
    expect(image.style.transform).toContain("scale(2)");
    expect(container.querySelector(".lightbox")).toHaveClass("no-swipe");
  });
});
