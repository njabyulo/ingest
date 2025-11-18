import { useState, useCallback } from "react";
import { useFileList } from "../hooks/useFileList";
import { useFilePolling } from "../hooks/useFilePolling";
import { useFileSorting } from "../hooks/useFileSorting";
import { useFileDownload } from "../hooks/useFileDownload";
import { FileGrid } from "./FileGrid";
import { FileListHeader } from "./FileListHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type * as Types from "@ingest/shared/types";
import * as Constants from "@ingest/shared/constants";

/**
 * Container component for file list
 * Handles data fetching and state management
 * Delegates rendering to presentational components
 */
export function FileList({ onUploadClick }: Types.Ui.IFileListProps) {
  const [sortBy, setSortBy] = useState<Constants.File.SortOption>("name");

  // Custom hooks for business logic
  const {
    files,
    loading,
    error,
    nextCursor,
    loadFiles,
    refresh,
    hasMore,
  } = useFileList();

  const sortedFiles = useFileSorting({ files, sortBy });

  const { downloadingFileId, downloadFile } = useFileDownload();

      // Poll for status updates when there are pending files
      // Use silent refresh to avoid showing loading state during polling
      useFilePolling({
        files,
        onPoll: async () => {
          await loadFiles(undefined, true);
        },
        enabled: true,
      });

  const handleDownload = useCallback(
    async (fileId: string, fileName: string) => {
      try {
        await downloadFile(fileId, fileName);
      } catch (err) {
        toast.error("Download failed", {
          description: err instanceof Error ? err.message : "Failed to download file",
        });
      }
    },
    [downloadFile]
  );

  const handleLoadMore = useCallback(() => {
    if (nextCursor) {
      loadFiles(nextCursor);
    }
  }, [nextCursor, loadFiles]);

  const handleRetry = useCallback(() => {
    refresh();
  }, [refresh]);

  // Render states
  if (loading && files.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <FileListHeader sortBy={sortBy} onSortChange={setSortBy} />
        <div className="flex-1 overflow-y-auto p-6">
          <LoadingState message="Loading files..." />
        </div>
      </div>
    );
  }

  if (error && files.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <FileListHeader sortBy={sortBy} onSortChange={setSortBy} />
        <div className="flex-1 overflow-y-auto p-6">
          <ErrorState error={error} onRetry={handleRetry} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <FileListHeader sortBy={sortBy} onSortChange={setSortBy} />
      <div className="flex-1 overflow-y-auto p-6">
        {sortedFiles.length === 0 ? (
          <EmptyState
            title="No files yet"
            description="Upload your first file to get started"
            actionLabel="Upload File"
            onAction={onUploadClick}
          />
        ) : (
          <>
            <FileGrid
              files={sortedFiles}
              downloadingFileId={downloadingFileId}
              onDownload={handleDownload}
            />
            {hasMore && !loading && (
              <div className="mt-6 text-center">
                <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

