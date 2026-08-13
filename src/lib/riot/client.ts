import { riotRateLimiter } from "./rateLimiter";
import type { PlatformRoute, RegionalRoute } from "./regions";

export class RiotApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message: string
  ) {
    super(message);
    this.name = "RiotApiError";
  }
}

function getApiKey(): string {
  const key = process.env.RIOT_API_KEY;
  if (!key) {
    throw new Error("RIOT_API_KEY is not set. Add it to your .env file.");
  }
  return key;
}

async function riotFetch<T>(url: string, retries = 3): Promise<T> {
  await riotRateLimiter.acquire();

  const res = await fetch(url, {
    headers: { "X-Riot-Token": getApiKey() },
    cache: "no-store",
  });

  if (res.status === 429 && retries > 0) {
    const retryAfterSeconds = Number(res.headers.get("Retry-After") ?? "1");
    await new Promise((resolve) => setTimeout(resolve, (retryAfterSeconds + 1) * 1000));
    return riotFetch<T>(url, retries - 1);
  }

  if (!res.ok) {
    throw new RiotApiError(res.status, url, `Riot API request failed: ${res.status} ${res.statusText} (${url})`);
  }

  return res.json() as Promise<T>;
}

export function regionalUrl(region: RegionalRoute, path: string): string {
  return `https://${region}.api.riotgames.com${path}`;
}

export function platformUrl(platform: PlatformRoute, path: string): string {
  return `https://${platform}.api.riotgames.com${path}`;
}

export const riotClient = {
  get: riotFetch,
};
