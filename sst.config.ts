// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "ingest",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    // Storage
    await import("./infra/storage");
    
    // Compute
    await import("./infra/compute");
    
    // Networking (must be after compute)
    await import("./infra/network");

    return {};
  },
});
