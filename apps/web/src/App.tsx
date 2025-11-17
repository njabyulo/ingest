import { FileUpload } from "@/components/FileUpload";

function App() {
  const handleUploadComplete = (fileId: string) => {
    console.log("Upload complete:", fileId);
  };

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#F8F4F1' }}>
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#111111' }}>File Ingest</h1>
          <p style={{ color: '#111111', opacity: 0.7 }}>
            Upload your PDF files securely to S3
          </p>
        </header>
        <FileUpload onUploadComplete={handleUploadComplete} />
      </div>
    </div>
  );
}

export default App;
