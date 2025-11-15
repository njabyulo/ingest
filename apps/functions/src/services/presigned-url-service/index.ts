import type {
  IPresignedUrlService,
  IUploadRequest,
  IUploadResponse,
  IFileTypeDetector,
  TFileType,
} from "@ingest/shared/types/ingest";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import * as Constants from "@ingest/shared/constants/ingest";

export interface IPresignedUrlServiceConfig {
  bucketName: string;
  s3Client: S3Client;
  fileTypeDetector: IFileTypeDetector;
  expirationSeconds?: number;
}

export class PresignedUrlService implements IPresignedUrlService {
  private readonly defaultExpirationSeconds = 300; // 5 minutes

  constructor(private readonly config: IPresignedUrlServiceConfig) {}

  async generateUploadUrl(
    request: IUploadRequest,
  ): Promise<IUploadResponse> {
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
      const key = `pdfs/${fileId}/${request.fileName}`;

      const expirationSeconds =
        this.config.expirationSeconds || this.defaultExpirationSeconds;

      // Apply same tags as bucket to the object
      const stage = process.env.SST_STAGE || "dev";
      const resourceTags = Constants.getAwsResourceTags(stage);
      const tags = Constants.formatS3Tags(resourceTags);

      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        ContentType: request.contentType,
        Tagging: tags,
        Metadata: {
          originalFileName: request.fileName,
          fileSize: request.size.toString(),
        },
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

