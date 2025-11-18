import { useMemo } from "react";
import type * as Types from "@ingest/shared/types";
import * as Constants from "@ingest/shared/constants";

type FileItem = Types.File.IApiFileListItem;

interface UseFileSortingOptions {
  files: FileItem[];
  sortBy: Constants.File.SortOption;
}

/**
 * Custom hook for sorting files
 * Memoizes sorted result to prevent unnecessary recalculations
 */
export function useFileSorting({
  files,
  sortBy,
}: UseFileSortingOptions): FileItem[] {
  return useMemo(() => {
    return [...files].sort((a, b) => {
      switch (sortBy) {
        case Constants.File.SORT_OPTIONS.NAME:
          return (a.name || "").localeCompare(b.name || "");
        case Constants.File.SORT_OPTIONS.DATE:
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        case Constants.File.SORT_OPTIONS.SIZE:
          return (b.sizeBytes || 0) - (a.sizeBytes || 0);
        default:
          return 0;
      }
    });
  }, [files, sortBy]);
}

