import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, X, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type * as Types from "@ingest/shared/types";
import { apiClient } from "@/lib/api";

type FileItem = Types.File.IFileUploadItem;

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: (fileId: string) => void;
}

export function FileUploadDialog({
  open,
  onOpenChange,
  onUploadComplete,
}: FileUploadDialogProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleUpload = useCallback(
    async (fileItemId: string, file?: File) => {
      let fileItem: FileItem | undefined;
      if (file) {
        fileItem = {
          id: fileItemId,
          file,
          status: "pending",
          progress: 0,
        };
      } else {
        setFiles((prev) => {
          const found = prev.find((f) => f.id === fileItemId);
          if (found) {
            fileItem = found;
          }
          return prev;
        });
      }

      if (!fileItem) {
        console.error("[FileUpload] File item not found for ID:", fileItemId);
        return;
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItemId ? { ...f, status: "uploading", progress: 0 } : f
        )
      );

      try {
        const result = await apiClient.uploadFile(fileItem.file, (progress) => {
          setFiles((prev) =>
            prev.map((f) => {
              if (f.id === fileItemId && f.status === "uploading") {
                return { ...f, progress };
              }
              return f;
            })
          );
        });

        if (result.success && result.fileId) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileItemId
                ? {
                    ...f,
                    status: "completed",
                    progress: 100,
                    fileId: result.fileId,
                  }
                : f
            )
          );
          onUploadComplete?.(result.fileId);
        } else {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileItemId
                ? {
                    ...f,
                    status: "error",
                    error: result.error || "Upload failed",
                  }
                : f
            )
          );
        }
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItemId
              ? {
                  ...f,
                  status: "error",
                  error: err instanceof Error ? err.message : "Upload failed",
                }
              : f
          )
        );
      }
    },
    [onUploadComplete]
  );

  const handleFileSelect = useCallback(
    (selectedFiles: FileList | File[]) => {
      const fileArray = Array.from(selectedFiles);

      fileArray.forEach((file) => {
        if (file.type !== "application/pdf") {
          alert("Only PDF files are allowed in v1");
          return;
        }

        const maxSizeBytes = 10 * 1024 * 1024;
        if (file.size > maxSizeBytes) {
          const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
          const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
          alert(
            `File size ${fileSizeMB}MB exceeds maximum allowed size of ${maxSizeMB}MB`
          );
          return;
        }

        const fileItem: FileItem = {
          id: `${Date.now()}-${Math.random()}`,
          file,
          status: "pending",
          progress: 0,
        };

        setFiles((prev) => [...prev, fileItem]);

        setTimeout(() => {
          handleUpload(fileItem.id, file);
        }, 100);
      });
    },
    [handleUpload]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles) {
        handleFileSelect(selectedFiles);
      }
    },
    [handleFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        handleFileSelect(droppedFiles);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemove = useCallback((fileItemId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileItemId));
  }, []);

  const handleUploadButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Clear files after a short delay to allow animations to complete
    setTimeout(() => {
      setFiles([]);
    }, 300);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#FF8550" }}
            >
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: "#111111" }}>
                Upload files
              </h2>
              <DialogDescription className="text-sm text-gray-600 font-normal">
                Select and upload the files of your choice
              </DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drag & Drop Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors"
            style={{
              borderColor: "#F8F4F1",
              padding: "3rem",
              backgroundColor: "#F8F4F1",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#FF8550";
              e.currentTarget.style.backgroundColor = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#F8F4F1";
              e.currentTarget.style.backgroundColor = "#F8F4F1";
            }}
            onClick={handleUploadButtonClick}
          >
            <Button
              className="mb-4 text-white hover:opacity-90"
              style={{ backgroundColor: "#FF8550" }}
              onClick={(e) => {
                e.stopPropagation();
                handleUploadButtonClick();
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
            <p className="text-sm mb-1 font-medium" style={{ color: "#111111" }}>
              Choose a file or drag & drop it here
            </p>
            <p className="text-xs font-normal" style={{ color: "#111111", opacity: 0.6 }}>
              Maximum 10 MB file size
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileInputChange}
            multiple
            className="hidden"
          />

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-4">
              {files.map((fileItem) => (
                <motion.div
                  key={fileItem.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-4 rounded-lg"
                  style={{ padding: "1rem", backgroundColor: "#F8F4F1" }}
                >
                  {/* PDF Icon */}
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "#FF8550" }}
                  >
                    <span className="text-white text-xs font-bold">PDF</span>
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate leading-5"
                      style={{ color: "#111111" }}
                    >
                      {fileItem.file.name}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      <p
                        className="text-xs leading-4 font-normal"
                        style={{ color: "#111111", opacity: 0.7 }}
                      >
                        {fileItem.status === "uploading"
                          ? `${formatFileSize(
                              (fileItem.progress / 100) * fileItem.file.size
                            )} / ${formatFileSize(fileItem.file.size)}`
                          : `${formatFileSize(fileItem.file.size)}`}
                      </p>
                      {fileItem.status === "uploading" && (
                        <div className="flex items-center gap-2">
                          <Loader2
                            className="w-3 h-3 animate-spin"
                            style={{ color: "#FF8550" }}
                          />
                          <span
                            className="text-xs font-medium"
                            style={{ color: "#FF8550" }}
                          >
                            Uploading...
                          </span>
                        </div>
                      )}
                      {fileItem.status === "completed" && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2
                            className="w-4 h-4"
                            style={{ color: "#FF8550" }}
                          />
                          <span
                            className="text-xs font-medium"
                            style={{ color: "#FF8550" }}
                          >
                            Completed
                          </span>
                        </div>
                      )}
                      {fileItem.status === "error" && (
                        <div className="flex items-center gap-2">
                          <X className="w-4 h-4" style={{ color: "#ef4444" }} />
                          <span
                            className="text-xs font-medium"
                            style={{ color: "#ef4444" }}
                          >
                            Failed
                          </span>
                        </div>
                      )}
                    </div>
                    {fileItem.status === "uploading" && (
                      <div className="mt-2">
                        <div
                          className="w-full rounded-full h-2 overflow-hidden"
                          style={{ backgroundColor: "#F8F4F1" }}
                        >
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background:
                                "linear-gradient(to right, #FF8550, #FF8550)",
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${fileItem.progress}%` }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span
                            className="text-xs"
                            style={{ color: "#111111", opacity: 0.6 }}
                          >
                            {fileItem.progress < 100
                              ? "Uploading..."
                              : "Processing..."}
                          </span>
                          <span
                            className="text-xs font-semibold"
                            style={{ color: "#111111" }}
                          >
                            {fileItem.progress}%
                          </span>
                        </div>
                      </div>
                    )}
                    {fileItem.status === "error" && fileItem.error && (
                      <div className="mt-2">
                        <p className="text-xs" style={{ color: "#ef4444" }}>
                          {fileItem.error}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleRemove(fileItem.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0"
                    style={{ color: "#111111" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {fileItem.status === "uploading" ? (
                      <X className="w-4 h-4" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

