// One-off migration: rekey R2 objects from type-first to user-first layout.
//
//   audio/<userId>/<transcriptId>/source.<ext>   →  users/<userId>/<transcriptId>/source.<ext>
//   transcripts/<userId>/<transcriptId>.json     →  users/<userId>/<transcriptId>/transcript.json
//
// Uses S3 CopyObject (server-side copy in R2 — bytes never transit through this script).
// D1 row updates are written as a SQL file and applied via `wrangler d1 execute --remote --file`.
//
// Usage:
//   node --env-file=.env.local scripts/migrate-r2-layout.mjs                 # dry-run
//   node --env-file=.env.local scripts/migrate-r2-layout.mjs --apply         # do the copies + D1 updates
//   node --env-file=.env.local scripts/migrate-r2-layout.mjs --cleanup       # delete old R2 objects (run after --apply succeeds)
//
// Safe to re-run: keys already in `users/...` are skipped.

import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { AwsClient } from "aws4fetch";

const BUCKET = "scribix-media";
const DB = "scribix-db";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const CLEANUP = args.has("--cleanup");

const accountId = required("CLOUDFLARE_ACCOUNT_ID");
const accessKeyId = required("R2_ACCESS_KEY_ID");
const secretAccessKey = required("R2_SECRET_ACCESS_KEY");

const aws = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
const endpoint = (key) =>
  `https://${accountId}.r2.cloudflarestorage.com/${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}. Run with: node --env-file=.env.local ${process.argv[1]}`);
    process.exit(1);
  }
  return v;
}

function rekeyAudio(oldKey) {
  // audio/<userId>/<transcriptId>/source.<ext>  →  users/<userId>/<transcriptId>/source.<ext>
  const m = oldKey.match(/^audio\/(.+)$/);
  return m ? `users/${m[1]}` : null;
}

function rekeyTranscript(oldKey) {
  // transcripts/<userId>/<transcriptId>.json  →  users/<userId>/<transcriptId>/transcript.json
  const m = oldKey.match(/^transcripts\/([^/]+)\/([^/]+)\.json$/);
  return m ? `users/${m[1]}/${m[2]}/transcript.json` : null;
}

async function copyObject(srcKey, dstKey) {
  const copySource = `/${BUCKET}/${srcKey.split("/").map(encodeURIComponent).join("/")}`;
  const res = await aws.fetch(endpoint(dstKey), {
    method: "PUT",
    headers: { "x-amz-copy-source": copySource },
  });
  if (!res.ok) {
    throw new Error(`CopyObject ${srcKey} → ${dstKey} failed: ${res.status} ${await res.text()}`);
  }
}

async function headObject(key) {
  const res = await aws.fetch(endpoint(key), { method: "HEAD" });
  if (res.ok) return true;
  if (res.status === 404) return false;
  // Anything else (401, 403, 429, 5xx, ...) is treated as transient/unknown —
  // throw so the per-row catch skips this row instead of NULLing the D1 key.
  throw new Error(`HEAD ${key} returned ${res.status}`);
}

async function deleteObject(key) {
  const res = await aws.fetch(endpoint(key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete ${key} failed: ${res.status}`);
  }
}

function d1Query(sql) {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", DB, "--remote", "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  // wrangler prints leading lines before the JSON array; grab from the first `[`.
  const i = out.indexOf("[");
  if (i === -1) throw new Error(`Unexpected wrangler output:\n${out}`);
  const parsed = JSON.parse(out.slice(i));
  return parsed[0]?.results ?? [];
}

function d1Execute(sqlFile) {
  execFileSync(
    "npx",
    ["wrangler", "d1", "execute", DB, "--remote", "--file", sqlFile],
    { stdio: "inherit" }
  );
}

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

async function main() {
  const rows = d1Query(
    "SELECT id, user_id, audio_r2_key, transcript_r2_key FROM transcripts WHERE deleted_at IS NULL"
  );

  const plan = [];
  for (const r of rows) {
    const updates = {};
    if (r.audio_r2_key) {
      const newKey = rekeyAudio(r.audio_r2_key);
      if (newKey && newKey !== r.audio_r2_key) updates.audio = { old: r.audio_r2_key, new: newKey };
    }
    if (r.transcript_r2_key) {
      const newKey = rekeyTranscript(r.transcript_r2_key);
      if (newKey && newKey !== r.transcript_r2_key) updates.transcript = { old: r.transcript_r2_key, new: newKey };
    }
    if (Object.keys(updates).length) plan.push({ id: r.id, ...updates });
  }

  console.log(`Rows scanned: ${rows.length}`);
  console.log(`Rows needing migration: ${plan.length}`);
  for (const p of plan) {
    console.log(`  ${p.id}`);
    if (p.audio) console.log(`    audio:      ${p.audio.old}  →  ${p.audio.new}`);
    if (p.transcript) console.log(`    transcript: ${p.transcript.old}  →  ${p.transcript.new}`);
  }
  if (CLEANUP) {
    if (APPLY) {
      console.error("Pass --cleanup separately from --apply. Run --apply first, verify, then --cleanup.");
      process.exit(2);
    }
    console.log("\n--cleanup mode: deleting old R2 objects (D1 already points at new keys).");
    for (const p of plan) {
      // Plan was rebuilt from current D1 state — but if D1 already has new keys,
      // `plan` will be empty. So in cleanup we rescan based on the original-prefix patterns.
    }
    // For cleanup, look at all rows whose keys are *already* on `users/` (post-migration)
    // and delete any matching old-prefix object that still exists.
    const post = d1Query(
      "SELECT id, user_id, audio_r2_key, transcript_r2_key FROM transcripts WHERE deleted_at IS NULL"
    );
    let deleted = 0;
    let skipped = 0;
    for (const r of post) {
      try {
        if (r.audio_r2_key?.startsWith("users/")) {
          const m = r.audio_r2_key.match(/^users\/([^/]+)\/([^/]+)\/source\.(.+)$/);
          if (m) {
            const oldAudio = `audio/${m[1]}/${m[2]}/source.${m[3]}`;
            if (await headObject(oldAudio)) {
              await deleteObject(oldAudio);
              deleted++;
              console.log(`  deleted ${oldAudio}`);
            }
          }
        }
        if (r.transcript_r2_key?.startsWith("users/")) {
          const m = r.transcript_r2_key.match(/^users\/([^/]+)\/([^/]+)\/transcript\.json$/);
          if (m) {
            const oldTranscript = `transcripts/${m[1]}/${m[2]}.json`;
            if (await headObject(oldTranscript)) {
              await deleteObject(oldTranscript);
              deleted++;
              console.log(`  deleted ${oldTranscript}`);
            }
          }
        }
      } catch (err) {
        skipped++;
        console.error(`  ✗ ${r.id}: ${err.message}`);
      }
    }
    console.log(`\nCleanup done. Deleted ${deleted} old objects${skipped ? `, skipped ${skipped} rows due to errors` : ""}.`);
    return;
  }

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to perform the copies + D1 updates.");
    return;
  }

  if (!plan.length) {
    console.log("Nothing to do.");
    return;
  }

  console.log("\n--apply mode: copying R2 objects + updating D1.\n");

  const okIds = [];
  for (const p of plan) {
    try {
      const update = {};
      if (p.audio) {
        if (await headObject(p.audio.old)) {
          await copyObject(p.audio.old, p.audio.new);
          if (!(await headObject(p.audio.new))) throw new Error(`HEAD ${p.audio.new} failed after copy`);
          update.audio = p.audio;
        } else if (await headObject(p.audio.new)) {
          console.log(`  · ${p.id}: audio old missing but new exists — adopting new key`);
          update.audio = p.audio;
        } else {
          console.log(`  · ${p.id}: audio missing at old AND new — NULLing D1 key`);
          update.audio = { old: p.audio.old, new: null };
        }
      }
      if (p.transcript) {
        if (await headObject(p.transcript.old)) {
          await copyObject(p.transcript.old, p.transcript.new);
          if (!(await headObject(p.transcript.new))) throw new Error(`HEAD ${p.transcript.new} failed after copy`);
          update.transcript = p.transcript;
        } else if (await headObject(p.transcript.new)) {
          console.log(`  · ${p.id}: transcript old missing but new exists — adopting new key`);
          update.transcript = p.transcript;
        } else {
          console.log(`  · ${p.id}: transcript missing at old AND new — NULLing D1 key`);
          update.transcript = { old: p.transcript.old, new: null };
        }
      }
      okIds.push({ id: p.id, ...update });
      console.log(`  ✓ ${p.id}`);
    } catch (err) {
      console.error(`  ✗ ${p.id}: ${err.message}`);
    }
  }

  if (!okIds.length) {
    console.log("\nNo successful copies — D1 not touched.");
    return;
  }

  // Build a single SQL file with all updates so it runs as one wrangler call.
  const stmts = okIds.flatMap((p) => {
    const sets = [];
    if (p.audio) sets.push(`audio_r2_key = ${p.audio.new === null ? "NULL" : `'${sqlEscape(p.audio.new)}'`}`);
    if (p.transcript) sets.push(`transcript_r2_key = ${p.transcript.new === null ? "NULL" : `'${sqlEscape(p.transcript.new)}'`}`);
    return [`UPDATE transcripts SET ${sets.join(", ")} WHERE id = '${sqlEscape(p.id)}';`];
  });
  const tmpFile = `/tmp/migrate-r2-${Date.now()}.sql`;
  writeFileSync(tmpFile, stmts.join("\n") + "\n");
  console.log(`\nApplying ${stmts.length} D1 updates via ${tmpFile} ...`);
  try {
    d1Execute(tmpFile);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }

  console.log("\nDone. Verify, then run with --cleanup to remove the old R2 objects.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
