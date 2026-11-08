import { defineConfig } from "void/config"

/**
 * Deployed as a single-page app on Workers Static Assets: `void deploy` creates the Worker on first run and
 * reuses it afterwards. Void's static deploy routes every request through a small edge Worker
 * (`run_worker_first: true`), so each request counts toward the Workers Free daily limit: fine for the
 * personal, unlisted deployment this is (see "Personal use only" in the README), not for public traffic.
 *
 * voidPlugin() builds the client into dist/client, so the static deploy reads from there. Once the app grows
 * server code (routes/, crons/, db/), remove `inference` and Void deploys the full Worker, provisioning
 * whatever bindings that code uses.
 */
export default defineConfig({
  inference: { appType: "spa", outputDir: "dist/client" },
})
