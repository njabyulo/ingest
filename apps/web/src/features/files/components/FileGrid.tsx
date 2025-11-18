import { memo } from "react";
import { FileCard } from "./FileCard";
import type * as Types from "@ingest/shared/types";

/**
 * Presentational component for file grid
 * Memoized to prevent unnecessary re-renders
 */
export const FileGrid = memo(function FileGrid({
  files,
  downloadingFileId,
  onDownload,
}: Types.Ui.IFileGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          isDownloading={downloadingFileId === file.id}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
});

