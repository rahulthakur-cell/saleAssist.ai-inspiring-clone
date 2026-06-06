# Phase 3: Content & Commerce

Implement media uploading, transcoding queues, shoppable video catalogs (including an interactive hotspot timeline editor), video FAQ playlists, and an AI chat gateway with streaming token generation (SSE).

## User Review Required

> [!IMPORTANT]
> **MinIO Configuration:** MinIO S3 bucket access must be configured locally. We will write a Node client to check and auto-create the `saleassist` bucket on startup.
> 
> **AI LiteLLM Proxy:** The AI Chat module connects to the LiteLLM container on `http://localhost:4001` (configured in docker-compose) with standard fallback configurations. Verify if you have an active model endpoint (e.g. Google Gemini or OpenAI GPT) configured in your local environment.

## Open Questions

> [!WARNING]
> **Video Transcoding:** For local development, we will mock the transcode queue or use a lightweight transcoder (like a ffmpeg wrapper if installed, or just simulate progress in NestJS BullMQ) to avoid native library compiler issues. Please confirm if you want a full ffmpeg integration in the dev container.
> 
> **Hotspot Styling:** Do we want simple clickable hotspot circles with hover cards showing product info, or overlay buttons that slide out of the video screen? The plan defaults to hover card circles positioned on top of the video container.

## Proposed Changes

---

### NestJS API Server (Media, AI & Queues)

#### [MODIFY] [app.module.ts](file:///d:/saleassists.ai_clone/apps/api/src/app.module.ts)
- Register `StorageModule`, `ShoppableVideoModule`, `VideoFaqModule`, and `AiChatModule`.
- Import `BullModule.forRoot()` to configure Redis connection parameters for BullMQ task processing.

#### [NEW] [storage.service.ts](file:///d:/saleassists.ai_clone/apps/api/src/modules/storage/storage.service.ts)
- Initialize S3 `minio` client using env keys.
- Implement `getPresignedUploadUrl(bucketName: string, objectName: string, expirySeconds?: number)` for direct client uploads.
- Implement `deleteFile(objectName: string)`.

#### [NEW] [storage.controller.ts](file:///d:/saleassists.ai_clone/apps/api/src/modules/storage/storage.controller.ts)
- HTTP Endpoints:
  - `POST /storage/presigned-url` -> Generates upload URL for frontend.

#### [NEW] [storage.module.ts](file:///d:/saleassists.ai_clone/apps/api/src/modules/storage/storage.module.ts)
- Expose `StorageService` for other modules (video uploads).

#### [NEW] [shoppable-video.service.ts](file:///d:/saleassists.ai_clone/apps/api/src/modules/shoppable-video/shoppable-video.service.ts)
- Services for CRUD operations on `ShoppableVideo` and `VideoHotspot` tables.
- Push background job `transcode` when a video is created.
- Handle hotspot positional calculations.

#### [NEW] [shoppable-video.controller.ts](file:///d:/saleassists.ai_clone/apps/api/src/modules/shoppable-video/shoppable-video.controller.ts)
- HTTP Endpoints:
  - `POST /shoppable-videos` -> Create draft shoppable video record.
  - `GET /shoppable-videos` -> List tenant videos.
  - `GET /shoppable-videos/:id` -> Single video w/ hotspots list.
  - `PATCH /shoppable-videos/:id` -> Update details / publish state.
  - `DELETE /shoppable-videos/:id` -> Remove video from DB and MinIO.
  - `POST /shoppable-videos/:id/hotspots` -> Add product hotspot.
  - `DELETE /shoppable-videos/:id/hotspots/:hid` -> Delete hotspot.

#### [NEW] [video-transcode.processor.ts](file:///d:/saleassists.ai_clone/apps/api/src/modules/shoppable-video/processors/video-transcode.processor.ts)
- BullMQ queue processor: Updates video status from `PROCESSING` to `PUBLISHED`, and extracts thumbnails.

#### [NEW] [shoppable-video.module.ts](file:///d:/saleassists.ai_clone/apps/api/src/modules/shoppable-video/shoppable-video.module.ts)
- Bundle controllers, services, processors, and register the `video-transcode` queue.

#### [NEW] [video-faq.service.ts](file:///d:/saleassists.ai_clone/apps/api/src/modules/video-faq/video-faq.service.ts)
- CRUD services for `VideoFaq` and nested `VideoFaqItem` lists.

#### [NEW] [video-faq.controller.ts](file:///d:/saleassists.ai_clone/apps/api/src/modules/video-faq/video-faq.controller.ts)
- HTTP Endpoints:
  - `POST /video-faqs` -> Create collection.
  - `POST /video-faqs/:id/items` -> Add FAQ item.
  - `GET /video-faqs` -> List FAQ playlists.
  - `DELETE /video-faqs/:id` -> Remove playlist.

#### [NEW] [video-faq.module.ts](file:///d:/saleassists.ai_clone/apps/api/src/modules/video-faq/video-faq.module.ts)
- Register controllers and services.

#### [NEW] [ai-chat.service.ts](file:///d:/saleassists.ai_clone/apps/api/src/modules/ai-chat/ai-chat.service.ts)
- Session lifecycle CRUD.
- Call LiteLLM REST endpoints and map OpenAI chat outputs.
- Return a readable stream for Server-Sent Events (SSE).

#### [NEW] [ai-chat.controller.ts](file:///d:/saleassists.ai_clone/apps/api/src/modules/ai-chat/ai-chat.controller.ts)
- HTTP Endpoints:
  - `POST /ai-chat/sessions` -> Initiate support session.
  - `GET /ai-chat/sessions` -> List chat sessions.
  - `GET /ai-chat/sessions/:id` -> Get chat log.
  - `Sse('/ai-chat/sessions/:id/messages')` -> POST event source message that streams tokens to visitor.

#### [NEW] [ai-chat.module.ts](file:///d:/saleassists.ai_clone/apps/api/src/modules/ai-chat/ai-chat.module.ts)
- Bind modules.

---

### Next.js 15 Web Application (Interactive Interfaces)

#### [MODIFY] [api-client.ts](file:///d:/saleassists.ai_clone/apps/web/src/lib/api-client.ts)
- Register CRUD call endpoints for: `storageApi`, `shoppableVideoApi`, `videoFaqApi`, and `aiChatApi`.

#### [MODIFY] [page.tsx](file:///d:/saleassists.ai_clone/apps/web/src/app/%28dashboard%29/shoppable-videos/page.tsx)
- Render list grid of uploaded videos with statuses (draft, processing, published) and engagement metrics (views, clicks).
- Add slide-out drawer or modal to upload a video file. Generate presigned url -> upload directly to MinIO -> post info back to API.

#### [NEW] [[videoId]/page.tsx](file:///d:/saleassists.ai_clone/apps/web/src/app/%28dashboard%29/shoppable-videos/%5BvideoId%5D/page.tsx)
- Coded **Hotspot Timeline Editor**:
  - Interactive HTML5 `<video>` player.
  - Timeline slider to pause at specific timestamp.
  - Visual video canvas overlay: clicking anywhere captures X, Y relative coordinates.
  - Pop-up modal to select catalog product for the hotspot, set `startTime` & `endTime`.
  - Save hotspots database list.

#### [MODIFY] [page.tsx](file:///d:/saleassists.ai_clone/apps/web/src/app/%28dashboard%29/video-faq/page.tsx)
- Rebuild FAQ page.
- Add builder panel to write questions and record/upload short S3 video responses.
- FAQ lists view cards: clicking opens a floating WebRTC player with the answer.

#### [MODIFY] [page.tsx](file:///d:/saleassists.ai_clone/apps/web/src/app/%28dashboard%29/ai-chat/page.tsx)
- List current active chat sessions with visitors.

#### [NEW] [[sessionId]/page.tsx](file:///d:/saleassists.ai_clone/apps/web/src/app/%28dashboard%29/ai-chat/%5BsessionId%5D/page.tsx)
- Live chat screen with visitor.
- Feeds responses to visitor questions in real time using browser stream reader for SSE token processing.

## Verification Plan

### Automated Tests
- Run full compilation:
  ```bash
  pnpm turbo build
  ```

### Manual Verification
1. Upload a sample mp4 file on Shoppable Videos page, confirm presigned URL works and BullMQ successfully advances processing status to `PUBLISHED`.
2. Open the Hotspot editor, click on video canvas, attach a dummy product, play the video, and confirm the shoppable dot overlay displays only during the set duration.
3. Open AI Chat session, type a question, and confirm tokens stream back into chat feed with no latency.
