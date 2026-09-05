-- Keep each completed clip export for 30 days from the time it finishes.
-- New renders set this timestamp when their result is accepted; this backfills
-- exports that completed before the retention policy was introduced.

UPDATE media_assets AS asset
   SET expires_at = (
         SELECT datetime(COALESCE(job.completed_at, asset.created_at), '+30 days')
           FROM render_jobs job
          WHERE job.kind = 'final'
            AND job.status = 'completed'
            AND asset.id IN (job.output_asset_id, job.cover_asset_id)
          ORDER BY job.completed_at DESC
          LIMIT 1
       )
 WHERE asset.kind IN ('final_video', 'cover')
   AND asset.status = 'ready'
   AND asset.deleted_at IS NULL
   AND asset.expires_at IS NULL
   AND EXISTS (
         SELECT 1
           FROM render_jobs job
          WHERE job.kind = 'final'
            AND job.status = 'completed'
            AND asset.id IN (job.output_asset_id, job.cover_asset_id)
       );
