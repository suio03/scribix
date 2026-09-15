import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Bound diagnostics and redact URLs/paths: never log source URLs or credentials.
export function framingDiagnostic(text) {
  return text.replace(/https?:\/\/[^\s"']+/g, "[url]")
    .replace(/\/(?:[^\s"':]+\/)*[^\s"':]+/g, "[path]")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").slice(-4096);
}

export async function analyzeFraming({ input, sourceStartMs, durationMs, workingDirectory, jobId }, {
  spawnProcess = spawn, timeoutMs = 15 * 60 * 1000,
} = {}) {
  const output = join(workingDirectory, "auto-framing.json");
  const started = Date.now();
  const context = { jobId, sourceStartMs, durationMs };
  let stderr = "", exitCode = null, signal = null;
  console.log(JSON.stringify({ event: "auto_framing_started", ...context }));
  try {
    await new Promise((resolve, reject) => {
      const child = spawnProcess("python3", ["/app/speaker-framing.py", "--input", input,
        "--source-start", String(sourceStartMs), "--duration", String(durationMs), "--output", output],
      { stdio: ["ignore", "ignore", "pipe"] });
      child.stderr.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-8192); });
      const timeout = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("analysis_timeout")); }, timeoutMs);
      child.on("error", () => { clearTimeout(timeout); reject(new Error("analysis_spawn_failed")); });
      child.on("close", (code, killedBy) => {
        clearTimeout(timeout); exitCode = code; signal = killedBy;
        code === 0 ? resolve() : reject(new Error("analysis_failed"));
      });
    });
    const plan = JSON.parse(await readFile(output, "utf8"));
    if (!Array.isArray(plan.points) || !plan.points.length) throw new Error("analysis_invalid_output");
    console.log(JSON.stringify({ event: "auto_framing_completed", ...context,
      elapsedMs: Date.now() - started, analyzer: plan.analyzer,
      fillPoints: plan.points.filter(point => point.framingMode === "fill").length,
      fitPoints: plan.points.filter(point => point.framingMode === "fit").length }));
    return plan;
  } catch (error) {
    const reason = ["analysis_timeout", "analysis_spawn_failed", "analysis_failed", "analysis_invalid_output"].includes(error.message)
      ? error.message : "analysis_output_unavailable";
    console.warn(JSON.stringify({ event: "auto_framing_fallback", ...context,
      reason, elapsedMs: Date.now() - started, exitCode, signal, stderr: framingDiagnostic(stderr) }));
    return { schemaVersion: 1, analyzer: "analysis-unavailable-v1", sourceStartMs, sourceEndMs: sourceStartMs + durationMs,
      points: [{ sourceMs: sourceStartMs, framingMode: "fit", crop: { x: .5, y: .5, zoom: 1 } }] };
  }
}
