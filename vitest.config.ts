import path from "path";
import { defineConfig } from "vitest/config";

// web/src/renderer.ts 用 "@core/*" 别名引用引擎源码（与 web/vite.config.ts 保持
// 一致），测试层需要同样的别名才能直接对 renderReport 做端到端渲染断言。
export default defineConfig({
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "src")
    }
  }
});
