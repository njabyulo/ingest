import { memo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as Constants from "@ingest/shared/constants";
import type { SortOption } from "@ingest/shared/constants";

/**
 * Presentational component for file list header
 * Memoized to prevent unnecessary re-renders
 */
export const FileListHeader = memo(function FileListHeader({
  sortBy,
  onSortChange,
}: {
  sortBy: SortOption;
  onSortChange: (sortBy: SortOption) => void;
}) {
  return (
    <div className="p-6 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
          My Drive
        </h1>
        <div className="flex items-center gap-4">
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={Constants.File.SORT_OPTIONS.NAME}>Sort by Name</SelectItem>
              <SelectItem value={Constants.File.SORT_OPTIONS.DATE}>Sort by Date</SelectItem>
              <SelectItem value={Constants.File.SORT_OPTIONS.SIZE}>Sort by Size</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">-</span>
            <div className="w-32 h-1 bg-gray-200 rounded-full">
              <div className="w-1/2 h-full bg-gray-400 rounded-full" />
            </div>
            <span className="text-sm text-gray-500">+</span>
          </div>
        </div>
      </div>
    </div>
  );
});

