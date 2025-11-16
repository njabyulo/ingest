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
  expiresIn?: number;
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
}

export interface IFileRepository {
  createFile(file: IFile): Promise<void>;
  getFile(fileId: string, userId: string): Promise<IFile | null>;
}

