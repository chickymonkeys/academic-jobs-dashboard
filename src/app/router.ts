import { createRouter, createWebHistory } from "vue-router"
import Dashboard from "@/features/layout/Dashboard.vue"

/** One view; everything else is URL search state (see ./search.ts). Unknown paths land on the map. */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "atlas", component: Dashboard },
    { path: "/:pathMatch(.*)*", redirect: (to) => ({ path: "/", query: to.query }) },
  ],
})
