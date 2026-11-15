import React, { useMemo } from "react";
import * as THREE from "three";
import type { FxEvent, GullFlock, Transition, Vec3, ShipSpec } from "../types";
import type { Atmo } from "../engine/atmosphere";
import type { CamState } from "../engine/camera";
import { shipLocalToWorld, type ShipState } from "../engine/entities";
import { clamp, hash, lerp } from "../engine/math";
import { flagTex, hullPanelTex, puffTex, sailTex, softTex } from "./textures";

export const Rain: React.FC<{ t: number; cam: Vec3; amount: number }> = ({ t, cam, amount }) => {
  const N = 520;
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 6), 3)); return g; }, []);
  const a = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < N; i++) {
    const x = (hash(i) - 0.5) * 46, z = (hash(i + 500) - 0.5) * 46 + 8;
    const y = 24 - ((hash(i + 900) * 30 + t * 28) % 30);
    const len = 1.1 + hash(i + 77) * 0.9;
    a.setXYZ(i * 2, cam[0] + x, cam[1] + y - 8, cam[2] + z);
    a.setXYZ(i * 2 + 1, cam[0] + x - len * 0.28, cam[1] + y - 8 - len, cam[2] + z);
  }
  a.needsUpdate = true;
  if (amount < 0.05) return null;
  return <lineSegments geometry={geo} frustumCulled={false}><lineBasicMaterial color="#a9bccb" transparent opacity={0.45 * amount} fog={false} /></lineSegments>;
};

const Puffs: React.FC<{ pts: { p: Vec3; s: number; o: number; c: string }[]; add?: boolean }> = ({ pts, add }) => (
  <>
    {pts.map((q, i) => (
      <sprite key={i} position={q.p} scale={[q.s, q.s, 1]}>
        <spriteMaterial map={add ? softTex() : puffTex()} color={q.c} transparent opacity={q.o} depthWrite={false} blending={add ? THREE.AdditiveBlending : THREE.NormalBlending} />
      </sprite>
    ))}
  </>
);

export const BowSpray: React.FC<{ spec: ShipSpec; st: ShipState; t: number; L: number; B: number }> = ({ spec, st, t, L, B }) => {
  const sp = Math.hypot(spec.vel[0], spec.vel[1]);
  const pts = useMemo(() => new Float32Array(40 * 3), []);
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pts, 3)); return g; }, [pts]);
  if (sp < 3) return null;
  const a = geo.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < 40; k++) {
    const ph = (t * 1.4 + hash(k)) % 1, side = k % 2 ? 1 : -1;
    const w = shipLocalToWorld(st, [side * (B * 0.2 + ph * 2.4), 0.2 + Math.sin(ph * Math.PI) * 2.2, L / 2 - 2.2 - ph * 2.5 + hash(k + 5)]);
    a.setXYZ(k, w[0], w[1], w[2]);
  }
  a.needsUpdate = true;
  return <points geometry={geo} frustumCulled={false}><pointsMaterial map={softTex()} size={1.5} color="#eef6fa" transparent opacity={Math.min(0.85, sp * 0.07)} depthWrite={false} /></points>;
};

export const FxEvents: React.FC<{ events: FxEvent[]; t: number; shipAt: (id: string, t: number) => ShipState }> = ({ events, t, shipAt }) => {
  const nodes: React.ReactNode[] = [];
  events.forEach((e, ei) => {
    const age = t - e.t;
    if (age < -0.8 || age > 7) return;
    const base = (): Vec3 => e.ship ? shipLocalToWorld(shipAt(e.ship, e.t), e.local ?? [0, 2, 0]) : e.world ?? [0, 1, 0];
    if (e.kind === "cannon" || e.kind === "muzzle") {
      const p = base(); const d = e.dir ?? [0, 0, 1]; const big = e.kind === "cannon" ? 1 : 0.4;
      const fl = clamp(1 - age / 0.14);
      if (age >= 0 && fl > 0) nodes.push(<Puffs key={"f" + ei} add pts={[{ p: [p[0] + d[0], p[1] + d[1], p[2] + d[2]], s: 7 * big * (0.6 + fl), o: fl, c: "#ffc15a" }, { p: [p[0] + d[0] * 0.4, p[1], p[2] + d[2] * 0.4], s: 3.2 * big, o: fl, c: "#fff3c4" }]} />);
      if (age >= 0.05) {
        const pts: { p: Vec3; s: number; o: number; c: string }[] = [];
        for (let k = 0; k < 7; k++) { const ph = clamp((age - 0.05) / (3.2 + hash(k + ei) * 1.2)); const sp = (4 + hash(k) * 4) * big; pts.push({ p: [p[0] + d[0] * (1 + ph * sp) + (hash(k + 2) - 0.5) * 2, p[1] + ph * 3 + 0.5, p[2] + d[2] * (1 + ph * sp) + (hash(k + 4) - 0.5) * 2], s: (2.2 + ph * 7) * big * (0.7 + hash(k + 8)), o: 0.75 * (1 - ph) * (1 - ph), c: "#cfcac2" }); }
        nodes.push(<Puffs key={"s" + ei} pts={pts} />);
      }
    } else if (e.kind === "splash") {
      const p = e.world ?? base();
      if (age >= 0 && age < 2) {
        const pts: { p: Vec3; s: number; o: number; c: string }[] = [];
        for (let k = 0; k < 16; k++) { const a = hash(k + ei) * 6.28, r = hash(k + 3) * 2.2 * clamp(age * 2), up = Math.sin(clamp(age / 1.2) * Math.PI) * (3 + hash(k + 9) * 5) * (1 - r * 0.15); pts.push({ p: [p[0] + Math.cos(a) * r, p[1] + Math.max(0, up), p[2] + Math.sin(a) * r], s: 1.4 + hash(k) * 1.4, o: 0.8 * (1 - age / 2), c: "#f4fbff" }); }
        nodes.push(<Puffs key={"p" + ei} pts={pts} />);
      }
    } else if (e.kind === "debris") {
      const p = base();
      if (age >= 0 && age < 2.5) {
        const pts: { p: Vec3; s: number; o: number; c: string }[] = [];
        for (let k = 0; k < 14; k++) { const vx = (hash(k + ei) - 0.5) * 9, vz = (hash(k + 30) - 0.5) * 9, vy = 3 + hash(k + 50) * 7; pts.push({ p: [p[0] + vx * age, p[1] + vy * age - 9 * age * age * 0.5, p[2] + vz * age], s: 0.5 + hash(k) * 0.5, o: 1, c: "#6b4a2b" }); }
        nodes.push(<Puffs key={"d" + ei} pts={pts} />);
      }
    }
  });
  return <>{nodes}</>;
};

export const Grapples: React.FC<{ events: FxEvent[]; t: number; shipAt: (id: string, t: number) => ShipState }> = ({ events, t, shipAt }) => {
  const list = events.filter((e) => e.kind === "grapple" && e.ship && e.target && t >= e.t && t < e.t + 6);
  return (
    <>
      {list.map((e, i) => {
        const A = shipLocalToWorld(shipAt(e.ship!, t), e.local ?? [0, 3, 0]);
        const B = shipLocalToWorld(shipAt(e.target!, t), e.dir ?? [0, 3, 0]);
        const p = clamp((t - e.t) / 0.55);
        const pts: number[] = [];
        for (let k = 0; k <= 14; k++) {
          const u = (k / 14) * p;
          const sag = (1 - p) * 0 + Math.sin((k / 14) * Math.PI) * (p < 1 ? 2.4 * (1 - p) + 0.35 : 0.35);
          pts.push(lerp(A[0], B[0], u), lerp(A[1], B[1], u) + Math.sin(u * Math.PI) * 2.2 * (1 - p * 0.7) - sag * 0.6, lerp(A[2], B[2], u));
        }
        const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        const hook = pts.slice(-3);
        return (
          <group key={i}>
            <primitive object={new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#3a2a1a" }))} />
            <mesh position={[hook[0], hook[1], hook[2]]}><octahedronGeometry args={[0.28, 0]} /><meshBasicMaterial color="#222" /></mesh>
          </group>
        );
      })}
    </>
  );
};

export const Gulls: React.FC<{ flocks: GullFlock[]; t: number }> = ({ flocks, t }) => {
  const wing = useMemo(() => { const g = new THREE.PlaneGeometry(1.1, 0.32); g.translate(0.55, 0, 0); return g; }, []);
  const out: React.ReactNode[] = [];
  flocks.forEach((f, fi) => {
    for (let i = 0; i < f.n; i++) {
      const ph = hash(i + f.seed) * 6.28, ang = t * f.speed + ph, r = f.r * (0.6 + 0.5 * hash(i + 7 + f.seed));
      const x = f.at[0] + Math.cos(ang) * r, z = f.at[2] + Math.sin(ang) * r, y = f.at[1] + Math.sin(t * 0.8 + ph) * 2.2 + hash(i) * 4;
      const head = -ang + Math.PI;
      const flap = Math.sin(t * 8 + ph * 3) * 0.55;
      out.push(
        <group key={fi + "-" + i} position={[x, y, z]} rotation={[0, head, 0]} scale={1.1}>
          <mesh geometry={wing} rotation={[0, 0, flap]}><meshBasicMaterial color="#f3f3ee" side={THREE.DoubleSide} /></mesh>
          <mesh geometry={wing} rotation={[0, Math.PI, -flap]}><meshBasicMaterial color="#f3f3ee" side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, 0, 0.1]}><boxGeometry args={[0.22, 0.2, 0.7]} /><meshBasicMaterial color="#dcdcd6" /></mesh>
          <mesh position={[0, 0, 0.5]}><boxGeometry args={[0.07, 0.07, 0.25]} /><meshBasicMaterial color="#e8a43a" /></mesh>
        </group>,
      );
    }
  });
  return <>{out}</>;
};

export const Bolt: React.FC<{ t0: number; t: number; at: Vec3; seed: number }> = ({ t0, t, at, seed }) => {
  const age = t - t0;
  if (age < 0 || age > 0.35) return null;
  const pts: number[] = []; let x = at[0], z = at[2];
  for (let k = 0; k < 14; k++) { pts.push(x, at[1] + 160 - k * 12, z); x += (hash(k + seed) - 0.5) * 16; z += (hash(k + seed + 40) - 0.5) * 6; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return <primitive object={new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#e7efff", fog: false, transparent: true, opacity: 1 - age / 0.35 }))} />;
};

export const Wipes: React.FC<{ list: Transition[]; t: number; cam: CamState; atmo: Atmo }> = ({ list, t, cam, atmo }) => {
  const w = list.find((x) => t >= x.t - x.dur / 2 && t <= x.t + x.dur / 2);
  if (!w) return null;
  const p = (t - (w.t - w.dur / 2)) / w.dur;
  const f = new THREE.Vector3(cam.look[0] - cam.pos[0], cam.look[1] - cam.pos[1], cam.look[2] - cam.pos[2]).normalize();
  const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
  const u = new THREE.Vector3().crossVectors(r, f).normalize();
  const m = new THREE.Matrix4().makeBasis(r, u, f.clone().negate());
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  const d = 1.2;
  const X = lerp(3.4, -3.4, p) * w.dir;
  const place = (x: number, y: number, z = d): [number, number, number] => [cam.pos[0] + f.x * z + r.x * x + u.x * y, cam.pos[1] + f.y * z + r.y * x + u.y * y, cam.pos[2] + f.z * z + r.z * x + u.z * y];
  const lit = new THREE.Color().copy(atmo.ambSky).multiplyScalar(0.7).add(atmo.sunCol.clone().multiplyScalar(0.28 * atmo.sunI));
  const col = "#" + lit.clone().multiplyScalar(1.2).getHexString();
  if (w.kind === "sail" || w.kind === "hull") {
    const tex = w.kind === "sail" ? sailTex(true) : hullPanelTex();
    return (
      <mesh position={place(X, Math.sin(p * 6) * 0.05)} quaternion={q} renderOrder={100}>
        <planeGeometry args={[3.6, 3.4]} />
        <meshBasicMaterial map={tex} color={col} depthTest={false} fog={false} side={THREE.DoubleSide} />
      </mesh>
    );
  }
  if (w.kind === "gulls") {
    return <>{Array.from({ length: 9 }).map((_, i) => <mesh key={i} position={place(lerp(2.2, -2.2, p) * w.dir + (hash(i) - 0.5) * 1.6, (hash(i + 9) - 0.3) * 1.2, 0.8 + hash(i) * 0.7)} quaternion={q} renderOrder={100} rotation={[0, 0, Math.sin(t * 14 + i) * 0.4]}><planeGeometry args={[0.4, 0.12]} /><meshBasicMaterial color="#f2f2ee" depthTest={false} fog={false} /></mesh>)}</>;
  }
  const smoke = w.kind === "smoke";
  return (
    <>
      {Array.from({ length: 16 }).map((_, i) => {
        const o = (hash(i) - 0.5) * 2.4, y = (hash(i + 20) - 0.5) * 2.6;
        const xs = X * (0.6 + hash(i + 40) * 0.8) + o * 0.7;
        const op = smoke ? 0.98 : 0.95;
        return (
          <sprite key={i} position={place(xs, y, 1.0 + hash(i + 3) * 0.4)} scale={[2.4 + hash(i + 5) * 1.4, 2.4 + hash(i + 7) * 1.4, 1]} renderOrder={100}>
            <spriteMaterial map={softTex()} color={smoke ? "#3a3938" : "#eef4f7"} transparent opacity={op} depthTest={false} depthWrite={false} fog={false} />
          </sprite>
        );
      })}
    </>
  );
};
void flagTex;
