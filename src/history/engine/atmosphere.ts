import * as THREE from "three";
import type { AtmoKey } from "../types";
import { clamp, lerp, smoothstep } from "./math";

export interface Atmo {
  zenith: THREE.Color; horizon: THREE.Color; fog: THREE.Color; fogD: number;
  sunCol: THREE.Color; sunDir: THREE.Vector3; sunI: number;
  ambSky: THREE.Color; ambGround: THREE.Color; ambI: number;
  cloud: number; storm: number; deep: THREE.Color; shallow: THREE.Color; foam: number;
}
const C = (h: string) => new THREE.Color(h);
export const sampleAtmo = (keys: AtmoKey[], t: number): Atmo => {
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const u = a === b ? 0 : smoothstep(0, 1, clamp((t - a.t) / (b.t - a.t)));
  const col = (x: string, y: string) => C(x).lerp(C(y), u);
  const elev = lerp(a.sunElev, b.sunElev, u);
  const az = lerp(a.sunAz, b.sunAz, u);
  const sunDir = new THREE.Vector3(Math.cos(elev) * Math.sin(az), Math.sin(elev), Math.cos(elev) * Math.cos(az)).normalize();
  return {
    zenith: col(a.zenith, b.zenith), horizon: col(a.horizon, b.horizon), fog: col(a.fog, b.fog),
    fogD: lerp(a.fogD, b.fogD, u), sunCol: col(a.sunCol, b.sunCol), sunDir, sunI: lerp(a.sunI, b.sunI, u),
    ambSky: col(a.ambSky, b.ambSky), ambGround: col(a.ambGround, b.ambGround), ambI: lerp(a.ambI, b.ambI, u),
    cloud: lerp(a.cloud, b.cloud, u), storm: lerp(a.storm, b.storm, u),
    deep: col(a.deep, b.deep), shallow: col(a.shallow, b.shallow), foam: lerp(a.foam, b.foam, u),
  };
};
