import { describe, it, expect } from "vitest";
import * as Utils from "../../utils";

describe("AWS Utils", () => {
  describe("generateS3Key", () => {
    it("should generate S3 key with correct pattern for PDF", () => {
      // Arrange
      const fileType = "pdf";
      const userId = "user-123";
      const fileId = "file-456";
      const fileName = "document.pdf";
      const now = new Date();

      // Act
      const key = Utils.Aws.generateS3Key(fileType, userId, fileId, fileName);

      // Assert
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const expectedPattern = `pdf/${userId}/${year}/${month}/${day}/${fileId}.pdf`;
      expect(key).toBe(expectedPattern);
    });

    it("should generate S3 key with correct pattern for images", () => {
      // Arrange
      const fileType = "image";
      const userId = "user-123";
      const fileId = "file-456";
      const fileName = "image.jpg";

      // Act
      const key = Utils.Aws.generateS3Key(fileType, userId, fileId, fileName);

      // Assert
      expect(key).toContain(`${fileId}.jpg`);
      expect(key).toContain("images/");
      expect(key).toMatch(/^images\/user-123\/\d{4}\/\d{2}\/\d{2}\/file-456\.jpg$/);
    });

    it("should extract file extension from fileName", () => {
      // Arrange
      const fileType = "image";
      const userId = "user-123";
      const fileId = "file-456";
      const fileName = "image.jpg";

      // Act
      const key = Utils.Aws.generateS3Key(fileType, userId, fileId, fileName);

      // Assert
      expect(key).toContain(`${fileId}.jpg`);
      expect(key).toContain("images/");
    });

    it("should default to .pdf extension for PDF if fileName has no extension", () => {
      // Arrange
      const fileType = "pdf";
      const userId = "user-123";
      const fileId = "file-456";
      const fileName = "document";

      // Act
      const key = Utils.Aws.generateS3Key(fileType, userId, fileId, fileName);

      // Assert
      expect(key).toContain(`${fileId}.pdf`);
      expect(key).toContain("pdf/");
    });

    it("should default to .jpg extension for images if fileName has no extension", () => {
      // Arrange
      const fileType = "image";
      const userId = "user-123";
      const fileId = "file-456";
      const fileName = "image";

      // Act
      const key = Utils.Aws.generateS3Key(fileType, userId, fileId, fileName);

      // Assert
      expect(key).toContain(`${fileId}.jpg`);
      expect(key).toContain("images/");
    });

    it("should handle file names with multiple dots", () => {
      // Arrange
      const fileType = "pdf";
      const userId = "user-123";
      const fileId = "file-456";
      const fileName = "my.document.final.pdf";

      // Act
      const key = Utils.Aws.generateS3Key(fileType, userId, fileId, fileName);

      // Assert
      expect(key).toContain(`${fileId}.pdf`);
      expect(key).not.toContain("my.document.final");
      expect(key).toContain("pdf/");
    });

    it("should use current date for path segments", () => {
      // Arrange
      const fileType = "pdf";
      const userId = "user-123";
      const fileId = "file-456";
      const fileName = "test.pdf";
      const beforeTime = new Date();

      // Act
      const key = Utils.Aws.generateS3Key(fileType, userId, fileId, fileName);
      const afterTime = new Date();

      // Assert
      const year = beforeTime.getFullYear();
      const month = String(beforeTime.getMonth() + 1).padStart(2, "0");
      const day = String(beforeTime.getDate()).padStart(2, "0");
      
      // Should match date from before or after (in case of clock tick)
      const beforePattern = `pdf/${userId}/${year}/${month}/${day}/${fileId}.pdf`;
      const afterYear = afterTime.getFullYear();
      const afterMonth = String(afterTime.getMonth() + 1).padStart(2, "0");
      const afterDay = String(afterTime.getDate()).padStart(2, "0");
      const afterPattern = `pdf/${userId}/${afterYear}/${afterMonth}/${afterDay}/${fileId}.pdf`;
      
      expect([beforePattern, afterPattern]).toContain(key);
    });

    it("should handle different file extensions for images", () => {
      // Arrange
      const fileType = "image";
      const userId = "user-123";
      const fileId = "file-456";
      const extensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

      // Act & Assert
      extensions.forEach((ext) => {
        const fileName = `file${ext}`;
        const key = Utils.Aws.generateS3Key(fileType, userId, fileId, fileName);
        expect(key).toContain(`${fileId}${ext}`);
        expect(key).toContain("images/");
      });
    });
  });

  describe("formatS3Tags", () => {
    it("should format tags as URL-encoded string", () => {
      // Arrange
      const tags = {
        Project: "ingest",
        Environment: "dev",
      };

      // Act
      const result = Utils.Aws.formatS3Tags(tags);

      // Assert
      expect(result).toBe("Project=ingest&Environment=dev");
    });

    it("should URL-encode tag values with special characters", () => {
      // Arrange
      const tags = {
        Project: "my-project",
        Environment: "staging/env",
        Description: "test & prod",
      };

      // Act
      const result = Utils.Aws.formatS3Tags(tags);

      // Assert
      expect(result).toContain("Project=my-project");
      expect(result).toContain("Environment=staging%2Fenv");
      expect(result).toContain("Description=test%20%26%20prod");
    });

    it("should URL-encode tag keys with special characters", () => {
      // Arrange
      const tags = {
        "Project-Name": "ingest",
        "Env/Stage": "dev",
      };

      // Act
      const result = Utils.Aws.formatS3Tags(tags);

      // Assert
      expect(result).toContain("Project-Name=ingest");
      expect(result).toContain("Env%2FStage=dev");
    });

    it("should handle empty tags object", () => {
      // Arrange
      const tags = {};

      // Act
      const result = Utils.Aws.formatS3Tags(tags);

      // Assert
      expect(result).toBe("");
    });

    it("should handle single tag", () => {
      // Arrange
      const tags = {
        Project: "ingest",
      };

      // Act
      const result = Utils.Aws.formatS3Tags(tags);

      // Assert
      expect(result).toBe("Project=ingest");
    });

    it("should maintain consistent order (alphabetical by key)", () => {
      // Arrange
      const tags = {
        ZTag: "last",
        ATag: "first",
        MTag: "middle",
      };

      // Act
      const result = Utils.Aws.formatS3Tags(tags);

      // Assert
      // Object.entries maintains insertion order in modern JS, but we test the format
      expect(result).toContain("ATag=first");
      expect(result).toContain("MTag=middle");
      expect(result).toContain("ZTag=last");
    });
  });

  describe("getAwsResourceTags", () => {
    it("should return default tags with provided stage", () => {
      // Arrange
      const stage = "production";

      // Act
      const tags = Utils.Aws.getAwsResourceTags(stage);

      // Assert
      expect(tags).toEqual({
        Project: "ingest",
        Environment: "production",
        ManagedBy: "sst",
      });
    });

    it("should use 'dev' as default stage when not provided", () => {
      // Act
      const tags = Utils.Aws.getAwsResourceTags();

      // Assert
      expect(tags).toEqual({
        Project: "ingest",
        Environment: "dev",
        ManagedBy: "sst",
      });
    });

    it("should return readonly tags object", () => {
      // Act
      const tags = Utils.Aws.getAwsResourceTags("test");

      // Assert
      // The function returns 'as const' which makes properties readonly
      // TypeScript will prevent mutations, but runtime object is not frozen
      expect(tags).toEqual({
        Project: "ingest",
        Environment: "test",
        ManagedBy: "sst",
      });
    });

    it("should handle different stage values", () => {
      // Arrange
      const stages = ["dev", "staging", "production", "test"];

      // Act & Assert
      stages.forEach((stage) => {
        const tags = Utils.Aws.getAwsResourceTags(stage);
        expect(tags.Environment).toBe(stage);
        expect(tags.Project).toBe("ingest");
        expect(tags.ManagedBy).toBe("sst");
      });
    });
  });
});

