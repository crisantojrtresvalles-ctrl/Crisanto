import React, { useMemo } from "react";
import * as THREE from "three";
import type { CharSpec, Vec3 } from "../types";
import type { Atmo } from "../engine/atmosphere";
import { hash } from "../engine/math";
import { poseAt } from "./pose";
import { drawCharacter } from "./draw";
import { softTex } from "../world/textures";

const SIZES = { lo: [288, 432], hi: [576, 864] } as const;
const ASPECT = 2 / 3;

interface Bufs { lo: { cv: HTMLCanvasElement; tx: THREE.CanvasTexture }; hi: { cv: HTMLCanvasElement; tx: THREE.CanvasTexture } }
const mk = (w: number, h: number) => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.generateMipmaps = false; tx.minFilter = THREE.LinearFilter;
  return { cv, tx };
};

export const Character: React.FC<{ spec: CharSpec; t: number; pos: Vec3; cam: Vec3; atmo: Atmo; sway: number }> = ({ spec, t, pos, cam, atmo, sway }) => {
  const bufs = useMemo<Bufs>(() => ({ lo: mk(...SIZES.lo), hi: mk(...SIZES.hi) }), []);
  const seed = useMemo(() => hash(spec.id.length * 7 + spec.id.charCodeAt(0)) * 10, [spec.id]);
  const dx = cam[0] - pos[0], dz = cam[2] - pos[2];
  const dist = Math.hypot(dx, dz, cam[1] - pos[1]);
  if (dist > 90) return null;
  const hi = dist < 15;
  const b = hi ? bufs.hi : bufs.lo;
  const yaw = Math.atan2(dx, dz);
  const { pose, blink } = poseAt(spec.actions, spec.talk, t, seed, sway);
  const right = [Math.cos(yaw), -Math.sin(yaw)];
  const side = Math.sign(atmo.sunDir.x * right[0] + atmo.sunDir.z * right[1] || 1) * spec.facing;
  const sun = atmo.sunCol;
  const amb = atmo.ambSky.clone().multiplyScalar(0.8);
  const bright = Math.min(1, 0.35 + atmo.ambI * 0.5 + atmo.sunI * 0.28);
  const tint = `rgb(${Math.round(amb.r * 255 * 0.5)},${Math.round(amb.g * 255 * 0.55)},${Math.round(amb.b * 255 * 0.7)})`;
  drawCharacter(b.cv.getContext("2d")!, b.cv.width, b.cv.height, spec.look, pose, {
    t, seed, blink, rimCol: `rgba(${Math.round(sun.r * 255)},${Math.round(sun.g * 255)},${Math.round(sun.b * 255)},1)`,
    rimSide: side, tint, tintA: Math.max(0, 0.5 - bright * 0.5), shadeA: 0.22 + 0.2 * (1 - bright),
  });
  b.tx.needsUpdate = true;
  const H = 2.55 * spec.scale * 1.55, W = H * ASPECT;
  return (
    <group position={pos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={[W * 0.9, W * 0.5, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={softTex()} color="#000" transparent opacity={0.42} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, yaw, 0]} position={[0, H / 2, 0]} scale={[spec.facing, 1, 1]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={b.tx} transparent alphaTest={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};
