/**
 * AWS resource tags to be applied to both the S3 bucket and uploaded objects
 * @param stage - The SST stage/environment (defaults to "dev")
 */
export function getAwsResourceTags(stage: string = "dev") {
  return {
    Project: "ingest",
    Environment: stage,
    ManagedBy: "sst",
  } as const;
}

/**
 * Formats AWS resource tags as a URL-encoded string for S3 object tagging
 * @param tags - Object with tag key-value pairs
 * @returns URL-encoded string in format "Key1=Value1&Key2=Value2"
 */
export function formatS3Tags(tags: Record<string, string>): string {
  return Object.entries(tags)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

/**
 * Generates S3 key pattern: uploads/{userId}/{yyyy}/{mm}/{dd}/{fileId}.pdf
 * @param userId - User ID
 * @param fileId - File ID
 * @param fileName - Original file name (used to extract extension)
 * @returns S3 key string
 */
export function generateS3Key(userId: string, fileId: string, fileName: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  
  // Extract file extension from fileName, default to .pdf
  const extension = fileName.includes(".") 
    ? fileName.substring(fileName.lastIndexOf("."))
    : ".pdf";
  
  return `uploads/${userId}/${year}/${month}/${day}/${fileId}${extension}`;
}

