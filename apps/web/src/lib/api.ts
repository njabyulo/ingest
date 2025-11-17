import type * as Types from "@ingest/shared/types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface IUploadRequest {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}

export interface IUploadResponse {
  success: boolean;
  fileId?: string;
  uploadUrl?: string;
  expiresAt?: string;
  maxSizeBytes?: number;
  method?: string;
  error?: string;
}

export interface IFileMetadataResponse {
  success: boolean;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  status?: Types.File.TFileStatus;
  s3Key?: string;
  createdAt?: string;
  updatedAt?: string;
  uploadedAt?: string;
  error?: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Request a presigned URL for file upload
   */
  async requestUploadUrl(request: IUploadRequest): Promise<IUploadResponse> {
    const response = await fetch(`${this.baseUrl}/v1/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: request.fileName,
        mimeType: request.mimeType,
        fileSizeBytes: request.fileSizeBytes,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      return {
        success: false,
        error: error.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return await response.json();
  }

  /**
   * Upload file directly to S3 using presigned URL with progress tracking
   */
  async uploadToS3(
    uploadUrl: string,
    file: File,
    method: string = "PUT",
    onProgress?: (progress: number) => void,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable && onProgress) {
            const progress = Math.round((e.loaded / e.total) * 100);
            onProgress(progress);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ success: true });
          } else {
            resolve({
              success: false,
              error: `Upload failed: HTTP ${xhr.status}: ${xhr.statusText}`,
            });
          }
        });

        xhr.addEventListener("error", () => {
          resolve({
            success: false,
            error: "Network error during upload",
          });
        });

        xhr.addEventListener("abort", () => {
          resolve({
            success: false,
            error: "Upload was cancelled",
          });
        });

        xhr.open(method, uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown upload error",
      };
    }
  }

  /**
   * Get file metadata by fileId
   */
  async getFileMetadata(fileId: string): Promise<IFileMetadataResponse> {
    const response = await fetch(`${this.baseUrl}/v1/files/${fileId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: "File not found",
        };
      }

      const error = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      return {
        success: false,
        error: error.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return await response.json();
  }

  /**
   * Complete upload flow: request presigned URL and upload file
   */
  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<{
    success: boolean;
    fileId?: string;
    error?: string;
  }> {
    // Step 1: Request presigned URL
    const uploadRequest = await this.requestUploadUrl({
      fileName: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size,
    });

    if (!uploadRequest.success || !uploadRequest.uploadUrl || !uploadRequest.fileId) {
      return {
        success: false,
        error: uploadRequest.error || "Failed to request upload URL",
      };
    }

    // Step 2: Upload to S3 with progress tracking
    const uploadResult = await this.uploadToS3(
      uploadRequest.uploadUrl,
      file,
      uploadRequest.method || "PUT",
      onProgress,
    );

    if (!uploadResult.success) {
      return {
        success: false,
        fileId: uploadRequest.fileId,
        error: uploadResult.error || "Failed to upload file to S3",
      };
    }

    return {
      success: true,
      fileId: uploadRequest.fileId,
    };
  }
}

export const apiClient = new ApiClient();

