// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { uploadRequestFunction } from "./compute";

export const api = new sst.aws.ApiGatewayV2("IngestApi", {
  cors: {
    allowOrigins: ["*"],
    allowMethods: ["POST", "GET", "OPTIONS", "PUT"],
    allowHeaders: ["Content-Type"],
  },
});

// File endpoints
api.route("POST /v1/files", uploadRequestFunction.arn);
api.route("GET /v1/files", uploadRequestFunction.arn); // List files with pagination
api.route("GET /v1/files/{fileId}", uploadRequestFunction.arn); // Get single file metadata