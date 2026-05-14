// ─── Types ────────────────────────────────────────────────────────────────────────────

export type OsonStatus = "connected" | "not_connected" | "deleted";

export interface OsonPharmacy {
  id: number;
  slug: string;
  name_ru: string | null;
  name_uz: string | null;
  parent_region_ru: string | null;
  parent_region_uz: string | null;
  region_ru: string | null;
  region_uz: string | null;
  address_ru: string | null;
  address_uz: string | null;
  landmark_ru: string | null;
  landmark_uz: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  open_time: string | null;
  close_time: string | null;
  has_delivery: boolean;
  is_verified: boolean;
  discount_percent: number;
  cashback_percent: number;
  oson_status: OsonStatus;
  last_synced_at: string;
  oson_synced_time: string | null;
  created_at: string;
}

export interface OsonStats {
  total: number;
  connected: number;
  not_connected: number;
  deleted: number;
  lastSyncedAt: string | null;
}

export interface OsonProgress {
  current: number;
  total: number;
  percent: number;  // 0-100
  phase: "collecting" | "syncing" | "cleanup" | "done" | "error" | "";
}

export interface OsonSyncStatus {
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  hasToken: boolean;
  progress: OsonProgress;
}

export interface OsonFilterOptions {
  parentRegions: { parent_region_ru: string; parent_region_uz: string }[];
  regions: { region_ru: string; region_uz: string }[];
}

export interface OsonDataResponse {
  data: OsonPharmacy[];
  total: number;
  page: number;
  size: number;
}

export interface OsonFilters {
  status?: (OsonStatus | "all")[] | OsonStatus | "all";
  parentRegion?: string[] | string;
  region?: string[] | string;
  search?: string;
  page?: number;
  size?: number;
}

// ─── Backend Base URL ────────────────────────────────────────────────────────────

// VITE_BACKEND_URL may end with "/api/status" or "/api" — we need the root
// e.g. "https://pharmacystatusbackend-production.up.railway.app/api/status"
//   → "https://pharmacystatusbackend-production.up.railway.app"
function getBackendRoot(): string {
  const raw = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  // Strip known suffixes that the existing api.ts adds automatically
  return raw.replace(/\/api\/status$/, "").replace(/\/api$/, "").replace(/\/$/, "");
}

const BACKEND_URL = getBackendRoot();


// ─── API Functions ───────────────────────────────────────────────────────────────

/**
 * Get OSON pharmacies with optional filters and pagination.
 * Pass size=0 to load all records (e.g. for map view).
 */
export async function getOsonPharmacies(
  token: string,
  filters: OsonFilters = {}
): Promise<OsonDataResponse> {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all" && (!Array.isArray(filters.status) || (filters.status as string[]).filter(s => s !== "all").length > 0)) {
    const statuses = Array.isArray(filters.status)
      ? (filters.status as string[]).filter(s => s !== "all")
      : [filters.status as string];
    if (statuses.length > 0) params.set("status", statuses.join(","));
  }
  if (filters.parentRegion && (!Array.isArray(filters.parentRegion) || filters.parentRegion.length > 0)) {
    params.set("parentRegion", Array.isArray(filters.parentRegion) ? filters.parentRegion.join(",") : filters.parentRegion);
  }
  if (filters.region && (!Array.isArray(filters.region) || filters.region.length > 0)) {
    params.set("region", Array.isArray(filters.region) ? filters.region.join(",") : filters.region);
  }
  if (filters.search) params.set("search", filters.search);
  if (filters.page !== undefined) params.set("page", String(filters.page));
  if (filters.size !== undefined) params.set("size", String(filters.size));

  const url = `${BACKEND_URL}/api/oson/data${params.toString() ? `?${params}` : ""}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OSON pharmacies: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get aggregate stats (counts + last sync time).
 * Pass the same location/search filters as getOsonPharmacies to get filtered counts.
 */
export async function getOsonStats(
  token: string,
  filters: Pick<OsonFilters, "parentRegion" | "region" | "search"> = {}
): Promise<OsonStats> {
  const params = new URLSearchParams();
  if (filters.parentRegion && (!Array.isArray(filters.parentRegion) || filters.parentRegion.length > 0)) {
    params.set("parentRegion", Array.isArray(filters.parentRegion) ? filters.parentRegion.join(",") : filters.parentRegion);
  }
  if (filters.region && (!Array.isArray(filters.region) || filters.region.length > 0)) {
    params.set("region", Array.isArray(filters.region) ? filters.region.join(",") : filters.region);
  }
  if (filters.search) params.set("search", filters.search);

  const url = `${BACKEND_URL}/api/oson/stats${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OSON stats: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Trigger a manual OSON sync (fires-and-forgets on backend)
 */
export async function triggerOsonSync(token: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${BACKEND_URL}/api/oson/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Sync failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get current sync status + stats + progress
 */
export async function getOsonSyncStatus(
  token: string
): Promise<{ isSyncing: boolean; lastSyncAt: string | null; lastSyncError: string | null; hasToken: boolean; stats: OsonStats; progress: OsonProgress }> {
  const response = await fetch(`${BACKEND_URL}/api/oson/sync-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sync status: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get filter options (parent regions + districts)
 */
export async function getOsonFilterOptions(
  token: string,
  parentRegion?: string
): Promise<OsonFilterOptions> {
  const params = parentRegion ? `?parentRegion=${encodeURIComponent(parentRegion)}` : "";
  const response = await fetch(`${BACKEND_URL}/api/oson/filter-options${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch filter options: ${response.statusText}`);
  }

  return response.json();
}
