import { createRequire } from "node:module";
import path from "node:path";
const root = process.cwd();
const toolchain = process.env.REMOTION_TOOLCHAIN_DIR;
if (!toolchain)
  throw new Error(
    "Set REMOTION_TOOLCHAIN_DIR to a directory with Remotion 4.0.484 installed.",
  );
const require = createRequire(path.resolve(toolchain, "package.json"));
const { bundle } = require("@remotion/bundler");
const { renderMedia, selectComposition } = require("@remotion/renderer");
const modules = path.resolve(toolchain, "node_modules");
const serveUrl = await bundle({
  entryPoint: path.join(root, "scripts/homepage-media/composition.jsx"),
  publicDir: path.join(root, ".artifacts/homepage-film/public"),
  outDir: path.join(root, ".artifacts/homepage-film/bundle"),
  webpackOverride: (c) => ({
    ...c,
    resolve: {
      ...c.resolve,
      modules: [modules, ...(c.resolve.modules || [])],
      alias: {
        ...c.resolve.alias,
        react: path.join(modules, "react"),
        "react-dom": path.join(modules, "react-dom"),
        remotion: path.join(modules, "remotion"),
      },
    },
  }),
});
const browserExecutable =
  process.env.REMOTION_BROWSER ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = { serveUrl, browserExecutable };
const composition = await selectComposition({ ...base, id: "Homepage" });
await renderMedia({
  ...base,
  composition,
  codec: "h264",
  pixelFormat: "yuv420p",
  crf: 23,
  concurrency: 3,
  outputLocation: path.join(root, "public/media/home-demo/scribix-hero-v5.mp4"),
  onProgress: ({ progress }) => {
    if (Math.floor(progress * 100) % 20 === 0) process.stdout.write(".");
  },
});
console.log("\nFilm rendered");

await import("./deliver.mjs");
