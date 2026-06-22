import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { RefreshCw, ChevronDown, ChevronRight, ChevronLeft, Tag } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchDraftOrders, DraftOrder } from "@/lib/draftOrderApi";

const PAGE_SIZE = 50;

function formatSum(n: number): string {
    return Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function customerName(order: DraftOrder): string {
    const { firstName, lastName, phone } = order.customer;
    if (firstName || lastName) {
        return [firstName, lastName].filter(Boolean).join(" ");
    }
    return phone;
}

export default function UserCarts() {
    const { isAuthenticated, isLoading: authLoading, token } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [orders, setOrders] = useState<DraftOrder[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) {
            navigate("/login");
        }
    }, [authLoading, isAuthenticated, navigate]);

    const load = useCallback(
        async (p: number) => {
            if (!token) return;
            setIsLoading(true);
            try {
                const result = await fetchDraftOrders(token, p, PAGE_SIZE);
                setOrders(result.list);
                setTotal(result.total);
            } catch {
                toast.error(t.dataLoadError || "Ошибка при загрузке данных");
            } finally {
                setIsLoading(false);
            }
        },
        [token, t]
    );

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            load(page);
        }
    }, [authLoading, isAuthenticated, page, load]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const toggleExpand = (id: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

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

            <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
                {/* Page header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                            {t.userCarts}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            {t.userCartsDescription}
                            {total > 0 && (
                                <span className="ml-2 text-purple-600 dark:text-purple-400 font-medium">
                                    ({total})
                                </span>
                            )}
                        </p>
                    </div>
                    <Button
                        onClick={() => load(page)}
                        variant="outline"
                        disabled={isLoading}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        {t.update}
                    </Button>
                </div>

                {/* Table card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                                    <TableHead className="w-10" />
                                    <TableHead className="w-12 text-center">№</TableHead>
                                    <TableHead className="w-20">{t.cartId}</TableHead>
                                    <TableHead className="min-w-[130px]">{t.date}</TableHead>
                                    <TableHead className="min-w-[150px]">{t.customer}</TableHead>
                                    <TableHead className="min-w-[120px]">{t.phone}</TableHead>
                                    <TableHead className="min-w-[180px]">{t.pharmacyName}</TableHead>
                                    <TableHead className="min-w-[200px]">{t.address}</TableHead>
                                    <TableHead className="w-20 text-center">{t.itemsCount}</TableHead>
                                    <TableHead className="min-w-[130px] text-right">{t.marketTotal}</TableHead>
                                    <TableHead className="min-w-[100px] text-right">{t.deliveryFee}</TableHead>
                                    <TableHead className="min-w-[110px] text-right">{t.serviceFee}</TableHead>
                                    <TableHead className="min-w-[130px] text-right font-semibold">{t.grandTotal}</TableHead>
                                    <TableHead className="min-w-[110px]">{t.promoCode}</TableHead>
                                    <TableHead className="min-w-[110px]">{t.sourceLabel}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 10 }).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array.from({ length: 15 }).map((_, j) => (
                                                <TableCell key={j}>
                                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : orders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={15} className="text-center py-12 text-gray-400 dark:text-gray-500">
                                            {t.noData}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    orders.map((order, idx) => {
                                        const expanded = expandedIds.has(order.id);
                                        const rowNum = page * PAGE_SIZE + idx + 1;
                                        return (
                                            <>
                                                <TableRow
                                                    key={order.id}
                                                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                                    onClick={() => toggleExpand(order.id)}
                                                >
                                                    {/* Expand toggle */}
                                                    <TableCell className="pl-4">
                                                        {expanded ? (
                                                            <ChevronDown className="h-4 w-4 text-gray-400" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4 text-gray-400" />
                                                        )}
                                                    </TableCell>

                                                    {/* Row number */}
                                                    <TableCell className="text-center text-gray-400 text-sm">
                                                        {rowNum}
                                                    </TableCell>

                                                    {/* ID */}
                                                    <TableCell className="font-mono text-sm text-gray-700 dark:text-gray-300">
                                                        #{order.id}
                                                    </TableCell>

                                                    {/* Date */}
                                                    <TableCell className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                        {format(new Date(order.creationDate), "dd.MM.yyyy HH:mm")}
                                                    </TableCell>

                                                    {/* Customer name */}
                                                    <TableCell className="text-sm text-gray-700 dark:text-gray-300">
                                                        {customerName(order)}
                                                    </TableCell>

                                                    {/* Phone */}
                                                    <TableCell className="text-sm font-mono text-gray-700 dark:text-gray-300">
                                                        {order.customer.phone}
                                                    </TableCell>

                                                    {/* Market name */}
                                                    <TableCell className="text-sm text-gray-700 dark:text-gray-300">
                                                        {order.market.name}
                                                    </TableCell>

                                                    {/* Address */}
                                                    <TableCell className="text-sm text-gray-500 dark:text-gray-400 max-w-[220px] truncate" title={order.market.address}>
                                                        {order.market.address}
                                                    </TableCell>

                                                    {/* Items count */}
                                                    <TableCell className="text-center">
                                                        <Badge variant="secondary" className="text-xs">
                                                            {order.items.length}
                                                        </Badge>
                                                    </TableCell>

                                                    {/* Market total */}
                                                    <TableCell className="text-right text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                        {formatSum(order.invoice.marketTotal)} {t.sum}
                                                    </TableCell>

                                                    {/* Delivery */}
                                                    <TableCell className="text-right text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                        {formatSum(order.invoice.deliveryTotal)} {t.sum}
                                                    </TableCell>

                                                    {/* Service fee */}
                                                    <TableCell className="text-right text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                        {formatSum(order.invoice.serviceTotal)} {t.sum}
                                                    </TableCell>

                                                    {/* Grand total */}
                                                    <TableCell className="text-right font-semibold text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                        {formatSum(order.invoice.total)} {t.sum}
                                                    </TableCell>

                                                    {/* Promo code */}
                                                    <TableCell>
                                                        {order.invoice.promoCode ? (
                                                            <Badge variant="outline" className="text-xs gap-1 text-purple-600 border-purple-300 dark:text-purple-400 dark:border-purple-700">
                                                                <Tag className="h-2.5 w-2.5" />
                                                                {order.invoice.promoCode.code}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-gray-300 dark:text-gray-600">—</span>
                                                        )}
                                                    </TableCell>

                                                    {/* Source */}
                                                    <TableCell>
                                                        <Badge variant="secondary" className="text-xs">
                                                            {order.source}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>

                                                {/* Expanded items row */}
                                                {expanded && (
                                                    <TableRow key={`${order.id}-items`} className="bg-purple-50/50 dark:bg-purple-900/10">
                                                        <TableCell colSpan={15} className="px-8 pb-4 pt-2">
                                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                                                                {t.expandItems}
                                                            </p>
                                                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                                                <table className="w-full text-sm">
                                                                    <thead>
                                                                        <tr className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
                                                                            <th className="px-3 py-2 text-left font-medium">{t.productName}</th>
                                                                            <th className="px-3 py-2 text-left font-medium">{t.manufacturer}</th>
                                                                            <th className="px-3 py-2 text-center font-medium">{t.quantity}</th>
                                                                            <th className="px-3 py-2 text-right font-medium">{t.price}</th>
                                                                            <th className="px-3 py-2 text-right font-medium">{t.total}</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {order.items.map((item, itemIdx) => (
                                                                            <tr
                                                                                key={item.id}
                                                                                className={`${
                                                                                    itemIdx % 2 === 0
                                                                                        ? "bg-white dark:bg-gray-800/50"
                                                                                        : "bg-gray-50 dark:bg-gray-800/30"
                                                                                }`}
                                                                            >
                                                                                <td className="px-3 py-2.5 text-gray-800 dark:text-gray-200 font-medium">
                                                                                    {item.name}
                                                                                </td>
                                                                                <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                                                                                    {item.manufacturer}
                                                                                </td>
                                                                                <td className="px-3 py-2.5 text-center text-gray-700 dark:text-gray-300">
                                                                                    {item.quantity}
                                                                                </td>
                                                                                <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                                                    {formatSum(item.price)} {t.sum}
                                                                                </td>
                                                                                <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                                                    {formatSum(item.total)} {t.sum}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {!isLoading && totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {t.page} {page + 1} {t.of} {totalPages} &nbsp;·&nbsp; {total} {t.orders}
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="gap-1"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                                        let pageNum: number;
                                        if (totalPages <= 7) {
                                            pageNum = i;
                                        } else if (page < 4) {
                                            pageNum = i < 5 ? i : i === 5 ? -1 : totalPages - 1;
                                        } else if (page >= totalPages - 4) {
                                            pageNum = i === 0 ? 0 : i === 1 ? -1 : totalPages - (7 - i);
                                        } else {
                                            const map: { [k: number]: number } = {
                                                0: 0, 1: -1, 2: page - 1, 3: page, 4: page + 1, 5: -1, 6: totalPages - 1,
                                            };
                                            pageNum = map[i];
                                        }
                                        if (pageNum === -1) {
                                            return <span key={i} className="px-1 text-gray-400">…</span>;
                                        }
                                        return (
                                            <Button
                                                key={i}
                                                variant={pageNum === page ? "default" : "ghost"}
                                                size="sm"
                                                className="w-8 h-8 p-0 text-xs"
                                                onClick={() => setPage(pageNum)}
                                            >
                                                {pageNum + 1}
                                            </Button>
                                        );
                                    })}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                    className="gap-1"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
