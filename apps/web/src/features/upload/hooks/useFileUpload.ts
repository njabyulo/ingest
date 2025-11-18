import { useRef, useCallback } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import * as Constants from "@ingest/shared/constants";
import * as Utils from "@ingest/shared/utils";

interface UseFileUploadOptions {
  onUploadComplete?: (fileId: string) => void;
  allowedTypes?: string[];
  maxSizeBytes?: number;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const {
    onUploadComplete,
    allowedTypes = Constants.File.FILE_CONSTANTS.ALLOWED_TYPES,
  } = options;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      // Validate file type
      if (!file.type || file.type.trim() === "") {
        return "File type could not be determined. Please select a valid PDF, JPEG, or PNG file.";
      }

      const normalizedFileType = file.type.toLowerCase();
      if (!allowedTypes.some((allowedType) => allowedType.toLowerCase() === normalizedFileType)) {
        return `Only PDF, JPEG, and PNG files are allowed. Received: ${file.type || "unknown"}`;
      }

      // Validate file size based on type
      const isImage = file.type.startsWith("image/");
      const maxSize = isImage ? Constants.File.FILE_CONSTANTS.MAX_SIZE_IMAGE : Constants.File.FILE_CONSTANTS.MAX_SIZE_PDF;
      if (file.size > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        return `File size ${fileSizeMB}MB exceeds maximum allowed size of ${maxSizeMB}MB for ${isImage ? "images" : "PDFs"}`;
      }

      return null;
    },
    [allowedTypes]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        toast.error("Upload failed", {
          description: validationError,
        });
        return;
      }

      // Create toast for upload progress
      const toastId = toast.loading(`Uploading ${file.name}...`, {
        description: `0% • 0 B / ${Utils.Formatters.formatFileSize(file.size)}`,
      });

      try {
        const result = await apiClient.uploadFile(file, (progress) => {
          // Update toast with progress
          const uploadedBytes = (progress / 100) * file.size;
          toast.loading(`Uploading ${file.name}...`, {
            id: toastId,
            description: `${progress}% • ${Utils.Formatters.formatFileSize(uploadedBytes)} / ${Utils.Formatters.formatFileSize(file.size)}`,
          });
        });

        if (result.success && result.fileId) {
          // Success toast
          toast.success(`Upload complete: ${file.name}`, {
            id: toastId,
            description: `File uploaded successfully`,
          });
          onUploadComplete?.(result.fileId);
        } else {
          // Error toast
          toast.error(`Upload failed: ${file.name}`, {
            id: toastId,
            description: result.error || "Upload failed",
          });
        }
      } catch (err) {
        toast.error(`Upload failed: ${file.name}`, {
          id: toastId,
          description: err instanceof Error ? err.message : "Upload failed",
        });
      }
    },
    [validateFile, onUploadComplete]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles) {
        Array.from(selectedFiles).forEach((file) => {
          uploadFile(file);
        });
        // Reset input value to allow selecting the same file again
        e.target.value = "";
      }
    },
    [uploadFile]
  );

  const openFileSelector = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    handleFileSelect,
    openFileSelector,
    uploadFile,
  };
}

