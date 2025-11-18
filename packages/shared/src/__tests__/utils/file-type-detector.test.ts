import { describe, it, expect, beforeEach } from "vitest";
import * as Utils from "../../utils";

describe("FileTypeDetector", () => {
  let detector: Utils.DetectFileType.FileTypeDetector;

  beforeEach(() => {
    detector = new Utils.DetectFileType.FileTypeDetector();
  });

  describe("detect - PDF files", () => {
    it("should detect PDF from MIME type", () => {
      expect(detector.detect("application/pdf", "document")).toBe("pdf");
      expect(detector.detect("APPLICATION/PDF", "document")).toBe("pdf");
    });

    it("should detect PDF from file extension", () => {
      expect(detector.detect("application/octet-stream", "document.pdf")).toBe("pdf");
      expect(detector.detect("unknown/type", "file.PDF")).toBe("pdf");
    });

    it("should detect PDF from both MIME type and extension", () => {
      expect(detector.detect("application/pdf", "document.pdf")).toBe("pdf");
    });
  });

  describe("detect - Image files", () => {
    it("should detect images from MIME type", () => {
      expect(detector.detect("image/jpeg", "photo")).toBe("image");
      expect(detector.detect("image/png", "image")).toBe("image");
      expect(detector.detect("image/gif", "animation")).toBe("image");
      expect(detector.detect("image/webp", "picture")).toBe("image");
      expect(detector.detect("IMAGE/JPEG", "photo")).toBe("image");
    });

    it("should detect images from file extension", () => {
      expect(detector.detect("application/octet-stream", "photo.jpg")).toBe("image");
      expect(detector.detect("unknown/type", "image.JPEG")).toBe("image");
      expect(detector.detect("unknown/type", "picture.png")).toBe("image");
      expect(detector.detect("unknown/type", "animation.gif")).toBe("image");
      expect(detector.detect("unknown/type", "picture.webp")).toBe("image");
    });
  });

  describe("detect - Unknown files", () => {
    it("should return unknown for unrecognized types", () => {
      expect(detector.detect("text/plain", "document.txt")).toBe("unknown");
      expect(detector.detect("application/json", "data.json")).toBe("unknown");
      expect(detector.detect("application/zip", "archive.zip")).toBe("unknown");
      expect(detector.detect("unknown/type", "file.xyz")).toBe("unknown");
    });
  });

  describe("detect - Case insensitivity", () => {
    it("should handle case-insensitive MIME types", () => {
      expect(detector.detect("APPLICATION/PDF", "doc")).toBe("pdf");
      expect(detector.detect("Image/Jpeg", "photo")).toBe("image");
    });

    it("should handle case-insensitive file extensions", () => {
      expect(detector.detect("unknown/type", "DOCUMENT.PDF")).toBe("pdf");
      expect(detector.detect("unknown/type", "PHOTO.JPG")).toBe("image");
      expect(detector.detect("unknown/type", "image.PNG")).toBe("image");
    });
  });
});

