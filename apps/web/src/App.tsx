import { useState } from "react";
import { FileList } from "@/components/FileList";
import { FileUploadDialog } from "@/components/FileUploadDialog";

function App() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const handleUploadComplete = (fileId: string) => {
    console.log("Upload complete:", fileId);
    // Refresh file list after upload
    window.dispatchEvent(new CustomEvent("refreshFileList"));
  };

  return (
    <>
      <FileList onUploadClick={() => setUploadDialogOpen(true)} />
      <FileUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={handleUploadComplete}
      />
    </>
  );
}

export default App;
