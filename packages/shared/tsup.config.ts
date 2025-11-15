import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/types/index.ts",
    "src/types/ingest/index.ts",
    "src/types/ingest/validators/index.ts",
    "src/utils/index.ts",
    "src/utils/ingest/index.ts",
    "src/utils/ingest/file-type-detector/index.ts",
    "src/schemas/index.ts",
    "src/constants/index.ts",
    "src/constants/ingest/index.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
});

