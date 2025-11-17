// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

export const bucket = new sst.aws.Bucket("IngestBucket");

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

// Dead Letter Queue for failed S3 event processing
export const s3EventDlq = new sst.aws.Queue("S3EventDlq", {
  visibilityTimeout: "30 seconds",
  // Configure message retention via transform to access underlying SQS resource
  // Keep failed events for 14 days (1209600 seconds) for investigation
  transform: {
    queue: (args, _opts, _name) => {
      args.messageRetentionSeconds = 14 * 24 * 60 * 60; // 14 days in seconds
    },
  },
});