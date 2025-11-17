// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../.sst/platform/config.d.ts" />

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

