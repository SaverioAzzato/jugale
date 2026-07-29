import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useI18n } from "../i18n/useI18n";
import { handleTransientBack } from "./uiBack";
import { HelpPage } from "./HelpPage";

beforeEach(() => {
  useI18n.setState({ locale: "en" });
  window.history.replaceState(null, "", window.location.pathname);
});

describe("HelpPage", () => {
  it("shows one non-duplicated topic grid and keeps troubleshooting collapsed", () => {
    render(<HelpPage />);
    expect(screen.getAllByRole("button")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: /Edit and save/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Edit and save" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#help/manage");
    expect(screen.getByText("I cannot find Save version").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("img", { name: /Character sheet in Edit mode/ })).toBeInTheDocument();
  });

  it("uses Start as a quick start with direct links to the next task", () => {
    render(<HelpPage />);
    fireEvent.click(screen.getByRole("button", { name: /Start with JUGALE/ }));
    expect(screen.getByRole("img", { name: /welcome screen/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /See how the sheet works/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Use the character sheet" })).toBeInTheDocument();
  });

  it("uses transient Back to return from a topic to the Help home and restores focus", async () => {
    render(<HelpPage />);
    const sourceCard = screen.getAllByRole("button", { name: /Update with a chatbot/ })[0];
    fireEvent.click(sourceCard);
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Update with a chatbot" })).toHaveFocus());
    act(() => expect(handleTransientBack()).toBe(true));
    expect(screen.getByRole("heading", { name: "How to use :JUGALE" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Update with a chatbot/ })[0]).toHaveFocus());
  });

  it("loads a deep link and renders Italian content without reload", () => {
    window.history.replaceState(null, "", "#help/manage");
    render(<HelpPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Edit and save" })).toBeInTheDocument();
    act(() => useI18n.setState({ locale: "it" }));
    expect(screen.getByRole("heading", { level: 1, name: "Modifica e salva" })).toBeInTheDocument();
  });
});
