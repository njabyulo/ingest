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
 * Extracts fileId from S3 key pattern: {type}/{userId}/{yyyy}/{mm}/{dd}/{fileId}.{ext}
 */
function extractFileIdFromKey(key: string): string | null {
  // Pattern: {type}/{userId}/{yyyy}/{mm}/{dd}/{fileId}.{ext}
  const parts = key.split("/");
  if (parts.length < 6) {
    return null;
  }
  
  // Last part is {fileId}.{ext}, extract fileId
  const fileName = parts[parts.length - 1];
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return null;
  }
  
  return fileName.substring(0, lastDotIndex);
}

/**
 * Extracts userId from S3 key pattern: {type}/{userId}/{yyyy}/{mm}/{dd}/{fileId}.{ext}
 */
function extractUserIdFromKey(key: string): string | null {
  // Pattern: {type}/{userId}/{yyyy}/{mm}/{dd}/{fileId}.{ext}
  const parts = key.split("/");
  if (parts.length < 6) {
    return null;
  }
  
  // Validate type prefix (pdf or images)
  if (parts[0] !== "pdf" && parts[0] !== "images") {
    return null;
  }
  
  // userId is at index 1
  return parts[1];
}

export const handler = async (event: S3Event) => {
  const processedRecords: Array<{ key: string; success: boolean; error?: string }> = [];

  console.log(`S3 event handler invoked with ${event.Records.length} record(s)`);

  for (const record of event.Records) {
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    
    console.log(`Processing S3 event: ${record.eventName} for key: ${key}`);
    
    try {
      // Only process PutObject events (file uploads)
      if (record.eventName !== "ObjectCreated:Put") {
        console.log(`Skipping non-PutObject event: ${record.eventName} for key: ${key}`);
        processedRecords.push({ key, success: true });
        continue;
      }
      
      // Extract fileId and userId from S3 key
      const fileId = extractFileIdFromKey(key);
      const userId = extractUserIdFromKey(key);
      
      console.log(`Extracted fileId: ${fileId}, userId: ${userId} from key: ${key}`);
      
      if (!fileId || !userId) {
        const error = `Failed to extract fileId or userId from key: ${key}`;
        console.error(error, { key, fileId, userId, keyParts: key.split("/") });
        processedRecords.push({ key, success: false, error });
        continue;
      }
      
      // Verify file record exists before updating (idempotency check)
      // Use getFileById first (GSI query), fallback to getFile if needed
      let existingFile = await fileRepository.getFileById(fileId);
      if (!existingFile) {
        existingFile = await fileRepository.getFile(fileId, userId);
      }
      
      if (!existingFile) {
        const error = `File record not found for fileId: ${fileId}, userId: ${userId}, key: ${key}`;
        console.warn(error, { fileId, userId, key });
        processedRecords.push({ key, success: false, error });
        continue;
      }
      
      // Use the userId from the file record (more reliable than extracted userId)
      const fileUserId = existingFile.userId;
      
      // Idempotency: Only update if status is PENDING_UPLOAD
      // This ensures multiple events for the same file don't cause issues
      if (existingFile.status === "UPLOADED") {
        console.log(`File ${fileId} already marked as UPLOADED, skipping update (idempotent)`, {
          fileId,
          userId,
          key,
          currentStatus: existingFile.status,
          uploadedAt: existingFile.uploadedAt,
        });
        processedRecords.push({ key, success: true });
        continue;
      }
      
      if (existingFile.status !== "PENDING_UPLOAD") {
        const error = `File ${fileId} has unexpected status: ${existingFile.status}, expected PENDING_UPLOAD`;
        console.warn(error, { fileId, userId, key, currentStatus: existingFile.status });
        processedRecords.push({ key, success: false, error });
        continue;
      }
      
      // Update file status to UPLOADED
      const uploadedAt = new Date().toISOString();
      await fileRepository.updateFile(fileId, fileUserId, {
        status: "UPLOADED",
        uploadedAt,
      });
      
      console.log(`Successfully updated file ${fileId} status from PENDING_UPLOAD to UPLOADED`, {
        fileId,
        userId: fileUserId,
        key,
        uploadedAt,
      });
      
      processedRecords.push({ key, success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error(`Error processing S3 event for key: ${key}`, {
        error: errorMessage,
        stack: errorStack,
        key,
        eventName: record.eventName,
        bucket: record.s3.bucket.name,
        objectKey: record.s3.object.key,
      });
      
      processedRecords.push({ key, success: false, error: errorMessage });
      // Continue processing other records even if one fails
    }
  }
  
  // Log summary of processing
  const successCount = processedRecords.filter(r => r.success).length;
  const failureCount = processedRecords.filter(r => !r.success).length;
  
  console.log(`S3 event processing complete`, {
    totalRecords: processedRecords.length,
    successCount,
    failureCount,
    records: processedRecords,
  });
  
  // If there are failures, the Lambda will be marked as failed
  // This allows DLQ to capture failed events if configured
  if (failureCount > 0) {
    throw new Error(`Failed to process ${failureCount} out of ${processedRecords.length} S3 event records`);
  }
};

