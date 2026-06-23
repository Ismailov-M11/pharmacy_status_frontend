import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Tag,
    Search,
    SlidersHorizontal,
    X,
    MessageSquare,
    User,
    AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
    getUserCarts,
    getCartSyncStatus,
    triggerCartSync,
    getCartStatuses,
    triggerOrderSync,
    getOrderSyncStatus,
    claimCustomer,
    releaseCustomer,
    UserCart,
    CartStatus,
    CartSyncStatus,
} from "@/lib/userCartApi";
import { statusBadgeClasses } from "@/components/UserCartModal";

const PAGE_SIZE = 50;

function formatSum(n: number): string {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function customerName(cart: UserCart): string {
    const fn = cart.customer_first_name;
    const ln = cart.customer_last_name;
    if (fn || ln) return [fn, ln].filter(Boolean).join(" ");
    return cart.customer_phone ?? "";
}

// ─── Phase labels ──────────────────────────────────────────────────────────────
function getPhaseLabel(phase: string): string {
    switch (phase) {
        case "collecting": return "Сбор данных из API...";
        case "syncing":    return "Загрузка страниц...";
        case "saving":     return "Сохранение в базу...";
        case "orders":     return "Проверка статусов заказов...";
        case "done":       return "Завершено";
        case "error":      return "Ошибка синхронизации";
        default:           return "Подготовка...";
    }
}

// ─── Progress bar (like OsonList) ─────────────────────────────────────────────
function SyncProgressBar({ progress }: { progress: { current: number; total: number; percent: number; phase: string } }) {
    const { current, total, percent, phase } = progress;
    return (
        <div className="w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2.5 mb-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    {getPhaseLabel(phase)}
                </span>
                <span className="font-bold text-amber-800 dark:text-amber-300">
                    {total > 0
                        ? <>{current.toLocaleString()} / {total.toLocaleString()} ({percent}%)</>
                        : "Загрузка..."}
                </span>
            </div>
            <div className="w-full bg-amber-200 dark:bg-amber-800/50 rounded-full h-2 overflow-hidden">
                <div
                    className="h-2 rounded-full bg-amber-500 dark:bg-amber-400 transition-all duration-500"
                    style={{ width: `${Math.max(percent, total > 0 ? 2 : 0)}%` }}
                />
            </div>
        </div>
    );
}

// ─── Order status badge ────────────────────────────────────────────────────────
const ORDER_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
    pending:     { label: "Ожидает",      cls: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
    in_progress: { label: "Доставляется", cls: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" },
    delivered:   { label: "Доставлен",    cls: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" },
    cancelled:   { label: "Отменён",      cls: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300" },
    deleted:     { label: "Удалён",       cls: "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 line-through" },
};

function OrderStatusBadge({ status }: { status: string }) {
    if (status === "pending") return <span className="text-gray-300 dark:text-gray-600">—</span>;
    const cfg = ORDER_STATUS_CONFIG[status] ?? ORDER_STATUS_CONFIG.pending;
    return (
        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
}

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, statuses }: { status: string; statuses: CartStatus[] }) {
    const found = statuses.find((s) => s.value === status);
    const label = found?.label ?? status;
    const cls = statusBadgeClasses(found?.color ?? "gray");
    return (
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
            {label}
        </span>
    );
}

// ─── Filters ──────────────────────────────────────────────────────────────────
interface Filters {
    dateFrom: string;
    dateTo: string;
    pharmacies: string[];
    itemsMin: string;
    itemsMax: string;
    totalMin: string;
    totalMax: string;
    promoCodes: string[];
    sources: string[];
    status: string;
    commentUsers: string[];
    historyStatuses: string[];
    historyDateFrom: string;
    historyDateTo: string;
    orderStatus: string;
}

const EMPTY_FILTERS: Filters = {
    dateFrom: "", dateTo: "", pharmacies: [],
    itemsMin: "", itemsMax: "", totalMin: "", totalMax: "",
    promoCodes: [], sources: [], status: "all", commentUsers: [],
    historyStatuses: [], historyDateFrom: "", historyDateTo: "",
    orderStatus: "",
};

function activeFilterCount(f: Filters): number {
    let n = 0;
    if (f.dateFrom || f.dateTo) n++;
    if (f.pharmacies.length) n++;
    if (f.itemsMin || f.itemsMax) n++;
    if (f.totalMin || f.totalMax) n++;
    if (f.promoCodes.length) n++;
    if (f.sources.length) n++;
    if (f.status && f.status !== "all") n++;
    if (f.commentUsers.length) n++;
    if (f.historyStatuses.length) n++;
    if (f.orderStatus) n++;
    return n;
}

function CheckList({ options, selected, onChange, searchable, grow }: {
    options: string[];
    selected: string[];
    onChange: (v: string[]) => void;
    searchable?: boolean;
    grow?: boolean;
}) {
    const [q, setQ] = useState("");
    const visible = searchable ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options;
    const toggle = (val: string) =>
        onChange(selected.includes(val) ? selected.filter((x) => x !== val) : [...selected, val]);
    return (
        <div className={grow ? "flex flex-col flex-1 min-h-0" : ""}>
            {searchable && (
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск..."
                    className="w-full mb-2 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400" />
            )}
            <div className={grow ? "flex-1 min-h-0 overflow-y-auto space-y-1 pr-1" : "max-h-48 overflow-y-auto space-y-1 pr-1"}>
                {visible.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1 py-0.5">
                        <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="accent-purple-600" />
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

function FilterSection({ title, children, grow }: { title: string; children: React.ReactNode; grow?: boolean }) {
    return (
        <div className={grow ? "flex flex-col flex-1 min-h-0" : ""}>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{title}</p>
            {children}
        </div>
    );
}

interface CustomerGroup {
  key: string;
  customerId: number | null;
  customerPhone: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  carts: UserCart[];
  totalSum: number;
  claimedBy: string | null;
  claimedAt: string | null;
}

function groupCarts(carts: UserCart[]): CustomerGroup[] {
  const map = new Map<string, CustomerGroup>();
  for (const cart of carts) {
    const key = cart.customer_id != null
      ? `id:${cart.customer_id}`
      : `phone:${cart.customer_phone ?? "unknown"}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        customerId: cart.customer_id,
        customerPhone: cart.customer_phone,
        customerFirstName: cart.customer_first_name,
        customerLastName: cart.customer_last_name,
        carts: [],
        totalSum: 0,
        claimedBy: cart.claimed_by ?? null,
        claimedAt: cart.claimed_at ?? null,
      });
    }
    const group = map.get(key)!;
    group.carts.push(cart);
    group.totalSum += cart.invoice_total ?? 0;
  }
  return Array.from(map.values());
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UserCarts() {
    const { isAuthenticated, isLoading: authLoading, token, user } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [allCarts, setAllCarts] = useState<UserCart[]>([]);
    const [cartStatuses, setCartStatuses] = useState<CartStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [syncStatus, setSyncStatus] = useState<CartSyncStatus | null>(null);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, percent: 0, phase: "" });
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [page, setPage] = useState(0);
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [pendingFilters, setPendingFilters] = useState<Filters>(EMPTY_FILTERS);
    const [filterOpen, setFilterOpen] = useState(false);
    const [selectedCart, setSelectedCart] = useState<UserCart | null>(null);
    const [selectedCartTab, setSelectedCartTab] = useState<"cart" | "map" | "comments">("cart");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [claimWarning, setClaimWarning] = useState<string | null>(null);
    const [pendingCartOpen, setPendingCartOpen] = useState<{ cart: UserCart; tab: "cart" | "map" | "comments" } | null>(null);
    const expandedGroupPhoneRef = useRef<string | null>(null);
    // Always reflects latest expandedGroups — avoids stale closure in event handlers
    const expandedGroupsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) navigate("/login");
    }, [authLoading, isAuthenticated, navigate]);

    const loadCarts = useCallback(async (historyFilters?: { historyStatuses?: string[]; historyDateFrom?: string; historyDateTo?: string }) => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await getUserCarts(token, historyFilters ?? {});
            setAllCarts(res.data);
        } catch {
            toast.error(t.dataLoadError || "Ошибка при загрузке данных");
        } finally {
            setIsLoading(false);
        }
    }, [token, t]);

    const loadSyncStatus = useCallback(async () => {
        if (!token) return;
        try {
            const s = await getCartSyncStatus(token);
            setSyncStatus(s);
            if (s.progress) setSyncProgress(s.progress);
        } catch {
            // non-critical
        }
    }, [token]);

    useEffect(() => {
        if (!authLoading && isAuthenticated && token) {
            loadCarts();
            loadSyncStatus();
            getCartStatuses(token).then(setCartStatuses).catch(() => {});
        }
    }, [authLoading, isAuthenticated, loadCarts, loadSyncStatus, token]);

    // ─── Sync polling: phase 1 drafts → phase 2 orders ────────────────────────
    useEffect(() => {
        if (isSyncing) {
            pollingRef.current = setInterval(async () => {
                if (!token) return;
                try {
                    const s = await getCartSyncStatus(token);
                    setSyncStatus(s);
                    if (s.progress) setSyncProgress(s.progress);
                    if (!s.isSyncing) {
                        clearInterval(pollingRef.current!);

                        // Phase 2: order status sync — start with 0/0, real progress via polling
                        setSyncProgress({ current: 0, total: 0, percent: 0, phase: "orders" });

                        // Poll /order-sync-status every 600ms to get real per-phone progress
                        const orderProgressInterval = setInterval(async () => {
                            try {
                                const orderState = await getOrderSyncStatus(token);
                                const { current, total } = orderState.syncProgress ?? { current: 0, total: 0 };
                                if (total > 0) {
                                    const pct = Math.round((current / total) * 100);
                                    setSyncProgress({ current, total, percent: pct, phase: "orders" });
                                }
                            } catch { /* ignore */ }
                        }, 600);

                        let orderResult = null;
                        try {
                            orderResult = await triggerOrderSync(token);
                        } catch {
                            // order sync failure is non-critical
                        } finally {
                            clearInterval(orderProgressInterval);
                        }

                        // Reload once after both phases complete
                        await loadCarts();
                        loadSyncStatus();

                        setIsSyncing(false);
                        setSyncProgress({ current: 0, total: 0, percent: 0, phase: "" });

                        if (orderResult) {
                            toast.success(
                                `Синхронизация завершена. Проверено заказов: ${orderResult.checked}` +
                                (orderResult.delivered > 0 ? `, доставлено: ${orderResult.delivered}` : "") +
                                (orderResult.cancelled > 0 ? `, отменено: ${orderResult.cancelled}` : "")
                            );
                        } else {
                            toast.success("Данные корзин успешно обновлены!");
                        }
                    }
                } catch {
                    // ignore polling errors
                }
            }, 3000);
        }
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [isSyncing, token, loadCarts, loadSyncStatus]);

    // ─── Trigger sync ──────────────────────────────────────────────────────────
    const handleSync = async () => {
        if (!token) return;
        setIsConfirmOpen(false);
        setSyncProgress({ current: 0, total: 0, percent: 0, phase: "collecting" });
        try {
            await triggerCartSync(token);
            setIsSyncing(true);
            setSyncStatus((prev) => prev ? { ...prev, isSyncing: true } : null);
            toast.info("Синхронизация запущена. Подождите несколько минут...");
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Не удалось запустить синхронизацию");
        }
    };

    const openCart = (cart: UserCart, tab: "cart" | "map" | "comments" = "cart") => {
        setSelectedCart(cart);
        setSelectedCartTab(tab);
    };

    const closeCart = () => {
        setSelectedCart(null);
        // Silent reload — no isLoading toggle to preserve scroll position
        if (token) {
            const historyFilters = filters.historyStatuses.length || filters.historyDateFrom || filters.historyDateTo
                ? { historyStatuses: filters.historyStatuses, historyDateFrom: filters.historyDateFrom, historyDateTo: filters.historyDateTo }
                : {};
            getUserCarts(token, historyFilters).then((res) => setAllCarts(res.data)).catch(() => {});
            loadSyncStatus();
        }
    };

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    // expandedGroupsRef always reflects the latest state — no stale closure
    expandedGroupsRef.current = expandedGroups;

    const claimAndExpand = (group: CustomerGroup) => {
        const isCurrentlyExpanded = expandedGroupsRef.current.has(group.key);

        if (isCurrentlyExpanded) {
            if (group.customerPhone && token && user) {
                releaseCustomer(token, group.customerPhone, user.username).catch(() => {});
            }
            expandedGroupPhoneRef.current = null;
            setExpandedGroups(new Set());
        } else {
            if (expandedGroupPhoneRef.current && expandedGroupPhoneRef.current !== group.customerPhone && token && user) {
                releaseCustomer(token, expandedGroupPhoneRef.current, user.username).catch(() => {});
            }
            setExpandedGroups(new Set([group.key]));
            if (group.customerPhone && token && user) {
                expandedGroupPhoneRef.current = group.customerPhone;
                claimCustomer(token, group.customerPhone, user.username)
                    .then(({ previousClaimer }) => { if (previousClaimer) setClaimWarning(previousClaimer); })
                    .catch(() => {});
            }
        }
    };

    const claimAndOpenCart = (cart: UserCart, tab: "cart" | "map" | "comments") => {
        if (!cart.customer_phone || !token || !user) {
            openCart(cart, tab);
            return;
        }
        claimCustomer(token, cart.customer_phone, user.username)
            .then(({ previousClaimer }) => {
                if (previousClaimer) {
                    // Show warning BEFORE opening modal
                    setClaimWarning(previousClaimer);
                    setPendingCartOpen({ cart, tab });
                } else {
                    openCart(cart, tab);
                }
            })
            .catch(() => openCart(cart, tab));
    };

    // ─── Derived filter options ────────────────────────────────────────────────
    const allPharmacies = useMemo(
        () => [...new Set(allCarts.map((c) => c.market_name).filter(Boolean) as string[])].sort(),
        [allCarts]
    );
    const allSources = useMemo(
        () => [...new Set(allCarts.map((c) => c.source).filter(Boolean) as string[])].sort(),
        [allCarts]
    );
    const allPromoCodes = useMemo(() => {
        const codes = [...new Set(allCarts.map((c) => c.invoice_promo_code).filter(Boolean) as string[])].sort();
        const hasNone = allCarts.some((c) => !c.invoice_promo_code);
        return hasNone ? ["Без промокода", ...codes] : codes;
    }, [allCarts]);
    const allCommentUsers = useMemo(
        () => [...new Set(allCarts.map((c) => c.comment_by).filter(Boolean) as string[])].sort(),
        [allCarts]
    );

    // ─── Client-side filtering ─────────────────────────────────────────────────
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
        if (filters.status && filters.status !== "all") result = result.filter((c) => c.cart_status === filters.status);
        if (filters.dateFrom) { const from = new Date(filters.dateFrom); result = result.filter((c) => new Date(c.creation_date) >= from); }
        if (filters.dateTo) { const to = new Date(filters.dateTo); to.setHours(23,59,59,999); result = result.filter((c) => new Date(c.creation_date) <= to); }
        if (filters.pharmacies.length) result = result.filter((c) => filters.pharmacies.includes(c.market_name ?? ""));
        if (filters.itemsMin) result = result.filter((c) => c.items.length >= Number(filters.itemsMin));
        if (filters.itemsMax) result = result.filter((c) => c.items.length <= Number(filters.itemsMax));
        if (filters.totalMin) result = result.filter((c) => c.invoice_total >= Number(filters.totalMin));
        if (filters.totalMax) result = result.filter((c) => c.invoice_total <= Number(filters.totalMax));
        if (filters.promoCodes.length) {
            result = result.filter((c) => {
                const noPromo = !c.invoice_promo_code;
                if (noPromo) return filters.promoCodes.includes("Без промокода");
                return filters.promoCodes.includes(c.invoice_promo_code!);
            });
        }
        if (filters.sources.length) result = result.filter((c) => filters.sources.includes(c.source ?? ""));
        if (filters.commentUsers.length) result = result.filter((c) => {
            if (!c.comment_by) return filters.commentUsers.includes("(Пустой)");
            return filters.commentUsers.includes(c.comment_by);
        });
        if (filters.orderStatus) result = result.filter((c) => (c.order_status ?? "pending") === filters.orderStatus);
        return result;
    }, [allCarts, query, filters]);

    const filteredGroups = useMemo(() => groupCarts(filteredCarts), [filteredCarts]);

    const prevQuery = useRef(query);
    useEffect(() => {
        if (query !== prevQuery.current) { setPage(0); prevQuery.current = query; }
    }, [query]);

    const totalPages = Math.ceil(filteredGroups.length / PAGE_SIZE);
    const pageGroups = filteredGroups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const applyFilters = () => {
        setFilters(pendingFilters);
        setPage(0);
        setFilterOpen(false);
        const historyChanged =
            JSON.stringify(pendingFilters.historyStatuses) !== JSON.stringify(filters.historyStatuses) ||
            pendingFilters.historyDateFrom !== filters.historyDateFrom ||
            pendingFilters.historyDateTo !== filters.historyDateTo;
        if (historyChanged) {
            loadCarts({
                historyStatuses: pendingFilters.historyStatuses,
                historyDateFrom: pendingFilters.historyDateFrom,
                historyDateTo: pendingFilters.historyDateTo,
            });
        }
    };
    const resetFilters = () => {
        setPendingFilters(EMPTY_FILTERS);
        setFilters(EMPTY_FILTERS);
        setPage(0);
        if (filters.historyStatuses.length || filters.historyDateFrom || filters.historyDateTo) {
            loadCarts({});
        }
    };
    const activeCount = activeFilterCount(filters);
    const stats = syncStatus?.stats;
    const lastSync = syncStatus?.lastSyncAt || stats?.lastSyncedAt;

    const totalSum = useMemo(
        () => filteredCarts.reduce((sum, c) => sum + (c.invoice_total || 0), 0),
        [filteredCarts]
    );
    const unprocessedSum = useMemo(
        () => filteredCarts.filter((c) => c.cart_status === "unprocessed").reduce((sum, c) => sum + (c.invoice_total || 0), 0),
        [filteredCarts]
    );

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
                <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                    <div className="shrink-0">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t.userCarts}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {isSyncing || syncStatus?.isSyncing ? (
                                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    Синхронизация...
                                </span>
                            ) : lastSync ? (
                                `Обновлено: ${format(new Date(lastSync), "dd.MM.yyyy HH:mm")}`
                            ) : (
                                t.noSyncYet
                            )}
                        </p>
                    </div>

                    {/* Total sum highlight */}
                    {filteredCarts.length > 0 && (
                        <div className="flex-1 flex justify-center">
                            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl px-8 py-3 text-center min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-widest text-purple-500 dark:text-purple-400 mb-1">
                                    {activeFilterCount(filters) > 0 ? "Сумма по фильтру" : "Общая сумма корзин"}
                                </p>
                                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 whitespace-nowrap">
                                    {formatSum(totalSum)} {t.sum}
                                </p>
                                {unprocessedSum > 0 && (
                                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 whitespace-nowrap">
                                        Не обработано: <span className="font-semibold">{formatSum(unprocessedSum)} {t.sum}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 shrink-0">
                        {allCarts.length > 0 && (
                            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mr-1">
                                <span>{t.total || "Всего"}: <b className="text-gray-700 dark:text-gray-300">{filteredCarts.length}</b></span>
                                <span className="text-yellow-600 dark:text-yellow-400">{filteredCarts.filter((c) => c.cart_status === "unprocessed").length} {t.unprocessed}</span>
                                <span className="text-blue-600 dark:text-blue-400">{filteredCarts.filter((c) => c.cart_status === "processed").length} {t.processed}</span>
                            </div>
                        )}
                        <Button onClick={loadCarts} variant="outline" size="sm" disabled={isLoading} className="gap-1.5">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                            <span className="hidden sm:inline">{t.update}</span>
                        </Button>
                        <Button
                            onClick={() => setIsConfirmOpen(true)}
                            disabled={isSyncing || syncStatus?.isSyncing}
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
                        >
                            <RefreshCw className={`h-4 w-4 ${isSyncing || syncStatus?.isSyncing ? "animate-spin" : ""}`} />
                            <span className="hidden sm:inline">{t.syncNow}</span>
                        </Button>
                    </div>
                </div>

                {/* Progress bar (only when syncing) */}
                {(isSyncing || syncStatus?.isSyncing) && (
                    <SyncProgressBar progress={syncProgress} />
                )}

                {/* Search + Filter bar */}
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
                            <X className="h-3.5 w-3.5" />{t.reset}
                        </Button>
                    )}
                    <Button variant={activeCount > 0 ? "default" : "outline"} onClick={() => { setPendingFilters(filters); setFilterOpen(true); }} className="gap-2 shrink-0">
                        <SlidersHorizontal className="h-4 w-4" />
                        {t.filter}
                        {activeCount > 0 && (
                            <span className="ml-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-white/30 text-xs font-bold">{activeCount}</span>
                        )}
                    </Button>
                </div>

                {(query || activeCount > 0) && !isLoading && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        {filteredCarts.length === 0 ? (t.noResults ?? "Ничего не найдено") : `${t.shown}: ${filteredCarts.length}`}
                    </p>
                )}

                {/* Table */}
                <Card>
                    <CardContent className="pt-6">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                                <span className="text-sm text-gray-500 dark:text-gray-400">Загрузка данных...</span>
                            </div>
                        ) : filteredCarts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400 dark:text-gray-500">
                                <RefreshCw className="h-10 w-10 opacity-30" />
                                <p className="text-sm font-medium">Данных нет</p>
                                <p className="text-xs text-center max-w-xs">
                                    Нажмите <b>«{t.syncNow}»</b> чтобы загрузить корзины пользователей из внешнего API
                                </p>
                                <Button onClick={() => setIsConfirmOpen(true)} disabled={isSyncing || syncStatus?.isSyncing} className="mt-2 bg-purple-600 hover:bg-purple-700 text-white gap-2">
                                    <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                                    {t.syncNow}
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                                {[
                                                    { label: "№", a: "left" },
                                                    { label: "ID", a: "left" },
                                                    { label: t.customer, a: "left" },
                                                    { label: t.phone, a: "left" },
                                                    { label: t.date, a: "left" },
                                                    { label: t.pharmacyName, a: "left" },
                                                    { label: t.address, a: "left" },
                                                    { label: t.itemsCount, a: "center" },
                                                    { label: t.grandTotal, a: "right" },
                                                    { label: t.promoCode, a: "left" },
                                                    { label: t.sourceLabel, a: "left" },
                                                    { label: t.cartStatus, a: "left" },
                                                    { label: "Кем", a: "left" },
                                                    { label: t.comment, a: "left" },
                                                ].map((h, i) => (
                                                    <th key={i} className={`py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap text-${h.a}`}>
                                                        {h.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageGroups.map((group, gIdx) => {
                                                const isExpanded = expandedGroups.has(group.key);
                                                const groupCustomerName = [group.customerFirstName, group.customerLastName].filter(Boolean).join(" ");
                                                const totalItems = group.carts.reduce((s, c) => s + (c.items?.length ?? 0), 0);
                                                const statusCounts = new Map<string, number>();
                                                for (const c of group.carts) {
                                                    const s = (c.order_status && c.order_status !== "pending") ? c.order_status : c.cart_status;
                                                    statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
                                                }
                                                // Summary values for collapsed row
                                                const newestCart = group.carts.reduce((a, b) => new Date(a.creation_date) > new Date(b.creation_date) ? a : b);
                                                const pharmacyNames = [...new Set(group.carts.map(c => c.market_name).filter(Boolean))];
                                                const pharmacyLabel = pharmacyNames.length === 1 ? pharmacyNames[0] : pharmacyNames.length > 1 ? `${pharmacyNames.length} аптек` : null;
                                                const addressLabel = pharmacyNames.length === 1 ? (group.carts.find(c => c.market_name === pharmacyNames[0])?.market_address ?? null) : null;
                                                const sources = [...new Set(group.carts.map(c => c.source).filter(Boolean))];
                                                const sourceLabel = sources.length === 1 ? sources[0] : null;
                                                const promos = [...new Set(group.carts.map(c => c.invoice_promo_code).filter(Boolean))];
                                                const promoLabel = promos.length > 0 ? promos[0] : null;
                                                const lastCommentCart = group.carts.find(c => c.comment);
                                                // Single-cart group: render cart row directly, no collapse
                                                if (group.carts.length === 1) {
                                                    const cart = group.carts[0];
                                                    return (
                                                        <tr key={group.key} className={`border-b border-gray-200 dark:border-gray-700 transition-colors ${
                                                            gIdx % 2 === 0
                                                                ? "bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900"
                                                                : "bg-white dark:bg-gray-950 hover:bg-purple-50 dark:hover:bg-purple-950"
                                                        }`}>
                                                            <td className="py-2.5 px-3 text-gray-400 text-sm">{page * PAGE_SIZE + gIdx + 1}</td>
                                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                                {group.customerId ? (
                                                                    <button
                                                                        onClick={() => claimAndOpenCart(cart, "cart")}
                                                                        className="font-mono text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                                                                    >
                                                                        {group.customerId}
                                                                    </button>
                                                                ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200 whitespace-nowrap text-sm">{customerName(cart)}</td>
                                                            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium">{cart.customer_phone}</td>
                                                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                                                                {format(new Date(cart.creation_date), "dd.MM.yyyy HH:mm")}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200 text-xs">{cart.market_name}</td>
                                                            <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 max-w-[160px] truncate text-xs">{cart.market_address}</td>
                                                            <td className="py-2.5 px-3 text-center">
                                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                                                                    {cart.items.length}
                                                                </span>
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                                {formatSum(cart.invoice_total)} {t.sum}
                                                            </td>
                                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                                {cart.invoice_promo_code ? (
                                                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400">
                                                                        <Tag className="h-2.5 w-2.5" />{cart.invoice_promo_code}
                                                                    </span>
                                                                ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                            </td>
                                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{cart.source}</span>
                                                            </td>
                                                            <td className="py-2.5 px-3">
                                                                {cart.order_status && cart.order_status !== "pending" ? (
                                                                    <OrderStatusBadge status={cart.order_status} />
                                                                ) : (
                                                                    <StatusBadge status={cart.cart_status} statuses={cartStatuses} />
                                                                )}
                                                            </td>
                                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                                {cart.comment_by ? (
                                                                    <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                                                                        <User className="h-3 w-3 text-purple-400 shrink-0" />{cart.comment_by}
                                                                    </span>
                                                                ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                            </td>
                                                            <td className="py-2.5 px-3 max-w-[180px]">
                                                                <button onClick={() => openCart(cart, "comments")} className="text-left w-full hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                                                                    {cart.comment ? (
                                                                        <span className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">{cart.comment}</span>
                                                                    ) : <span className="text-xs text-gray-300 dark:text-gray-600 hover:text-purple-400">+ комментарий</span>}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                return (
                                                    <React.Fragment key={group.key}>
                                                        {/* Group summary row — zebra striping */}
                                                        <tr
                                                            className={`border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors ${
                                                                gIdx % 2 === 0
                                                                    ? "bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900"
                                                                    : "bg-white dark:bg-gray-950 hover:bg-purple-50 dark:hover:bg-purple-950"
                                                            }`}
                                                            onClick={() => claimAndExpand(group)}
                                                        >
                                                            {/* № */}
                                                            <td className="py-2.5 px-3 text-gray-400 text-sm">
                                                                <div className="flex items-center gap-1.5">
                                                                    <ChevronRight className={`h-3.5 w-3.5 text-purple-500 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                                                                    {page * PAGE_SIZE + gIdx + 1}
                                                                </div>
                                                            </td>
                                                            {/* ID */}
                                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                                <div className="flex items-center gap-1.5">
                                                                    {group.customerId ? (
                                                                        <button
                                                                            onClick={e => { e.stopPropagation(); claimAndExpand(group); }}
                                                                            className="font-mono text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                                                                        >
                                                                            {group.customerId}
                                                                        </button>
                                                                    ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                                    <span className="text-xs text-gray-400 dark:text-gray-500">{group.carts.length} корз.</span>
                                                                </div>
                                                            </td>
                                                            {/* Клиент */}
                                                            <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                                                                {groupCustomerName || <span className="text-gray-400">—</span>}
                                                            </td>
                                                            {/* Телефон */}
                                                            <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium">
                                                                {group.customerPhone ?? "—"}
                                                            </td>
                                                            {/* Дата — самая новая */}
                                                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                                                                {format(new Date(newestCart.creation_date), "dd.MM.yyyy HH:mm")}
                                                            </td>
                                                            {/* Аптека */}
                                                            <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200 text-xs">
                                                                {pharmacyLabel ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                            </td>
                                                            {/* Адрес */}
                                                            <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 text-xs max-w-[160px] truncate">
                                                                {addressLabel ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                            </td>
                                                            {/* Товаров — сумма */}
                                                            <td className="py-2.5 px-3 text-center">
                                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                                                                    {totalItems}
                                                                </span>
                                                            </td>
                                                            {/* Итого */}
                                                            <td className="py-2.5 px-3 text-right font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                                {formatSum(group.totalSum)} {t.sum}
                                                            </td>
                                                            {/* Промокод */}
                                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                                {promoLabel ? (
                                                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400">
                                                                        <Tag className="h-2.5 w-2.5" />{promoLabel}
                                                                    </span>
                                                                ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                            </td>
                                                            {/* Источник */}
                                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                                {sourceLabel ? (
                                                                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{sourceLabel}</span>
                                                                ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                            </td>
                                                            {/* Статус */}
                                                            <td className="py-2.5 px-3">
                                                                <div className="flex items-center gap-1 flex-wrap">
                                                                    {Array.from(statusCounts.entries()).map(([s, count]) => {
                                                                        const cfg = ORDER_STATUS_CONFIG[s as keyof typeof ORDER_STATUS_CONFIG];
                                                                        const st = cartStatuses.find(x => x.value === s);
                                                                        const label = cfg?.label ?? st?.label ?? s;
                                                                        const cls = cfg?.cls ?? (st ? statusBadgeClasses(st.color) : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400");
                                                                        return (
                                                                            <span key={s} className={`inline-flex items-center whitespace-nowrap text-xs px-1.5 py-0.5 rounded-full ${cls}`}>
                                                                                {label}{count > 1 ? ` ×${count}` : ""}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </td>
                                                            {/* Кем */}
                                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                                {lastCommentCart?.comment_by ? (
                                                                    <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                                                                        <User className="h-3 w-3 text-purple-400 shrink-0" />{lastCommentCart.comment_by}
                                                                    </span>
                                                                ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                            </td>
                                                            {/* Комментарий */}
                                                            <td className="py-2.5 px-3 max-w-[180px]" onClick={e => e.stopPropagation()}>
                                                                <button
                                                                    onClick={() => openCart(group.carts[0], "comments")}
                                                                    className="text-left w-full hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                                                    title="Добавить комментарий"
                                                                >
                                                                    {lastCommentCart?.comment ? (
                                                                        <span className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{lastCommentCart.comment}</span>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-300 dark:text-gray-600 hover:text-purple-400 dark:hover:text-purple-500">+ комментарий</span>
                                                                    )}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                        {/* Expanded individual cart rows — zebra striping (blue tones) */}
                                                        {isExpanded && group.carts.map((cart, cIdx) => (
                                                            <tr key={cart.id} className={`border-b border-indigo-200 dark:border-indigo-800 transition-colors ${
                                                                cIdx % 2 === 0
                                                                    ? "bg-indigo-100 dark:bg-indigo-900 hover:bg-indigo-200 dark:hover:bg-indigo-800"
                                                                    : "bg-sky-100 dark:bg-sky-900 hover:bg-sky-200 dark:hover:bg-sky-800"
                                                            }`}>
                                                                <td className="py-2.5 px-3 pl-7 text-gray-300 dark:text-gray-600 text-xs">↳</td>
                                                                <td className="py-2.5 px-3">
                                                                    <button onClick={() => openCart(cart, "cart")} className="font-medium text-purple-700 dark:text-purple-400 hover:underline whitespace-nowrap text-xs">
                                                                        #{cart.id}
                                                                    </button>
                                                                    {cart.order_code && (
                                                                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{cart.order_code}</div>
                                                                    )}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">{customerName(cart)}</td>
                                                                <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{cart.customer_phone}</td>
                                                                <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                                                                    {format(new Date(cart.creation_date), "dd.MM.yyyy HH:mm")}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-gray-900 dark:text-gray-100 text-xs">{cart.market_name}</td>
                                                                <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 max-w-[160px] truncate text-xs">{cart.market_address}</td>
                                                                <td className="py-2.5 px-3 text-center">
                                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                                                                        {cart.items.length}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2.5 px-3 text-right font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap text-xs">
                                                                    {formatSum(cart.invoice_total)} {t.sum}
                                                                </td>
                                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                                    {cart.invoice_promo_code ? (
                                                                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400">
                                                                            <Tag className="h-2.5 w-2.5" />{cart.invoice_promo_code}
                                                                        </span>
                                                                    ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                                </td>
                                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{cart.source}</span>
                                                                </td>
                                                                <td className="py-2.5 px-3">
                                                                    {cart.order_status && cart.order_status !== "pending" ? (
                                                                        <OrderStatusBadge status={cart.order_status} />
                                                                    ) : (
                                                                        <StatusBadge status={cart.cart_status} statuses={cartStatuses} />
                                                                    )}
                                                                </td>
                                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                                    {cart.comment_by ? (
                                                                        <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                                                                            <User className="h-3 w-3 text-purple-400 shrink-0" />
                                                                            {cart.comment_by}
                                                                        </span>
                                                                    ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                                </td>
                                                                <td className="py-2.5 px-3 max-w-[180px]">
                                                                    <button onClick={() => openCart(cart, "comments")} className="text-left w-full hover:text-purple-600 dark:hover:text-purple-400 transition-colors" title="Открыть комментарии">
                                                                        {cart.comment ? (
                                                                            <span className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">{cart.comment}</span>
                                                                        ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {t.shown}: {Math.min(page * PAGE_SIZE + 1, filteredGroups.length)}–{Math.min((page + 1) * PAGE_SIZE, filteredGroups.length)} {t.of} {filteredGroups.length}
                                    </span>
                                    {totalPages > 1 && (
                                        <div className="flex items-center gap-1">
                                            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="h-8 w-8 p-0">
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            {(() => {
                                                const pages: (number | "…")[] = [];
                                                if (totalPages <= 7) for (let i = 0; i < totalPages; i++) pages.push(i);
                                                else if (page < 4) pages.push(0,1,2,3,4,"…",totalPages-1);
                                                else if (page >= totalPages-4) pages.push(0,"…",totalPages-5,totalPages-4,totalPages-3,totalPages-2,totalPages-1);
                                                else pages.push(0,"…",page-1,page,page+1,"…",totalPages-1);
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
                                            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages-1, p+1))} disabled={page >= totalPages-1} className="h-8 w-8 p-0">
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

            {/* ─── Filter Dialog ───────────────────────────────────────────── */}
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
                            <div className="col-span-2 grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t.dateFrom || "От"}</label>
                                    <input type="date" value={pendingFilters.dateFrom} onChange={(e) => setPendingFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t.dateTo || "До"}</label>
                                    <input type="date" value={pendingFilters.dateTo} onChange={(e) => setPendingFilters((f) => ({ ...f, dateTo: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t.cartStatus}</label>
                                    <select
                                        value={pendingFilters.orderStatus ? `__order__${pendingFilters.orderStatus}` : pendingFilters.status}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (v.startsWith("__order__")) {
                                                setPendingFilters((f) => ({ ...f, status: "all", orderStatus: v.replace("__order__", "") }));
                                            } else {
                                                setPendingFilters((f) => ({ ...f, status: v, orderStatus: "" }));
                                            }
                                        }}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400"
                                    >
                                        <option value="all">{t.allStatuses}</option>
                                        <optgroup label="── Операторские ──">
                                            {cartStatuses.map((s) => (
                                                <option key={s.value} value={s.value}>{s.label}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="── Статус заказа ──">
                                            {Object.entries(ORDER_STATUS_CONFIG).filter(([v]) => v !== "pending").map(([value, cfg]) => (
                                                <option key={value} value={`__order__${value}`}>{cfg.label}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <FilterSection title={t.pharmacyName || "Аптека"}>
                                    <CheckList options={allPharmacies} selected={pendingFilters.pharmacies} onChange={(v) => setPendingFilters((f) => ({ ...f, pharmacies: v }))} searchable />
                                </FilterSection>
                            </div>
                            <div className="space-y-5">
                                <FilterSection title={t.itemsCount || "Кол-во товаров"}>
                                    <div className="flex items-center gap-2">
                                        <input type="number" min="0" placeholder="от" value={pendingFilters.itemsMin} onChange={(e) => setPendingFilters((f) => ({ ...f, itemsMin: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400" />
                                        <span className="text-gray-400 shrink-0">—</span>
                                        <input type="number" min="0" placeholder="до" value={pendingFilters.itemsMax} onChange={(e) => setPendingFilters((f) => ({ ...f, itemsMax: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400" />
                                    </div>
                                </FilterSection>
                                <FilterSection title={t.grandTotal || "Сумма итого"}>
                                    <div className="flex items-center gap-2">
                                        <input type="number" min="0" placeholder="от" value={pendingFilters.totalMin} onChange={(e) => setPendingFilters((f) => ({ ...f, totalMin: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400" />
                                        <span className="text-gray-400 shrink-0">—</span>
                                        <input type="number" min="0" placeholder="до" value={pendingFilters.totalMax} onChange={(e) => setPendingFilters((f) => ({ ...f, totalMax: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400" />
                                    </div>
                                </FilterSection>
                                <FilterSection title={t.promoCode || "Промокод"}>
                                    <CheckList options={allPromoCodes} selected={pendingFilters.promoCodes} onChange={(v) => setPendingFilters((f) => ({ ...f, promoCodes: v }))} />
                                </FilterSection>
                                <FilterSection title={t.sourceLabel || "Источник"}>
                                    <CheckList options={allSources} selected={pendingFilters.sources} onChange={(v) => setPendingFilters((f) => ({ ...f, sources: v }))} />
                                </FilterSection>
                                <FilterSection title="Пользователь">
                                    <CheckList
                                        options={["(Пустой)", ...allCommentUsers]}
                                        selected={pendingFilters.commentUsers}
                                        onChange={(v) => setPendingFilters((f) => ({ ...f, commentUsers: v }))}
                                        searchable
                                    />
                                </FilterSection>
                            </div>
                        </div>

                        {/* ─── History filter ─────────────────────────────── */}
                        {cartStatuses.length > 0 && (
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-1">История статусов</p>
                                <div className="grid grid-cols-1 gap-4">
                                    <FilterSection title="Статус в истории">
                                        <CheckList
                                            options={cartStatuses.map((s) => s.label)}
                                            selected={pendingFilters.historyStatuses.map((v) => cartStatuses.find((s) => s.value === v)?.label ?? v)}
                                            onChange={(labels) => {
                                                const values = labels.map((l) => cartStatuses.find((s) => s.label === l)?.value ?? l);
                                                setPendingFilters((f) => ({ ...f, historyStatuses: values }));
                                            }}
                                        />
                                    </FilterSection>
                                    <FilterSection title="Период истории">
                                        <div className="flex items-center gap-2">
                                            <input type="date" value={pendingFilters.historyDateFrom} onChange={(e) => setPendingFilters((f) => ({ ...f, historyDateFrom: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400" />
                                            <span className="text-gray-400 shrink-0">—</span>
                                            <input type="date" value={pendingFilters.historyDateTo} onChange={(e) => setPendingFilters((f) => ({ ...f, historyDateTo: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400" />
                                        </div>
                                    </FilterSection>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 shrink-0">
                        <Button onClick={applyFilters} className="flex-1">{t.apply}</Button>
                        <Button variant="outline" onClick={() => { setPendingFilters(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(0); setFilterOpen(false); }} className="flex-1">{t.reset}</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ─── Sync confirm dialog (like OsonList) ──────────────────────── */}
            <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Синхронизировать корзины?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Будут загружены все черновые заказы из внешнего API и сохранены в базу данных. Процесс может занять несколько минут.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSync} className="bg-purple-600 hover:bg-purple-700">
                            Да, синхронизировать
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ─── Claim warning dialog ───────────────────────────────────────── */}
            {claimWarning && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => { setClaimWarning(null); if (pendingCartOpen) { openCart(pendingCartOpen.cart, pendingCartOpen.tab); setPendingCartOpen(null); } }}>
                    <div
                        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 max-w-sm mx-4 flex flex-col gap-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-gray-100">Клиент уже обрабатывается</p>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium text-amber-600 dark:text-amber-400">{claimWarning}</span> сейчас работает с этим клиентом
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setClaimWarning(null); if (pendingCartOpen) { openCart(pendingCartOpen.cart, pendingCartOpen.tab); setPendingCartOpen(null); } }}
                            className="self-end rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 transition-colors"
                        >
                            Понятно
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Cart detail modal ──────────────────────────────────────────── */}
            <UserCartModal
                cart={selectedCart}
                isOpen={selectedCart !== null}
                onClose={closeCart}
                initialTab={selectedCartTab}
                t={t as unknown as Record<string, string>}
            />
        </div>
    );
}
