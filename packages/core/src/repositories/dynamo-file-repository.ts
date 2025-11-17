import type { File } from "@ingest/shared/types";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export interface IDynamoFileRepositoryConfig {
  tableName: string;
  dynamoClient: DynamoDBDocumentClient;
}

export class DynamoFileRepository implements File.IFileRepository {
  constructor(private readonly config: IDynamoFileRepositoryConfig) {}

  async createFile(file: File.IFile): Promise<void> {
    const now = new Date().toISOString();
    const item = {
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
      createdAt: file.createdAt || now,
      updatedAt: file.updatedAt || now,
      ...(file.uploadedAt && { uploadedAt: file.uploadedAt }),
    };

    await this.config.dynamoClient.send(
      new PutCommand({
        TableName: this.config.tableName,
        Item: item,
      }),
    );
  }

  async updateFile(fileId: string, userId: string, updates: Partial<File.IFile>): Promise<void> {
    const now = new Date().toISOString();
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {};

    // Build update expression dynamically based on provided updates
    if (updates.status !== undefined) {
      updateExpressions.push("#status = :status");
      expressionAttributeNames["#status"] = "status";
      expressionAttributeValues[":status"] = updates.status;
    }
    if (updates.uploadedAt !== undefined) {
      updateExpressions.push("uploadedAt = :uploadedAt");
      expressionAttributeValues[":uploadedAt"] = updates.uploadedAt;
    }
    if (updates.fileName !== undefined) {
      updateExpressions.push("fileName = :fileName");
      expressionAttributeValues[":fileName"] = updates.fileName;
    }
    if (updates.mimeType !== undefined) {
      updateExpressions.push("mimeType = :mimeType");
      expressionAttributeValues[":mimeType"] = updates.mimeType;
    }
    if (updates.sizeBytes !== undefined) {
      updateExpressions.push("sizeBytes = :sizeBytes");
      expressionAttributeValues[":sizeBytes"] = updates.sizeBytes;
    }
    if (updates.s3Bucket !== undefined) {
      updateExpressions.push("s3Bucket = :s3Bucket");
      expressionAttributeValues[":s3Bucket"] = updates.s3Bucket;
    }
    if (updates.s3Key !== undefined) {
      updateExpressions.push("s3Key = :s3Key");
      expressionAttributeValues[":s3Key"] = updates.s3Key;
    }

    // Always update updatedAt
    updateExpressions.push("updatedAt = :updatedAt");
    expressionAttributeValues[":updatedAt"] = now;

    if (updateExpressions.length === 0) {
      return; // No updates to apply
    }

    await this.config.dynamoClient.send(
      new UpdateCommand({
        TableName: this.config.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `FILE#${fileId}`,
        },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ExpressionAttributeValues: expressionAttributeValues,
      }),
    );
  }

  async getFile(fileId: string, userId: string): Promise<File.IFile | null> {
    const result = await this.config.dynamoClient.send(
      new GetCommand({
        TableName: this.config.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `FILE#${fileId}`,
        },
      }),
    );

    if (!result.Item) {
      return null;
    }

    const item = result.Item;
    return {
      fileId: item.fileId,
      userId: item.userId,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      status: item.status,
      s3Bucket: item.s3Bucket,
      s3Key: item.s3Key,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      uploadedAt: item.uploadedAt,
    };
  }

  async getFileById(fileId: string): Promise<File.IFile | null> {
    // Query by fileId using GSI
    const result = await this.config.dynamoClient.send(
      new QueryCommand({
        TableName: this.config.tableName,
        IndexName: "FileIdIndex",
        KeyConditionExpression: "fileId = :fileId",
        ExpressionAttributeValues: {
          ":fileId": fileId,
        },
        Limit: 1,
      }),
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    const item = result.Items[0];
    return {
      fileId: item.fileId,
      userId: item.userId,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      status: item.status,
      s3Bucket: item.s3Bucket,
      s3Key: item.s3Key,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      uploadedAt: item.uploadedAt,
    };
  }
}

