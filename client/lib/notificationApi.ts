export const DEV_API_BASE_URL = "https://dev-api.davodelivery.uz/api";
export const PROD_API_BASE_URL = "https://api.davodelivery.uz/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NotificationListRequest {
  partnerId?: number;
  marketId?: number;
  campaignId?: number;
  searchKey?: string;
  statuses?: string[];
  status?: string;
  source?: string;
  orderBy?: string;
  desc?: boolean;
  active?: boolean | null;
  page: number;
  size: number;
  dateField?: string;
  fromDate?: string;
  toDate?: string;
  gender?: "MALE" | "FEMALE";
  age?: number;
  minAge?: number;
  maxAge?: number;
}

export interface CampaignListRequest {
  partnerId?: number;
  marketId?: number;
  campaignId?: number;
  searchKey?: string;
  statuses?: string[];
  status?: string;
  source?: string;
  orderBy?: string;
  desc?: boolean;
  active?: boolean | null;
  page: number;
  size: number;
  dateField?: string;
  fromDate?: string;
  toDate?: string;
}

export interface CreateCampaignRequest {
  type: string;
  title: string;
  titleRu: string;
  body: string;
  bodyRu: string;
  source: "HAMBI";
}

export interface NotificationCampaign {
  id: number;
  title?: string | null;
  titleRu?: string | null;
  body?: string | null;
  bodyRu?: string | null;
  type?: string | null;
  status?: string | null;
  totalCount?: number;
  successCount?: number;
  failCount?: number;
  tgCount?: number | null;
  mobileCount?: number | null;
  createdBy?: string | null;
  creationDate?: string | null;
  modifiedDate?: string | null;
}

export interface NotificationUser {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  source?: string | null;
  isVerified?: boolean | null;
  deviceVerified?: boolean;
}

export interface NotificationDevice {
  name?: string | null;
  token?: string | null;
  version?: string | null;
  deviceId?: string | null;
  deviceInfo?: string | null;
  deviceType?: string | null;
  lastLoginTime?: string | null;
  createdDate?: string | null;
  modifiedDate?: string | null;
}

export interface Notification {
  id: number;
  campaign?: NotificationCampaign | null;
  user?: NotificationUser | null;
  device?: NotificationDevice | null;
  status?: string | null;
  error?: string | null;
  processedAt?: string | null;
  destination?: string | null;
  [key: string]: any;
}

export interface Campaign {
  id: number;
  type?: string;
  title?: string;
  titleRu?: string;
  body?: string;
  bodyRu?: string;
  status?: string;
  source?: string;
  active?: boolean;
  createdAt?: string;
  creationDate?: string;
  modifiedDate?: string;
  createdBy?: string;
  modifiedBy?: string;
  totalCount?: number;
  successCount?: number;
  failCount?: number;
  tgCount?: number | null;
  mobileCount?: number | null;
  [key: string]: any;
}

export interface NotificationListResponse {
  payload?: {
    list?: Notification[];
    total?: number;
    totalElements?: number;
    content?: Notification[];
    [key: string]: any;
  };
  list?: Notification[];
  total?: number;
  totalElements?: number;
  content?: Notification[];
  status?: string;
  code?: number;
  [key: string]: any;
}

export interface CampaignListResponse {
  payload?: {
    list?: Campaign[];
    total?: number;
    totalElements?: number;
    content?: Campaign[];
    [key: string]: any;
  };
  list?: Campaign[];
  total?: number;
  totalElements?: number;
  content?: Campaign[];
  status?: string;
  code?: number;
  [key: string]: any;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function fetchNotifications(
  token: string,
  params: NotificationListRequest,
  baseUrl: string = DEV_API_BASE_URL
): Promise<NotificationListResponse> {
  const response = await fetch(
    `${baseUrl}/campaign/notification/list`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        accept: "*/*",
      },
      body: JSON.stringify(params),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  return response.json();
}

export async function fetchCampaigns(
  token: string,
  params: CampaignListRequest,
  baseUrl: string = DEV_API_BASE_URL
): Promise<CampaignListResponse> {
  const response = await fetch(`${baseUrl}/campaign/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      accept: "*/*",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  return response.json();
}

export async function createCampaign(
  token: string,
  data: CreateCampaignRequest,
  baseUrl: string = DEV_API_BASE_URL
): Promise<any> {
  const response = await fetch(`${baseUrl}/campaign/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      accept: "*/*",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  return response.json();
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

export function extractNotifications(data: NotificationListResponse): Notification[] {
  return (
    data?.payload?.list ??
    data?.payload?.content ??
    data?.list ??
    data?.content ??
    []
  );
}

export function extractNotificationTotal(data: NotificationListResponse): number {
  return (
    data?.payload?.total ??
    data?.payload?.totalElements ??
    data?.total ??
    data?.totalElements ??
    0
  );
}

export function extractCampaigns(data: CampaignListResponse): Campaign[] {
  return (
    data?.payload?.list ??
    data?.payload?.content ??
    data?.list ??
    data?.content ??
    []
  );
}

export function extractCampaignTotal(data: CampaignListResponse): number {
  return (
    data?.payload?.total ??
    data?.payload?.totalElements ??
    data?.total ??
    data?.totalElements ??
    0
  );
}
