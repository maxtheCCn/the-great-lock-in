/**
 * Stylised 3D muscle figure built procedurally (no external model download).
 * Colour intensity = recorded training volume in the selected period, relative
 * to the most-trained group. It does not depict muscle size, growth or activation.
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MuscleId } from '@/data/types';
import { LEVEL_COLORS, LEVEL_EMISSIVE, type Level } from './intensity';

type Vec3 = [number, number, number];

interface Part {
  shape: 'ellipsoid' | 'capsule';
  pos: Vec3;
  scale?: Vec3;
  rot?: Vec3;
  /** capsule radius and straight length */
  r?: number;
  len?: number;
  mirror?: boolean;
}

const NEUTRAL: Part[] = [
  { shape: 'ellipsoid', pos: [0, 1.64, 0], scale: [0.102, 0.128, 0.112] },
  { shape: 'capsule', pos: [0, 1.49, -0.005], r: 0.05, len: 0.08 },
  { shape: 'ellipsoid', pos: [0, 1.22, -0.005], scale: [0.165, 0.25, 0.1] },
  { shape: 'ellipsoid', pos: [0, 0.94, 0], scale: [0.155, 0.11, 0.1] },
  { shape: 'capsule', pos: [0.228, 1.23, 0], r: 0.04, len: 0.22, rot: [0, 0, 0.15], mirror: true },
  { shape: 'capsule', pos: [0.262, 0.95, 0.004], r: 0.034, len: 0.2, rot: [0, 0, 0.1], mirror: true },
  { shape: 'ellipsoid', pos: [0.283, 0.755, 0.01], scale: [0.032, 0.058, 0.022], mirror: true },
  { shape: 'capsule', pos: [0.1, 0.7, 0], r: 0.066, len: 0.28, rot: [0, 0, 0.03], mirror: true },
  { shape: 'ellipsoid', pos: [0.105, 0.5, 0.012], scale: [0.052, 0.055, 0.052], mirror: true },
  { shape: 'capsule', pos: [0.108, 0.29, 0.005], r: 0.043, len: 0.32, mirror: true },
  { shape: 'ellipsoid', pos: [0.112, 0.036, 0.04], scale: [0.044, 0.034, 0.105], mirror: true },
];

const MUSCLE_PARTS: Record<MuscleId, Part[]> = {
  chest: [{ shape: 'ellipsoid', pos: [0.074, 1.335, 0.084], scale: [0.085, 0.068, 0.045], rot: [0.1, 0.32, -0.12], mirror: true }],
  shoulders: [{ shape: 'ellipsoid', pos: [0.195, 1.37, 0], scale: [0.058, 0.07, 0.064], rot: [0, 0, -0.25], mirror: true }],
  biceps: [{ shape: 'ellipsoid', pos: [0.233, 1.215, 0.03], scale: [0.035, 0.085, 0.036], rot: [0, 0, 0.15], mirror: true }],
  triceps: [{ shape: 'ellipsoid', pos: [0.227, 1.225, -0.03], scale: [0.037, 0.095, 0.036], rot: [0, 0, 0.15], mirror: true }],
  forearms: [{ shape: 'ellipsoid', pos: [0.262, 0.97, 0.006], scale: [0.037, 0.11, 0.037], rot: [0, 0, 0.1], mirror: true }],
  abs: [
    ...[1.18, 1.1, 1.025].map((y): Part => ({ shape: 'ellipsoid', pos: [0.031, y, 0.094], scale: [0.029, 0.034, 0.018], mirror: true })),
    { shape: 'ellipsoid', pos: [0, 0.955, 0.088], scale: [0.05, 0.045, 0.02] },
  ],
  obliques: [{ shape: 'ellipsoid', pos: [0.104, 1.07, 0.058], scale: [0.038, 0.1, 0.038], rot: [0, 0.5, -0.12], mirror: true }],
  traps: [
    { shape: 'ellipsoid', pos: [0.07, 1.445, -0.022], scale: [0.074, 0.04, 0.05], rot: [0, 0, -0.38], mirror: true },
    { shape: 'ellipsoid', pos: [0, 1.32, -0.072], scale: [0.07, 0.12, 0.03] },
  ],
  lats: [{ shape: 'ellipsoid', pos: [0.1, 1.2, -0.058], scale: [0.068, 0.15, 0.04], rot: [0, -0.42, -0.25], mirror: true }],
  lowerBack: [{ shape: 'ellipsoid', pos: [0.034, 1.0, -0.083], scale: [0.03, 0.08, 0.025], mirror: true }],
  glutes: [{ shape: 'ellipsoid', pos: [0.07, 0.88, -0.068], scale: [0.074, 0.075, 0.06], mirror: true }],
  quads: [{ shape: 'ellipsoid', pos: [0.1, 0.69, 0.034], scale: [0.066, 0.17, 0.058], rot: [0.04, 0, 0.03], mirror: true }],
  hamstrings: [{ shape: 'ellipsoid', pos: [0.1, 0.68, -0.035], scale: [0.06, 0.16, 0.054], rot: [-0.04, 0, 0.03], mirror: true }],
  calves: [{ shape: 'ellipsoid', pos: [0.11, 0.33, -0.028], scale: [0.047, 0.1, 0.047], mirror: true }],
};

const VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vY;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vY = (modelMatrix * vec4(position, 1.0)).y;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uRim;
  uniform float uEmissive;
  uniform float uSelected;
  uniform float uHover;
  uniform float uTime;
  uniform float uScan;
  uniform float uScanOn;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vY;
  void main() {
    vec3 n = normalize(vNormal);
    float fres = pow(1.0 - max(dot(n, vView), 0.0), 2.4);
    float key = max(dot(n, normalize(vec3(0.45, 0.85, 0.6))), 0.0);
    float fill = max(dot(n, normalize(vec3(-0.6, 0.2, -0.4))), 0.0) * 0.25;
    vec3 col = uColor * (0.32 + 0.6 * key + fill);
    col += uColor * uEmissive * 0.42;
    col += uRim * fres * (0.45 + uEmissive * 0.7);
    float scan = smoothstep(0.035, 0.0, abs(vY - uScan)) * uScanOn;
    col += uRim * scan * 0.55;
    float pulse = 0.55 + 0.45 * sin(uTime * 4.0);
    col += vec3(0.85, 1.0, 0.9) * uSelected * (0.18 + 0.22 * pulse) * (0.35 + fres);
    col += uRim * uHover * 0.18;
    gl_FragColor = vec4(col, 1.0);
  }
`;

interface Shared {
  uTime: { value: number };
  uScan: { value: number };
  uScanOn: { value: number };
}

function makeMaterial(shared: Shared, color: string, rim: string, emissive: number) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uRim: { value: new THREE.Color(rim) },
      uEmissive: { value: emissive },
      uSelected: { value: 0 },
      uHover: { value: 0 },
      uTime: shared.uTime,
      uScan: shared.uScan,
      uScanOn: shared.uScanOn,
    },
  });
}

function expand(parts: Part[]): Part[] {
  return parts.flatMap((p) =>
    p.mirror
      ? [
          p,
          {
            ...p,
            pos: [-p.pos[0], p.pos[1], p.pos[2]] as Vec3,
            rot: p.rot ? ([p.rot[0], -p.rot[1], -p.rot[2]] as Vec3) : undefined,
          },
        ]
      : [p],
  );
}

function partGeometry(p: Part, inflate = 1): THREE.BufferGeometry {
  const g = p.shape === 'ellipsoid' ? new THREE.SphereGeometry(1, 36, 24) : new THREE.CapsuleGeometry(p.r!, p.len!, 8, 20);
  const scale = p.shape === 'ellipsoid' ? new THREE.Vector3(...p.scale!).multiplyScalar(inflate) : new THREE.Vector3(inflate, inflate, inflate);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))), scale));
  return g;
}

/** One geometry (and one draw call) per group instead of one mesh per part. */
function merged(parts: Part[], inflate = 1): THREE.BufferGeometry {
  const gs = parts.map((p) => partGeometry(p, inflate));
  const out = mergeGeometries(gs, false)!;
  gs.forEach((g) => g.dispose());
  return out;
}

const MUSCLE_KEYS = Object.keys(MUSCLE_PARTS) as MuscleId[];

/** World-space anchor points per muscle (one per part, mirrored included) for the floating label. */
export const MUSCLE_ANCHORS: Record<MuscleId, THREE.Vector3[]> = Object.fromEntries(
  MUSCLE_KEYS.map((id) => [id, expand(MUSCLE_PARTS[id]).map((p) => new THREE.Vector3(...p.pos))]),
) as Record<MuscleId, THREE.Vector3[]>;

const SHELL_FRAG = /* glsl */ `
  uniform float uScan;
  uniform float uScanOn;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vY;
  void main() {
    vec3 n = normalize(vNormal);
    float fres = pow(1.0 - abs(dot(n, vView)), 3.2);
    float lines = smoothstep(0.55, 1.0, sin(vY * 260.0) * 0.5 + 0.5);
    float scan = smoothstep(0.05, 0.0, abs(vY - uScan)) * uScanOn;
    vec3 col = vec3(0.5, 1.0, 0.68) * (fres * 0.32 + lines * fres * 0.12 + scan * fres * 0.6);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Figure({ levels, selected, onSelect, shared }: { levels: Record<MuscleId, Level>; selected: MuscleId | null; onSelect: (m: MuscleId) => void; shared: Shared }) {
  const [hover, setHover] = useState<MuscleId | null>(null);
  const invalidate = useThree((st) => st.invalidate);
  const geos = useMemo(() => {
    const neutralParts = expand(NEUTRAL);
    return {
      neutral: merged(neutralParts),
      muscles: Object.fromEntries(MUSCLE_KEYS.map((id) => [id, merged(expand(MUSCLE_PARTS[id]))])) as Record<MuscleId, THREE.BufferGeometry>,
      // A faint holographic shell: every part slightly inflated, rendered as additive rim light.
      shell: merged([...neutralParts, ...MUSCLE_KEYS.flatMap((id) => expand(MUSCLE_PARTS[id]))], 1.08),
    };
  }, []);
  const neutralMat = useMemo(() => makeMaterial(shared, '#25322b', '#5d9274', 0.08), [shared]);
  const shellMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: SHELL_FRAG,
        uniforms: { uScan: shared.uScan, uScanOn: shared.uScanOn },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [shared],
  );
  const mats = useMemo(() => {
    const out = {} as Record<MuscleId, THREE.ShaderMaterial>;
    for (const id of MUSCLE_KEYS) out[id] = makeMaterial(shared, LEVEL_COLORS[0], '#3d5a49', 0);
    return out;
  }, [shared]);

  useEffect(() => {
    for (const id of MUSCLE_KEYS) {
      const lvl = levels[id] ?? 0;
      const u = mats[id].uniforms;
      u.uColor.value.set(lvl === 0 ? '#1a2420' : LEVEL_COLORS[lvl]);
      u.uRim.value.set(lvl === 0 ? '#3b5a48' : '#b8fcc9');
      u.uEmissive.value = LEVEL_EMISSIVE[lvl];
      u.uSelected.value = selected === id ? 1 : 0;
      u.uHover.value = hover === id ? 1 : 0;
    }
    invalidate(); // on-demand rendering (reduced effects) needs an explicit frame
  }, [levels, selected, hover, mats, invalidate]);

  useEffect(
    () => () => {
      geos.neutral.dispose();
      geos.shell.dispose();
      Object.values(geos.muscles).forEach((g) => g.dispose());
      neutralMat.dispose();
      shellMat.dispose();
      Object.values(mats).forEach((m) => m.dispose());
    },
    [geos, neutralMat, shellMat, mats],
  );

  return (
    <group>
      <mesh geometry={geos.neutral} material={neutralMat} />
      {MUSCLE_KEYS.map((id) => (
        <mesh
          key={id}
          geometry={geos.muscles[id]}
          material={mats[id]}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            if (e.delta < 8) onSelect(id);
          }}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            setHover(id);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHover((h) => (h === id ? null : h));
            document.body.style.cursor = '';
          }}
        />
      ))}
      <mesh geometry={geos.shell} material={shellMat} raycast={() => null} renderOrder={2} />
    </group>
  );
}

/** Moves a DOM label to the selected muscle's on-screen position every frame, without React renders. */
function LabelTracker({ selected, labelRef }: { selected: MuscleId | null; labelRef: React.RefObject<HTMLDivElement | null> }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const el = labelRef.current;
    if (!el) return;
    if (!selected) {
      el.style.opacity = '0';
      return;
    }
    let best: THREE.Vector3 | null = null;
    let bestDist = Infinity;
    for (const a of MUSCLE_ANCHORS[selected]) {
      const d = a.distanceTo(camera.position);
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    if (!best) return;
    v.copy(best).project(camera);
    const x = (v.x * 0.5 + 0.5) * size.width;
    const y = (-v.y * 0.5 + 0.5) * size.height;
    el.style.opacity = '1';
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  });
  return null;
}

function Platform({ shared }: { shared: Shared }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: shared.uTime },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          uniform float uTime; varying vec2 vUv;
          void main(){
            vec2 p = vUv - 0.5; float r = length(p) * 2.0;
            float rings = smoothstep(0.02, 0.0, abs(fract(r * 6.0) - 0.5) - 0.47);
            float a = atan(p.y, p.x);
            float spokes = smoothstep(0.02, 0.0, abs(fract(a / 6.2831 * 24.0) - 0.5) - 0.48) * step(0.35, r);
            float glow = smoothstep(1.0, 0.0, r) * 0.2;
            float sweep = smoothstep(0.25, 0.0, abs(fract(a / 6.2831 - uTime * 0.08) - 0.5) - 0.25) * 0.25 * step(r, 0.95);
            float fade = smoothstep(1.0, 0.75, r);
            float v = (rings * 0.45 + spokes * 0.25 + sweep) * fade + glow;
            gl_FragColor = vec4(vec3(0.42, 0.95, 0.62) * v, v * 0.85);
          }`,
      }),
    [shared],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} material={mat}>
      <circleGeometry args={[0.62, 72]} />
    </mesh>
  );
}

export type ViewSide = 'front' | 'back' | null;

function Rig({ side, onSettled, autoRotate, shared, scan }: { side: ViewSide; onSettled: () => void; autoRotate: boolean; shared: Shared; scan: boolean }) {
  const { camera, gl, invalidate } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const idleSince = useRef(performance.now());

  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enablePan = false;
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.rotateSpeed = 0.75;
    c.zoomSpeed = 0.6;
    c.minDistance = 2.0;
    c.maxDistance = 4.8;
    c.minPolarAngle = Math.PI * 0.28;
    c.maxPolarAngle = Math.PI * 0.62;
    c.target.set(0, 0.9, 0);
    c.autoRotateSpeed = 0.7;
    const start = () => (idleSince.current = Infinity);
    const end = () => (idleSince.current = performance.now());
    c.addEventListener('start', start);
    c.addEventListener('end', end);
    c.addEventListener('change', () => invalidate());
    c.update();
    controls.current = c;
    return () => {
      c.removeEventListener('start', start);
      c.removeEventListener('end', end);
      c.dispose();
    };
  }, [camera, gl, invalidate]);

  useFrame((state, dt) => {
    const c = controls.current;
    if (!c) return;
    shared.uTime.value = state.clock.elapsedTime;
    shared.uScanOn.value = scan ? 1 : 0;
    if (scan) shared.uScan.value = ((state.clock.elapsedTime * 0.45) % 2.4) - 0.2;
    if (side) {
      const goal = side === 'front' ? 0 : Math.PI;
      const cur = c.getAzimuthalAngle();
      let d = goal - cur;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 0.01) onSettled();
      else {
        const off = camera.position.clone().sub(c.target);
        off.applyAxisAngle(new THREE.Vector3(0, 1, 0), d * Math.min(1, dt * 6));
        camera.position.copy(c.target).add(off);
      }
      idleSince.current = performance.now();
    }
    c.autoRotate = autoRotate && !side && performance.now() - idleSince.current > 5000;
    c.update();
  });
  return null;
}

export default function MuscleScene3D({
  levels,
  selected,
  onSelect,
  side,
  onSideSettled,
  effects,
  labelRef,
}: {
  labelRef: React.RefObject<HTMLDivElement | null>;
  levels: Record<MuscleId, Level>;
  selected: MuscleId | null;
  onSelect: (m: MuscleId) => void;
  side: ViewSide;
  onSideSettled: () => void;
  effects: 'full' | 'reduced' | 'minimal';
}) {
  const shared = useMemo<Shared>(() => ({ uTime: { value: 0 }, uScan: { value: -1 }, uScanOn: { value: 0 } }), []);
  const live = effects === 'full';
  return (
    <Canvas
      frameloop={live || side ? 'always' : 'demand'}
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.02, 3.95], fov: 32, near: 0.1, far: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ touchAction: 'none' }}
    >
      <Rig side={side} onSettled={onSideSettled} autoRotate={live && !selected} shared={shared} scan={live} />
      <Figure levels={levels} selected={selected} onSelect={onSelect} shared={shared} />
      <LabelTracker selected={selected} labelRef={labelRef} />
      <Platform shared={shared} />
    </Canvas>
  );
}
