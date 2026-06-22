import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { DraftOrder } from "@/lib/draftOrderApi";
import { format } from "date-fns";
import { User, Store, Tag, MapPin, Phone, Package, ShoppingCart } from "lucide-react";

interface UserCartModalProps {
    order: DraftOrder | null;
    isOpen: boolean;
    onClose: () => void;
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

export function UserCartModal({ order, isOpen, onClose }: UserCartModalProps) {
    const { t } = useLanguage();

    if (!order) return null;

    const customerDisplayName = [order.customer.firstName, order.customer.lastName]
        .filter(Boolean)
        .join(" ") || order.customer.phone;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-xl font-bold text-gray-900 dark:text-gray-100">
                        <ShoppingCart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        {t.userCarts} #{order.id}
                    </DialogTitle>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {format(new Date(order.creationDate), "dd.MM.yyyy HH:mm")}
                        <span className="ml-3 text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {order.source}
                        </span>
                    </p>
                </DialogHeader>

                <div className="space-y-5 mt-2">

                    {/* Customer */}
                    <Section icon={<User className="h-4 w-4" />} title={t.customer}>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-1">
                            <InfoRow label={t.name} value={customerDisplayName} />
                            <InfoRow label={t.phone} value={
                                <a href={`tel:${order.customer.phone}`} className="text-purple-600 dark:text-purple-400 hover:underline">
                                    {order.customer.phone}
                                </a>
                            } />
                        </div>
                    </Section>

                    {/* Pharmacy */}
                    <Section icon={<Store className="h-4 w-4" />} title={t.pharmacyName}>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-1">
                            <InfoRow label={t.pharmacyName} value={order.market.name} />
                            <InfoRow label={t.address} value={order.market.address} />
                            {order.market.landmark && (
                                <InfoRow label={t.landmark} value={
                                    <span className="flex items-center gap-1 justify-end">
                                        <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                        {order.market.landmark}
                                    </span>
                                } />
                            )}
                            <InfoRow label={t.pharmacyPhone} value={
                                <a href={`tel:${order.market.phone}`} className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 justify-end">
                                    <Phone className="h-3.5 w-3.5 shrink-0" />
                                    {order.market.phone}
                                </a>
                            } />
                        </div>
                    </Section>

                    {/* Items */}
                    <Section icon={<Package className="h-4 w-4" />} title={t.expandItems}>
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                                        <th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                            {t.productName}
                                        </th>
                                        <th className="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap hidden sm:table-cell">
                                            {t.manufacturer}
                                        </th>
                                        <th className="text-center py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                            {t.quantity}
                                        </th>
                                        <th className="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                            {t.price}
                                        </th>
                                        <th className="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                            {t.total}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.items.map((item, i) => (
                                        <tr
                                            key={item.id}
                                            className={`border-b border-gray-100 dark:border-gray-800 last:border-0 ${
                                                i % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-gray-800/30"
                                            }`}
                                        >
                                            <td className="py-2.5 px-3 text-gray-900 dark:text-gray-100 font-medium">
                                                {item.name}
                                                <p className="text-xs text-gray-400 dark:text-gray-500 font-normal mt-0.5 sm:hidden">
                                                    {item.manufacturer}
                                                </p>
                                            </td>
                                            <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell">
                                                {item.manufacturer}
                                            </td>
                                            <td className="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">
                                                {item.quantity}
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                {formatSum(item.price)} {t.sum}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                {formatSum(item.total)} {t.sum}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Section>

                    {/* Invoice */}
                    <Section icon={<Tag className="h-4 w-4" />} title={t.grandTotal}>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-1">
                            <InfoRow label={t.marketTotal} value={`${formatSum(order.invoice.marketTotal)} ${t.sum}`} />
                            <InfoRow label={t.deliveryFee} value={`${formatSum(order.invoice.deliveryTotal)} ${t.sum}`} />
                            <InfoRow label={t.serviceFee} value={
                                <span className="text-gray-500 dark:text-gray-400">
                                    {formatSum(order.invoice.serviceTotal)} {t.sum}
                                </span>
                            } />
                            {order.invoice.promoCode && (
                                <InfoRow label={t.promoCode} value={
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400">
                                        <Tag className="h-2.5 w-2.5" />
                                        {order.invoice.promoCode.code}
                                    </span>
                                } />
                            )}
                            <div className="flex items-center justify-between py-2 mt-1 border-t border-gray-200 dark:border-gray-700">
                                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{t.grandTotal}</span>
                                <span className="font-bold text-lg text-purple-600 dark:text-purple-400">
                                    {formatSum(order.invoice.total)} {t.sum}
                                </span>
                            </div>
                        </div>
                    </Section>

                </div>
            </DialogContent>
        </Dialog>
    );
}
