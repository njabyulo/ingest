/// <reference path="../.sst/platform/config.d.ts" />

export const bucket = new sst.aws.Bucket("IngestBucket", {
  tags: {
    Project: "ingest",
    Environment: $app.stage,
    ManagedBy: "sst",
  },
});