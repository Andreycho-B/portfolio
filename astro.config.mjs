import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.andreyrondon.dev",
  integrations: [sitemap()],
  devToolbar: {
    enabled: false,
  },
});
