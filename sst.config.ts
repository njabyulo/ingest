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
    
    // Events (DLQ, EventBridge, etc.)
    await import("./infra/events");
    
    // Compute (Lambda functions)
    await import("./infra/compute");
    
    // Networking - API Gateway (must be after compute for function ARNs)
    await import("./infra/network/api");
    
    // Networking - Routes (must be after both compute and network/api)
    await import("./infra/network/routes");
    
    // Frontend (must be after network for API URL)
    await import("./infra/frontend");

    return {};
  },
});
