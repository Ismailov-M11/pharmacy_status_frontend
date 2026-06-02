import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getLeadsList, getPharmacyList, Pharmacy, getUserColumnSettings, saveUserColumnSettings, ColumnSettings, updatePharmacyStatusLocal, updateLeadStatus, getBatchPharmacyData } from "@/lib/api";
import { PharmacyTable } from "@/components/PharmacyTable";
import { Header } from "@/components/Header";
import { PharmacyDetailModal } from "@/components/PharmacyDetailModal";
import { ColumnSettingsModal } from "@/components/ColumnSettingsModal";
import { SettingsMenuModal } from "@/components/SettingsMenuModal";
import { StirFilterModal } from "@/components/StirFilterModal";
import { GenericFilterModal } from "@/components/GenericFilterModal";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";


export default function LeadsPanel() {
    const { t } = useLanguage();
    const { token, authLoading, user, role } = useAuth();
    const navigate = useNavigate();

    const [leads, setLeads] = useState<Pharmacy[]>([]);
    const [filteredLeads, setFilteredLeads] = useState<Pharmacy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(50);

    // Modal State
    const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [initialModalTab, setInitialModalTab] = useState<"details" | "files" | "leadHistory">("details");

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState<boolean | null>(null);
    const [leadStatusFilter, setLeadStatusFilter] = useState<string | null>(null);
    const [commentUserFilter, setCommentUserFilter] = useState<string | null>(null);
    const [commentDateFilter, setCommentDateFilter] = useState<{ from: string | null, to: string | null }>({ from: null, to: null });
    const [stirFilter, setStirFilter] = useState<string[]>([]);
    const [stirSortOrder, setStirSortOrder] = useState<'asc' | 'desc' | null>(null);
    const [isStirModalOpen, setIsStirModalOpen] = useState(false);
    const [stirHeaderRef, setStirHeaderRef] = useState<HTMLElement | null>(null);
    const [telegramBotFilter, setTelegramBotFilter] = useState<boolean | null>(null);
    const [brandedPacketFilter, setBrandedPacketFilter] = useState<boolean | null>(null);
    const [trainingFilter, setTrainingFilter] = useState<boolean | null>(null);

    const [merchantStatusFilter, setMerchantStatusFilter] = useState<boolean | null>(null);
    const [davoContractFilter, setDavoContractFilter] = useState<string | null>(null);

    // Region and District filters with modal support
    const [regionFilter, setRegionFilter] = useState<string[]>([]);
    const [regionSortOrder, setRegionSortOrder] = useState<'asc' | 'desc' | null>(null);
    const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
    const [regionHeaderRef, setRegionHeaderRef] = useState<HTMLElement | null>(null);

    const [districtFilter, setDistrictFilter] = useState<string[]>([]);
    const [districtSortOrder, setDistrictSortOrder] = useState<'asc' | 'desc' | null>(null);
    const [isDistrictModalOpen, setIsDistrictModalOpen] = useState(false);
    const [districtHeaderRef, setDistrictHeaderRef] = useState<HTMLElement | null>(null);

    // Leads-specific features
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
    const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
    const [columnSettings, setColumnSettings] = useState<ColumnSettings[]>([]);

    // Derive unique statuses from current data
    const leadStatusOptions = useMemo(() => {
        const statuses = new Set<string>();
        leads.forEach(l => {
            if (l.lead?.status) statuses.add(l.lead.status);
        });
        return Array.from(statuses).sort();
    }, [leads]);

    const commentUserOptions = useMemo(() => {
        const users = new Set<string>();
        leads.forEach(l => {
            if (l.comments && l.comments.length > 0) {
                // Sort comments to find last one
                const sortedFn = (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                const last = [...l.comments].sort(sortedFn)[0];
                if (last.creator?.phone) users.add(last.creator.phone);
            }
        });
        return Array.from(users).sort();
    }, [leads]);

    // Unique region values for filtering
    const regionOptions = useMemo(() => {
        const regions = new Set<string>();
        leads.forEach(l => {
            const regionName = typeof l.region === 'object' && l.region?.name ? l.region.name : (typeof l.region === 'string' ? l.region : null);
            if (regionName) regions.add(regionName);
        });
        return Array.from(regions).sort();
    }, [leads]);

    // Unique district values for filtering
    const districtOptions = useMemo(() => {
        const districts = new Set<string>();
        leads.forEach(l => {
            if (l.district) districts.add(l.district);
        });
        return Array.from(districts).sort();
    }, [leads]);

    // Unique STIR values for filtering - from FILTERED leads
    const uniqueStirs = useMemo(() => {
        const stirSet = new Set<string>();
        filteredLeads.forEach(l => {
            if (l.stir) stirSet.add(l.stir);
        });
        return Array.from(stirSet).sort();
    }, [filteredLeads]);

    // Default Columns Definition
    const defaultColumns: ColumnSettings[] = useMemo(() => [
        { id: "number", label: t.number || "№", visible: true, order: 0 },
        { id: "code", label: t.code || "Code", visible: true, order: 1 },
        { id: "name", label: t.pharmacyName || "Name", visible: true, order: 2 },
        { id: "address", label: t.address || "Address", visible: true, order: 3 },
        { id: "landmark", label: t.landmark || "Landmark", visible: true, order: 4 },
        { id: "pharmacyPhone", label: t.pharmacyPhone || "Phone", visible: true, order: 5 },
        { id: "leadPhone", label: t.leadPhone || "Lead Phone", visible: true, order: 6 },
        { id: "merchantStatus", label: t.merchantStatus || "Merchant - статус", visible: true, order: 8 },
        { id: "davoContract", label: (t as any).davoContract || "Davo - договор", visible: true, order: 8.5 },
        { id: "telegramBot", label: t.telegramBot || "Bot", visible: true, order: 9 },
        { id: "training", label: t.training || "Training", visible: true, order: 10 },
        { id: "brandedPacket", label: t.brandedPacket || "Packet", visible: true, order: 11 },
        { id: "status", label: t.status || "Status", visible: true, order: 12 },
        { id: "leadStatus", label: t.leadStatus || "Lead Status", visible: true, order: 12 },
        { id: "comments", label: t.comments || "Comments", visible: true, order: 13 },
        { id: "commentUser", label: t.commentUser || "Comment User", visible: true, order: 14 },
        { id: "commentDate", label: t.commentDate || "Comment Date", visible: true, order: 15 },

        { id: "region", label: t.region || "Region", visible: true, order: 7 },
        { id: "district", label: t.district || "District", visible: true, order: 8 },
        { id: "stir", label: t.stir || "СТИР", visible: true, order: 19 },
        { id: "additionalPhone", label: t.additionalPhone || "Доп. телефон Lead", visible: true, order: 20 },
        { id: "juridicalName", label: t.juridicalName || "Юридическое название", visible: true, order: 21 },
        { id: "juridicalAddress", label: t.juridicalAddress || "Юридический адрес", visible: true, order: 22 },
        { id: "bankName", label: t.bankName || "Название банка", visible: true, order: 23 },
        { id: "bankAccount", label: t.bankAccount || "Банковский счет", visible: true, order: 24 },
        { id: "mfo", label: t.mfo || "МФО", visible: true, order: 25 },
    ], [t]);

    // Data Fetching

    // Fetch data function - defined here so it can be called by refresh button
    const fetchData = async () => {
        if (!token) return;

        setIsLoading(true);
        try {
            // 1. Parallel Fetch: Leads and Market List
            const [leadsResponse, marketResponse] = await Promise.all([
                getLeadsList(token, "", 0, 10000),
                getPharmacyList(token, "", 0, null, 10000)
            ]);

            const rawLeads = leadsResponse.payload.list || [];
            const marketList = marketResponse.payload.list || [];

            // Create Map of Market Pharmacies by Lead ID for integration
            const marketMap = new Map<number, Pharmacy>();
            marketList.forEach(p => {
                if (p.lead && p.lead.id) {
                    marketMap.set(p.lead.id, p);
                }
            });

            // 2. Single batch request: training + brandedPacket + merchantOnline + davoContract
            const batchItems = rawLeads.map((item: any) => {
                const marketMatch = marketMap.get(item.id);
                return {
                    marketId: marketMatch?.id ?? null,
                    tin: item?.stir || marketMatch?.stir || null,
                };
            });

            const batchResult = await getBatchPharmacyData(token!, batchItems);

            // 3. Map and Merge Data
            const mappedLeads = rawLeads.map((item: any) => {
                const marketMatch = marketMap.get(item.id);
                const batch = batchResult[marketMatch?.id ?? 0] || {
                    training: false,
                    brandedPacket: false,
                    merchantOnline: false,
                    davoContract: null,
                };

                const pharmacy: Pharmacy = {
                    ...item,
                    id: item.id,
                    code: item.code || "LEAD",
                    name: item.name || "Unknown Lead",
                    address: item.address || "",
                    phone: item.phone || "",
                    active: marketMatch ? marketMatch.active : false,
                    lead: item,
                    marketChats: marketMatch ? marketMatch.marketChats : [],
                    brandedPacket: batch.brandedPacket,
                    training: batch.training,
                    merchantOnline: batch.merchantOnline,
                    davoContract: batch.davoContract,
                    creationDate: item.creationDate || new Date().toISOString(),
                    modifiedDate: item.modifiedDate || new Date().toISOString(),
                    comments: item.coments || item.comments || [],
                    ...(marketMatch ? { marketCode: marketMatch.code } : {}),
                } as any;

                return pharmacy;
            });

            setLeads(mappedLeads);
            // filteredLeads will be updated by the filter useEffect
        } catch (error) {
            console.error("Failed to fetch leads data:", error);
            toast.error(t.error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Auth Check
        if (authLoading) return;
        if (!token) {
            navigate("/login");
            return;
        }

        // Initialize Column Settings
        const initColumnSettings = async () => {
            if (token && user?.username) {
                try {
                    const savedSettings = await getUserColumnSettings(token, user.username);
                    if (savedSettings && savedSettings.length > 0) {
                        // Merge saved settings with defaults to ensure all columns exist
                        // This handles cases where new columns are added to the app
                        const mergedSettings = defaultColumns.map(defCol => {
                            const saved = savedSettings.find((s: ColumnSettings) => s.id === defCol.id);
                            return saved ? { ...defCol, ...saved } : defCol;
                        });

                        // Sort by order
                        mergedSettings.sort((a, b) => a.order - b.order);
                        setColumnSettings(mergedSettings);
                    } else {
                        setColumnSettings(defaultColumns);
                    }
                } catch (error) {
                    console.error("Failed to fetch column settings:", error);
                    setColumnSettings(defaultColumns);
                }
            }
        };

        initColumnSettings();
        fetchData();
    }, [token, authLoading, navigate, t.error, user?.username, defaultColumns]);

    const handleUpdateStatus = async (
        pharmacyId: number,
        field: "brandedPacket" | "training",
        value: boolean,
        comment: string
    ) => {
        try {
            await updatePharmacyStatusLocal(
                pharmacyId,
                field,
                value,
                comment,
                user?.username || "User"
            );

            // Update local state
            setLeads(current => current.map(p => {
                if (p.id === pharmacyId) {
                    return { ...p, [field]: value };
                }
                return p;
            }));

            // Allow time for DB propagation before refetching or just rely on local state
            if (selectedPharmacy && selectedPharmacy.id === pharmacyId) {
                setSelectedPharmacy(prev => prev ? { ...prev, [field]: value } : null);
            }

        } catch (error) {
            console.error("Failed to update status", error);
            throw error;
        }
    };

    const handleCopyRequisites = () => {
        const seen = new Set<string>();
        const unique: Pharmacy[] = [];

        const source = selectedRows.size > 0
            ? leads.filter(p => selectedRows.has(p.id))
            : filteredLeads;

        for (const lead of source) {
            const key = lead.stir && lead.stir.trim() ? lead.stir.trim() : `__id_${lead.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(lead);
            }
        }

        if (unique.length > 200) {
            toast.error("Нельзя копировать более 200 реквизитов. Отфильтруйте данные.");
            return;
        }

        const text = unique.map((lead, i) => [
            `${i + 1}) ${lead.stir || ''}`,
            lead.juridicalName || '',
            lead.juridicalAddress || '',
            lead.bankName || '',
            `${lead.bankAccount || ''}\t${lead.mfo || ''}`,
        ].join('\n')).join('\n\n');

        navigator.clipboard.writeText(text).then(() => {
            toast.success(`Скопировано ${unique.length} реквизитов`);
        }).catch(() => {
            toast.error("Ошибка копирования");
        });
    };

    const handleDownload = () => {
        const getLastCommentLocal = (comments: any[]) => {
            if (!comments || comments.length === 0) return null;
            return [...comments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        };

        const headers = [
            '№', 'Код', 'Название аптеки', 'Адрес', 'Ориентир',
            'Телефон аптеки', 'Телефон Lead', 'Merchant статус', 'Telegram Bot',
            'Обучение', 'Пакет', 'Статус', 'Lead Статус',
            'Последний комментарий', 'Автор комментария', 'Дата комментария',
            'Регион', 'Район', 'СТИР', 'Доп. телефон',
            'Юридическое название', 'Юридический адрес',
            'Название банка', 'Банковский счет', 'МФО',
        ];

        const downloadSource = selectedRows.size > 0
            ? leads.filter(p => selectedRows.has(p.id))
            : filteredLeads;

        const rows = downloadSource.map((p, i) => {
            const lastComment = getLastCommentLocal(p.comments || []);
            const regionName = typeof p.region === 'object' && p.region?.name
                ? p.region.name
                : (typeof p.region === 'string' ? p.region : '');
            const commentDate = lastComment
                ? new Date(lastComment.createdAt).toLocaleString('ru-RU')
                : '';

            return [
                i + 1,
                (p as any).marketCode || p.code,
                p.name,
                p.address,
                p.landmark || '',
                p.phone || '',
                p.lead?.phone || '',
                p.merchantOnline ? 'Online' : 'Offline',
                (p.marketChats && p.marketChats.length > 0) ? 'Да' : 'Нет',
                p.training ? 'Да' : 'Нет',
                p.brandedPacket ? 'Да' : 'Нет',
                p.active ? 'Активна' : 'Неактивна',
                p.lead?.status || '',
                lastComment?.coment || '',
                lastComment?.creator?.phone || '',
                commentDate,
                regionName,
                p.district || '',
                p.stir || '',
                p.additionalPhone || '',
                p.juridicalName || '',
                p.juridicalAddress || '',
                p.bankName || '',
                p.bankAccount || '',
                p.mfo || '',
            ];
        });

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Лиды');
        XLSX.writeFile(wb, `leads_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleUpdateLeadStatus = async (status: string) => {
        const selectedPharmacies = leads.filter(p => selectedRows.has(p.id));
        if (selectedPharmacies.length === 0) return;

        let successCount = 0;
        let errorCount = 0;

        for (const pharmacy of selectedPharmacies) {
            if (pharmacy.lead?.id) {
                try {
                    await updateLeadStatus(token!, pharmacy.lead.id, status);
                    successCount++;
                } catch {
                    errorCount++;
                }
            }
        }

        if (successCount > 0) toast.success(`Статус обновлён для ${successCount} лидов`);
        if (errorCount > 0) toast.error(`Ошибка при обновлении ${errorCount} лидов`);

        if (successCount > 0) {
            setSelectedRows(new Set());
            fetchData();
        }
    };

    // Filter Logic
    useEffect(() => {
        const filtered = leads.filter((p) => {
            // 1. Search
            const q = searchQuery.toLowerCase();
            const matchesSearch =
                p.name.toLowerCase().includes(q) ||
                p.address.toLowerCase().includes(q) ||
                (p.phone && p.phone.includes(q)) ||
                (p.lead?.phone && p.lead.phone.includes(q)) ||
                p.code.toLowerCase().includes(q) ||
                (p.lead?.status && p.lead.status.toLowerCase().includes(q)) ||
                (p.landmark && p.landmark.toLowerCase().includes(q)) ||
                (p.stir && p.stir.includes(q)) ||
                (p.additionalPhone && p.additionalPhone.includes(q)) ||
                (p.juridicalName && p.juridicalName.toLowerCase().includes(q)) ||
                (p.juridicalAddress && p.juridicalAddress.toLowerCase().includes(q)) ||
                (p.bankName && p.bankName.toLowerCase().includes(q)) ||
                (p.bankAccount && p.bankAccount.includes(q)) ||
                (p.mfo && p.mfo.includes(q)) ||
                (() => {
                    const regionName = typeof p.region === 'object' && p.region?.name ? p.region.name : (typeof p.region === 'string' ? p.region : '');
                    return regionName.toLowerCase().includes(q);
                })() ||
                (p.district && p.district.toLowerCase().includes(q));

            // 2. Lead Status Filter
            const matchesLeadStatus = leadStatusFilter === null
                ? true
                : p.lead?.status === leadStatusFilter;

            // 3. Active filter
            const matchesActive = activeFilter === null
                ? true
                : p.active === activeFilter;

            // 4. Comment User Filter
            let matchesCommentUser = true;
            const sortedComments = p.comments ? [...p.comments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];
            const lastComment = sortedComments.length > 0 ? sortedComments[0] : null;

            if (commentUserFilter !== null) {
                if (!lastComment) {
                    matchesCommentUser = false;
                } else {
                    matchesCommentUser = lastComment.creator?.phone === commentUserFilter;
                }
            }

            // 5. Comment Date Filter
            let matchesCommentDate = true;
            if (commentDateFilter.from || commentDateFilter.to) {
                if (!lastComment) {
                    matchesCommentDate = false;
                } else {
                    const commentDate = new Date(lastComment.createdAt).getTime();
                    // normalize dates to start/end of day if needed, but simple comparison often works if user enters YYYY-MM-DD
                    if (commentDateFilter.from) {
                        const fromDate = new Date(commentDateFilter.from).getTime(); // starts at 00:00 local
                        if (commentDate < fromDate) matchesCommentDate = false;
                    }
                    if (matchesCommentDate && commentDateFilter.to) {
                        // To include end of day, add 1 day or set hours. input type=date gives 00:00.
                        const toDate = new Date(commentDateFilter.to);
                        toDate.setHours(23, 59, 59, 999);
                        if (commentDate > toDate.getTime()) matchesCommentDate = false;
                    }
                }
            }

            // 6. STIR Filter
            const matchesStir = stirFilter.length === 0
                ? true
                : p.stir && stirFilter.includes(p.stir);

            // 7. Telegram Bot Filter
            const matchesTelegramBot = telegramBotFilter === null
                ? true
                : telegramBotFilter
                    ? (p as any).marketChats && (p as any).marketChats.length > 0
                    : !(p as any).marketChats || (p as any).marketChats.length === 0;

            // 8. Branded Packet Filter
            const matchesBrandedPacket = brandedPacketFilter === null
                ? true
                : (p as any).brandedPacket === brandedPacketFilter;

            // 9. Training Filter
            const matchesTraining = trainingFilter === null
                ? true
                : (p as any).training === trainingFilter;

            // 10. Merchant Status Filter
            const matchesMerchantStatus = merchantStatusFilter === null
                ? true
                : p.merchantOnline === merchantStatusFilter;

            // 11. Davo Contract Filter
            const contractStatus = (p as any).davoContract?.status ?? "none";
            const matchesDavoContract = davoContractFilter === null
                ? true
                : contractStatus === davoContractFilter;

            // 13. Region Filter
            const regionName = typeof p.region === 'object' && p.region?.name ? p.region.name : (typeof p.region === 'string' ? p.region : null);
            const matchesRegion = regionFilter.length === 0
                ? true
                : regionName && regionFilter.includes(regionName);

            // 14. District Filter
            const matchesDistrict = districtFilter.length === 0
                ? true
                : p.district && districtFilter.includes(p.district);

            return matchesSearch && matchesLeadStatus && matchesActive && matchesCommentUser && matchesCommentDate && matchesStir && matchesTelegramBot && matchesBrandedPacket && matchesTraining && matchesMerchantStatus && matchesDavoContract && matchesRegion && matchesDistrict;
        });

        // Apply STIR sorting if enabled
        if (stirSortOrder) {
            filtered.sort((a, b) => {
                const stirA = a.stir || '';
                const stirB = b.stir || '';
                if (stirSortOrder === 'asc') {
                    return stirA.localeCompare(stirB);
                } else {
                    return stirB.localeCompare(stirA);
                }
            });
        }

        // Apply Region sorting if enabled
        if (regionSortOrder && regionFilter.length > 0) {
            filtered.sort((a, b) => {
                const aRegion = typeof a.region === 'object' && a.region?.name ? a.region.name : (typeof a.region === 'string' ? a.region : '');
                const bRegion = typeof b.region === 'object' && b.region?.name ? b.region.name : (typeof b.region === 'string' ? b.region : '');
                const comparison = aRegion.localeCompare(bRegion);
                return regionSortOrder === 'asc' ? comparison : -comparison;
            });
        }

        // Apply District sorting if enabled
        if (districtSortOrder && districtFilter.length > 0) {
            filtered.sort((a, b) => {
                const aDistrict = a.district || '';
                const bDistrict = b.district || '';
                const comparison = aDistrict.localeCompare(bDistrict);
                return districtSortOrder === 'asc' ? comparison : -comparison;
            });
        }

        setFilteredLeads(filtered);
        setCurrentPage(0); // reset page on filter change
    }, [searchQuery, leads, leadStatusFilter, activeFilter, commentUserFilter, commentDateFilter, stirFilter, stirSortOrder, telegramBotFilter, brandedPacketFilter, trainingFilter, merchantStatusFilter, davoContractFilter, regionFilter, districtFilter, regionSortOrder, districtSortOrder]);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <span className="text-gray-500 dark:text-gray-400">{t.loading}</span>
            </div>
        );
    }

    const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
    const pagedLeads = filteredLeads.slice(
        currentPage * pageSize,
        (currentPage + 1) * pageSize
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Header />

            <main className="w-full">
                <div className="mb-4 sm:mb-8 px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t.leadsTitle || "Leads"}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">{t.pharmacies}</p>
                </div>

                <div className="bg-white dark:bg-gray-800 shadow">
                    {/* Pagination top bar */}
                    {!isLoading && filteredLeads.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                                <span>
                                    {t.shown || "Показано"} {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filteredLeads.length)} {t.of || "из"} {filteredLeads.length}
                                </span>
                                <span className="text-gray-300 dark:text-gray-600">|</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs">{t.rowsPerPage || "Строк:"}</span>
                                    <input
                                        type="number"
                                        min={1}
                                        defaultValue={pageSize}
                                        key={pageSize}
                                        onBlur={e => { const val = Math.max(1, parseInt(e.target.value) || 1); setPageSize(val); setCurrentPage(0); }}
                                        onKeyDown={e => { if (e.key === "Enter") { const val = Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1); setPageSize(val); setCurrentPage(0); (e.target as HTMLInputElement).blur(); } }}
                                        className="text-xs border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 w-16 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="px-2 tabular-nums">{currentPage + 1} / {totalPages}</span>
                                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                    <PharmacyTable
                        pharmacies={pagedLeads}
                        isLoading={isLoading}
                        isAdmin={true}
                        showComments={true} // Enable comments columns

                        // Interaction
                        onPharmacyClick={(pharmacy) => {
                            setSelectedPharmacy(pharmacy);
                            setInitialModalTab("details");
                            setIsModalOpen(true);
                        }}
                        onLeadHistoryClick={(pharmacy) => {
                            setSelectedPharmacy(pharmacy);
                            setInitialModalTab("leadHistory");
                            setIsModalOpen(true);
                        }}

                        // Standard Filters
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                        telegramBotFilter={telegramBotFilter}
                        onTelegramBotFilterChange={setTelegramBotFilter}
                        brandedPacketFilter={brandedPacketFilter}
                        onBrandedPacketFilterChange={setBrandedPacketFilter}
                        trainingFilter={trainingFilter}
                        onTrainingFilterChange={setTrainingFilter}
                        merchantStatusFilter={merchantStatusFilter}
                        onMerchantStatusFilterChange={setMerchantStatusFilter}
                        davoContractFilter={davoContractFilter}
                        onDavoContractFilterChange={setDavoContractFilter}

                        // Search
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}

                        // Refresh
                        onRefresh={fetchData}

                        // New Lead Status Filter
                        leadStatusFilter={leadStatusFilter}
                        onLeadStatusFilterChange={setLeadStatusFilter}
                        leadStatusOptions={leadStatusOptions}

                        // Comment Filters
                        commentUserFilter={commentUserFilter}
                        onCommentUserFilterChange={setCommentUserFilter}
                        commentUserOptions={commentUserOptions}
                        commentDateFilter={commentDateFilter}
                        onCommentDateFilterChange={setCommentDateFilter}

                        // Leads-specific props
                        isLeadsPage={true}
                        selectedRows={selectedRows}
                        onSelectionChange={setSelectedRows}
                        onSettingsClick={() => setIsColumnSettingsOpen(true)}
                        columnSettings={columnSettings}

                        // STIR Filter
                        stirFilter={stirFilter}
                        stirSortOrder={stirSortOrder}
                        onStirFilterClick={(e) => {
                            setStirHeaderRef(e.currentTarget as HTMLElement);
                            setIsStirModalOpen(true);
                        }}

                        // Region and District Filters
                        regionFilter={regionFilter}
                        regionSortOrder={regionSortOrder}
                        onRegionFilterClick={(e) => {
                            setRegionHeaderRef(e.currentTarget as HTMLElement);
                            setIsRegionModalOpen(true);
                        }}
                        districtFilter={districtFilter}
                        districtSortOrder={districtSortOrder}
                        onDistrictFilterClick={(e) => {
                            setDistrictHeaderRef(e.currentTarget as HTMLElement);
                            setIsDistrictModalOpen(true);
                        }}
                        onCopyRequisites={handleCopyRequisites}
                        onDownload={role === 'ROLE_ADMIN' ? handleDownload : undefined}
                        onUpdateLeadStatus={handleUpdateLeadStatus}
                    />
                    {/* Pagination bottom bar */}
                    {!isLoading && filteredLeads.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                                <span>
                                    {t.shown || "Показано"} {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filteredLeads.length)} {t.of || "из"} {filteredLeads.length}
                                </span>
                                <span className="text-gray-300 dark:text-gray-600">|</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs">{t.rowsPerPage || "Строк:"}</span>
                                    <input
                                        type="number"
                                        min={1}
                                        defaultValue={pageSize}
                                        key={pageSize}
                                        onBlur={e => { const val = Math.max(1, parseInt(e.target.value) || 1); setPageSize(val); setCurrentPage(0); }}
                                        onKeyDown={e => { if (e.key === "Enter") { const val = Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1); setPageSize(val); setCurrentPage(0); (e.target as HTMLInputElement).blur(); } }}
                                        className="text-xs border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 w-16 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage === 0} onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="px-2 tabular-nums font-medium">{currentPage + 1} / {totalPages}</span>
                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages - 1} onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Detail Modal */}
            <PharmacyDetailModal
                pharmacy={selectedPharmacy}
                isOpen={isModalOpen}
                initialTab={initialModalTab}
                onClose={() => setIsModalOpen(false)}
                onUpdateStatus={handleUpdateStatus}
                currentUsername={user?.username || "User"}
                onUpdate={() => {
                    fetchData();
                }}
            />

            {/* Settings Menu Modal */}
            <SettingsMenuModal
                isOpen={isSettingsMenuOpen}
                onClose={() => setIsSettingsMenuOpen(false)}
                onColumnSettingsClick={() => setIsColumnSettingsOpen(true)}
            />

            {/* Column Settings Modal */}
            <ColumnSettingsModal
                isOpen={isColumnSettingsOpen}
                onClose={() => setIsColumnSettingsOpen(false)}
                columns={columnSettings}
                onSave={async (newSettings) => {
                    setColumnSettings(newSettings);
                    setIsColumnSettingsOpen(false);

                    if (token && user?.username) {
                        try {
                            await saveUserColumnSettings(token, user.username, newSettings);
                            toast.success(t.changesSaved || "Changes saved");
                        } catch (error) {
                            console.error("Failed to save column settings:", error);
                            toast.error(t.error || "Error saving settings");
                        }
                    }
                }}
            />

            {/* STIR Filter Modal */}
            <StirFilterModal
                isOpen={isStirModalOpen}
                onClose={() => setIsStirModalOpen(false)}
                allStirValues={uniqueStirs}
                selectedStirs={stirFilter}
                sortOrder={stirSortOrder}
                onApply={(selected, sort) => {
                    setStirFilter(selected);
                    setStirSortOrder(sort);
                }}
                triggerElement={stirHeaderRef}
            />

            {/* Region Filter Modal */}
            <GenericFilterModal
                isOpen={isRegionModalOpen}
                onClose={() => setIsRegionModalOpen(false)}
                title={t.region || "Region"}
                allValues={regionOptions}
                selectedValues={regionFilter}
                sortOrder={regionSortOrder}
                onApply={(selected, sort) => {
                    setRegionFilter(selected);
                    setRegionSortOrder(sort);
                }}
                triggerElement={regionHeaderRef}
            />

            {/* District Filter Modal */}
            <GenericFilterModal
                isOpen={isDistrictModalOpen}
                onClose={() => setIsDistrictModalOpen(false)}
                title={t.district || "District"}
                allValues={districtOptions}
                selectedValues={districtFilter}
                sortOrder={districtSortOrder}
                onApply={(selected, sort) => {
                    setDistrictFilter(selected);
                    setDistrictSortOrder(sort);
                }}
                triggerElement={districtHeaderRef}
            />
        </div>
    );
}
