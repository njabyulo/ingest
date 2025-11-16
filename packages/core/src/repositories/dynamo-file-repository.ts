import type { File } from "@ingest/shared/types";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

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
}

