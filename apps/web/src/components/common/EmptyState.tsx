import { memo } from "react";
import { FileText, Upload as UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Empty state component
 * Reusable empty state display
 */
export const EmptyState = memo(function EmptyState({
  title = "No files yet",
  description = "Upload your first file to get started",
  actionLabel = "Upload File",
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
      <FileText className="w-16 h-16 mb-4 opacity-50" />
      <p className="text-lg font-semibold text-gray-900">{title}</p>
      <p className="text-sm mt-2 text-gray-500 font-normal">{description}</p>
      {onAction && (
        <Button onClick={onAction} className="mt-4">
          <UploadIcon className="w-4 h-4 mr-2" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
});

