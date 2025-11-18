/**
 * Utility functions for formatting data
 * Extracted to prevent recreation on every render
 */

export function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return "Unknown date";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Invalid date";
  }
}

export function formatMimeType(mimeType: string | undefined): string {
  if (!mimeType) return "Unknown";
  if (mimeType === "application/pdf") return "PDF File";
  if (mimeType.startsWith("image/")) return "Image File";
  return mimeType;
}

