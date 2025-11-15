import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { Resource } from "sst";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import * as Validators from "../../validators";
import * as Utils from "@ingest/shared/utils/ingest";
import * as Constants from "@ingest/shared/constants/ingest";

const s3 = new S3Client({});
const app = new Hono();

const sizeValidator = new Validators.SizeValidator.SizeValidator({
  maxSizeBytes: Constants.INGEST_CONSTANTS.MAX_PDF_SIZE_BYTES,
});

const fileTypeDetector = new Utils.FileTypeDetector.FileTypeDetector();

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

    const command = new PutObjectCommand({
      Bucket: Resource.IngestBucket.name,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
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

export const handler = handle(app);
