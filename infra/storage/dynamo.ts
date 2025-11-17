// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../.sst/platform/config.d.ts" />

export const filesTable = new sst.aws.Dynamo("FilesTable", {
  fields: {
    PK: "string",
    SK: "string",
    fileId: "string",
    status: "string",
    expiresAt: "string",
  },
  primaryIndex: {
    hashKey: "PK",
    rangeKey: "SK",
  },
  globalIndexes: {
    FileIdIndex: {
      hashKey: "fileId",
    },
    // GSI for efficient querying of expired PENDING_UPLOAD files
    StatusExpiresAtIndex: {
      hashKey: "status",
      rangeKey: "expiresAt",
    },
  },
  // Enable TTL for automatic deletion of expired items
  // TTL attribute: ttl (Unix epoch seconds)
  // DynamoDB will automatically delete items where ttl < current time
  ttl: "ttl",
});

