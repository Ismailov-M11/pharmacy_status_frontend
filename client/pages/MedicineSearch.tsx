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
  FilterX,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMedicineFilterOptions,
  searchDrugs,
  searchStock,
  DrugItem,
  DrugListItem,
  StockPharmacy,
  MedicineFilterOptions,
} from "@/lib/medicineApi";

// ─── Constants ─────────────────────────────────────────────────────────────────

const UZBEKISTAN_CENTER = [41.2995, 69.2401];

declare global {
  interface Window {
    ymaps: any;
  }
}

type ViewTab = "list" | "map";

// ─── Format helpers ─────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return price.toLocaleString("ru-RU") + " сум";
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function MedicineSearch() {
  const { language } = useLanguage();
  const { token, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  // ── Region selectors ───────────────────────────────────────────────────────
  const [filterOptions, setFilterOptions] = useState<MedicineFilterOptions>({
    parentRegions: [],
    regions: [],
  });
  const [selectedParentRegion, setSelectedParentRegion] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<string>("");
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

  // ── Drug list ──────────────────────────────────────────────────────────────
  const [drugList, setDrugList] = useState<DrugListItem[]>([]);

  // ── Stock search results ───────────────────────────────────────────────────
  const [isStockSearching, setIsStockSearching] = useState(false);
  const [stockResults, setStockResults] = useState<StockPharmacy[] | null>(null);
  const [activeView, setActiveView] = useState<ViewTab>("list");
  const [expandedPharmacy, setExpandedPharmacy] = useState<string | null>(null);

  // ── Map ────────────────────────────────────────────────────────────────────
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !token) navigate("/login");
  }, [token, authLoading, navigate]);

  // ── Load filter options ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    getMedicineFilterOptions(token)
      .then(setFilterOptions)
      .catch(() => toast.error("Не удалось загрузить список регионов"));
  }, [token]);

  // ── Reload city list when parent region changes ────────────────────────────
  useEffect(() => {
    if (!token || !selectedParentRegion) return;
    getMedicineFilterOptions(token, selectedParentRegion)
      .then((opts) =>
        setFilterOptions((prev) => ({ ...prev, regions: opts.regions }))
      )
      .catch(() => {});
    setSelectedRegion("");
  }, [token, selectedParentRegion]);

  // ── Close dropdowns on outside click ──────────────────────────────────────
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(e.target as Node))
        setIsRegionDropdownOpen(false);
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node))
        setIsCityDropdownOpen(false);
      if (drugDropdownRef.current && !drugDropdownRef.current.contains(e.target as Node))
        setIsDrugDropdownOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ── Drug typeahead ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (drugSearchTimeout.current) clearTimeout(drugSearchTimeout.current);
    if (!drugQuery.trim() || drugQuery.length < 2 || !token) {
      setDrugResults([]);
      setIsDrugDropdownOpen(false);
      return;
    }
    drugSearchTimeout.current = setTimeout(async () => {
      setIsDrugSearching(true);
      try {
        const res = await searchDrugs(token, drugQuery);
        setDrugResults(res.items);
        setIsDrugDropdownOpen(res.items.length > 0);
      } catch (err: any) {
        toast.error(err.message || "Ошибка поиска лекарств");
        setDrugResults([]);
      } finally {
        setIsDrugSearching(false);
      }
    }, 350);
    return () => {
      if (drugSearchTimeout.current) clearTimeout(drugSearchTimeout.current);
    };
  }, [drugQuery, token]);

  // ── Add drug to list ───────────────────────────────────────────────────────
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
        item.drug.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  // ── Stock search ───────────────────────────────────────────────────────────
  const handleStockSearch = async () => {
    if (!token || drugList.length === 0 || !selectedParentRegion) return;
    setIsStockSearching(true);
    setStockResults(null);
    setExpandedPharmacy(null);
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
        selectedParentRegion,
        selectedRegion || undefined
      );
      setStockResults(res.pharmacies);
      if (res.pharmacies.length === 0) {
        toast.info("Аптеки, где есть все выбранные лекарства, не найдены");
      }
    } catch (err: any) {
      toast.error(err.message || "Ошибка поиска в аптеках");
    } finally {
      setIsStockSearching(false);
    }
  };

  // ── Map init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeView !== "map" || mapInitialized.current || !stockResults) return;

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
  }, [activeView, stockResults]);

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
    const collection = new window.ymaps.GeoObjectCollection();
    stockResults.forEach((pharmacy) => {
      const lat = Number(pharmacy.latitude);
      const lon = Number(pharmacy.longitude);
      if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;

      const drugsList = pharmacy.products
        .map((p) => `<div style="margin-top:4px;">• ${p.name}: <b>${formatPrice(p.price)}</b> × ${p.quantity} = ${formatPrice(p.total)}</div>`)
        .join("");

      const placemark = new window.ymaps.Placemark(
        [lat, lon],
        {
          balloonContent: `
            <div style="padding:12px; font-family:Arial,sans-serif; max-width:320px;">
              <div style="font-weight:bold; font-size:14px; margin-bottom:6px;">${pharmacy.name}</div>
              ${pharmacy.address ? `<div style="font-size:12px; color:#666; margin-bottom:4px;">📍 ${pharmacy.address}</div>` : ""}
              ${pharmacy.phone ? `<div style="font-size:12px; color:#666; margin-bottom:4px;">📞 <a href="tel:${pharmacy.phone}" style="color:#3b82f6;">${pharmacy.phone}</a></div>` : ""}
              ${pharmacy.openTime && pharmacy.closeTime ? `<div style="font-size:12px; color:#666; margin-bottom:8px;">🕐 ${pharmacy.openTime.slice(0,5)} – ${pharmacy.closeTime.slice(0,5)}</div>` : ""}
              <div style="font-size:12px; color:#333;">${drugsList}</div>
              <div style="margin-top:8px; padding-top:6px; border-top:1px solid #eee; font-size:13px; font-weight:bold; color:#7c3aed;">
                Итого: ${formatPrice(pharmacy.totalAmount)}
              </div>
            </div>
          `,
        },
        { preset: "islands#violetDotIcon" }
      );
      collection.add(placemark);
    });
    mapRef.current.geoObjects.add(collection);

    // Fit bounds if there are markers
    if (collection.getLength() > 0) {
      try {
        mapRef.current.setBounds(collection.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
      } catch {}
    }
  }, [stockResults]);

  useEffect(() => {
    if (activeView === "map" && mapInitialized.current && stockResults) {
      renderMapMarkers();
    }
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
        <span className="text-gray-500 dark:text-gray-400">Загрузка...</span>
      </div>
    );
  }

  const canSearch = !!selectedParentRegion;
  const filteredParentRegions = filterOptions.parentRegions.filter((r) =>
    r.parent_region_ru.toLowerCase().includes(regionSearch.toLowerCase())
  );
  const filteredRegions = filterOptions.regions.filter((r) =>
    r.region_ru.toLowerCase().includes(citySearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Header />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* ── Top control bar ───────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex flex-col gap-4 shrink-0 relative z-20">
          {/* Title */}
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Справочник лекарств
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Поиск лекарств в аптеках OSON по регионам
            </p>
          </div>

          {/* Region + City selectors */}
          <div className="flex flex-wrap gap-3">
            {/* Регион (required) */}
            <div className="relative w-64" ref={regionDropdownRef}>
              <button
                onClick={() => setIsRegionDropdownOpen(!isRegionDropdownOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md border transition-colors ${
                  selectedParentRegion
                    ? "border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300"
                    : "border-red-300 dark:border-red-700 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                } hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none`}
              >
                <span className="truncate">
                  {selectedParentRegion || (
                    <span className="text-red-500 dark:text-red-400">
                      * Выберите регион
                    </span>
                  )}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 ml-2" />
              </button>
              {isRegionDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
                  <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Поиск региона..."
                        value={regionSearch}
                        onChange={(e) => setRegionSearch(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 text-sm rounded bg-gray-50 dark:bg-gray-900 border border-transparent focus:outline-none focus:border-purple-300"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto p-1">
                    {filteredParentRegions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400 text-center">Ничего не найдено</div>
                    ) : filteredParentRegions.map((r) => (
                      <button
                        key={r.parent_region_ru}
                        onClick={() => {
                          setSelectedParentRegion(r.parent_region_ru);
                          setIsRegionDropdownOpen(false);
                          setRegionSearch("");
                          setStockResults(null);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors ${
                          selectedParentRegion === r.parent_region_ru
                            ? "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 font-medium"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {language === "uz" ? r.parent_region_uz || r.parent_region_ru : r.parent_region_ru}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Город/Район (optional) */}
            <div className="relative w-64" ref={cityDropdownRef}>
              <button
                disabled={!selectedParentRegion}
                onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md border transition-colors ${
                  !selectedParentRegion
                    ? "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                    : selectedRegion
                    ? "border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300"
                    : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600"
                } focus:outline-none`}
              >
                <span className="truncate">
                  {selectedRegion || "Город / Район (опционально)"}
                </span>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {selectedRegion && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRegion("");
                        setStockResults(null);
                      }}
                      className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      <FilterX className="h-3 w-3 text-gray-400" />
                    </div>
                  )}
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              </button>
              {isCityDropdownOpen && selectedParentRegion && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
                  <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Поиск города/района..."
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 text-sm rounded bg-gray-50 dark:bg-gray-900 border border-transparent focus:outline-none focus:border-purple-300"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto p-1">
                    {filteredRegions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400 text-center">Ничего не найдено</div>
                    ) : filteredRegions.map((r) => (
                      <button
                        key={r.region_ru}
                        onClick={() => {
                          setSelectedRegion(r.region_ru);
                          setIsCityDropdownOpen(false);
                          setCitySearch("");
                          setStockResults(null);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors ${
                          selectedRegion === r.region_ru
                            ? "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 font-medium"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {language === "uz" ? r.region_uz || r.region_ru : r.region_ru}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Drug search input */}
          <div className="flex gap-3 flex-wrap items-start">
            <div className="relative flex-1 min-w-[280px]" ref={drugDropdownRef}>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={
                    canSearch
                      ? "Введите название лекарства..."
                      : "Сначала выберите регион"
                  }
                  value={drugQuery}
                  onChange={(e) => setDrugQuery(e.target.value)}
                  disabled={!canSearch}
                  className={`pl-9 ${
                    !canSearch
                      ? "bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                      : "bg-white dark:bg-gray-700"
                  }`}
                />
                {isDrugSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
                  </div>
                )}
              </div>

              {/* Drug typeahead dropdown */}
              {isDrugDropdownOpen && drugResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-xl max-h-72 overflow-y-auto">
                  {drugResults.map((drug) => (
                    <button
                      key={drug.id}
                      onClick={() => handleAddDrug(drug)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-purple-50 dark:hover:bg-purple-900/30 border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors group"
                    >
                      <div className="mt-0.5 w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                        <Pill className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-purple-700 dark:group-hover:text-purple-300">
                          {drug.name}
                        </div>
                        {drug.manufacturer && (
                          <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {drug.manufacturer}
                          </div>
                        )}
                      </div>
                      {(drug.minPrice > 0 || drug.maxPrice > 0) && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 shrink-0 text-right">
                          <div>от {formatPrice(drug.minPrice)}</div>
                          {drug.maxPrice !== drug.minPrice && (
                            <div>до {formatPrice(drug.maxPrice)}</div>
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search in pharmacies button */}
            <Button
              onClick={handleStockSearch}
              disabled={!canSearch || drugList.length === 0 || isStockSearching}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2 shrink-0"
            >
              {isStockSearching ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Поиск...
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  Найти в аптеках
                </>
              )}
            </Button>
          </div>

          {/* Drug list */}
          {drugList.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                Список лекарств ({drugList.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {drugList.map((item) => (
                  <div
                    key={item.drug.id}
                    className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg px-3 py-1.5 text-sm"
                  >
                    <Pill className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                    <span className="text-gray-800 dark:text-gray-200 max-w-[200px] truncate">
                      {item.drug.name}
                    </span>
                    {/* Quantity controls */}
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        onClick={() => handleQuantityChange(item.drug.id, -1)}
                        className="w-5 h-5 rounded flex items-center justify-center bg-purple-200 dark:bg-purple-800 hover:bg-purple-300 dark:hover:bg-purple-700 text-purple-800 dark:text-purple-300 transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(item.drug.id, 1)}
                        className="w-5 h-5 rounded flex items-center justify-center bg-purple-200 dark:bg-purple-800 hover:bg-purple-300 dark:hover:bg-purple-700 text-purple-800 dark:text-purple-300 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => handleRemoveDrug(item.drug.id)}
                      className="ml-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Results section ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden relative">
          {isStockSearching ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Поиск лекарств в аптеках...
                </span>
              </div>
            </div>
          ) : stockResults === null ? (
            <EmptyState canSearch={canSearch} drugListEmpty={drugList.length === 0} />
          ) : stockResults.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400 dark:text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Аптеки не найдены</p>
                <p className="text-xs mt-1 max-w-xs">
                  Ни одна аптека не имеет все выбранные лекарства в данном регионе
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* View toggle — at the very top of results */}
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Найдено аптек: <span className="font-semibold text-gray-800 dark:text-gray-200">{stockResults.length}</span>
                </span>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
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

              {/* Content */}
              {activeView === "list" ? (
                <ListResults
                  pharmacies={stockResults}
                  expandedPharmacy={expandedPharmacy}
                  onToggleExpand={setExpandedPharmacy}
                />
              ) : (
                <MapResults
                  pharmacies={stockResults}
                  mapContainerRef={mapContainerRef}
                />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ canSearch, drugListEmpty }: { canSearch: boolean; drugListEmpty: boolean }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-gray-400 dark:text-gray-500 max-w-sm px-4">
        <ShoppingBag className="h-14 w-14 mx-auto mb-4 opacity-30" />
        {!canSearch ? (
          <>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Выберите регион
            </p>
            <p className="text-xs mt-1">
              Для поиска лекарств необходимо выбрать регион
            </p>
          </>
        ) : drugListEmpty ? (
          <>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Добавьте лекарства
            </p>
            <p className="text-xs mt-1">
              Введите название лекарства в поиск и добавьте в список
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Нажмите «Найти в аптеках»
            </p>
            <p className="text-xs mt-1">
              Поиск по всем подключённым аптекам выбранного региона
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── List Results ────────────────────────────────────────────────────────────────

function ListResults({
  pharmacies,
  expandedPharmacy,
  onToggleExpand,
}: {
  pharmacies: StockPharmacy[];
  expandedPharmacy: string | null;
  onToggleExpand: (id: string | null) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
      {pharmacies.map((pharmacy, idx) => {
        const isExpanded = expandedPharmacy === pharmacy.id;
        return (
          <div
            key={pharmacy.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
          >
            {/* Pharmacy header */}
            <button
              onClick={() => onToggleExpand(isExpanded ? null : pharmacy.id)}
              className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              {/* Rank */}
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">{idx + 1}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                      {pharmacy.name}
                    </div>
                    {pharmacy.address && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {pharmacy.address}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {pharmacy.phone && (
                        <a
                          href={`tel:${pharmacy.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          <Phone className="h-3 w-3" /> {pharmacy.phone}
                        </a>
                      )}
                      {pharmacy.openTime && pharmacy.closeTime && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          {pharmacy.openTime.slice(0, 5)} – {pharmacy.closeTime.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-base font-bold text-purple-700 dark:text-purple-400">
                      {formatPrice(pharmacy.totalAmount)}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {pharmacy.products.length} поз.
                    </div>
                  </div>
                </div>
              </div>

              <Expand
                className={`h-4 w-4 text-gray-400 shrink-0 mt-1 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>

            {/* Expanded drug details */}
            {isExpanded && (
              <div className="border-t border-gray-100 dark:border-gray-700">
                <div className="divide-y divide-gray-50 dark:divide-gray-700">
                  {pharmacy.products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <Pill className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">
                            {product.name}
                          </div>
                          {product.manufacturer && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                              {product.manufacturer}
                            </div>
                          )}
                          {product.expiration && (
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              Годен до: {product.expiration}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            В наличии: {product.stock} шт.
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {formatPrice(product.price)}
                        </div>
                        <div className="text-xs text-gray-400">
                          × {product.quantity} = {formatPrice(product.total)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 border-t border-purple-100 dark:border-purple-900/30">
                  <div className="text-sm font-bold text-purple-700 dark:text-purple-300">
                    Итого: {formatPrice(pharmacy.totalAmount)}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Map Results ────────────────────────────────────────────────────────────────

function MapResults({
  pharmacies,
  mapContainerRef,
}: {
  pharmacies: StockPharmacy[];
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const withCoords = pharmacies.filter((p) => p.latitude && p.longitude);

  return (
    <div className="flex h-full w-full relative">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col overflow-y-auto z-10">
        <div className="p-3 border-b border-gray-100 dark:border-gray-700">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            На карте
          </div>
          <div className="text-lg font-bold text-gray-800 dark:text-gray-200 mt-0.5">
            {withCoords.length}
            <span className="text-xs font-normal text-gray-400 ml-1">из {pharmacies.length} аптек</span>
          </div>
          {withCoords.length < pharmacies.length && (
            <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              {pharmacies.length - withCoords.length} аптек без координат
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
          {pharmacies.map((p, idx) => (
            <div key={p.id} className="px-3 py-2.5">
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-400 font-mono shrink-0 mt-0.5">{idx + 1}</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                    {p.name}
                  </div>
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold">
                    {formatPrice(p.totalAmount)}
                  </div>
                  {!p.latitude && !p.longitude && (
                    <div className="text-xs text-gray-400 italic">нет координат</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative h-full z-0 bg-gray-100 dark:bg-gray-900">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
        {withCoords.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="text-center text-gray-400 dark:text-gray-500">
              <MapPin className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Нет координат для отображения на карте</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
