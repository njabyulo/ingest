import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Services from "../../services";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as Utils from "@ingest/shared/utils";
import { createMockFileTypeDetector, createMockFileRepository, testFixtures } from "../helpers/mocks";

// Mock AWS SDK modules
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
}));

vi.mock("@ingest/shared/utils", () => ({
  Aws: {
    generateS3Key: vi.fn((userId: string, fileId: string, fileName: string) => 
      `uploads/${userId}/2024/01/15/${fileId}.pdf`
    ),
    getAwsResourceTags: vi.fn(() => ({ Project: "ingest", Environment: "test" })),
    formatS3Tags: vi.fn(() => "Project=ingest&Environment=test"),
  },
}));

describe("FileUploadService", () => {
  let service: Services.FileUploadService.FileUploadService;
  let mockS3Client: S3Client;
  let mockFileTypeDetector: ReturnType<typeof createMockFileTypeDetector>;
  let mockFileRepository: ReturnType<typeof createMockFileRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockS3Client = {
      send: vi.fn(),
    } as unknown as S3Client;
    mockFileTypeDetector = createMockFileTypeDetector();
    mockFileRepository = createMockFileRepository();

    service = new Services.FileUploadService.FileUploadService({
      bucketName: "test-bucket",
      s3Client: mockS3Client,
      fileTypeDetector: mockFileTypeDetector,
      fileRepository: mockFileRepository,
      userId: "test-user",
    });

    // Default mock implementations
    vi.mocked(mockS3Client.send).mockResolvedValue({});
    vi.mocked(mockFileRepository.createFile).mockResolvedValue(undefined);
    vi.mocked(mockFileRepository.updateFile).mockResolvedValue(undefined);
  });

  describe("upload - Valid PDF upload", () => {
    it("should successfully upload a valid PDF file", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      const fileId = "test-file-id";
      const fileName = "test.pdf";
      const contentType = "application/pdf";
      const fileContent = Buffer.from("test content");
      const size = 1024;

      // Act
      const result = await service.upload(fileId, fileName, contentType, fileContent, size);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.fileId).toBe(fileId);
        expect(result.key).toBeDefined();
      }

      // Verify file was created in repository with PENDING_UPLOAD status
      expect(mockFileRepository.createFile).toHaveBeenCalledTimes(1);
      const createFileCall = vi.mocked(mockFileRepository.createFile).mock.calls[0][0];
      expect(createFileCall.status).toBe("PENDING_UPLOAD");
      expect(createFileCall.mimeType).toBe(contentType);
      expect(createFileCall.sizeBytes).toBe(size);

      // Verify S3 upload was called
      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: "test-bucket",
          Body: fileContent,
          ContentType: contentType,
        })
      );

      // Verify file status was updated to UPLOADED
      expect(mockFileRepository.updateFile).toHaveBeenCalledTimes(1);
      const updateFileCall = vi.mocked(mockFileRepository.updateFile).mock.calls[0];
      expect(updateFileCall[0]).toBe(fileId);
      expect(updateFileCall[1]).toBe("test-user");
      expect(updateFileCall[2]).toMatchObject({
        status: "UPLOADED",
        uploadedAt: expect.any(String),
      });
    });

    it("should generate correct S3 key pattern", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      const fileId = "test-file-id";
      const fileName = "document.pdf";

      // Act
      await service.upload(fileId, fileName, "application/pdf", Buffer.from("content"), 1024);

      // Assert
      expect(Utils.Aws.generateS3Key).toHaveBeenCalledWith(
        "test-user",
        fileId,
        fileName
      );
    });

    it("should apply S3 tags to uploaded object", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      const fileId = "test-file-id";

      // Act
      await service.upload(fileId, "test.pdf", "application/pdf", Buffer.from("content"), 1024);

      // Assert
      expect(Utils.Aws.getAwsResourceTags).toHaveBeenCalled();
      expect(Utils.Aws.formatS3Tags).toHaveBeenCalled();
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Tagging: expect.any(String),
        })
      );
    });

    it("should set S3 object metadata", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      const fileId = "test-file-id";
      const fileName = "test.pdf";
      const size = 2048;

      // Act
      await service.upload(fileId, fileName, "application/pdf", Buffer.from("content"), size);

      // Assert
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Metadata: {
            originalFileName: fileName,
            fileSize: size.toString(),
          },
        })
      );
    });
  });

  describe("upload - Invalid file types", () => {
    it("should reject non-PDF files", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("image");
      const fileId = "test-file-id";

      // Act
      const result = await service.upload(
        fileId,
        "test.jpg",
        "image/jpeg",
        Buffer.from("content"),
        1024
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Only PDF files are supported");
        expect(result.error).toContain("image");
      }

      // Verify file was NOT created in repository
      expect(mockFileRepository.createFile).not.toHaveBeenCalled();
      expect(mockS3Client.send).not.toHaveBeenCalled();
    });

    it("should reject unknown file types", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("unknown");
      const fileId = "test-file-id";

      // Act
      const result = await service.upload(
        fileId,
        "test.txt",
        "text/plain",
        Buffer.from("content"),
        1024
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Only PDF files are supported");
      }

      // Verify file was NOT created in repository
      expect(mockFileRepository.createFile).not.toHaveBeenCalled();
      expect(mockS3Client.send).not.toHaveBeenCalled();
    });
  });

  describe("upload - Error handling", () => {
    it("should handle repository createFile errors", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      vi.mocked(mockFileRepository.createFile).mockRejectedValue(
        new Error("DynamoDB connection failed")
      );
      const fileId = "test-file-id";

      // Act
      const result = await service.upload(
        fileId,
        "test.pdf",
        "application/pdf",
        Buffer.from("content"),
        1024
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Failed to upload file");
        expect(result.error).toContain("DynamoDB connection failed");
      }

      // Verify S3 upload was NOT attempted
      expect(mockS3Client.send).not.toHaveBeenCalled();
    });

    it("should handle S3 upload errors", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      vi.mocked(mockS3Client.send).mockRejectedValue(new Error("S3 service unavailable"));
      const fileId = "test-file-id";

      // Act
      const result = await service.upload(
        fileId,
        "test.pdf",
        "application/pdf",
        Buffer.from("content"),
        1024
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Failed to upload file");
        expect(result.error).toContain("S3 service unavailable");
      }

      // Verify file was created but status update was NOT called (upload failed)
      expect(mockFileRepository.createFile).toHaveBeenCalled();
      expect(mockFileRepository.updateFile).not.toHaveBeenCalled();
    });

    it("should handle repository updateFile errors", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      vi.mocked(mockFileRepository.updateFile).mockRejectedValue(
        new Error("DynamoDB update failed")
      );
      const fileId = "test-file-id";

      // Act
      const result = await service.upload(
        fileId,
        "test.pdf",
        "application/pdf",
        Buffer.from("content"),
        1024
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Failed to upload file");
        expect(result.error).toContain("DynamoDB update failed");
      }

      // Verify S3 upload succeeded but status update failed
      expect(mockS3Client.send).toHaveBeenCalled();
      expect(mockFileRepository.updateFile).toHaveBeenCalled();
    });

    it("should handle non-Error exceptions", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      vi.mocked(mockS3Client.send).mockRejectedValue("String error");

      // Act
      const result = await service.upload(
        "test-file-id",
        "test.pdf",
        "application/pdf",
        Buffer.from("content"),
        1024
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Failed to upload file");
        expect(result.error).toContain("Unknown error occurred");
      }
    });
  });

  describe("upload - File metadata", () => {
    it("should set createdAt and updatedAt timestamps", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      const fileId = "test-file-id";
      const beforeTime = new Date().toISOString();

      // Act
      await service.upload(fileId, "test.pdf", "application/pdf", Buffer.from("content"), 1024);

      // Assert
      const createFileCall = vi.mocked(mockFileRepository.createFile).mock.calls[0][0];
      expect(createFileCall.createdAt).toBeDefined();
      expect(createFileCall.updatedAt).toBeDefined();
      expect(new Date(createFileCall.createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTime).getTime()
      );
    });

    it("should include all required file metadata fields", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      const fileId = "test-file-id";
      const fileName = "test.pdf";
      const contentType = "application/pdf";
      const size = 1024;

      // Act
      await service.upload(fileId, fileName, contentType, Buffer.from("content"), size);

      // Assert
      const createFileCall = vi.mocked(mockFileRepository.createFile).mock.calls[0][0];
      expect(createFileCall.fileId).toBe(fileId);
      expect(createFileCall.userId).toBe("test-user");
      expect(createFileCall.fileName).toBe(fileName);
      expect(createFileCall.mimeType).toBe(contentType);
      expect(createFileCall.sizeBytes).toBe(size);
      expect(createFileCall.s3Bucket).toBe("test-bucket");
      expect(createFileCall.s3Key).toBeDefined();
    });
  });
});

