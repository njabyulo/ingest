// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.sst/platform/config.d.ts" />

import { bucket, filesTable, s3EventDlq } from "./storage";

export const uploadRequestFunction = new sst.aws.Function("UploadRequestFunction", {
  handler: "./apps/functions/src/handlers/api/files.handler",
  runtime: "nodejs20.x",
  timeout: "30 seconds",
  memory: "512 MB",
  link: [bucket, filesTable],
  environment: {
    SST_STAGE: $app.stage,
  },
});

export const s3EventHandlerFunction = new sst.aws.Function("S3EventHandlerFunction", {
  handler: "./apps/functions/src/handlers/events/file-upload.handler",
  runtime: "nodejs20.x",
  timeout: "30 seconds",
  memory: "512 MB",
  link: [filesTable, s3EventDlq],
  environment: {
    SST_STAGE: $app.stage,
  },
  // Configure Dead Letter Queue for failed event processing
  // Failed events will be sent to DLQ for investigation and potential retry
  transform: {
    function: (args, _opts, _name) => {
      args.deadLetterConfig = {
        targetArn: s3EventDlq.arn,
      };
    },
  },
});

// Subscribe to S3 PutObject events
bucket.notify({
  notifications: [
    {
      name: "FileUploadEvent",
      function: "./apps/functions/src/handlers/events/file-upload.handler",
      events: ["s3:ObjectCreated:Put"],
      filterPrefix: "uploads/",
    },
  ],
});

