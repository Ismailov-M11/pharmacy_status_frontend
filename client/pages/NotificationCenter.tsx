import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Filter,
  X,
  User,
  Smartphone,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchNotifications,
  fetchCampaigns,
  createCampaign,
  sendCampaign,
  extractNotifications,
  extractNotificationTotal,
  extractCampaigns,
  extractCampaignTotal,
  Notification,
  Campaign,
  DEV_API_BASE_URL,
  PROD_API_BASE_URL,
} from "@/lib/notificationApi";

const PAGE_SIZE = 20;

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-gray-400">—</span>;

  const map: Record<string, { label: string; dot: string; className: string; animate?: boolean }> = {
    ACTIVE: {
      label: "Активен",
      dot: "bg-green-500",
      className: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-800",
    },
    INACTIVE: {
      label: "Неактивен",
      dot: "bg-gray-400",
      className: "bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400 border border-gray-200 dark:border-gray-600",
    },
    SENT: {
      label: "Отправлен",
      dot: "bg-blue-500",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
    },
    COMPLETED: {
      label: "Завершён",
      dot: "bg-teal-500",
      className: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300 border border-teal-200 dark:border-teal-800",
    },
    PENDING: {
      label: "В ожидании",
      dot: "bg-yellow-500",
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800",
    },
    PROCESSING: {
      label: "Обрабатывается",
      dot: "bg-amber-500",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
      animate: true,
    },
    SENDING: {
      label: "Отправляется",
      dot: "bg-blue-400",
      className: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
      animate: true,
    },
    IN_PROGRESS: {
      label: "В процессе",
      dot: "bg-orange-500",
      className: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border border-orange-200 dark:border-orange-800",
      animate: true,
    },
    FAILED: {
      label: "Ошибка",
      dot: "bg-red-500",
      className: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800",
    },
    DRAFT: {
      label: "Черновик",
      dot: "bg-purple-400",
      className: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800",
    },
    CANCELLED: {
      label: "Отменён",
      dot: "bg-gray-400",
      className: "bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400 border border-gray-200 dark:border-gray-600",
    },
  };

  const config = map[status.toUpperCase()] ?? {
    label: status,
    dot: "bg-gray-400",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-300 border border-gray-200 dark:border-gray-600",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot} ${config.animate ? "animate-pulse" : ""}`} />
      {config.label}
    </span>
  );
}

// ─── Format date ──────────────────────────────────────────────────────────────

function formatDate(str?: string): string {
  if (!str) return "—";
  try {
    return new Date(str).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return str;
  }
}

// ─── Pagination Controls ──────────────────────────────────────────────────────

function PaginationBar({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        Страница {page + 1} из {totalPages} · всего {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={page >= totalPages - 1}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
      <AlertCircle className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Create Campaign Modal ─────────────────────────────────────────────────────

interface CreateCampaignModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (campaignId?: number) => void;
  token: string;
  baseUrl: string;
}

function CreateCampaignModal({
  open,
  onClose,
  onCreated,
  token,
  baseUrl,
}: CreateCampaignModalProps) {
  const [form, setForm] = useState({
    title: "",
    titleRu: "",
    body: "",
    bodyRu: "",
  });
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["PUSH", "TG"]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── "Copy from existing" section ──────────────────────────────────────────
  const [showExisting, setShowExisting] = useState(false);
  const [existingSearch, setExistingSearch] = useState("");
  const [existingItems, setExistingItems] = useState<Campaign[]>([]);
  const [existingLoading, setExistingLoading] = useState(false);

  useEffect(() => {
    if (!showExisting || !open) return;
    let cancelled = false;
    setExistingLoading(true);
    fetchCampaigns(token, { page: 0, size: 50, searchKey: existingSearch || undefined }, baseUrl)
      .then((data) => { if (!cancelled) setExistingItems(extractCampaigns(data)); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setExistingLoading(false); });
    return () => { cancelled = true; };
  }, [showExisting, existingSearch, open, token, baseUrl]);

  const handleCopyFrom = (campaign: Campaign) => {
    setForm({
      title: campaign.title ?? "",
      titleRu: campaign.titleRu ?? "",
      body: campaign.body ?? "",
      bodyRu: campaign.bodyRu ?? "",
    });
    setShowExisting(false);
    setExistingSearch("");
  };
  // ──────────────────────────────────────────────────────────────────────────

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.titleRu.trim()) {
      toast.error("Заполните заголовок на обоих языках");
      return;
    }
    if (!form.body.trim() || !form.bodyRu.trim()) {
      toast.error("Заполните текст уведомления на обоих языках");
      return;
    }
    if (selectedTypes.length === 0) {
      toast.error("Выберите хотя бы один тип кампании");
      return;
    }

    setIsSubmitting(true);
    try {
      const results = await Promise.all(
        selectedTypes.map((type) =>
          createCampaign(token, {
            type,
            title: form.title,
            titleRu: form.titleRu,
            body: form.body,
            bodyRu: form.bodyRu,
            source: "HAMBI",
          }, baseUrl)
        )
      );
      const firstId: number | undefined =
        results[0]?.payload?.id ?? results[0]?.id ?? undefined;
      setForm({ title: "", titleRu: "", body: "", bodyRu: "" });
      setSelectedTypes(["PUSH", "TG"]);
      setShowExisting(false);
      setExistingSearch("");
      onClose();
      onCreated(firstId);
    } catch (err: any) {
      toast.error(`Ошибка при создании: ${err?.message ?? "Неизвестная ошибка"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setForm({ title: "", titleRu: "", body: "", bodyRu: "" });
    setSelectedTypes(["PUSH", "TG"]);
    setShowExisting(false);
    setExistingSearch("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg dark:bg-gray-800 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            Создать кампанию
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type selection */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Тип кампании</span>
            <div className="flex gap-4">
              {(["PUSH", "TG"] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(t)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTypes((prev) => [...prev, t]);
                      } else {
                        setSelectedTypes((prev) => prev.filter((x) => x !== t));
                      }
                    }}
                    className="w-4 h-4 accent-purple-600 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Copy from existing */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowExisting((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-purple-500" />
                Выбрать из существующих кампаний
              </span>
              <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full transition-colors ${showExisting ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}>
                {showExisting ? (
                  <><ChevronUp className="h-3 w-3" />Скрыть</>
                ) : (
                  <><ChevronDown className="h-3 w-3" />Открыть</>
                )}
              </span>
            </button>

            {showExisting && (
              <div className="border-t border-gray-200 dark:border-gray-700">
                {/* Search bar */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Поиск по названию..."
                      value={existingSearch}
                      onChange={(e) => setExistingSearch(e.target.value)}
                      className="pl-9 h-9 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                    {existingSearch && (
                      <button
                        type="button"
                        onClick={() => setExistingSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Campaign cards */}
                <div className="max-h-64 overflow-y-auto p-2 space-y-1.5">
                  {existingLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-sm text-gray-400 gap-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-purple-400" />
                      <span>Загрузка кампаний...</span>
                    </div>
                  ) : existingItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-sm text-gray-400 gap-2">
                      <Megaphone className="h-5 w-5 text-gray-300" />
                      <span>{existingSearch ? "Ничего не найдено" : "Нет кампаний"}</span>
                    </div>
                  ) : (
                    existingItems.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleCopyFrom(c)}
                        className="w-full text-left rounded-lg border border-transparent hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="shrink-0 w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center mt-0.5">
                              <Megaphone className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="min-w-0">
                              {/* RU title */}
                              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate leading-tight">
                                {c.titleRu || c.title || `Кампания #${c.id}`}
                              </div>
                              {/* UZ title if different */}
                              {c.title && c.titleRu && c.title !== c.titleRu && (
                                <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                  {c.title}
                                </div>
                              )}
                              {/* Body preview */}
                              {(c.bodyRu || c.body) && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                                  {c.bodyRu || c.body}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 self-center text-xs font-medium px-2.5 py-1 rounded-full bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                            Выбрать
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {existingItems.length > 0 && (
                  <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 text-center text-xs text-gray-400">
                    {existingItems.length} кампаний · нажмите на карточку для выбора
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Title UZ */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Заголовок (UZ)
            </label>
            <Input
              placeholder="Sarlavha..."
              value={form.title}
              onChange={(e) => handleChange("title", e.target.value)}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>

          {/* Title RU */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Заголовок (RU)
            </label>
            <Input
              placeholder="Заголовок..."
              value={form.titleRu}
              onChange={(e) => handleChange("titleRu", e.target.value)}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>

          {/* Body UZ */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Текст уведомления (UZ)
            </label>
            <textarea
              placeholder="Xabar matni..."
              value={form.body}
              onChange={(e) => handleChange("body", e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          {/* Body RU */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Текст уведомления (RU)
            </label>
            <textarea
              placeholder="Текст сообщения..."
              value={form.bodyRu}
              onChange={(e) => handleChange("bodyRu", e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="dark:border-gray-600 dark:text-gray-300"
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isSubmitting ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

interface NotifFilters {
  searchKey: string;
  status: string;
  campaignId: string;
  fromDate: string;
  toDate: string;
}

const EMPTY_NOTIF_FILTERS: NotifFilters = {
  searchKey: "",
  status: "",
  campaignId: "",
  fromDate: "",
  toDate: "",
};

function NotificationsTab({ token, baseUrl }: { token: string; baseUrl: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  // Applied filters (trigger reload)
  const [appliedFilters, setAppliedFilters] = useState<NotifFilters>(EMPTY_NOTIF_FILTERS);
  // Draft filters (in the form)
  const [draftFilters, setDraftFilters] = useState<NotifFilters>(EMPTY_NOTIF_FILTERS);

  const hasActiveFilters =
    appliedFilters.status !== "" ||
    appliedFilters.campaignId !== "" ||
    appliedFilters.fromDate !== "" ||
    appliedFilters.toDate !== "" ||
    appliedFilters.searchKey !== "";

  const load = useCallback(
    async (p: number, filters: NotifFilters) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchNotifications(token, {
          page: p,
          size: PAGE_SIZE,
          searchKey: filters.searchKey || undefined,
          status: filters.status || undefined,
          campaignId: filters.campaignId ? Number(filters.campaignId) : undefined,
          fromDate: filters.fromDate ? new Date(filters.fromDate).toISOString() : undefined,
          toDate: filters.toDate ? new Date(filters.toDate).toISOString() : undefined,
          dateField: filters.fromDate || filters.toDate ? "processedAt" : undefined,
        }, baseUrl);
        setItems(extractNotifications(data));
        setTotal(extractNotificationTotal(data));
      } catch (err: any) {
        setError(err?.message ?? "Ошибка загрузки");
        toast.error("Не удалось загрузить уведомления");
      } finally {
        setIsLoading(false);
      }
    },
    [token, baseUrl]
  );

  useEffect(() => {
    setPage(0);
  }, [baseUrl]);

  useEffect(() => {
    load(page, appliedFilters);
  }, [page, appliedFilters, load]);

  const handleApply = () => {
    setPage(0);
    setAppliedFilters({ ...draftFilters });
  };

  const handleReset = () => {
    setDraftFilters(EMPTY_NOTIF_FILTERS);
    setAppliedFilters(EMPTY_NOTIF_FILTERS);
    setPage(0);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleApply();
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Поиск..."
            value={draftFilters.searchKey}
            onChange={(e) =>
              setDraftFilters((f) => ({ ...f, searchKey: e.target.value }))
            }
            onKeyDown={handleSearchKeyDown}
            className="pl-9 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleApply}
          className="dark:border-gray-700 dark:text-gray-300"
        >
          Найти
        </Button>
        <Button
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters((v) => !v)}
          className={
            showFilters
              ? "bg-purple-600 hover:bg-purple-700 text-white gap-1"
              : "dark:border-gray-700 dark:text-gray-300 gap-1"
          }
        >
          <Filter className="h-4 w-4" />
          Фильтры
          {hasActiveFilters && (
            <span className="ml-1 h-2 w-2 rounded-full bg-orange-400 inline-block" />
          )}
        </Button>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            title="Сбросить фильтры"
            className="text-gray-400 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => load(page, appliedFilters)}
          className="text-gray-500 dark:text-gray-400 hover:text-purple-600"
          title="Обновить"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Status */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Статус
              </label>
              <Select
                value={draftFilters.status || "ALL"}
                onValueChange={(v) =>
                  setDraftFilters((f) => ({ ...f, status: v === "ALL" ? "" : v }))
                }
              >
                <SelectTrigger className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 h-9 text-sm">
                  <SelectValue placeholder="Все статусы" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  <SelectItem value="ALL">Все статусы</SelectItem>
                  <SelectItem value="SUCCESS">SUCCESS</SelectItem>
                  <SelectItem value="FAILED">FAILED</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Campaign ID */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                ID кампании
              </label>
              <Input
                type="number"
                placeholder="Например: 40"
                value={draftFilters.campaignId}
                onChange={(e) =>
                  setDraftFilters((f) => ({ ...f, campaignId: e.target.value }))
                }
                className="h-9 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              />
            </div>

            {/* From date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Дата от
              </label>
              <Input
                type="date"
                value={draftFilters.fromDate}
                onChange={(e) =>
                  setDraftFilters((f) => ({ ...f, fromDate: e.target.value }))
                }
                className="h-9 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              />
            </div>

            {/* To date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Дата до
              </label>
              <Input
                type="date"
                value={draftFilters.toDate}
                onChange={(e) =>
                  setDraftFilters((f) => ({ ...f, toDate: e.target.value }))
                }
                className="h-9 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleApply}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Применить
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              className="dark:border-gray-600 dark:text-gray-300"
            >
              Сбросить
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 w-12">
                  №
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">
                  Кампания
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 hidden md:table-cell">
                  Получатель
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">
                  Статус
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                  Канал
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                  Обработано
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 hidden xl:table-cell">
                  Ошибка
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <SkeletonRows cols={7} />
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState message="Нет уведомлений за выбранный период" />
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const camp = item.campaign;
                  const usr = item.user;
                  const dev = item.device;
                  const channel = usr && !dev ? "user" : dev ? "device" : null;
                  return (
                    <tr
                      key={item.id ?? idx}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors cursor-pointer"
                      onClick={() => setSelectedNotification(item)}
                    >
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 tabular-nums">
                        {page * PAGE_SIZE + idx + 1}
                      </td>
                      {/* Campaign */}
                      <td className="px-4 py-3">
                        {camp ? (
                          <>
                            <div className="font-medium text-gray-900 dark:text-gray-100 max-w-[200px] truncate">
                              {camp.titleRu || camp.title || `#${camp.id}`}
                            </div>
                            {camp.titleRu && camp.title && camp.title !== camp.titleRu && (
                              <div className="text-xs text-gray-400 dark:text-gray-500 max-w-[200px] truncate">
                                {camp.title}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate mt-0.5">
                              {camp.bodyRu || camp.body || ""}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                #{camp.id}
                              </span>
                              {camp.type && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                  {camp.type}
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {/* Recipient */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {usr ? (
                          <div className="flex items-start gap-1.5">
                            <User className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                            <div>
                              {(usr.firstName || usr.lastName) && (
                                <div className="text-gray-900 dark:text-gray-100 text-xs font-medium">
                                  {[usr.firstName, usr.lastName].filter(Boolean).join(" ")}
                                </div>
                              )}
                              <div className="text-gray-500 dark:text-gray-400 text-xs">
                                {usr.phone || `#${usr.id}`}
                              </div>
                              {usr.gender && (
                                <div className="text-gray-400 dark:text-gray-500 text-xs">
                                  {usr.gender === "MALE" ? "М" : "Ж"}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : dev ? (
                          <div className="flex items-start gap-1.5">
                            <Smartphone className="h-3.5 w-3.5 text-green-400 mt-0.5 shrink-0" />
                            <div>
                              <div className="text-gray-600 dark:text-gray-400 text-xs">
                                {dev.deviceType || dev.name || "Устройство"}
                              </div>
                              {dev.token && (
                                <div
                                  className="text-gray-400 dark:text-gray-500 text-xs max-w-[160px] truncate"
                                  title={dev.token}
                                >
                                  {dev.token.slice(0, 20)}…
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status ?? undefined} />
                      </td>
                      {/* Channel */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {channel === "user" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                            <User className="h-3 w-3" /> Telegram
                          </span>
                        ) : channel === "device" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <Smartphone className="h-3 w-3" /> Mobile App
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      {/* Processed At */}
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(item.processedAt ?? undefined)}
                      </td>
                      {/* Error */}
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {item.error ? (
                          <span className="text-xs text-red-500 dark:text-red-400 max-w-[160px] truncate block" title={item.error}>
                            {item.error}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />

      <NotificationDetailModal
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
      />
    </div>
  );
}

// ─── Notification Detail Modal ────────────────────────────────────────────────

function NotificationDetailModal({
  notification,
  onClose,
}: {
  notification: Notification | null;
  onClose: () => void;
}) {
  if (!notification) return null;

  const camp = notification.campaign;
  const usr = notification.user;
  const dev = notification.device;
  const isDevice = !!dev && !usr;

  const Field = ({ label, value }: { label: string; value?: string | number | null }) =>
    value != null && value !== "" ? (
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">{label}</label>
        <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-gray-100 break-all">
          {String(value)}
        </div>
      </div>
    ) : null;

  return (
    <Dialog open={!!notification} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-0 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 [&>button]:hidden">
        {/* Header */}
        <div className={`px-6 py-5 relative ${isDevice ? "bg-gradient-to-r from-green-600 to-green-700 dark:from-green-800 dark:to-green-900" : "bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900"}`}>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full w-7 h-7 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3 pr-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 shrink-0">
              {isDevice ? <Smartphone className="h-5 w-5 text-white" /> : <User className="h-5 w-5 text-white" />}
            </div>
            <div>
              <DialogTitle className="text-white font-semibold text-base leading-tight">
                Уведомление #{notification.id}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <StatusBadge status={notification.status ?? undefined} />
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white`}>
                  {isDevice ? "Mobile App" : "Telegram"}
                </span>
                {camp?.type && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
                    {camp.type}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Кампания */}
          {camp && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
                Кампания
              </div>
              <div className="space-y-2">
                <Field label="ID" value={camp.id} />
                <Field label="Название (RU)" value={camp.titleRu} />
                <Field label="Название (UZ)" value={camp.title} />
                <Field label="Текст (RU)" value={camp.bodyRu} />
                <Field label="Текст (UZ)" value={camp.body} />
              </div>
            </div>
          )}

          {/* Получатель */}
          {(usr || dev) && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
                Получатель
              </div>
              {usr && (
                <div className="space-y-2">
                  <Field label="ID пользователя" value={usr.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Имя" value={usr.firstName} />
                    <Field label="Фамилия" value={usr.lastName} />
                  </div>
                  <Field label="Телефон" value={usr.phone} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Пол" value={usr.gender === "MALE" ? "Мужской" : usr.gender === "FEMALE" ? "Женский" : usr.gender} />
                    <Field label="Возраст" value={usr.age} />
                  </div>
                  <Field label="Дата рождения" value={usr.dateOfBirth} />
                  <Field label="Источник" value={usr.source} />
                </div>
              )}
              {dev && (
                <div className="space-y-2">
                  <Field label="Название устройства" value={dev.name} />
                  <Field label="Тип устройства" value={dev.deviceType} />
                  <Field label="Device ID" value={dev.deviceId} />
                  <Field label="Версия" value={dev.version} />
                  <Field label="Инфо" value={dev.deviceInfo} />
                  <Field label="Последний вход" value={dev.lastLoginTime ? formatDate(dev.lastLoginTime) : null} />
                  <Field label="Создано" value={dev.createdDate ? formatDate(dev.createdDate) : null} />
                  {dev.token && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Token</label>
                      <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 break-all font-mono">
                        {dev.token}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Детали отправки */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
              Детали отправки
            </div>
            <div className="space-y-2">
              <Field label="Обработано в" value={notification.processedAt ? formatDate(notification.processedAt) : null} />
              <Field label="Назначение" value={notification.destination} />
              {notification.error && (
                <div>
                  <label className="block text-xs font-medium text-red-500 mb-0.5">Ошибка</label>
                  <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 break-all">
                    {notification.error}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Campaign Detail Modal ────────────────────────────────────────────────────

function CampaignDetailModal({
  campaign,
  onClose,
}: {
  campaign: Campaign | null;
  onClose: () => void;
}) {
  if (!campaign) return null;

  const total = campaign.totalCount ?? 0;
  const success = campaign.successCount ?? 0;
  const fail = campaign.failCount ?? 0;
  const successPct = total > 0 ? Math.round((success / total) * 100) : 0;
  const failPct = total > 0 ? Math.round((fail / total) * 100) : 0;

  return (
    <Dialog open={!!campaign} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700 p-0 [&>button]:hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-800 dark:to-purple-900 px-6 py-5 relative">
          {/* X button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full w-7 h-7 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 shrink-0">
              <Megaphone className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-white font-semibold text-base leading-tight">
                {campaign.titleRu || campaign.title || `Кампания #${campaign.id}`}
              </DialogTitle>
              {campaign.titleRu && campaign.title && campaign.title !== campaign.titleRu && (
                <div className="text-purple-200 text-xs mt-0.5">{campaign.title}</div>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-purple-300 text-xs">#{campaign.id}</span>
                {campaign.type && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
                    {campaign.type}
                  </span>
                )}
                <StatusBadge status={campaign.status} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Message body */}
          {(campaign.bodyRu || campaign.body) && (
            <div className="space-y-3">
              {campaign.bodyRu && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
                    Текст (RU)
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2.5 leading-relaxed">
                    {campaign.bodyRu}
                  </div>
                </div>
              )}
              {campaign.body && campaign.body !== campaign.bodyRu && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
                    Текст (UZ)
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2.5 leading-relaxed">
                    {campaign.body}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          {total > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
                Статистика отправки
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl px-3 py-3 text-center">
                  <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{total}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Всего</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-3 text-center">
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">{success}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Успешно · {successPct}%</div>
                </div>
                <div className={`rounded-xl px-3 py-3 text-center ${fail > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-gray-50 dark:bg-gray-900/50"}`}>
                  <div className={`text-xl font-bold ${fail > 0 ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500"}`}>{fail}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ошибок · {failPct}%</div>
                </div>
              </div>

              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all"
                  style={{ width: `${successPct}%` }}
                />
              </div>

              {(campaign.tgCount != null || campaign.mobileCount != null) && (
                <div className="flex gap-3 mt-3">
                  {campaign.tgCount != null && (
                    <div className="flex-1 flex items-center gap-2 bg-sky-50 dark:bg-sky-900/20 rounded-lg px-3 py-2">
                      <div className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Telegram</span>
                      <span className="ml-auto font-semibold text-sm text-sky-600 dark:text-sky-400">{campaign.tgCount}</span>
                    </div>
                  )}
                  {campaign.mobileCount != null && (
                    <div className="flex-1 flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Mobile</span>
                      <span className="ml-auto font-semibold text-sm text-purple-600 dark:text-purple-400">{campaign.mobileCount}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Meta */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
              Информация
            </div>
            <div className="space-y-2">
              {[
                { label: "Создал", value: campaign.createdBy },
                { label: "Изменил", value: campaign.modifiedBy },
                { label: "Дата создания", value: formatDate(campaign.creationDate) },
                { label: "Последнее изменение", value: formatDate(campaign.modifiedDate) },
              ]
                .filter((r) => r.value && r.value !== "—")
                .map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{row.label}</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium">{row.value}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Campaigns Tab ────────────────────────────────────────────────────────────

const FINAL_STATUSES = new Set(["COMPLETED", "SENT", "FAILED", "CANCELLED"]);

function CampaignsTab({
  token,
  onCreateClick,
  refreshKey,
  baseUrl,
  newCampaignId,
  onCampaignFinished,
}: {
  token: string;
  onCreateClick: () => void;
  refreshKey: number;
  baseUrl: string;
  newCampaignId?: number | null;
  onCampaignFinished?: () => void;
}) {
  const { t } = useLanguage();
  const [items, setItems] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const onCampaignFinishedRef = useRef(onCampaignFinished);
  useEffect(() => { onCampaignFinishedRef.current = onCampaignFinished; }, [onCampaignFinished]);

  const load = useCallback(
    async (p: number, s: string, trackId?: number | null) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchCampaigns(token, {
          page: p,
          size: PAGE_SIZE,
          searchKey: s || undefined,
        }, baseUrl);
        const loaded = extractCampaigns(data);
        setItems(loaded);
        setTotal(extractCampaignTotal(data));

        // Stop polling when tracked campaign reaches a final status
        if (trackId != null) {
          const tracked = loaded.find((c) => c.id === trackId);
          if (tracked && tracked.status && FINAL_STATUSES.has(tracked.status.toUpperCase())) {
            onCampaignFinishedRef.current?.();
          }
        }
      } catch (err: any) {
        setError(err?.message ?? "Ошибка загрузки");
        toast.error("Не удалось загрузить кампании");
      } finally {
        setIsLoading(false);
      }
    },
    [token, baseUrl]
  );

  useEffect(() => {
    setPage(0);
  }, [baseUrl]);

  useEffect(() => {
    load(page, search, newCampaignId);
  }, [page, search, load, refreshKey, newCampaignId]);

  const handleSearch = () => {
    setPage(0);
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Поиск кампаний..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleSearch}
          className="dark:border-gray-700 dark:text-gray-300"
        >
          Найти
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => load(page, search)}
          className="text-gray-500 dark:text-gray-400 hover:text-purple-600"
          title="Обновить"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
        <div className="flex-1" />
        <Button
          onClick={onCreateClick}
          className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t.createCampaign || "Создать кампанию"}</span>
          <span className="sm:hidden">{t.createCampaign || "Создать"}</span>
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 w-12">
                  №
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">
                  Заголовок / Текст
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">
                  Статус
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 hidden md:table-cell">
                  Тип
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                  Всего
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                  Успешно
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                  Ошибок
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400 hidden xl:table-cell">
                  TG
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400 hidden xl:table-cell">
                  Mobile
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 hidden xl:table-cell">
                  Создал
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                  Дата
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <SkeletonRows cols={11} />
              ) : error ? (
                <tr>
                  <td colSpan={11} className="px-4 py-3 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <EmptyState message="Нет кампаний" />
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const isNew = newCampaignId != null && item.id === newCampaignId;
                  return (
                  <tr
                    key={item.id ?? idx}
                    onClick={() => setSelectedCampaign(item)}
                    className={`cursor-pointer ${
                      isNew
                        ? "animate-row-blink"
                        : "hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors"
                    }`}
                  >
                    <td className="py-3 text-gray-500 dark:text-gray-400 tabular-nums">
                      <div className="flex items-center">
                        {isNew && (
                          <div className="w-1 self-stretch bg-purple-500 rounded-r mr-2 shrink-0" />
                        )}
                        <span className={isNew ? "" : "px-4"}>
                          {isNew ? (
                            <span className="pl-0 pr-4">{page * PAGE_SIZE + idx + 1}</span>
                          ) : (
                            page * PAGE_SIZE + idx + 1
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100 max-w-[220px] truncate">
                        {item.titleRu || item.title || "—"}
                      </div>
                      {item.titleRu && item.title && item.title !== item.titleRu && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 max-w-[220px] truncate">
                          {item.title}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 dark:text-gray-400 max-w-[220px] truncate mt-0.5">
                        {item.bodyRu || item.body || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {item.type || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {item.totalCount ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {item.successCount ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className={`font-semibold ${(item.failCount ?? 0) > 0 ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500"}`}>
                        {item.failCount ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden xl:table-cell text-gray-600 dark:text-gray-400">
                      {item.tgCount ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center hidden xl:table-cell text-gray-600 dark:text-gray-400">
                      {item.mobileCount ?? "—"}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-gray-500 dark:text-gray-400 text-xs">
                      {item.createdBy || "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                      {formatDate(item.creationDate || item.createdAt)}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />

      <CampaignDetailModal
        campaign={selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NotificationCenter() {
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [campaignRefreshKey, setCampaignRefreshKey] = useState(0);
  const [env, setEnv] = useState<"dev" | "prod">("dev");
  const baseUrl = env === "dev" ? DEV_API_BASE_URL : PROD_API_BASE_URL;

  // ── Campaign creation progress tracking ──────────────────────────────────
  const [activeCampaignId, setActiveCampaignId] = useState<number | null>(null);
  const [creationProgress, setCreationProgress] = useState(0);
  const creationProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopCampaignTracking = useCallback((success = true) => {
    if (creationProgressRef.current) clearInterval(creationProgressRef.current);
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    setCreationProgress(success ? 100 : 0);
    setTimeout(() => {
      setActiveCampaignId(null);
      setCreationProgress(0);
    }, 2000);
  }, []);

  const startCampaignTracking = useCallback((campaignId?: number) => {
    // Clear previous if any
    if (creationProgressRef.current) clearInterval(creationProgressRef.current);
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);

    setActiveCampaignId(campaignId ?? null);
    setCreationProgress(5);

    // Fake progress animation up to 90%
    let cur = 5;
    creationProgressRef.current = setInterval(() => {
      cur += Math.random() * 2.5 + 0.5;
      if (cur >= 90) { cur = 90; clearInterval(creationProgressRef.current!); }
      setCreationProgress(Math.round(cur));
    }, 600);

    // Auto-refresh table every 3 seconds
    pollingRef.current = setInterval(() => {
      setCampaignRefreshKey((k) => k + 1);
    }, 3000);

    // Auto-stop after 60 seconds
    stopTimeoutRef.current = setTimeout(() => stopCampaignTracking(true), 60000);
  }, [stopCampaignTracking]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) navigate("/login");
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <span className="text-gray-500">{t.loading}</span>
      </div>
    );
  }

  if (!token) return null;

  const handleCampaignCreated = (campaignId?: number) => {
    setCampaignRefreshKey((k) => k + 1);
    toast.success("Кампания успешно создана");
    startCampaignTracking(campaignId);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Header />

      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900">
                <Bell className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {t.notificationCenter || "Центр уведомлений"}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t.notificationCenterDescription || "Управление уведомлениями и рекламными кампаниями"}
                </p>
              </div>
            </div>

            {/* Dev / Prod toggle */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setEnv("dev")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  env === "dev"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                DEV
              </button>
              <button
                onClick={() => setEnv("prod")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  env === "prod"
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                PROD
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="notifications" className="space-y-4">
          <TabsList className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <TabsTrigger
              value="notifications"
              className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300"
            >
              <Bell className="h-4 w-4" />
              {t.notifications || "Уведомления"}
            </TabsTrigger>
            <TabsTrigger
              value="campaigns"
              className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300"
            >
              <Megaphone className="h-4 w-4" />
              {t.campaigns || "Кампании"}
            </TabsTrigger>
          </TabsList>

          {/* Campaign creation progress bar */}
          {activeCampaignId != null && (
            <div className="w-full bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl px-5 py-3 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-semibold">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  {creationProgress < 90
                    ? "Кампания создана — идёт отправка уведомлений..."
                    : creationProgress === 100
                    ? "Отправка завершена!"
                    : "Завершение отправки..."}
                  {activeCampaignId > 0 && (
                    <span className="text-purple-400 dark:text-purple-500 font-normal">
                      #{activeCampaignId}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-purple-800 dark:text-purple-300 tabular-nums">
                    {creationProgress}%
                  </span>
                  <button
                    onClick={() => stopCampaignTracking(true)}
                    className="text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
                    title="Скрыть"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="w-full bg-purple-200 dark:bg-purple-800/50 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-2.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-400 dark:from-purple-400 dark:to-purple-300 transition-all duration-700 ease-out"
                  style={{ width: `${Math.max(creationProgress, 3)}%` }}
                />
              </div>
              <div className="flex items-center gap-1 text-[11px] text-purple-500 dark:text-purple-400">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 dark:bg-purple-500 animate-pulse inline-block" />
                Таблица обновляется автоматически каждые 3 секунды
              </div>
            </div>
          )}

          <TabsContent value="notifications">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 md:p-6">
              <NotificationsTab token={token} baseUrl={baseUrl} />
            </div>
          </TabsContent>

          <TabsContent value="campaigns">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 md:p-6">
              <CampaignsTab
                token={token}
                baseUrl={baseUrl}
                onCreateClick={() => setIsCreateModalOpen(true)}
                refreshKey={campaignRefreshKey}
                newCampaignId={activeCampaignId}
                onCampaignFinished={() => stopCampaignTracking(true)}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <CreateCampaignModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(id) => handleCampaignCreated(id)}
        token={token}
        baseUrl={baseUrl}
      />
    </div>
  );
}
