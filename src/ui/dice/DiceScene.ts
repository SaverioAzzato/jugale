import * as THREE from "three";
import { makeDie, type DieObject, type ThemeColors } from "./geometry";
import type { RolledDie } from "../useDice";

const DIE_PX = 52; // bounding-sphere radius in px → dice ~104px across
const DRAG_THRESH = 6; // px of movement before a press becomes a drag (vs a tap)

const reduceMotion =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ROLL_MS = reduceMotion ? 1 : 720;
const ENTER_MS = reduceMotion ? 1 : 260;
const LEAVE_MS = reduceMotion ? 1 : 220;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p: number) => {
  const c = 1.70158 + 1;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};

interface Entry {
  id: string;
  die: DieObject;
  group: THREE.Group;
  baseScale: number;
  bornAt: number;
  spinAxis: THREE.Vector3;
  totalAngle: number;
  leaving: boolean;
  leaveAt: number;
  leaveSpin: THREE.Vector3;
}

/**
 * Owns a full-screen transparent WebGL canvas of physics-free 3D dice. The canvas is
 * pointer-events:none so the sheet stays clickable; dice are picked via global capture
 * listeners + raycasting (a tap dismisses, a drag repositions). One result per die,
 * already decided before it lands — the tumble just settles onto that face.
 */
export class DiceScene {
  /** Set by the React wrapper: a tapped die asks the store to dismiss it. */
  onTap: ((id: string) => void) | null = null;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private ndc = new THREE.Vector2();
  private tmpQuat = new THREE.Quaternion();
  private entries: Entry[] = [];
  private theme: ThemeColors;
  private raf = 0;
  private running = false;
  private drag: {
    entry: Entry;
    offset: THREE.Vector3;
    startX: number;
    startY: number;
    moved: boolean;
  } | null = null;

  constructor(container: HTMLElement) {
    this.theme = readTheme();
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 2000);
    this.camera.position.set(0, 0, 600);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.domElement.className = "dice-canvas-gl";
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(-0.4, 0.9, 1.2);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(0.6, -0.3, 0.5);
    this.scene.add(fill);

    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointerdown", this.onPointerDown, true);
    this.renderOnce();
  }

  /** Reconcile the scene against the store's dice list (source of truth for existence). */
  sync(dice: RolledDie[]): void {
    const ids = new Set(dice.map((d) => d.id));
    for (const d of dice) if (!this.entries.some((e) => e.id === d.id)) this.spawn(d);
    for (const e of this.entries) {
      if (!ids.has(e.id) && !e.leaving) {
        e.leaving = true;
        e.leaveAt = performance.now();
      }
    }
    this.start();
  }

  applyTheme(): void {
    this.theme = readTheme();
    for (const e of this.entries) e.die.applyTheme(this.theme);
    this.renderOnce();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointerdown", this.onPointerDown, true);
    window.removeEventListener("pointermove", this.onPointerMove, true);
    window.removeEventListener("pointerup", this.onPointerUp, true);
    for (const e of this.entries) e.die.dispose();
    this.entries = [];
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private spawn(d: RolledDie): void {
    const die = makeDie(d.sides, d.result, this.theme);
    const baseScale = DIE_PX / die.radius;
    die.group.userData.dieId = d.id;
    const w = window.innerWidth;
    const h = window.innerHeight;
    die.group.position.set(
      (Math.random() * 2 - 1) * Math.min(w * 0.3, 360),
      (Math.random() * 0.5 - 0.18) * Math.min(h, 640),
      0,
    );
    this.scene.add(die.group);
    this.entries.push({
      id: d.id,
      die,
      group: die.group,
      baseScale,
      bornAt: performance.now(),
      spinAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      totalAngle: (2 + Math.random() * 1.5) * Math.PI * 2,
      leaving: false,
      leaveAt: 0,
      leaveSpin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
    });
  }

  private start(): void {
    if (!this.running) {
      this.running = true;
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private renderOnce(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private frame = (): void => {
    const active = this.update(performance.now());
    this.renderOnce();
    if (active || this.drag) {
      this.raf = requestAnimationFrame(this.frame);
    } else {
      this.running = false;
      this.raf = 0;
    }
  };

  private update(now: number): boolean {
    let active = false;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i];
      if (e.leaving) {
        const p = clamp01((now - e.leaveAt) / LEAVE_MS);
        e.group.scale.setScalar(e.baseScale * (1 - p));
        e.group.rotateOnAxis(e.leaveSpin, 0.25);
        if (p >= 1) {
          this.scene.remove(e.group);
          e.die.dispose();
          this.entries.splice(i, 1);
          continue;
        }
        active = true;
        continue;
      }
      const ep = clamp01((now - e.bornAt) / ENTER_MS);
      e.group.scale.setScalar(e.baseScale * (ep < 1 ? Math.max(0.001, easeOutBack(ep)) : 1));
      if (ep < 1) active = true;
      const rp = clamp01((now - e.bornAt) / ROLL_MS);
      if (rp < 1) {
        const ang = e.totalAngle * (1 - easeOutCubic(rp));
        this.tmpQuat.setFromAxisAngle(e.spinAxis, ang);
        e.group.quaternion.copy(e.die.targetQuat).multiply(this.tmpQuat);
        active = true;
      } else {
        e.group.quaternion.copy(e.die.targetQuat);
      }
    }
    return active;
  }

  // ----- pointer picking -----------------------------------------------------

  private toNdc(x: number, y: number): void {
    this.ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  }

  private pick(x: number, y: number): Entry | null {
    const pickable = this.entries.filter((e) => !e.leaving);
    if (pickable.length === 0) return null;
    this.toNdc(x, y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(
      pickable.map((e) => e.group),
      true,
    );
    if (hits.length === 0) return null;
    let o: THREE.Object3D | null = hits[0].object;
    while (o && o.userData.dieId === undefined) o = o.parent;
    return o ? (this.entries.find((e) => e.group === o) ?? null) : null;
  }

  private worldOnPlane(x: number, y: number): THREE.Vector3 {
    this.toNdc(x, y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const p = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.plane, p);
    return p;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const hit = this.pick(e.clientX, e.clientY);
    if (!hit) return; // miss → let the press fall through to the sheet underneath
    e.preventDefault();
    e.stopPropagation();
    const wp = this.worldOnPlane(e.clientX, e.clientY);
    this.drag = {
      entry: hit,
      offset: new THREE.Vector3(wp.x - hit.group.position.x, wp.y - hit.group.position.y, 0),
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    window.addEventListener("pointermove", this.onPointerMove, true);
    window.addEventListener("pointerup", this.onPointerUp, true);
    this.start();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.drag) return;
    e.preventDefault();
    e.stopPropagation();
    if (Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) > DRAG_THRESH)
      this.drag.moved = true;
    if (this.drag.moved) {
      const wp = this.worldOnPlane(e.clientX, e.clientY);
      this.drag.entry.group.position.set(wp.x - this.drag.offset.x, wp.y - this.drag.offset.y, 0);
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    window.removeEventListener("pointermove", this.onPointerMove, true);
    window.removeEventListener("pointerup", this.onPointerUp, true);
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    this.suppressClick();
    if (!d.moved && !d.entry.leaving) this.onTap?.(d.entry.id); // tap → dismiss
    this.start();
  };

  /** Swallow the click the browser fires after a die tap so the sheet underneath ignores it. */
  private suppressClick(): void {
    const handler = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("click", handler, true);
      clearTimeout(to);
    };
    const to = window.setTimeout(cleanup, 400);
    window.addEventListener("click", handler, true);
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.left = -w / 2;
    this.camera.right = w / 2;
    this.camera.top = h / 2;
    this.camera.bottom = -h / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderOnce();
  };
}

function readTheme(): ThemeColors {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    body: get("--surface-2", "#1e1e2b"),
    edge: get("--accent", "#8a7bf0"),
    num: get("--gold", "#e0a44c"),
  };
}
