/** Number of priority actions that fit beside the toolbar's fixed content. Hidden actions share
 * one overflow button, so that slot is reserved whenever not everything fits. Measurements are
 * physical pixels because CSS root zoom changes the rendered button size. */
export function toolbarCapacity(
  toolbarWidth: number,
  leftWidth: number,
  scale: number,
  actionCount: number,
  fixedActionCount = 0,
): number {
  if (toolbarWidth <= 0) return actionCount; // jsdom / pre-layout
  const available = toolbarWidth - 40 * scale - leftWidth - 16 * scale;
  const button = 38 * scale;
  const gap = 10 * scale;
  const widthFor = (count: number) => count * button + Math.max(0, count - 1) * gap;
  if (widthFor(fixedActionCount + actionCount) <= available) return actionCount;
  for (let visible = actionCount - 1; visible >= 0; visible -= 1) {
    if (widthFor(fixedActionCount + visible + 1) <= available) return visible; // + overflow
  }
  return 0;
}
