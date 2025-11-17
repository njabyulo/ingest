// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

export const bucket = new sst.aws.Bucket("IngestBucket");

export const filesTable = new sst.aws.Dynamo("FilesTable", {
  fields: {
    PK: "string",
    SK: "string",
    fileId: "string",
  },
  primaryIndex: {
    hashKey: "PK",
    rangeKey: "SK",
  },
  globalIndexes: {
    FileIdIndex: {
      hashKey: "fileId",
    },
  },
});