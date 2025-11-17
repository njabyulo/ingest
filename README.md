# ingest

A production-ready, serverless file ingestion system built with TypeScript, Hono, SST, and AWS. Designed for scalable, cost-effective file uploads with metadata tracking and event-driven processing.

## Features

- **Presigned URL Uploads** - Direct-to-S3 uploads bypassing the backend (~99% cost reduction)
- **Metadata Tracking** - Full file metadata persistence in DynamoDB with status tracking
- **Event-Driven Status Updates** - Automatic status updates via S3 event notifications
- **Date-Organized Storage** - Files stored at `uploads/{userId}/{yyyy}/{mm}/{dd}/{fileId}.pdf`
- **Type-Safe Architecture** - Full TypeScript with interface-based dependency injection
- **Serverless-First** - Built on AWS Lambda, S3, DynamoDB, and API Gateway
- **Modern Web UI** - React + Vite frontend with real-time upload progress tracking
- **Real Progress Tracking** - XMLHttpRequest-based upload progress with visual feedback

## Architecture

```
Web UI (React) → API Gateway → Lambda (Presigned URL) → DynamoDB (Metadata)
     ↓                              ↓
  S3 (Direct Upload)         S3 (Presigned URL)
     ↓                              ↓
  S3 Event → Lambda → DynamoDB (Status Update)
```

**Key Components:**
- **Web Application** - React + Vite frontend with drag-and-drop file upload
- **API Gateway** - RESTful API endpoints
- **Lambda Functions** - Request handler + S3 event processor
- **S3 Bucket** - Secure file storage with presigned URLs
- **DynamoDB** - Metadata persistence with status tracking
- **S3 Event Notifications** - Automatic status updates
- **Dead Letter Queue** - Failed event processing capture

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

# Deploy infrastructure (includes API and web app)
pnpm dev:infra:up
```

### Running the Web Application Locally

The web application is automatically started when you run `pnpm dev:infra:up`. However, for standalone development:

```bash
# Option 1: Use SST bind (Recommended)
# This automatically injects VITE_API_URL from your deployed infrastructure
cd apps/web
pnpm dev:sst

# Option 2: Run without SST bind
# Note: You'll need to manually set VITE_API_URL or the app won't work
cd apps/web
pnpm dev

# The app will be available at http://localhost:5173
# Make sure you've deployed the infrastructure first: pnpm dev:infra:up
```

**Important:** The web app requires the API to be deployed first. SST automatically injects the API Gateway URL as `VITE_API_URL` when using `pnpm dev:sst` or during production builds.

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
  "expiresAt": "2024-01-15T10:05:00.000Z",
  "expiresIn": 300,
  "maxSizeBytes": 10485760,
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

**Example (JavaScript/TypeScript with Progress Tracking):**
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

const { fileId, uploadUrl, expiresAt, maxSizeBytes, method } = await response.json();

// Step 2: Upload directly to S3 with progress tracking
const xhr = new XMLHttpRequest();
xhr.upload.addEventListener('progress', (e) => {
  if (e.lengthComputable) {
    const progress = Math.round((e.loaded / e.total) * 100);
    console.log(`Upload progress: ${progress}%`);
  }
});

xhr.open(method || 'PUT', uploadUrl);
xhr.setRequestHeader('Content-Type', 'application/pdf');
xhr.send(file);

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

### Using the Built-in Web Application

The project includes a production-ready React frontend with:
- Drag-and-drop file upload
- Real-time progress tracking with visual progress bar
- Visual status indicators (Uploading/Completed/Failed)
- Error handling and validation
- PDF-only validation (v1)
- 10MB file size limit enforcement

**Complete Upload Flow:**
1. User selects or drags a PDF file
2. File is validated (type and size)
3. Presigned URL is requested from the API
4. File is uploaded directly to S3 with progress tracking
5. Status updates automatically when upload completes
6. S3 event triggers Lambda to update DynamoDB status to `UPLOADED`

```bash
# Deploy the full stack (API + Web)
pnpm dev:infra:up

# The web app is automatically deployed to AWS CloudFront
# Access it via the URL shown in the SST console output
```

**Local Development:**
```bash
# Run web app locally with SST environment injection
cd apps/web
pnpm dev:sst
```

### For Frontend Applications

**Using the API Client Pattern:**

The web app includes a complete API client implementation. You can reference `apps/web/src/lib/api.ts` as an example, or copy the `ApiClient` class to your own project:

```typescript
// Example usage (adjust import path based on your setup)
import { apiClient } from './lib/api';

// Complete upload flow with progress tracking
const result = await apiClient.uploadFile(file, (progress) => {
  console.log(`Upload progress: ${progress}%`);
});

if (result.success && result.fileId) {
  // Get file metadata
  const metadata = await apiClient.getFileMetadata(result.fileId);
  console.log('File status:', metadata.status);
}
```

**Custom Implementation:**

```typescript
class FileUploader {
  constructor(private apiUrl: string) {}

  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<string> {
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

    // 2. Upload to S3 with progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(fileId);
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.open(method || 'PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
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
│   ├── functions/          # Lambda handlers
│   │   └── src/handlers/
│   │       ├── api/
│   │       │   └── files.ts            # HTTP API request handler (POST /v1/files, GET /v1/files/{fileId})
│   │       └── events/
│   │           └── file-upload.ts     # S3 file upload event handler
│   └── web/                # React + Vite frontend application
│       ├── src/
│       │   ├── components/
│       │   │   ├── FileUpload.tsx     # Main file upload component
│       │   │   └── ui/                # shadcn/ui components
│       │   └── lib/
│       │       └── api.ts             # API client with progress tracking
│       └── package.json
├── packages/
│   ├── core/              # Business logic (services, repositories)
│   └── shared/            # Shared types, utilities, constants
├── infra/                 # SST infrastructure definitions
│   ├── compute.ts         # Lambda functions
│   ├── network.ts         # API Gateway
│   ├── storage.ts         # S3 & DynamoDB
│   └── web.ts             # Static site deployment
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
# Start development environment (API + Web)
# This starts both the API and web app, and watches for changes
pnpm dev:infra:up

# Run frontend development server locally (with SST env injection)
cd apps/web
pnpm dev:sst

# Build all packages
pnpm build

# Run linting
pnpm lint:code    # ESLint
pnpm lint:type    # TypeScript type checking
pnpm lint         # Both

# Run tests
pnpm test

# Clean up (removes all deployed resources)
pnpm dev:infra:down
```

### Development Workflow

1. **Start infrastructure:**
   ```bash
   pnpm dev:infra:up
   ```
   This deploys:
   - API Gateway with Lambda functions
   - S3 bucket for file storage
   - DynamoDB table for metadata
   - Web app (deployed to CloudFront)
   - S3 event handler Lambda
   - Dead Letter Queue for failed events

2. **Develop locally:**
   - API changes: Edit files in `apps/functions/src/handlers/` - SST hot-reloads
   - Web changes: Edit files in `apps/web/src/` - Vite hot-reloads
   - Shared packages: Edit in `packages/` - Rebuild with `pnpm build`

3. **Test the flow:**
   - Open the web app (URL shown in SST console)
   - Upload a PDF file
   - Verify it appears in S3
   - Check DynamoDB for metadata updates

### Frontend Development

The web application uses:
- **React 19** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS v4** for styling
- **Framer Motion** for animations
- **shadcn/ui** for UI components
- **XMLHttpRequest** for real upload progress tracking

Key features:
- Real-time upload progress with visual progress bar
- Drag-and-drop file upload
- PDF-only validation (v1)
- 10MB file size limit
- Error handling with clear messaging

## Roadmap

- [ ] File validation after upload (verify metadata matches)
- [ ] Cleanup mechanism for abandoned uploads
- [ ] File listing and query endpoints
- [ ] PDF text extraction
- [ ] Basic search over uploaded documents
- [ ] Multi-file type support (images, etc.)
- [ ] User authentication and authorization
- [ ] File download endpoints
- [ ] Batch upload support

## Testing

### Manual Testing

1. **Test API directly:**
   ```bash
   curl -X POST https://your-api.execute-api.region.amazonaws.com/v1/files \
     -H "Content-Type: application/json" \
     -d '{"fileName":"test.pdf","mimeType":"application/pdf","fileSizeBytes":1024}'
   ```

2. **Test via Web UI:**
   - Open the deployed web app URL
   - Drag and drop a PDF file
   - Verify progress bar appears
   - Verify "Completed" status shows
   - Check S3 bucket for the uploaded file

3. **Verify S3 upload:**
   ```bash
   AWS_PROFILE=your-profile aws s3 ls s3://your-bucket/uploads/ --recursive
   ```

4. **Verify DynamoDB metadata:**
   ```bash
   AWS_PROFILE=your-profile aws dynamodb scan --table-name your-table-name
   ```

## Contributing

Contributions are welcome! Please ensure:
- Code follows the project's TypeScript conventions
- All linting and type checks pass (`pnpm lint`)
- Tests pass (`pnpm test`)
- Follow the export patterns (namespace exports in `index.ts` files)

## License

MIT

## Author

**Njabulo Majozi**

- GitHub: [@njabyulo](https://github.com/njabyulo)
- Repository: [https://github.com/njabyulo/ingest](https://github.com/njabyulo/ingest)

## Troubleshooting

### Web App Not Connecting to API

If the web app shows errors or can't connect to the API:

1. **Ensure infrastructure is deployed:**
   ```bash
   pnpm dev:infra:up
   ```

2. **Use SST bind for local development:**
   ```bash
   cd apps/web
   pnpm dev:sst  # This injects VITE_API_URL automatically
   ```

3. **Check API URL is set:**
   - The API URL should be automatically injected by SST
   - If running without `sst bind`, you'll see a console error
   - Verify the API Gateway URL in the SST console output

### Upload Not Working

If file uploads fail:

1. **Check file type:** Only `application/pdf` files are allowed in v1
2. **Check file size:** Maximum 10 MB
3. **Check browser console:** Look for error messages
4. **Verify API is accessible:** Test with curl (see API Documentation section)
5. **Check S3 permissions:** Ensure the Lambda has write access to the S3 bucket

### DynamoDB Table Not Found

If you get "ResourceNotFoundException" when querying DynamoDB:

1. **Check table name:** The table name includes the stage (e.g., `ingest-dev-FilesTableTable-...`)
2. **List tables:**
   ```bash
   AWS_PROFILE=your-profile aws dynamodb list-tables
   ```
3. **Verify deployment:** Run `pnpm dev:infra:up` to ensure all resources are created

### Environment Variables Not Set

If `VITE_API_URL` is undefined:

1. **For local development:** Use `pnpm dev:sst` instead of `pnpm dev`
2. **For production builds:** SST automatically injects environment variables during build
3. **Manual override:** Set `VITE_API_URL` environment variable if needed

---

**Built with:** TypeScript, React, Vite, Hono, SST v3, AWS (Lambda, S3, DynamoDB, API Gateway, CloudFront)
