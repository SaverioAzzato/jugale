import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";

// Rendering App should exercise application behavior, not jsdom's lack of WebGL. DiceScene has
// its own browser/device surface; non-dice unit tests receive the smallest compatible scene.
vi.mock("../ui/dice/DiceScene", () => ({
  DiceScene: class {
    onTap: ((value: number) => void) | null = null;
    sync() {}
    applyTheme() {}
    reflowBounds() {}
    dispose() {}
  },
}));

// One deterministic baseline for every unit/component test. Test-local beforeEach hooks run after
// this and only need to declare the state relevant to their scenario.
beforeEach(async () => {
  vi.useRealTimers();
  localStorage.clear();
  URL.revokeObjectURL ??= () => {};
  const [
    { useCharacter },
    { useI18n },
    { useDice },
    { useSettings },
    { useToast },
    { useTheme },
    { useUpdate },
  ] = await Promise.all([
    import("../characterStore"),
    import("../i18n/useI18n"),
    import("../ui/useDice"),
    import("../ui/useSettings"),
    import("../ui/useToast"),
    import("../theme/useTheme"),
    import("../update/useUpdate"),
  ]);
  useCharacter.setState({ versionBusy: false });
  useCharacter.getState().clear();
  useCharacter.setState(useCharacter.getInitialState(), true);
  useI18n.setState({ locale: "en" });
  useDice.getState().clear();
  useToast.setState({ toasts: [] });
  useSettings.setState({
    toastSeconds: 10,
    units: "imperial",
    uiScale: 100,
    versionHistory: true,
    diceButtonPosition: "floating-right",
  });
  useTheme.setState({ theme: "arcane" });
  document.documentElement.dataset.theme = "arcane";
  document.documentElement.style.removeProperty("--ui-scale");
  useUpdate.setState({ state: { status: "idle" } });
});
