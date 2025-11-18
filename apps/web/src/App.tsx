import { useCallback } from "react";
import { FileList } from "@/features/files/components/FileList";
import { Wrapper } from "./components/layout/Wrapper";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useFileUpload } from "@/features/upload/hooks/useFileUpload";

function App() {
  const handleUploadComplete = useCallback((fileId: string) => {
    console.log("Upload complete:", fileId);
    // Refresh file list after upload
    window.dispatchEvent(new CustomEvent("refreshFileList", { detail: { fileId } }));
  }, []);

  const { openFileSelector, fileInputRef, handleFileSelect } = useFileUpload({
    onUploadComplete: handleUploadComplete,
  });

  return (
    <ErrorBoundary>
      <Wrapper onUploadClick={openFileSelector}>
        <FileList onUploadClick={openFileSelector} />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/jpg,image/png"
          onChange={handleFileSelect}
          multiple
          className="hidden"
        />
      </Wrapper>
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
