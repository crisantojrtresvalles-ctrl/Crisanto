import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const frames = process.argv.slice(2).map(Number);
const entry = path.resolve("src/index.ts");
const bundled = await bundle({ entryPoint: entry, onProgress: () => {} });
const browser = await openBrowser("chrome", { browserExecutable: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", chromiumOptions: { gl: "swangle" } });
const comp = await selectComposition({ serveUrl: bundled, id: "History", puppeteerInstance: browser });
fs.mkdirSync("out/stills", { recursive: true });
for (const f of frames) {
  const t0 = Date.now();
  await renderStill({ composition: comp, serveUrl: bundled, output: `out/stills/f${String(f).padStart(4, "0")}.png`, frame: f, puppeteerInstance: browser, imageFormat: "jpeg", jpegQuality: 88, chromiumOptions: { gl: "swangle" }, timeoutInMilliseconds: 120000 });
  console.log("frame", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
await browser.close(() => {}, true);
