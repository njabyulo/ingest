import { useState, useEffect, useCallback } from "react";
import { FileText, MoreVertical, Search, Settings, Trash2, Upload as UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type * as Types from "@ingest/shared/types";
import { apiClient } from "@/lib/api";

type FileItem = Types.File.IApiFileListItem;

interface FileListProps {
  onUploadClick: () => void;
}

export function FileList({ onUploadClick }: FileListProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<string>("name");
  const [pollingInterval, setPollingInterval] = useState<number | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const loadFiles = useCallback(async (cursor?: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.listFiles(20, cursor);
      
      if (result.success && result.files) {
        if (cursor) {
          setFiles((prev) => [...prev, ...result.files!]);
        } else {
          setFiles(result.files);
        }
        setNextCursor(result.nextCursor);
      } else {
        setError(result.error || "Failed to load files");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    const handleRefreshEvent = () => {
      // Refresh immediately
      loadFiles();
    };
    window.addEventListener("refreshFileList", handleRefreshEvent);
    return () => {
      window.removeEventListener("refreshFileList", handleRefreshEvent);
    };
  }, [loadFiles]);

  // Poll for status updates when there are files with PENDING_UPLOAD status
  useEffect(() => {
    const hasPendingFiles = files.some(
      (file) => file.status === "PENDING_UPLOAD"
    );

    // Clear existing polling if no pending files
    if (!hasPendingFiles && pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
      return;
    }

    // Start polling if there are pending files and we're not already polling
    if (hasPendingFiles && !pollingInterval) {
      const interval = window.setInterval(() => {
        loadFiles();
      }, 2000);
      setPollingInterval(interval);

      // Stop polling after 30 seconds (max wait time)
      const timeoutId = window.setTimeout(() => {
        if (interval) {
          clearInterval(interval);
          setPollingInterval(null);
        }
      }, 30000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeoutId);
        setPollingInterval(null);
      };
    }
  }, [files, loadFiles, pollingInterval]);

  const sortedFiles = [...files].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "date":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "size":
        return b.sizeBytes - a.sizeBytes;
      default:
        return 0;
    }
  });

  return (
    <div className="flex h-screen bg-white">
      {/* Left Sidebar */}
      <div className="w-64 border-r border-gray-200 bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded bg-green-500 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-base font-semibold text-gray-900 tracking-tight">Drive</div>
              <div className="text-xs text-gray-500 font-normal mt-0.5">johnwork's workspace</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          <Button
            onClick={onUploadClick}
            className="w-full justify-start bg-white text-gray-900 border border-gray-200 hover:bg-gray-50"
          >
            <UploadIcon className="w-4 h-4 mr-2" />
            Upload
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-700 hover:bg-gray-50"
          >
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-700 hover:bg-gray-50"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-4 space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start bg-gray-100 text-gray-900 hover:bg-gray-100"
          >
            <FileText className="w-4 h-4 mr-2" />
            My Drive
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-700 hover:bg-gray-50"
          >
            <div className="w-4 h-4 mr-2 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <div className="w-3 h-3 rounded-full bg-gray-400 -ml-1" />
            </div>
            Shared with me
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-700 hover:bg-gray-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Trash
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">My Drive</h1>
            <div className="flex items-center gap-4">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort by Name</SelectItem>
                  <SelectItem value="date">Sort by Date</SelectItem>
                  <SelectItem value="size">Sort by Size</SelectItem>
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

        {/* File Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && files.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500 font-medium">Loading files...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-red-500">{error}</div>
            </div>
          ) : sortedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FileText className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-semibold text-gray-900">No files yet</p>
              <p className="text-sm mt-2 text-gray-500 font-normal">Upload your first PDF to get started</p>
              <Button onClick={onUploadClick} className="mt-4">
                <UploadIcon className="w-4 h-4 mr-2" />
                Upload File
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedFiles.map((file) => {
                const isPending = file.status === "PENDING_UPLOAD";
                return (
                  <div
                    key={file.id}
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
                      {!isPending && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
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
                        {file.mimeType === "application/pdf"
                          ? "PDF File"
                          : file.mimeType}
                      </p>
                      {file.status === "UPLOADED" && (
                        <p className="text-xs text-gray-400 leading-4 mt-0.5">
                          {formatFileSize(file.sizeBytes)} •{" "}
                          {formatDate(file.createdAt)}
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
              })}
            </div>
          )}

          {/* Load More */}
          {nextCursor && !loading && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={() => loadFiles(nextCursor)}
                disabled={loading}
              >
                Load More
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

