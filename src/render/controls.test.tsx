import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Stepper } from "./controls";

describe("Stepper", () => {
  it("steps on a keyboard-triggered click (no mousedown/touchstart, as a real Enter/Space activation produces)", () => {
    const onChange = vi.fn();
    render(<Stepper value={5} onChange={onChange} min={0} max={10} label="Test" />);

    // fireEvent.click defaults to detail: 0, same as a button activated via Enter/Space —
    // this is exactly the path that was previously dead (only mousedown/touchstart stepped).
    fireEvent.click(screen.getByRole("button", { name: "Decrease" }));
    expect(onChange).toHaveBeenCalledWith(4);

    fireEvent.click(screen.getByRole("button", { name: "Increase" }));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("commits exactly once when a pointer tap is released", () => {
    const onChange = vi.fn();
    render(<Stepper value={5} onChange={onChange} min={0} max={10} label="Test" />);
    const inc = screen.getByRole("button", { name: "Increase" });

    // One tap: a single pointerdown/up, then the browser's trailing compatibility click
    // (detail >= 1). Previously a touch tap also fired a synthesized mousedown, double-stepping.
    fireEvent.pointerDown(inc, { pointerId: 1, isPrimary: true, button: 0, clientX: 20, clientY: 20 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(inc, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.click(inc, { detail: 1 });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("cancels without changing the value when the pointer starts scrolling", () => {
    const onChange = vi.fn();
    render(<Stepper value={5} onChange={onChange} min={0} max={10} label="Test" />);
    const inc = screen.getByRole("button", { name: "Increase" });

    fireEvent.pointerDown(inc, { pointerId: 1, isPrimary: true, button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(inc, { pointerId: 1, clientX: 22, clientY: 45 });
    fireEvent.pointerUp(inc, { pointerId: 1, clientX: 22, clientY: 45 });
    fireEvent.click(inc, { detail: 1 });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not step past its bounds via keyboard", () => {
    const onChange = vi.fn();
    render(<Stepper value={0} onChange={onChange} min={0} max={10} label="Test" />);
    fireEvent.click(screen.getByRole("button", { name: "Decrease" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("localizes the button labels", () => {
    render(<Stepper value={1} onChange={() => {}} min={0} max={5} label="Test" />);
    expect(screen.getByRole("button", { name: "Decrease" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Increase" })).toBeInTheDocument();
  });
});

describe("press repeat", () => {
  afterEach(() => vi.useRealTimers());

  it("starts after the hold delay, then accelerates and stops on release", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<Stepper value={5} onChange={onChange} min={0} max={10} label="Test" />);
    const inc = screen.getByRole("button", { name: "Increase" });

    fireEvent.pointerDown(inc, { pointerId: 1, isPrimary: true, button: 0, clientX: 20, clientY: 20 });
    expect(onChange).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(399));
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1)); // 400ms: the hold wins over a possible scroll
    expect(onChange).toHaveBeenCalledTimes(1);

    // Consecutive repeats get faster: the 180ms gap fires, then the ramped ~144ms gap.
    act(() => vi.advanceTimersByTime(180));
    expect(onChange).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(144));
    expect(onChange).toHaveBeenCalledTimes(3);

    fireEvent.pointerUp(inc, { pointerId: 1, clientX: 20, clientY: 20 });
    act(() => vi.advanceTimersByTime(1000));
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("does not start a repeat when the button is disabled at its bound", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<Stepper value={10} onChange={onChange} min={0} max={10} label="Test" />);
    const inc = screen.getByRole("button", { name: "Increase" });

    fireEvent.pointerDown(inc, { pointerId: 1, isPrimary: true, button: 0, clientX: 20, clientY: 20 });
    act(() => vi.advanceTimersByTime(2000));
    expect(onChange).not.toHaveBeenCalled();
  });
});
