export const FILE_CONSTANTS = {
  MAX_PDF_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_SIZE_PDF: 10 * 1024 * 1024, // 10 MB (alias for consistency)
  MAX_SIZE_IMAGE: 5 * 1024 * 1024, // 5 MB (alias for consistency)
  ALLOWED_PDF_TYPES: ["application/pdf"],
  ALLOWED_IMAGE_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ],
  ALLOWED_TYPES: ["application/pdf", "image/jpeg", "image/jpg", "image/png"],
  POLLING_INTERVAL: 2000, // 2 seconds
  POLLING_TIMEOUT: 30000, // 30 seconds
  FILES_PER_PAGE: 20,
  MAX_FILES_PER_PAGE: 100,
} as const;

export const SORT_OPTIONS = {
  NAME: "name",
  DATE: "date",
  SIZE: "size",
} as const;

export type SortOption = typeof SORT_OPTIONS[keyof typeof SORT_OPTIONS];

