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

