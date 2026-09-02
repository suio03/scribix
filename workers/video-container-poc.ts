import { Container } from "@cloudflare/containers";

interface Env {
  VIDEO_POC: DurableObjectNamespace<VideoPocContainer>;
  VIDEO_POC_BUCKET: R2Bucket;
  VIDEO_POC_TOKEN: string;
}

type PocCaseId = "continuous-15s" | "continuous-30s" | "splice-45s";

type ContainerRenderResult = {
  jobId: string;
  caseId: PocCaseId;
  reframeMode: "auto" | "baseline";
  segmentCount: number;
  analysisMs: number;
  renderMs: number;
  elapsedMs: number;
  realtimeFactor: number;
  estimatedContainerCostUsd: number;
  videoBytes: number;
  coverBytes: number;
  output: {
    durationMs: number;
    bytes: number;
    width: number;
    height: number;
    videoCodec: string;
    audioCodec: string | null;
    hasAudio: boolean;
  };
  reframe: Array<{
    segmentId: string;
    mode: "smart_crop" | "fit_blur";
    confidence: number;
    reasons: string[];
    diagnostics: Record<string, number>;
  }>;
};

const CASE_IDS = new Set<PocCaseId>([
  "continuous-15s",
  "continuous-30s",
  "splice-45s",
]);
const MAX_SOURCE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_MULTIPART_BYTES = 64 * 1024 * 1024;

export class VideoPocContainer extends Container<Env> {
  defaultPort = 8080;
  requiredPorts = [8080];
  sleepAfter = "30s";
  enableInternet = false;
  pingEndpoint = "container/health";

  override onStart(): void {
    console.log(JSON.stringify({ event: "video_poc_container_started" }));
  }

  override onStop(): void {
    console.log(JSON.stringify({ event: "video_poc_container_stopped" }));
  }

  override onError(error: unknown): never {
    console.error(JSON.stringify({
      event: "video_poc_container_error",
      error: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    }));
    throw error;
  }

  override async onActivityExpired(): Promise<void> {
    await this.destroy();
  }

  async shutdown(): Promise<void> {
    await this.destroy();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ready" });
    }
    if (!env.VIDEO_POC_TOKEN) {
      return json({ error: "poc_not_configured" }, 503);
    }
    if (request.headers.get("authorization") !== `Bearer ${env.VIDEO_POC_TOKEN}`) {
      return json({ error: "unauthorized" }, 401);
    }

    try {
      const multipartCompleteMatch = url.pathname.match(
        /^\/sources\/([a-zA-Z0-9_-]{8,80})\/multipart\/complete$/
      );
      if (multipartCompleteMatch && request.method === "POST") {
        return completeMultipartSource(request, env, multipartCompleteMatch[1]);
      }
      const multipartPartMatch = url.pathname.match(
        /^\/sources\/([a-zA-Z0-9_-]{8,80})\/multipart\/([1-9][0-9]{0,3})$/
      );
      if (multipartPartMatch && request.method === "PUT") {
        return uploadSourcePart(
          request,
          env,
          multipartPartMatch[1],
          Number(multipartPartMatch[2])
        );
      }
      const multipartMatch = url.pathname.match(
        /^\/sources\/([a-zA-Z0-9_-]{8,80})\/multipart$/
      );
      if (multipartMatch) {
        if (request.method === "POST") {
          return createMultipartSource(request, env, multipartMatch[1]);
        }
        if (request.method === "DELETE") {
          return abortMultipartSource(request, env, multipartMatch[1]);
        }
      }
      const sourceMatch = url.pathname.match(/^\/sources\/([a-zA-Z0-9_-]{8,80})$/);
      if (sourceMatch) {
        if (request.method === "PUT") return uploadSource(request, env, sourceMatch[1]);
        if (request.method === "DELETE") return deleteSource(env, sourceMatch[1]);
      }
      const jobMatch = url.pathname.match(/^\/jobs\/([a-zA-Z0-9_-]{8,80})$/);
      if (jobMatch && request.method === "POST") {
        return runJob(request, env, jobMatch[1]);
      }
      if (jobMatch && request.method === "DELETE") {
        return deleteJob(url, env, jobMatch[1]);
      }
      const outputMatch = url.pathname.match(
        /^\/outputs\/([a-zA-Z0-9_-]{8,80})\/(continuous-15s|continuous-30s|splice-45s)\.(mp4|jpg)$/
      );
      if (outputMatch && request.method === "GET") {
        return readOutput(env, outputMatch[1], outputMatch[2] as PocCaseId, outputMatch[3]);
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: "video_poc_request_failed",
        errorType: error instanceof Error ? error.name : "unknown",
      }));
      return json({ error: "poc_request_failed" }, 500);
    }
    return json({ error: "not_found" }, 404);
  },
} satisfies ExportedHandler<Env>;

async function createMultipartSource(
  request: Request,
  env: Env,
  sourceId: string
): Promise<Response> {
  const body = await request.json<{ contentType?: unknown }>().catch(() => null);
  const contentType = typeof body?.contentType === "string"
    ? body.contentType.slice(0, 120)
    : "application/octet-stream";
  const upload = await env.VIDEO_POC_BUCKET.createMultipartUpload(sourceKey(sourceId), {
    httpMetadata: { contentType, cacheControl: "no-store" },
  });
  return json({ status: "multipart_ready", sourceId, uploadId: upload.uploadId });
}

async function uploadSourcePart(
  request: Request,
  env: Env,
  sourceId: string,
  partNumber: number
): Promise<Response> {
  const uploadId = request.headers.get("x-upload-id");
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (
    !uploadId || uploadId.length > 512 || !request.body ||
    contentLength <= 0 || contentLength > MAX_MULTIPART_BYTES
  ) return json({ error: "invalid_multipart_part" }, 400);
  const upload = env.VIDEO_POC_BUCKET.resumeMultipartUpload(sourceKey(sourceId), uploadId);
  const part = await upload.uploadPart(partNumber, request.body);
  return json({
    status: "part_ready",
    sourceId,
    partNumber: part.partNumber,
    etag: part.etag,
    bytes: contentLength,
  });
}

async function completeMultipartSource(
  request: Request,
  env: Env,
  sourceId: string
): Promise<Response> {
  const body = await request.json<{
    uploadId?: unknown;
    parts?: Array<{ partNumber?: unknown; etag?: unknown }>;
  }>().catch(() => null);
  if (
    typeof body?.uploadId !== "string" || body.uploadId.length > 512 ||
    !Array.isArray(body.parts) || body.parts.length === 0 || body.parts.length > 10_000
  ) return json({ error: "invalid_multipart_complete" }, 400);
  const parts = body.parts.map((part) => ({
    partNumber: Number(part.partNumber),
    etag: String(part.etag ?? ""),
  }));
  if (parts.some((part) => (
    !Number.isInteger(part.partNumber) || part.partNumber < 1 ||
    part.partNumber > 10_000 || part.etag.length === 0 || part.etag.length > 256
  ))) return json({ error: "invalid_multipart_complete" }, 400);
  const upload = env.VIDEO_POC_BUCKET.resumeMultipartUpload(sourceKey(sourceId), body.uploadId);
  const object = await upload.complete(parts);
  return json({
    status: "source_ready",
    sourceId,
    bytes: object.size,
    multipart: true,
  });
}

async function abortMultipartSource(
  request: Request,
  env: Env,
  sourceId: string
): Promise<Response> {
  const uploadId = request.headers.get("x-upload-id");
  if (!uploadId || uploadId.length > 512) {
    return json({ error: "invalid_multipart_abort" }, 400);
  }
  const upload = env.VIDEO_POC_BUCKET.resumeMultipartUpload(sourceKey(sourceId), uploadId);
  await upload.abort();
  return json({ status: "multipart_aborted", sourceId });
}

async function uploadSource(request: Request, env: Env, sourceId: string): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (!request.body || contentLength <= 0 || contentLength > MAX_SOURCE_BYTES) {
    return json({ error: "invalid_source_size" }, 400);
  }
  const key = sourceKey(sourceId);
  await env.VIDEO_POC_BUCKET.put(key, request.body, {
    httpMetadata: { contentType: "video/mp4", cacheControl: "no-store" },
  });
  console.log(JSON.stringify({
    event: "video_poc_source_uploaded",
    sourceId,
    bytes: contentLength,
  }));
  return json({ status: "source_ready", sourceId, bytes: contentLength });
}

async function deleteSource(env: Env, sourceId: string): Promise<Response> {
  await env.VIDEO_POC_BUCKET.delete(sourceKey(sourceId));
  return json({ status: "source_deleted", sourceId });
}

async function runJob(request: Request, env: Env, jobId: string): Promise<Response> {
  const startedAt = Date.now();
  const body = await parseJobRequest(request);
  if (!body) return json({ error: "invalid_job_request" }, 400);
  const source = await env.VIDEO_POC_BUCKET.get(sourceKey(body.sourceId));
  if (!source?.body) return json({ error: "source_not_found" }, 404);

  const container = env.VIDEO_POC.getByName(jobId);
  const transferStartedAt = Date.now();
  const sourceResponse = await container.fetch("http://container/source", {
    method: "PUT",
    headers: {
      "content-type": "video/mp4",
      "content-length": String(source.size),
    },
    body: source.body,
  });
  if (!sourceResponse.ok) return containerFailure("source_transfer_failed", sourceResponse);
  const sourceTransferMs = Date.now() - transferStartedAt;

  const renderResponse = await container.fetch("http://container/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jobId,
      caseId: body.caseId,
      reframeMode: body.reframeMode,
    }),
  });
  if (!renderResponse.ok) return containerFailure("render_failed", renderResponse);
  const render = await renderResponse.json<ContainerRenderResult>();

  const persistStartedAt = Date.now();
  const [videoResponse, coverResponse] = await Promise.all([
    container.fetch("http://container/output"),
    container.fetch("http://container/cover"),
  ]);
  if (!videoResponse.ok || !videoResponse.body || !coverResponse.ok || !coverResponse.body) {
    return json({ error: "container_output_missing" }, 502);
  }
  await Promise.all([
    putFixedLengthResponse(
      env.VIDEO_POC_BUCKET,
      outputKey(jobId, body.caseId, "mp4"),
      videoResponse,
      "video/mp4"
    ),
    putFixedLengthResponse(
      env.VIDEO_POC_BUCKET,
      outputKey(jobId, body.caseId, "jpg"),
      coverResponse,
      "image/jpeg"
    ),
  ]);
  const outputPersistMs = Date.now() - persistStartedAt;
  await stopContainer(container, jobId);
  const totalMs = Date.now() - startedAt;
  const report = {
    schemaVersion: 1,
    jobId,
    caseId: body.caseId,
    reframeMode: render.reframeMode,
    sourceTransferMs,
    analysisMs: render.analysisMs,
    renderMs: render.renderMs,
    containerElapsedMs: render.elapsedMs,
    outputPersistMs,
    totalMs,
    realtimeFactor: render.realtimeFactor,
    segmentCount: render.segmentCount,
    videoBytes: render.videoBytes,
    coverBytes: render.coverBytes,
    output: render.output,
    reframe: render.reframe,
    estimatedContainerCostUsd: estimateTotalCost(totalMs),
    privacy: {
      sourceNameRecorded: false,
      contentRecorded: false,
      captionsRecorded: false,
    },
  };
  await env.VIDEO_POC_BUCKET.put(reportKey(jobId), JSON.stringify(report), {
    httpMetadata: { contentType: "application/json", cacheControl: "no-store" },
  });
  console.log(JSON.stringify({ event: "video_poc_job_completed", ...report }));
  return json({
    ...report,
    videoPath: `/outputs/${jobId}/${body.caseId}.mp4`,
    coverPath: `/outputs/${jobId}/${body.caseId}.jpg`,
  });
}

async function deleteJob(url: URL, env: Env, jobId: string): Promise<Response> {
  const caseId = url.searchParams.get("case");
  if (!isCaseId(caseId)) return json({ error: "invalid_case" }, 400);
  await Promise.all([
    env.VIDEO_POC_BUCKET.delete([
      outputKey(jobId, caseId, "mp4"),
      outputKey(jobId, caseId, "jpg"),
      reportKey(jobId),
    ]),
    stopContainer(env.VIDEO_POC.getByName(jobId), jobId),
  ]);
  return json({ status: "job_deleted", jobId, caseId });
}

async function readOutput(
  env: Env,
  jobId: string,
  caseId: PocCaseId,
  extension: string
): Promise<Response> {
  const object = await env.VIDEO_POC_BUCKET.get(outputKey(jobId, caseId, extension));
  if (!object?.body) return json({ error: "output_not_found" }, 404);
  return new Response(object.body, {
    headers: {
      "content-type": extension === "mp4" ? "video/mp4" : "image/jpeg",
      "content-length": String(object.size),
      "cache-control": "no-store",
    },
  });
}

async function parseJobRequest(
  request: Request
): Promise<{
  sourceId: string;
  caseId: PocCaseId;
  reframeMode: "auto" | "baseline";
} | null> {
  try {
    const body = await request.json<{
      sourceId?: unknown;
      caseId?: unknown;
      reframeMode?: unknown;
    }>();
    if (
      typeof body.sourceId !== "string" ||
      !/^[a-zA-Z0-9_-]{8,80}$/.test(body.sourceId) ||
      !isCaseId(body.caseId) ||
      !["auto", "baseline"].includes(String(body.reframeMode))
    ) return null;
    return {
      sourceId: body.sourceId,
      caseId: body.caseId,
      reframeMode: body.reframeMode as "auto" | "baseline",
    };
  } catch {
    return null;
  }
}

async function containerFailure(code: string, response: Response): Promise<Response> {
  const details = await response.text();
  console.error(JSON.stringify({
    event: "video_poc_container_request_failed",
    errorCode: code,
    status: response.status,
    details: details.slice(0, 160),
  }));
  return json({ error: code }, 502);
}

function sourceKey(sourceId: string): string {
  return `sources/${sourceId}.mp4`;
}

function outputKey(jobId: string, caseId: PocCaseId, extension: string): string {
  return `outputs/${jobId}/${caseId}.${extension}`;
}

function reportKey(jobId: string): string {
  return `reports/${jobId}.json`;
}

function isCaseId(value: unknown): value is PocCaseId {
  return typeof value === "string" && CASE_IDS.has(value as PocCaseId);
}

function estimateTotalCost(elapsedMs: number): number {
  const activeSeconds = elapsedMs / 1_000;
  const provisionedSeconds = activeSeconds;
  const cost = activeSeconds * 0.000020 +
    3 * provisionedSeconds * 0.0000025 +
    6 * provisionedSeconds * 0.00000007;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

async function stopContainer(
  container: DurableObjectStub<VideoPocContainer>,
  jobId: string
): Promise<void> {
  try {
    await container.shutdown();
  } catch (error) {
    console.error(JSON.stringify({
      event: "video_poc_container_cleanup_failed",
      jobId,
      errorType: error instanceof Error ? error.name : "unknown",
    }));
  }
}

async function putFixedLengthResponse(
  bucket: R2Bucket,
  key: string,
  response: Response,
  contentType: string
): Promise<void> {
  if (!response.body) throw new Error("Container output body is missing");
  const contentLength = Number(response.headers.get("content-length"));
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throw new Error("Container output length is invalid");
  }

  const fixedLength = new FixedLengthStream(contentLength);
  await Promise.all([
    response.body.pipeTo(fixedLength.writable),
    bucket.put(key, fixedLength.readable, {
      httpMetadata: { contentType, cacheControl: "no-store" },
    }),
  ]);
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
