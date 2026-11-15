import React, { useMemo } from "react";
import * as THREE from "three";
import type { Atmo } from "../engine/atmosphere";

const vert = `varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix*viewMatrix*vec4(position+cameraPosition,1.0); gl_Position = p.xyww; }`;
const frag = /* glsl */ `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uFog; uniform vec3 uSunDir; uniform vec3 uSunCol;
uniform float uCloud; uniform float uStorm; uniform float uTime; uniform float uFlash;
varying vec3 vD;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=0.5; float s=0.0; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
void main(){
  vec3 d = normalize(vD); float h = d.y;
  vec3 col = mix(uHorizon,uZenith,pow(clamp(h,0.0,1.0),0.5));
  float sd = max(dot(d,uSunDir),0.0);
  col += uSunCol*(pow(sd,900.0)*4.0+pow(sd,18.0)*0.45+pow(sd,3.0)*0.12);
  vec2 p = d.xz/(max(h,0.0)+0.16)*0.85+vec2(uTime*0.012,uTime*0.004);
  float n = fbm(p*1.3);
  float lo = 1.0-uCloud-0.08; float c = smoothstep(lo,lo+0.28,n)*smoothstep(-0.02,0.16,h);
  vec3 lit = mix(vec3(0.95,0.93,0.9),uSunCol,0.55);
  vec3 dark = mix(vec3(0.5,0.55,0.62),vec3(0.07,0.09,0.12),uStorm);
  float edge = smoothstep(lo+0.05,lo+0.35,n);
  vec3 cc = mix(lit*(0.65+0.5*pow(sd,2.0)),dark,clamp(edge*(0.35+0.65*uStorm),0.0,1.0));
  col = mix(col,cc,c*(0.55+0.4*uStorm));
  col = mix(col,uFog,smoothstep(0.12,-0.02,h));
  col += uFlash*vec3(0.75,0.82,1.0)*(0.25+c*0.9);
  gl_FragColor = vec4(col,1.0);
  #include <colorspace_fragment>
}`;
export const Sky: React.FC<{ t: number; atmo: Atmo; flash: number }> = ({ t, atmo, flash }) => {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uFog: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
      uCloud: { value: 0.5 }, uStorm: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 },
    },
  }), []);
  const u = mat.uniforms;
  u.uZenith.value.copy(atmo.zenith); u.uHorizon.value.copy(atmo.horizon); u.uFog.value.copy(atmo.fog);
  u.uSunDir.value.copy(atmo.sunDir); u.uSunCol.value.copy(atmo.sunCol);
  u.uCloud.value = atmo.cloud; u.uStorm.value = atmo.storm; u.uTime.value = t; u.uFlash.value = flash;
  return (
    <mesh renderOrder={-10} frustumCulled={false} material={mat}>
      <sphereGeometry args={[900, 32, 20]} />
    </mesh>
  );
};
