# Runbook — Monthly AssemblyAI bulk delete

`DELETE /api/transcripts/[id]` and `DELETE /api/account` only soft-delete in D1
and remove R2 objects. AssemblyAI still holds the source-of-truth transcript
JSON for every job we ever submitted. This monthly job purges them and then
hard-deletes the soft-deleted rows.

This satisfies GDPR Article 17's "without undue delay" with a defined cadence.
See `docs/progress.md` §11 for the design rationale (per-delete API call
replaced by monthly bulk).

## When

First Monday of each month, before noon UTC.

## What gets deleted

- AssemblyAI transcripts whose row has `deleted_at IS NOT NULL`
  AND `aai_transcript_id IS NOT NULL`.
- After AAI returns 200/404 for each, the D1 row is hard-deleted.

The R2 objects were already removed at soft-delete time, so this job is
AAI + D1 only.

## Steps

### 1. Snapshot the soft-deleted rows

Run from a machine with `wrangler` configured for the production Worker:

```bash
npx wrangler d1 execute scribix-db --remote \
  --command "SELECT id, aai_transcript_id FROM transcripts \
             WHERE deleted_at IS NOT NULL AND aai_transcript_id IS NOT NULL \
             ORDER BY deleted_at LIMIT 1000;" \
  --json > /tmp/aai-purge-batch.json
```

Cap at 1000 per run. If there are more, repeat after step 4.

### 2. Sanity-check the count

```bash
jq '.[0].results | length' /tmp/aai-purge-batch.json
```

If 0, you're done — exit. If ≥ 950, plan to run this multiple times during the same maintenance window.

### 3. DELETE each from AssemblyAI

```bash
ASSEMBLYAI_API_KEY="$(op read 'op://Scribix/aai/api_key')"   # or however prod secrets are stored

jq -r '.[0].results[] | .aai_transcript_id' /tmp/aai-purge-batch.json \
  | while read -r aai_id; do
      code=$(curl -sS -o /dev/null -w '%{http_code}' \
        -X DELETE "https://api.assemblyai.com/v2/transcript/$aai_id" \
        -H "authorization: $ASSEMBLYAI_API_KEY")
      echo "$aai_id $code"
    done | tee /tmp/aai-purge-result.log
```

Acceptable response codes:
- `200` — deleted.
- `404` — already gone (idempotent re-run, or AAI's own retention purged it). Treat as success.
- Anything else (403, 429, 5xx) — **stop**, investigate, do not proceed to
  step 4 for those ids.

### 4. Hard-delete the matching D1 rows

Build a SQL `IN (...)` list from the ids that returned 200 or 404:

```bash
ids=$(awk '$2==200 || $2==404 {print $1}' /tmp/aai-purge-result.log \
        | sed "s/^/'/;s/$/'/" | paste -sd, -)

npx wrangler d1 execute scribix-db --remote \
  --command "DELETE FROM transcripts WHERE aai_transcript_id IN ($ids);"
```

### 5. Hard-delete users with no remaining transcripts

After the row purge, soft-deleted users with no rows left are safe to remove.
Their PII (email, name, avatar) goes with them.

```bash
npx wrangler d1 execute scribix-db --remote \
  --command "DELETE FROM users \
             WHERE deleted_at IS NOT NULL \
               AND id NOT IN (SELECT user_id FROM transcripts);"
```

### 6. Log the summary

Write a one-line structured log entry:

```
{"event":"aai_bulk_delete_completed","transcriptsPurged":<N>,"usersDeleted":<M>,"failedIds":<K>}
```

## Failure modes

- **AAI 5xx for many ids**: pause, retry the failed ids in 30 min. AAI's
  delete is idempotent.
- **AAI 401/403**: API key rotated. Update `ASSEMBLYAI_API_KEY` and rerun.
- **D1 `IN (…)` over the parameter limit**: chunk to 500 ids per statement.
- **Job didn't run for two months**: each run still caps at 1000, but
  multiple consecutive runs are safe.

## Why not real-time per-delete

AAI's delete endpoint is rate-limited and adds an extra failure surface to a
user-facing path (delete transcript / delete account). A monthly bulk pass
keeps the user-facing path R2 + D1 only, and concentrates AAI churn into one
predictable window.
