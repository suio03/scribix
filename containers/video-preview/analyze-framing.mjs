import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function analyzeFraming({ input, sourceStartMs, durationMs, workingDirectory }) {
  const output = join(workingDirectory, "auto-framing.json");
  try {
    await new Promise((resolve, reject) => {
      const child = spawn("python3", ["/app/speaker-framing.py", "--input", input,
        "--source-start", String(sourceStartMs), "--duration", String(durationMs), "--output", output],
      { stdio: ["ignore", "ignore", "ignore"] });
      const timeout = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("analysis_timeout")); }, 15 * 60 * 1000);
      child.on("error", error => { clearTimeout(timeout); reject(error); });
      child.on("exit", code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error("analysis_failed")); });
    });
    return JSON.parse(await readFile(output, "utf8"));
  } catch {
    console.warn(JSON.stringify({ event: "auto_framing_fallback", reason: "analysis_unavailable" }));
    return { schemaVersion: 1, analyzer: "analysis-unavailable-v1", sourceStartMs, sourceEndMs: sourceStartMs + durationMs,
      points: [{ sourceMs: sourceStartMs, framingMode: "fit", crop: { x: .5, y: .5, zoom: 1 } }] };
  }
}
