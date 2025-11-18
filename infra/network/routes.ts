// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../.sst/platform/config.d.ts" />

import * as NetworkApi from "./api";
import * as Compute from "../compute";

// File endpoints
NetworkApi.api.route("POST /v1/files", Compute.Api.uploadRequestFunction.arn);
NetworkApi.api.route("GET /v1/files", Compute.Api.uploadRequestFunction.arn); // List files with pagination
NetworkApi.api.route("GET /v1/files/{fileId}/download", Compute.Api.uploadRequestFunction.arn); // Get presigned download URL
NetworkApi.api.route("GET /v1/files/{fileId}", Compute.Api.uploadRequestFunction.arn); // Get single file metadata

