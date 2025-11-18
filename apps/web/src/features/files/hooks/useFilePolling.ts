import { useEffect, useRef } from "react";
import type * as Types from "@ingest/shared/types";
import * as Constants from "@ingest/shared/constants";

type FileItem = Types.File.IApiFileListItem;

interface UseFilePollingOptions {
  files: FileItem[];
  onPoll: () => void | Promise<void>;
  enabled?: boolean;
}

/**
 * Custom hook for polling file status updates
 * Automatically polls when there are pending files
 */
export function useFilePolling({
  files,
  onPoll,
  enabled = true,
}: UseFilePollingOptions): void {
  const pollingIntervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const onPollRef = useRef(onPoll);

  // Keep ref in sync
  useEffect(() => {
    onPollRef.current = onPoll;
  }, [onPoll]);

  useEffect(() => {
    if (!enabled) {
      // Clean up if disabled
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    const hasPendingFiles = files.some(
      (file) => file.status === "PENDING_UPLOAD"
    );

    // Clear existing polling if no pending files
    if (!hasPendingFiles) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Start polling if there are pending files and we're not already polling
    if (hasPendingFiles && !pollingIntervalRef.current) {
      const interval = window.setInterval(async () => {
        // Check if there are still pending files before polling
        // This prevents unnecessary API calls if files were updated
        try {
          await onPollRef.current();
        } catch (error) {
          console.error("Error during file polling:", error);
          // Continue polling even if there's an error
        }
      }, Constants.File.FILE_CONSTANTS.POLLING_INTERVAL);

      pollingIntervalRef.current = interval;

      // Stop polling after timeout
      const timeout = window.setTimeout(() => {
        if (pollingIntervalRef.current === interval) {
          clearInterval(interval);
          pollingIntervalRef.current = null;
          console.warn("File polling stopped after timeout");
        }
      }, Constants.File.FILE_CONSTANTS.POLLING_TIMEOUT);

      timeoutRef.current = timeout;

      return () => {
        if (pollingIntervalRef.current === interval) {
          clearInterval(interval);
          pollingIntervalRef.current = null;
        }
        if (timeoutRef.current === timeout) {
          clearTimeout(timeout);
          timeoutRef.current = null;
        }
      };
    }
  }, [files, enabled]);
}

