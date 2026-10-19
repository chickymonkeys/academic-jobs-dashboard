import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import ui from "@nuxt/ui/vite"
import { voidPlugin } from "void"

export default defineConfig({
  plugins: [
    voidPlugin(),
    vue(),
    ui({
      ui: { colors: { primary: "blue", neutral: "slate" } },
      // Bundle the Lucide icons the app uses instead of fetching them from the Iconify API at runtime
      icon: { clientBundle: { scan: true } },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        // The map engine rarely changes; its own chunk stays cached across deploys of app code
        codeSplitting: {
          groups: [{ name: "map", test: /node_modules[\\/](maplibre-gl|@deck\.gl|@luma\.gl|@loaders\.gl|@math\.gl|@probe\.gl|supercluster)/ }],
        },
      },
    },
  },
})
