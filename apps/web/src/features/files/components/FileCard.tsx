import { memo } from "react";
import { FileText, MoreVertical, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as Utils from "@ingest/shared/utils";
import type * as Types from "@ingest/shared/types";

/**
 * Presentational component for a single file card
 * Memoized to prevent unnecessary re-renders
 */
export const FileCard = memo(function FileCard({
  file,
  isDownloading = false,
  onDownload,
}: Types.Ui.IFileCardProps) {
  const isPending = file.status === "PENDING_UPLOAD";

  return (
    <div
      className={`p-4 rounded-lg border transition-all ${
        isPending
          ? "border-gray-100 bg-gray-50 opacity-50 pointer-events-none cursor-not-allowed"
          : "border-gray-200 bg-white hover:shadow-md cursor-pointer group"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${
            isPending ? "bg-gray-300" : "bg-red-500"
          }`}
        >
          <FileText
            className={`w-6 h-6 ${
              isPending ? "text-gray-400" : "text-white"
            }`}
          />
        </div>
        {!isPending && onDownload && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(file.id, file.name);
                }}
                disabled={isDownloading}
              >
                <Download className="w-4 h-4 mr-2" />
                {isDownloading ? "Downloading..." : "Download"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="space-y-1">
        <h3
          className={`font-medium truncate text-sm leading-5 ${
            isPending ? "text-gray-400" : "text-gray-900"
          }`}
        >
          {file.name}
        </h3>
        <p
          className={`text-xs leading-4 mt-0.5 ${
            isPending ? "text-gray-400" : "text-gray-500"
          }`}
        >
          {Utils.Formatters.formatMimeType(file.mimeType)}
        </p>
        {file.status === "UPLOADED" && (
          <p className="text-xs text-gray-400 leading-4 mt-0.5">
                      {Utils.Formatters.formatFileSize(file.sizeBytes)} • {Utils.Formatters.formatDate(file.createdAt)}
          </p>
        )}
        {file.status === "PENDING_UPLOAD" && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <p className="text-xs text-amber-600 font-medium leading-4">
              Uploading...
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

