import { describe, it, expect, beforeEach } from "vitest";
import * as Utils from "../../utils";

describe("ValidateFileSize", () => {
  let validator: Utils.ValidateFileSize.ValidateFileSize;

  beforeEach(() => {
    validator = new Utils.ValidateFileSize.ValidateFileSize({
      maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    });
  });

  describe("validate - Valid file sizes", () => {
    it("should accept files within size limit", async () => {
      // Arrange
      const request = {
        size: 5 * 1024 * 1024, // 5 MB
      };

      // Act
      const result = await validator.validate(request);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept files at exact size limit", async () => {
      // Arrange
      const request = {
        size: 10 * 1024 * 1024, // Exactly 10 MB
      };

      // Act
      const result = await validator.validate(request);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept small files", async () => {
      // Arrange
      const request = {
        size: 1024, // 1 KB
      };

      // Act
      const result = await validator.validate(request);

      // Assert
      expect(result.valid).toBe(true);
    });

    it("should accept zero-byte files", async () => {
      // Arrange
      const request = {
        size: 0,
      };

      // Act
      const result = await validator.validate(request);

      // Assert
      expect(result.valid).toBe(true);
    });
  });

  describe("validate - Invalid file sizes", () => {
    it("should reject files exceeding size limit", async () => {
      // Arrange
      const request = {
        size: 11 * 1024 * 1024, // 11 MB (exceeds 10 MB limit)
      };

      // Act
      const result = await validator.validate(request);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("exceeds maximum allowed size");
      expect(result.error).toContain("10.00MB");
      expect(result.error).toContain("11.00MB");
    });

    it("should format file sizes correctly in error message", async () => {
      // Arrange
      const request = {
        size: 15 * 1024 * 1024, // 15 MB
      };

      // Act
      const result = await validator.validate(request);

      // Assert
      expect(result.valid).toBe(false);
      if (result.error) {
        expect(result.error).toContain("15.00MB");
        expect(result.error).toContain("10.00MB");
      }
    });

    it("should handle very large files", async () => {
      // Arrange
      const request = {
        size: 100 * 1024 * 1024, // 100 MB
      };

      // Act
      const result = await validator.validate(request);

      // Assert
      expect(result.valid).toBe(false);
      if (result.error) {
        expect(result.error).toContain("100.00MB");
      }
    });

    it("should handle fractional MB sizes correctly", async () => {
      // Arrange
      const request = {
        size: 10.5 * 1024 * 1024, // 10.5 MB
      };

      // Act
      const result = await validator.validate(request);

      // Assert
      expect(result.valid).toBe(false);
      if (result.error) {
        // Should show 10.50MB (rounded to 2 decimal places)
        expect(result.error).toMatch(/10\.\d{2}MB/);
      }
    });
  });

  describe("validate - Different max size configurations", () => {
    it("should work with different max size limits", async () => {
      // Arrange
      const smallValidator = new Utils.ValidateFileSize.ValidateFileSize({
        maxSizeBytes: 1024, // 1 KB
      });
      const largeValidator = new Utils.ValidateFileSize.ValidateFileSize({
        maxSizeBytes: 100 * 1024 * 1024, // 100 MB
      });

      // Act & Assert - Small validator
      const smallResult = await smallValidator.validate({ size: 2048 });
      expect(smallResult.valid).toBe(false);

      // Act & Assert - Large validator
      const largeResult = await largeValidator.validate({ size: 50 * 1024 * 1024 });
      expect(largeResult.valid).toBe(true);
    });

    it("should handle very small max size limits", async () => {
      // Arrange
      const tinyValidator = new Utils.ValidateFileSize.ValidateFileSize({
        maxSizeBytes: 100, // 100 bytes
      });

      // Act
      const result = await tinyValidator.validate({ size: 200 });

      // Assert
      expect(result.valid).toBe(false);
      if (result.error) {
        // Should format small sizes correctly (0.00MB for 100 bytes)
        expect(result.error).toContain("exceeds maximum allowed size");
      }
    });
  });

  describe("validate - Edge cases", () => {
    it("should handle boundary condition (size = maxSizeBytes)", async () => {
      // Arrange
      const maxSize = 10 * 1024 * 1024;
      const validator = new Utils.ValidateFileSize.ValidateFileSize({
        maxSizeBytes: maxSize,
      });
      const request = {
        size: maxSize,
      };

      // Act
      const result = await validator.validate(request);

      // Assert
      expect(result.valid).toBe(true);
    });

    it("should handle boundary condition (size = maxSizeBytes + 1)", async () => {
      // Arrange
      const maxSize = 10 * 1024 * 1024;
      const validator = new Utils.ValidateFileSize.ValidateFileSize({
        maxSizeBytes: maxSize,
      });
      const request = {
        size: maxSize + 1,
      };

      // Act
      const result = await validator.validate(request);

      // Assert
      expect(result.valid).toBe(false);
    });
  });
});

