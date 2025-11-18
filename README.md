# ingest

A production-ready, serverless file ingestion system built with TypeScript, Hono, SST, and AWS. Designed for scalable, cost-effective file uploads with metadata tracking and event-driven processing.

## Features

- **Presigned URL Uploads** - Direct-to-S3 uploads bypassing the backend (~99% cost reduction)
- **Presigned URL Downloads** - Secure file downloads with time-limited presigned URLs
- **Metadata Tracking** - Full file metadata persistence in DynamoDB with status tracking
- **Event-Driven Status Updates** - Automatic status updates via S3 event notifications
- **Date-Organized Storage** - Files stored with type-based prefixes: `pdf/{userId}/{yyyy}/{mm}/{dd}/{fileId}.pdf` or `images/{userId}/{yyyy}/{mm}/{dd}/{fileId}.{ext}`
- **Type-Safe Architecture** - Full TypeScript with interface-based dependency injection
- **Serverless-First** - Built on AWS Lambda, S3, DynamoDB, and API Gateway
- **Modern Web UI** - React 19 + Vite frontend with feature-based architecture
- **Real Progress Tracking** - XMLHttpRequest-based upload progress with toast notifications
- **File Listing & Download** - Browse uploaded files with pagination, sorting, and secure downloads
- **Automatic Status Polling** - Background polling for pending uploads (2s interval)
- **Feature-Based Architecture** - Organized codebase with shared packages and catalog dependencies

## High-Level Architecture

The system follows a serverless, event-driven architecture built on AWS. Files are uploaded directly to S3 using presigned URLs, bypassing the backend for ~99% cost reduction. Metadata is tracked in DynamoDB and automatically updated via S3 event notifications.

### Architecture Diagram

```
┌─────────────┐
│  Web UI     │  React + Vite frontend
│  (React)    │  - Drag-and-drop upload
└──────┬──────┘  - Real-time progress tracking
       │
       │ HTTP POST /v1/files
       ▼
┌─────────────────┐
│  API Gateway    │  AWS API Gateway v2 (HTTP API)
│  (REST API)     │  - CORS enabled
└──────┬──────────┘  - Rate limiting
       │
       │ Invoke Lambda
       ▼
┌─────────────────────────┐
│  Upload Request Lambda  │  Hono-based handler
│  (Presigned URL Gen)    │  - Validates file type/size
└──────┬──────────────────┘  - Creates DynamoDB metadata (PENDING_UPLOAD)
       │                      - Generates presigned S3 URL
       │
       ├──────────────────────┐
       │                      │
       ▼                      ▼
┌─────────────┐      ┌─────────────────┐
│  DynamoDB   │      │  S3 Bucket      │
│  (Metadata) │      │  (File Storage) │
│             │      │  - Private       │
│  - fileId   │      │  - Encrypted     │
│  - status   │      │  - Organized by   │
│  - metadata │      │    date/user     │
└─────────────┘      └────────┬─────────┘
                              │
                              │ ObjectCreated event
                              ▼
                    ┌─────────────────────┐
                    │  S3 Event Lambda    │
                    │  (Status Update)    │
                    │  - Updates status   │
                    │    PENDING→UPLOADED │
                    │  - Idempotent       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Dead Letter Queue  │
                    │  (Error Handling)   │
                    │  - Failed events    │
                    │  - 14-day retention │
                    └─────────────────────┘
```

### Key Components

**Frontend Layer:**
- **Web Application** - React 19 + Vite SPA with feature-based architecture
- **File Upload** - Direct file selector with toast notifications (Sonner)
- **Real-time Progress** - XMLHttpRequest-based upload progress tracking
- **File Management** - List, sort (name/date/size), paginate, and download files
- **Status Polling** - Automatic background polling for pending uploads
- **API Client** - Type-safe client with error handling
- **Components** - Feature-based structure: `features/files/`, `features/upload/`

**API Layer:**
- **API Gateway v2** - HTTP API with CORS, rate limiting
- **Upload Request Lambda** - Hono-based handler for presigned URL generation
- **S3 Event Lambda** - Event-driven status updates

**Storage Layer:**
- **S3 Bucket** - Private, encrypted file storage with date-organized keys
- **DynamoDB Table** - Metadata persistence with GSIs for efficient queries
- **Dead Letter Queue** - SQS queue for failed event processing

**Data Flow:**
1. Client requests presigned URL via `POST /v1/files`
2. Lambda validates request, creates metadata (status: `PENDING_UPLOAD`), generates presigned URL
3. Client uploads directly to S3 using presigned URL
4. S3 emits `ObjectCreated` event
5. Event Lambda updates DynamoDB status to `UPLOADED`
6. Client polls `GET /v1/files/{fileId}` to check status

For detailed system design, see [`docs/project/system-design.md`](docs/project/system-design.md).

## Quick Start

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 10.0.0
- **AWS CLI** configured with appropriate credentials
- **AWS Account** with permissions to create Lambda, S3, DynamoDB, API Gateway, SQS resources

### Installation

```bash
# Clone the repository
git clone https://github.com/njabyulo/ingest.git
cd ingest

# Install dependencies
pnpm install
```

### Running Locally with SST

SST provides a local development environment that mirrors production. Use `sst dev` to run the system locally with hot-reloading:

```bash
# Start local development environment
# This command:
# - Deploys infrastructure to AWS (dev stage)
# - Watches for code changes and hot-reloads
# - Provides local URLs for testing
pnpm dev:infra:up

# Or use SST directly:
pnpm exec sst dev --stage dev
```

**What happens:**
- Infrastructure is deployed to AWS (dev stage)
- API Gateway URL is displayed in console
- Web app is deployed to CloudFront (URL shown in console)
- Lambda functions hot-reload on code changes
- All AWS resources are created and linked

**Access the system:**
- **API URL**: Shown in SST console output (e.g., `https://xxxxx.execute-api.us-east-1.amazonaws.com`)
- **Web App URL**: Shown in SST console output (CloudFront distribution URL)

**Stop local development:**
```bash
# Press Ctrl+C in the terminal running sst dev
# Or run:
pnpm dev:infra:down  # Removes all dev resources
```

### Deploying to Production

Deploy the system to a production stage:

```bash
# Deploy to production stage
pnpm exec sst deploy --stage production

# Or use the deploy script (if configured)
pnpm exec sst deploy --stage prod
```

**Production deployment:**
- Creates production resources (separate from dev)
- Resources are protected from accidental deletion
- Web app is deployed to CloudFront with production API URL
- All environment variables are injected automatically

**Clean up production:**
```bash
# Remove production resources (use with caution)
pnpm exec sst remove --stage production
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

## API Usage Examples

### Example 1: Request Presigned URL

**Endpoint:** `POST /v1/files`

**cURL:**
```bash
# Replace API_URL with your deployed API Gateway URL
API_URL="https://xxxxx.execute-api.us-east-1.amazonaws.com"

curl -X POST ${API_URL}/v1/files \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "document.pdf",
    "mimeType": "application/pdf",
    "fileSizeBytes": 1048576
  }'
```

**Response:**
```json
{
  "success": true,
  "fileId": "550e8400-e29b-41d4-a716-446655440000",
  "uploadUrl": "https://bucket.s3.amazonaws.com/pdf/...",
  "expiresAt": "2024-01-15T10:05:00.000Z",
  "expiresIn": 300,
  "maxSizeBytes": 10485760,
  "method": "PUT"
}
```

### Example 2: Upload File to S3

**Using the presigned URL from Example 1:**

```bash
# Extract uploadUrl from previous response
UPLOAD_URL="https://bucket.s3.amazonaws.com/pdf/..."

# Upload file directly to S3
curl -X PUT "${UPLOAD_URL}" \
  -H "Content-Type: application/pdf" \
  --upload-file document.pdf
```

### Example 3: Complete Upload Flow (Bash Script)

```bash
#!/bin/bash
API_URL="https://xxxxx.execute-api.us-east-1.amazonaws.com"
FILE_PATH="./document.pdf"
FILE_NAME=$(basename "$FILE_PATH")
FILE_SIZE=$(stat -f%z "$FILE_PATH" 2>/dev/null || stat -c%s "$FILE_PATH" 2>/dev/null)

# Step 1: Request presigned URL
echo "Requesting presigned URL..."
RESPONSE=$(curl -s -X POST ${API_URL}/v1/files \
  -H "Content-Type: application/json" \
  -d "{
    \"fileName\": \"${FILE_NAME}\",
    \"mimeType\": \"application/pdf\",
    \"fileSizeBytes\": ${FILE_SIZE}
  }")

# Extract fileId and uploadUrl
FILE_ID=$(echo $RESPONSE | jq -r '.fileId')
UPLOAD_URL=$(echo $RESPONSE | jq -r '.uploadUrl')

echo "File ID: ${FILE_ID}"
echo "Upload URL: ${UPLOAD_URL}"

# Step 2: Upload to S3
echo "Uploading file to S3..."
curl -X PUT "${UPLOAD_URL}" \
  -H "Content-Type: application/pdf" \
  --upload-file "${FILE_PATH}"

# Step 3: Check status
echo "Checking upload status..."
sleep 2
curl -s ${API_URL}/v1/files/${FILE_ID} | jq '.'
```

### Example 4: Get File Metadata

```bash
API_URL="https://xxxxx.execute-api.us-east-1.amazonaws.com"
FILE_ID="550e8400-e29b-41d4-a716-446655440000"

curl ${API_URL}/v1/files/${FILE_ID}
```

**Response:**
```json
{
  "success": true,
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "document.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 1048576,
  "status": "UPLOADED",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:05.000Z",
  "uploadedAt": "2024-01-15T10:00:05.000Z"
}
```

### Example 5: List Files

```bash
API_URL="https://xxxxx.execute-api.us-east-1.amazonaws.com"

# First page
curl "${API_URL}/v1/files?limit=10"

# Next page (using cursor from previous response)
CURSOR="eyJTSyI6IkZJTEUj..."
curl "${API_URL}/v1/files?limit=10&cursor=${CURSOR}"
```

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "document.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 1048576,
      "status": "UPLOADED",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:05.000Z",
      "uploadedAt": "2024-01-15T10:00:05.000Z"
    }
  ],
  "nextCursor": "eyJTSyI6IkZJTEUj..."
}
```

### Example 6: Download File

**Endpoint:** `GET /v1/files/{fileId}/download`

```bash
API_URL="https://xxxxx.execute-api.us-east-1.amazonaws.com"
FILE_ID="550e8400-e29b-41d4-a716-446655440000"

# Request download URL
curl "${API_URL}/v1/files/${FILE_ID}/download"
```

**Response:**
```json
{
  "success": true,
  "downloadUrl": "https://bucket.s3.amazonaws.com/pdf/...?X-Amz-Algorithm=...",
  "fileName": "document.pdf",
  "expiresAt": "2024-01-15T10:10:00.000Z"
}
```

**Download the file:**
```bash
# Use the downloadUrl from the response
DOWNLOAD_URL="https://bucket.s3.amazonaws.com/pdf/...?X-Amz-Algorithm=..."

# Download the file
curl -L "${DOWNLOAD_URL}" -o document.pdf
```

**Note:** The presigned download URL expires after 5 minutes. Only files with status `UPLOADED` can be downloaded.

## Additional API Documentation

For detailed API reference, see the examples above. Here's a JavaScript/TypeScript example with progress tracking:
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

### API Endpoints Summary

**Available Endpoints:**
- `POST /v1/files` - Request presigned URL for upload (PDF only in v1)
- `GET /v1/files` - List files with pagination (`?limit={limit}&cursor={cursor}`)
- `GET /v1/files/{fileId}` - Get file metadata by ID
- `GET /v1/files/{fileId}/download` - Get presigned download URL (UPLOADED files only)

**Status Values:**
- `PENDING_UPLOAD` - Presigned URL generated, awaiting upload
- `UPLOADED` - File successfully uploaded to S3
- `FAILED` - Upload failed (future feature)
- `DELETED` - File marked as deleted (future feature)

See the examples above for complete usage patterns.

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
1. User clicks "Upload" button → File selector opens immediately
2. User selects file(s) → File is validated (type and size)
3. Toast notification shows upload progress (0% → 100%)
4. Presigned URL is requested from the API (`POST /v1/files`)
5. File is uploaded directly to S3 with real-time progress tracking
6. Toast updates with progress percentage and bytes transferred
7. On completion, success toast is shown
8. File appears in list immediately (optimistic update)
9. S3 event triggers Lambda to update DynamoDB status to `UPLOADED`
10. Background polling (2s interval) updates status automatically
11. Status changes from "Uploading..." to "Uploaded" in UI

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
│   │       │   └── files.ts            # HTTP API handler (POST/GET /v1/files, download)
│   │       └── events/
│   │           └── file-upload.ts     # S3 file upload event handler
│   └── web/                # React + Vite frontend application
│       ├── src/
│       │   ├── features/               # Feature-based architecture
│       │   │   ├── files/             # File listing, sorting, polling, download
│       │   │   │   ├── components/    # FileList, FileCard, FileGrid, FileListHeader
│       │   │   │   └── hooks/         # useFileList, useFilePolling, useFileSorting, useFileDownload
│       │   │   └── upload/            # File upload
│       │   │       └── hooks/         # useFileUpload
│       │   ├── components/
│       │   │   ├── common/            # ErrorBoundary, LoadingState, EmptyState, ErrorState
│       │   │   ├── layout/           # SideBar, Wrapper
│       │   │   └── ui/               # shadcn/ui components + Sonner
│       │   ├── lib/
│       │   │   └── api.ts             # API client with progress tracking
│       │   └── App.tsx                # Main app component
│       └── package.json
├── packages/
│   ├── core/              # Business logic (services, repositories)
│   │   └── src/
│   │       ├── services/              # PresignedUrlService, FileUploadService
│   │       └── repositories/         # DynamoFileRepository
│   └── shared/            # Shared types, utilities, constants
│       └── src/
│           ├── types/                 # File types, UI types, validator types
│           ├── utils/                 # Formatters, AWS helpers, file type detection
│           ├── constants/             # File constants, sort options
│           └── schemas/               # Zod schemas (future)
├── infra/                 # SST infrastructure (domain-based)
│   ├── storage/           # S3 & DynamoDB
│   ├── compute/           # Lambda functions
│   ├── network/           # API Gateway & routes
│   ├── events/            # SQS queues
│   └── frontend/          # Static site deployment
└── docs/                  # Documentation
```

## Configuration

### File Size Limits

Edit `packages/shared/src/constants/file.ts`:

```typescript
export const FILE_CONSTANTS = {
  MAX_PDF_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  // ...
};
```

**Note:** Backend API currently only accepts PDFs (application/pdf) in v1. Frontend supports PDF, JPEG, and PNG, but non-PDF uploads will be rejected by the API.

### Presigned URL Expiration

Edit `packages/core/src/services/presigned-url-service.ts`:

```typescript
private readonly defaultExpirationSeconds = 300; // 5 minutes
```

### S3 Key Pattern

The S3 key pattern is defined in `packages/shared/src/utils/aws.ts`:

```typescript
// Pattern: {type}/{userId}/{yyyy}/{mm}/{dd}/{fileId}.{extension}
// Where {type} is either "pdf" or "images"
// Extension is extracted from original filename
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
- **Sonner** for toast notifications
- **XMLHttpRequest** for real upload progress tracking

**Architecture:**
- Feature-based structure (`features/files/`, `features/upload/`)
- Custom hooks for business logic (useFileList, useFileUpload, useFilePolling, etc.)
- Presentational components (FileCard, FileGrid, FileListHeader)
- Container components (FileList)
- Shared components (ErrorBoundary, LoadingState, EmptyState, ErrorState)

Key features:
- Direct file selector (opens immediately, no dialog)
- Real-time upload progress with toast notifications
- Automatic status polling for pending uploads (2s interval)
- File listing with pagination (cursor-based) and sorting (name/date/size)
- Secure file downloads via presigned URLs
- PDF-only validation in backend (v1) - frontend supports PDF, JPEG, PNG
- 10MB file size limit for PDFs, 5MB for images
- Error handling with clear messaging
- Modern Drive-like UI with sidebar navigation

## Roadmap

- [x] File listing and query endpoints
- [x] File download endpoints
- [x] Automatic status polling in web UI
- [x] Toast notifications for upload feedback
- [x] File sorting (name/date/size)
- [ ] Image support in backend API (frontend ready)
- [ ] File validation after upload (verify metadata matches)
- [ ] Cleanup mechanism for abandoned uploads
- [ ] PDF text extraction
- [ ] Basic search over uploaded documents
- [ ] User authentication and authorization
- [ ] Batch upload support
- [ ] File deletion endpoints

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
   AWS_PROFILE=your-profile aws s3 ls s3://your-bucket/pdf/ --recursive
   AWS_PROFILE=your-profile aws s3 ls s3://your-bucket/images/ --recursive
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
