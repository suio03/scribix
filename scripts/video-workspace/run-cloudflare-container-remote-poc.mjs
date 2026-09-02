import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

const args = parseArgs(process.argv.slice(2));
const baseUrl = requiredArg(args, "base-url").replace(/\/$/, "");
const sourcePath = resolve(requiredArg(args, "source"));
const outputDirectory = resolve(requiredArg(args, "output-dir"));
const token = process.env.VIDEO_POC_TOKEN;
if (!token) throw new Error("video_poc_token_missing");

const preuploadedSourceId = args.get("preuploaded-source-id");
if (preuploadedSourceId && !/^[a-zA-Z0-9_-]{8,80}$/.test(preuploadedSourceId)) {
  throw new Error("invalid_preuploaded_source_id");
}
const sourceId = preuploadedSourceId ?? stableId("source");
const allCases = ["continuous-15s", "continuous-30s", "splice-45s"];
const requestedCase = args.get("case");
if (requestedCase && !allCases.includes(requestedCase)) throw new Error("invalid_case");
const cases = requestedCase ? [requestedCase] : allCases;
const jobs = cases.map((caseId) => ({ caseId, jobId: stableId("job") }));
const headers = { authorization: `Bearer ${token}` };
const source = await stat(sourcePath);

await mkdir(outputDirectory, { recursive: true });

try {
  if (!preuploadedSourceId) {
    await uploadSource({ baseUrl, headers, sourceId, sourcePath, bytes: source.size });
  }
  console.log(JSON.stringify({
    event: "video_poc_remote_source_ready",
    bytes: source.size,
    preuploaded: Boolean(preuploadedSourceId),
  }));

  const completed = await Promise.all(jobs.map(async ({ caseId, jobId }) => {
    const dispatch = await runRemoteJob({ baseUrl, headers, sourceId, caseId, jobId });
    const containerReport = await dispatch.response.json();
    const report = {
      ...containerReport,
      orchestration: {
        capacityRetries: dispatch.capacityRetries,
        dispatchElapsedMs: dispatch.dispatchElapsedMs,
      },
    };
    const [video, cover] = await Promise.all([
      download(`${baseUrl}${report.videoPath}`, headers),
      download(`${baseUrl}${report.coverPath}`, headers),
    ]);
    await Promise.all([
      writeFile(resolve(outputDirectory, `${caseId}.mp4`), video),
      writeFile(resolve(outputDirectory, `${caseId}.jpg`), cover),
    ]);
    console.log(JSON.stringify({
      event: "video_poc_remote_case_completed",
      caseId,
      renderMs: report.renderMs,
      totalMs: report.totalMs,
      estimatedContainerCostUsd: report.estimatedContainerCostUsd,
    }));
    return report;
  }));

  const report = {
    schemaVersion: 1,
    profile: { vcpu: 1, memoryGiB: 3, diskGB: 6, maxInstances: 3 },
    source: {
      bytes: source.size,
      preuploaded: Boolean(preuploadedSourceId),
      nameRecorded: false,
      contentRecorded: false,
    },
    results: completed.sort((left, right) => left.caseId.localeCompare(right.caseId)),
    totals: {
      estimatedContainerCostUsd: round(
        completed.reduce((total, result) => total + result.estimatedContainerCostUsd, 0)
      ),
      maxTotalMs: Math.max(...completed.map((result) => result.totalMs)),
      capacityRetries: completed.reduce(
        (total, result) => total + result.orchestration.capacityRetries,
        0
      ),
      maxDispatchElapsedMs: Math.max(
        ...completed.map((result) => result.orchestration.dispatchElapsedMs)
      ),
    },
  };
  await writeFile(resolve(outputDirectory, "remote-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ event: "video_poc_remote_completed", ...report.totals }));
} finally {
  await Promise.allSettled([
    fetch(`${baseUrl}/sources/${sourceId}`, { method: "DELETE", headers }),
    ...jobs.map(({ caseId, jobId }) => fetch(
      `${baseUrl}/jobs/${jobId}?case=${encodeURIComponent(caseId)}`,
      { method: "DELETE", headers }
    )),
  ]);
}

async function download(url, headers) {
  const response = await expectOk(fetch(url, {
    headers,
    signal: AbortSignal.timeout(2 * 60 * 1_000),
  }), "output_download_failed");
  return new Uint8Array(await response.arrayBuffer());
}

async function uploadSource({ baseUrl, headers, sourceId, sourcePath, bytes }) {
  if (bytes <= 90 * 1024 * 1024) {
    await expectOk(fetch(`${baseUrl}/sources/${sourceId}`, {
      method: "PUT",
      headers: {
        ...headers,
        "content-type": contentType(sourcePath),
        "content-length": String(bytes),
      },
      body: createReadStream(sourcePath),
      duplex: "half",
      signal: AbortSignal.timeout(5 * 60 * 1_000),
    }), "source_upload_failed");
    return;
  }

  const created = await expectOk(fetch(`${baseUrl}/sources/${sourceId}/multipart`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ contentType: contentType(sourcePath) }),
    signal: AbortSignal.timeout(60_000),
  }), "multipart_create_failed");
  const creation = await created.json();
  if (typeof creation.uploadId !== "string" || creation.uploadId.length === 0) {
    throw new Error("multipart_create_invalid");
  }

  const uploadId = creation.uploadId;
  const partSize = 64 * 1024 * 1024;
  const parts = [];
  try {
    for (let offset = 0, partNumber = 1; offset < bytes; offset += partSize, partNumber += 1) {
      const length = Math.min(partSize, bytes - offset);
      const response = await expectOk(fetch(
        `${baseUrl}/sources/${sourceId}/multipart/${partNumber}`,
        {
          method: "PUT",
          headers: {
            ...headers,
            "content-type": "application/octet-stream",
            "content-length": String(length),
            "x-upload-id": uploadId,
          },
          body: createReadStream(sourcePath, { start: offset, end: offset + length - 1 }),
          duplex: "half",
          signal: AbortSignal.timeout(5 * 60 * 1_000),
        }
      ), "multipart_part_failed");
      const part = await response.json();
      if (part.partNumber !== partNumber || typeof part.etag !== "string") {
        throw new Error("multipart_part_invalid");
      }
      parts.push({ partNumber, etag: part.etag });
      console.log(JSON.stringify({
        event: "video_poc_remote_source_part_ready",
        partNumber,
        bytes: length,
      }));
    }
    await expectOk(fetch(`${baseUrl}/sources/${sourceId}/multipart/complete`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ uploadId, parts }),
      signal: AbortSignal.timeout(2 * 60 * 1_000),
    }), "multipart_complete_failed");
  } catch (error) {
    await fetch(`${baseUrl}/sources/${sourceId}/multipart`, {
      method: "DELETE",
      headers: { ...headers, "x-upload-id": uploadId },
      signal: AbortSignal.timeout(60_000),
    }).catch(() => undefined);
    throw error;
  }
}

function contentType(path) {
  return path.toLowerCase().endsWith(".mkv") ? "video/x-matroska" : "video/mp4";
}

async function runRemoteJob({ baseUrl, headers, sourceId, caseId, jobId }) {
  const maxAttempts = 12;
  const startedAt = Date.now();
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`${baseUrl}/jobs/${jobId}`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ sourceId, caseId, reframeMode: "auto" }),
      signal: AbortSignal.timeout(15 * 60 * 1_000),
    });
    if (response.ok) {
      return {
        response,
        capacityRetries: attempt - 1,
        dispatchElapsedMs: Date.now() - startedAt,
      };
    }

    const details = await response.text();
    const capacityUnavailable = response.status === 502 &&
      details.includes("source_transfer_failed");
    if (!capacityUnavailable || attempt === maxAttempts) {
      throw new Error(`remote_${caseId}_failed:${response.status}:${details.slice(0, 120)}`);
    }
    console.log(JSON.stringify({
      event: "video_poc_remote_capacity_retry",
      caseId,
      attempt,
      retryAfterMs: 10_000,
    }));
    await wait(10_000);
  }
  throw new Error(`remote_${caseId}_failed:retry_exhausted`);
}

async function expectOk(promise, code) {
  const response = await promise;
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`${code}:${response.status}:${details.slice(0, 120)}`);
  }
  return response;
}

function stableId(prefix) {
  return `${prefix}-${randomUUID().replaceAll("-", "")}`;
}

function parseArgs(values) {
  const parsed = new Map();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error("invalid_arguments");
    parsed.set(key.slice(2), value);
  }
  return parsed;
}

function requiredArg(values, name) {
  const value = values.get(name);
  if (!value) throw new Error(`${name}_missing`);
  return value;
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function wait(durationMs) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, durationMs));
}
