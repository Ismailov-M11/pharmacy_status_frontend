function getBackendRoot(): string {
  const raw = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  return raw.replace(/\/api\/status$/, "").replace(/\/api$/, "").replace(/\/$/, "");
}

const BASE = `${getBackendRoot()}/api/user-carts`;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CartItem {
  id: number;
  slug: string;
  name: string;
  manufacturer: string;
  brand: string;
  imageUrl: string;
  quantity: number;
  price: number;
  total: number;
}

export interface UserCart {
  id: number;
  creation_date: string;
  modified_date: string;
  created_by: string;

  customer_id: number | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_phone: string | null;

  market_id: number | null;
  market_name: string | null;
  market_address: string | null;
  market_landmark: string | null;
  market_phone: string | null;
  market_latitude: number | null;
  market_longitude: number | null;
  market_slug: string | null;

  items: CartItem[];

  invoice_id: number | null;
  invoice_market_total: number;
  invoice_delivery_total: number;
  invoice_service_total: number;
  invoice_total: number;
  invoice_paid: boolean;
  invoice_promo_code: string | null;

  source: string | null;
  latitude: number | null;
  longitude: number | null;

  cart_status: "unprocessed" | "processed" | "missed_call";
  comment: string | null;
  comment_by: string | null;
  comment_at: string | null;
  last_synced_at: string | null;
  order_status: "pending" | "in_progress" | "delivered" | "cancelled" | "deleted";
  order_status_synced_at: string | null;
  order_code: string | null;
}

export interface CartFilters {
  search?: string;
  status?: string;
  pharmacies?: string[];
  sources?: string[];
  dateFrom?: string;
  dateTo?: string;
  itemsMin?: string;
  itemsMax?: string;
  totalMin?: string;
  totalMax?: string;
  promoCode?: string;
  historyStatuses?: string[];
  historyDateFrom?: string;
  historyDateTo?: string;
}

export interface CartDataResponse {
  data: UserCart[];
  total: number;
  page: number;
  size: number;
}

export interface CartStats {
  total: number;
  unprocessed: number;
  processed: number;
  lastSyncedAt: string | null;
}

export interface CartSyncStatus {
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  hasToken: boolean;
  progress: { current: number; total: number; percent: number; phase: string };
  stats: CartStats;
}

export interface CartFilterOptions {
  pharmacies: string[];
  sources: string[];
  commentUsers: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── API Functions ─────────────────────────────────────────────────────────────

export async function getUserCarts(token: string, filters: CartFilters = {}): Promise<CartDataResponse> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.pharmacies?.length) params.set("pharmacies", filters.pharmacies.join(","));
  if (filters.sources?.length) params.set("sources", filters.sources.join(","));
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.itemsMin) params.set("itemsMin", filters.itemsMin);
  if (filters.itemsMax) params.set("itemsMax", filters.itemsMax);
  if (filters.totalMin) params.set("totalMin", filters.totalMin);
  if (filters.totalMax) params.set("totalMax", filters.totalMax);
  if (filters.promoCode) params.set("promoCode", filters.promoCode);
  if (filters.historyStatuses?.length) params.set("historyStatuses", filters.historyStatuses.join(","));
  if (filters.historyDateFrom) params.set("historyDateFrom", filters.historyDateFrom);
  if (filters.historyDateTo) params.set("historyDateTo", filters.historyDateTo);
  params.set("size", "0"); // load all, do client-side pagination

  const res = await fetch(`${BASE}/data?${params}`, { headers: authHeader(token) });
  return handleResponse<CartDataResponse>(res);
}

export async function getCartSyncStatus(token: string): Promise<CartSyncStatus> {
  const res = await fetch(`${BASE}/sync-status`, { headers: authHeader(token) });
  return handleResponse<CartSyncStatus>(res);
}

export async function triggerCartSync(token: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/sync`, {
    method: "POST",
    headers: authHeader(token),
  });
  return handleResponse(res);
}

export async function updateCartComment(
  token: string,
  cartId: number,
  comment: string,
  commentBy: string
): Promise<UserCart> {
  const res = await fetch(`${BASE}/${cartId}/comment`, {
    method: "PUT",
    headers: authHeader(token),
    body: JSON.stringify({ comment, commentBy }),
  });
  return handleResponse<UserCart>(res);
}

export async function getCartFilterOptions(token: string): Promise<CartFilterOptions> {
  const res = await fetch(`${BASE}/filter-options`, { headers: authHeader(token) });
  return handleResponse<CartFilterOptions>(res);
}

// ─── Cart statuses ─────────────────────────────────────────────────────────────

export interface CartStatus {
  id: number;
  value: string;
  label: string;
  color: string;
  created_by: string | null;
  created_at: string;
}

export async function getCartStatuses(token: string): Promise<CartStatus[]> {
  const res = await fetch(`${BASE}/statuses`, { headers: authHeader(token) });
  return handleResponse<CartStatus[]>(res);
}

export async function createCartStatus(token: string, label: string, createdBy: string): Promise<CartStatus> {
  const res = await fetch(`${BASE}/statuses`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ label, createdBy }),
  });
  return handleResponse<CartStatus>(res);
}

// ─── Comment history ───────────────────────────────────────────────────────────

export interface CartComment {
  id: number;
  cart_id: number;
  text: string;
  created_by: string;
  created_at: string;
  status?: string;
}

export async function getCartComments(token: string, cartId: number): Promise<CartComment[]> {
  const res = await fetch(`${BASE}/${cartId}/comments`, { headers: authHeader(token) });
  return handleResponse<CartComment[]>(res);
}

// ─── Order status sync ──────────────────────────────────────────────────────────

export interface OrderSyncResult {
  success: boolean;
  delivered: number;
  cancelled: number;
  checked: number;
  error?: string;
}

export interface OrderSyncState {
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastSyncResult: { delivered: number; cancelled: number; checked: number };
  hasToken: boolean;
}

export async function getOrderSyncStatus(token: string): Promise<OrderSyncState> {
  const res = await fetch(`${BASE}/order-sync-status`, { headers: authHeader(token) });
  return handleResponse<OrderSyncState>(res);
}

export async function triggerOrderSync(token: string): Promise<OrderSyncResult> {
  const res = await fetch(`${BASE}/order-sync`, {
    method: "POST",
    headers: authHeader(token),
  });
  return handleResponse<OrderSyncResult>(res);
}

export async function addCartComment(
  token: string,
  cartId: number,
  text: string,
  createdBy: string,
  status: string
): Promise<CartComment> {
  const res = await fetch(`${BASE}/${cartId}/comments`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ text, createdBy, status }),
  });
  return handleResponse<CartComment>(res);
}
