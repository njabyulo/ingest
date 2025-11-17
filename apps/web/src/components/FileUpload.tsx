import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, X, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";

type FileUploadStatus = "pending" | "uploading" | "completed" | "error";

interface FileItem {
  id: string;
  file: File;
  status: FileUploadStatus;
  progress: number;
  fileId?: string;
  error?: string;
}

interface FileUploadProps {
  onUploadComplete?: (fileId: string) => void;
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleUpload = useCallback(async (fileItemId: string, file?: File) => {
    // Use the file parameter if provided, otherwise find from state
    let fileItem: FileItem | undefined;
    if (file) {
      // Create fileItem from provided file
      fileItem = {
        id: fileItemId,
        file,
        status: "pending",
        progress: 0,
      };
    } else {
      // Find from current state
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

    // Update status to uploading
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileItemId ? { ...f, status: "uploading", progress: 0 } : f
      )
    );

    try {
      console.log("[FileUpload] Starting upload for:", fileItem.file.name, fileItem.file.size);
      // Track real upload progress
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
  }, [onUploadComplete]);

  const handleFileSelect = useCallback((selectedFiles: FileList | File[]) => {
    const fileArray = Array.from(selectedFiles);
    
    fileArray.forEach((file) => {
      // Validate file type (only PDF in v1)
      if (file.type !== "application/pdf") {
        alert("Only PDF files are allowed in v1");
        return;
      }

      // Validate file size (10 MB limit)
      const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
      if (file.size > maxSizeBytes) {
        const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        alert(`File size ${fileSizeMB}MB exceeds maximum allowed size of ${maxSizeMB}MB`);
        return;
      }

      const fileItem: FileItem = {
        id: `${Date.now()}-${Math.random()}`,
        file,
        status: "pending",
        progress: 0,
      };

      setFiles((prev) => [...prev, fileItem]);
      
      // Auto-upload when file is added - pass file directly to avoid closure issue
      setTimeout(() => {
        handleUpload(fileItem.id, file);
      }, 100);
    });
  }, [handleUpload]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles) {
        handleFileSelect(selectedFiles);
      }
    },
    [handleFileSelect],
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
    [handleFileSelect],
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

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div 
        className="w-full max-w-2xl mx-auto overflow-hidden" 
        style={{ 
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          border: '1px solid #F8F4F1'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b" style={{ borderColor: '#F8F4F1', padding: '1.5rem' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#FF8550" }}
            >
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: "#111111" }}>Upload files</h2>
              <p className="text-sm" style={{ color: "#111111", opacity: 0.7 }}>Select and upload the files of your choice</p>
            </div>
          </div>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "#111111" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F8F4F1"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            onClick={() => setFiles([])}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Drag & Drop Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors"
            style={{ borderColor: "#F8F4F1", padding: '3rem', backgroundColor: "#F8F4F1" }}
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
            <p className="text-sm mb-1" style={{ color: "#111111" }}>
              Choose a file or drag & drop it here
            </p>
            <p className="text-xs" style={{ color: "#111111", opacity: 0.6 }}>Maximum 10 MB file size</p>
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
            <div className="mt-6 space-y-4">
              {files.map((fileItem) => (
                <motion.div
                  key={fileItem.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-4 rounded-lg"
                  style={{ padding: '1rem', backgroundColor: '#F8F4F1' }}
                >
                  {/* PDF Icon */}
                  <div className="w-10 h-10 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: "#FF8550" }}>
                    <span className="text-white text-xs font-bold">PDF</span>
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#111111" }}>
                      {fileItem.file.name}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-xs" style={{ color: "#111111", opacity: 0.7 }}>
                        {fileItem.status === "uploading"
                          ? `${formatFileSize((fileItem.progress / 100) * fileItem.file.size)} / ${formatFileSize(fileItem.file.size)}`
                          : `${formatFileSize(fileItem.file.size)}`}
                      </p>
                      {fileItem.status === "uploading" && (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" style={{ color: "#FF8550" }} />
                          <span className="text-xs font-medium" style={{ color: "#FF8550" }}>Uploading...</span>
                        </div>
                      )}
                      {fileItem.status === "completed" && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" style={{ color: "#FF8550" }} />
                          <span className="text-xs font-medium" style={{ color: "#FF8550" }}>Completed</span>
                        </div>
                      )}
                      {fileItem.status === "error" && (
                        <div className="flex items-center gap-2">
                          <X className="w-4 h-4" style={{ color: "#ef4444" }} />
                          <span className="text-xs font-medium" style={{ color: "#ef4444" }}>Failed</span>
                        </div>
                      )}
                    </div>
                    {fileItem.status === "uploading" && (
                      <div className="mt-2">
                        <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: "#F8F4F1" }}>
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background: "linear-gradient(to right, #FF8550, #FF8550)",
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${fileItem.progress}%` }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs" style={{ color: "#111111", opacity: 0.6 }}>
                            {fileItem.progress < 100 ? "Uploading..." : "Processing..."}
                          </span>
                          <span className="text-xs font-semibold" style={{ color: "#111111" }}>
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
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
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
      </div>
    </div>
  );
}
