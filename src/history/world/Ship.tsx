import React, { useMemo } from "react";
import * as THREE from "three";
import type { ShipSpec, FlagKind } from "../types";
import type { ShipState } from "../engine/entities";
import { clamp, ease, hash, lerp } from "../engine/math";
import { buildShip, type ShipParts, type SailDef } from "./shipGeometry";
import { flagTex, sailTex, softTex } from "./textures";

const partsCache = new Map<string, ShipParts>();
const getParts = (k: string) => {
  let p = partsCache.get(k);
  if (!p) { p = buildShip(k as never); partsCache.set(k, p); }
  return p;
};

const gridGeo = (n: number, m: number) => {
  const pos = new Float32Array((n + 1) * (m + 1) * 3);
  const uv = new Float32Array((n + 1) * (m + 1) * 2);
  const idx: number[] = [];
  for (let j = 0; j <= m; j++) for (let i = 0; i <= n; i++) { const k = j * (n + 1) + i; uv[k * 2] = i / n; uv[k * 2 + 1] = 1 - j / m; }
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; idx.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
};

const fillSail = (g: THREE.BufferGeometry, s: SailDef, t: number, wind: number, drop: number) => {
  const [p00, p10, p01, p11] = s.corners.map((c) => new THREE.Vector3(...c));
  const pos = g.attributes.position as THREE.BufferAttribute;
  const dir = new THREE.Vector3(...s.dir);
  for (let j = 0; j <= s.m; j++) for (let i = 0; i <= s.n; i++) {
    const u = i / s.n, v = j / s.m;
    const top = p00.clone().lerp(p10, u), bot = p01.clone().lerp(p11, u);
    const p = top.lerp(bot, v);
    const sh = Math.sin(Math.PI * u) * Math.pow(Math.sin(Math.PI * Math.min(1, v * 0.9 + 0.1)), 0.8);
    const flutter = 0.82 + 0.18 * Math.sin(t * 2.6 + s.phase + u * 5 + v * 3);
    p.addScaledVector(dir, s.bulge * wind * sh * flutter * (1 - drop * 0.8));
    p.y -= drop * v * 1.6;
    pos.setXYZ(j * (s.n + 1) + i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
};

const Sail: React.FC<{ def: SailDef; t: number; wind: number; drop: number; tex: THREE.Texture }> = ({ def, t, wind, drop, tex }) => {
  const geo = useMemo(() => gridGeo(def.n, def.m), [def.n, def.m]);
  fillSail(geo, def, t, wind, drop);
  return (
    <mesh geometry={geo} frustumCulled={false}>
      <meshLambertMaterial map={tex} side={THREE.DoubleSide} emissive="#3a3020" emissiveIntensity={0.5} />
    </mesh>
  );
};

const Flag: React.FC<{ kind: FlagKind; y: number; parts: ShipParts; t: number; seed: number }> = ({ kind, y, parts, t, seed }) => {
  const n = 9, m = 4;
  const geo = useMemo(() => gridGeo(n, m), []);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const { flagLen: len, flagH: h } = parts;
  const z0 = parts.flagTop[2];
  for (let j = 0; j <= m; j++) for (let i = 0; i <= n; i++) {
    const u = i / n, v = j / m;
    const w = Math.sin(u * 7 - t * 9 + seed) * 0.32 * u * (0.7 + 0.3 * Math.sin(t * 3.1));
    pos.setXYZ(j * (n + 1) + i, w, y - v * h, z0 + 0.1 + u * len);
  }
  pos.needsUpdate = true; geo.computeVertexNormals();
  return (
    <group>
      <mesh geometry={geo} frustumCulled={false}><meshLambertMaterial map={flagTex(kind)} side={THREE.DoubleSide} emissive="#222" emissiveIntensity={0.35} /></mesh>
    </group>
  );
};

export const flagList = (s: ShipSpec, t: number): { kind: FlagKind; h: number }[] => {
  const base = s.flag ?? "none";
  const r = s.flagRise;
  const baseH = r ? ease("out", clamp((t - r[0]) / (r[1] - r[0]))) : 1;
  const out: { kind: FlagKind; h: number }[] = [];
  if (s.flagSwap) {
    const ts = s.flagSwap.t;
    if (base !== "none") out.push({ kind: base, h: Math.min(baseH, 1 - ease("in", clamp((t - (ts - 0.9)) / 0.9))) });
    out.push({ kind: s.flagSwap.kind, h: ease("out", clamp((t - ts) / 1.0)) });
  } else if (base !== "none") out.push({ kind: base, h: baseH });
  return out.filter((f) => f.h > 0.02);
};

export const Ship: React.FC<{ spec: ShipSpec; t: number; st: ShipState }> = ({ spec, t, st }) => {
  const parts = getParts(spec.kind);
  const wind = spec.billow ?? 0.85;
  const sailTx = sailTex(false);
  const patchTx = sailTex(true);
  const brk = spec.mastBreak;
  const p = brk ? clamp((t - brk.t) / 1.15) : 0;
  const fall = ease("in", p);
  const open = spec.portsOpen;
  const portsGeo = useMemo(() => new THREE.PlaneGeometry(1.05, 0.9), []);
  const barrelGeo = useMemo(() => { const g = new THREE.CylinderGeometry(0.2, 0.28, 1.7, 8); g.rotateZ(Math.PI / 2); return g; }, []);
  const linesGeo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(parts.lines, 3)); return g; }, [parts]);
  const nP = parts.ports.length;
  const setPorts = (im: THREE.InstancedMesh | null, barrels: boolean) => {
    if (!im) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pp = new THREE.Vector3(), sc = new THREE.Vector3();
    parts.ports.forEach((po, i) => {
      const k = po.idx / 20;
      const pr = open ? ease("out", clamp((t - open[0] - k * (open[1] - open[0]) * 0.7) / 0.45)) : spec.kind === "qar" ? 1 : 0;
      q.setFromEuler(new THREE.Euler(0, po.rotY, 0));
      const out = Math.sign(po.pos[0]);
      if (barrels) { pp.set(po.pos[0] + out * (0.2 + 0.55 * pr), po.pos[1], po.pos[2]); sc.set(pr, pr, pr); }
      else { pp.set(po.pos[0], po.pos[1], po.pos[2]); sc.set(1, pr, 1); }
      m.compose(pp, q, sc);
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
  };
  const flags = flagList(spec, t);
  const hasPorts = nP > 0;
  const lantern = spec.kind !== "sloop";
  const sailsByMast = (mi: number, drop: number) => parts.sails.filter((s) => s.mast === mi).map((s, i) => <Sail key={mi + "-" + i} def={s} t={t} wind={wind} drop={drop} tex={s.patch ? patchTx : sailTx} />);
  return (
    <group position={[st.x, st.y, st.z]} rotation={st.euler} scale={st.scale}>
      <mesh geometry={parts.hull}><meshLambertMaterial vertexColors side={THREE.DoubleSide} flatShading /></mesh>
      <mesh geometry={parts.props}><meshLambertMaterial vertexColors flatShading /></mesh>
      <mesh geometry={parts.glow}><meshBasicMaterial vertexColors /></mesh>
      {hasPorts && <instancedMesh args={[portsGeo, undefined, nP]} ref={(m) => setPorts(m as THREE.InstancedMesh, false)} frustumCulled={false}><meshBasicMaterial color="#050403" side={THREE.DoubleSide} /></instancedMesh>}
      {hasPorts && <instancedMesh args={[barrelGeo, undefined, nP]} ref={(m) => setPorts(m as THREE.InstancedMesh, true)} frustumCulled={false}><meshLambertMaterial color="#202226" flatShading /></instancedMesh>}
      {parts.masts.map((ms, mi) => {
        const broken = brk && brk.mast === mi;
        const base: [number, number, number] = [0, ms.top - 12, ms.z];
        return (
          <group key={mi} position={broken ? base : [0, 0, 0]} rotation={broken ? [0.25 * fall, 0, -0.95 * fall] : [0, 0, 0]}>
            <group position={broken ? [-base[0], -base[1] - 0.5 * fall, -base[2]] : [0, 0, 0]}>
              <mesh geometry={ms.geo}><meshLambertMaterial vertexColors flatShading /></mesh>
              {sailsByMast(mi, broken ? fall : 0)}
            </group>
          </group>
        );
      })}
      {parts.sails.filter((s) => s.mast === 0 && spec.kind !== "sloop" && s.corners[0][2] > 10).length === 0 ? null : null}
      <lineSegments geometry={linesGeo} frustumCulled={false}><lineBasicMaterial color="#1e1812" /></lineSegments>
      {flags.map((f, i) => <Flag key={i + f.kind} kind={f.kind} y={lerp(parts.flagBase[1], parts.flagTop[1] - 0.2, f.h)} parts={parts} t={t} seed={(spec.seed ?? 1) + hash(i) * 3} />)}
      {lantern && [-1, 1].map((sg) => (
        <sprite key={sg} position={[sg * parts.B * 0.36, 7.4, -parts.L / 2 + 0.2]} scale={[3.4, 3.4, 1]}>
          <spriteMaterial map={softTex()} color="#ffb040" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
};
