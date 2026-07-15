import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: __dirname,
  server: {
    host: true,
    allowedHosts: true
  },
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "../src")
    }
  },
  build: {
    outDir: path.resolve(__dirname, "../dist-web")
  }
});
