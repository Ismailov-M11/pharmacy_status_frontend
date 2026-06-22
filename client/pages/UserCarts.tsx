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
    CheckCircle,
    Clock,
    MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
    getUserCarts,
    getCartSyncStatus,
    triggerCartSync,
    updateCartComment,
    UserCart,
    CartSyncStatus,
} from "@/lib/userCartApi";

const PAGE_SIZE = 50;

function formatSum(n: number): string {
    return Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function customerName(cart: UserCart): string {
    const { customer_first_name: fn, customer_last_name: ln, customer_phone: ph } = cart;
    if (fn || ln) return [fn, ln].filter(Boolean).join(" ");
    return ph ?? "";
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
    status: string;
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
    status: "all",
};

function activeFilterCount(f: Filters): number {
    let n = 0;
    if (f.dateFrom || f.dateTo) n++;
    if (f.pharmacies.length) n++;
    if (f.itemsMin || f.itemsMax) n++;
    if (f.totalMin || f.totalMax) n++;
    if (f.promoCode) n++;
    if (f.sources.length) n++;
    if (f.status && f.status !== "all") n++;
    return n;
}

// ─── Mini checkbox list ────────────────────────────────────────────────────────
function CheckList({ options, selected, onChange, searchable }: {
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

function StatusBadge({ status, t }: { status: "unprocessed" | "processed"; t: Record<string, string> }) {
    if (status === "processed") {
        return (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 whitespace-nowrap">
                <CheckCircle className="h-3 w-3" />
                {t.processed}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 whitespace-nowrap">
            <Clock className="h-3 w-3" />
            {t.unprocessed}
        </span>
    );
}

// ─── Sync status bar ──────────────────────────────────────────────────────────
function SyncBar({ syncStatus, onSync, isTriggeringSync, t }: {
    syncStatus: CartSyncStatus | null;
    onSync: () => void;
    isTriggeringSync: boolean;
    t: Record<string, string>;
}) {
    const isSyncing = syncStatus?.isSyncing || isTriggeringSync;
    const progress = syncStatus?.progress;
    const lastSync = syncStatus?.lastSyncAt || syncStatus?.stats?.lastSyncedAt;

    return (
        <div className="flex items-center gap-3 px-4 py-2.5 mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
            <div className="flex-1 min-w-0">
                {isSyncing ? (
                    <div className="flex items-center gap-2">
                        <RefreshCw className="h-3.5 w-3.5 text-purple-500 animate-spin shrink-0" />
                        <span className="text-purple-600 dark:text-purple-400">
                            {t.syncInProgress}
                            {progress && progress.total > 0 && ` ${progress.current}/${progress.total} (${progress.percent}%)`}
                        </span>
                    </div>
                ) : lastSync ? (
                    <span className="text-gray-500 dark:text-gray-400">
                        {t.lastSyncedAt}: {format(new Date(lastSync), "dd.MM.yyyy HH:mm")}
                    </span>
                ) : (
                    <span className="text-gray-400 dark:text-gray-500">{t.noSyncYet}</span>
                )}
                {syncStatus?.lastSyncError && (
                    <span className="ml-2 text-red-500 dark:text-red-400 text-xs">⚠ {syncStatus.lastSyncError}</span>
                )}
            </div>
            {syncStatus?.stats && (
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                    <span>{t.total || "Всего"}: <b className="text-gray-700 dark:text-gray-300">{syncStatus.stats.total}</b></span>
                    <span className="text-yellow-600 dark:text-yellow-400">{syncStatus.stats.unprocessed} {t.unprocessed}</span>
                    <span className="text-green-600 dark:text-green-400">{syncStatus.stats.processed} {t.processed}</span>
                </div>
            )}
            <Button
                variant="outline"
                size="sm"
                onClick={onSync}
                disabled={isSyncing}
                className="gap-1.5 shrink-0 text-xs"
            >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                {t.syncNow}
            </Button>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UserCarts() {
    const { isAuthenticated, isLoading: authLoading, token, user } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [allCarts, setAllCarts] = useState<UserCart[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTriggeringSync, setIsTriggeringSync] = useState(false);
    const [syncStatus, setSyncStatus] = useState<CartSyncStatus | null>(null);
    const [page, setPage] = useState(0);
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [pendingFilters, setPendingFilters] = useState<Filters>(EMPTY_FILTERS);
    const [filterOpen, setFilterOpen] = useState(false);
    const [selectedCart, setSelectedCart] = useState<UserCart | null>(null);
    const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) navigate("/login");
    }, [authLoading, isAuthenticated, navigate]);

    const loadSyncStatus = useCallback(async () => {
        if (!token) return;
        try {
            const s = await getCartSyncStatus(token);
            setSyncStatus(s);
        } catch {
            // non-critical
        }
    }, [token]);

    const loadCarts = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await getUserCarts(token);
            setAllCarts(res.data);
        } catch {
            toast.error(t.dataLoadError || "Ошибка при загрузке данных");
        } finally {
            setIsLoading(false);
        }
    }, [token, t]);

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            loadCarts();
            loadSyncStatus();
        }
    }, [authLoading, isAuthenticated, loadCarts, loadSyncStatus]);

    // Poll sync status while syncing
    useEffect(() => {
        if (syncStatus?.isSyncing) {
            syncPollRef.current = setInterval(() => {
                loadSyncStatus();
            }, 2000);
        } else {
            if (syncPollRef.current) {
                clearInterval(syncPollRef.current);
                syncPollRef.current = null;
            }
        }
        return () => {
            if (syncPollRef.current) clearInterval(syncPollRef.current);
        };
    }, [syncStatus?.isSyncing, loadSyncStatus]);

    // Reload carts after sync finishes
    const wasSyncing = useRef(false);
    useEffect(() => {
        if (wasSyncing.current && syncStatus && !syncStatus.isSyncing) {
            loadCarts();
        }
        wasSyncing.current = syncStatus?.isSyncing ?? false;
    }, [syncStatus?.isSyncing, loadCarts]);

    const handleSync = async () => {
        if (!token) return;
        setIsTriggeringSync(true);
        try {
            await triggerCartSync(token);
            await loadSyncStatus();
            toast.success(t.syncInProgress || "Синхронизация запущена");
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Ошибка синхронизации");
        } finally {
            setIsTriggeringSync(false);
        }
    };

    const handleCommentSaved = (updated: UserCart) => {
        setAllCarts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        if (selectedCart?.id === updated.id) setSelectedCart(updated);
        loadSyncStatus();
    };

    const handleUpdateComment = async (cartId: number, comment: string): Promise<UserCart> => {
        if (!token) throw new Error("No token");
        const updated = await updateCartComment(token, cartId, comment, user?.username ?? "");
        handleCommentSaved(updated);
        return updated;
    };

    // Derived option lists from loaded data
    const allPharmacies = useMemo(
        () => [...new Set(allCarts.map((c) => c.market_name).filter(Boolean) as string[])].sort(),
        [allCarts]
    );
    const allSources = useMemo(
        () => [...new Set(allCarts.map((c) => c.source).filter(Boolean) as string[])].sort(),
        [allCarts]
    );

    // Client-side search + filter
    const filteredCarts = useMemo(() => {
        let result = allCarts;

        if (query.trim()) {
            const q = query.toLowerCase();
            result = result.filter((c) =>
                String(c.id).includes(q) ||
                (c.customer_phone ?? "").includes(q) ||
                customerName(c).toLowerCase().includes(q) ||
                (c.market_name ?? "").toLowerCase().includes(q) ||
                (c.market_address ?? "").toLowerCase().includes(q) ||
                (c.items as Array<{ name: string }>).some((i) => i.name.toLowerCase().includes(q)) ||
                (c.invoice_promo_code ?? "").toLowerCase().includes(q) ||
                (c.comment ?? "").toLowerCase().includes(q)
            );
        }

        if (filters.status && filters.status !== "all") {
            result = result.filter((c) => c.cart_status === filters.status);
        }
        if (filters.dateFrom) {
            const from = new Date(filters.dateFrom);
            result = result.filter((c) => new Date(c.creation_date) >= from);
        }
        if (filters.dateTo) {
            const to = new Date(filters.dateTo);
            to.setHours(23, 59, 59, 999);
            result = result.filter((c) => new Date(c.creation_date) <= to);
        }
        if (filters.pharmacies.length) {
            result = result.filter((c) => filters.pharmacies.includes(c.market_name ?? ""));
        }
        if (filters.itemsMin) {
            result = result.filter((c) => c.items.length >= Number(filters.itemsMin));
        }
        if (filters.itemsMax) {
            result = result.filter((c) => c.items.length <= Number(filters.itemsMax));
        }
        if (filters.totalMin) {
            result = result.filter((c) => c.invoice_total >= Number(filters.totalMin));
        }
        if (filters.totalMax) {
            result = result.filter((c) => c.invoice_total <= Number(filters.totalMax));
        }
        if (filters.promoCode.trim()) {
            const pc = filters.promoCode.toLowerCase();
            result = result.filter((c) => (c.invoice_promo_code ?? "").toLowerCase().includes(pc));
        }
        if (filters.sources.length) {
            result = result.filter((c) => filters.sources.includes(c.source ?? ""));
        }

        return result;
    }, [allCarts, query, filters]);

    const prevQuery = useRef(query);
    useEffect(() => {
        if (query !== prevQuery.current) { setPage(0); prevQuery.current = query; }
    }, [query]);

    const totalPages = Math.ceil(filteredCarts.length / PAGE_SIZE);
    const pageCarts = filteredCarts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const applyFilters = () => { setFilters(pendingFilters); setPage(0); setFilterOpen(false); };
    const resetFilters = () => { setPendingFilters(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(0); };
    const openFilter = () => { setPendingFilters(filters); setFilterOpen(true); };

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
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t.userCarts}</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            {t.userCartsDescription}
                            {allCarts.length > 0 && (
                                <span className="ml-2 text-purple-600 dark:text-purple-400 font-medium">
                                    ({allCarts.length})
                                </span>
                            )}
                        </p>
                    </div>
                    <Button onClick={loadCarts} variant="outline" disabled={isLoading} className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        {t.update}
                    </Button>
                </div>

                {/* Sync status bar */}
                <SyncBar
                    syncStatus={syncStatus}
                    onSync={handleSync}
                    isTriggeringSync={isTriggeringSync}
                    t={t as unknown as Record<string, string>}
                />

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

                {(query || activeCount > 0) && !isLoading && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        {filteredCarts.length === 0
                            ? (t.noResults ?? "Ничего не найдено")
                            : `${t.shown}: ${filteredCarts.length}`}
                    </p>
                )}

                <Card>
                    <CardContent className="pt-6">
                        {isLoading ? (
                            <div className="h-96 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        ) : filteredCarts.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t.noData}</p>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                                {[
                                                    { label: "№", align: "left" },
                                                    { label: "ID", align: "left" },
                                                    { label: t.date, align: "left" },
                                                    { label: t.customer, align: "left" },
                                                    { label: t.phone, align: "left" },
                                                    { label: t.pharmacyName, align: "left" },
                                                    { label: t.address, align: "left" },
                                                    { label: t.itemsCount, align: "center" },
                                                    { label: t.grandTotal, align: "right" },
                                                    { label: t.promoCode, align: "left" },
                                                    { label: t.sourceLabel, align: "left" },
                                                    { label: t.cartStatus, align: "left" },
                                                    { label: t.comment, align: "left" },
                                                ].map((h, i) => (
                                                    <th
                                                        key={i}
                                                        className={`py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-${h.align}`}
                                                    >
                                                        {h.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageCarts.map((cart, idx) => {
                                                const rowNum = page * PAGE_SIZE + idx + 1;
                                                return (
                                                    <tr
                                                        key={cart.id}
                                                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                                                    >
                                                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400">{rowNum}</td>
                                                        <td className="py-3 px-3">
                                                            <button
                                                                onClick={() => setSelectedCart(cart)}
                                                                className="font-medium text-purple-700 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 hover:underline whitespace-nowrap"
                                                            >
                                                                #{cart.id}
                                                            </button>
                                                        </td>
                                                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                            {format(new Date(cart.creation_date), "dd.MM.yyyy HH:mm")}
                                                        </td>
                                                        <td className="py-3 px-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                            {customerName(cart)}
                                                        </td>
                                                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                            {cart.customer_phone}
                                                        </td>
                                                        <td className="py-3 px-3 text-gray-900 dark:text-gray-100">
                                                            {cart.market_name}
                                                        </td>
                                                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400 max-w-[180px] truncate">
                                                            {cart.market_address}
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                                                                {cart.items.length}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                            {formatSum(cart.invoice_total)} {t.sum}
                                                        </td>
                                                        <td className="py-3 px-3 whitespace-nowrap">
                                                            {cart.invoice_promo_code ? (
                                                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400">
                                                                    <Tag className="h-2.5 w-2.5" />
                                                                    {cart.invoice_promo_code}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300 dark:text-gray-600">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 whitespace-nowrap">
                                                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                                {cart.source}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            <StatusBadge status={cart.cart_status} t={t as unknown as Record<string, string>} />
                                                        </td>
                                                        <td className="py-3 px-3 max-w-[180px]">
                                                            {cart.comment ? (
                                                                <span className="flex items-start gap-1 text-xs text-gray-600 dark:text-gray-400">
                                                                    <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 text-gray-400" />
                                                                    <span className="truncate">{cart.comment}</span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                                                            )}
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
                                        {t.shown}: {Math.min(page * PAGE_SIZE + 1, filteredCarts.length)}–{Math.min((page + 1) * PAGE_SIZE, filteredCarts.length)} {t.of} {filteredCarts.length}
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

                            {/* Date range + status */}
                            <div className="col-span-2 grid grid-cols-3 gap-4">
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
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t.cartStatus}</label>
                                    <select
                                        value={pendingFilters.status}
                                        onChange={(e) => setPendingFilters((f) => ({ ...f, status: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400"
                                    >
                                        <option value="all">{t.allStatuses}</option>
                                        <option value="unprocessed">{t.unprocessed}</option>
                                        <option value="processed">{t.processed}</option>
                                    </select>
                                </div>
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

                            {/* Right column */}
                            <div className="space-y-5">
                                <FilterSection title={t.itemsCount || "Кол-во товаров"}>
                                    <div className="flex items-center gap-2">
                                        <input type="number" min="0" placeholder="от" value={pendingFilters.itemsMin}
                                            onChange={(e) => setPendingFilters((f) => ({ ...f, itemsMin: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400" />
                                        <span className="text-gray-400 shrink-0">—</span>
                                        <input type="number" min="0" placeholder="до" value={pendingFilters.itemsMax}
                                            onChange={(e) => setPendingFilters((f) => ({ ...f, itemsMax: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400" />
                                    </div>
                                </FilterSection>

                                <FilterSection title={t.grandTotal || "Сумма итого"}>
                                    <div className="flex items-center gap-2">
                                        <input type="number" min="0" placeholder="от" value={pendingFilters.totalMin}
                                            onChange={(e) => setPendingFilters((f) => ({ ...f, totalMin: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400" />
                                        <span className="text-gray-400 shrink-0">—</span>
                                        <input type="number" min="0" placeholder="до" value={pendingFilters.totalMax}
                                            onChange={(e) => setPendingFilters((f) => ({ ...f, totalMax: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400" />
                                    </div>
                                </FilterSection>

                                <FilterSection title={t.promoCode || "Промокод"}>
                                    <input type="text" placeholder="WELCOME_THREE..." value={pendingFilters.promoCode}
                                        onChange={(e) => setPendingFilters((f) => ({ ...f, promoCode: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400" />
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
                        <Button onClick={applyFilters} className="flex-1">{t.apply}</Button>
                        <Button variant="outline" onClick={() => { setPendingFilters(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(0); setFilterOpen(false); }} className="flex-1">
                            {t.reset}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Cart detail modal */}
            <UserCartModal
                cart={selectedCart}
                isOpen={selectedCart !== null}
                onClose={() => setSelectedCart(null)}
                onUpdateComment={handleUpdateComment}
                t={t as unknown as Record<string, string>}
            />
        </div>
    );
}
