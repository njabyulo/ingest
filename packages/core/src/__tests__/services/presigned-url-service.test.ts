import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Services from "../../services";
import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as Utils from "@ingest/shared/utils";
import * as Constants from "@ingest/shared/constants";
import { createMockFileTypeDetector, createMockFileRepository, testFixtures } from "../helpers/mocks";

// Mock AWS SDK modules
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

vi.mock("@ingest/shared/utils", () => ({
  Aws: {
    generateS3Key: vi.fn((fileType: string, userId: string, fileId: string, _fileName: string) => 
      `${fileType}/${userId}/2024/01/15/${fileId}.pdf`
    ),
    getAwsResourceTags: vi.fn(() => ({ Project: "ingest", Environment: "test" })),
    formatS3Tags: vi.fn(() => "Project=ingest&Environment=test"),
  },
}));

describe("PresignedUrlService", () => {
  let service: Services.PresignedUrlService.PresignedUrlService;
  let mockS3Client: S3Client;
  let mockFileTypeDetector: ReturnType<typeof createMockFileTypeDetector>;
  let mockFileRepository: ReturnType<typeof createMockFileRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockS3Client = {} as S3Client;
    mockFileTypeDetector = createMockFileTypeDetector();
    mockFileRepository = createMockFileRepository();

    service = new Services.PresignedUrlService.PresignedUrlService({
      bucketName: "test-bucket",
      s3Client: mockS3Client,
      fileTypeDetector: mockFileTypeDetector,
      fileRepository: mockFileRepository,
      userId: "test-user",
      expirationSeconds: 300,
    });

    // Default mock implementations
    vi.mocked(getSignedUrl).mockResolvedValue("https://s3-presigned-url.com/upload");
    vi.mocked(mockFileRepository.createFile).mockResolvedValue(undefined);
  });

  describe("generateUploadUrl - Valid PDF upload request", () => {
    it("should generate presigned URL for valid PDF request", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      const request = testFixtures.validPdfRequest;

      // Act
      const result = await service.generateUploadUrl({
        fileName: request.fileName,
        contentType: request.mimeType,
        size: request.fileSizeBytes,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.fileId).toBeDefined();
        expect(result.uploadUrl).toBe("https://s3-presigned-url.com/upload");
        expect(result.expiresAt).toBeDefined();
        expect(result.maxSizeBytes).toBe(Constants.File.FILE_CONSTANTS.MAX_PDF_SIZE_BYTES);
        expect(result.method).toBe("PUT");
      }

      // Verify file was created in repository
      expect(mockFileRepository.createFile).toHaveBeenCalledTimes(1);
      const createFileCall = vi.mocked(mockFileRepository.createFile).mock.calls[0][0];
      expect(createFileCall.status).toBe("PENDING_UPLOAD");
      expect(createFileCall.mimeType).toBe("application/pdf");
      expect(createFileCall.sizeBytes).toBe(request.fileSizeBytes);
    });

    it("should generate presigned URL for valid JPEG image request", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("image");
      const request = testFixtures.validImageJpegRequest;

      // Act
      const result = await service.generateUploadUrl({
        fileName: request.fileName,
        contentType: request.mimeType,
        size: request.fileSizeBytes,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.fileId).toBeDefined();
        expect(result.uploadUrl).toBe("https://s3-presigned-url.com/upload");
        expect(result.expiresAt).toBeDefined();
        expect(result.maxSizeBytes).toBe(Constants.File.FILE_CONSTANTS.MAX_IMAGE_SIZE_BYTES);
        expect(result.method).toBe("PUT");
      }

      // Verify file was created in repository
      expect(mockFileRepository.createFile).toHaveBeenCalledTimes(1);
      const createFileCall = vi.mocked(mockFileRepository.createFile).mock.calls[0][0];
      expect(createFileCall.status).toBe("PENDING_UPLOAD");
      expect(createFileCall.mimeType).toBe("image/jpeg");
      expect(createFileCall.sizeBytes).toBe(request.fileSizeBytes);
    });

    it("should generate presigned URL for valid PNG image request", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("image");
      const request = testFixtures.validImagePngRequest;

      // Act
      const result = await service.generateUploadUrl({
        fileName: request.fileName,
        contentType: request.mimeType,
        size: request.fileSizeBytes,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.maxSizeBytes).toBe(Constants.File.FILE_CONSTANTS.MAX_IMAGE_SIZE_BYTES);
      }

      // Verify file was created in repository
      expect(mockFileRepository.createFile).toHaveBeenCalledTimes(1);
      const createFileCall = vi.mocked(mockFileRepository.createFile).mock.calls[0][0];
      expect(createFileCall.mimeType).toBe("image/png");
    });

    it("should generate correct S3 key pattern", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      const request = testFixtures.validPdfRequest;

      // Act
      await service.generateUploadUrl({
        fileName: request.fileName,
        contentType: request.mimeType,
        size: request.fileSizeBytes,
      });

      // Assert
      expect(Utils.Aws.generateS3Key).toHaveBeenCalledWith(
        "pdf",
        "test-user",
        expect.any(String),
        request.fileName
      );
    });
  });

  describe("generateUploadUrl - Image support", () => {
    it("should generate presigned URL for valid JPEG image", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("image");
      const request = {
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 2 * 1024 * 1024, // 2 MB
      };

      // Act
      const result = await service.generateUploadUrl({
        fileName: request.fileName,
        contentType: request.mimeType,
        size: request.fileSizeBytes,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.fileId).toBeDefined();
        expect(result.uploadUrl).toBe("https://s3-presigned-url.com/upload");
        expect(result.maxSizeBytes).toBe(Constants.File.FILE_CONSTANTS.MAX_IMAGE_SIZE_BYTES);
      }

      // Verify file was created in repository
      expect(mockFileRepository.createFile).toHaveBeenCalledTimes(1);
      expect(Utils.Aws.generateS3Key).toHaveBeenCalledWith(
        "image",
        "test-user",
        expect.any(String),
        request.fileName
      );
    });

    it("should generate presigned URL for valid PNG image", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("image");
      const request = {
        fileName: "screenshot.png",
        mimeType: "image/png",
        fileSizeBytes: 3 * 1024 * 1024, // 3 MB
      };

      // Act
      const result = await service.generateUploadUrl({
        fileName: request.fileName,
        contentType: request.mimeType,
        size: request.fileSizeBytes,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.maxSizeBytes).toBe(Constants.File.FILE_CONSTANTS.MAX_IMAGE_SIZE_BYTES);
      }
    });

    it("should reject oversized images", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("image");
      const request = {
        fileName: "large.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 6 * 1024 * 1024, // 6 MB (exceeds 5 MB limit)
      };

      // Act
      const result = await service.generateUploadUrl({
        fileName: request.fileName,
        contentType: request.mimeType,
        size: request.fileSizeBytes,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("exceeds maximum allowed size");
        expect(result.error).toContain("images");
      }

      // Verify file was NOT created in repository
      expect(mockFileRepository.createFile).not.toHaveBeenCalled();
    });
  });

  describe("generateUploadUrl - Invalid MIME type", () => {
    it("should reject unsupported MIME types", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("unknown");
      const request = testFixtures.invalidMimeTypeRequest;

      // Act
      const result = await service.generateUploadUrl({
        fileName: request.fileName,
        contentType: request.mimeType,
        size: request.fileSizeBytes,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unsupported file type");
      }

      // Verify file was NOT created in repository
      expect(mockFileRepository.createFile).not.toHaveBeenCalled();
    });

    it("should reject unknown file types", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("unknown");
      const request = testFixtures.invalidFileTypeRequest;

      // Act
      const result = await service.generateUploadUrl({
        fileName: request.fileName,
        contentType: request.mimeType,
        size: request.fileSizeBytes,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unsupported file type");
      }

      // Verify file was NOT created in repository
      expect(mockFileRepository.createFile).not.toHaveBeenCalled();
    });
  });

  describe("generateUploadUrl - File size validation", () => {
    it("should reject oversized PDF files", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      const request = {
        fileName: "large.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 11 * 1024 * 1024, // 11 MB (exceeds 10 MB limit)
      };

      // Act
      const result = await service.generateUploadUrl({
        fileName: request.fileName,
        contentType: request.mimeType,
        size: request.fileSizeBytes,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("exceeds maximum allowed size");
        expect(result.error).toContain("PDFs");
      }

      // Verify file was NOT created in repository
      expect(mockFileRepository.createFile).not.toHaveBeenCalled();
    });
  });

  describe("generateUploadUrl - Repository errors", () => {
    it("should handle repository createFile errors", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      vi.mocked(mockFileRepository.createFile).mockRejectedValue(
        new Error("DynamoDB connection failed")
      );
      const request = testFixtures.validPdfRequest;

      // Act
      const result = await service.generateUploadUrl({
        fileName: request.fileName,
        contentType: request.mimeType,
        size: request.fileSizeBytes,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Failed to generate upload URL");
        expect(result.error).toContain("DynamoDB connection failed");
      }
    });

    it("should handle S3 presigned URL generation errors", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      vi.mocked(getSignedUrl).mockRejectedValue(new Error("S3 service unavailable"));
      const request = testFixtures.validPdfRequest;

      // Act
      const result = await service.generateUploadUrl({
        fileName: request.fileName,
        contentType: request.mimeType,
        size: request.fileSizeBytes,
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Failed to generate upload URL");
        expect(result.error).toContain("S3 service unavailable");
      }
    });
  });

  describe("generateUploadUrl - Edge cases", () => {
    it("should use default expiration if not provided", async () => {
      // Arrange
      const serviceWithoutExpiration = new Services.PresignedUrlService.PresignedUrlService({
        bucketName: "test-bucket",
        s3Client: mockS3Client,
        fileTypeDetector: mockFileTypeDetector,
        fileRepository: mockFileRepository,
        userId: "test-user",
        // expirationSeconds not provided
      });
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      const request = testFixtures.validPdfRequest;

      // Act
      const result = await serviceWithoutExpiration.generateUploadUrl({
        fileName: request.fileName,
        contentType: request.mimeType,
        size: request.fileSizeBytes,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.expiresIn).toBe(300); // Default 5 minutes
      }
    });

    it("should set expiresAt correctly", async () => {
      // Arrange
      vi.mocked(mockFileTypeDetector.detect).mockReturnValue("pdf");
      const request = testFixtures.validPdfRequest;
      const beforeTime = Date.now();

      // Act
      const result = await service.generateUploadUrl({
        fileName: request.fileName,
        contentType: request.mimeType,
        size: request.fileSizeBytes,
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const expiresAt = new Date(result.expiresAt!).getTime();
        const afterTime = Date.now();
        const expectedExpiresAt = beforeTime + 300 * 1000; // 5 minutes
        
        // Should be within 1 second of expected time
        expect(expiresAt).toBeGreaterThanOrEqual(expectedExpiresAt - 1000);
        expect(expiresAt).toBeLessThanOrEqual(afterTime + 300 * 1000 + 1000);
      }
    });
  });
});

