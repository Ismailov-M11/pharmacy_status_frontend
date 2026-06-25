// ─── Types ────────────────────────────────────────────────────────────────────

export interface DrugItem {
  id: string;
  name: string;
  brand: string | null;
  manufacturer: string | null;
  imageUrl: string | null;
  minPrice: number;
  maxPrice: number;
  byPrescription: boolean;
}

export interface DrugListItem {
  drug: DrugItem;
  quantity: number;
}

export interface StockProduct {
  id: string;
  name: string;
  brand: string | null;
  manufacturer: string | null;
  price: number;
  expiration: string | null;
  stock: number;
  quantity: number;
  total: number;
}

export interface StockPharmacy {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  address: string | null;
  landmark: string | null;
  regionName: string | null;
  distance: number;
  totalAmount: number;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  openTime: string | null;
  closeTime: string | null;
  products: StockProduct[];
}

export interface MedicineFilterOptions {
  parentRegions: { parent_region_ru: string; parent_region_uz: string }[];
  regions: { region_ru: string; region_uz: string }[];
}

// ─── Backend Base URL ─────────────────────────────────────────────────────────

function getBackendRoot(): string {
  const raw = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  return raw.replace(/\/api\/status$/, "").replace(/\/api$/, "").replace(/\/$/, "");
}

const BACKEND_URL = getBackendRoot();

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getMedicineFilterOptions(
  token: string,
  parentRegion?: string
): Promise<MedicineFilterOptions> {
  const params = parentRegion
    ? `?parentRegion=${encodeURIComponent(parentRegion)}`
    : "";
  const response = await fetch(
    `${BACKEND_URL}/api/oson/medicine/filter-options${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error("Failed to fetch medicine filter options");
  return response.json();
}

export async function searchDrugs(
  token: string,
  searchText: string,
  signal?: AbortSignal
): Promise<{ items: DrugItem[] }> {
  const response = await fetch(`${BACKEND_URL}/api/oson/medicine/drug-search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ searchText }),
    signal,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || "Drug search failed");
  }
  return response.json();
}

export async function getPharmacyLocation(
  token: string,
  slug: string
): Promise<{ slug: string; latitude: number; longitude: number } | null> {
  const response = await fetch(
    `${BACKEND_URL}/api/oson/medicine/pharmacy-location/${encodeURIComponent(slug)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) return null;
  return response.json();
}

export interface OrderItem {
  slug: string;
  name: string;
  manufacturer: string | null;
  brand: string | null;
  imageUrl: string | null;
  quantity: number;
  price: number;
}

export interface OrderResult {
  id: number;
  code: string;
  status: string;
  customerPhone: string | null;
  marketName: string | null;
  creationDate: string;
  items: OrderItem[];
}

export async function searchOrders(
  token: string,
  searchKey: string,
  size = 10
): Promise<{ orders: OrderResult[]; total: number }> {
  const response = await fetch(`${BACKEND_URL}/api/oson/medicine/order-search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ searchKey, page: 0, size }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || "Order search failed");
  }
  return response.json();
}

export async function searchStock(
  token: string,
  drugs: { id: string; name: string; manufacturer: string | null; quantity: number }[],
  parentRegion: string,
  region?: string
): Promise<{ pharmacies: StockPharmacy[]; totalPharmacies: number }> {
  const response = await fetch(`${BACKEND_URL}/api/oson/medicine/stock-search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ drugs, parentRegion, region: region || undefined }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || "Stock search failed");
  }
  return response.json();
}
