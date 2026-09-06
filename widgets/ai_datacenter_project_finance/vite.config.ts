import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const packageDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(packageDir, "src/model.ts"),
      formats: ["es"],
      fileName: () => "ai-datacenter-project-finance-widget.js",
    },
    outDir: resolve(
      packageDir,
      "../../docs/javascripts/ai_datacenter_project_finance_widget",
    ),
  },
});
