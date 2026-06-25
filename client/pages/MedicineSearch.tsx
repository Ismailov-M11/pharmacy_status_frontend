import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  ChevronDown,
  List,
  Map,
  Plus,
  Minus,
  X,
  Package,
  MapPin,
  Phone,
  Clock,
  Pill,
  ShoppingBag,
  ChevronDown as Expand,
  ArrowLeft,
  Building2,
  Loader2,
  Receipt,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMedicineFilterOptions,
  searchDrugs,
  searchStock,
  searchOrders,
  getDrugDetail,
  OrderResult,
  DrugDetail,
  DrugItem,
  DrugListItem,
  StockPharmacy,
  MedicineFilterOptions,
} from "@/lib/medicineApi";

const UZBEKISTAN_CENTER = [41.2995, 69.2401];

declare global {
  interface Window { ymaps: any; }
}

type ViewTab = "list" | "map";
type Stage = "search" | "results";

function formatPrice(price: number): string {
  return price.toLocaleString("ru-RU") + " сум";
}

function DrugImage({ src, size = 40 }: { src: string | null; size?: number }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div
        className="rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <Pill className="text-purple-400" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setError(true)}
      className="rounded-lg object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

function PharmacyImage({ src, size = 48 }: { src: string | null; size?: number }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div
        className="rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <Building2 className="text-gray-400" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setError(true)}
      className="rounded-xl object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function MedicineSearch() {
  const { language } = useLanguage();
  const { token, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("search");

  // ── Region selectors ───────────────────────────────────────────────────────
  const [filterOptions, setFilterOptions] = useState<MedicineFilterOptions>({
    parentRegions: [],
    regions: [],
  });
  const [selectedParentRegions, setSelectedParentRegions] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [regionSearch, setRegionSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const regionDropdownRef = useRef<HTMLDivElement>(null);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  // ── Drug search ────────────────────────────────────────────────────────────
  const [drugQuery, setDrugQuery] = useState("");
  const [drugResults, setDrugResults] = useState<DrugItem[]>([]);
  const [isDrugSearching, setIsDrugSearching] = useState(false);
  const [isDrugDropdownOpen, setIsDrugDropdownOpen] = useState(false);
  const drugDropdownRef = useRef<HTMLDivElement>(null);
  const drugSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drugSearchAbortRef = useRef<AbortController | null>(null);

  // ── Order search ───────────────────────────────────────────────────────────
  const [orderQuery, setOrderQuery] = useState("");
  const [orderResults, setOrderResults] = useState<OrderResult[]>([]);
  const [isOrderSearching, setIsOrderSearching] = useState(false);
  const [isOrderDropdownOpen, setIsOrderDropdownOpen] = useState(false);
  const [selectedOrderCode, setSelectedOrderCode] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const pendingAutoRegion = useRef<string | null>(null);
  const orderDropdownRef = useRef<HTMLDivElement>(null);
  const orderSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Drug list ──────────────────────────────────────────────────────────────
  const [drugList, setDrugList] = useState<DrugListItem[]>([]);

  // ── Stock results ──────────────────────────────────────────────────────────
  const [isStockSearching, setIsStockSearching] = useState(false);
  const [stockResults, setStockResults] = useState<StockPharmacy[] | null>(null);
  const [activeView, setActiveView] = useState<ViewTab>("list");
  const [expandedPharmacy, setExpandedPharmacy] = useState<string | null>(null);

  // ── Map ────────────────────────────────────────────────────────────────────
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);
  const placemarkMapRef = useRef<Record<string, any>>({});
  const [selectedMapPharmacyId, setSelectedMapPharmacyId] = useState<string | null>(null);

  // ── Drug detail modal ──────────────────────────────────────────────────────
  const [drugDetailModal, setDrugDetailModal] = useState<DrugDetail | null>(null);
  const [drugDetailLoading, setDrugDetailLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !token) navigate("/login");
  }, [token, authLoading, navigate]);

  useEffect(() => {
    if (!token) return;
    getMedicineFilterOptions(token)
      .then(setFilterOptions)
      .catch(() => toast.error("Не удалось загрузить список регионов"));
  }, [token]);

  useEffect(() => {
    if (!token || selectedParentRegions.length === 0) {
      setFilterOptions((prev) => ({ ...prev, regions: [] }));
      setSelectedRegions([]);
      pendingAutoRegion.current = null;
      return;
    }
    getMedicineFilterOptions(token, selectedParentRegions.join(","))
      .then((opts) => {
        setFilterOptions((prev) => ({ ...prev, regions: opts.regions }));
        if (pendingAutoRegion.current) {
          const match = opts.regions.find((r) => r.region_ru === pendingAutoRegion.current);
          setSelectedRegions(match ? [match.region_ru] : []);
          pendingAutoRegion.current = null;
        } else {
          setSelectedRegions([]);
        }
      })
      .catch(() => {});
  }, [token, selectedParentRegions.join(",")]);

  // ── Close dropdowns on outside click ──────────────────────────────────────
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(e.target as Node))
        setIsRegionDropdownOpen(false);
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node))
        setIsCityDropdownOpen(false);
      if (drugDropdownRef.current && !drugDropdownRef.current.contains(e.target as Node))
        setIsDrugDropdownOpen(false);
      if (orderDropdownRef.current && !orderDropdownRef.current.contains(e.target as Node))
        setIsOrderDropdownOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ── Drug typeahead ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (drugSearchTimeout.current) clearTimeout(drugSearchTimeout.current);
    if (!drugQuery.trim() || drugQuery.length < 3 || !token) {
      setDrugResults([]);
      setIsDrugDropdownOpen(false);
      return;
    }
    drugSearchTimeout.current = setTimeout(async () => {
      if (drugSearchAbortRef.current) drugSearchAbortRef.current.abort();
      drugSearchAbortRef.current = new AbortController();
      setIsDrugSearching(true);
      try {
        const res = await searchDrugs(token, drugQuery, drugSearchAbortRef.current.signal);
        setDrugResults(res.items);
        setIsDrugDropdownOpen(res.items.length > 0);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        toast.error(err.message || "Ошибка поиска лекарств");
        setDrugResults([]);
      } finally {
        setIsDrugSearching(false);
      }
    }, 350);
    return () => { if (drugSearchTimeout.current) clearTimeout(drugSearchTimeout.current); };
  }, [drugQuery, token]);

  const handleAddDrug = (drug: DrugItem) => {
    setDrugList((prev) => {
      if (prev.some((item) => item.drug.id === drug.id)) {
        toast.info(`${drug.name} уже в списке`);
        return prev;
      }
      return [...prev, { drug, quantity: 1 }];
    });
    setDrugQuery("");
    setDrugResults([]);
    setIsDrugDropdownOpen(false);
  };

  const handleRemoveDrug = (id: string) => {
    setDrugList((prev) => prev.filter((item) => item.drug.id !== id));
  };

  const handleQuantityChange = (id: string, delta: number) => {
    setDrugList((prev) =>
      prev.map((item) =>
        item.drug.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    );
  };

  // ── Drug detail modal ──────────────────────────────────────────────────────
  const handleOpenDrugDetail = async (slug: string) => {
    if (!token) return;
    setDrugDetailLoading(true);
    setDrugDetailModal(null);
    try {
      const detail = await getDrugDetail(token, slug);
      setDrugDetailModal(detail);
    } catch {
      toast.error("Не удалось загрузить данные о препарате");
    } finally {
      setDrugDetailLoading(false);
    }
  };

  // ── Order search ───────────────────────────────────────────────────────────
  const handleOrderQueryChange = (value: string) => {
    setOrderQuery(value);
    setSelectedOrderCode(null);
    if (orderSearchTimeout.current) clearTimeout(orderSearchTimeout.current);
    if (value.trim().length < 1) {
      setOrderResults([]);
      setIsOrderDropdownOpen(false);
      return;
    }
    orderSearchTimeout.current = setTimeout(async () => {
      if (!token) return;
      setIsOrderSearching(true);
      setIsOrderDropdownOpen(true);
      try {
        const res = await searchOrders(token, value.trim());
        setOrderResults(res.orders);
      } catch {
        setOrderResults([]);
      } finally {
        setIsOrderSearching(false);
      }
    }, 350);
  };

  const handleSelectOrder = (order: OrderResult) => {
    setSelectedOrderCode(order.code);
    setOrderQuery(order.code);
    setIsOrderDropdownOpen(false);

    // Auto-fill drug list
    const items: DrugListItem[] = order.items.map((item) => ({
      drug: {
        id: item.slug,
        name: item.name,
        brand: item.brand,
        manufacturer: item.manufacturer,
        imageUrl: item.imageUrl,
        minPrice: item.price,
        maxPrice: item.price,
        byPrescription: false,
      },
      quantity: item.quantity,
    }));
    setDrugList(items);

    // Auto-fill region/city from market slug → oson_pharmacies
    if (order.parentRegionRu) {
      pendingAutoRegion.current = order.regionRu || null;
      setSelectedParentRegions([order.parentRegionRu]);
    }

    toast.success(`Заказ ${order.code}: добавлено ${items.length} поз.`);
  };

  // ── Stock search ───────────────────────────────────────────────────────────
  const handleStockSearch = async () => {
    if (!token || drugList.length === 0 || selectedParentRegions.length === 0) return;
    setIsStockSearching(true);
    setStockResults(null);
    setExpandedPharmacy(null);
    setSelectedMapPharmacyId(null);
    mapInitialized.current = false;
    mapRef.current = null;
    try {
      const drugs = drugList.map((item) => ({
        id: item.drug.id,
        name: item.drug.name,
        manufacturer: item.drug.manufacturer,
        quantity: item.quantity,
      }));
      const res = await searchStock(
        token,
        drugs,
        selectedParentRegions.join(","),
        selectedRegions.length > 0 ? selectedRegions.join(",") : undefined
      );
      setStockResults(res.pharmacies);
      setStage("results");
      setActiveView("list");
      if (res.pharmacies.length === 0) {
        toast.info("Аптеки, где есть все выбранные лекарства, не найдены");
      }
    } catch (err: any) {
      toast.error(err.message || "Ошибка поиска в аптеках");
    } finally {
      setIsStockSearching(false);
    }
  };

  // ── Select pharmacy on map ─────────────────────────────────────────────────
  const handleSelectOnMap = useCallback((pharmacy: StockPharmacy) => {
    const lat = Number(pharmacy.latitude);
    const lon = Number(pharmacy.longitude);
    if (!lat || !lon || !mapRef.current) return;
    setSelectedMapPharmacyId(pharmacy.id);
    mapRef.current.setCenter([lat, lon], 16, { duration: 400 });
    const placemark = placemarkMapRef.current[pharmacy.id];
    if (placemark) placemark.balloon.open();
  }, []);

  const handleBackToSearch = () => {
    setStage("search");
    setStockResults(null);
    mapInitialized.current = false;
    mapRef.current = null;
  };

  // ── Map ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "results" || activeView !== "map" || mapInitialized.current || !stockResults) return;
    const existing = document.getElementById("yandex-maps-script");
    if (existing) {
      if (window.ymaps) window.ymaps.ready(() => initMap());
      return;
    }
    const script = document.createElement("script");
    script.id = "yandex-maps-script";
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${import.meta.env.VITE_YANDEX_MAP_KEY}&lang=ru_RU`;
    script.async = true;
    script.onload = () => { if (window.ymaps) window.ymaps.ready(() => initMap()); };
    document.head.appendChild(script);
  }, [stage, activeView, stockResults]);

  const initMap = () => {
    if (!mapContainerRef.current || mapInitialized.current) return;
    try {
      mapRef.current = new window.ymaps.Map(mapContainerRef.current, {
        center: UZBEKISTAN_CENTER,
        zoom: 11,
        controls: ["zoomControl", "fullscreenControl"],
        behaviors: ["default", "scrollZoom"],
      });
      mapInitialized.current = true;
      renderMapMarkers();
    } catch (err) {
      console.error("Map init error:", err);
    }
  };

  const renderMapMarkers = useCallback(() => {
    if (!mapRef.current || !window.ymaps || !stockResults) return;
    mapRef.current.geoObjects.removeAll();
    placemarkMapRef.current = {};
    const collection = new window.ymaps.GeoObjectCollection();
    stockResults.forEach((pharmacy) => {
      const lat = Number(pharmacy.latitude);
      const lon = Number(pharmacy.longitude);
      if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;
      const drugsList = pharmacy.products
        .map((p) => `<div style="margin-top:4px;">• ${p.name}: <b>${formatPrice(p.price)}</b> × ${p.quantity}</div>`)
        .join("");
      const placemark = new window.ymaps.Placemark(
        [lat, lon],
        {
          balloonContent: `
            <div style="padding:12px; font-family:Arial,sans-serif; max-width:300px;">
              ${pharmacy.imageUrl ? `<img src="${pharmacy.imageUrl}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:8px;" onerror="this.style.display='none'"/>` : ""}
              <div style="font-weight:bold;font-size:14px;margin-bottom:4px;">${pharmacy.name}</div>
              ${pharmacy.address ? `<div style="font-size:12px;color:#666;margin-bottom:4px;">📍 ${pharmacy.address}</div>` : ""}
              ${pharmacy.phone ? `<div style="font-size:12px;color:#666;margin-bottom:4px;">📞 ${pharmacy.phone}</div>` : ""}
              ${pharmacy.openTime && pharmacy.closeTime ? `<div style="font-size:12px;color:#666;margin-bottom:8px;">🕐 ${pharmacy.openTime.slice(0,5)} – ${pharmacy.closeTime.slice(0,5)}</div>` : ""}
              <div style="font-size:12px;color:#333;border-top:1px solid #eee;padding-top:6px;">${drugsList}</div>
              <div style="margin-top:8px;font-size:13px;font-weight:bold;color:#7c3aed;">Итого: ${formatPrice(pharmacy.totalAmount)}</div>
            </div>
          `,
        },
        { preset: "islands#violetDotIcon" }
      );
      placemarkMapRef.current[pharmacy.id] = placemark;
      collection.add(placemark);
    });
    mapRef.current.geoObjects.add(collection);
    if (collection.getLength() > 0) {
      try { mapRef.current.setBounds(collection.getBounds(), { checkZoomRange: true, zoomMargin: 40 }); } catch {}
    }
  }, [stockResults]);

  useEffect(() => {
    if (activeView === "map" && mapInitialized.current && stockResults) renderMapMarkers();
  }, [stockResults, activeView, renderMapMarkers]);

  useEffect(() => {
    if (mapContainerRef.current) {
      if (theme === "dark") mapContainerRef.current.classList.add("yandex-map-dark");
      else mapContainerRef.current.classList.remove("yandex-map-dark");
    }
  }, [theme]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    );
  }

  const canSearch = selectedParentRegions.length > 0;
  const filteredParentRegions = filterOptions.parentRegions.filter((r) =>
    r.parent_region_ru.toLowerCase().includes(regionSearch.toLowerCase())
  );
  const filteredRegions = filterOptions.regions.filter((r) =>
    r.region_ru.toLowerCase().includes(citySearch.toLowerCase())
  );

  const toggleParentRegion = (name: string) => {
    setSelectedParentRegions((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]
    );
  };

  const toggleRegion = (name: string) => {
    setSelectedRegions((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Header />

      {/* ── Drug Detail Modal ──────────────────────────────────────────────── */}
      {(drugDetailModal || drugDetailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => { if (!drugDetailLoading) setDrugDetailModal(null); }}
        >
          <div
            className="w-full sm:max-w-3xl bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {drugDetailLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              </div>
            ) : drugDetailModal && (
              <>
                {/* Close button */}
                <button
                  onClick={() => setDrugDetailModal(null)}
                  className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 shadow text-gray-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Top section: photo left + info right */}
                <div className="flex gap-0 shrink-0 border-b border-gray-100 dark:border-gray-800">
                  {/* Photo */}
                  <div className="w-52 shrink-0 bg-gradient-to-b from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-900 flex items-center justify-center p-6 rounded-tl-2xl">
                    {drugDetailModal.imageUrl ? (
                      <img
                        src={drugDetailModal.imageUrl}
                        alt={drugDetailModal.name}
                        className="max-h-40 max-w-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-28 h-28 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Pill className="h-10 w-10 text-purple-400" />
                      </div>
                    )}
                  </div>

                  {/* Name + chips */}
                  <div className="flex-1 min-w-0 p-6 flex flex-col justify-center gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight pr-8">
                        {drugDetailModal.name}
                      </h2>
                      {drugDetailModal.brand && (
                        <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">{drugDetailModal.brand}</p>
                      )}
                      {drugDetailModal.manufacturer && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{drugDetailModal.manufacturer}</p>
                      )}
                    </div>

                    {/* Price + prescription chips */}
                    <div className="grid grid-cols-2 gap-2">
                      {(drugDetailModal.minPrice || drugDetailModal.maxPrice) && (
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-2.5">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Цена</div>
                          <div className="text-sm font-semibold text-green-700 dark:text-green-400">
                            {drugDetailModal.minPrice === drugDetailModal.maxPrice
                              ? `${(drugDetailModal.minPrice || 0).toLocaleString("ru-RU")} сум`
                              : `${(drugDetailModal.minPrice || 0).toLocaleString("ru-RU")} – ${(drugDetailModal.maxPrice || 0).toLocaleString("ru-RU")} сум`}
                          </div>
                        </div>
                      )}
                      {drugDetailModal.byPrescription !== undefined && drugDetailModal.byPrescription !== null && (
                        <div className={`rounded-xl px-3 py-2.5 ${drugDetailModal.byPrescription ? "bg-red-50 dark:bg-red-900/20" : "bg-blue-50 dark:bg-blue-900/20"}`}>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Рецепт</div>
                          <div className={`text-sm font-semibold ${drugDetailModal.byPrescription ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
                            {drugDetailModal.byPrescription ? "Требуется" : "Не требуется"}
                          </div>
                        </div>
                      )}
                      {drugDetailModal.atcName && (
                        <div className="col-span-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Действующее вещество</div>
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{drugDetailModal.atcName}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Instructions below */}
                <div className="overflow-y-auto flex-1 px-6 pb-6">
                  {(() => {
                    const validInstrs = drugDetailModal.instructions.filter((i) => {
                      const stripped = i.description.replace(/<[^>]*>/g, "").trim();
                      return i.title && stripped.length > 0;
                    });
                    return validInstrs.length > 0 ? (
                      <div className="pt-5 flex flex-col gap-5">
                        {validInstrs.map((instr) => (
                          <div key={instr.order}>
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                              {instr.title}
                            </h3>
                            <div
                              className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_.panel]:hidden"
                              dangerouslySetInnerHTML={{ __html: instr.description }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {stage === "search" ? (
        // ════════════════════════════════════════════════════════════════
        // STAGE 1 — Drug selection
        // ════════════════════════════════════════════════════════════════
        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-6 py-6 flex flex-col gap-5">

            {/* Title */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Справочник лекарств</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Поиск лекарств в подключённых аптеках OSON
              </p>
            </div>

            {/* ══ Two-column grid ═══════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

              {/* ── LEFT COLUMN — Order search + Region ──────────────────── */}
              <div className="flex flex-col gap-5 order-1 lg:order-1">

            {/* ── Step 1: Region ────────────────────────────────────────── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300 shrink-0">1</span>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Выберите регион</h2>
              </div>

              <div className="flex flex-wrap gap-3">
                {/* Регион — multi-select */}
                <div className="relative flex-1 min-w-[180px]" ref={regionDropdownRef}>
                  <button
                    onClick={() => setIsRegionDropdownOpen(!isRegionDropdownOpen)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm rounded-xl border-2 transition-all ${
                      selectedParentRegions.length > 0
                        ? "border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 font-medium"
                        : "border-dashed border-red-300 dark:border-red-700 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    } hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none`}
                  >
                    <span className="truncate">
                      {selectedParentRegions.length === 0 ? (
                        <span className="text-red-400">* Регион (обязательно)</span>
                      ) : selectedParentRegions.length === 1 ? (
                        selectedParentRegions[0]
                      ) : (
                        `${selectedParentRegions.length} региона выбрано`
                      )}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {selectedParentRegions.length > 0 && (
                        <span
                          onClick={(e) => { e.stopPropagation(); setSelectedParentRegions([]); }}
                          className="p-0.5 rounded hover:bg-purple-200 dark:hover:bg-purple-800"
                        >
                          <X className="h-3 w-3 text-purple-500" />
                        </span>
                      )}
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </div>
                  </button>
                  {isRegionDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                      <div className="p-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Поиск..."
                            value={regionSearch}
                            onChange={(e) => setRegionSearch(e.target.value)}
                            className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg bg-gray-50 dark:bg-gray-900 border border-transparent focus:outline-none focus:border-purple-300"
                            autoFocus
                          />
                        </div>
                        {filteredParentRegions.length > 0 && (
                          <button
                            onClick={() => {
                              const allVisible = filteredParentRegions.map((r) => r.parent_region_ru);
                              const allSelected = allVisible.every((n) => selectedParentRegions.includes(n));
                              setSelectedParentRegions(allSelected
                                ? selectedParentRegions.filter((n) => !allVisible.includes(n))
                                : [...new Set([...selectedParentRegions, ...allVisible])]
                              );
                            }}
                            className="text-xs text-purple-600 dark:text-purple-400 hover:underline shrink-0"
                          >
                            {filteredParentRegions.every((r) => selectedParentRegions.includes(r.parent_region_ru)) ? "Снять" : "Все"}
                          </button>
                        )}
                      </div>
                      <div className="max-h-52 overflow-y-auto p-1">
                        {filteredParentRegions.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-400 text-center">Ничего не найдено</div>
                        ) : filteredParentRegions.map((r) => {
                          const checked = selectedParentRegions.includes(r.parent_region_ru);
                          return (
                            <button
                              key={r.parent_region_ru}
                              onClick={() => toggleParentRegion(r.parent_region_ru)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors ${
                                checked ? "text-purple-800 dark:text-purple-300" : "text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                checked ? "bg-purple-600 border-purple-600" : "border-gray-300 dark:border-gray-600"
                              }`}>
                                {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                              {language === "uz" ? r.parent_region_uz || r.parent_region_ru : r.parent_region_ru}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Город/Район — multi-select */}
                <div className="relative flex-1 min-w-[180px]" ref={cityDropdownRef}>
                  <button
                    disabled={selectedParentRegions.length === 0}
                    onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm rounded-xl border-2 transition-all ${
                      selectedParentRegions.length === 0
                        ? "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                        : selectedRegions.length > 0
                        ? "border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 font-medium"
                        : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600"
                    } focus:outline-none`}
                  >
                    <span className="truncate">
                      {selectedRegions.length === 0
                        ? "Район (опционально)"
                        : selectedRegions.length === 1
                        ? selectedRegions[0]
                        : `${selectedRegions.length} района выбрано`}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {selectedRegions.length > 0 && (
                        <span
                          onClick={(e) => { e.stopPropagation(); setSelectedRegions([]); }}
                          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                          <X className="h-3 w-3 text-gray-400" />
                        </span>
                      )}
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </div>
                  </button>
                  {isCityDropdownOpen && selectedParentRegions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                      <div className="p-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Поиск..."
                            value={citySearch}
                            onChange={(e) => setCitySearch(e.target.value)}
                            className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg bg-gray-50 dark:bg-gray-900 border border-transparent focus:outline-none focus:border-purple-300"
                            autoFocus
                          />
                        </div>
                        {filteredRegions.length > 0 && (
                          <button
                            onClick={() => {
                              const allVisible = filteredRegions.map((r) => r.region_ru);
                              const allSelected = allVisible.every((n) => selectedRegions.includes(n));
                              setSelectedRegions(allSelected
                                ? selectedRegions.filter((n) => !allVisible.includes(n))
                                : [...new Set([...selectedRegions, ...allVisible])]
                              );
                            }}
                            className="text-xs text-purple-600 dark:text-purple-400 hover:underline shrink-0"
                          >
                            {filteredRegions.every((r) => selectedRegions.includes(r.region_ru)) ? "Снять" : "Все"}
                          </button>
                        )}
                      </div>
                      <div className="max-h-52 overflow-y-auto p-1">
                        {filteredRegions.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-400 text-center">Ничего не найдено</div>
                        ) : filteredRegions.map((r) => {
                          const checked = selectedRegions.includes(r.region_ru);
                          return (
                            <button
                              key={r.region_ru}
                              onClick={() => toggleRegion(r.region_ru)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors ${
                                checked ? "text-purple-800 dark:text-purple-300" : "text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                checked ? "bg-purple-600 border-purple-600" : "border-gray-300 dark:border-gray-600"
                              }`}>
                                {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                              {language === "uz" ? r.region_uz || r.region_ru : r.region_ru}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Order search ─────────────────────────────────────────── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Загрузить из заказа</h2>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-normal normal-case">(опционально)</span>
              </div>
              <div className="relative" ref={orderDropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  {isOrderSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-500 animate-spin" />
                  )}
                  {selectedOrderCode && !isOrderSearching && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                  <input
                    type="text"
                    value={orderQuery}
                    onChange={(e) => handleOrderQueryChange(e.target.value)}
                    onFocus={() => orderResults.length > 0 && setIsOrderDropdownOpen(true)}
                    placeholder="Введите номер заказа или телефон клиента..."
                    className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30 transition-all"
                  />
                </div>
                {isOrderDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                    {isOrderSearching ? (
                      <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Поиск...
                      </div>
                    ) : orderResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400 text-center">Заказы не найдены</div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto p-1">
                        {orderResults.map((order) => {
                          const isExpanded = expandedOrderId === order.id;
                          return (
                            <div key={order.id} className="rounded-lg mb-0.5 overflow-hidden">
                              {/* Order header row */}
                              <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors">
                                {/* Expand toggle — left part */}
                                <button
                                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                  className="flex items-start gap-2.5 flex-1 min-w-0 text-left"
                                >
                                  <div className="mt-0.5 shrink-0">
                                    <ChevronDown className={`h-4 w-4 text-purple-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{order.code}</span>
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                        order.status === "COMPLETED" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                                        order.status === "NEW" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                                        order.status === "CANCELLED" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
                                        "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                                      }`}>{order.status}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      {order.marketName && <span>{order.marketName} · </span>}
                                      {order.parentRegionRu && <span className="text-purple-500 dark:text-purple-400">{order.parentRegionRu}{order.regionRu ? ` / ${order.regionRu}` : ""} · </span>}
                                      {order.customerPhone && <span>{order.customerPhone} · </span>}
                                      <span>{order.items.length} поз.</span>
                                    </div>
                                  </div>
                                </button>
                                {/* Select button */}
                                <button
                                  onClick={() => handleSelectOrder(order)}
                                  className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                                >
                                  Выбрать
                                </button>
                              </div>

                              {/* Expanded items list */}
                              {isExpanded && (
                                <div className="bg-purple-50/50 dark:bg-purple-900/10 border-t border-purple-100 dark:border-purple-800/30 px-4 py-2 flex flex-col gap-1.5">
                                  {order.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3 text-xs text-gray-700 dark:text-gray-300">
                                      <DrugImage src={item.imageUrl} size={36} />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-800 dark:text-gray-200 truncate">{item.name}</div>
                                        {item.manufacturer && (
                                          <div className="text-gray-400 truncate">{item.manufacturer}</div>
                                        )}
                                      </div>
                                      <span className="shrink-0 text-gray-400">×{item.quantity}</span>
                                      <span className="shrink-0 text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                                        {item.price.toLocaleString("ru-RU")} сум
                                      </span>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => handleSelectOrder(order)}
                                    className="mt-1 w-full py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors text-center"
                                  >
                                    Выбрать этот заказ
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

              </div>{/* end left column */}

              {/* ── RIGHT COLUMN — Drug search + button ──────────────────── */}
              <div className="flex flex-col gap-5 order-2 lg:order-2">

            {/* ── Step 2: Drug search ───────────────────────────────────── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300 shrink-0">2</span>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Добавьте лекарства</h2>
              </div>

              {/* Search input */}
              <div className="relative" ref={drugDropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder={canSearch ? "Введите название лекарства..." : "Сначала выберите регион"}
                    value={drugQuery}
                    onChange={(e) => setDrugQuery(e.target.value)}
                    disabled={!canSearch}
                    className={`pl-10 h-11 rounded-xl ${!canSearch ? "bg-gray-50 dark:bg-gray-800 cursor-not-allowed" : ""}`}
                  />
                  {isDrugSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                    </div>
                  )}
                </div>

                {/* Typeahead dropdown */}
                {isDrugDropdownOpen && drugResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-80 overflow-y-auto">
                    {drugResults.map((drug) => (
                      <button
                        key={drug.id}
                        onClick={() => handleAddDrug(drug)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-purple-50 dark:hover:bg-purple-900/30 border-b border-gray-50 dark:border-gray-700/50 last:border-0 transition-colors"
                      >
                        <DrugImage src={drug.imageUrl} size={44} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {drug.name}
                            </span>
                            {drug.byPrescription ? (
                              <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Рецепт</span>
                            ) : (
                              <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">Без рецепта</span>
                            )}
                          </div>
                          {drug.manufacturer && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{drug.manufacturer}</div>
                          )}
                          {drug.brand && drug.brand !== drug.name && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{drug.brand}</div>
                          )}
                        </div>
                        {(drug.minPrice > 0 || drug.maxPrice > 0) && (
                          <div className="text-xs text-purple-600 dark:text-purple-400 shrink-0 text-right font-medium">
                            <div>от {formatPrice(drug.minPrice)}</div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Drug list */}
              {drugList.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {drugList.map((item) => (
                    <div
                      key={item.drug.id}
                      className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700"
                    >
                      <button
                        onClick={() => handleOpenDrugDetail(item.drug.id)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                      >
                        <DrugImage src={item.drug.imageUrl} size={40} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {item.drug.name}
                            </span>
                            {item.drug.byPrescription ? (
                              <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Рецепт</span>
                            ) : (
                              <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">Без рецепта</span>
                            )}
                          </div>
                          {item.drug.manufacturer && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                              {item.drug.manufacturer}
                            </div>
                          )}
                        </div>
                      </button>
                      {/* Quantity */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleQuantityChange(item.drug.id, -1)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-bold text-gray-800 dark:text-gray-200">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(item.drug.id, 1)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemoveDrug(item.drug.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                  <Pill className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Список лекарств пуст</p>
                  <p className="text-xs mt-0.5">Введите название и выберите из результатов</p>
                </div>
              )}
            </div>

            {/* ── Search button ─────────────────────────────────────────── */}
            <Button
              onClick={handleStockSearch}
              disabled={!canSearch || drugList.length === 0 || isStockSearching}
              className="h-12 text-base font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-md shadow-purple-200 dark:shadow-purple-900/30"
            >
              {isStockSearching ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Поиск в аптеках...
                </>
              ) : (
                <>
                  <ShoppingBag className="h-5 w-5" />
                  Найти в аптеках
                  {drugList.length > 0 && (
                    <span className="ml-1 bg-white/20 rounded-full px-2 py-0.5 text-xs">
                      {drugList.length} поз.
                    </span>
                  )}
                </>
              )}
            </Button>

              </div>{/* end left column */}
            </div>{/* end grid */}
          </div>
        </main>
      ) : (
        // ════════════════════════════════════════════════════════════════
        // STAGE 2 — Results
        // ════════════════════════════════════════════════════════════════
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Results header bar */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 flex items-center gap-4 shrink-0">
            <button
              onClick={handleBackToSearch}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Назад</span>
            </button>

            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {selectedParentRegions.join(", ")}{selectedRegions.length > 0 ? ` · ${selectedRegions.join(", ")}` : ""}
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {drugList.map((item) => (
                    <span
                      key={item.drug.id}
                      className="inline-flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full px-2 py-0.5"
                    >
                      <Pill className="h-2.5 w-2.5" />
                      {item.drug.name.length > 20 ? item.drug.name.slice(0, 20) + "…" : item.drug.name}
                      {item.quantity > 1 && <span className="font-bold">×{item.quantity}</span>}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400 shrink-0">
              <span className="font-semibold text-gray-800 dark:text-gray-200">{stockResults?.length ?? 0}</span> аптек
            </div>

            {/* View toggle */}
            <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
              <button
                onClick={() => setActiveView("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                  activeView === "list"
                    ? "bg-purple-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Список</span>
              </button>
              <button
                onClick={() => setActiveView("map")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-l border-gray-200 dark:border-gray-700 ${
                  activeView === "map"
                    ? "bg-purple-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <Map className="h-4 w-4" />
                <span className="hidden sm:inline">Карта</span>
              </button>
            </div>
          </div>

          {/* Results content */}
          <div className="flex-1 overflow-hidden">
            {stockResults === null || stockResults.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-400 dark:text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium">Аптеки не найдены</p>
                  <p className="text-xs mt-1">Ни одна аптека не имеет все выбранные лекарства</p>
                </div>
              </div>
            ) : activeView === "list" ? (
              <ListResults
                pharmacies={stockResults}
                expandedPharmacy={expandedPharmacy}
                onToggleExpand={setExpandedPharmacy}
                drugList={drugList}
              />
            ) : (
              <MapResults
                pharmacies={stockResults}
                mapContainerRef={mapContainerRef}
                selectedId={selectedMapPharmacyId}
                onSelectPharmacy={handleSelectOnMap}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── List Results ────────────────────────────────────────────────────────────────

function ListResults({
  pharmacies,
  expandedPharmacy,
  onToggleExpand,
  drugList,
}: {
  pharmacies: StockPharmacy[];
  expandedPharmacy: string | null;
  onToggleExpand: (id: string | null) => void;
  drugList: DrugListItem[];
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // After render: measure the widest name+address cell, sync all card grids to that width
  React.useLayoutEffect(() => {
    if (!containerRef.current) return;
    const cells = containerRef.current.querySelectorAll<HTMLElement>("[data-name-cell]");
    let max = 0;
    cells.forEach((el) => {
      el.style.whiteSpace = "nowrap";
      max = Math.max(max, el.scrollWidth);
      el.style.whiteSpace = "";
    });
    const rows = containerRef.current.querySelectorAll<HTMLElement>("[data-card-row]");
    rows.forEach((row) => {
      row.style.gridTemplateColumns = `auto ${max}px 1fr 1fr 1fr 1fr auto`;
    });
  }, [pharmacies]);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6" ref={containerRef}>
      <div className="space-y-3">
        {pharmacies.map((pharmacy, idx) => {
          const isExpanded = expandedPharmacy === pharmacy.id;
          return (
            <div
              key={pharmacy.id}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
            >
              <button
                data-card-row
                onClick={() => onToggleExpand(isExpanded ? null : pharmacy.id)}
                className="w-full grid items-center gap-4 p-5 text-left hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors"
                style={{ gridTemplateColumns: "auto max-content 1fr 1fr 1fr 1fr auto" }}
              >
                {/* Rank + image */}
                <div className="relative shrink-0">
                  <PharmacyImage src={pharmacy.imageUrl} size={72} />
                  <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center shadow">
                    {idx + 1}
                  </span>
                </div>

                {/* Name + address */}
                <div data-name-cell>
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-base leading-tight whitespace-nowrap">
                    {pharmacy.name}
                  </div>
                  {pharmacy.address && (
                    <div className="flex items-start gap-1 mt-1">
                      <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{pharmacy.address}</span>
                    </div>
                  )}
                </div>

                {/* Phone */}
                <div className="flex justify-center">
                  {pharmacy.phone ? (
                    <a
                      href={`tel:${pharmacy.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {pharmacy.phone}
                    </a>
                  ) : <span />}
                </div>

                {/* Hours */}
                <div className="flex justify-center">
                  {pharmacy.openTime && pharmacy.closeTime ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm whitespace-nowrap">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {pharmacy.openTime.slice(0, 5)} – {pharmacy.closeTime.slice(0, 5)}
                    </span>
                  ) : <span />}
                </div>

                {/* Positions */}
                <div className="flex justify-center">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-medium whitespace-nowrap">
                    {pharmacy.products.length} поз.
                  </span>
                </div>

                {/* Price */}
                <div className="text-lg font-bold text-purple-700 dark:text-purple-400 whitespace-nowrap text-right">
                  {formatPrice(pharmacy.totalAmount)}
                </div>

                {/* Expand */}
                <Expand className={`h-5 w-5 text-gray-400 transition-transform justify-self-center ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {pharmacy.products.map((product) => {
                      const imageUrl = drugList.find((d) => d.drug.id === product.id)?.drug.imageUrl ?? null;
                      const expiry = product.expiration
                        ? new Date(product.expiration).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : null;
                      return (
                        <div key={product.id} className="flex items-center gap-4 px-5 py-4">
                          <DrugImage src={imageUrl} size={52} />
                          <div className="flex-1 min-w-0">
                            <div className="text-base font-semibold text-gray-800 dark:text-gray-200">{product.name}</div>
                            {product.manufacturer && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{product.manufacturer}</div>
                            )}
                            <div className="flex items-center gap-4 mt-1 flex-wrap">
                              {expiry && (
                                <span className="text-sm text-gray-400">Годен до: {expiry}</span>
                              )}
                              <span className="text-sm text-gray-400">В наличии: {product.stock} шт.</span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-base font-bold text-gray-800 dark:text-gray-200">{formatPrice(product.price)}</div>
                            <div className="text-sm text-gray-400 mt-0.5">× {product.quantity} = {formatPrice(product.total)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-end px-5 py-3 bg-purple-50 dark:bg-purple-900/20">
                    <div className="text-base font-bold text-purple-700 dark:text-purple-300">
                      Итого: {formatPrice(pharmacy.totalAmount)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Map Results ────────────────────────────────────────────────────────────────

function MapResults({
  pharmacies,
  mapContainerRef,
  selectedId,
  onSelectPharmacy,
}: {
  pharmacies: StockPharmacy[];
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
  selectedId: string | null;
  onSelectPharmacy: (pharmacy: StockPharmacy) => void;
}) {
  const withCoords = pharmacies.filter((p) => p.latitude && p.longitude);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Scroll selected item into view in sidebar
  useEffect(() => {
    if (!selectedId) return;
    const el = itemRefs.current[selectedId];
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <div className="flex h-full w-full relative">
      {/* Sidebar */}
      <div ref={sidebarRef} className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col overflow-hidden z-10">
        <div className="p-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">На карте</div>
          <div className="text-lg font-bold text-gray-800 dark:text-gray-200 mt-0.5">
            {withCoords.length}
            <span className="text-xs font-normal text-gray-400 ml-1">из {pharmacies.length} аптек</span>
          </div>
          {withCoords.length < pharmacies.length && (
            <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              {pharmacies.length - withCoords.length} без координат
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
          {pharmacies.map((p, idx) => {
            const isSelected = selectedId === p.id;
            const hasCoords = !!(p.latitude && p.longitude);
            return (
              <button
                key={p.id}
                ref={(el) => { itemRefs.current[p.id] = el; }}
                onClick={() => hasCoords && onSelectPharmacy(p)}
                disabled={!hasCoords}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  isSelected
                    ? "bg-purple-50 dark:bg-purple-900/30 border-l-2 border-purple-500"
                    : hasCoords
                    ? "hover:bg-gray-50 dark:hover:bg-gray-700/40 border-l-2 border-transparent"
                    : "opacity-50 cursor-default border-l-2 border-transparent"
                }`}
              >
                <span className={`text-xs font-mono shrink-0 w-5 text-center ${isSelected ? "text-purple-600 dark:text-purple-400 font-bold" : "text-gray-400"}`}>
                  {idx + 1}
                </span>
                <PharmacyImage src={p.imageUrl} size={32} />
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-medium truncate ${isSelected ? "text-purple-700 dark:text-purple-300" : "text-gray-800 dark:text-gray-200"}`}>
                    {p.name}
                  </div>
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold">{formatPrice(p.totalAmount)}</div>
                  {!hasCoords && <div className="text-xs text-gray-400 italic">нет координат</div>}
                </div>
                {isSelected && <MapPin className="h-3.5 w-3.5 text-purple-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative h-full z-0">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
        {withCoords.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="text-center text-gray-400">
              <MapPin className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Нет координат для отображения</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
