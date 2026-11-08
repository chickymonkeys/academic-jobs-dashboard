import { defineConfig } from "void/config"

/**
 * Void runs the dev server (on Cloudflare's local Workers runtime) and builds the client into dist/client, a
 * single-page app with no server code. The site is published from dist/client to GitHub Pages by
 * .github/workflows/deploy.yml, not with `void deploy`: Void's static deploy routes every request through the
 * Worker (`run_worker_first: true`), so on Workers Free each asset request would count toward the daily limit.
 *
 * Should the app grow server code (routes/, crons/, db/), remove `inference` and deploy the full Worker with
 * `void deploy --platform cloudflare` instead; see "Growing a backend" in the README.
 */
export default defineConfig({
  inference: { appType: "spa", outputDir: "dist/client" },
})
