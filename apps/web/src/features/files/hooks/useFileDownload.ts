import { useState, useCallback } from "react";
import { apiClient } from "@/lib/api";

interface UseFileDownloadReturn {
  downloadingFileId: string | null;
  downloadFile: (fileId: string, fileName: string) => Promise<void>;
}

/**
 * Custom hook for handling file downloads
 * Manages download state and error handling
 */
export function useFileDownload(): UseFileDownloadReturn {
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  const downloadFile = useCallback(async (fileId: string, fileName: string) => {
    try {
      setDownloadingFileId(fileId);
      const result = await apiClient.downloadFile(fileId, fileName);
      if (!result.success) {
        throw new Error(result.error || "Failed to download file");
      }
    } catch (err) {
      // Error is handled by toast notifications in the component
      throw err;
    } finally {
      setDownloadingFileId(null);
    }
  }, []);

  return {
    downloadingFileId,
    downloadFile,
  };
}

