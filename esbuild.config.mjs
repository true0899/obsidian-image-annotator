import esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

const production = process.argv[2] === "production";
const outdir = "dist";
mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  platform: "browser",
  target: "es2018",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  logLevel: "info",
  outfile: `${outdir}/main.js`
});

copyFileSync("manifest.json", `${outdir}/manifest.json`);
copyFileSync("styles.css", `${outdir}/styles.css`);
