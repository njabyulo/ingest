export const INGEST_CONSTANTS = {
  MAX_PDF_SIZE_BYTES: 10 * 1024 * 1024,
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024,
  ALLOWED_PDF_TYPES: ["application/pdf"],
  ALLOWED_IMAGE_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ],
} as const;

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

