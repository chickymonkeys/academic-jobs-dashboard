import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router"
import { Dashboard } from "@/features/layout/Dashboard"
import { searchSchema } from "./search"

const rootRoute = createRootRoute({ component: Outlet })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: searchSchema,
  component: Dashboard,
})

export const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
