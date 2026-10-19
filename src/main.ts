import "./assets/main.css"
import { createApp } from "vue"
import ui from "@nuxt/ui/vue-plugin"
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query"
import App from "./App.vue"
import { router } from "./app/router"

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } },
})

createApp(App).use(router).use(ui).use(VueQueryPlugin, { queryClient }).mount("#app")
