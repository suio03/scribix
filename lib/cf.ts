import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function cf() {
  return (await getCloudflareContext({ async: true })).env;
}

export async function cfBackground(work: () => Promise<unknown>) {
  const {ctx} = await getCloudflareContext({async: true});
  ctx.waitUntil(work().catch(() => { /* Persisted requests are recovered by the progress reader. */ }));
}
