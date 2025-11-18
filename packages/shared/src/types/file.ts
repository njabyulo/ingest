export interface IIngestRequest {
  fileName: string;
  fileContent: Buffer | string;
  contentType: string;
  size: number;
}

export interface IValidator {
  validate(request: IIngestRequest): Promise<IValidationResult>;
}

export interface IValidationResult {
  valid: boolean;
  error?: string;
}

export type TFileType = "pdf" | "image" | "unknown";

export interface IFileTypeDetector {
  detect(contentType: string, fileName: string): TFileType;
}

export interface IUploadRequest {
  fileName: string;
  contentType: string;
  size: number;
}

export interface IUploadResponse {
  success: boolean;
  uploadUrl?: string;
  fileId?: string;
  expiresIn?: number; // Deprecated: use expiresAt instead
  expiresAt?: string; // ISO timestamp when the presigned URL expires
  maxSizeBytes?: number; // Maximum allowed file size in bytes
  method?: string; // HTTP method to use with presigned URL (should be "PUT" for uploads)
  error?: string;
}

export interface IDownloadResponse {
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  expiresAt?: string;
  error?: string;
}

export interface IPresignedUrlService {
  generateUploadUrl(
    request: IUploadRequest,
  ): Promise<IUploadResponse>;
  generateDownloadUrl(
    fileId: string,
    fileName: string,
    s3Key: string,
    expirationSeconds?: number,
  ): Promise<IDownloadResponse>;
}

export interface IFileUploadResult {
  success: boolean;
  fileId?: string;
  key?: string;
  error?: string;
}

export interface IFileUploadService {
  upload(
    fileId: string,
    fileName: string,
    contentType: string,
    fileContent: Buffer,
    size: number,
  ): Promise<IFileUploadResult>;
}

export interface IFileMetadata {
  fileName: string;
  contentType: string;
  size: number;
  fileContent: Buffer;
}

export interface IFileValidationService {
  validate(metadata: IFileMetadata): Promise<IValidationResult>;
}

export type TFileStatus = "PENDING_UPLOAD" | "UPLOADED" | "FAILED" | "DELETED";

export interface IFile {
  fileId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: TFileStatus;
  s3Bucket: string;
  s3Key: string;
  createdAt: string;
  updatedAt: string;
  uploadedAt?: string;
  expiresAt?: string; // ISO timestamp when presigned URL expires (for PENDING_UPLOAD files)
  ttl?: number; // Unix epoch seconds for DynamoDB TTL (automatic deletion)
}

export interface IListFilesResult {
  files: IFile[];
  nextCursor?: string; // Base64-encoded LastEvaluatedKey for pagination
}

export interface IFileRepository {
  createFile(file: IFile): Promise<void>;
  updateFile(fileId: string, userId: string, updates: Partial<IFile>): Promise<void>;
  getFile(fileId: string, userId: string): Promise<IFile | null>;
  getFileById(fileId: string): Promise<IFile | null>;
  listFiles(userId: string, limit: number, cursor?: string): Promise<IListFilesResult>;
  deleteExpiredPendingFiles(expiredBefore: string): Promise<number>; // Returns count of deleted files
}

// API Request/Response Types (for HTTP API endpoints)

/**
 * Request body for POST /v1/files (presigned URL request)
 * Uses fileSizeBytes and mimeType to match API contract
 */
export interface IApiUploadRequest {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}

/**
 * Response from POST /v1/files (presigned URL response)
 */
export interface IApiUploadResponse {
  success: boolean;
  fileId?: string;
  uploadUrl?: string;
  expiresAt?: string;
  maxSizeBytes?: number;
  method?: string;
  error?: string;
}

/**
 * File metadata in API response format (uses id/name instead of fileId/fileName)
 * Response from GET /v1/files/:fileId
 */
export interface IApiFileMetadata {
  success: boolean;
  id?: string;
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
  status?: TFileStatus;
  createdAt?: string;
  updatedAt?: string;
  uploadedAt?: string;
  error?: string;
}

/**
 * File item in list response format (uses id/name instead of fileId/fileName)
 * Used in GET /v1/files response
 */
export interface IApiFileListItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: TFileStatus;
  createdAt: string;
  updatedAt: string;
  uploadedAt?: string;
}

/**
 * Response from GET /v1/files (list files with pagination)
 */
export interface IApiListFilesResponse {
  success: boolean;
  files?: IApiFileListItem[];
  nextCursor?: string;
  error?: string;
}

/**
 * Common error response format
 */
export interface IApiErrorResponse {
  success: false;
  error: string;
}

/**
 * Response from GET /v1/files/:fileId/download (download URL response)
 */
export interface IApiDownloadResponse {
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  expiresAt?: string;
  error?: string;
}

// UI-specific types (for frontend state management)

/**
 * File upload status for UI state tracking
 */
export type TFileUploadStatus = "pending" | "uploading" | "completed" | "error";

/**
 * File item in upload dialog state
 */
export interface IFileUploadItem {
  id: string;
  file: File;
  status: TFileUploadStatus;
  progress: number;
  fileId?: string;
  error?: string;
}

