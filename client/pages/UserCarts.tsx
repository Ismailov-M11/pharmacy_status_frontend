import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserCartModal } from "@/components/UserCartModal";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Tag,
    Search,
    SlidersHorizontal,
    X,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchAllDraftOrders, DraftOrder } from "@/lib/draftOrderApi";

const PAGE_SIZE = 50;

function formatSum(n: number): string {
    return Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function customerName(order: DraftOrder): string {
    const { firstName, lastName, phone } = order.customer;
    if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");
    return phone;
}

interface Filters {
    dateFrom: string;
    dateTo: string;
    pharmacies: string[];
    itemsMin: string;
    itemsMax: string;
    totalMin: string;
    totalMax: string;
    promoCode: string;
    sources: string[];
}

const EMPTY_FILTERS: Filters = {
    dateFrom: "",
    dateTo: "",
    pharmacies: [],
    itemsMin: "",
    itemsMax: "",
    totalMin: "",
    totalMax: "",
    promoCode: "",
    sources: [],
};

function activeFilterCount(f: Filters): number {
    let n = 0;
    if (f.dateFrom || f.dateTo) n++;
    if (f.pharmacies.length) n++;
    if (f.itemsMin || f.itemsMax) n++;
    if (f.totalMin || f.totalMax) n++;
    if (f.promoCode) n++;
    if (f.sources.length) n++;
    return n;
}

// ─── Mini checkbox list ────────────────────────────────────────────────────────
function CheckList({
    options,
    selected,
    onChange,
    searchable,
}: {
    options: string[];
    selected: string[];
    onChange: (v: string[]) => void;
    searchable?: boolean;
}) {
    const [q, setQ] = useState("");
    const visible = searchable ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options;
    const toggle = (val: string) =>
        onChange(selected.includes(val) ? selected.filter((x) => x !== val) : [...selected, val]);
    return (
        <div>
            {searchable && (
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Поиск..."
                    className="w-full mb-2 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400"
                />
            )}
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {visible.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1 py-0.5">
                        <input
                            type="checkbox"
                            checked={selected.includes(opt)}
                            onChange={() => toggle(opt)}
                            className="accent-purple-600"
                        />
                        <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{opt}</span>
                    </label>
                ))}
                {visible.length === 0 && <p className="text-xs text-gray-400 px-1">Нет вариантов</p>}
            </div>
            {selected.length > 0 && (
                <button onClick={() => onChange([])} className="mt-1 text-xs text-purple-600 dark:text-purple-400 hover:underline">
                    Сбросить ({selected.length})
                </button>
            )}
        </div>
    );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{title}</p>
            {children}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UserCarts() {
    const { isAuthenticated, isLoading: authLoading, token } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [allOrders, setAllOrders] = useState<DraftOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [pendingFilters, setPendingFilters] = useState<Filters>(EMPTY_FILTERS);
    const [filterOpen, setFilterOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<DraftOrder | null>(null);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) navigate("/login");
    }, [authLoading, isAuthenticated, navigate]);

    const load = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const list = await fetchAllDraftOrders(token);
            setAllOrders(list);
        } catch {
            toast.error(t.dataLoadError || "Ошибка при загрузке данных");
        } finally {
            setIsLoading(false);
        }
    }, [token, t]);

    useEffect(() => {
        if (!authLoading && isAuthenticated) load();
    }, [authLoading, isAuthenticated, load]);

    // Derived option lists
    const allPharmacies = useMemo(
        () => [...new Set(allOrders.map((o) => o.market.name))].sort(),
        [allOrders]
    );
    const allSources = useMemo(
        () => [...new Set(allOrders.map((o) => o.source))].sort(),
        [allOrders]
    );

    // Search + filter
    const filteredOrders = useMemo(() => {
        let result = allOrders;

        // Search
        if (query.trim()) {
            const q = query.toLowerCase();
            result = result.filter((o) =>
                String(o.id).includes(q) ||
                o.customer.phone.includes(q) ||
                customerName(o).toLowerCase().includes(q) ||
                o.market.name.toLowerCase().includes(q) ||
                o.market.address.toLowerCase().includes(q) ||
                o.items.some((i) => i.name.toLowerCase().includes(q)) ||
                (o.invoice.promoCode?.code ?? "").toLowerCase().includes(q)
            );
        }

        // Date from
        if (filters.dateFrom) {
            const from = new Date(filters.dateFrom);
            result = result.filter((o) => new Date(o.creationDate) >= from);
        }
        // Date to
        if (filters.dateTo) {
            const to = new Date(filters.dateTo);
            to.setHours(23, 59, 59, 999);
            result = result.filter((o) => new Date(o.creationDate) <= to);
        }
        // Pharmacies
        if (filters.pharmacies.length) {
            result = result.filter((o) => filters.pharmacies.includes(o.market.name));
        }
        // Items count
        if (filters.itemsMin) {
            result = result.filter((o) => o.items.length >= Number(filters.itemsMin));
        }
        if (filters.itemsMax) {
            result = result.filter((o) => o.items.length <= Number(filters.itemsMax));
        }
        // Total amount
        if (filters.totalMin) {
            result = result.filter((o) => o.invoice.total >= Number(filters.totalMin));
        }
        if (filters.totalMax) {
            result = result.filter((o) => o.invoice.total <= Number(filters.totalMax));
        }
        // Promo code
        if (filters.promoCode.trim()) {
            const pc = filters.promoCode.toLowerCase();
            result = result.filter((o) =>
                (o.invoice.promoCode?.code ?? "").toLowerCase().includes(pc)
            );
        }
        // Sources
        if (filters.sources.length) {
            result = result.filter((o) => filters.sources.includes(o.source));
        }

        return result;
    }, [allOrders, query, filters]);

    // Reset page when search/filter changes
    const prevQuery = useRef(query);
    useEffect(() => {
        if (query !== prevQuery.current) { setPage(0); prevQuery.current = query; }
    }, [query]);

    const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
    const pageOrders = filteredOrders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const applyFilters = () => {
        setFilters(pendingFilters);
        setPage(0);
        setFilterOpen(false);
    };

    const resetFilters = () => {
        setPendingFilters(EMPTY_FILTERS);
        setFilters(EMPTY_FILTERS);
        setPage(0);
    };

    const openFilter = () => {
        setPendingFilters(filters);
        setFilterOpen(true);
    };

    const activeCount = activeFilterCount(filters);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <span className="text-gray-500 dark:text-gray-400">{t.loading}</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Header />

            <main className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* Page header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t.userCarts}</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            {t.userCartsDescription}
                            {allOrders.length > 0 && (
                                <span className="ml-2 text-purple-600 dark:text-purple-400 font-medium">
                                    ({allOrders.length})
                                </span>
                            )}
                        </p>
                    </div>
                    <Button onClick={load} variant="outline" disabled={isLoading} className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        {t.update}
                    </Button>
                </div>

                {/* Search + Filter bar — full width */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={`${t.search}...`}
                            className="pl-9 pr-8"
                        />
                        {query && (
                            <button
                                onClick={() => { setQuery(""); setPage(0); }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {activeCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-gray-500 shrink-0">
                            <X className="h-3.5 w-3.5" />
                            {t.reset}
                        </Button>
                    )}

                    <Button
                        variant={activeCount > 0 ? "default" : "outline"}
                        onClick={openFilter}
                        className="gap-2 shrink-0"
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        {t.filter}
                        {activeCount > 0 && (
                            <span className="ml-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-white/30 text-xs font-bold">
                                {activeCount}
                            </span>
                        )}
                    </Button>
                </div>

                {/* Results count when filtered */}
                {(query || activeCount > 0) && !isLoading && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        {t.noResults !== undefined && filteredOrders.length === 0
                            ? t.noResults
                            : `${t.shown}: ${filteredOrders.length}`}
                    </p>
                )}

                <Card>
                    <CardContent className="pt-6">
                        {isLoading ? (
                            <div className="h-96 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        ) : filteredOrders.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t.noData}</p>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                                {["№", "ID", t.date, t.customer, t.phone, t.pharmacyName, t.address, t.itemsCount, t.marketTotal, t.deliveryFee, t.serviceFee, t.grandTotal, t.promoCode, t.sourceLabel].map((h, i) => (
                                                    <th
                                                        key={i}
                                                        className={`py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap ${i >= 8 ? "text-right" : i === 7 ? "text-center" : "text-left"}`}
                                                    >
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageOrders.map((order, idx) => {
                                                const rowNum = page * PAGE_SIZE + idx + 1;
                                                return (
                                                    <tr
                                                        key={order.id}
                                                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                                                    >
                                                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400">{rowNum}</td>
                                                        <td className="py-3 px-3">
                                                            <button
                                                                onClick={() => setSelectedOrder(order)}
                                                                className="font-medium text-purple-700 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 hover:underline whitespace-nowrap"
                                                            >
                                                                #{order.id}
                                                            </button>
                                                        </td>
                                                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                            {format(new Date(order.creationDate), "dd.MM.yyyy HH:mm")}
                                                        </td>
                                                        <td className="py-3 px-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                            {customerName(order)}
                                                        </td>
                                                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                            {order.customer.phone}
                                                        </td>
                                                        <td className="py-3 px-3 text-gray-900 dark:text-gray-100">
                                                            {order.market.name}
                                                        </td>
                                                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                                                            {order.market.address}
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                                                                {order.items.length}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                            {formatSum(order.invoice.marketTotal)} {t.sum}
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                            {formatSum(order.invoice.deliveryTotal)} {t.sum}
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-gray-500 whitespace-nowrap">
                                                            {formatSum(order.invoice.serviceTotal)} {t.sum}
                                                        </td>
                                                        <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                            {formatSum(order.invoice.total)} {t.sum}
                                                        </td>
                                                        <td className="py-3 px-3 whitespace-nowrap">
                                                            {order.invoice.promoCode ? (
                                                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400">
                                                                    <Tag className="h-2.5 w-2.5" />
                                                                    {order.invoice.promoCode.code}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300 dark:text-gray-600">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 whitespace-nowrap">
                                                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                                {order.source}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {t.shown}: {Math.min(page * PAGE_SIZE + 1, filteredOrders.length)}–{Math.min((page + 1) * PAGE_SIZE, filteredOrders.length)} {t.of} {filteredOrders.length}
                                    </span>

                                    {totalPages > 1 && (
                                        <div className="flex items-center gap-1">
                                            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="h-8 w-8 p-0">
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            {(() => {
                                                const pages: (number | "…")[] = [];
                                                if (totalPages <= 7) for (let i = 0; i < totalPages; i++) pages.push(i);
                                                else if (page < 4) pages.push(0, 1, 2, 3, 4, "…", totalPages - 1);
                                                else if (page >= totalPages - 4) pages.push(0, "…", totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1);
                                                else pages.push(0, "…", page - 1, page, page + 1, "…", totalPages - 1);
                                                return pages.map((p, i) =>
                                                    p === "…" ? (
                                                        <span key={`e-${i}`} className="px-1 text-gray-400 text-sm">…</span>
                                                    ) : (
                                                        <Button key={p} variant={p === page ? "default" : "ghost"} size="sm" className="h-8 w-8 p-0 text-xs" onClick={() => setPage(p as number)}>
                                                            {(p as number) + 1}
                                                        </Button>
                                                    )
                                                );
                                            })()}
                                            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="h-8 w-8 p-0">
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </main>

            {/* ─── Filter Dialog (centered) ─────────────────────────────────── */}
            <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <SlidersHorizontal className="h-4 w-4 text-purple-600" />
                            {t.filter}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-5">
                        <div className="grid grid-cols-2 gap-6">

                            {/* Date range */}
                            <div className="col-span-2">
                                <FilterSection title={t.period || "Период"}>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t.dateFrom || "От"}</label>
                                            <input
                                                type="date"
                                                value={pendingFilters.dateFrom}
                                                onChange={(e) => setPendingFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t.dateTo || "До"}</label>
                                            <input
                                                type="date"
                                                value={pendingFilters.dateTo}
                                                onChange={(e) => setPendingFilters((f) => ({ ...f, dateTo: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400"
                                            />
                                        </div>
                                    </div>
                                </FilterSection>
                            </div>

                            {/* Pharmacies */}
                            <div>
                                <FilterSection title={t.pharmacyName || "Аптека"}>
                                    <CheckList
                                        options={allPharmacies}
                                        selected={pendingFilters.pharmacies}
                                        onChange={(v) => setPendingFilters((f) => ({ ...f, pharmacies: v }))}
                                        searchable
                                    />
                                </FilterSection>
                            </div>

                            {/* Right column: items count + total + promo + source */}
                            <div className="space-y-5">
                                <FilterSection title={t.itemsCount || "Кол-во товаров"}>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="от"
                                            value={pendingFilters.itemsMin}
                                            onChange={(e) => setPendingFilters((f) => ({ ...f, itemsMin: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400"
                                        />
                                        <span className="text-gray-400 shrink-0">—</span>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="до"
                                            value={pendingFilters.itemsMax}
                                            onChange={(e) => setPendingFilters((f) => ({ ...f, itemsMax: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400"
                                        />
                                    </div>
                                </FilterSection>

                                <FilterSection title={t.grandTotal || "Сумма итого"}>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="от"
                                            value={pendingFilters.totalMin}
                                            onChange={(e) => setPendingFilters((f) => ({ ...f, totalMin: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400"
                                        />
                                        <span className="text-gray-400 shrink-0">—</span>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="до"
                                            value={pendingFilters.totalMax}
                                            onChange={(e) => setPendingFilters((f) => ({ ...f, totalMax: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400"
                                        />
                                    </div>
                                </FilterSection>

                                <FilterSection title={t.promoCode || "Промокод"}>
                                    <input
                                        type="text"
                                        placeholder="WELCOME_THREE..."
                                        value={pendingFilters.promoCode}
                                        onChange={(e) => setPendingFilters((f) => ({ ...f, promoCode: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400"
                                    />
                                </FilterSection>

                                <FilterSection title={t.sourceLabel || "Источник"}>
                                    <CheckList
                                        options={allSources}
                                        selected={pendingFilters.sources}
                                        onChange={(v) => setPendingFilters((f) => ({ ...f, sources: v }))}
                                    />
                                </FilterSection>
                            </div>

                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 shrink-0">
                        <Button onClick={applyFilters} className="flex-1">
                            {t.apply}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => { setPendingFilters(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(0); setFilterOpen(false); }}
                            className="flex-1"
                        >
                            {t.reset}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Cart detail modal */}
            <UserCartModal
                order={selectedOrder}
                isOpen={selectedOrder !== null}
                onClose={() => setSelectedOrder(null)}
            />
        </div>
    );
}
