import { memo } from "react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
}

/**
 * Error state component
 * Reusable error display with optional retry
 */
export const ErrorState = memo(function ErrorState({
  error,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64">
      <div className="text-red-500 mb-4">{error}</div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
});

