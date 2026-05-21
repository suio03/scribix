import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function cf() {
  return (await getCloudflareContext({ async: true })).env;
}
