export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Convert a visual viewport point to normalized device coordinates for WebGL raycasting. */
export function pointToNdc(x: number, y: number, viewport: ViewportRect): { x: number; y: number } {
  return {
    x: ((x - viewport.left) / viewport.width) * 2 - 1,
    y: -((y - viewport.top) / viewport.height) * 2 + 1,
  };
}

/** Fixed-position styles live inside root CSS zoom, while DOMRects are already visual pixels. */
export function fixedAnchorBelow(
  anchor: Pick<DOMRect, "bottom" | "right">,
  viewportWidth: number,
  uiScale: number,
  gap = 8,
): { top: number; right: number } {
  return {
    top: anchor.bottom / uiScale + gap,
    right: (viewportWidth - anchor.right) / uiScale,
  };
}

export function fixedAnchorAbove(
  anchor: Pick<DOMRect, "top" | "right">,
  viewport: { width: number; height: number },
  uiScale: number,
  gap = 8,
): { bottom: number; right: number } {
  return {
    bottom: (viewport.height - anchor.top) / uiScale + gap,
    right: (viewport.width - anchor.right) / uiScale,
  };
}
