export type RegionalRoute = "americas" | "asia" | "europe";

export type PlatformRoute =
  | "na1"
  | "br1"
  | "la1"
  | "la2"
  | "oc1"
  | "euw1"
  | "eun1"
  | "tr1"
  | "ru"
  | "kr"
  | "jp1";

const PLATFORM_TO_REGIONAL: Record<PlatformRoute, RegionalRoute> = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  oc1: "americas",
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  kr: "asia",
  jp1: "asia",
};

export const PLATFORM_ROUTES = Object.keys(PLATFORM_TO_REGIONAL) as PlatformRoute[];

export function isPlatformRoute(value: string): value is PlatformRoute {
  return value in PLATFORM_TO_REGIONAL;
}

export function toRegionalRoute(platform: PlatformRoute): RegionalRoute {
  return PLATFORM_TO_REGIONAL[platform];
}
