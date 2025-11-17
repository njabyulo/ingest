// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../.sst/platform/config.d.ts" />

export const api = new sst.aws.ApiGatewayV2("IngestApi", {
  cors: {
    allowOrigins: ["*"],
    allowMethods: ["POST", "GET", "OPTIONS", "PUT"],
    allowHeaders: ["Content-Type"],
  },
});