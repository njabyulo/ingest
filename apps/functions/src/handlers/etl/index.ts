import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { Resource } from "sst";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import * as Constants from "@ingest/shared/constants";
import * as Utils from "@ingest/shared/utils";
import * as Services from "@ingest/core/services";
import * as Repositories from "@ingest/core/repositories";

const s3 = new S3Client({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const app = new Hono();

const sizeValidator = new Utils.ValidateFileSize.ValidateFileSize({
  maxSizeBytes: Constants.File.FILE_CONSTANTS.MAX_PDF_SIZE_BYTES,
});

const fileTypeDetector = new Utils.DetectFileType.FileTypeDetector();

const fileRepository = new Repositories.DynamoFileRepository.DynamoFileRepository({
  tableName: Resource.FilesTable.name,
  dynamoClient,
});

// Default userId for MVP (will be replaced with auth later)
const DEFAULT_USER_ID = "default-user";

app.post("/upload", async (c) => {
  try {
    // Parse file from form data
    const formData = await c.req.parseBody();
    const file = formData.file as File | undefined;

    if (!file) {
      return c.json(
        { success: false, error: "Missing file in form data. Expected field name: 'file'" },
        400,
      );
    }

    const fileName = file.name || "upload.pdf";
    const contentType = file.type || "application/pdf";
    const fileArrayBuffer = await file.arrayBuffer();
    const fileContent = Buffer.from(fileArrayBuffer);
    const size = fileContent.length;

    // Validate file type
    const fileType = fileTypeDetector.detect(contentType, fileName);
    if (fileType !== "pdf") {
      return c.json(
        { success: false, error: `Only PDF files are supported. Received: ${fileType}` },
        400,
      );
    }

    // Validate file size
    const validationResult = await sizeValidator.validate({
      fileName,
      contentType,
      size,
      fileContent,
    });
    if (!validationResult.valid) {
      return c.json(
        { success: false, error: validationResult.error || "Validation failed" },
        400,
      );
    }

    // Upload to S3
    const fileId = randomUUID();
    const key = `pdfs/${fileId}/${fileName}`;

    // Apply same tags as bucket to the object
    const stage = process.env.SST_STAGE || "dev";
    const resourceTags = Utils.Aws.getAwsResourceTags(stage);
    const tags = Utils.Aws.formatS3Tags(resourceTags);

    const command = new PutObjectCommand({
      Bucket: Resource.IngestBucket.name,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      Tagging: tags,
      Metadata: {
        originalFileName: fileName,
        fileSize: size.toString(),
      },
    });

    await s3.send(command);

    return c.json(
      {
        success: true,
        fileId,
        fileName,
        size,
        contentType,
        key,
        message: "File uploaded successfully",
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

// POST /v1/files - Request presigned URL for upload
app.post("/v1/files", async (c) => {
  try {
    const body = await c.req.json();
    const { fileName, mimeType, fileSizeBytes } = body;

    if (!fileName || !mimeType || !fileSizeBytes) {
      return c.json(
        { success: false, error: "Missing required fields: fileName, mimeType, fileSizeBytes" },
        400,
      );
    }

    const presignedUrlService = new Services.PresignedUrlService.PresignedUrlService({
      bucketName: Resource.IngestBucket.name,
      s3Client: s3,
      fileTypeDetector,
      fileRepository,
      userId: DEFAULT_USER_ID,
    });

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

// GET /v1/files/{fileId} - Get file metadata
app.get("/v1/files/:fileId", async (c) => {
  try {
    const fileId = c.req.param("fileId");

    if (!fileId) {
      return c.json(
        { success: false, error: "Missing fileId parameter" },
        400,
      );
    }

    const file = await fileRepository.getFile(fileId, DEFAULT_USER_ID);

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
