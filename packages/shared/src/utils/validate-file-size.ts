import type {
  IValidator,
  IIngestRequest,
  IValidationResult,
} from "../types/file";
import type { ISizeValidatorConfig } from "../types/validator";

export class ValidateFileSize implements IValidator {
  constructor(private readonly config: ISizeValidatorConfig) {}

  async validate(
    request: IIngestRequest,
  ): Promise<IValidationResult> {
    if (request.size > this.config.maxSizeBytes) {
      const maxSizeMB = (this.config.maxSizeBytes / (1024 * 1024)).toFixed(2);
      const fileSizeMB = (request.size / (1024 * 1024)).toFixed(2);
      return {
        valid: false,
        error: `File size ${fileSizeMB}MB exceeds maximum allowed size of ${maxSizeMB}MB`,
      };
    }

    return { valid: true };
  }
}

