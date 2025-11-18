import { memo } from "react";

interface LoadingStateProps {
  message?: string;
}

/**
 * Loading state component
 * Reusable loading indicator
 */
export const LoadingState = memo(function LoadingState({
  message = "Loading...",
}: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500 font-medium">{message}</div>
    </div>
  );
});

