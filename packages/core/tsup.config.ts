import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/repositories/index.ts",
    "src/repositories/dynamo-file-repository.ts",
    "src/services/index.ts",
    "src/services/presigned-url-service.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
});

