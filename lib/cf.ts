import { getCloudflareContext } from "@opennextjs/cloudflare";

export function cf() {
  return getCloudflareContext().env;
}
