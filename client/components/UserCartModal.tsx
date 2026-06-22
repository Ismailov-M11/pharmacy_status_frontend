import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserCart, CartItem, CartComment, CartStatus, getCartComments, addCartComment, getCartStatuses, createCartStatus } from "@/lib/userCartApi";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import {
    User, Store, Tag, MapPin, Phone, Package, ShoppingCart,
    CheckCircle, MessageSquare, Loader2, Send, Map, Plus, X as XIcon,
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
    const mapRef = useRef<any>(null);
    const initializedRef = useRef(false);

    const hasClient = cart.latitude != null && cart.longitude != null;
    const hasMarket = cart.market_latitude != null && cart.market_longitude != null;

    const initMap = () => {
        if (!containerRef.current || initializedRef.current) return;
        try {
            const defaultCenter: [number, number] = hasMarket
                ? [cart.market_latitude!, cart.market_longitude!]
                : [cart.latitude!, cart.longitude!];

            mapRef.current = new window.ymaps.Map(containerRef.current, {
                center: defaultCenter,
                zoom: 13,
                controls: ["zoomControl", "fullscreenControl"],
                behaviors: ["default", "scrollZoom"],
            });
            initializedRef.current = true;

            if (hasMarket) {
                mapRef.current.geoObjects.add(new window.ymaps.Placemark(
                    [cart.market_latitude!, cart.market_longitude!],
                    {},
                    { preset: "islands#blueCircleDotIcon" }
                ));
            }
            if (hasClient) {
                mapRef.current.geoObjects.add(new window.ymaps.Placemark(
                    [cart.latitude!, cart.longitude!],
                    {},
                    { preset: "islands#redCircleDotIcon" }
                ));
            }

            if (hasClient && hasMarket) {
                window.ymaps.route(
                    [[cart.market_latitude!, cart.market_longitude!], [cart.latitude!, cart.longitude!]],
                    { mapStateAutoApply: false, routingMode: "auto" }
                ).then((route: any) => {
                    if (!mapRef.current) return;
                    route.getPaths().options.set({
                        strokeColor: "6366f1",
                        strokeWidth: 4,
                        opacity: 0.8,
                        openBalloonOnClick: false,
                    });
                    route.getWayPoints().options.set("visible", false);
                    mapRef.current.geoObjects.add(route);
                    const bounds = route.getBounds();
                    if (bounds) mapRef.current.setBounds(bounds, { checkZoomRange: true, zoomMargin: 50 });
                }).catch(() => {
                    const bounds = mapRef.current?.geoObjects.getBounds();
                    if (bounds) mapRef.current.setBounds(bounds, { checkZoomRange: true, zoomMargin: 60 });
                });
            }

            // Redraw after dialog animation finishes
            setTimeout(() => {
                if (mapRef.current) mapRef.current.container.fitToViewport();
            }, 200);

            // Root cause: ymaps sets body { pointer-events: none } on fullscreen but does NOT
            // set pointer-events: auto on the <ymaps> element it appends to body.
            // Radix Dialog overlay (pointer-events: auto, z-50) then captures all clicks.
            // Fix: force pointer-events: auto on <ymaps> whenever fullscreen is entered.
            mapRef.current.container.events.add("fullscreenenter", () => {
                setTimeout(() => {
                    const ymapsEl = document.querySelector("body > ymaps") as HTMLElement | null;
                    if (ymapsEl) ymapsEl.style.pointerEvents = "auto";
                    if (mapRef.current) mapRef.current.container.fitToViewport();
                }, 50);
            });
            mapRef.current.container.events.add("fullscreenexit", () => {
                setTimeout(() => {
                    if (mapRef.current) mapRef.current.container.fitToViewport();
                }, 50);
            });
        } catch (err) {
            console.error("MapTab init error:", err);
        }
    };

    useEffect(() => {
        if (!hasClient && !hasMarket) return;

        // Reuse already-loaded script (same id as OsonList)
        const existing = document.getElementById("yandex-maps-script");
        if (existing) {
            if (window.ymaps) window.ymaps.ready(initMap);
            return;
        }

        const script = document.createElement("script");
        script.id = "yandex-maps-script";
        script.src = `https://api-maps.yandex.ru/2.1/?apikey=${(import.meta as any).env?.VITE_YANDEX_MAP_KEY ?? ""}&lang=ru_RU`;
        script.async = true;
        script.onload = () => {
            if (window.ymaps) window.ymaps.ready(initMap);
        };
        document.head.appendChild(script);

        return () => {
            if (mapRef.current) {
                try { mapRef.current.destroy(); } catch (_) {}
                mapRef.current = null;
            }
            initializedRef.current = false;
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
                onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
            />
        </div>
    );
}

// ─── Color map for dynamic statuses ───────────────────────────────────────────
const COLOR_MAP: Record<string, { btn: string; badge: string }> = {
    yellow:  { btn: "border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",   badge: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400" },
    green:   { btn: "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400",         badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" },
    orange:  { btn: "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-400",   badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400" },
    blue:    { btn: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400",               badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400" },
    purple:  { btn: "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-400",   badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400" },
    red:     { btn: "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400",                     badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400" },
    pink:    { btn: "border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-700 dark:bg-pink-900/30 dark:text-pink-400",               badge: "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-400" },
    cyan:    { btn: "border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",               badge: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400" },
    teal:    { btn: "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-700 dark:bg-teal-900/30 dark:text-teal-400",               badge: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400" },
    indigo:  { btn: "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",   badge: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400" },
    violet:  { btn: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-400",   badge: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400" },
    rose:    { btn: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-400",               badge: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400" },
    sky:     { btn: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-400",                     badge: "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400" },
    lime:    { btn: "border-lime-300 bg-lime-50 text-lime-700 dark:border-lime-700 dark:bg-lime-900/30 dark:text-lime-400",               badge: "bg-lime-100 dark:bg-lime-900/40 text-lime-700 dark:text-lime-400" },
    amber:   { btn: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400",         badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400" },
    emerald: { btn: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" },
    fuchsia: { btn: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400", badge: "bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-400" },
    slate:   { btn: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400",         badge: "bg-slate-100 dark:bg-slate-900/40 text-slate-700 dark:text-slate-400" },
    gray:    { btn: "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400",               badge: "bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-400" },
};

export function statusBadgeClasses(color: string): string {
    return (COLOR_MAP[color] ?? COLOR_MAP.gray).badge;
}

// ─── Comments tab ─────────────────────────────────────────────────────────────
const ORDER_STATUS_LOCK: Record<string, { label: string; cls: string }> = {
    in_progress: { label: "Заказ доставляется — обновление статуса недоступно",        cls: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300" },
    delivered:   { label: "Заказ доставлен — обновление статуса недоступно",          cls: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" },
    cancelled:   { label: "Заказ отменён — обновление статуса недоступно",            cls: "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300" },
    deleted:     { label: "Корзина удалена клиентом — обновление статуса недоступно", cls: "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400" },
};

function CommentsTab({ cart, token, username, statuses, isAdmin, onStatusCreated, orderStatus }: {
    cart: UserCart;
    token: string;
    username: string;
    statuses: CartStatus[];
    isAdmin: boolean;
    onStatusCreated: (s: CartStatus) => void;
    orderStatus: string;
}) {
    const [comments, setComments] = useState<CartComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<string>("");
    const [saving, setSaving] = useState(false);
    const [addingStatus, setAddingStatus] = useState(false);
    const [newStatusLabel, setNewStatusLabel] = useState("");
    const [creatingStatus, setCreatingStatus] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const newStatusInputRef = useRef<HTMLInputElement>(null);

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

    useEffect(() => {
        if (addingStatus) setTimeout(() => newStatusInputRef.current?.focus(), 50);
    }, [addingStatus]);

    const canSend = selectedStatus !== "";

    const handleSend = async () => {
        if (!canSend) return;
        setSaving(true);
        try {
            const added = await addCartComment(token, cart.id, text.trim(), username, selectedStatus);
            setComments((prev) => [...prev, added]);
            setText("");
            toast.success("Комментарий добавлен");
        } catch {
            toast.error("Ошибка при добавлении комментария");
        } finally {
            setSaving(false);
        }
    };

    const handleCreateStatus = async () => {
        if (!newStatusLabel.trim()) return;
        setCreatingStatus(true);
        try {
            const created = await createCartStatus(token, newStatusLabel.trim(), username);
            onStatusCreated(created);
            setSelectedStatus(created.value);
            setNewStatusLabel("");
            setAddingStatus(false);
            toast.success(`Статус «${created.label}» создан`);
        } catch {
            toast.error("Ошибка при создании статуса");
        } finally {
            setCreatingStatus(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend();
    };

    return (
        <div className="flex flex-col gap-4">
            {/* History */}
            <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
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
                    comments.map((c) => {
                        const s = c.status ? statuses.find((x: CartStatus) => x.value === c.status) : null;
                        return (
                            <div key={c.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-700">
                                {s && (
                                    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full mb-2 ${statusBadgeClasses(s.color)}`}>
                                        {s.label}
                                    </span>
                                )}
                                {c.text && <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{c.text}</p>}
                                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 dark:text-gray-500">
                                    <User className="h-3 w-3 shrink-0" />
                                    <span className="font-medium text-gray-500 dark:text-gray-400">{c.created_by}</span>
                                    <span>·</span>
                                    <span>{format(new Date(c.created_at), "dd.MM.yyyy HH:mm")}</span>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* Locked banner when order is in delivery state */}
            {orderStatus !== "pending" && ORDER_STATUS_LOCK[orderStatus] && (
                <div className={`rounded-lg border px-4 py-3 text-xs font-medium flex items-center gap-2 ${ORDER_STATUS_LOCK[orderStatus].cls}`}>
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    {ORDER_STATUS_LOCK[orderStatus].label}
                </div>
            )}

            {/* Input — hidden when order is in delivery state */}
            {(orderStatus === "pending" || !ORDER_STATUS_LOCK[orderStatus]) && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex flex-col gap-2">
                {/* Status selector */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Статус</span>
                    <div className="flex gap-2 flex-wrap items-center">
                        {statuses.map((s) => {
                            const cls = (COLOR_MAP[s.color] ?? COLOR_MAP.gray).btn;
                            const isSelected = selectedStatus === s.value;
                            return (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setSelectedStatus(isSelected ? "" : s.value)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                        isSelected
                                            ? cls + " ring-2 ring-offset-1 ring-current"
                                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                                    }`}
                                >
                                    {s.label}
                                </button>
                            );
                        })}

                        {/* Admin: add new status */}
                        {isAdmin && !addingStatus && (
                            <button
                                type="button"
                                onClick={() => setAddingStatus(true)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-400 dark:text-gray-500 hover:border-purple-400 hover:text-purple-500 transition-all"
                            >
                                <Plus className="h-3 w-3" />
                                Новый
                            </button>
                        )}

                        {/* Inline new status form */}
                        {isAdmin && addingStatus && (
                            <div className="flex items-center gap-1.5 mt-1 w-full">
                                <input
                                    ref={newStatusInputRef}
                                    type="text"
                                    value={newStatusLabel}
                                    onChange={(e) => setNewStatusLabel(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateStatus(); if (e.key === "Escape") { setAddingStatus(false); setNewStatusLabel(""); } }}
                                    placeholder="Название статуса..."
                                    className="flex-1 px-2.5 py-1.5 text-xs border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-purple-400"
                                />
                                <button
                                    type="button"
                                    onClick={handleCreateStatus}
                                    disabled={creatingStatus || !newStatusLabel.trim()}
                                    className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white transition-colors"
                                >
                                    {creatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setAddingStatus(false); setNewStatusLabel(""); }}
                                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <XIcon className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    placeholder="Комментарий (необязательно)"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400 resize-none"
                />
                <div className="flex justify-end">
                    <Button onClick={handleSend} disabled={saving || !canSend} size="sm" className="gap-1.5">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Применить
                    </Button>
                </div>
            </div>
            )}
        </div>
    );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function UserCartModal({ cart, isOpen, onClose, initialTab = "cart", t }: UserCartModalProps) {
    const { token, user, role } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);
    const [statuses, setStatuses] = useState<CartStatus[]>([]);

    useEffect(() => {
        if (!token) return;
        getCartStatuses(token).then(setStatuses).catch(() => {});
    }, [token]);

    useEffect(() => {
        if (isOpen) setActiveTab(initialTab);
    }, [isOpen, initialTab]);

    const isAdmin = role === "ROLE_ADMIN";

    if (!cart) return null;

    const displayName = [cart.customer_first_name, cart.customer_last_name].filter(Boolean).join(" ") || cart.customer_phone;

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: "cart",     label: "Корзина",      icon: <ShoppingCart className="h-4 w-4" /> },
        { id: "map",      label: "Карта",         icon: <Map className="h-4 w-4" /> },
        { id: "comments", label: "Комментарии",   icon: <MessageSquare className="h-4 w-4" /> },
    ];

    const subtotal = cart.invoice_market_total + cart.invoice_delivery_total + cart.invoice_service_total;
    const discount = subtotal - cart.invoice_total;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0"
                onInteractOutside={(e: Event) => {
                    // When ymaps enters fullscreen it adds "ymaps-*-fullscreen" class to <body>
                    // and appends <ymaps> outside Dialog DOM — Radix closes dialog on any click.
                    // Prevent closing while ymaps fullscreen is active.
                    const isYmapsFullscreen = Array.from(document.body.classList).some(
                        (cls) => cls.startsWith("ymaps-") && cls.endsWith("-fullscreen")
                    );
                    if (isYmapsFullscreen) { e.preventDefault(); return; }

                    const target = (e as any).detail?.originalEvent?.target as Element ?? e.target as Element;
                    if (target?.tagName?.toLowerCase() === "ymaps" || target?.closest?.("ymaps")) {
                        e.preventDefault();
                    }
                }}
            >
                {/* Header */}
                <DialogHeader className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <DialogTitle className="flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-gray-100">
                        <ShoppingCart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        {t.userCarts} #{cart.id}
                        {cart.order_code && (
                            <span className="text-sm font-medium text-gray-400 dark:text-gray-500">· {cart.order_code}</span>
                        )}
                        {(() => {
                            const s = statuses.find((x: CartStatus) => x.value === cart.cart_status);
                            return (
                                <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-normal ${statusBadgeClasses(s?.color ?? "gray")}`}>
                                    {s?.label ?? cart.cart_status}
                                </span>
                            );
                        })()}
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
                                                                    className="w-24 h-24 rounded-xl object-contain border border-gray-100 dark:border-gray-700 bg-white shrink-0 p-1"
                                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                                />
                                                            ) : (
                                                                <div className="w-24 h-24 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                                                    <Package className="h-8 w-8 text-gray-300 dark:text-gray-600" />
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
                            statuses={statuses}
                            isAdmin={isAdmin}
                            onStatusCreated={(s) => setStatuses((prev: CartStatus[]) => [...prev, s])}
                            orderStatus={cart.order_status ?? "pending"}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
