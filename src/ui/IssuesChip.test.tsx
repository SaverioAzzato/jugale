import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IssuesChip } from "./IssuesChip";
import type { Issue } from "../schema";

const warning: Issue = {
  path: "classes",
  message: "Total level 25 exceeds 20",
  severity: "warning",
  code: "levelExceeds20",
  params: { level: 25 },
};

const error: Issue = {
  path: "meta.name",
  message: "Required",
  severity: "error",
  code: "schema",
};

describe("IssuesChip", () => {
  it("renders nothing when there are no issues", () => {
    const { container } = render(<IssuesChip issues={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows separate error and warning counts on the toggle", () => {
    render(<IssuesChip issues={[warning, error]} />);
    const toggle = screen.getByRole("button", { name: "Validation issues" });
    expect(toggle.textContent).toContain("1");
  });

  it("opens a panel listing every issue, localized and with its JSON path", () => {
    render(<IssuesChip issues={[warning, error]} />);
    fireEvent.click(screen.getByRole("button", { name: "Validation issues" }));

    expect(screen.getByText("Total level 25 exceeds 20")).toBeInTheDocument(); // interpolated template
    expect(screen.getByText("Required")).toBeInTheDocument(); // raw schema message, shown as-is
    expect(screen.getByText(/classes/)).toBeInTheDocument();
    expect(screen.getByText(/meta\.name/)).toBeInTheDocument();
  });

  it("closes the panel on close button click", () => {
    render(<IssuesChip issues={[warning]} />);
    fireEvent.click(screen.getByRole("button", { name: "Validation issues" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
