import type { File } from "@ingest/shared/types";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import * as Utils from "@ingest/shared/utils";

export interface IPresignedUrlServiceConfig {
  bucketName: string;
  s3Client: S3Client;
  fileTypeDetector: File.IFileTypeDetector;
  fileRepository: File.IFileRepository;
  userId: string;
  expirationSeconds?: number;
}

export class PresignedUrlService implements File.IPresignedUrlService {
  private readonly defaultExpirationSeconds = 300; // 5 minutes

  constructor(private readonly config: IPresignedUrlServiceConfig) {}

  async generateUploadUrl(
    request: File.IUploadRequest,
  ): Promise<File.IUploadResponse> {
    try {
      const fileType = this.config.fileTypeDetector.detect(
        request.contentType,
        request.fileName,
      );

      if (fileType === "unknown") {
        return {
          success: false,
          error: `Unsupported file type: ${request.contentType}`,
        };
      }

      // Only allow PDF for now
      if (fileType !== "pdf") {
        return {
          success: false,
          error: `Only PDF files are supported. Received: ${fileType}`,
        };
      }

      const fileId = randomUUID();
      const key = Utils.Aws.generateS3Key(this.config.userId, fileId, request.fileName);
      const now = new Date().toISOString();

      // Save metadata to DynamoDB before generating presigned URL
      const file: File.IFile = {
        fileId,
        userId: this.config.userId,
        fileName: request.fileName,
        mimeType: request.contentType,
        sizeBytes: request.size,
        status: "PENDING_UPLOAD",
        s3Bucket: this.config.bucketName,
        s3Key: key,
        createdAt: now,
        updatedAt: now,
      };

      await this.config.fileRepository.createFile(file);

      const expirationSeconds =
        this.config.expirationSeconds || this.defaultExpirationSeconds;

      // Apply same tags as bucket to the object
      const stage = process.env.SST_STAGE || "dev";
      const resourceTags = Utils.Aws.getAwsResourceTags(stage);
      const tags = Utils.Aws.formatS3Tags(resourceTags);

      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        ContentType: request.contentType,
        Tagging: tags,
        Metadata: {
          originalFileName: request.fileName,
          fileSize: request.size.toString(),
        },
        // Don't include checksum in presigned URL - client may not calculate it correctly
        // Checksum can be added by client if needed for verification
      });

      const uploadUrl = await getSignedUrl(
        this.config.s3Client,
        command,
        { expiresIn: expirationSeconds },
      );

      return {
        success: true,
        uploadUrl,
        fileId,
        expiresIn: expirationSeconds,
        // Note: Use PUT method (not GET) when uploading to the presigned URL
        method: "PUT",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        success: false,
        error: `Failed to generate upload URL: ${errorMessage}`,
      };
    }
  }
}

