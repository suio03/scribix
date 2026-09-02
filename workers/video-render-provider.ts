export type PreviewProviderJob = {
  jobId: string;
  jobToken: string;
  internalBaseUrl: string;
};

export type ProviderJobState =
  | "queued"
  | "preparing"
  | "running"
  | "succeeded"
  | "failed";

export interface VideoRenderProvider {
  submit(job: PreviewProviderJob, kind: "preview" | "final"): Promise<string>;
  describe(providerJobIds: string[]): Promise<Map<string, ProviderJobState>>;
  cancel(providerJobId: string): Promise<void>;
}

type RenderContainer = {
  start(options: {
    envVars: Record<string, string>;
    enableInternet: boolean;
    labels: Record<string, string>;
  }): Promise<void>;
  destroy(): Promise<void>;
  getState(): Promise<{
    status: "running" | "stopping" | "stopped" | "healthy" | "stopped_with_code";
    exitCode?: number;
  }>;
};

type RenderContainerNamespace = {
  getByName(name: string): RenderContainer;
};

export class CloudflareContainerRenderProvider implements VideoRenderProvider {
  constructor(private readonly containers: RenderContainerNamespace) {}

  async submit(job: PreviewProviderJob, kind: "preview" | "final"): Promise<string> {
    const providerJobId = job.jobId;
    await this.containers.getByName(providerJobId).start({
      envVars: {
        SCRIBIX_JOB_ID: job.jobId,
        SCRIBIX_JOB_TOKEN: job.jobToken,
        SCRIBIX_INTERNAL_URL: job.internalBaseUrl,
      },
      enableInternet: true,
      labels: {
        application: "scribix",
        workload: `video-${kind}`,
        job: safeLabel(job.jobId),
      },
    });
    return providerJobId;
  }

  async cancel(providerJobId: string): Promise<void> {
    await this.containers.getByName(providerJobId).destroy();
  }

  async describe(providerJobIds: string[]): Promise<Map<string, ProviderJobState>> {
    if (providerJobIds.length === 0) return new Map();
    const states = await Promise.all(providerJobIds.slice(0, 100).map(async (jobId) => {
      const state = await this.containers.getByName(jobId).getState();
      return [jobId, containerState(state)] as const;
    }));
    return new Map(states);
  }
}

function containerState(state: Awaited<ReturnType<RenderContainer["getState"]>>): ProviderJobState {
  if (state.status === "healthy") return "running";
  if (state.status === "running") return "preparing";
  if (state.status === "stopping") return "running";
  if (state.status === "stopped_with_code") {
    return state.exitCode === 0 ? "succeeded" : "failed";
  }
  return "queued";
}

function safeLabel(jobId: string): string {
  return jobId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 100);
}
