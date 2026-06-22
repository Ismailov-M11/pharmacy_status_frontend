import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserCart, CartItem } from "@/lib/userCartApi";
import { format } from "date-fns";
import { User, Store, Tag, MapPin, Phone, Package, ShoppingCart, CheckCircle, Clock, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UserCartModalProps {
    cart: UserCart | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdateComment: (cartId: number, comment: string) => Promise<UserCart>;
    t: Record<string, string>;
}

function formatSum(n: number): string {
    return Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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

export function UserCartModal({ cart, isOpen, onClose, onUpdateComment, t }: UserCartModalProps) {
    const [comment, setComment] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (cart) setComment(cart.comment ?? "");
    }, [cart?.id]);

    if (!cart) return null;

    const displayName = [cart.customer_first_name, cart.customer_last_name].filter(Boolean).join(" ") || cart.customer_phone;
    const isProcessed = cart.cart_status === "processed";

    const handleSaveComment = async () => {
        setIsSaving(true);
        try {
            await onUpdateComment(cart.id, comment);
            toast.success(t.saveComment || "Сохранено");
        } catch {
            toast.error(t.error || "Ошибка");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-xl font-bold text-gray-900 dark:text-gray-100">
                        <ShoppingCart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        {t.userCarts} #{cart.id}
                    </DialogTitle>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(cart.creation_date), "dd.MM.yyyy HH:mm")}
                        </span>
                        {cart.source && (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                {cart.source}
                            </span>
                        )}
                        {isProcessed ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                                <CheckCircle className="h-3 w-3" />
                                {t.processed}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400">
                                <Clock className="h-3 w-3" />
                                {t.unprocessed}
                            </span>
                        )}
                    </div>
                </DialogHeader>

                <div className="space-y-5 mt-2">

                    {/* Customer */}
                    <Section icon={<User className="h-4 w-4" />} title={t.customer}>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-1">
                            <InfoRow label={t.name} value={displayName} />
                            <InfoRow label={t.phone} value={
                                <a href={`tel:${cart.customer_phone}`} className="text-purple-600 dark:text-purple-400 hover:underline">
                                    {cart.customer_phone}
                                </a>
                            } />
                        </div>
                    </Section>

                    {/* Pharmacy */}
                    <Section icon={<Store className="h-4 w-4" />} title={t.pharmacyName}>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-1">
                            <InfoRow label={t.pharmacyName} value={cart.market_name} />
                            <InfoRow label={t.address} value={cart.market_address} />
                            {cart.market_landmark && (
                                <InfoRow label={t.landmark} value={
                                    <span className="flex items-center gap-1 justify-end">
                                        <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                        {cart.market_landmark}
                                    </span>
                                } />
                            )}
                            {cart.market_phone && (
                                <InfoRow label={t.pharmacyPhone} value={
                                    <a href={`tel:${cart.market_phone}`} className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 justify-end">
                                        <Phone className="h-3.5 w-3.5 shrink-0" />
                                        {cart.market_phone}
                                    </a>
                                } />
                            )}
                        </div>
                    </Section>

                    {/* Items */}
                    <Section icon={<Package className="h-4 w-4" />} title={t.expandItems}>
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                                        <th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.productName}</th>
                                        <th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap hidden sm:table-cell">{t.manufacturer}</th>
                                        <th className="text-center py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.quantity}</th>
                                        <th className="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.price}</th>
                                        <th className="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.total}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(cart.items as CartItem[]).map((item, i) => (
                                        <tr key={item.id} className={`border-b border-gray-100 dark:border-gray-800 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-gray-800/30"}`}>
                                            <td className="py-2.5 px-3 text-gray-900 dark:text-gray-100 font-medium">
                                                {item.name}
                                                <p className="text-xs text-gray-400 dark:text-gray-500 font-normal mt-0.5 sm:hidden">{item.manufacturer}</p>
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
                    <Section icon={<Tag className="h-4 w-4" />} title={t.grandTotal}>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-1">
                            <InfoRow label={t.marketTotal} value={`${formatSum(cart.invoice_market_total)} ${t.sum}`} />
                            <InfoRow label={t.deliveryFee} value={`${formatSum(cart.invoice_delivery_total)} ${t.sum}`} />
                            <InfoRow label={t.serviceFee} value={
                                <span className="text-gray-500 dark:text-gray-400">{formatSum(cart.invoice_service_total)} {t.sum}</span>
                            } />
                            {cart.invoice_promo_code && (
                                <InfoRow label={t.promoCode} value={
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400">
                                        <Tag className="h-2.5 w-2.5" />
                                        {cart.invoice_promo_code}
                                    </span>
                                } />
                            )}
                            <div className="flex items-center justify-between py-2 mt-1 border-t border-gray-200 dark:border-gray-700">
                                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{t.grandTotal}</span>
                                <span className="font-bold text-lg text-purple-600 dark:text-purple-400">
                                    {formatSum(cart.invoice_total)} {t.sum}
                                </span>
                            </div>
                        </div>
                    </Section>

                    {/* Comment */}
                    <Section icon={<MessageSquare className="h-4 w-4" />} title={t.comment}>
                        <div className="space-y-3">
                            <textarea
                                value={comment}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
                                rows={3}
                                placeholder={`${t.comment}...`}
                                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-purple-400 resize-none"
                            />
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
                                    {cart.comment_by && (
                                        <p>{t.commentBy}: <span className="font-medium text-gray-600 dark:text-gray-300">{cart.comment_by}</span></p>
                                    )}
                                    {cart.comment_at && (
                                        <p>{t.commentDate}: <span className="font-medium text-gray-600 dark:text-gray-300">{format(new Date(cart.comment_at), "dd.MM.yyyy HH:mm")}</span></p>
                                    )}
                                </div>
                                <Button
                                    size="sm"
                                    onClick={handleSaveComment}
                                    disabled={isSaving}
                                    className="gap-1.5 shrink-0"
                                >
                                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                    {t.saveComment}
                                </Button>
                            </div>
                        </div>
                    </Section>

                </div>
            </DialogContent>
        </Dialog>
    );
}
