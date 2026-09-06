import { Zip, ZipPassThrough } from "fflate";

export function exportFileName(title: string, number: number, clipTitle: string): string {
  const clean = (value: string) => Array.from(value.normalize("NFC")
    .replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, "-").trim()).slice(0, 70).join("") || "scribix";
  return `${clean(title)}-clip-${String(number).padStart(2, "0")}-${clean(clipTitle)}`;
}

export function attachmentHeader(name: string): string {
  return `attachment; filename="scribix-export.zip"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, char => "%" + char.charCodeAt(0).toString(16))}`;
}

// Store compressed video as-is, streaming one asset at a time with backpressure.
// This avoids buffering several clips in a Cloudflare Worker's memory.
export function exportArchive(entries: Array<{ name: string; body: ReadableStream<Uint8Array> }>): ReadableStream<Uint8Array> {
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();
  let writes = Promise.resolve();
  const zip = new Zip((error, chunk, final) => {
    writes = writes.then(async () => {
      if (error) throw error;
      await writer.write(chunk);
      if (final) await writer.close();
    });
    // A client disconnect can reject before the producer resumes awaiting writes.
    void writes.catch(() => undefined);
  });
  void (async () => {
    try {
      for (const entry of entries) {
        const file = new ZipPassThrough(entry.name);
        zip.add(file);
        const reader = entry.body.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            file.push(value, false);
            await writes;
          }
          file.push(new Uint8Array(), true);
          await writes;
        } finally {
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
      }
      zip.end();
      await writes;
    } catch (error) {
      zip.terminate();
      await writer.abort(error).catch(() => undefined);
      await Promise.allSettled(entries.filter(entry => !entry.body.locked).map(entry => entry.body.cancel()));
    }
  })();
  return stream.readable;
}
