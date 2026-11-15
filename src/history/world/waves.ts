export const WAVES = [
  { dx: 0.958, dz: 0.287, k: 0.165, a: 0.9, w: 1.27, p: 0.0 },
  { dx: 0.371, dz: 0.928, k: 0.286, a: 0.5, w: 1.67, p: 1.7 },
  { dx: -0.6, dz: 0.8, k: 0.483, a: 0.28, w: 2.18, p: 3.1 },
  { dx: 0.913, dz: -0.406, k: 0.9, a: 0.12, w: 2.97, p: 5.2 },
];
export const waveScale = (storm: number) => 0.75 + storm * 1.25;
export const waveHeight = (x: number, z: number, t: number, storm: number) => {
  let h = 0;
  for (const w of WAVES) h += w.a * Math.sin(w.k * (w.dx * x + w.dz * z) - w.w * t + w.p);
  return h * waveScale(storm);
};
