// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../.sst/platform/config.d.ts" />

import * as Network from "../network";

export const web = new sst.aws.StaticSite("Web", {
  path: "./apps/web",
  build: {
    command: "pnpm build",
    output: "dist",
  },
  environment: {
    VITE_API_URL: Network.Api.api.url,
  },
});

