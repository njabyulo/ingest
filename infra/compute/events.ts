// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../.sst/platform/config.d.ts" />

import * as Storage from "../storage";
import * as Events from "../events";

export const s3EventHandlerFunction = new sst.aws.Function("S3EventHandlerFunction", {
  handler: "./apps/functions/src/handlers/events/file-upload.handler",
  runtime: "nodejs20.x",
  timeout: "30 seconds",
  memory: "512 MB",
  link: [Storage.S3.bucket, Storage.Dynamo.filesTable, Events.Queue.s3EventDlq],
  environment: {
    SST_STAGE: $app.stage,
  },
  // Configure Dead Letter Queue for failed event processing
  // Failed events will be sent to DLQ for investigation and potential retry
  transform: {
    function: (args, _opts, _name) => {
      args.deadLetterConfig = {
        targetArn: Events.Queue.s3EventDlq.arn,
      };
    },
  },
});

// Subscribe to S3 PutObject events
// Use the function ARN instead of handler path for proper event subscription
// Listen for type-based prefixes (pdf/, images/)
Storage.S3.bucket.notify({
  notifications: [
    {
      name: "FileUploadEventPdf",
      function: s3EventHandlerFunction.arn,
      events: ["s3:ObjectCreated:Put"],
      filterPrefix: "pdf/",
    },
    {
      name: "FileUploadEventImages",
      function: s3EventHandlerFunction.arn,
      events: ["s3:ObjectCreated:Put"],
      filterPrefix: "images/",
    },
  ],
});

