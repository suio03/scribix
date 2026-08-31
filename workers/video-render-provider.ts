import { AwsClient } from "aws4fetch";

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
  submitPreview(job: PreviewProviderJob): Promise<string>;
  describe(providerJobIds: string[]): Promise<Map<string, ProviderJobState>>;
}

type AwsBatchConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  jobQueue: string;
  jobDefinition: string;
};

export class AwsBatchRenderProvider implements VideoRenderProvider {
  private readonly client: AwsClient;

  constructor(private readonly config: AwsBatchConfig) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      sessionToken: config.sessionToken,
      service: "batch",
      region: config.region,
    });
  }

  async submitPreview(job: PreviewProviderJob): Promise<string> {
    const response = await this.client.fetch(this.request("/v1/submitjob", {
      jobDefinition: this.config.jobDefinition,
      jobName: `scribix-preview-${safeJobName(job.jobId)}`,
      jobQueue: this.config.jobQueue,
      containerOverrides: {
        environment: [
          { name: "SCRIBIX_JOB_ID", value: job.jobId },
          { name: "SCRIBIX_JOB_TOKEN", value: job.jobToken },
          { name: "SCRIBIX_INTERNAL_URL", value: job.internalBaseUrl },
        ],
      },
      propagateTags: true,
      retryStrategy: { attempts: 1 },
      tags: { workload: "video-preview", application: "scribix" },
      timeout: { attemptDurationSeconds: 30 * 60 },
    }));
    const body = await response.json() as { jobId?: string };
    if (!response.ok || !body.jobId) {
      throw new Error(`aws_batch_submit_${response.status}`);
    }
    return body.jobId;
  }

  async describe(providerJobIds: string[]): Promise<Map<string, ProviderJobState>> {
    if (providerJobIds.length === 0) return new Map();
    const response = await this.client.fetch(this.request("/v1/describejobs", {
      jobs: providerJobIds.slice(0, 100),
    }));
    const body = await response.json() as {
      jobs?: Array<{ jobId?: string; status?: string }>;
    };
    if (!response.ok) throw new Error(`aws_batch_describe_${response.status}`);
    return new Map((body.jobs ?? []).flatMap((job) => {
      if (!job.jobId || !job.status) return [];
      return [[job.jobId, awsState(job.status)] as const];
    }));
  }

  private request(path: string, body: object): Request {
    return new Request(
      `https://batch.${this.config.region}.amazonaws.com${path}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  }
}

function awsState(status: string): ProviderJobState {
  if (status === "RUNNING") return "running";
  if (status === "SUCCEEDED") return "succeeded";
  if (status === "FAILED") return "failed";
  if (status === "STARTING") return "preparing";
  return "queued";
}

function safeJobName(jobId: string): string {
  return jobId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 100);
}
