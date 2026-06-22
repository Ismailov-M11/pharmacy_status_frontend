import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserCartModal } from "@/components/UserCartModal";
import { RefreshCw, ChevronLeft, ChevronRight, Tag } from "lucide-react";
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
    const [selectedOrder, setSelectedOrder] = useState<DraftOrder | null>(null);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) navigate("/login");
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
        if (!authLoading && isAuthenticated) load(page);
    }, [authLoading, isAuthenticated, page, load]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

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

                <Card>
                    <CardContent className="pt-6">
                        {isLoading ? (
                            <div className="h-96 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                        ) : orders.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                {t.noData}
                            </p>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                                <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    №
                                                </th>
                                                <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    ID
                                                </th>
                                                <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {t.date}
                                                </th>
                                                <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {t.customer}
                                                </th>
                                                <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {t.phone}
                                                </th>
                                                <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {t.pharmacyName}
                                                </th>
                                                <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {t.address}
                                                </th>
                                                <th className="text-center py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {t.itemsCount}
                                                </th>
                                                <th className="text-right py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {t.marketTotal}
                                                </th>
                                                <th className="text-right py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {t.deliveryFee}
                                                </th>
                                                <th className="text-right py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {t.serviceFee}
                                                </th>
                                                <th className="text-right py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {t.grandTotal}
                                                </th>
                                                <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {t.promoCode}
                                                </th>
                                                <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {t.sourceLabel}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orders.map((order, idx) => {
                                                const rowNum = page * PAGE_SIZE + idx + 1;
                                                return (
                                                    <tr
                                                        key={order.id}
                                                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                                                    >
                                                        {/* № */}
                                                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400">
                                                            {rowNum}
                                                        </td>

                                                        {/* ID — clickable */}
                                                        <td className="py-3 px-3">
                                                            <button
                                                                onClick={() => setSelectedOrder(order)}
                                                                className="font-medium text-purple-700 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 hover:underline whitespace-nowrap"
                                                            >
                                                                #{order.id}
                                                            </button>
                                                        </td>

                                                        {/* Date */}
                                                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                            {format(new Date(order.creationDate), "dd.MM.yyyy HH:mm")}
                                                        </td>

                                                        {/* Customer */}
                                                        <td className="py-3 px-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                            {customerName(order)}
                                                        </td>

                                                        {/* Phone */}
                                                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                            {order.customer.phone}
                                                        </td>

                                                        {/* Market */}
                                                        <td className="py-3 px-3 text-gray-900 dark:text-gray-100">
                                                            {order.market.name}
                                                        </td>

                                                        {/* Address */}
                                                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                                                            {order.market.address}
                                                        </td>

                                                        {/* Items count */}
                                                        <td className="py-3 px-3 text-center">
                                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                                                                {order.items.length}
                                                            </span>
                                                        </td>

                                                        {/* Market total */}
                                                        <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                            {formatSum(order.invoice.marketTotal)} {t.sum}
                                                        </td>

                                                        {/* Delivery */}
                                                        <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                            {formatSum(order.invoice.deliveryTotal)} {t.sum}
                                                        </td>

                                                        {/* Service fee */}
                                                        <td className="py-3 px-3 text-right text-gray-500 dark:text-gray-500 whitespace-nowrap">
                                                            {formatSum(order.invoice.serviceTotal)} {t.sum}
                                                        </td>

                                                        {/* Grand total */}
                                                        <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                            {formatSum(order.invoice.total)} {t.sum}
                                                        </td>

                                                        {/* Promo code */}
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

                                                        {/* Source */}
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

                                {/* Footer: count + pagination */}
                                <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {t.shown}: {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} {t.of} {total}
                                    </span>

                                    {totalPages > 1 && (
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                                disabled={page === 0}
                                                className="h-8 w-8 p-0"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>

                                            {(() => {
                                                const pages: (number | "…")[] = [];
                                                if (totalPages <= 7) {
                                                    for (let i = 0; i < totalPages; i++) pages.push(i);
                                                } else if (page < 4) {
                                                    pages.push(0, 1, 2, 3, 4, "…", totalPages - 1);
                                                } else if (page >= totalPages - 4) {
                                                    pages.push(0, "…", totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1);
                                                } else {
                                                    pages.push(0, "…", page - 1, page, page + 1, "…", totalPages - 1);
                                                }
                                                return pages.map((p, i) =>
                                                    p === "…" ? (
                                                        <span key={`e-${i}`} className="px-1 text-gray-400 text-sm">…</span>
                                                    ) : (
                                                        <Button
                                                            key={p}
                                                            variant={p === page ? "default" : "ghost"}
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-xs"
                                                            onClick={() => setPage(p as number)}
                                                        >
                                                            {(p as number) + 1}
                                                        </Button>
                                                    )
                                                );
                                            })()}

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                                disabled={page >= totalPages - 1}
                                                className="h-8 w-8 p-0"
                                            >
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

            <UserCartModal
                order={selectedOrder}
                isOpen={selectedOrder !== null}
                onClose={() => setSelectedOrder(null)}
            />
        </div>
    );
}
