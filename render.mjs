import path from "path";
import os from "os";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";

async function main() {
  console.log("🚀 Starting render.mjs");

  // ----------------------------------------------------
  // STEP 1: Read environment variables
  // ----------------------------------------------------
  const entry = path.resolve("./src/remotion/index.ts");
  const compositionId = "MyComp";
  const outputLocation = process.env.OUTPUT_PATH || `out/${compositionId}.mp4`;
  const COMPOSITION_PROPS = process.env.COMPOSITION_PROPS;

  if (!outputLocation) {
    console.error("❌ Missing OUTPUT_PATH environment variable.");
    process.exit(1);
  }
  if (!COMPOSITION_PROPS) {
    console.error("❌ Missing COMPOSITION_PROPS environment variable.");
    process.exit(1);
  }

  console.log("🧾 Environment Variables:");
  console.log("OUTPUT_PATH =", outputLocation);
  console.log("COMPOSITION_PROPS =", process.env.COMPOSITION_PROPS);

  // ----------------------------------------------------
  // STEP 2: Parse composition props
  // ----------------------------------------------------
  let inputProps = {};
  
  try {
    const propsData = fs.readFileSync(COMPOSITION_PROPS, "utf-8");
    inputProps = JSON.parse(propsData);
    console.log("📦 Loaded composition props:", inputProps);
  } catch (err) {
    console.error("❌ Failed to load composition props:", err.message);
    process.exit(1);
  }

  try {
    fs.unlinkSync(COMPOSITION_PROPS);
  } catch {}

  // ----------------------------------------------------
  // STEP 3: Bundle Remotion project
  // ----------------------------------------------------
  console.log("🔧 Bundling project...");
  const bundleLocation = await bundle({
    entryPoint: entry,
    webpackOverride: (c) => {
      c.cache = false; // Disable caching
      return c;
    }    
  });

  console.log("📦 Bundle created at:", bundleLocation);

  // ----------------------------------------------------
  // STEP 4: Select composition
  // ----------------------------------------------------
  console.log("🎥 Selecting composition...");
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps, // pass props into composition
  });

  console.log("✅ Composition selected:", {
    id: composition.id,
    durationInFrames: composition.durationInFrames,
    fps: composition.fps,
  });

  // ----------------------------------------------------
  // STEP 5: Render video
  // ----------------------------------------------------
  const concurrency = Math.min(os.cpus().length, 8); // auto-detect up to 8
  console.log(`🎬 Rendering to ${outputLocation} with concurrency = ${concurrency}`);
  console.log("🧠 Final inputProps used:", inputProps);

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation,
    concurrency,
    inputProps,
    onProgress: ({ renderedFrames, stitchStage }) => {
      const pct = (
        (renderedFrames / composition.durationInFrames) *
        100
      ).toFixed(1);
      process.stdout.write(
        `\r⚙️  ${renderedFrames}/${composition.durationInFrames} frames (${pct}%) — stage: ${stitchStage}`
      );
    },
  });

  // ----------------------------------------------------
  // STEP 6: Finish
  // ----------------------------------------------------
  console.log(`\n✅ Done! Video output at ${outputLocation}`);
}

main().catch((err) => {
  console.error("❌ Render failed:", err);
  process.exit(1);
});
