import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { Stepper, useHoldRepeat } from "./controls";

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

  it("steps exactly once per pointer tap (mouse, touch, or pen)", () => {
    const onChange = vi.fn();
    render(<Stepper value={5} onChange={onChange} min={0} max={10} label="Test" />);
    const inc = screen.getByRole("button", { name: "Increase" });

    // One tap: a single pointerdown/up, then the browser's trailing compatibility click
    // (detail >= 1). Previously a touch tap also fired a synthesized mousedown, double-stepping.
    fireEvent.pointerDown(inc);
    fireEvent.pointerUp(inc);
    fireEvent.click(inc, { detail: 1 });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(6);
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

describe("useHoldRepeat", () => {
  afterEach(() => vi.useRealTimers());

  it("fires once immediately, then accelerates while held and stops on release", () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const { result } = renderHook(() => useHoldRepeat(cb));

    act(() => result.current.start());
    expect(cb).toHaveBeenCalledTimes(1); // immediate step on press

    act(() => vi.advanceTimersByTime(399)); // still within the initial delay
    expect(cb).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1)); // 400ms: first auto-repeat
    expect(cb).toHaveBeenCalledTimes(2);

    // Consecutive repeats get faster: the 180ms gap fires, then the ramped ~144ms gap.
    act(() => vi.advanceTimersByTime(180));
    expect(cb).toHaveBeenCalledTimes(3);
    act(() => vi.advanceTimersByTime(144));
    expect(cb).toHaveBeenCalledTimes(4);

    act(() => result.current.stop());
    act(() => vi.advanceTimersByTime(1000));
    expect(cb).toHaveBeenCalledTimes(4); // no more firing after release
  });

  it("stops repeating once the callback signals a bound with false", () => {
    vi.useFakeTimers();
    const cb = vi.fn().mockReturnValueOnce(undefined).mockReturnValue(false);
    const { result } = renderHook(() => useHoldRepeat(cb));

    act(() => result.current.start()); // 1st call: undefined → keeps going
    act(() => vi.advanceTimersByTime(400)); // 2nd call: false → self-stops
    act(() => vi.advanceTimersByTime(2000));
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
