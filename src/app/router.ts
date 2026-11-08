import { createRouter, createWebHistory } from "vue-router"
import Dashboard from "@/features/layout/Dashboard.vue"

/**
 * One view; everything else is URL search state (see ./search.ts). Unknown paths land on the map. Paths are relative
 * to Vite's `base`, so "/" is the site's own root, not the domain's.
 */
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "atlas", component: Dashboard },
    { path: "/:pathMatch(.*)*", redirect: (to) => ({ path: "/", query: to.query }) },
  ],
})
