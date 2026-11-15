import React, { useMemo } from "react";
import * as THREE from "three";
import type { Atmo } from "../engine/atmosphere";
import type { ShipState } from "../engine/entities";
import { WAVES, waveScale } from "./waves";

const MAXS = 6;
const vert = /* glsl */ `
uniform float uTime; uniform float uAmp; uniform vec3 uCenter;
uniform vec4 uWA[4]; uniform vec4 uWB[4];
varying vec3 vW; varying float vH;
void main(){
  vec3 p = position; p.x += uCenter.x; p.z += uCenter.z;
  float h = 0.0;
  for(int i=0;i<4;i++){
    float ph = uWA[i].z*(uWA[i].x*p.x+uWA[i].y*p.z) - uWB[i].x*uTime + uWB[i].y;
    h += uWA[i].w*uAmp*sin(ph);
  }
  p.y = h; vW = p; vH = h;
  gl_Position = projectionMatrix*viewMatrix*vec4(p,1.0);
}`;
const frag = /* glsl */ `
uniform float uTime; uniform float uAmp; uniform float uFoam; uniform float uStorm;
uniform vec4 uWA[4]; uniform vec4 uWB[4];
uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uHorizon; uniform vec3 uZenith;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uFog; uniform float uFogD; uniform float uFlash;
uniform vec4 uShip[${MAXS}]; uniform vec2 uShipB[${MAXS}];
varying vec3 vW; varying float vH;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
void main(){
  vec3 toCam = cameraPosition - vW; float dist = length(toCam); vec3 V = toCam/dist;
  vec2 g = vec2(0.0);
  for(int i=0;i<4;i++){
    float ph = uWA[i].z*(uWA[i].x*vW.x+uWA[i].y*vW.z) - uWB[i].x*uTime + uWB[i].y;
    float c = cos(ph)*uWA[i].z*uWA[i].w*uAmp;
    g += c*vec2(uWA[i].x,uWA[i].y);
  }
  vec2 q = vW.xz*1.1 + vec2(uTime*0.7,-uTime*0.45);
  float e = 0.12; float n0 = vn(q); float nx = vn(q+vec2(e,0.0)); float nz = vn(q+vec2(0.0,e));
  float near = 1.0-smoothstep(25.0,220.0,dist);
  vec2 rg = vec2(nx-n0,nz-n0)/e*0.16*near*(0.6+uStorm);
  vec3 N = normalize(vec3(-g.x-rg.x,1.0,-g.y-rg.y));
  float fres = 0.03 + 0.97*pow(1.0-max(dot(N,V),0.0),4.5);
  vec3 R = reflect(-V,N); R.y = abs(R.y);
  vec3 sky = mix(uHorizon,uZenith,pow(clamp(R.y,0.0,1.0),0.55));
  float sunAmt = pow(max(dot(R,uSunDir),0.0),160.0);
  float depthMix = clamp(vH*0.32/uAmp+0.45+N.x*0.1,0.0,1.0);
  vec3 body = mix(uDeep,uShallow,depthMix*depthMix);
  float diff = clamp(dot(N,uSunDir)*0.5+0.5,0.0,1.0);
  body *= 0.55+0.6*diff;
  vec3 col = mix(body,sky,fres);
  col += uSunCol*sunAmt*1.6;
  // foam on crests
  float cn = vn(vW.xz*0.8+vec2(uTime*0.3,0.0));
  float crest = smoothstep(0.55*uAmp+0.2,1.25*uAmp+0.35,vH+cn*0.45*uAmp);
  float foam = crest*uFoam;
  // ship hull foam + wakes
  for(int i=0;i<${MAXS};i++){
    vec4 s = uShip[i]; if(s.w<0.5) continue;
    vec2 d = vW.xz-s.xy; float hd = s.z;
    float along = d.x*sin(hd)+d.y*cos(hd); float across = d.x*cos(hd)-d.y*sin(hd);
    float L = s.w; float hb = uShipB[i].y; float sp = uShipB[i].x;
    float inside = smoothstep(L*0.5+2.5,L*0.5-0.5,abs(along))*smoothstep(hb+1.6,hb*0.6,abs(across));
    float back = -along-L*0.35;
    float wk = step(0.0,back)*smoothstep(75.0,0.0,back)*smoothstep(hb*1.2+back*0.22+0.8,hb*0.5,abs(across));
    float stripes = 0.55+0.45*vn(vec2(back*0.6-uTime*2.0,across*1.7));
    float bow = smoothstep(L*0.5+3.0,L*0.5-1.0,along)*smoothstep(L*0.2,L*0.5,along)*smoothstep(hb*1.3,0.0,abs(across));
    foam += (inside*0.75 + wk*stripes*clamp(sp*0.12,0.1,1.0) + bow*clamp(sp*0.1,0.0,0.8));
  }
  foam = clamp(foam,0.0,1.0);
  col = mix(col,vec3(0.92,0.95,0.97)*(0.55+0.45*length(uSunCol)),foam*0.85);
  col += uFlash*vec3(0.55,0.6,0.7)*fres;
  float f = 1.0-exp(-pow(dist*uFogD,2.0));
  col = mix(col,uFog,clamp(f,0.0,1.0));
  gl_FragColor = vec4(col,1.0);
  #include <colorspace_fragment>
}`;

const buildPolar = () => {
  const R = 84;
  const S = 168;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= R; i++) {
    const r = i === 0 ? 0 : 0.5 * Math.pow(2600 / 0.5, i / R);
    for (let j = 0; j < (i === 0 ? 1 : S); j++) {
      const a = (j / S) * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  const ring = (i: number, j: number) => (i === 0 ? 0 : 1 + (i - 1) * S + (((j % S) + S) % S));
  for (let j = 0; j < S; j++) idx.push(0, ring(1, j + 1), ring(1, j));
  for (let i = 1; i < R; i++)
    for (let j = 0; j < S; j++) {
      const a = ring(i, j), b = ring(i, j + 1), c = ring(i + 1, j), d = ring(i + 1, j + 1);
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
};

export const Ocean: React.FC<{ t: number; cam: THREE.Vector3; atmo: Atmo; ships: { st: ShipState; L: number; B: number }[]; flash: number }> = ({ t, cam, atmo, ships, flash }) => {
  const geo = useMemo(buildPolar, []);
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 }, uAmp: { value: 1 }, uFoam: { value: 0.6 }, uStorm: { value: 0 }, uFlash: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uWA: { value: WAVES.map((w) => new THREE.Vector4(w.dx, w.dz, w.k, w.a)) },
        uWB: { value: WAVES.map((w) => new THREE.Vector4(w.w, w.p, 0, 0)) },
        uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
        uFog: { value: new THREE.Color() }, uFogD: { value: 0.004 },
        uShip: { value: Array.from({ length: MAXS }, () => new THREE.Vector4(0, 0, 0, 0)) },
        uShipB: { value: Array.from({ length: MAXS }, () => new THREE.Vector2(0, 0)) },
      },
    });
    return m;
  }, []);
  const u = mat.uniforms;
  u.uTime.value = t; u.uAmp.value = waveScale(atmo.storm); u.uFoam.value = atmo.foam; u.uStorm.value = atmo.storm; u.uFlash.value = flash;
  u.uCenter.value.set(cam.x, 0, cam.z);
  u.uDeep.value.copy(atmo.deep); u.uShallow.value.copy(atmo.shallow);
  u.uHorizon.value.copy(atmo.horizon); u.uZenith.value.copy(atmo.zenith);
  u.uSunDir.value.copy(atmo.sunDir); u.uSunCol.value.copy(atmo.sunCol);
  u.uFog.value.copy(atmo.fog); u.uFogD.value = atmo.fogD;
  const near = [...ships].sort((a, b) => Math.hypot(a.st.x - cam.x, a.st.z - cam.z) - Math.hypot(b.st.x - cam.x, b.st.z - cam.z)).slice(0, MAXS);
  for (let i = 0; i < MAXS; i++) {
    const s = near[i];
    if (!s) { u.uShip.value[i].set(0, 0, 0, 0); continue; }
    const sp = Math.hypot(Math.sin(s.st.heading), Math.cos(s.st.heading));
    u.uShip.value[i].set(s.st.x, s.st.z, s.st.heading, s.L * s.st.scale);
    u.uShipB.value[i].set(sp * 7, s.B * s.st.scale * 0.5);
  }
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={0} />;
};
