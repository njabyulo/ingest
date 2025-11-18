# Serverless File Ingestion Service - System Design

## 0. PR / FAQ — Customer-Backwards Narrative

### 📰 Press Release (Launch Day)

> FOR IMMEDIATE RELEASE — "ingest" Simplifies File Ingestion for Developers
> 
> 
> **Johannesburg, South Africa — March 2026** — Today we introduce **ingest**, a small but powerful serverless service that gives developers a clean, secure way to ingest documents into AWS.
> 
> ingest lets you:
> 
> - Upload **PDFs (v1)** via secure presigned URLs.
> - Enforce **file size and type limits** at the API layer.
> - Automatically store files in **Amazon S3** and metadata in **DynamoDB**.
> - Track upload status via **event-driven status updates** from S3.
> 
> Built with **TypeScript**, **Hono**, **SST v3**, and **serverless AWS primitives**, ingest showcases clean architecture, dependency injection, DRY and SOLID principles while remaining production-ready and cost-efficient.

### FAQ (selected)

**Q: Who is this for?**

Developers who need a simple, reusable backend to ingest files into their apps: portfolios, AI RAG systems, internal tools, etc.

**Q: What does v1 support?**

- Presigned URL flow via `POST /v1/files`
- PDF-only uploads (application/pdf)
- File size validation (10 MB max)
- S3 storage with date-organized keys
- DynamoDB metadata persistence
- Automatic status updates via S3 events
- File listing and metadata retrieval

**Q: Why presigned URLs instead of direct upload to the API?**

Presigned URLs let clients upload directly to S3 without sending large binaries through the Lambda/API Gateway path. This reduces backend costs by ~99% and improves upload performance. This is a standard AWS best practice for secure, efficient uploads.

**Q: How does it show good engineering practices?**

- **TypeScript + interface-based DI** for clear boundaries and testability
- **SOLID & GoF** via interfaces for ports (storage, validator, file type detector) and strategy patterns for validation
- **Monorepo structure** with shared packages following namespace export patterns
- **Serverless on AWS with SST v3** for infra-as-code and minimal ops overhead
- **Domain-driven infrastructure** organization (storage/, compute/, network/, events/, frontend/)

---

## 1. Requirements & Assumptions

### 1.1 Problem & Goals (MVP Scope)

**Core goal:**

Provide a **small, reusable ingest backend** to:

1. Accept file ingest requests (start with **PDFs**).
2. Validate file size and type.
3. Issue **presigned S3 URLs** for direct client uploads.
4. Persist file metadata + status in DynamoDB.
5. React to S3 upload events (update status from `PENDING_UPLOAD` → `UPLOADED`).

### 1.2 Non-functionals (baseline)

- **Reliability**:
    - 99.9% success for `POST /v1/files` under expected load.
    - Idempotent S3 event processing (duplicate events don't break consistency).
- **Performance**:
    - `POST /v1/files` p95 < 300 ms (metadata + presigned URL).
    - `GET /v1/files/{id}` p95 < 150 ms (using GSI for fast lookups).
- **Security & privacy**:
    - All uploads go to **private S3 buckets**.
    - Presigned URLs expire quickly (5 minutes by default) and are limited to a single object key.
- **Cost**:
    - Lambda + S3 + DynamoDB serverless/on-demand for near-zero idle cost.
    - Direct-to-S3 uploads bypass backend (~99% cost reduction).
- **Observability**:
    - Structured logs (fileId, userId, requestId).
    - Dead Letter Queue for failed S3 event processing.
    - CloudWatch Logs for all Lambda functions.

### 1.3 Capacity Planning (MVP)

Assumption for MVP demo:

- 50 users
- Up to 100 files/user/day (worst case)
- Typical file size: 1–10 MB

Estimates:

- **S3 data**: ~50 * 100 * 10 MB/day = 50 GB/day worst case (much less typical).
- **DynamoDB**: One metadata row per file + GSIs. On-demand mode is fine at MVP scale.
- **Lambda invocations**: ~5,000/day (mostly presigned URL generation, minimal S3 event processing).

Lifecycle policies can transition older objects to cheaper storage classes later.

---

## 2. High-Level Architecture

### 2.1 Stack Overview

- **Language**: TypeScript (Node.js 20.x runtime)
- **HTTP Framework**: Hono (lightweight, fast, edge-compatible)
- **Infra**: AWS via **SST v3** (TypeScript Lambdas, S3, DynamoDB, API Gateway)
- **Core AWS Services**:
    - API Gateway v2 (HTTP API)
    - Lambda (Node.js 20.x) for APIs + S3 event workers
    - S3 (file storage)
    - DynamoDB (file metadata)
    - SQS (Dead Letter Queue for failed events)
- **Monorepo**: Turbo + pnpm workspaces
- **Build**: tsup for shared packages

### 2.2 Components

**Client (React Web App)**

- React + Vite frontend with drag-and-drop file upload
- Real-time progress tracking using XMLHttpRequest
- Calls `POST /v1/files` to request presigned URL
- Uploads directly to S3 using presigned URL
- Polls `GET /v1/files/{fileId}` to check upload status

**Edge/API Layer (SST + API Gateway + Lambda)**

- One **Hono-based** TypeScript Lambda, provisioned via SST's `Function` + `Api` components
- Handles:
    - Request validation (file type, size)
    - Calling application services (DI)
    - Error handling and HTTP response mapping
- Routes:
    - `POST /v1/files` - Request presigned URL
    - `GET /v1/files` - List files with pagination
    - `GET /v1/files/{fileId}` - Get file metadata

**Application Layer (TypeScript services)**

- **PresignedUrlService**: Generates presigned S3 URLs, creates DynamoDB metadata
- **FileTypeDetector**: Detects file type from MIME type and filename
- Services follow interface-based design for testability

**Infrastructure Layer**

- S3 client from AWS SDK v3 (`@aws-sdk/client-s3`)
- S3RequestPresigner from AWS SDK v3 (`@aws-sdk/s3-request-presigner`)
- `DynamoFileRepository` implementing `IFileRepository` using DynamoDB best practices
- Config via SST Resource linking

**Workers (S3 → Lambda)**

- S3 bucket sends **event notifications** on `ObjectCreated:Put` to a Lambda
- Worker:
    - Reads S3 event
    - Extracts fileId from S3 key
    - Updates file status from `PENDING_UPLOAD` → `UPLOADED`
    - Idempotent (handles duplicate events gracefully)
    - Failed events sent to Dead Letter Queue

**Observability**

- CloudWatch Logs for all Lambdas
- Dead Letter Queue (SQS) for failed S3 event processing (14-day retention)
- Structured logging with fileId, userId, requestId

---

## 3. Feature Workflows

### 3.1 Core — PDF Upload via Presigned URL (v1)

**1) Request presigned URL**

- Client calls `POST /v1/files` with JSON body:
    - `fileName`: "document.pdf"
    - `mimeType`: "application/pdf"
    - `fileSizeBytes`: 1048576

**2) Validation (application layer)**

- Handler validates request body
- `FileTypeDetector.detect()`:
    - Checks MIME type and file extension
    - Returns `"pdf"`, `"image"`, or `"unknown"`
    - Only `"pdf"` allowed in v1
- Size validation:
    - Checks file size < configured max (10 MB for PDFs)
    - Returns error if invalid

**3) Generate presigned URL**

- `PresignedUrlService.generateUploadUrl()`:
    - Generates `fileId` (UUID)
    - Generates S3 key: `uploads/{userId}/{yyyy}/{mm}/{dd}/{fileId}.pdf`
    - Creates DynamoDB metadata record with status `PENDING_UPLOAD`
    - Sets TTL for automatic cleanup of expired uploads
    - Creates presigned PUT URL (5-minute expiry by default)
    - Returns `{ fileId, uploadUrl, expiresAt, maxSizeBytes, method: "PUT" }`

**4) Upload to S3**

- Client uploads directly to S3 using presigned URL (PUT method)
- Upload bypasses backend entirely (direct to S3)
- Client can track progress using XMLHttpRequest progress events

**5) S3 event processing**

- S3 emits `ObjectCreated:Put` event
- Lambda worker receives S3 event:
    - Extracts fileId from S3 key pattern: `uploads/{userId}/{yyyy}/{mm}/{dd}/{fileId}.pdf`
    - Looks up file record using `getFileById` (GSI query) or `getFile` (fallback)
    - Updates DynamoDB status from `PENDING_UPLOAD` → `UPLOADED`
    - Sets `uploadedAt` timestamp
    - Idempotent: duplicate events don't cause issues

**6) Status polling**

- Client polls `GET /v1/files/{fileId}` to check upload status
- Returns status: `PENDING_UPLOAD` or `UPLOADED`
- Optimized for p95 < 150ms using DynamoDB GSI query

---

## 4. API Design (Current Implementation)

### Auth

- Currently uses default userId ("default-user") for MVP
- Future: `Authorization: Bearer <JWT>` (Cognito integration)

### Error Format

- JSON error envelope:
    
    ```json
    {
      "success": false,
      "error": "File size 15.5MB exceeds maximum allowed size of 10MB"
    }
    ```

### Core Endpoints

1. **Request presigned URL (v1)**
    
    `POST /v1/files`
    
    Request body:
    
    ```json
    {
      "fileName": "invoice.pdf",
      "mimeType": "application/pdf",
      "fileSizeBytes": 345678
    }
    ```
    
    Response:
    
    ```json
    {
      "success": true,
      "fileId": "550e8400-e29b-41d4-a716-446655440000",
      "uploadUrl": "https://bucket.s3.amazonaws.com/uploads/...",
      "expiresAt": "2024-01-15T10:05:00.000Z",
      "maxSizeBytes": 10485760,
      "method": "PUT"
    }
    ```

2. **Get file metadata (v1)**
    
    `GET /v1/files/{fileId}`
    
    Response:
    
    ```json
    {
      "success": true,
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "invoice.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 345678,
      "status": "UPLOADED",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:05.000Z",
      "uploadedAt": "2024-01-15T10:00:05.000Z"
    }
    ```

3. **List files (v1)**
    
    `GET /v1/files?limit=50&cursor=...`
    
    Returns paginated list + cursor for next page.
    
    Response:
    
    ```json
    {
      "success": true,
      "files": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "name": "invoice.pdf",
          "mimeType": "application/pdf",
          "sizeBytes": 345678,
          "status": "UPLOADED",
          "createdAt": "2024-01-15T10:00:00.000Z",
          "updatedAt": "2024-01-15T10:00:05.000Z",
          "uploadedAt": "2024-01-15T10:00:05.000Z"
        }
      ],
      "nextCursor": "eyJTSyI6IkZJTEUj..."
    }
    ```

---

## 5. Data Design

### S3 Layout

- Bucket: `IngestBucket` (provisioned via SST)
- Key pattern: `uploads/{userId}/{yyyy}/{mm}/{dd}/{fileId}.pdf`
    - Organized by user and date for easy querying and lifecycle management
    - Example: `uploads/default-user/2024/01/15/550e8400-e29b-41d4-a716-446655440000.pdf`
- Files are private (no public access)
- S3 object metadata includes: `originalFileName`, `fileSize`

Lifecycle configuration can later move older objects to cheaper storage classes.

### DynamoDB (single table)

**Table name**: `FilesTable` (provisioned via SST)

**Partition key / sort key**:

- `PK = USER#{userId}`
- `SK = FILE#{fileId}`

**Attributes**:

- `fileId`, `userId`, `fileName`, `mimeType`, `sizeBytes`
- `s3Bucket`, `s3Key`
- `status` (`PENDING_UPLOAD`, `UPLOADED`, `FAILED`, `DELETED`)
- `createdAt`, `uploadedAt`, `updatedAt`
- `expiresAt` (ISO timestamp when presigned URL expires)
- `ttl` (Unix epoch seconds for DynamoDB TTL automatic deletion)

**Global Secondary Indexes (GSIs)**:

- `FileIdIndex` — `fileId` (hash key)
    - Used for fast lookups by fileId without knowing userId
    - Enables `GET /v1/files/{fileId}` with p95 < 150ms
- `StatusExpiresAtIndex` — `status` (hash key) + `expiresAt` (range key)
    - Used for efficient querying of expired `PENDING_UPLOAD` files
    - Enables cleanup operations without full table scans

**TTL (Time To Live)**:

- DynamoDB automatically deletes items where `ttl < current_time`
- TTL is set to `expiresAt + 48 hours` (buffer for DynamoDB deletion timing)
- Automatic cleanup of expired `PENDING_UPLOAD` records (no scheduled Lambda needed)

This aligns with common patterns for building metadata indexes alongside S3 object storage.

---

## 6. Scalability Stance (MVP)

- **API**:
    - API Gateway + Lambda scales per request. Throttling configured to protect downstream (DynamoDB, S3).
- **Storage**:
    - S3 is effectively limitless; DynamoDB on-demand scales seamlessly at MVP scale.
- **Workers**:
    - S3 events invoke Lambdas per object; concurrency limits + DLQ protect from poison messages.
- **Future**:
    - Introduce SQS between S3 → processing Lambdas if you want more control and buffering.

---

## 7. Reliability, Monitoring, Security

- **Retry & Idempotency**
    - S3 event workers are retry-safe: updating the same item to `UPLOADED` is idempotent.
    - Event handler checks existing status before updating (prevents duplicate processing).
- **Monitoring**
    - CloudWatch Logs for all Lambda functions
    - Dead Letter Queue (SQS) for failed S3 event processing
    - DLQ retention: 14 days for investigation
    - Structured logging with fileId, userId, requestId
- **Security**
    - S3 **private** bucket; IAM roles grant limited permissions to Lambda only.
    - Presigned URLs are scoped to specific object keys and short expiry (5 minutes).
    - All resources tagged with Project, Environment, ManagedBy for cost tracking.

---

## 8. Infrastructure Organization

The infrastructure is organized into domain-specific directories:

```
infra/
├── storage/         # Data persistence
│   ├── s3.ts       # S3 bucket
│   ├── dynamo.ts   # DynamoDB table
│   └── sql.ts      # Placeholder for future SQL databases
├── events/         # Event-driven infrastructure
│   └── queue.ts    # SQS Dead Letter Queue
├── compute/        # Lambda functions
│   ├── api.ts      # API handler Lambda
│   └── events.ts   # S3 event handler Lambda
├── network/        # Networking layer
│   ├── api.ts      # API Gateway
│   └── routes.ts   # Route definitions
└── frontend/       # Frontend applications
    └── web.ts      # StaticSite (React app)
```

**Key design decisions**:

- Domain-based organization (storage, compute, network, events, frontend)
- Separation of concerns (API Gateway creation vs route registration)
- No circular dependencies (clear import order in `sst.config.ts`)
- Consistent naming (resource-based: s3.ts, dynamo.ts, queue.ts)

---

## 9. Current Implementation Status

**v1 (Completed)**:
- ✅ Presigned URL flow (`POST /v1/files`)
- ✅ DynamoDB metadata storage with TTL
- ✅ S3 event worker for status updates (`PENDING_UPLOAD` → `UPLOADED`)
- ✅ `GET /v1/files/{fileId}` endpoint (optimized with GSI)
- ✅ `GET /v1/files` endpoint (pagination with cursor)
- ✅ File type detection (PDF only)
- ✅ Size validation (10 MB max for PDFs)
- ✅ S3 storage with date-organized keys
- ✅ Shared package structure with namespace exports
- ✅ TypeScript interfaces for all services
- ✅ Dead Letter Queue for failed S3 events
- ✅ DynamoDB TTL for automatic cleanup of expired uploads
- ✅ React + Vite frontend with real-time upload progress
- ✅ Infrastructure refactoring (domain-based organization)

**v2 (Future)**:
- ⏳ Image support (JPEG, PNG, etc.)
- ⏳ PDF text extraction
- ⏳ Search APIs
- ⏳ User authentication and authorization
- ⏳ File download endpoints
- ⏳ Batch upload support

---

## 10. Development & Deployment

### Running Locally

```bash
# Clone and install
git clone https://github.com/njabyulo/ingest.git
cd ingest
pnpm install

# Start local development (deploys to AWS dev stage)
pnpm dev:infra:up
# Or: pnpm exec sst dev --stage dev
```

### Deploying to Production

```bash
# Deploy to production stage
pnpm exec sst deploy --stage production
```

### Infrastructure Structure

The infrastructure follows a clear dependency order:

1. **Storage** (no dependencies) - S3, DynamoDB
2. **Events** (no dependencies) - SQS queues
3. **Compute** (depends on storage, events) - Lambda functions
4. **Network API** (no dependencies) - API Gateway
5. **Network Routes** (depends on compute, network/api) - Route definitions
6. **Frontend** (depends on network) - StaticSite with API URL injection

This structure prevents circular dependencies and ensures proper resource creation order.

---

## 11. Key Technical Decisions

### Presigned URLs vs Direct Upload

**Decision**: Use presigned URLs for all uploads

**Rationale**:
- ~99% cost reduction (files bypass Lambda/API Gateway)
- Better performance (direct S3 upload)
- Scales to any file size
- Standard AWS best practice

### DynamoDB TTL vs Scheduled Cleanup

**Decision**: Use DynamoDB TTL for automatic cleanup

**Rationale**:
- Zero cost (no Lambda invocations)
- Automatic (AWS handles it)
- Reliable (no missed runs)
- Simple (just set ttl attribute)

### GSI Design

**Decision**: Two GSIs for different query patterns

**Rationale**:
- `FileIdIndex`: Fast lookups by fileId (O(log n))
- `StatusExpiresAtIndex`: Efficient queries for expired PENDING_UPLOAD files
- Avoids expensive table scans

### Infrastructure Organization

**Decision**: Domain-based directory structure

**Rationale**:
- Prevents circular dependencies
- Clear separation of concerns
- Scalable (easy to add new resources)
- Consistent naming conventions

---

**For detailed API usage examples and integration guides, see the [README.md](../README.md).**
