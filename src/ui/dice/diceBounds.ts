export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Keep a circular die inside the viewport and outside UI rectangles, all measured in visual
 * client pixels. DOMRects already include both Interface scale and browser zoom, so callers must
 * not scale these values a second time. */
export function resolveCircleBounds(point: Point, radius: number, viewport: Rect, obstacles: Rect[]): Point {
  const minX = viewport.left + radius;
  const maxX = viewport.right - radius;
  const minY = viewport.top + radius;
  const maxY = viewport.bottom - radius;
  const clampToViewport = (candidate: Point): Point => ({
    x: Math.min(maxX, Math.max(minX, candidate.x)),
    y: Math.min(maxY, Math.max(minY, candidate.y)),
  });

  let result = clampToViewport(point);
  for (let pass = 0; pass < Math.max(1, obstacles.length * 2); pass += 1) {
    let changed = false;
    for (const rect of obstacles) {
      const expanded = {
        left: rect.left - radius,
        top: rect.top - radius,
        right: rect.right + radius,
        bottom: rect.bottom + radius,
      };
      if (
        result.x < expanded.left || result.x > expanded.right ||
        result.y < expanded.top || result.y > expanded.bottom
      ) continue;

      const candidates = [
        { x: expanded.left, y: result.y },
        { x: expanded.right, y: result.y },
        { x: result.x, y: expanded.top },
        { x: result.x, y: expanded.bottom },
      ].filter((candidate) =>
        candidate.x >= minX && candidate.x <= maxX && candidate.y >= minY && candidate.y <= maxY,
      );
      if (candidates.length === 0) continue;
      candidates.sort((a, b) => Math.hypot(a.x - result.x, a.y - result.y) - Math.hypot(b.x - result.x, b.y - result.y));
      result = candidates[0];
      changed = true;
    }
    if (!changed) break;
  }
  return clampToViewport(result);
}
