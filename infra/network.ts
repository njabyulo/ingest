/// <reference path="../.sst/platform/config.d.ts" />

import { uploadRequestFunction } from "./compute";

export const api = new sst.aws.ApiGatewayV2("IngestApi", {
  cors: {
    allowOrigins: ["*"],
    allowMethods: ["POST", "OPTIONS", "PUT"],
    allowHeaders: ["Content-Type"],
  },
});

api.route("POST /upload", uploadRequestFunction.arn);