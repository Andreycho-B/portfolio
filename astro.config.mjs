import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.andreyrondon.dev",
  trailingSlash: "never",
  integrations: [sitemap()],
  devToolbar: {
    enabled: false,
  },
  vite: {
    optimizeDeps: {
      include: [
        "@ybouane/liquidglass",
        "gsap",
        "lenis",
        "matter-js",
        "three",
        "three/examples/jsm/loaders/GLTFLoader.js",
        "three/examples/jsm/loaders/HDRLoader.js",
        "three/examples/jsm/utils/BufferGeometryUtils.js",
      ],
    },
  },
});
