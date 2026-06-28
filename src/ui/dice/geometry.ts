import * as THREE from "three";

/** Theme-derived colors for the dice (read from CSS tokens). */
export interface ThemeColors {
  body: string; // --surface-2
  edge: string; // --accent
  num: string; // --gold
}

/** A built die: a three.js group plus the hooks the scene needs (orient, retheme, free). */
export interface DieObject {
  group: THREE.Group;
  /** Orientation that turns the result face toward the camera, number upright. */
  targetQuat: THREE.Quaternion;
  /** Circumscribed radius at natural scale — the scene scales the group from this. */
  radius: number;
  applyTheme: (t: ThemeColors) => void;
  dispose: () => void;
}

interface Face {
  normal: THREE.Vector3; // unit, local space
  center: THREE.Vector3; // local
  size: number; // mean centroid→vertex distance (label sizing)
}

/** Tilt that gives the resting die a touch of 3D depth instead of a flat face-on number. */
const HERO_DIR = new THREE.Vector3(0.14, 0.2, 1).normalize();
const LABEL_FONT = '"Cinzel", Georgia, serif';

/** Group coplanar triangles of a convex solid into one logical die face each. */
function extractFaces(geo: THREE.BufferGeometry): Face[] {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.getAttribute("position");
  const groups: { normal: THREE.Vector3; verts: THREE.Vector3[] }[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac).normalize();
    let grp = groups.find((gr) => gr.normal.dot(n) > 0.999);
    if (!grp) {
      grp = { normal: n.clone(), verts: [] };
      groups.push(grp);
    }
    grp.verts.push(a.clone(), b.clone(), c.clone());
  }
  return groups.map((gr) => {
    const center = new THREE.Vector3();
    gr.verts.forEach((v) => center.add(v));
    center.divideScalar(gr.verts.length);
    let size = 0;
    gr.verts.forEach((v) => (size += v.distanceTo(center)));
    return { normal: gr.normal, center, size: size / gr.verts.length };
  });
}

/** Build a pentagonal trapezohedron (the d10/d100 shape): 10 kite faces, two apexes. */
function trapezohedron(): THREE.BufferGeometry {
  const n = 5;
  const R = 1;
  const apex = 1.05;
  // Each kite face spans the apex + 3 consecutive ring points (2 near, 1 far). Those 4
  // points are only coplanar (a flat kite, not a creased one) at this exact apex:ring-offset
  // ratio — derived from the ring's angular step (π/n) via the kite's symmetry plane.
  const yRing = apex * (1 - Math.cos(Math.PI / n)) / (1 + Math.cos(Math.PI / n));
  const top = new THREE.Vector3(0, apex, 0);
  const bot = new THREE.Vector3(0, -apex, 0);
  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < 2 * n; i++) {
    const ang = (i / (2 * n)) * Math.PI * 2;
    ring.push(new THREE.Vector3(R * Math.cos(ang), i % 2 === 0 ? yRing : -yRing, R * Math.sin(ang)));
  }
  const positions: number[] = [];
  const tri = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3) =>
    positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
  const quad = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) => {
    tri(p0, p1, p2);
    tri(p0, p2, p3);
  };
  const at = (i: number) => ring[((i % (2 * n)) + 2 * n) % (2 * n)];
  // Reversed vertex order on the top fan vs. the bottom: the two apexes face opposite
  // ways, so winding has to flip too or the top faces point inward and silently merge
  // with the bottom ones in extractFaces (same normal direction, one face group lost).
  for (let k = 0; k < n; k++) quad(top, at(2 * k + 2), at(2 * k + 1), at(2 * k));
  for (let k = 0; k < n; k++) quad(bot, at(2 * k + 1), at(2 * k + 2), at(2 * k + 3));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function baseGeometry(sides: number): { geo: THREE.BufferGeometry; edgeThreshold: number } {
  switch (sides) {
    case 6:
      return { geo: new THREE.BoxGeometry(1.18, 1.18, 1.18), edgeThreshold: 1 };
    case 8:
      return { geo: new THREE.OctahedronGeometry(1), edgeThreshold: 1 };
    case 12:
      return { geo: new THREE.DodecahedronGeometry(1), edgeThreshold: 1 };
    case 20:
      return { geo: new THREE.IcosahedronGeometry(1), edgeThreshold: 1 };
    case 10:
    case 100:
      return { geo: trapezohedron(), edgeThreshold: 18 };
    default:
      return { geo: new THREE.IcosahedronGeometry(1), edgeThreshold: 1 };
  }
}

/** Orthonormal basis with z along the face normal and y as close to world-up as possible. */
function labelBasis(normal: THREE.Vector3): THREE.Matrix4 {
  const z = normal.clone().normalize();
  const up = Math.abs(z.y) > 0.92 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const x = new THREE.Vector3().crossVectors(up, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z);
}

/** The numbers shown on each face; the result is forced onto face 0 (the hero face). */
function faceTexts(sides: number, result: number, count: number): string[] {
  const base: string[] = [];
  if (sides === 100) for (let i = 0; i < count; i++) base.push(String(i * 10).padStart(2, "0"));
  else for (let i = 0; i < count; i++) base.push(String(i + 1));
  const want = String(result);
  const at = base.indexOf(want);
  if (at >= 0) {
    base[at] = base[0];
    base[0] = want;
  } else base[0] = want;
  return base;
}

function drawNumber(ctx: CanvasRenderingContext2D, text: string, color: string): void {
  const S = ctx.canvas.width;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let fs = text.length >= 3 ? 58 : text.length === 2 ? 74 : 88;
  ctx.font = `700 ${fs}px ${LABEL_FONT}`;
  while (ctx.measureText(text).width > S * 0.8 && fs > 12) {
    fs -= 4;
    ctx.font = `700 ${fs}px ${LABEL_FONT}`;
  }
  ctx.fillText(text, S / 2, S / 2 + 4);
  // Underline 6/9 so the resting orientation is never ambiguous.
  if (text === "6" || text === "9") {
    const w = ctx.measureText(text).width;
    ctx.lineWidth = Math.max(3, fs * 0.06);
    ctx.beginPath();
    ctx.moveTo(S / 2 - w * 0.42, S / 2 + fs * 0.42);
    ctx.lineTo(S / 2 + w * 0.42, S / 2 + fs * 0.42);
    ctx.stroke();
  }
}

/**
 * A real d4 doesn't show its result on a face toward the viewer — it lands face-down and
 * the result is read at the top point, where each of the 3 visible faces prints the same
 * number in its corner. So every vertex gets one fixed number, stamped at that corner on
 * each of the 3 faces touching it, and "rolling" just turns the matching vertex to face up.
 */
function buildD4(result: number, theme: ThemeColors): DieObject {
  const SIZE = 1.05;
  const verts = [
    new THREE.Vector3(1, 1, 1),
    new THREE.Vector3(1, -1, -1),
    new THREE.Vector3(-1, 1, -1),
    new THREE.Vector3(-1, -1, 1),
  ].map((v) => v.normalize().multiplyScalar(SIZE));

  const faces = [0, 1, 2, 3].map((omit) => {
    const [a, ...bc] = [0, 1, 2, 3].filter((i) => i !== omit);
    let [b, c] = bc; // b/c may swap below to fix winding; a never changes
    const A = verts[a];
    const B = verts[b];
    const C = verts[c];
    const center = new THREE.Vector3().add(A).add(B).add(C).divideScalar(3);
    const normal = new THREE.Vector3().crossVectors(B.clone().sub(A), C.clone().sub(A)).normalize();
    if (normal.dot(center) < 0) {
      [b, c] = [c, b];
      normal.negate();
    }
    return { idx: [a, b, c] as [number, number, number], center, normal };
  });

  const positions: number[] = [];
  faces.forEach((f) => {
    const [a, b, c] = f.idx;
    positions.push(...verts[a].toArray(), ...verts[b].toArray(), ...verts[c].toArray());
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const radius = geo.boundingSphere?.radius ?? SIZE;

  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.body),
    roughness: 0.5,
    metalness: 0.18,
    flatShading: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  group.add(new THREE.Mesh(geo, bodyMat));

  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(theme.edge) });
  const edgeGeo = new THREE.EdgesGeometry(geo, 1);
  group.add(new THREE.LineSegments(edgeGeo, edgeMat));

  // One canvas per vertex value — reused at every corner where that vertex appears.
  const vertexLabels = [1, 2, 3, 4].map((n) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 96;
    const ctx = canvas.getContext("2d");
    if (ctx) drawNumber(ctx, String(n), theme.num);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return { ctx, tex, text: String(n) };
  });

  const labelGeos: THREE.BufferGeometry[] = [];
  faces.forEach((f) => {
    const cornerSize = f.center.distanceTo(verts[f.idx[0]]) * 0.5;
    f.idx.forEach((vi) => {
      const V = verts[vi];
      // Numbers point outward, top toward their own corner — matches how real d4s print them.
      const outward = V.clone().sub(f.center).normalize();
      const z = f.normal;
      const x = new THREE.Vector3().crossVectors(outward, z).normalize();
      const y = new THREE.Vector3().crossVectors(z, x).normalize();
      const pg = new THREE.PlaneGeometry(cornerSize, cornerSize);
      labelGeos.push(pg);
      const mat = new THREE.MeshBasicMaterial({ map: vertexLabels[vi].tex, transparent: true, depthWrite: false });
      const plane = new THREE.Mesh(pg, mat);
      plane.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      plane.position.copy(f.center).lerp(V, 0.62).addScaledVector(z, radius * 0.02);
      plane.renderOrder = 1;
      group.add(plane);
    });
  });

  // Orientation that turns the result's vertex toward the camera (the visible "up" point).
  const heroVertex = verts[result - 1].clone().normalize();
  const tz = HERO_DIR.clone();
  const wup = Math.abs(tz.y) > 0.92 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const tx = new THREE.Vector3().crossVectors(wup, tz).normalize();
  const ty = new THREE.Vector3().crossVectors(tz, tx).normalize();
  const mTarget = new THREE.Matrix4().makeBasis(tx, ty, tz);
  const mLocal = labelBasis(heroVertex);
  const targetQuat = new THREE.Quaternion()
    .setFromRotationMatrix(mTarget)
    .multiply(new THREE.Quaternion().setFromRotationMatrix(mLocal).invert());

  const applyTheme = (t: ThemeColors) => {
    bodyMat.color.set(t.body);
    edgeMat.color.set(t.edge);
    vertexLabels.forEach((l) => {
      if (l.ctx) drawNumber(l.ctx, l.text, t.num);
      l.tex.needsUpdate = true;
    });
  };

  const dispose = () => {
    geo.dispose();
    bodyMat.dispose();
    edgeGeo.dispose();
    edgeMat.dispose();
    labelGeos.forEach((g) => g.dispose());
    vertexLabels.forEach((l) => l.tex.dispose());
  };

  return { group, targetQuat, radius, applyTheme, dispose };
}

/** Build a themed 3D die already oriented to show `result`. */
export function makeDie(sides: number, result: number, theme: ThemeColors): DieObject {
  if (sides === 4) return buildD4(result, theme);
  const { geo, edgeThreshold } = baseGeometry(sides);
  geo.computeBoundingSphere();
  const radius = geo.boundingSphere?.radius ?? 1;
  const faces = extractFaces(geo);

  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.body),
    roughness: 0.5,
    metalness: 0.18,
    flatShading: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  group.add(new THREE.Mesh(geo, bodyMat));

  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(theme.edge) });
  const edgeGeo = new THREE.EdgesGeometry(geo, edgeThreshold);
  group.add(new THREE.LineSegments(edgeGeo, edgeMat));

  const texts = faceTexts(sides, result, faces.length);
  const labels: { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; text: string }[] = [];
  const labelGeos: THREE.BufferGeometry[] = [];
  faces.forEach((f, i) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawNumber(ctx, texts[i], theme.num);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const pg = new THREE.PlaneGeometry(f.size * 0.92, f.size * 0.92);
    labelGeos.push(pg);
    const plane = new THREE.Mesh(pg, mat);
    plane.quaternion.setFromRotationMatrix(labelBasis(f.normal));
    plane.position.copy(f.center).addScaledVector(f.normal, radius * 0.02);
    plane.renderOrder = 1;
    group.add(plane);
    labels.push({ ctx, tex, text: texts[i] });
  });

  // Orientation that maps the hero face's local basis to the on-screen target basis.
  const hero = faces[0];
  const tz = HERO_DIR.clone();
  const wup = Math.abs(tz.y) > 0.92 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const tx = new THREE.Vector3().crossVectors(wup, tz).normalize();
  const ty = new THREE.Vector3().crossVectors(tz, tx).normalize();
  const mTarget = new THREE.Matrix4().makeBasis(tx, ty, tz);
  const mLocal = labelBasis(hero.normal);
  const targetQuat = new THREE.Quaternion()
    .setFromRotationMatrix(mTarget)
    .multiply(new THREE.Quaternion().setFromRotationMatrix(mLocal).invert());

  const applyTheme = (t: ThemeColors) => {
    bodyMat.color.set(t.body);
    edgeMat.color.set(t.edge);
    labels.forEach((l) => {
      drawNumber(l.ctx, l.text, t.num);
      l.tex.needsUpdate = true;
    });
  };

  const dispose = () => {
    geo.dispose();
    bodyMat.dispose();
    edgeGeo.dispose();
    edgeMat.dispose();
    labelGeos.forEach((g) => g.dispose());
    labels.forEach((l) => l.tex.dispose());
  };

  return { group, targetQuat, radius, applyTheme, dispose };
}
