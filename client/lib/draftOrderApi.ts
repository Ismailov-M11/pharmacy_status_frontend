const API_BASE_URL = "https://api.davodelivery.uz/api";

export interface DraftCustomer {
    id: number;
    firstName: string | null;
    lastName: string | null;
    phone: string;
}

export interface DraftMarket {
    id: number;
    address: string;
    landmark: string;
    name: string;
    phone: string;
    latitude: number;
    longitude: number;
    slug: string;
}

export interface DraftItem {
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

export interface DraftPromoCode {
    id: number;
    code: string;
}

export interface DraftInvoice {
    id: number;
    marketTotal: number;
    deliveryTotal: number;
    serviceTotal: number;
    total: number;
    paid: boolean;
    paidTime: string | null;
    receiptUrl: string | null;
    noorReceiptUrl: string | null;
    promoCode: DraftPromoCode | null;
    card: unknown | null;
}

export interface DraftOrder {
    createdBy: string;
    modifiedBy: string;
    creationDate: string;
    modifiedDate: string;
    id: number;
    customer: DraftCustomer;
    market: DraftMarket;
    items: DraftItem[];
    invoice: DraftInvoice;
    source: string;
    latitude: number;
    longitude: number;
    distance: number | null;
}

async function doFetch(token: string, page: number, size: number): Promise<{ list: DraftOrder[]; total: number }> {
    const response = await fetch(`${API_BASE_URL}/order/draft/list`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ page, size }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    return data.payload;
}

export async function fetchDraftOrders(
    token: string,
    page: number = 0,
    size: number = 50
): Promise<{ list: DraftOrder[]; total: number }> {
    return doFetch(token, page, size);
}

export async function fetchAllDraftOrders(token: string): Promise<DraftOrder[]> {
    const first = await doFetch(token, 0, 50);
    if (first.total <= 50) return first.list;

    const rest = await doFetch(token, 0, first.total);
    return rest.list;
}
