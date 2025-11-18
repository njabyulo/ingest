import { useState, useCallback, useRef, useEffect } from "react";
import { apiClient } from "@/lib/api";
import type * as Types from "@ingest/shared/types";
import * as Constants from "@ingest/shared/constants";

type FileItem = Types.File.IApiFileListItem;

interface UseFileListOptions {
  pageSize?: number;
  autoLoad?: boolean;
}

interface UseFileListReturn {
  files: FileItem[];
  loading: boolean;
  error: string | null;
  nextCursor: string | undefined;
  loadFiles: (cursor?: string, silent?: boolean) => Promise<void>;
  refresh: (silent?: boolean) => Promise<void>;
  hasMore: boolean;
}

/**
 * Custom hook for managing file list state and data fetching
 * Separates data logic from UI rendering
 */
export function useFileList(options: UseFileListOptions = {}): UseFileListReturn {
  const { pageSize = Constants.File.FILE_CONSTANTS.FILES_PER_PAGE, autoLoad = true } = options;
  
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const loadingRef = useRef(false);

  const loadFiles = useCallback(
    async (cursor?: string, silent: boolean = false) => {
      // Prevent concurrent calls (unless it's a pagination request or silent refresh)
      if (loadingRef.current && !cursor && !silent) {
        return;
      }

      try {
        loadingRef.current = true;
        // Only set loading state if not silent and not paginating
        if (!silent && !cursor) {
          setLoading(true);
        }
        setError(null);
        
        const result = await apiClient.listFiles(pageSize, cursor);

        if (result.success && result.files) {
          if (cursor) {
            // Append for pagination
            setFiles((prev) => {
              const existingIds = new Set(prev.map((f) => f.id));
              const newFiles = result.files!.filter((f) => !existingIds.has(f.id));
              return [...prev, ...newFiles];
            });
          } else {
            // Replace for refresh - merge with existing to preserve optimistic updates
            setFiles((prev) => {
              // Create a map of existing files for quick lookup
              const existingMap = new Map(prev.map((f) => [f.id, f]));
              
              // Update with new files from API, preserving any that aren't in the response
              const updatedFiles = result.files!.map((newFile) => {
                const existing = existingMap.get(newFile.id);
                if (existing) {
                  // Always prefer UPLOADED status over PENDING_UPLOAD (actual state from API)
                  if (existing.status === "PENDING_UPLOAD" && newFile.status === "UPLOADED") {
                    return newFile;
                  }
                  // If both are same status or existing is UPLOADED, prefer newer updatedAt timestamp
                  const existingDate = new Date(existing.updatedAt).getTime();
                  const newDate = new Date(newFile.updatedAt).getTime();
                  // Use the file with the more recent update
                  return newDate >= existingDate ? newFile : existing;
                }
                return newFile;
              });
              
              // Add any files that exist in prev but not in result
              // Only keep orphaned files if they're PENDING_UPLOAD (might not be in API yet)
              // This handles the case where a file was just uploaded but API hasn't indexed it yet
              const newFileIds = new Set(updatedFiles.map((f) => f.id));
              const orphanedFiles = prev.filter(
                (f) => !newFileIds.has(f.id) && f.status === "PENDING_UPLOAD"
              );
              
              return [...updatedFiles, ...orphanedFiles];
            });
          }
          setNextCursor(result.nextCursor);
        } else {
          if (!silent) {
            setError(result.error || "Failed to load files");
          }
        }
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : "Failed to load files");
        }
      } finally {
        if (!silent && !cursor) {
          setLoading(false);
        }
        loadingRef.current = false;
      }
    },
    [pageSize]
  );

  const refresh = useCallback((silent: boolean = false) => {
    return loadFiles(undefined, silent);
  }, [loadFiles]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      loadFiles();
    }
  }, [autoLoad, loadFiles]);

  // Listen for refresh events
  useEffect(() => {
    const handleRefreshEvent = (e: CustomEvent<{ fileId?: string }>) => {
      const { fileId } = e.detail || {};
      
      if (fileId) {
        // Optimistic update: try to fetch single file
        apiClient
          .getFileMetadata(fileId)
          .then((result) => {
            if (result.success && result.id && result.name) {
              const fileIdValue = result.id;
              const fileName = result.name;
              setFiles((prev) => {
                const existingIndex = prev.findIndex((f) => f.id === fileIdValue);
                const newFile: FileItem = {
                  id: fileIdValue,
                  name: fileName,
                  mimeType: result.mimeType || "application/octet-stream",
                  sizeBytes: result.sizeBytes || 0,
                  status: result.status || "PENDING_UPLOAD",
                  createdAt: result.createdAt ?? new Date().toISOString(),
                  updatedAt: result.updatedAt ?? new Date().toISOString(),
                  uploadedAt: result.uploadedAt,
                };

                if (existingIndex >= 0) {
                  const updated = [...prev];
                  updated[existingIndex] = newFile;
                  return updated;
                }
                return [newFile, ...prev];
              });
            } else {
              // Fallback to full refresh (silent to avoid loading flash)
              refresh(true);
            }
          })
          .catch(() => {
            // Fallback to full refresh on error (silent to avoid loading flash)
            refresh(true);
          });
      } else {
        // Full refresh (silent to avoid loading flash)
        refresh(true);
      }
    };

    window.addEventListener("refreshFileList", handleRefreshEvent as EventListener);
    return () => {
      window.removeEventListener("refreshFileList", handleRefreshEvent as EventListener);
    };
  }, [refresh]);

  return {
    files,
    loading,
    error,
    nextCursor,
    loadFiles,
    refresh,
    hasMore: !!nextCursor,
  };
}

