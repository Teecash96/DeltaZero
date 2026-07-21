import type {
  AuditRequest,
  AuditResponse,
  BuildRequest,
  BuildResponse,
  DeltaZeroClientOptions,
  StressTestRequest,
  StressTestResponse,
  RiskEnvelopeRequest,
  RiskEnvelopeV1,
  WalletAnalyzeRequest,
  WalletPortfolioResponse,
} from "./types.js";

export class DeltaZeroError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeltaZeroError";
  }
}

export class DeltaZeroApiError extends DeltaZeroError {
  readonly status: number;
  readonly url: string;
  readonly body: unknown;

  constructor(message: string, options: { status: number; url: string; body: unknown }) {
    super(message);
    this.name = "DeltaZeroApiError";
    this.status = options.status;
    this.url = options.url;
    this.body = options.body;
  }
}

export class DeltaZeroTimeoutError extends DeltaZeroError {
  readonly url: string;

  constructor(message: string, url: string) {
    super(message);
    this.name = "DeltaZeroTimeoutError";
    this.url = url;
  }
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function describeErrorBody(body: unknown, fallback: string) {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return JSON.stringify(detail);
    if (detail && typeof detail === "object") return JSON.stringify(detail);
  }
  return fallback;
}

async function parseJsonBody(response: Response, url: string) {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DeltaZeroError(`Invalid JSON returned from ${url}.`);
  }
}

export class DeltaZeroClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: DeltaZeroClientOptions) {
    if (!options.baseUrl?.trim()) {
      throw new DeltaZeroError("A baseUrl is required.");
    }

    this.baseUrl = normalizeBaseUrl(options.baseUrl.trim());
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const parsed = await parseJsonBody(response, url);

      if (!response.ok) {
        const detail = describeErrorBody(parsed, response.statusText || "Request failed.");
        throw new DeltaZeroApiError(`API ${response.status}: ${detail}`, {
          status: response.status,
          url,
          body: parsed,
        });
      }

      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new DeltaZeroError(`Invalid response body returned from ${url}.`);
      }

      return parsed as T;
    } catch (error) {
      if (error instanceof DeltaZeroError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new DeltaZeroTimeoutError(`Request to ${url} timed out after ${this.timeoutMs}ms.`, url);
      }
      throw new DeltaZeroError(error instanceof Error ? error.message : `Request to ${url} failed.`);
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  buildStrategy(body: BuildRequest): Promise<BuildResponse> {
    return this.request<BuildResponse>("/strategy/build", body);
  }

  auditPosition(body: AuditRequest): Promise<AuditResponse> {
    return this.request<AuditResponse>("/strategy/audit", body);
  }

  stressTest(body: StressTestRequest): Promise<StressTestResponse> {
    return this.request<StressTestResponse>("/strategy/stress-test", body);
  }

  auditWallet(body: WalletAnalyzeRequest): Promise<WalletPortfolioResponse> {
    return this.request<WalletPortfolioResponse>("/wallet/analyze", body);
  }

  evaluateRiskEnvelope(body: RiskEnvelopeRequest): Promise<RiskEnvelopeV1> {
    return this.request<RiskEnvelopeV1>("/risk-envelope/evaluate", body);
  }
}
