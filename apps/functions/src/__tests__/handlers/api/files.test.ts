import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import * as Services from "@ingest/core/services";
import * as Utils from "@ingest/shared/utils";
import { createMockFileRepository, testFixtures } from "../../helpers/mocks";
import * as Constants from "@ingest/shared/constants";

// Mock the handler module dependencies
vi.mock("sst", () => ({
  Resource: {
    FilesTable: { name: "test-table" },
    IngestBucket: { name: "test-bucket" },
  },
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({})),
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3-presigned-url.com/upload"),
}));

vi.mock("@ingest/shared/utils", async () => {
  const actual = await vi.importActual("@ingest/shared/utils");
  return {
    ...actual,
    Aws: {
      generateS3Key: vi.fn((userId: string, fileId: string, _fileName: string) => 
        `uploads/${userId}/2024/01/15/${fileId}.pdf`
      ),
      getAwsResourceTags: vi.fn(() => ({ Project: "ingest", Environment: "test" })),
      formatS3Tags: vi.fn(() => "Project=ingest&Environment=test"),
    },
  };
});

describe("POST /v1/files - API Handler", () => {
  let app: Hono;
  let mockFileRepository: ReturnType<typeof createMockFileRepository>;
  let mockPresignedUrlService: Services.PresignedUrlService.PresignedUrlService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mocks
    mockFileRepository = createMockFileRepository();
    
    // Create real service instance with mocked dependencies
    const fileTypeDetector = new Utils.DetectFileType.FileTypeDetector();
    mockPresignedUrlService = new Services.PresignedUrlService.PresignedUrlService({
      bucketName: "test-bucket",
      s3Client: {} as unknown as Services.PresignedUrlService.IPresignedUrlServiceConfig["s3Client"],
      fileTypeDetector,
      fileRepository: mockFileRepository,
      userId: "default-user",
    });

    // Create a test app that mimics the handler structure
    app = new Hono();
    
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

        const result = await mockPresignedUrlService.generateUploadUrl({
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
  });

  describe("Valid PDF upload request", () => {
    it("should return presigned URL for valid PDF request", async () => {
      // Arrange
      const request = testFixtures.validPdfRequest;
      // Mock the service's internal dependencies
      vi.mocked(mockFileRepository.createFile).mockResolvedValue(undefined);

      // Act
      const res = await app.request("/v1/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      // Assert
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.fileId).toBeDefined();
      expect(data.uploadUrl).toBeDefined();
      expect(data.expiresAt).toBeDefined();
      expect(data.maxSizeBytes).toBe(Constants.File.FILE_CONSTANTS.MAX_PDF_SIZE_BYTES);
      expect(data.method).toBe("PUT");
    });
  });

  describe("Invalid MIME type", () => {
    it("should reject non-PDF MIME types", async () => {
      // Arrange
      const request = testFixtures.invalidMimeTypeRequest;

      // Act
      const res = await app.request("/v1/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Only application/pdf files are allowed");
    });

    it("should reject unknown MIME types", async () => {
      // Arrange
      const request = testFixtures.invalidFileTypeRequest;

      // Act
      const res = await app.request("/v1/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Only application/pdf files are allowed");
    });
  });

  describe("Oversized file", () => {
    it("should reject files exceeding size limit", async () => {
      // Arrange
      const request = testFixtures.oversizedPdfRequest;

      // Act
      const res = await app.request("/v1/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("exceeds maximum allowed size");
      expect(data.error).toContain("10.00MB");
    });
  });

  describe("Missing required fields", () => {
    it("should reject request with missing fileName", async () => {
      // Act
      const res = await app.request("/v1/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mimeType: "application/pdf",
          fileSizeBytes: 1024,
        }),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Missing required fields");
    });

    it("should reject request with missing mimeType", async () => {
      // Act
      const res = await app.request("/v1/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "test.pdf",
          fileSizeBytes: 1024,
        }),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Missing required fields");
    });

    it("should reject request with missing fileSizeBytes", async () => {
      // Act
      const res = await app.request("/v1/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "test.pdf",
          mimeType: "application/pdf",
        }),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Missing required fields");
    });
  });

  describe("Invalid request body", () => {
    it("should reject non-JSON body", async () => {
      // Act
      const res = await app.request("/v1/files", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "not json",
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid or missing request body");
    });

    it("should reject non-object body", async () => {
      // Act
      const res = await app.request("/v1/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify("not an object"),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Request body must be a JSON object");
    });
  });

  describe("Repository errors", () => {
    it("should handle repository errors gracefully", async () => {
      // Arrange
      vi.mocked(mockFileRepository.createFile).mockRejectedValue(
        new Error("DynamoDB connection failed")
      );
      const request = testFixtures.validPdfRequest;

      // Act
      const res = await app.request("/v1/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });
});

