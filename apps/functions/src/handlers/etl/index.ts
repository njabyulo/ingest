import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { Resource } from "sst";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import * as Utils from "@ingest/shared/utils";
import * as Services from "@ingest/core/services";
import * as Repositories from "@ingest/core/repositories";

const s3 = new S3Client({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const app = new Hono();

const fileTypeDetector = new Utils.DetectFileType.FileTypeDetector();

const fileRepository = new Repositories.DynamoFileRepository.DynamoFileRepository({
  tableName: Resource.FilesTable.name,
  dynamoClient,
});

const presignedUrlService = new Services.PresignedUrlService.PresignedUrlService({
  bucketName: Resource.IngestBucket.name,
  s3Client: s3,
  fileTypeDetector,
  fileRepository,
  userId: "default-user", // Will be replaced with auth later
});

// Default userId for MVP (will be replaced with auth later)
const DEFAULT_USER_ID = "default-user";

// POST /v1/files - Request presigned URL for upload
app.post("/v1/files", async (c) => {
  try {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          success: false,
          error: "Invalid or missing request body. Expected JSON with fields: fileName, mimeType, fileSizeBytes",
        },
        400,
      );
    }

    if (!body || typeof body !== "object") {
      return c.json(
        {
          success: false,
          error: "Request body must be a JSON object with fields: fileName, mimeType, fileSizeBytes",
        },
        400,
      );
    }

    const { fileName, mimeType, fileSizeBytes } = body;

    if (!fileName || !mimeType || !fileSizeBytes) {
      return c.json(
        {
          success: false,
          error: "Missing required fields: fileName, mimeType, fileSizeBytes",
        },
        400,
      );
    }

    const result = await presignedUrlService.generateUploadUrl({
      fileName,
      contentType: mimeType,
      size: fileSizeBytes,
    });

    if (!result.success) {
      return c.json(
        { success: false, error: result.error },
        400,
      );
    }

    return c.json(
      {
        success: true,
        fileId: result.fileId,
        uploadUrl: result.uploadUrl,
        expiresIn: result.expiresIn,
        method: result.method || "PUT",
      },
      201,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return c.json(
      { success: false, error: `Internal server error: ${errorMessage}` },
      500,
    );
  }
});

// GET /v1/files/:fileId - Get file metadata
app.get("/v1/files/:fileId", async (c) => {
  try {
    const fileId = c.req.param("fileId");

    if (!fileId) {
      return c.json(
        { success: false, error: "Missing fileId parameter" },
        400,
      );
    }

    // Try to get file by fileId first (using GSI), fallback to userId lookup
    let file = await fileRepository.getFileById(fileId);
    if (!file) {
      file = await fileRepository.getFile(fileId, DEFAULT_USER_ID);
    }

    if (!file) {
      return c.json(
        { success: false, error: "File not found" },
        404,
      );
    }

    return c.json(
      {
        success: true,
        fileId: file.fileId,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        status: file.status,
        s3Key: file.s3Key,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        uploadedAt: file.uploadedAt,
      },
      200,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return c.json(
      { success: false, error: `Internal server error: ${errorMessage}` },
      500,
    );
  }
});

export const handler = handle(app);
