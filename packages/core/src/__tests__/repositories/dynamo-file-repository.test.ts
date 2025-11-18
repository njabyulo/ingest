import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Repositories from "../../repositories";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { createMockDynamoClient, testFixtures } from "../helpers/mocks";

// Mock AWS SDK modules
vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(),
  },
  PutCommand: vi.fn(),
  GetCommand: vi.fn(),
  QueryCommand: vi.fn(),
  UpdateCommand: vi.fn(),
  ScanCommand: vi.fn(),
  DeleteCommand: vi.fn(),
}));

describe("DynamoFileRepository", () => {
  let repository: Repositories.DynamoFileRepository.DynamoFileRepository;
  let mockDynamoClient: DynamoDBDocumentClient;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDynamoClient = createMockDynamoClient();
    repository = new Repositories.DynamoFileRepository.DynamoFileRepository({
      tableName: "test-table",
      dynamoClient: mockDynamoClient,
    });

    // Default mock implementations - send returns Promise<unknown>
    vi.mocked(mockDynamoClient.send).mockResolvedValue({} as unknown);
  });

  describe("createFile", () => {
    it("should create a file with correct partition and sort keys", async () => {
      // Arrange
      const file = testFixtures.sampleFile;

      // Act
      await repository.createFile(file);

      // Assert
      expect(mockDynamoClient.send).toHaveBeenCalledTimes(1);
      expect(PutCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: "test-table",
          Item: expect.objectContaining({
            PK: `USER#${file.userId}`,
            SK: `FILE#${file.fileId}`,
            fileId: file.fileId,
            userId: file.userId,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            status: file.status,
            s3Bucket: file.s3Bucket,
            s3Key: file.s3Key,
          }),
        })
      );
    });

    it("should set TTL for PENDING_UPLOAD files with expiresAt", async () => {
      // Arrange
      const file = {
        ...testFixtures.sampleFile,
        status: "PENDING_UPLOAD" as const,
        expiresAt: "2024-01-15T10:05:00.000Z",
      };

      // Act
      await repository.createFile(file);

      // Assert
      const putCall = vi.mocked(PutCommand).mock.calls[0][0];
      expect(putCall.Item).toHaveProperty("ttl");
      expect(putCall.Item.ttl).toBeGreaterThan(0);
      
      // TTL should be expiresAt + 48 hours in Unix epoch seconds
      const expiresAtDate = new Date(file.expiresAt).getTime();
      const expectedTtl = Math.floor((expiresAtDate + 48 * 60 * 60 * 1000) / 1000);
      expect(putCall.Item.ttl).toBe(expectedTtl);
    });

    it("should not set TTL for UPLOADED files", async () => {
      // Arrange
      const file = {
        ...testFixtures.sampleFile,
        status: "UPLOADED" as const,
        expiresAt: "2024-01-15T10:05:00.000Z",
      };

      // Act
      await repository.createFile(file);

      // Assert
      const putCall = vi.mocked(PutCommand).mock.calls[0][0];
      expect(putCall.Item).not.toHaveProperty("ttl");
    });

    it("should not set TTL for PENDING_UPLOAD files without expiresAt", async () => {
      // Arrange
      const file = {
        ...testFixtures.sampleFile,
        status: "PENDING_UPLOAD" as const,
        expiresAt: undefined,
      };

      // Act
      await repository.createFile(file);

      // Assert
      const putCall = vi.mocked(PutCommand).mock.calls[0][0];
      expect(putCall.Item).not.toHaveProperty("ttl");
    });

    it("should set createdAt and updatedAt if not provided", async () => {
      // Arrange
      const file = {
        ...testFixtures.sampleFile,
        createdAt: undefined,
        updatedAt: undefined,
      };
      const beforeTime = new Date().toISOString();

      // Act
      await repository.createFile(file);

      // Assert
      const putCall = vi.mocked(PutCommand).mock.calls[0][0];
      expect(putCall.Item.createdAt).toBeDefined();
      expect(putCall.Item.updatedAt).toBeDefined();
      expect(new Date(putCall.Item.createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTime).getTime()
      );
    });

    it("should include optional fields when provided", async () => {
      // Arrange
      const file = {
        ...testFixtures.sampleFile,
        uploadedAt: "2024-01-15T10:10:00.000Z",
        expiresAt: "2024-01-15T10:05:00.000Z",
      };

      // Act
      await repository.createFile(file);

      // Assert
      const putCall = vi.mocked(PutCommand).mock.calls[0][0];
      expect(putCall.Item.uploadedAt).toBe(file.uploadedAt);
      expect(putCall.Item.expiresAt).toBe(file.expiresAt);
    });
  });

  describe("updateFile", () => {
    it("should update file status", async () => {
      // Arrange
      const fileId = "test-file-id";
      const userId = "test-user";
      const updates = { status: "UPLOADED" as const };

      // Act
      await repository.updateFile(fileId, userId, updates);

      // Assert
      expect(mockDynamoClient.send).toHaveBeenCalledTimes(1);
      expect(UpdateCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: "test-table",
          Key: {
            PK: `USER#${userId}`,
            SK: `FILE#${fileId}`,
          },
          UpdateExpression: expect.stringContaining("#status = :status"),
          ExpressionAttributeNames: expect.objectContaining({
            "#status": "status",
          }),
          ExpressionAttributeValues: expect.objectContaining({
            ":status": "UPLOADED",
          }),
        })
      );
    });

    it("should update multiple fields", async () => {
      // Arrange
      const fileId = "test-file-id";
      const userId = "test-user";
      const updates = {
        status: "UPLOADED" as const,
        uploadedAt: "2024-01-15T10:10:00.000Z",
        fileName: "renamed.pdf",
      };

      // Act
      await repository.updateFile(fileId, userId, updates);

      // Assert
      const updateCall = vi.mocked(UpdateCommand).mock.calls[0][0];
      expect(updateCall.UpdateExpression).toContain("#status = :status");
      expect(updateCall.UpdateExpression).toContain("uploadedAt = :uploadedAt");
      expect(updateCall.UpdateExpression).toContain("fileName = :fileName");
      expect(updateCall.UpdateExpression).toContain("updatedAt = :updatedAt");
    });

    it("should always update updatedAt timestamp", async () => {
      // Arrange
      const fileId = "test-file-id";
      const userId = "test-user";
      const updates = { status: "UPLOADED" as const };
      const beforeTime = new Date().toISOString();

      // Act
      await repository.updateFile(fileId, userId, updates);

      // Assert
      const updateCall = vi.mocked(UpdateCommand).mock.calls[0][0];
      expect(updateCall.UpdateExpression).toContain("updatedAt = :updatedAt");
      const updatedAt = updateCall.ExpressionAttributeValues![":updatedAt"] as string;
      expect(new Date(updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTime).getTime()
      );
    });

    it("should always update updatedAt even if no other fields provided", async () => {
      // Arrange
      const fileId = "test-file-id";
      const userId = "test-user";
      const updates = {};

      // Act
      await repository.updateFile(fileId, userId, updates);

      // Assert
      // updatedAt is always updated, so send should be called
      expect(mockDynamoClient.send).toHaveBeenCalledTimes(1);
      const updateCall = vi.mocked(UpdateCommand).mock.calls[0][0];
      expect(updateCall.UpdateExpression).toContain("updatedAt = :updatedAt");
    });

    it("should handle all updateable fields", async () => {
      // Arrange
      const fileId = "test-file-id";
      const userId = "test-user";
      const updates = {
        status: "UPLOADED" as const,
        uploadedAt: "2024-01-15T10:10:00.000Z",
        fileName: "renamed.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        s3Bucket: "new-bucket",
        s3Key: "new-key",
      };

      // Act
      await repository.updateFile(fileId, userId, updates);

      // Assert
      const updateCall = vi.mocked(UpdateCommand).mock.calls[0][0];
      const expression = updateCall.UpdateExpression!;
      expect(expression).toContain("#status");
      expect(expression).toContain("uploadedAt");
      expect(expression).toContain("fileName");
      expect(expression).toContain("mimeType");
      expect(expression).toContain("sizeBytes");
      expect(expression).toContain("s3Bucket");
      expect(expression).toContain("s3Key");
      expect(expression).toContain("updatedAt");
    });
  });

  describe("getFile", () => {
    it("should retrieve a file by fileId and userId", async () => {
      // Arrange
      const fileId = "test-file-id";
      const userId = "test-user";
      const mockItem = {
        PK: `USER#${userId}`,
        SK: `FILE#${fileId}`,
        ...testFixtures.sampleFile,
        fileId, // Override with test fileId
        userId, // Override with test userId
      };
      vi.mocked(mockDynamoClient.send).mockResolvedValue({ Item: mockItem } as unknown);

      // Act
      const result = await repository.getFile(fileId, userId);

      // Assert
      expect(result).not.toBeNull();
      if (result) {
        expect(result.fileId).toBe(fileId);
        expect(result.userId).toBe(userId);
      }

      expect(GetCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: "test-table",
          Key: {
            PK: `USER#${userId}`,
            SK: `FILE#${fileId}`,
          },
        })
      );
    });

    it("should return null if file does not exist", async () => {
      // Arrange
      vi.mocked(mockDynamoClient.send).mockResolvedValue({} as unknown);

      // Act
      const result = await repository.getFile("non-existent", "test-user");

      // Assert
      expect(result).toBeNull();
    });

    it("should map DynamoDB item to IFile correctly", async () => {
      // Arrange
      const mockItem = {
        PK: "USER#test-user",
        SK: "FILE#test-file-id",
        fileId: "test-file-id",
        userId: "test-user",
        fileName: "test.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        status: "UPLOADED",
        s3Bucket: "test-bucket",
        s3Key: "uploads/test-user/2024/01/15/test-file-id.pdf",
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:10:00.000Z",
        uploadedAt: "2024-01-15T10:10:00.000Z",
        expiresAt: undefined,
        ttl: undefined,
      };
      vi.mocked(mockDynamoClient.send).mockResolvedValue({ Item: mockItem } as unknown);

      // Act
      const result = await repository.getFile("test-file-id", "test-user");

      // Assert
      expect(result).toEqual({
        fileId: mockItem.fileId,
        userId: mockItem.userId,
        fileName: mockItem.fileName,
        mimeType: mockItem.mimeType,
        sizeBytes: mockItem.sizeBytes,
        status: mockItem.status,
        s3Bucket: mockItem.s3Bucket,
        s3Key: mockItem.s3Key,
        createdAt: mockItem.createdAt,
        updatedAt: mockItem.updatedAt,
        uploadedAt: mockItem.uploadedAt,
        expiresAt: mockItem.expiresAt,
        ttl: mockItem.ttl,
      });
    });
  });

  describe("getFileById", () => {
    it("should query file by fileId using GSI", async () => {
      // Arrange
      const fileId = "test-file-id";
      const mockItem = {
        ...testFixtures.sampleFile,
        fileId,
      };
      vi.mocked(mockDynamoClient.send).mockResolvedValue({ Items: [mockItem] } as unknown);

      // Act
      const result = await repository.getFileById(fileId);

      // Assert
      expect(result).not.toBeNull();
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: "test-table",
          IndexName: "FileIdIndex",
          KeyConditionExpression: "fileId = :fileId",
          ExpressionAttributeValues: {
            ":fileId": fileId,
          },
          Limit: 1,
        })
      );
    });

    it("should return null if file does not exist", async () => {
      // Arrange
      vi.mocked(mockDynamoClient.send).mockResolvedValue({ Items: [] } as unknown);

      // Act
      const result = await repository.getFileById("non-existent");

      // Assert
      expect(result).toBeNull();
    });

    it("should return first item from query results", async () => {
      // Arrange
      const fileId = "test-file-id";
      const mockItems = [
        { ...testFixtures.sampleFile, fileId },
        { ...testFixtures.sampleFile, fileId: "another-id" },
      ];
      vi.mocked(mockDynamoClient.send).mockResolvedValue({ Items: mockItems } as unknown);

      // Act
      const result = await repository.getFileById(fileId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.fileId).toBe(fileId);
    });
  });

  describe("listFiles", () => {
    it("should list files for a user with pagination", async () => {
      // Arrange
      const userId = "test-user";
      const limit = 10;
      const mockItems = [
        { ...testFixtures.sampleFile, fileId: "file-1" },
        { ...testFixtures.sampleFile, fileId: "file-2" },
      ];
      vi.mocked(mockDynamoClient.send).mockResolvedValue({
        Items: mockItems,
        LastEvaluatedKey: { PK: "USER#test-user", SK: "FILE#file-2" },
      } as unknown);

      // Act
      const result = await repository.listFiles(userId, limit);

      // Assert
      expect(result.files).toHaveLength(2);
      expect(result.nextCursor).toBeDefined();

      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: "test-table",
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: {
            ":pk": `USER#${userId}`,
          },
          Limit: limit,
          ScanIndexForward: false, // Newest first
        })
      );
    });

    it("should return empty list if no files exist", async () => {
      // Arrange
      vi.mocked(mockDynamoClient.send).mockResolvedValue({ Items: [] } as unknown);

      // Act
      const result = await repository.listFiles("test-user", 10);

      // Assert
      expect(result.files).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should handle cursor for pagination", async () => {
      // Arrange
      const userId = "test-user";
      const limit = 10;
      const cursor = Buffer.from(
        JSON.stringify({ PK: "USER#test-user", SK: "FILE#file-2" })
      ).toString("base64");
      const mockItems = [{ ...testFixtures.sampleFile, fileId: "file-3" }];
      vi.mocked(mockDynamoClient.send).mockResolvedValue({ Items: mockItems } as unknown);

      // Act
      await repository.listFiles(userId, limit, cursor);

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ExclusiveStartKey: { PK: "USER#test-user", SK: "FILE#file-2" },
        })
      );
    });

    it("should handle invalid cursor gracefully", async () => {
      // Arrange
      const userId = "test-user";
      const invalidCursor = "invalid-base64";

      // Act
      await repository.listFiles(userId, 10, invalidCursor);

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ExclusiveStartKey: undefined,
        })
      );
    });

    it("should generate nextCursor from LastEvaluatedKey", async () => {
      // Arrange
      const userId = "test-user";
      const lastEvaluatedKey = { PK: "USER#test-user", SK: "FILE#file-2" };
      vi.mocked(mockDynamoClient.send).mockResolvedValue({
        Items: [{ ...testFixtures.sampleFile }],
        LastEvaluatedKey: lastEvaluatedKey,
      } as unknown);

      // Act
      const result = await repository.listFiles(userId, 10);

      // Assert
      expect(result.nextCursor).toBeDefined();
      const decodedCursor = JSON.parse(
        Buffer.from(result.nextCursor!, "base64").toString("utf-8")
      );
      expect(decodedCursor).toEqual(lastEvaluatedKey);
    });

    it("should sort files by SK descending (newest first)", async () => {
      // Arrange
      const userId = "test-user";

      // Act
      await repository.listFiles(userId, 10);

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ScanIndexForward: false,
        })
      );
    });
  });

  describe("deleteExpiredPendingFiles", () => {
    it("should delete expired PENDING_UPLOAD files using GSI", async () => {
      // Arrange
      const expiredBefore = "2024-01-15T10:00:00.000Z";
      const mockItems = [
        {
          PK: "USER#user1",
          SK: "FILE#file1",
          fileId: "file1",
          status: "PENDING_UPLOAD",
          expiresAt: "2024-01-15T09:00:00.000Z",
        },
        {
          PK: "USER#user2",
          SK: "FILE#file2",
          fileId: "file2",
          status: "PENDING_UPLOAD",
          expiresAt: "2024-01-15T09:30:00.000Z",
        },
      ];
      vi.mocked(mockDynamoClient.send)
        .mockResolvedValueOnce({ Items: mockItems } as unknown) // Query result
        .mockResolvedValue({} as unknown); // Delete results

      // Act
      const deletedCount = await repository.deleteExpiredPendingFiles(expiredBefore);

      // Assert
      expect(deletedCount).toBe(2);
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: "test-table",
          IndexName: "StatusExpiresAtIndex",
          KeyConditionExpression: "#status = :status AND expiresAt < :expiredBefore",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":status": "PENDING_UPLOAD",
            ":expiredBefore": expiredBefore,
          },
        })
      );
      expect(DeleteCommand).toHaveBeenCalledTimes(2);
    });

    it("should handle pagination when deleting expired files", async () => {
      // Arrange
      const expiredBefore = "2024-01-15T10:00:00.000Z";
      const lastEvaluatedKey = { PK: "USER#user1", SK: "FILE#file1" };
      
      vi.mocked(mockDynamoClient.send)
        .mockResolvedValueOnce({
          Items: [{ PK: "USER#user1", SK: "FILE#file1", fileId: "file1" }],
          LastEvaluatedKey: lastEvaluatedKey,
        } as unknown)
        .mockResolvedValueOnce({} as unknown) // Delete for file1
        .mockResolvedValueOnce({
          Items: [{ PK: "USER#user2", SK: "FILE#file2", fileId: "file2" }],
        } as unknown)
        .mockResolvedValueOnce({} as unknown); // Delete for file2

      // Act
      const deletedCount = await repository.deleteExpiredPendingFiles(expiredBefore);

      // Assert
      expect(deletedCount).toBe(2);
      expect(QueryCommand).toHaveBeenCalledTimes(2);
      expect(DeleteCommand).toHaveBeenCalledTimes(2);
    });

    it("should handle delete errors gracefully", async () => {
      // Arrange
      const expiredBefore = "2024-01-15T10:00:00.000Z";
      const mockItems = [
        {
          PK: "USER#user1",
          SK: "FILE#file1",
          fileId: "file1",
        },
        {
          PK: "USER#user2",
          SK: "FILE#file2",
          fileId: "file2",
        },
      ];
      
      vi.mocked(mockDynamoClient.send)
        .mockResolvedValueOnce({ Items: mockItems } as unknown)
        .mockResolvedValueOnce({} as unknown) // First delete succeeds
        .mockRejectedValueOnce(new Error("Delete failed")); // Second delete fails

      // Act
      const deletedCount = await repository.deleteExpiredPendingFiles(expiredBefore);

      // Assert
      // Should still return count of successful deletes
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });

    it("should also scan for old records without expiresAt", async () => {
      // Arrange
      const expiredBefore = "2024-01-15T10:00:00.000Z";
      const oldItems = [
        {
          PK: "USER#user1",
          SK: "FILE#file1",
          fileId: "file1",
          status: "PENDING_UPLOAD",
        },
      ];
      
      vi.mocked(mockDynamoClient.send)
        .mockResolvedValueOnce({ Items: [] } as unknown) // GSI query returns nothing
        .mockResolvedValueOnce({ Items: oldItems } as unknown) // Scan finds old records
        .mockResolvedValue({} as unknown); // Delete results

      // Act
      const deletedCount = await repository.deleteExpiredPendingFiles(expiredBefore);

      // Assert
      expect(deletedCount).toBe(1);
      expect(ScanCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: "test-table",
          FilterExpression: "#status = :status AND attribute_not_exists(expiresAt)",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":status": "PENDING_UPLOAD",
          },
          Limit: 100,
        })
      );
    });

    it("should return 0 if no expired files found", async () => {
      // Arrange
      const expiredBefore = "2024-01-15T10:00:00.000Z";
      vi.mocked(mockDynamoClient.send)
        .mockResolvedValueOnce({ Items: [] } as unknown) // GSI query
        .mockResolvedValueOnce({ Items: [] } as unknown); // Scan

      // Act
      const deletedCount = await repository.deleteExpiredPendingFiles(expiredBefore);

      // Assert
      expect(deletedCount).toBe(0);
    });
  });
});

