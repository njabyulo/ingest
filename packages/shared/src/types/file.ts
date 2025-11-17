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

export interface IPresignedUrlService {
  generateUploadUrl(
    request: IUploadRequest,
  ): Promise<IUploadResponse>;
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

