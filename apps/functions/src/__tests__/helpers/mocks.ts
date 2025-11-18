import type { File } from "@ingest/shared/types";
import type { S3Client } from "@aws-sdk/client-s3";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { vi } from "vitest";

/**
 * Mock S3Client for testing
 */
export function createMockS3Client(): S3Client {
  return {
    send: vi.fn(),
    config: {} as unknown as S3Client["config"],
    middlewareStack: {} as unknown as S3Client["middlewareStack"],
    destroy: vi.fn(),
  } as unknown as S3Client;
}

/**
 * Mock DynamoDBDocumentClient for testing
 */
export function createMockDynamoClient(): DynamoDBDocumentClient {
  return {
    send: vi.fn(),
    config: {} as unknown as DynamoDBDocumentClient["config"],
    middlewareStack: {} as unknown as DynamoDBDocumentClient["middlewareStack"],
    destroy: vi.fn(),
  } as unknown as DynamoDBDocumentClient;
}

/**
 * Mock FileTypeDetector for testing
 */
export function createMockFileTypeDetector(): File.IFileTypeDetector {
  return {
    detect: vi.fn(),
  };
}

/**
 * Mock FileRepository for testing
 */
export function createMockFileRepository(): File.IFileRepository {
  return {
    createFile: vi.fn(),
    getFile: vi.fn(),
    getFileById: vi.fn(),
    updateFile: vi.fn(),
    listFiles: vi.fn(),
    deleteExpiredPendingFiles: vi.fn(),
  };
}

/**
 * Test fixtures for file data
 */
export const testFixtures = {
  validPdfRequest: {
    fileName: "test.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 1024 * 1024, // 1 MB
  },
  oversizedPdfRequest: {
    fileName: "large.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 11 * 1024 * 1024, // 11 MB (exceeds 10 MB limit)
  },
  validImageJpegRequest: {
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
    fileSizeBytes: 2 * 1024 * 1024, // 2 MB
  },
  validImagePngRequest: {
    fileName: "screenshot.png",
    mimeType: "image/png",
    fileSizeBytes: 3 * 1024 * 1024, // 3 MB
  },
  oversizedImageRequest: {
    fileName: "large.jpg",
    mimeType: "image/jpeg",
    fileSizeBytes: 6 * 1024 * 1024, // 6 MB (exceeds 5 MB limit)
  },
  invalidFileTypeRequest: {
    fileName: "test.txt",
    mimeType: "text/plain",
    fileSizeBytes: 1024,
  },
  sampleFile: {
    fileId: "550e8400-e29b-41d4-a716-446655440000",
    userId: "test-user",
    fileName: "test.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024 * 1024,
    status: "PENDING_UPLOAD" as const,
    s3Bucket: "test-bucket",
    s3Key: "pdf/test-user/2024/01/15/test.pdf",
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-01-15T10:00:00.000Z",
    expiresAt: "2024-01-15T10:05:00.000Z",
  },
};

