import type { File } from "@ingest/shared/types";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as Utils from "@ingest/shared/utils";
import * as Constants from "@ingest/shared/constants";

export interface IFileUploadServiceConfig {
  bucketName: string;
  s3Client: S3Client;
  fileTypeDetector: File.IFileTypeDetector;
  fileRepository: File.IFileRepository;
  userId: string;
}

export class FileUploadService implements File.IFileUploadService {
  constructor(private readonly config: IFileUploadServiceConfig) {}

  async upload(
    fileId: string,
    fileName: string,
    contentType: string,
    fileContent: Buffer,
    size: number,
  ): Promise<File.IFileUploadResult> {
    try {
      // Validate file type
      const fileType = this.config.fileTypeDetector.detect(contentType, fileName);
      if (fileType === "unknown") {
        return {
          success: false,
          error: `Unsupported file type: ${contentType}. Supported types: PDF, JPEG, PNG`,
        };
      }

      // Validate MIME type is allowed
      const allowedTypes = [
        ...Constants.File.FILE_CONSTANTS.ALLOWED_PDF_TYPES,
        ...Constants.File.FILE_CONSTANTS.ALLOWED_IMAGE_TYPES,
      ];
      const normalizedContentType = contentType.toLowerCase();
      if (!allowedTypes.some((type) => type.toLowerCase() === normalizedContentType)) {
        return {
          success: false,
          error: `Unsupported MIME type: ${contentType}. Supported types: ${allowedTypes.join(", ")}`,
        };
      }

      // Validate file size based on type
      const maxSizeBytes =
        fileType === "pdf"
          ? Constants.File.FILE_CONSTANTS.MAX_PDF_SIZE_BYTES
          : Constants.File.FILE_CONSTANTS.MAX_IMAGE_SIZE_BYTES;

      if (size > maxSizeBytes) {
        const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
        const fileSizeMB = (size / (1024 * 1024)).toFixed(2);
        const typeLabel = fileType === "pdf" ? "PDFs" : "images";
        return {
          success: false,
          error: `File size ${fileSizeMB}MB exceeds maximum allowed size of ${maxSizeMB}MB for ${typeLabel}`,
        };
      }

      const key = Utils.Aws.generateS3Key(fileType, this.config.userId, fileId, fileName);
      const now = new Date().toISOString();

      // Save metadata to DynamoDB with PENDING_UPLOAD status before upload
      const file: File.IFile = {
        fileId,
        userId: this.config.userId,
        fileName,
        mimeType: contentType,
        sizeBytes: size,
        status: "PENDING_UPLOAD",
        s3Bucket: this.config.bucketName,
        s3Key: key,
        createdAt: now,
        updatedAt: now,
      };

      await this.config.fileRepository.createFile(file);

      // Apply same tags as bucket to the object
      const stage = process.env.SST_STAGE || "dev";
      const resourceTags = Utils.Aws.getAwsResourceTags(stage);
      const tags = Utils.Aws.formatS3Tags(resourceTags);

      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
        Tagging: tags,
        Metadata: {
          originalFileName: fileName,
          fileSize: size.toString(),
        },
      });

      await this.config.s3Client.send(command);

      // Update metadata to UPLOADED status after successful upload
      const uploadedAt = new Date().toISOString();
      await this.config.fileRepository.updateFile(fileId, this.config.userId, {
        status: "UPLOADED",
        uploadedAt,
      });

      return {
        success: true,
        fileId,
        key,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        success: false,
        error: `Failed to upload file: ${errorMessage}`,
      };
    }
  }
}

