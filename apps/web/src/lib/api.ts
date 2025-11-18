import type * as Types from "@ingest/shared/types";

// SST injects VITE_API_URL during build and deployment via infra/web.ts
// For local development, use: pnpm dev:sst (which uses sst bind)
const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  console.error(
    "VITE_API_URL is not set. " +
    "For local development, use: pnpm dev:sst (which uses sst bind). " +
    "Or deploy infrastructure first: pnpm dev:infra:up"
  );
}

// Re-export types from shared for convenience
export type IUploadRequest = Types.File.IApiUploadRequest;
export type IUploadResponse = Types.File.IApiUploadResponse;
export type IFileMetadataResponse = Types.File.IApiFileMetadata;
export type IListFilesResponse = Types.File.IApiListFilesResponse;
export type IApiFileListItem = Types.File.IApiFileListItem;
export type IDownloadResponse = Types.File.IApiDownloadResponse;

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    if (!baseUrl) {
      throw new Error(
        "API_URL is not set. " +
        "For local development, use: pnpm dev:sst (which uses sst bind). " +
        "Or deploy infrastructure first: pnpm dev:infra:up"
      );
    }
    this.baseUrl = baseUrl;
  }

  /**
   * Request a presigned URL for file upload
   */
  async requestUploadUrl(request: IUploadRequest): Promise<IUploadResponse> {
    if (!this.baseUrl) {
      return {
        success: false,
        error: "API URL is not configured. Please ensure VITE_API_URL is set.",
      };
    }
    
    const url = `${this.baseUrl}/v1/files`;
    console.log("[ApiClient] Requesting presigned URL:", url, request);
    
    const response = await fetch(url, {
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
   * List files for the current user with pagination
   * Query parameters: limit (default 20, max 100), cursor (optional)
   * Returns: files array, nextCursor (if more results exist)
   */
  async listFiles(limit: number = 20, cursor?: string): Promise<IListFilesResponse> {
    if (!this.baseUrl) {
      return {
        success: false,
        error: "API URL is not configured. Please ensure VITE_API_URL is set.",
      };
    }

    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await fetch(`${this.baseUrl}/v1/files?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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
   * Get file metadata by fileId
   * Returns: id, name, mimeType, sizeBytes, status, timestamps (createdAt, updatedAt, uploadedAt)
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

    const data = await response.json();
    
    // Add backward compatibility fields
    if (data.id && !data.fileId) {
      data.fileId = data.id;
    }
    if (data.name && !data.fileName) {
      data.fileName = data.name;
    }
    
    return data;
  }

  /**
   * Request a presigned download URL for a file
   */
  async requestDownloadUrl(fileId: string): Promise<IDownloadResponse> {
    if (!this.baseUrl) {
      return {
        success: false,
        error: "API URL is not configured. Please ensure VITE_API_URL is set.",
      };
    }

    const response = await fetch(`${this.baseUrl}/v1/files/${fileId}/download`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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
   * Download a file by fileId
   * This will request a presigned URL and trigger the browser download
   */
  async downloadFile(fileId: string, fileName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.requestDownloadUrl(fileId);

      if (!result.success || !result.downloadUrl) {
        return {
          success: false,
          error: result.error || "Failed to get download URL",
        };
      }

      // Create a temporary anchor element to trigger download
      const link = document.createElement("a");
      link.href = result.downloadUrl;
      link.download = fileName || result.fileName || "download.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to download file",
      };
    }
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

// Initialize API client - will throw if VITE_API_URL is not set
let apiClient: ApiClient;
try {
  apiClient = new ApiClient();
  console.log("[ApiClient] Initialized with baseUrl:", apiClient['baseUrl'] || 'NOT SET');
} catch (error) {
  console.error("[ApiClient] Failed to initialize:", error);
  // Create a dummy client that will return errors
  apiClient = new ApiClient('') as ApiClient;
}

export { apiClient };

