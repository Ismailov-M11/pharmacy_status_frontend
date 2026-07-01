import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  List,
  Map,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Phone,
  Clock,
  MapPin,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Eye,
  Info,
  Percent,
  BadgeCheck,
  Navigation,
  Download,
  FilterX,
  Sparkles,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  getOsonPharmacies,
  getOsonStats,
  getOsonFilterOptions,
  triggerOsonSync,
  getOsonSyncStatus,
  OsonPharmacy,
  OsonStats,
  OsonSyncStatus,
  OsonFilterOptions,
  OsonStatus,
  OsonProgress,
} from "@/lib/osonApi";

// ─── Map coordinates ─────────────────────────────────────────────────────────────────────
const UZBEKISTAN_CENTER = [41.2995, 69.2401];

declare global {
  interface Window {
    ymaps: any;
  }
}

// ─── Status Helpers ─────────────────────────────────────────────────────────────────────────

function getStatusLabel(status: OsonStatus, lang: string): string {
  const labels: Record<OsonStatus, Record<string, string>> = {
    connected: { ru: "Подключён", uz: "Ulangan" },
    not_connected: { ru: "Не подключён", uz: "Ulanmagan" },
    deleted: { ru: "Удалён", uz: "O'chirilgan" },
    new: { ru: "Новый", uz: "Yangi" },
  };
  return labels[status]?.[lang] || labels[status]?.["ru"] || status;
}

function getStatusColor(status: OsonStatus): string {
  switch (status) {
    case "connected":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "not_connected":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "deleted":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "new":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusIcon(status: OsonStatus) {
  switch (status) {
    case "connected":
      return <CheckCircle className="h-3 w-3" />;
    case "not_connected":
      return <AlertCircle className="h-3 w-3" />;
    case "deleted":
      return <XCircle className="h-3 w-3" />;
    case "new":
      return <Sparkles className="h-3 w-3" />;
  }
}


function getMarkerColor(status: OsonStatus): string {
  switch (status) {
    case "connected":
      return "islands#greenDotIcon";
    case "not_connected":
      return "islands#orangeDotIcon";
    default:
      return "islands#grayDotIcon";
  }
}

const BASE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

// For DB-generated timestamps (last_synced_at, created_at) stored as UTC.
// Always display in Asia/Tashkent timezone regardless of browser setting.
function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const normalized = /Z|[+-]\d{2}:?\d{2}$/.test(dateStr) ? dateStr : dateStr + "Z";
    return new Date(normalized).toLocaleString("ru-RU", {
      ...BASE_FORMAT_OPTIONS,
      timeZone: "Asia/Tashkent",
    });
  } catch {
    return "—";
  }
}

// For OSON API timestamps (oson_synced_time) — stored as UTC+5 local time,
// but pg returns them as UTC-labeled (with Z). Display raw UTC value to avoid
// double-conversion. Treat 0001-01-01 (.NET DateTime.MinValue) as empty.
function formatOsonDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  if (dateStr.startsWith("0001-01-01")) return "—";
  try {
    const normalized = /Z|[+-]\d{2}:?\d{2}$/.test(dateStr) ? dateStr : dateStr + "Z";
    return new Date(normalized).toLocaleString("ru-RU", {
      ...BASE_FORMAT_OPTIONS,
      timeZone: "UTC",
    });
  } catch {
    return "—";
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────────────────

type ViewTab = "list" | "map";

export default function OsonList() {
  const { language } = useLanguage();
  const { token, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  // View state
  const [activeTab, setActiveTab] = useState<ViewTab>("list");

  // Data state
  const [pharmacies, setPharmacies] = useState<OsonPharmacy[]>([]);
  const [filterOptions, setFilterOptions] = useState<OsonFilterOptions>({
    parentRegions: [],
    regions: [],
  });
  const [stats, setStats] = useState<OsonStats>({
    total: 0,
    connected: 0,
    not_connected: 0,
    deleted: 0,
    new: 0,
    lastSyncedAt: null,
  });
  const [syncStatus, setSyncStatus] = useState<OsonSyncStatus>({
    isSyncing: false,
    lastSyncAt: null,
    lastSyncError: null,
    hasToken: false,
    progress: { current: 0, total: 0, percent: 0, phase: "" },
  });

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<OsonProgress>({
    current: 0,
    total: 0,
    percent: 0,
    phase: "",
  });

  // Filter states
  const [filterStatus, setFilterStatus] = useState<(OsonStatus | "all")[]>([]);
  const [filterParentRegion, setFilterParentRegion] = useState<string[]>([]);
  const [filterRegion, setFilterRegion] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterInn, setFilterInn] = useState<string>("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Pagination
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);

  // Confirm dialog
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Map refs
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);

  // Polling ref for sync status
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Auth guard ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authLoading && !token) {
      navigate("/login");
    }
  }, [token, authLoading, navigate]);

  // ─── Load data ──────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const statusFilter =
        filterStatus.length > 0 && !filterStatus.includes("all") ? filterStatus : undefined;
      const loadSize = activeTab === "map" ? 0 : pageSize;

      const locationFilters = {
        parentRegion: filterParentRegion.length > 0 ? filterParentRegion : undefined,
        region: filterRegion.length > 0 ? filterRegion : undefined,
        search: searchQuery || undefined,
        inn: filterInn || undefined,
      };

      const [dataRes, statsData, syncData] = await Promise.all([
        getOsonPharmacies(token, {
          status: statusFilter,
          ...locationFilters,
          page: 0,
          size: loadSize,
        }),
        getOsonStats(token, locationFilters),
        getOsonSyncStatus(token),
      ]);

      setPharmacies(dataRes.data);
      setTotalCount(dataRes.total);
      setStats(statsData);
      setSyncStatus({
        isSyncing: syncData.isSyncing,
        lastSyncAt: syncData.lastSyncAt,
        lastSyncError: syncData.lastSyncError,
        hasToken: syncData.hasToken,
        progress: syncData.progress || { current: 0, total: 0, percent: 0, phase: "" },
      });
    } catch (err) {
      console.error("Failed to load OSON data:", err);
      toast.error("Не удалось загрузить данные OSON");
    } finally {
      setIsLoading(false);
    }
  }, [token, activeTab, filterParentRegion, filterRegion, searchQuery, filterInn, filterStatus, pageSize]);

  // Load filter options separately (updates when parent region changes)
  const loadFilterOptions = useCallback(async () => {
    if (!token) return;
    try {
      const opts = await getOsonFilterOptions(
        token,
        filterParentRegion.length === 1 ? filterParentRegion[0] : undefined
      );
      setFilterOptions(opts);
    } catch {
      // non-fatal
    }
  }, [token, filterParentRegion]);

  useEffect(() => {
    if (!authLoading && token) {
      loadData();
    }
  }, [authLoading, token, loadData]);

  useEffect(() => {
    if (!authLoading && token) {
      loadFilterOptions();
    }
  }, [authLoading, token, loadFilterOptions]);

  // ─── Sync status polling ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isSyncing) {
      pollingRef.current = setInterval(async () => {
        if (!token) return;
        try {
          const [status, statsData] = await Promise.all([
            getOsonSyncStatus(token),
            getOsonStats(token, {
              parentRegion: filterParentRegion.length > 0 ? filterParentRegion : undefined,
              region: filterRegion.length > 0 ? filterRegion : undefined,
              search: searchQuery || undefined,
            }),
          ]);
          setSyncStatus({
            isSyncing: status.isSyncing,
            lastSyncAt: status.lastSyncAt,
            lastSyncError: status.lastSyncError,
            hasToken: status.hasToken,
            progress: status.progress || { current: 0, total: 0, percent: 0, phase: "" },
          });
          setStats(statsData);
          if (status.progress) setSyncProgress(status.progress);

          if (!status.isSyncing) {
            setIsSyncing(false);
            clearInterval(pollingRef.current!);
            toast.success("Данные OSON успешно обновлены!");
            loadData();
          }
        } catch {
          // ignore
        }
      }, 3000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isSyncing, token, loadData]);

  // ─── Trigger sync ───────────────────────────────────────────────────────────────────

  const handleSync = async () => {
    if (!token) return;
    setIsConfirmOpen(false);
    setSyncProgress({ current: 0, total: 0, percent: 0, phase: "collecting" });

    try {
      await triggerOsonSync(token);
      setIsSyncing(true);
      setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
      toast.info("Синхронизация запущена. Это может занять несколько минут...");
    } catch (err: any) {
      toast.error(err.message || "Не удалось запустить синхронизацию");
    }
  };

  // ─── Map init ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "map" || mapInitialized.current) return;

    const existing = document.getElementById("yandex-maps-script");
    if (existing) {
      if (window.ymaps) window.ymaps.ready(() => initMap());
      return;
    }

    const script = document.createElement("script");
    script.id = "yandex-maps-script";
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${import.meta.env.VITE_YANDEX_MAP_KEY}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      if (window.ymaps) window.ymaps.ready(() => initMap());
    };
    document.head.appendChild(script);
  }, [activeTab]);

  const initMap = () => {
    if (!containerRef.current || mapInitialized.current) return;
    try {
      mapRef.current = new window.ymaps.Map(containerRef.current, {
        center: UZBEKISTAN_CENTER,
        zoom: 6,
        controls: ["zoomControl", "fullscreenControl"],
        behaviors: ["default", "scrollZoom"],
      });
      mapInitialized.current = true;
      renderMapMarkers();
    } catch (err) {
      console.error("Map init error:", err);
    }
  };

  // ─── Download Excel ─────────────────────────────────────────────────────────────────

  const handleDownloadExcel = async () => {
    if (!token) return;
    try {
      toast.info("Подготовка файла...");
      const statusFilter =
        filterStatus.length > 0 && !filterStatus.includes("all") ? filterStatus : undefined;
      const allData = await getOsonPharmacies(token, {
        status: statusFilter,
        parentRegion: filterParentRegion.length > 0 ? filterParentRegion : undefined,
        region: filterRegion.length > 0 ? filterRegion : undefined,
        search: searchQuery || undefined,
        size: 0,
      });
      if (!allData.data.length) {
        toast.error("Нет данных для скачивания");
        return;
      }
      const dataToExport = allData.data.map((p, index) => ({ ...p, "№_пп": index + 1 }));
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Аптеки");
      XLSX.writeFile(workbook, `OSON_Pharmacies_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Файл успешно скачан");
    } catch {
      toast.error("Ошибка при скачивании");
    }
  };

  const filteredPharmacies = pharmacies;

  // ─── Map markers ───────────────────────────────────────────────────────────────────

  const renderMapMarkers = useCallback(() => {
    if (!mapRef.current || !window.ymaps) return;
    const geoObjects = mapRef.current.geoObjects;
    geoObjects.removeAll();
    const visiblePharmacies = filteredPharmacies.filter(
      (p) => p.oson_status === "connected" || p.oson_status === "not_connected" || p.oson_status === "deleted"
    );
    const collection = new window.ymaps.GeoObjectCollection();
    visiblePharmacies.forEach((pharmacy) => {
      const lat = parseFloat(pharmacy.latitude as unknown as string);
      const lon = parseFloat(pharmacy.longitude as unknown as string);
      if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;
      const statusLabel = getStatusLabel(pharmacy.oson_status, language);
      const statusColor = pharmacy.oson_status === "connected" ? "#10b981" : "#f59e0b";
      const placemark = new window.ymaps.Placemark(
        [lat, lon],
        {
          balloonContent: `
            <div style="padding: 12px; font-family: Arial, sans-serif; max-width: 300px;">
              <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">
                ${language === "uz" ? pharmacy.name_uz || pharmacy.name_ru : pharmacy.name_ru || pharmacy.name_uz}
              </div>
              <div style="display:inline-block; padding: 2px 8px; border-radius: 12px; background:${statusColor}22; color:${statusColor}; font-size:11px; font-weight:bold; margin-bottom:8px;">
                ${statusLabel}
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                📍 ${language === "uz" ? pharmacy.address_uz || pharmacy.address_ru : pharmacy.address_ru || pharmacy.address_uz || "—"}
              </div>
              ${pharmacy.phone ? `<div style="font-size: 12px; color: #666; margin-bottom: 4px;">📞 <a href="tel:${pharmacy.phone}" style="color:#3b82f6;">${pharmacy.phone}</a></div>` : ""}
              ${pharmacy.open_time && pharmacy.close_time ? `<div style="font-size: 12px; color: #666;">🕐 ${pharmacy.open_time} – ${pharmacy.close_time}</div>` : ""}
              <div style="font-size: 11px; color:#aaa; margin-top:6px;">slug: ${pharmacy.slug}</div>
            </div>
          `,
        },
        { preset: getMarkerColor(pharmacy.oson_status) }
      );
      collection.add(placemark);
    });
    geoObjects.add(collection);
  }, [filteredPharmacies, language]);

  useEffect(() => {
    if (activeTab === "map" && mapInitialized.current && !isLoading) {
      renderMapMarkers();
    }
  }, [filteredPharmacies, activeTab, isLoading, renderMapMarkers]);

  useEffect(() => {
    if (containerRef.current) {
      if (theme === "dark") {
        containerRef.current.classList.add("yandex-map-dark");
      } else {
        containerRef.current.classList.remove("yandex-map-dark");
      }
    }
  }, [theme]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <span className="text-gray-500 dark:text-gray-400">Загрузка...</span>
      </div>
    );
  }

  const toggleStatusFilter = (status: OsonStatus | "all") => {
    if (status === "all") { setFilterStatus([]); return; }
    setFilterStatus(prev => {
      if (prev.includes(status)) return prev.filter(s => s !== status);
      return [...prev.filter(s => s !== "all"), status];
    });
  };

  const isStatusActive = (status: OsonStatus | "all") => {
    if (status === "all") return filterStatus.length === 0;
    return filterStatus.includes(status);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Header />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 flex flex-col gap-3 shrink-0 relative z-20">
          {/* Row 1: Title + Stats + Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">OSON Slug List</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {syncStatus.isSyncing || isSyncing ? (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Синхронизация...
                    </span>
                  ) : syncStatus.lastSyncAt ? (
                    `Обновлено: ${formatDateTime(syncStatus.lastSyncAt)}`
                  ) : stats.lastSyncedAt ? (
                    `Обновлено: ${formatDateTime(stats.lastSyncedAt)}`
                  ) : (
                    "Данные ещё не синхронизированы"
                  )}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <StatsCard label="Всего" value={stats.total} color="gray" onClick={() => toggleStatusFilter("all")} active={isStatusActive("all")} />
                <StatsCard label="Подключён" value={stats.connected} color="green" onClick={() => toggleStatusFilter("connected")} active={isStatusActive("connected")} />
                <StatsCard label="Не подключён" value={stats.not_connected} color="amber" onClick={() => toggleStatusFilter("not_connected")} active={isStatusActive("not_connected")} />
                <StatsCard label="Удалён" value={stats.deleted} color="red" onClick={() => toggleStatusFilter("deleted")} active={isStatusActive("deleted")} />
                <StatsCard label="Новый" value={stats.new || 0} color="blue" onClick={() => toggleStatusFilter("new")} active={isStatusActive("new")} />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setActiveTab("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                    activeTab === "list"
                      ? "bg-purple-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">Список</span>
                </button>
                <button
                  onClick={() => setActiveTab("map")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-l border-gray-200 dark:border-gray-700 ${
                    activeTab === "map"
                      ? "bg-purple-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <Map className="h-4 w-4" />
                  <span className="hidden sm:inline">Карта</span>
                </button>
              </div>
              {activeTab === "list" && (
                <Button
                  onClick={handleDownloadExcel}
                  disabled={isLoading || pharmacies.length === 0}
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800 dark:text-green-400 dark:border-green-800/50 dark:hover:bg-green-900/30"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Скачать</span>
                </Button>
              )}
              <Button
                onClick={() => setIsConfirmOpen(true)}
                disabled={isSyncing || syncStatus.isSyncing}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing || syncStatus.isSyncing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Обновить данные</span>
              </Button>
            </div>
          </div>

          {(isSyncing || syncStatus.isSyncing) && <SyncProgressBar progress={syncProgress} />}

          {/* Row 2: Full-width search (list tab only) */}
          {activeTab === "list" && (
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Поиск по названию, slug, адресу..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-full bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden relative">
          {activeTab === "list" ? (
            <ListTab
              pharmacies={filteredPharmacies}
              isLoading={isLoading}
              language={language}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              totalCount={totalCount}
              filterStatus={filterStatus}
              onSetStatus={(v) => setFilterStatus(v)}
              filterParentRegion={filterParentRegion}
              onFilterParentRegion={(v) => { setFilterParentRegion(v); setFilterRegion([]); }}
              filterRegion={filterRegion}
              onFilterRegion={setFilterRegion}
              filterInn={filterInn}
              onFilterInn={setFilterInn}
              filterOptions={filterOptions}
            />
          ) : (
            <MapTab
              containerRef={containerRef}
              isLoading={isLoading}
              pharmacies={filteredPharmacies}
              language={language}
              filterParentRegion={filterParentRegion}
              filterRegion={filterRegion}
              filterStatus={filterStatus}
              searchQuery={searchQuery}
              filterOptions={filterOptions}
              onFilterParentRegion={(v) => { setFilterParentRegion(v); setFilterRegion([]); }}
              onFilterRegion={(v) => setFilterRegion(v)}
              onFilterStatus={(v) => toggleStatusFilter(v)}
              onSearch={(v) => setSearchQuery(v)}
              stats={stats}
            />
          )}
        </div>
      </main>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Обновить данные OSON?</AlertDialogTitle>
            <AlertDialogDescription>
              Будет запущена синхронизация со всеми регионами OSON. Процесс может занять несколько минут.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleSync} className="bg-purple-600 hover:bg-purple-700">
              Да, обновить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Stats Card ──────────────────────────────────────────────────────────────────────────────

function StatsCard({ label, value, color, onClick, active }: {
  label: string; value: number; color: "gray" | "green" | "amber" | "red" | "blue"; onClick: () => void; active: boolean;
}) {
  const colorMap = {
    gray: active ? "bg-gray-200 dark:bg-gray-600 border-gray-400" : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
    green: active ? "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400" : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
    amber: active ? "bg-amber-100 dark:bg-amber-900/40 border-amber-400" : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
    red: active ? "bg-red-100 dark:bg-red-900/40 border-red-400" : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
    blue: active ? "bg-blue-100 dark:bg-blue-900/40 border-blue-400" : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
  };
  const valueColorMap = {
    gray: "text-gray-700 dark:text-gray-200",
    green: "text-emerald-700 dark:text-emerald-400",
    amber: "text-amber-700 dark:text-amber-400",
    red: "text-red-700 dark:text-red-400",
    blue: "text-blue-700 dark:text-blue-400",
  };
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-all hover:shadow-sm ${colorMap[color]}`}>
      <span className={`font-bold text-base ${valueColorMap[color]}`}>{value.toLocaleString()}</span>
      <span className="text-gray-500 dark:text-gray-400 text-xs">{label}</span>
    </button>
  );
}

// ─── Sync Progress Bar ─────────────────────────────────────────────────────────────────────────

function getPhaseLabel(phase: string): string {
  switch (phase) {
    case "collecting": return "Сбор списка аптек из OSON...";
    case "syncing":    return "Синхронизация данных...";
    case "cleanup":   return "Очистка устаревших записей...";
    case "done":      return "Завершено";
    case "error":     return "Ошибка синхронизации";
    default:          return "Подготовка...";
  }
}

function SyncProgressBar({ progress }: { progress: OsonProgress }) {
  const { current, total, percent, phase } = progress;
  return (
    <div className="w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
          <RefreshCw className="h-3 w-3 animate-spin" />
          {getPhaseLabel(phase)}
        </span>
        <span className="font-bold text-amber-800 dark:text-amber-300">
          {total > 0 ? <>{current.toLocaleString()} / {total.toLocaleString()} &nbsp;({percent}%)</> : "Загрузка..."}
        </span>
      </div>
      <div className="w-full bg-amber-200 dark:bg-amber-800/50 rounded-full h-2 overflow-hidden">
        <div className="h-2 rounded-full bg-amber-500 dark:bg-amber-400 transition-all duration-500" style={{ width: `${Math.max(percent, total > 0 ? 2 : 0)}%` }} />
      </div>
    </div>
  );
}

// ─── Column Filter Popover ───────────────────────────────────────────────────────────────────

function ColFilter({
  children,
  type,
  options,
  selectedValues,
  onChange,
  textValue,
  onTextChange,
}: {
  children: React.ReactNode;
  type: "multiselect" | "text";
  options?: { value: string; label: string }[];
  selectedValues?: string[];
  onChange?: (values: string[]) => void;
  textValue?: string;
  onTextChange?: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [local, setLocal] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = type === "multiselect"
    ? (selectedValues?.length ?? 0) > 0
    : (textValue?.length ?? 0) > 0;

  useEffect(() => {
    if (open) {
      setLocal(selectedValues ?? []);
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = (options ?? []).filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (v: string) =>
    setLocal(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const apply = () => { onChange?.(local); setOpen(false); };
  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (type === "multiselect") onChange?.([]);
    else onTextChange?.("");
  };

  return (
    <div className="relative inline-flex items-center gap-1 select-none" ref={ref}>
      <span>{children}</span>
      <button
        onClick={() => setOpen(v => !v)}
        className={`p-0.5 rounded transition-colors ${isActive
          ? "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40"
          : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
        title="Фильтр"
      >
        <Filter className="h-3 w-3" />
      </button>
      {isActive && (
        <button onClick={clear} className="p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Сбросить">
          <FilterX className="h-3 w-3" />
        </button>
      )}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl min-w-[200px]" style={{ minWidth: type === "text" ? 180 : 220 }}>
          {type === "text" ? (
            <div className="p-2 flex gap-1">
              <input
                ref={inputRef}
                type="text"
                placeholder="Поиск..."
                value={textValue ?? ""}
                onChange={e => onTextChange?.(e.target.value)}
                onKeyDown={e => e.key === "Enter" && setOpen(false)}
                className="flex-1 px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button onClick={() => setOpen(false)} className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700">OK</button>
            </div>
          ) : (
            <>
              <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Поиск..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-7 pr-2 py-1.5 text-sm rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto p-1">
                {filtered.length === 0
                  ? <div className="px-3 py-2 text-xs text-gray-400 text-center">Нет вариантов</div>
                  : filtered.map(opt => {
                      const checked = local.includes(opt.value);
                      return (
                        <div
                          key={opt.value}
                          onClick={() => toggle(opt.value)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${checked ? "bg-purple-600 border-purple-600" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"}`}>
                            {checked && <CheckCircle className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <span className={`text-xs ${checked ? "font-medium text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"}`}>{opt.label}</span>
                        </div>
                      );
                    })
                }
              </div>
              <div className="p-2 border-t border-gray-100 dark:border-gray-700 flex gap-1">
                <button onClick={() => { setLocal([]); }} className="flex-1 text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Сбросить</button>
                <button onClick={apply} className="flex-1 text-xs px-2 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-700">Применить</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── List Tab ────────────────────────────────────────────────────────────────────────────────

function ListTab({ pharmacies, isLoading, language, pageSize, onPageSizeChange, totalCount,
  filterStatus, onSetStatus, filterParentRegion, onFilterParentRegion,
  filterRegion, onFilterRegion, filterInn, onFilterInn, filterOptions,
}: {
  pharmacies: OsonPharmacy[];
  isLoading: boolean;
  language: string;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalCount: number;
  filterStatus: (OsonStatus | "all")[];
  onSetStatus: (v: (OsonStatus | "all")[]) => void;
  filterParentRegion: string[];
  onFilterParentRegion: (v: string[]) => void;
  filterRegion: string[];
  onFilterRegion: (v: string[]) => void;
  filterInn: string;
  onFilterInn: (v: string) => void;
  filterOptions: OsonFilterOptions;
}) {
  const [selectedPharmacy, setSelectedPharmacy] = useState<OsonPharmacy | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [pharmacies]);

  const totalPages = Math.max(1, Math.ceil(pharmacies.length / pageSize));
  const pagedPharmacies = pharmacies.slice(page * pageSize, (page + 1) * pageSize);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Загрузка данных...</span>
        </div>
      </div>
    );
  }

  if (pharmacies.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400 dark:text-gray-500">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Аптеки не найдены</p>
          <p className="text-xs mt-1">Попробуйте изменить фильтры или запустить синхронизацию</p>
        </div>
      </div>
    );
  }

  const TH = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap";

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 overflow-hidden relative">
      <div className="flex-1 overflow-auto">
        <table className="text-sm border-collapse" style={{ minWidth: "2200px", width: "100%" }}>
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className={`${TH} w-12 text-center whitespace-nowrap`}>#</th>
              <th className={TH} style={{ minWidth: "180px" }}>Название</th>
              <th className={TH} style={{ width: "180px", maxWidth: "180px" }}>Slug</th>
              <th className={TH}>
                <ColFilter
                  type="multiselect"
                  options={[
                    { value: "connected", label: "Подключён" },
                    { value: "not_connected", label: "Не подключён" },
                    { value: "new", label: "Новый" },
                    { value: "deleted", label: "Удалён" },
                  ]}
                  selectedValues={filterStatus.filter(s => s !== "all") as string[]}
                  onChange={(v) => onSetStatus(v as (OsonStatus | "all")[])}
                >Статус</ColFilter>
              </th>
              <th className={TH}>
                <ColFilter
                  type="multiselect"
                  options={filterOptions.parentRegions.map(r => ({ value: r.parent_region_ru, label: r.parent_region_ru }))}
                  selectedValues={filterParentRegion}
                  onChange={(v) => onFilterParentRegion(v)}
                >Город</ColFilter>
              </th>
              <th className={TH}>
                <ColFilter
                  type="multiselect"
                  options={filterOptions.regions.map(r => ({ value: r.region_ru, label: r.region_ru }))}
                  selectedValues={filterRegion}
                  onChange={onFilterRegion}
                >Район</ColFilter>
              </th>
              <th className={TH} style={{ minWidth: "180px" }}>Адрес</th>
              <th className={TH} style={{ minWidth: "150px" }}>Ориентир</th>
              <th className={TH}>Телефон</th>
              <th className={TH}>Время работы</th>
              <th className={TH}>
                <ColFilter type="text" textValue={filterInn} onTextChange={onFilterInn}>ИНН</ColFilter>
              </th>
              <th className={TH} style={{ minWidth: "130px" }}>Обновлено</th>
              <th className={TH} style={{ minWidth: "150px" }}>Время синхронизации OSON</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {pagedPharmacies.map((pharmacy, index) => {
              const name = language === "uz" ? pharmacy.name_uz || pharmacy.name_ru : pharmacy.name_ru || pharmacy.name_uz;
              const city = language === "uz" ? pharmacy.parent_region_uz || pharmacy.parent_region_ru : pharmacy.parent_region_ru || pharmacy.parent_region_uz;
              const district = language === "uz" ? pharmacy.region_uz || pharmacy.region_ru : pharmacy.region_ru || pharmacy.region_uz;
              const address = language === "uz" ? pharmacy.address_uz || pharmacy.address_ru : pharmacy.address_ru || pharmacy.address_uz;
              const landmark = language === "uz" ? pharmacy.landmark_uz || pharmacy.landmark_ru : pharmacy.landmark_ru || pharmacy.landmark_uz;

              return (
                <tr key={pharmacy.id} className="hover:bg-purple-50/50 dark:hover:bg-gray-800/60">
                  <td className="px-3 py-2.5 text-center text-xs text-gray-400 dark:text-gray-500 font-mono whitespace-nowrap">{page * pageSize + index + 1}</td>
                  <td className="px-3 py-2.5 text-gray-900 dark:text-gray-100 font-medium align-top cursor-pointer" style={{ minWidth: "180px" }} onClick={() => setSelectedPharmacy(pharmacy)}>
                    <div className="break-words leading-snug hover:text-purple-600 dark:hover:text-purple-400 hover:underline" style={{ maxWidth: "220px" }}>{name || "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 align-middle" style={{ maxWidth: "180px" }}>
                    <code className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded block truncate" title={pharmacy.slug}>{pharmacy.slug}</code>
                  </td>
                  <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(pharmacy.oson_status)}`}>
                      {getStatusIcon(pharmacy.oson_status)}
                      {getStatusLabel(pharmacy.oson_status, language)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 text-xs align-middle whitespace-nowrap">{city || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 text-xs align-middle whitespace-nowrap">{district || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-xs align-top" style={{ minWidth: "180px" }}>
                    <div className="break-words leading-snug" style={{ maxWidth: "220px" }}>{address || "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-xs align-top" style={{ minWidth: "150px" }}>
                    <div className="break-words leading-snug" style={{ maxWidth: "200px" }}>{landmark || "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                    {pharmacy.phone ? (
                      <a href={`tel:${pharmacy.phone}`} onClick={(e) => e.stopPropagation()} className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 text-xs">
                        <Phone className="h-3 w-3 shrink-0" />{pharmacy.phone}
                      </a>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-xs align-middle whitespace-nowrap">
                    {pharmacy.open_time && pharmacy.close_time ? (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{pharmacy.open_time.slice(0, 5)} – {pharmacy.close_time.slice(0, 5)}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 align-middle whitespace-nowrap font-mono">
                    {pharmacy.inn || <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{formatDateTime(pharmacy.last_synced_at)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{formatOsonDateTime(pharmacy.oson_synced_time)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 text-xs text-gray-400 flex flex-wrap justify-between items-center gap-2 w-full shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
        <div className="flex items-center gap-3">
          <span>
            Загружено {pharmacies.length.toLocaleString()} из {totalCount.toLocaleString()} аптек
            {totalPages > 1 && ` · стр. ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, pharmacies.length)}`}
          </span>
          <span className="text-gray-200 dark:text-gray-600">|</span>
          <div className="flex items-center gap-1.5">
            <span>Строк:</span>
            <input
              type="number" min={1} defaultValue={pageSize} key={pageSize}
              onBlur={e => { const val = Math.max(1, parseInt(e.target.value) || 1); onPageSizeChange(val); }}
              onKeyDown={e => { if (e.key === "Enter") { const val = Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1); onPageSizeChange(val); (e.target as HTMLInputElement).blur(); } }}
              className="border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 w-16 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Подключён</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Не подключён</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Удалён</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Новый</span>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></button>
              <span className="px-2 tabular-nums font-medium text-gray-600 dark:text-gray-300">{page + 1} / {totalPages}</span>
              <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      </div>

      <PharmacyDetailModal pharmacy={selectedPharmacy} language={language} onClose={() => setSelectedPharmacy(null)} />
    </div>
  );
}

// ─── MultiSelect Dropdown ────────────────────────────────────────────────────────────────────────

function MultiSelectDropdown({ label, options, selectedValues, onChange, alignRight }: {
  label: string; options: { label: string; value: string }[]; selectedValues: string[]; onChange: (values: string[]) => void; alignRight?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [localSelected, setLocalSelected] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (isOpen) { setLocalSelected(selectedValues); setSearch(""); } }, [isOpen, selectedValues]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));
  const toggleOption = (value: string) => {
    if (localSelected.includes(value)) setLocalSelected(localSelected.filter(v => v !== value));
    else setLocalSelected([...localSelected, value]);
  };
  const clearSelection = (e: React.MouseEvent) => { e.stopPropagation(); onChange([]); setLocalSelected([]); };
  const applySelection = () => { onChange(localSelected); setIsOpen(false); };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 transition-colors hover:bg-gray-50 focus:outline-none">
        <span className="truncate pr-2">{selectedValues.length === 0 ? label : `${label} (${selectedValues.length})`}</span>
        <div className="flex items-center gap-1">
          {selectedValues.length > 0 && (
            <div onClick={clearSelection} className="p-0.5 rounded-sm hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-gray-700"><FilterX className="h-3 w-3" /></div>
          )}
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
      </button>
      {isOpen && (
        <div className={`absolute z-50 mt-1 w-[260px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg flex flex-col ${alignRight ? 'right-0' : 'left-0'}`}>
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-8 pr-2 py-1.5 text-sm rounded bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-purple-300 focus:bg-white focus:outline-none transition-colors" autoFocus />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto overscroll-contain p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">Ничего не найдено</div>
            ) : filteredOptions.map(option => {
              const isSelected = localSelected.includes(option.value);
              return (
                <div key={option.value} onClick={(e) => { e.preventDefault(); toggleOption(option.value); }} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer group">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'}`}>
                    {isSelected && <CheckCircle className="h-3 w-3" />}
                  </div>
                  <span className={`text-sm select-none ${isSelected ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>{option.label}</span>
                </div>
              );
            })}
          </div>
          <div className="p-2 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-md">
            <Button size="sm" onClick={applySelection} className="w-full bg-purple-600 hover:bg-purple-700">Применить</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Map Tab ────────────────────────────────────────────────────────────────────────────────

function MapTab({ containerRef, isLoading, pharmacies, language, filterParentRegion, filterRegion, filterStatus, searchQuery, filterOptions, onFilterParentRegion, onFilterRegion, onFilterStatus, onSearch, stats }: {
  containerRef: React.RefObject<HTMLDivElement | null>; isLoading: boolean; pharmacies: OsonPharmacy[]; language: string;
  filterParentRegion: string[]; filterRegion: string[]; filterStatus: (OsonStatus | "all")[]; searchQuery: string;
  filterOptions: OsonFilterOptions; onFilterParentRegion: (v: string[]) => void; onFilterRegion: (v: string[]) => void;
  onFilterStatus: (status: OsonStatus | "all") => void; onSearch: (v: string) => void; stats: OsonStats;
}) {
  const mapCount = pharmacies.filter(p => p.oson_status === "connected" || p.oson_status === "not_connected").length;

  return (
    <div className="flex h-full w-full">
      <div className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex flex-col gap-4 overflow-y-auto z-10">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Фильтры карты</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input type="text" placeholder="Поиск..." value={searchQuery} onChange={(e) => onSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 text-sm rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>
        <div className="w-full">
          <MultiSelectDropdown label="Выберите города" options={filterOptions.parentRegions.map(r => ({ value: r.parent_region_ru, label: language === "uz" ? r.parent_region_uz || r.parent_region_ru : r.parent_region_ru }))} selectedValues={filterParentRegion} onChange={(v) => { onFilterParentRegion(v); onFilterRegion([]); }} />
        </div>
        <div className="w-full">
          <MultiSelectDropdown label="Выберите районы" options={filterOptions.regions.map(r => ({ value: r.region_ru, label: language === "uz" ? r.region_uz || r.region_ru : r.region_ru }))} selectedValues={filterRegion} onChange={onFilterRegion} />
        </div>
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-2 flex flex-col gap-1 mt-2">
          {([
            { value: "all", label: `Все (${stats.total})`, dot: "bg-gray-400" },
            { value: "connected", label: `Подключён (${stats.connected})`, dot: "bg-emerald-500" },
            { value: "not_connected", label: `Не подключён (${stats.not_connected})`, dot: "bg-amber-500" },
            { value: "deleted", label: `Удалён (${stats.deleted})`, dot: "bg-red-500" },
          ] as { value: OsonStatus | "all"; label: string; dot: string }[]).map(({ value, label, dot }) => (
            <button key={value} onClick={() => onFilterStatus(value)} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${
              (value === "all" ? filterStatus.length === 0 : filterStatus.includes(value))
                ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-medium"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full inline-block shrink-0 ${dot}`} />{label}
            </button>
          ))}
        </div>
        <div className="mt-auto bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 text-center">
          Отображено на карте:<br />
          <span className="font-semibold text-lg text-gray-800 dark:text-gray-200">{mapCount.toLocaleString()}</span> аптек
        </div>
      </div>
      <div className="flex-1 relative h-full w-full z-0 bg-gray-100 dark:bg-gray-900">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 z-20 flex items-center justify-center backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Загрузка карты...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pharmacy Detail Modal ───────────────────────────────────────────────────────────────────────

function PharmacyDetailModal({ pharmacy, language, onClose }: { pharmacy: OsonPharmacy | null; language: string; onClose: () => void; }) {
  if (!pharmacy) return null;

  const name = language === "uz" ? pharmacy.name_uz || pharmacy.name_ru : pharmacy.name_ru || pharmacy.name_uz;
  const city = language === "uz" ? pharmacy.parent_region_uz || pharmacy.parent_region_ru : pharmacy.parent_region_ru || pharmacy.parent_region_uz;
  const district = language === "uz" ? pharmacy.region_uz || pharmacy.region_ru : pharmacy.region_ru || pharmacy.region_uz;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "ID", value: pharmacy.id },
    { label: "Статус", value: (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(pharmacy.oson_status)}`}>
        {getStatusIcon(pharmacy.oson_status)}{getStatusLabel(pharmacy.oson_status, language)}
      </span>
    )},
    { label: "Название (RU)", value: pharmacy.name_ru || "—" },
    { label: "Название (UZ)", value: pharmacy.name_uz || "—" },
    { label: "Slug", value: <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded" style={{ wordBreak: "break-all" }}>{pharmacy.slug}</code> },
    { label: "Город", value: city || "—" },
    { label: "Район", value: district || "—" },
    { label: "Адрес (RU)", value: pharmacy.address_ru || "—" },
    { label: "Адрес (UZ)", value: pharmacy.address_uz || "—" },
    { label: "Ориентир (RU)", value: pharmacy.landmark_ru || "—" },
    { label: "Ориентир (UZ)", value: pharmacy.landmark_uz || "—" },
    { label: "ИНН", value: pharmacy.inn ? <span className="font-mono">{pharmacy.inn}</span> : "—" },
    { label: "Телефон", value: pharmacy.phone ? <a href={`tel:${pharmacy.phone}`} className="text-purple-600 dark:text-purple-400 hover:underline">{pharmacy.phone}</a> : "—" },
    { label: "Время работы", value: pharmacy.open_time && pharmacy.close_time ? `${pharmacy.open_time.slice(0, 5)} – ${pharmacy.close_time.slice(0, 5)}` : "—" },
    { label: "Доставка", value: pharmacy.has_delivery ? <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Есть</span> : <span className="text-gray-400">Нет</span> },
    { label: "Скидка", value: pharmacy.discount_percent > 0 ? <span className="text-blue-600 dark:text-blue-400 font-medium">{pharmacy.discount_percent}%</span> : "—" },
    { label: "Кэшбэк", value: pharmacy.cashback_percent > 0 ? <span className="text-teal-600 dark:text-teal-400 font-medium">{pharmacy.cashback_percent}%</span> : "—" },
    { label: "Верифицирован", value: pharmacy.is_verified ? <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" /> Да</span> : <span className="text-gray-400">Нет</span> },
    { label: "Координаты", value: pharmacy.latitude && pharmacy.longitude ? `${pharmacy.latitude}, ${pharmacy.longitude}` : "—" },
    { label: "Обновлено", value: formatDateTime(pharmacy.last_synced_at) },
    { label: "Время синхронизации OSON", value: formatOsonDateTime(pharmacy.oson_synced_time) },
    { label: "Дата создания", value: formatDateTime(pharmacy.created_at) },
  ];

  return (
    <Dialog open={!!pharmacy} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5 text-purple-600" />
            {name || "Аптека"}
          </DialogTitle>
        </DialogHeader>
        <div className="divide-y divide-gray-100 dark:divide-gray-800 -mx-2">
          {rows.map(({ label, value }, i) => (
            <div key={i} className="flex gap-3 px-2 py-2.5 text-sm">
              <span className="w-44 shrink-0 text-gray-500 dark:text-gray-400 text-xs font-medium">{label}</span>
              <span className="text-gray-900 dark:text-gray-100 text-xs break-words min-w-0">{value}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
