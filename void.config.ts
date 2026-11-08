import { defineConfig } from "void/config"

/**
 * Deployed as a single-page app on Workers Static Assets: `void deploy` creates the Worker on first run and
 * reuses it afterwards, and the edge serves the app and public/data/ without running any code.
 *
 * voidPlugin() builds the client into dist/client, so the static deploy reads from there. Once the app grows
 * server code (routes/, crons/, db/), remove `inference` and Void deploys the full Worker, provisioning
 * whatever bindings that code uses. (`routing.headers` rules would also route every request through the
 * Worker, so there are none.)
 */
export default defineConfig({
  inference: { appType: "spa", outputDir: "dist/client" },
})
