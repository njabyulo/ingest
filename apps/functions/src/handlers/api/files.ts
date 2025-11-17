import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { Resource } from "sst";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import * as Utils from "@ingest/shared/utils";
import * as Services from "@ingest/core/services";
import * as Repositories from "@ingest/core/repositories";
import * as Constants from "@ingest/shared/constants";

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

    // Validate MIME type: Only application/pdf allowed in v1
    if (mimeType !== "application/pdf") {
      return c.json(
        {
          success: false,
          error: `Only application/pdf files are allowed in v1. Received: ${mimeType}`,
        },
        400,
      );
    }

    // Validate file size
    if (fileSizeBytes > Constants.File.FILE_CONSTANTS.MAX_PDF_SIZE_BYTES) {
      const maxSizeMB = (Constants.File.FILE_CONSTANTS.MAX_PDF_SIZE_BYTES / (1024 * 1024)).toFixed(2);
      const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);
      return c.json(
        {
          success: false,
          error: `File size ${fileSizeMB}MB exceeds maximum allowed size of ${maxSizeMB}MB`,
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
        expiresAt: result.expiresAt,
        maxSizeBytes: result.maxSizeBytes,
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

// GET /v1/files - List files for current user with pagination
// Query parameters: limit (default 20, max 100), cursor (optional)
// Returns: files array, nextCursor (if more results exist)
app.get("/v1/files", async (c) => {
  try {
    // Parse query parameters
    const limitParam = c.req.query("limit");
    const cursor = c.req.query("cursor");

    // Validate and parse limit (default 20, max 100)
    let limit = 20;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return c.json(
          { success: false, error: "Invalid limit parameter. Must be a positive integer." },
          400,
        );
      }
      limit = Math.min(parsedLimit, 100); // Cap at 100
    }

    // List files for the current user
    const result = await fileRepository.listFiles(DEFAULT_USER_ID, limit, cursor);

    // Transform files to match API response format (id, name instead of fileId, fileName)
    const files = result.files.map((file) => ({
      id: file.fileId,
      name: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      status: file.status,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      uploadedAt: file.uploadedAt,
    }));

    return c.json(
      {
        success: true,
        files,
        ...(result.nextCursor && { nextCursor: result.nextCursor }),
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

// GET /v1/files/:fileId - Get file metadata
// Returns: id, name, mimeType, sizeBytes, status, timestamps (createdAt, updatedAt, uploadedAt)
// Performance: Optimized for p95 < 150ms using DynamoDB GSI query
app.get("/v1/files/:fileId", async (c) => {
  try {
    const fileId = c.req.param("fileId");

    if (!fileId) {
      return c.json(
        { success: false, error: "Missing fileId parameter" },
        400,
      );
    }

    // Optimized: Use GSI query first (fastest path for fileId lookup)
    // Falls back to userId lookup only if GSI query fails (backward compatibility)
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

    // Return metadata matching acceptance criteria: id, name, mimeType, sizeBytes, status, timestamps
    return c.json(
      {
        success: true,
        id: file.fileId,
        name: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        status: file.status,
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
