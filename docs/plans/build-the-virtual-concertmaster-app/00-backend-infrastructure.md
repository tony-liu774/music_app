# Milestone 0: Backend Infrastructure

## Goal
Set up the Node.js backend server required for external integrations that cannot be performed client-side: Audiveris OMR processing and IMSLP web scraping.

## Scope
- Express.js REST API server setup
- Audiveris OMR service integration (Java process management)
- IMSLP proxy service using Puppeteer for web scraping
- File storage system for sheet music
- CORS and security configuration

---

## Task 0.1: Express Server Setup

### Description
Create the foundational Express.js server with REST API endpoints, CORS configuration, and basic middleware.

### Subtasks
1. Initialize Node.js project with package.json
2. Set up Express.js server with logging middleware
3. Configure CORS for frontend communication
4. Create basic health check endpoint
5. Set up environment configuration (development/production)
6. Configure request rate limiting

### Acceptance Criteria
- [ ] Server starts without errors on port 3000
- [ ] Health check endpoint returns 200 OK
- [ ] CORS allows requests from PWA origin
- [ ] Rate limiting prevents abuse (100 req/min per IP)
- [ ] Environment variables properly loaded

### Depends On
- None

### Agent Type
- Coder

---

## Task 0.2: Audiveris OMR Service Integration

### Description
Set up Java runtime and Audiveris OMR engine as a backend service. Create endpoints for uploading images and receiving MusicXML output.

### Subtasks
1. Install Java runtime on server (JDK 11+)
2. Download and configure Audiveris CLI
3. Create `/api/omr/process` endpoint for image upload
4. Implement file upload handling with multer
5. Run Audiveris as subprocess and capture output
6. Return MusicXML to client
7. Add timeout handling (OMR can take 30-60 seconds)
8. Add error handling for failed/low-quality scans

### Acceptance Criteria
- [ ] POST /api/omr/process accepts image uploads (PNG, JPEG, TIFF)
- [ ] Audiveris processes images and returns valid MusicXML
- [ ] Timeout after 90 seconds if processing hangs
- [ ] Temporary files cleaned up after processing
- [ ] Error messages returned for unsupported formats
- [ ] Failed/unusable scans return descriptive error with retry option
- [ ] Quality assessment: detect when OMR output is unusable

### Technical Notes
- Audiveris requires Java 11+
- Processing time varies from 10-60 seconds depending on image complexity
- Output is MusicXML format which the frontend can parse
- **Docker Integration**: Use OpenJDK 11+ base image, mount Audiveris JAR from host volume or download at container startup

### Depends On
- Task 0.1 (Express Server)

### Agent Type
- Coder

---

## Task 0.3: IMSLP Proxy Service

### Description
Create a backend service using Puppeteer to scrape IMSLP search results, bypassing the lack of a public API. Implements caching to reduce load on IMSLP servers.

### Subtasks
1. Install Puppeteer and related dependencies
2. Create `/api/imslp/search` endpoint
3. Implement search query scraping from IMSLP website
4. Add result parsing (title, composer, PDF links)
5. Implement Redis-less in-memory cache (LRU, 1-hour TTL)
6. Add rate limiting (1 request per 5 seconds)
7. Handle pagination for large result sets
8. Implement fallback to alternative sources if IMSLP unavailable

### Acceptance Criteria
- [ ] GET /api/imslp/search?query=bach returns search results
- [ ] Results include title, composer, and download URL
- [ ] Rate limited to prevent IMSLP blocking
- [ ] Cached results returned within 100ms
- [ ] Graceful fallback if IMSLP is unavailable

### Legal Risk Acknowledgment
⚠️ **Important**: Web scraping IMSLP may violate their Terms of Service. This implementation:
- Uses aggressive caching to minimize requests to IMSLP servers
- Implements strict rate limiting (1 req/5 sec)
- Includes fallback to alternative sources:
  - **MuseScore.com API** (has public API for sheet music)
  - **SheetMusicPlus** (catalog access)
  - **Manual upload** (users can upload their own scores)
- Should be reviewed by legal counsel before production use

### Technical Notes
- IMSLP has no public API - we use Puppeteer to scrape search results
- Respectful scraping: cache aggressively, rate limit requests

### Depends On
- Task 0.1 (Express Server)

### Agent Type
- Coder

---

## Task 0.4: File Storage System

### Description
Implement file storage for imported sheet music, processed MusicXML files, and user data.

### Subtasks
1. Set up local file storage directory structure
2. Create `/api/files/upload` endpoint for user imports
3. Implement `/api/files/download/:id` endpoint
4. Add file type validation (MusicXML, PDF, MEI)
5. Implement file deletion with cleanup
6. Add basic cloud backup capability (optional: S3-compatible)

### Acceptance Criteria
- [ ] Users can upload MusicXML/MEI files
- [ ] Files are stored with unique identifiers
- [ ] Files can be retrieved by ID
- [ ] Delete removes file from storage
- [ ] Storage usage tracked and limited (1GB default)

### Depends On
- Task 0.1 (Express Server)

### Agent Type
- Coder

---

## Task 0.5: Backend API Documentation

### Description
Document all backend API endpoints for frontend integration.

### Subtasks
1. Create OpenAPI/Swagger documentation
2. Document all endpoints with request/response schemas
3. Add example requests and responses
4. Document error codes and handling

### Acceptance Criteria
- [ ] Swagger UI accessible at /api/docs
- [ ] All endpoints documented with schemas
- [ ] Error responses documented
- [ ] Frontend team can integrate without clarification

### Depends On
- Task 0.1, 0.2, 0.3, 0.4

### Agent Type
- General

---

## Task 0.6: Backend Testing & Deployment

### Description
Write integration tests for backend services and prepare deployment configuration.

### Subtasks
1. Write integration tests for each endpoint
2. Set up CI/CD pipeline configuration
3. Create Docker configuration for containerization
4. Add health monitoring endpoints
5. Configure error logging and alerting

### Docker Configuration Requirements
The Docker setup must handle both Node.js and Java:
- **Base Image**: Use `eclipse-temurin:11-jdk` (or 17+) for Java 11+ runtime
- **Multi-stage build**: Build Node.js app, copy to final image with JRE
- **Volume mounts**:
  - Host directory with Audiveris JAR mounted to container
  - Input/output directories for OMR processing
- **Example structure**:
  ```dockerfile
  FROM eclipse-temurin:17-jdk as base
  # Install Node.js
  RUN apt-get update && apt-get install -y curl
  RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  RUN apt-get install -y nodejs

  # Copy application
  COPY . /app
  WORKDIR /app

  # Volume for Audiveris
  VOLUME /audiveris

  # Expose ports
  EXPOSE 3000

  CMD ["node", "server.js"]
  ```

### Acceptance Criteria
- [ ] All endpoints have passing integration tests
- [ ] Docker image builds successfully with Java runtime
- [ ] Container runs locally without errors
- [ ] Audiveris JAR accessible from container volume mount
- [ ] Health endpoint returns service status

### Depends On
- Task 0.1, 0.2, 0.3, 0.4

### Agent Type
- Coder

---

## Changes Required

All changes must be on a feature branch with a GitHub PR created via `gh pr create`.
