import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserCart, CartItem, CartComment, getCartComments, addCartComment } from "@/lib/userCartApi";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import {
    User, Store, Tag, MapPin, Phone, Package, ShoppingCart,
    CheckCircle, Clock, MessageSquare, Loader2, Send, Map,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "cart" | "map" | "comments";

interface UserCartModalProps {
    cart: UserCart | null;
    isOpen: boolean;
    onClose: () => void;
    initialTab?: Tab;
    onCartUpdated?: (cart: UserCart) => void;
    t: Record<string, string>;
}

function formatSum(n: number): string {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                    {icon}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{title}</h3>
            </div>
            {children}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between py-1.5 text-sm border-b border-gray-100 dark:border-gray-800 last:border-0">
            <span className="text-gray-500 dark:text-gray-400 shrink-0 mr-4">{label}</span>
            <span className="text-gray-900 dark:text-gray-100 font-medium text-right">{value}</span>
        </div>
    );
}

// ─── Map tab ──────────────────────────────────────────────────────────────────
function MapTab({ cart }: { cart: UserCart }) {
    const containerRef = useRef<HTMLDivElement>(null);

    const hasClient = cart.latitude != null && cart.longitude != null;
    const hasMarket = cart.market_latitude != null && cart.market_longitude != null;

    useEffect(() => {
        const el = containerRef.current;
        if (!el || (!hasClient && !hasMarket)) return;

        const ymaps = (window as any).ymaps;
        if (!ymaps || typeof ymaps.ready !== "function") return;

        let cancelled = false;
        let mapInstance: any = null;

        // Wait for dialog animation so container has real pixel dimensions
        const initTimer = setTimeout(() => {
            ymaps.ready(() => {
                if (cancelled || !el) return;

                const defaultCenter: [number, number] = hasMarket
                    ? [cart.market_latitude!, cart.market_longitude!]
                    : [cart.latitude!, cart.longitude!];

                mapInstance = new ymaps.Map(el, {
                    center: defaultCenter,
                    zoom: 13,
                    controls: ["zoomControl"],
                }, { suppressMapOpenBlock: true });

                mapInstance.container.fitToViewport();

                if (hasMarket) {
                    mapInstance.geoObjects.add(new ymaps.Placemark(
                        [cart.market_latitude!, cart.market_longitude!],
                        {},
                        { preset: "islands#blueCircleDotIcon" }
                    ));
                }

                if (hasClient) {
                    mapInstance.geoObjects.add(new ymaps.Placemark(
                        [cart.latitude!, cart.longitude!],
                        {},
                        { preset: "islands#redCircleDotIcon" }
                    ));
                }

                if (hasClient && hasMarket) {
                    ymaps.route(
                        [[cart.market_latitude!, cart.market_longitude!], [cart.latitude!, cart.longitude!]],
                        { mapStateAutoApply: false, routingMode: "auto" }
                    ).then((route: any) => {
                        if (cancelled || !mapInstance) return;
                        route.getPaths().options.set({
                            strokeColor: "6366f1",
                            strokeWidth: 4,
                            opacity: 0.8,
                            openBalloonOnClick: false,
                        });
                        route.getWayPoints().options.set("visible", false);
                        mapInstance.geoObjects.add(route);
                        const bounds = route.getBounds();
                        if (bounds) mapInstance.setBounds(bounds, { checkZoomRange: true, zoomMargin: 50 });
                    }).catch(() => {
                        const bounds = mapInstance?.geoObjects.getBounds();
                        if (bounds) mapInstance.setBounds(bounds, { checkZoomRange: true, zoomMargin: 60 });
                    });
                } else {
                    setTimeout(() => {
                        if (!cancelled && mapInstance) {
                            const bounds = mapInstance.geoObjects.getBounds();
                            if (bounds) mapInstance.setBounds(bounds, { checkZoomRange: true, zoomMargin: 80 });
                        }
                    }, 150);
                }
            });
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(initTimer);
            if (mapInstance) { try { mapInstance.destroy(); } catch (_) {} }
        };
    }, [cart.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const clientLabel = [cart.customer_first_name, cart.customer_last_name].filter(Boolean).join(" ") || cart.customer_phone || "Клиент";
    const marketLabel = cart.market_name || "Аптека";

    if (!hasClient && !hasMarket) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
                <Map className="h-10 w-10 opacity-30" />
                <p className="text-sm">Координаты недоступны</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-5 text-sm px-1">
                {hasMarket && (
                    <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                        <span className="font-medium truncate max-w-[200px]">{marketLabel}</span>
                        <span className="text-xs text-gray-400">(аптека)</span>
                    </span>
                )}
                {hasClient && (
                    <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                        <span className="font-medium truncate max-w-[200px]">{clientLabel}</span>
                        <span className="text-xs text-gray-400">(клиент)</span>
                    </span>
                )}
            </div>
            <div
                ref={containerRef}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                style={{ height: 400 }}
            />
        </div>
    );
}

// ─── Comments tab ─────────────────────────────────────────────────────────────
function CommentsTab({ cart, token, username }: {
    cart: UserCart;
    token: string;
    username: string;
}) {
    const [comments, setComments] = useState<CartComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState("");
    const [saving, setSaving] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        getCartComments(token, cart.id)
            .then((list) => { if (active) setComments(list); })
            .catch(() => {})
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [cart.id, token]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [comments]);

    const handleSend = async () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        setSaving(true);
        try {
            const added = await addCartComment(token, cart.id, trimmed, username);
            setComments((prev) => [...prev, added]);
            setText("");
            toast.success("Комментарий добавлен");
        } catch {
            toast.error("Ошибка при добавлении комментария");
        } finally {
            setSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend();
    };

    return (
        <div className="flex flex-col gap-4">
            {/* History */}
            <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                ) : comments.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>Комментариев пока нет</p>
                    </div>
                ) : (
                    comments.map((c) => (
                        <div key={c.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{c.text}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 dark:text-gray-500">
                                <User className="h-3 w-3 shrink-0" />
                                <span className="font-medium text-gray-500 dark:text-gray-400">{c.created_by}</span>
                                <span>·</span>
                                <span>{format(new Date(c.created_at), "dd.MM.yyyy HH:mm")}</span>
                            </div>
                        </div>
                    ))
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    placeholder="Введите комментарий... (Ctrl+Enter для отправки)"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400 resize-none"
                />
                <div className="flex justify-end mt-2">
                    <Button onClick={handleSend} disabled={saving || !text.trim()} size="sm" className="gap-1.5">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Отправить
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function UserCartModal({ cart, isOpen, onClose, initialTab = "cart", t }: UserCartModalProps) {
    const { token, user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);

    useEffect(() => {
        if (isOpen) setActiveTab(initialTab);
    }, [isOpen, initialTab]);

    if (!cart) return null;

    const displayName = [cart.customer_first_name, cart.customer_last_name].filter(Boolean).join(" ") || cart.customer_phone;
    const isProcessed = cart.cart_status === "processed";

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: "cart",     label: "Корзина",      icon: <ShoppingCart className="h-4 w-4" /> },
        { id: "map",      label: "Карта",         icon: <Map className="h-4 w-4" /> },
        { id: "comments", label: "Комментарии",   icon: <MessageSquare className="h-4 w-4" /> },
    ];

    const subtotal = cart.invoice_market_total + cart.invoice_delivery_total + cart.invoice_service_total;
    const discount = subtotal - cart.invoice_total;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
                {/* Header */}
                <DialogHeader className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <DialogTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-gray-100">
                        <ShoppingCart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        {t.userCarts} #{cart.id}
                        {isProcessed ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-normal">
                                <CheckCircle className="h-3 w-3" />{t.processed}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 font-normal">
                                <Clock className="h-3 w-3" />{t.unprocessed}
                            </span>
                        )}
                    </DialogTitle>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {format(new Date(cart.creation_date), "dd.MM.yyyy HH:mm")}
                        {cart.source && <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">{cart.source}</span>}
                    </p>
                </DialogHeader>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0 px-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? "border-purple-600 text-purple-700 dark:text-purple-400"
                                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto px-6 py-5">

                    {/* ── TAB: Корзина ── */}
                    {activeTab === "cart" && (
                        <div className="space-y-5">
                            {/* Customer */}
                            <Section icon={<User className="h-4 w-4" />} title={t.customer || "Клиент"}>
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-1">
                                    <InfoRow label={t.name || "Имя"} value={displayName} />
                                    <InfoRow label={t.phone || "Телефон"} value={
                                        <a href={`tel:${cart.customer_phone}`} className="text-purple-600 dark:text-purple-400 hover:underline">
                                            {cart.customer_phone}
                                        </a>
                                    } />
                                </div>
                            </Section>

                            {/* Pharmacy */}
                            <Section icon={<Store className="h-4 w-4" />} title={t.pharmacyName || "Аптека"}>
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-1">
                                    <InfoRow label={t.pharmacyName || "Аптека"} value={cart.market_name} />
                                    <InfoRow label={t.address || "Адрес"} value={cart.market_address} />
                                    {cart.market_landmark && (
                                        <InfoRow label={t.landmark || "Ориентир"} value={
                                            <span className="flex items-center gap-1 justify-end">
                                                <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                                {cart.market_landmark}
                                            </span>
                                        } />
                                    )}
                                    {cart.market_phone && (
                                        <InfoRow label={t.pharmacyPhone || "Тел. аптеки"} value={
                                            <a href={`tel:${cart.market_phone}`} className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 justify-end">
                                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                                {cart.market_phone}
                                            </a>
                                        } />
                                    )}
                                </div>
                            </Section>

                            {/* Items */}
                            <Section icon={<Package className="h-4 w-4" />} title={t.expandItems || "Товары"}>
                                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                                                <th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.productName || "Товар"}</th>
                                                <th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap hidden sm:table-cell">{t.manufacturer || "Произв."}</th>
                                                <th className="text-center py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.quantity || "Кол-во"}</th>
                                                <th className="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.price || "Цена"}</th>
                                                <th className="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.total || "Итого"}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(cart.items as CartItem[]).map((item, i) => (
                                                <tr key={item.id} className={`border-b border-gray-100 dark:border-gray-800 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-gray-800/30"}`}>
                                                    <td className="py-2.5 px-3">
                                                        <div className="flex items-center gap-2.5">
                                                            {item.imageUrl ? (
                                                                <img
                                                                    src={item.imageUrl}
                                                                    alt={item.name}
                                                                    className="w-10 h-10 rounded-md object-contain border border-gray-100 dark:border-gray-700 bg-white shrink-0"
                                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                                />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                                                    <Package className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="text-gray-900 dark:text-gray-100 font-medium leading-snug">{item.name}</p>
                                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 sm:hidden">{item.manufacturer}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell">{item.manufacturer}</td>
                                                    <td className="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">{item.quantity}</td>
                                                    <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatSum(item.price)} {t.sum}</td>
                                                    <td className="py-2.5 px-3 text-right font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{formatSum(item.total)} {t.sum}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Section>

                            {/* Invoice */}
                            <Section icon={<Tag className="h-4 w-4" />} title={t.grandTotal || "Итого"}>
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-1">
                                    <InfoRow label={t.marketTotal || "Сумма товаров"} value={`${formatSum(cart.invoice_market_total)} ${t.sum}`} />
                                    <InfoRow label={t.deliveryFee || "Доставка"} value={`${formatSum(cart.invoice_delivery_total)} ${t.sum}`} />
                                    <InfoRow label={t.serviceFee || "Комиссия"} value={
                                        <span className="text-gray-500 dark:text-gray-400">{formatSum(cart.invoice_service_total)} {t.sum}</span>
                                    } />
                                    {cart.invoice_promo_code && (
                                        <InfoRow label={t.promoCode || "Промокод"} value={
                                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400">
                                                <Tag className="h-2.5 w-2.5" />
                                                {cart.invoice_promo_code}
                                            </span>
                                        } />
                                    )}
                                    {discount > 0 && (
                                        <InfoRow label="Скидка" value={
                                            <span className="text-green-600 dark:text-green-400 font-semibold">
                                                − {formatSum(discount)} {t.sum}
                                            </span>
                                        } />
                                    )}
                                    <div className="flex items-center justify-between py-2 mt-1 border-t border-gray-200 dark:border-gray-700">
                                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{t.grandTotal || "Итого"}</span>
                                        <span className="font-bold text-lg text-purple-600 dark:text-purple-400">
                                            {formatSum(cart.invoice_total)} {t.sum}
                                        </span>
                                    </div>
                                </div>
                            </Section>
                        </div>
                    )}

                    {/* ── TAB: Карта ── */}
                    {activeTab === "map" && (
                        <MapTab cart={cart} />
                    )}

                    {/* ── TAB: Комментарии ── */}
                    {activeTab === "comments" && token && (
                        <CommentsTab
                            cart={cart}
                            token={token}
                            username={user?.username ?? ""}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
