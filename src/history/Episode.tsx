import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import type { Episode as Ep } from "./types";
import { makeResolver, SHIP_DIMS } from "./engine/entities";
import { cameraBlur, sampleCamera, type CamState } from "./engine/camera";
import { sampleAtmo, type Atmo } from "./engine/atmosphere";
import { clamp } from "./engine/math";
import { Ocean } from "./world/Ocean";
import { Sky } from "./world/Sky";
import { Ship } from "./world/Ship";
import { Island } from "./world/Island";
import { Character } from "./characters/Character";
import { BowSpray, Bolt, FxEvents, Grapples, Gulls, Rain, Wipes } from "./world/Effects";
import { Callouts, Subtitles, TitleCard, Vignette } from "./Overlays";
import { AudioLayer } from "./AudioLayer";

const CamSetter: React.FC<{ cam: CamState; atmo: Atmo }> = ({ cam, atmo }) => {
  const { camera, scene } = useThree();
  const fog = useMemo(() => new THREE.FogExp2("#888888", 0.004), []);
  scene.fog = fog;
  fog.color.copy(atmo.fog); fog.density = atmo.fogD;
  const c = camera as THREE.PerspectiveCamera;
  c.near = 0.25; c.far = 3200;
  c.position.set(...cam.pos);
  c.up.set(0, 1, 0);
  c.lookAt(...cam.look);
  if (cam.roll) c.rotateZ(cam.roll);
  c.fov = cam.fov;
  c.updateProjectionMatrix();
  c.updateMatrixWorld();
  return null;
};

const lightning = (ep: Ep, t: number) => {
  let f = 0;
  for (const e of ep.fx) if (e.kind === "lightning") {
    const a = t - e.t;
    if (a >= 0 && a < 0.7) f = Math.max(f, a < 0.07 ? a / 0.07 : Math.exp(-(a - 0.07) * 9), a > 0.2 && a < 0.3 ? 0.8 : 0);
  }
  return Math.min(1.2, f);
};

export const EpisodeView: React.FC<{ episode: Ep; durations: Record<string, number> | null; audio: boolean; plain?: boolean }> = ({ episode: ep, durations, audio, plain }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const R = useMemo(() => makeResolver(ep), [ep]);
  const atmo = sampleAtmo(ep.atmo, t);
  const cam = sampleCamera(ep.cameras, t, R, ep.shakes);
  const blur = cameraBlur(ep.cameras, t, R, height, ep.shakes);
  const flash = lightning(ep, t);
  const shipsNow = ep.ships.map((spec) => ({ spec, st: R.shipAt(spec.id, t) }));
  const camV = new THREE.Vector3(...cam.pos);
  const blurOn = blur.x + blur.y > 0.8;
  const fadeOut = clamp((t - (ep.durationSec - 0.55)) / 0.5);
  const fadeIn = 1 - clamp(t / 0.35);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id="mb" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={`${blur.x.toFixed(2)} ${blur.y.toFixed(2)}`} edgeMode="duplicate" />
        </filter>
      </svg>
      <div style={{ position: "absolute", inset: 0, filter: blurOn ? "url(#mb)" : "none", transform: blurOn ? "scale(1.05)" : "none" }}>
        <ThreeCanvas width={width} height={height} camera={{ fov: 50, near: 0.25, far: 3200, position: [0, 2, 0] }} gl={{ antialias: true }}>
          <CamSetter cam={cam} atmo={atmo} />
          <hemisphereLight args={[atmo.ambSky, atmo.ambGround, atmo.ambI * (1 + flash)]} />
          <directionalLight position={[atmo.sunDir.x * 200, atmo.sunDir.y * 200, atmo.sunDir.z * 200]} color={atmo.sunCol} intensity={atmo.sunI + flash * 1.5} />
          <Sky t={t} atmo={atmo} flash={flash} />
          <Ocean t={t} cam={camV} atmo={atmo} flash={flash} ships={shipsNow.map((s) => ({ st: s.st, L: SHIP_DIMS[s.spec.kind].L, B: SHIP_DIMS[s.spec.kind].B }))} />
          {ep.islands.map((i) => <Island key={i.id} spec={i} t={t} />)}
          {shipsNow.map(({ spec, st }) => (
            <React.Fragment key={spec.id}>
              <Ship spec={spec} t={t} st={st} />
              <BowSpray spec={spec} st={st} t={t} L={SHIP_DIMS[spec.kind].L} B={SHIP_DIMS[spec.kind].B} />
            </React.Fragment>
          ))}
          {ep.chars.map((c) => {
            const pos = R.charWorld(c, t);
            const sway = c.ship ? R.shipAt(c.ship, t).roll : 0;
            return <Character key={c.id} spec={c} t={t} pos={pos} cam={cam.pos} atmo={atmo} sway={sway} />;
          })}
          <FxEvents events={ep.fx} t={t} shipAt={R.shipAt} />
          <Grapples events={ep.fx} t={t} shipAt={R.shipAt} />
          <Gulls flocks={ep.gulls} t={t} />
          {ep.fx.filter((e) => e.kind === "lightning").map((e, i) => <Bolt key={i} t0={e.t} t={t} at={e.world ?? [0, 0, 300]} seed={i * 9} />)}
          <Rain t={t} cam={cam.pos} amount={Math.max(0, atmo.storm - 0.25)} />
          <Wipes list={ep.transitions} t={t} cam={cam} atmo={atmo} />
        </ThreeCanvas>
      </div>
      {!plain && (
        <>
          <Vignette />
          <TitleCard t={t} />
          <Callouts t={t} list={ep.callouts} />
          <Subtitles t={t} lines={ep.narration} durations={durations} />
          <div style={{ position: "absolute", inset: 0, background: "#000", opacity: Math.max(fadeOut, fadeIn), pointerEvents: "none" }} />
        </>
      )}
      {audio && durations && <AudioLayer ep={ep} durations={durations} />}
    </AbsoluteFill>
  );
};
