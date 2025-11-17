import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Event } from "aws-lambda";
import { Resource } from "sst";
import * as Repositories from "@ingest/core/repositories";

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const fileRepository = new Repositories.DynamoFileRepository.DynamoFileRepository({
  tableName: Resource.FilesTable.name,
  dynamoClient,
});

/**
 * Extracts fileId from S3 key pattern: uploads/{userId}/{yyyy}/{mm}/{dd}/{fileId}.pdf
 */
function extractFileIdFromKey(key: string): string | null {
  // Pattern: uploads/{userId}/{yyyy}/{mm}/{dd}/{fileId}.pdf
  const parts = key.split("/");
  if (parts.length < 5) {
    return null;
  }
  
  // Last part is {fileId}.pdf, extract fileId
  const fileName = parts[parts.length - 1];
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return null;
  }
  
  return fileName.substring(0, lastDotIndex);
}

/**
 * Extracts userId from S3 key pattern: uploads/{userId}/{yyyy}/{mm}/{dd}/{fileId}.pdf
 */
function extractUserIdFromKey(key: string): string | null {
  // Pattern: uploads/{userId}/{yyyy}/{mm}/{dd}/{fileId}.pdf
  const parts = key.split("/");
  if (parts.length < 2) {
    return null;
  }
  
  // Second part (index 1) is userId
  return parts[1];
}

export const handler = async (event: S3Event) => {
  for (const record of event.Records) {
    try {
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
      
      // Only process PutObject events (file uploads)
      if (record.eventName !== "ObjectCreated:Put") {
        continue;
      }
      
      // Extract fileId and userId from S3 key
      const fileId = extractFileIdFromKey(key);
      const userId = extractUserIdFromKey(key);
      
      if (!fileId || !userId) {
        console.error(`Failed to extract fileId or userId from key: ${key}`);
        continue;
      }
      
      // Update file status to UPLOADED
      const uploadedAt = new Date().toISOString();
      await fileRepository.updateFile(fileId, userId, {
        status: "UPLOADED",
        uploadedAt,
      });
      
      console.log(`Updated file ${fileId} status to UPLOADED`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error(`Error processing S3 event: ${errorMessage}`, error);
      // Continue processing other records even if one fails
    }
  }
};

