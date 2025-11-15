import type {
  IFileTypeDetector,
  TFileType,
} from "../../../types/ingest";

export class FileTypeDetector implements IFileTypeDetector {
  detect(contentType: string, fileName: string): TFileType {
    const lowerContentType = contentType.toLowerCase();
    const lowerFileName = fileName.toLowerCase();

    if (lowerContentType.includes("pdf") || lowerFileName.endsWith(".pdf")) {
      return "pdf";
    }

    if (
      lowerContentType.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(lowerFileName)
    ) {
      return "image";
    }

    return "unknown";
  }
}

