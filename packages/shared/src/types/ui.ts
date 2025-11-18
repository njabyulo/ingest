/**
 * UI component types
 * Types for React components and UI-related interfaces
 */

export interface IFileListProps {
  onUploadClick: () => void;
}

export interface IFileCardProps {
  file: {
    id: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    status: "PENDING_UPLOAD" | "UPLOADED" | "FAILED" | "DELETED";
    createdAt: string;
    updatedAt: string;
    uploadedAt?: string;
  };
  isDownloading?: boolean;
  onDownload?: (fileId: string, fileName: string) => void;
}

export interface IFileGridProps {
  files: IFileCardProps["file"][];
  downloadingFileId: string | null;
  onDownload: (fileId: string, fileName: string) => void;
}

export interface IFileListHeaderProps {
  sortBy: string;
  onSortChange: (sortBy: string) => void;
}

