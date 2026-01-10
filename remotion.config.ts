import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.overrideWebpackConfig((currentConfig) => {
  return enableTailwind(currentConfig);
});

// ✔ Correct color space option
Config.setColorSpace("default"); // "srgb" is NOT allowed in v4+

// ✔ Correct video image format (replaces old setImageFormat)
Config.setVideoImageFormat("jpeg");

// ✔ Correct pixel format
Config.setPixelFormat("yuv420p");