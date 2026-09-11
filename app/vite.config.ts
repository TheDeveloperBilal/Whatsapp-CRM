import path from "path"
import { spawn, type ChildProcess } from "child_process"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// Start the portal backend (Baileys WhatsApp engine + AI bot + WS) alongside
// the dev server, so `npm run dev` is the only command needed.
function portalBackend(): Plugin {
  let child: ChildProcess | null = null
  return {
    name: "portal-backend",
    configureServer() {
      if (child) return
      const entry = path.resolve(__dirname, "server/src/index.js")
      child = spawn(process.execPath, [entry], {
        stdio: "inherit",
        env: { ...process.env },
      })
      child.on("exit", () => { child = null })
      const stop = () => { child?.kill() }
      process.on("exit", stop)
      process.on("SIGINT", stop)
      process.on("SIGTERM", stop)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react(), portalBackend()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
