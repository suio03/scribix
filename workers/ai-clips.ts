import { runAnalysisTurn, cleanupExpiredAnalysis, type AnalysisEnv } from "../lib/video-workspace/analysis-runner";
export default {
  async queue(batch: MessageBatch, env: AnalysisEnv) {
    await Promise.all(batch.messages.map(async message => {
      try { if (await runAnalysisTurn(env)) await env.AI_CLIPS_QUEUE.send({ wake: true }, { delaySeconds: 5 }); message.ack(); }
      catch { message.retry({ delaySeconds: 60 }); }
    }));
  },
  async scheduled(_controller: ScheduledController, env: AnalysisEnv) {
    // Recovery never checks the admission flag. Accepted tasks survive flag rollback and lost messages.
    await cleanupExpiredAnalysis(env).catch(() => console.error(JSON.stringify({ event: "analysis_cleanup_failed" })));
    await env.AI_CLIPS_QUEUE.sendBatch(Array.from({ length: 4 }, () => ({ body: { wake: true } })));
  },
};
