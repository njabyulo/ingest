import type { File } from "@ingest/shared/types";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import * as Utils from "@ingest/shared/utils";
import * as Constants from "@ingest/shared/constants";

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
          error: `Unsupported file type: ${request.contentType}. Supported types: PDF, JPEG, PNG`,
        };
      }

      // Validate file type is allowed
      const allowedTypes = [
        ...Constants.File.FILE_CONSTANTS.ALLOWED_PDF_TYPES,
        ...Constants.File.FILE_CONSTANTS.ALLOWED_IMAGE_TYPES,
      ];
      const normalizedContentType = request.contentType.toLowerCase();
      if (!allowedTypes.some((type) => type.toLowerCase() === normalizedContentType)) {
        return {
          success: false,
          error: `Unsupported MIME type: ${request.contentType}. Supported types: ${allowedTypes.join(", ")}`,
        };
      }

      // Validate file size based on type
      const maxSizeBytes =
        fileType === "pdf"
          ? Constants.File.FILE_CONSTANTS.MAX_PDF_SIZE_BYTES
          : Constants.File.FILE_CONSTANTS.MAX_IMAGE_SIZE_BYTES;

      if (request.size > maxSizeBytes) {
        const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
        const fileSizeMB = (request.size / (1024 * 1024)).toFixed(2);
        const typeLabel = fileType === "pdf" ? "PDFs" : "images";
        return {
          success: false,
          error: `File size ${fileSizeMB}MB exceeds maximum allowed size of ${maxSizeMB}MB for ${typeLabel}`,
        };
      }

      const fileId = randomUUID();
      const key = Utils.Aws.generateS3Key(fileType, this.config.userId, fileId, request.fileName);
      const now = new Date().toISOString();

      const expirationSeconds =
        this.config.expirationSeconds || this.defaultExpirationSeconds;
      
      // Calculate expiration timestamp
      const expiresAt = new Date(Date.now() + expirationSeconds * 1000).toISOString();

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
        expiresAt, // Store expiration time for cleanup
      };

      await this.config.fileRepository.createFile(file);

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
        expiresIn: expirationSeconds, // Keep for backward compatibility
        expiresAt,
        maxSizeBytes, // Return the appropriate max size for the file type
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

  async generateDownloadUrl(
    _fileId: string,
    fileName: string,
    s3Key: string,
    expirationSeconds?: number,
  ): Promise<File.IDownloadResponse> {
    try {
      const expiration = expirationSeconds || this.defaultExpirationSeconds;
      const expiresAt = new Date(Date.now() + expiration * 1000).toISOString();

      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: s3Key,
        ResponseContentDisposition: `attachment; filename="${fileName}"`,
      });

      const downloadUrl = await getSignedUrl(
        this.config.s3Client,
        command,
        { expiresIn: expiration },
      );

      return {
        success: true,
        downloadUrl,
        fileName,
        expiresAt,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        success: false,
        error: `Failed to generate download URL: ${errorMessage}`,
      };
    }
  }
}

