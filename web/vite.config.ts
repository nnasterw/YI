import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "../src")
    }
  },
  build: {
    outDir: path.resolve(__dirname, "../dist-web")
  }
});
