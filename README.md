# ingest

A production-ready, serverless file ingestion system built with TypeScript, Hono, SST, and AWS. Designed for scalable, cost-effective file uploads with metadata tracking and event-driven processing.

## Features

- **Presigned URL Uploads** - Direct-to-S3 uploads bypassing the backend (~99% cost reduction)
- **Metadata Tracking** - Full file metadata persistence in DynamoDB with status tracking
- **Event-Driven Status Updates** - Automatic status updates via S3 event notifications
- **Date-Organized Storage** - Files stored at `uploads/{userId}/{yyyy}/{mm}/{dd}/{fileId}.pdf`
- **Type-Safe Architecture** - Full TypeScript with interface-based dependency injection
- **Serverless-First** - Built on AWS Lambda, S3, DynamoDB, and API Gateway

## Architecture

```
Client → API Gateway → Lambda (Presigned URL) → DynamoDB (Metadata)
                                    ↓
                              S3 (Presigned URL)
                                    ↓
                              S3 Event → Lambda → DynamoDB (Status Update)
```

**Key Components:**
- **API Gateway** - RESTful API endpoints
- **Lambda Functions** - Request handler + S3 event processor
- **S3 Bucket** - Secure file storage with presigned URLs
- **DynamoDB** - Metadata persistence with status tracking
- **S3 Event Notifications** - Automatic status updates

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0
- AWS CLI configured with appropriate credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/njabyulo/ingest.git
cd ingest

# Install dependencies
pnpm install

# Deploy infrastructure
pnpm dev:infra:up
```

### Configuration

The system uses SST v3 for infrastructure (included as a dependency). Configure your AWS credentials and stage:

```bash
# Set AWS profile (optional)
export AWS_PROFILE=your-profile

# Deploy to specific stage
pnpm dev:infra:up  # Uses 'dev' stage by default

# SST is available via pnpm scripts or:
pnpm exec sst <command>
```

## API Documentation

### Request Presigned URL

**Endpoint:** `POST /v1/files`

**Request:**
```json
{
  "fileName": "document.pdf",
  "mimeType": "application/pdf",
  "fileSizeBytes": 1048576
}
```

**Response:**
```json
{
  "success": true,
  "fileId": "550e8400-e29b-41d4-a716-446655440000",
  "uploadUrl": "https://bucket.s3.amazonaws.com/uploads/...",
  "expiresIn": 300,
  "method": "PUT"
}
```

**Example (cURL):**
```bash
curl -X POST https://your-api.execute-api.region.amazonaws.com/v1/files \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "document.pdf",
    "mimeType": "application/pdf",
    "fileSizeBytes": 1048576
  }'
```

### Upload File to S3

**Using the presigned URL:**
```bash
curl -X PUT "https://bucket.s3.amazonaws.com/uploads/..." \
  -H "Content-Type: application/pdf" \
  --upload-file document.pdf
```

**Example (JavaScript/TypeScript):**
```typescript
// Step 1: Request presigned URL
const response = await fetch('https://your-api/v1/files', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: 'document.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: file.size
  })
});

const { fileId, uploadUrl, method } = await response.json();

// Step 2: Upload directly to S3
await fetch(uploadUrl, {
  method: method || 'PUT',
  headers: { 'Content-Type': 'application/pdf' },
  body: file
});

// Step 3: Check status (poll until UPLOADED)
const statusResponse = await fetch(`https://your-api/v1/files/${fileId}`);
const { status } = await statusResponse.json();
```

### Get File Metadata

**Endpoint:** `GET /v1/files/{fileId}`

**Response:**
```json
{
  "success": true,
  "fileId": "550e8400-e29b-41d4-a716-446655440000",
  "fileName": "document.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 1048576,
  "status": "UPLOADED",
  "s3Key": "uploads/userId/2024/01/15/fileId.pdf",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:05.000Z",
  "uploadedAt": "2024-01-15T10:00:05.000Z"
}
```

**Status Values:**
- `PENDING_UPLOAD` - Presigned URL generated, awaiting upload
- `UPLOADED` - File successfully uploaded to S3
- `FAILED` - Upload failed (future feature)
- `DELETED` - File marked as deleted (future feature)

## Integration Guide

### For Frontend Applications

```typescript
class FileUploader {
  constructor(private apiUrl: string) {}

  async uploadFile(file: File): Promise<string> {
    // 1. Request presigned URL
    const presignedResponse = await fetch(`${this.apiUrl}/v1/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size
      })
    });

    if (!presignedResponse.ok) {
      throw new Error('Failed to get presigned URL');
    }

    const { fileId, uploadUrl, method } = await presignedResponse.json();

    // 2. Upload to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: method || 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }

    // 3. Return fileId for status checking
    return fileId;
  }

  async getFileStatus(fileId: string) {
    const response = await fetch(`${this.apiUrl}/v1/files/${fileId}`);
    const data = await response.json();
    return data.status;
  }

  async waitForUpload(fileId: string, maxWait = 30000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      const status = await this.getFileStatus(fileId);
      if (status === 'UPLOADED') return;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Upload timeout');
  }
}
```

### For Backend Services

The system is designed as a monorepo with reusable packages:

**Using the Core Services:**
```typescript
import { PresignedUrlService } from '@ingest/core/services';
import { DynamoFileRepository } from '@ingest/core/repositories';

// Initialize services
const fileRepository = new DynamoFileRepository({
  tableName: 'YourFilesTable',
  dynamoClient: yourDynamoClient
});

const presignedUrlService = new PresignedUrlService({
  bucketName: 'your-bucket',
  s3Client: yourS3Client,
  fileTypeDetector: yourFileTypeDetector,
  fileRepository,
  userId: 'user-123'
});

// Generate presigned URL
const result = await presignedUrlService.generateUploadUrl({
  fileName: 'document.pdf',
  contentType: 'application/pdf',
  size: 1048576
});
```

## Project Structure

```
ingest/
├── apps/
│   └── functions/          # Lambda handlers
│       └── src/handlers/
│           ├── etl/        # API request handler
│           └── s3-events/  # S3 event handler
├── packages/
│   ├── core/              # Business logic (services, repositories)
│   └── shared/            # Shared types, utilities, constants
├── infra/                 # SST infrastructure definitions
│   ├── compute.ts         # Lambda functions
│   ├── network.ts         # API Gateway
│   └── storage.ts         # S3 & DynamoDB
└── docs/                  # Documentation
```

## Configuration

### File Size Limits

Edit `packages/shared/src/constants/file.ts`:

```typescript
export const FILE_CONSTANTS = {
  MAX_PDF_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  // ...
};
```

### Presigned URL Expiration

Edit `packages/core/src/services/presigned-url-service.ts`:

```typescript
private readonly defaultExpirationSeconds = 300; // 5 minutes
```

### S3 Key Pattern

The S3 key pattern is defined in `packages/shared/src/utils/aws.ts`:

```typescript
// Pattern: uploads/{userId}/{yyyy}/{mm}/{dd}/{fileId}.pdf
```

## Development

```bash
# Start development environment
pnpm dev:infra:up

# Build all packages
pnpm build

# Run linting
pnpm lint

# Run tests
pnpm test

# Clean up
pnpm dev:infra:down
```

## Roadmap

- [ ] File validation after upload (verify metadata matches)
- [ ] Cleanup mechanism for abandoned uploads
- [ ] File listing and query endpoints
- [ ] PDF text extraction
- [ ] Basic search over uploaded documents
- [ ] Multi-file type support (images, etc.)

See [docs/project/roadmap.md](docs/project/roadmap.md) for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines and code of conduct.

## License

MIT

## Author

**Njabulo Majozi**

- GitHub: [@njabyulo](https://github.com/njabyulo)
- Repository: [https://github.com/njabyulo/ingest](https://github.com/njabyulo/ingest)

## Related Documentation

- [System Design](docs/project/system-design.md)
- [Roadmap](docs/project/roadmap.md)
- [Development Logs](docs/writings/devlogs/)

---

**Built with:** TypeScript, Hono, SST v3, AWS (Lambda, S3, DynamoDB, API Gateway)
