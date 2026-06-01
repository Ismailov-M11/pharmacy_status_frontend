// PharmacyTable component
import { Pharmacy, ColumnSettings, DavoContractStatus } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, RefreshCw, Square, CheckSquare, ListFilter, Zap, X } from "lucide-react";

interface PharmacyTableProps {
  pharmacies: Pharmacy[];
  isLoading: boolean;
  isAdmin?: boolean;
  activeFilter: boolean | null;
  onFilterChange: (active: boolean | null) => void;
  telegramBotFilter: boolean | null;
  onTelegramBotFilterChange: (value: boolean | null) => void;
  brandedPacketFilter: boolean | null;
  onBrandedPacketFilterChange: (value: boolean | null) => void;
  trainingFilter: boolean | null;
  onTrainingFilterChange: (value: boolean | null) => void;
  merchantStatusFilter?: boolean | null;
  onMerchantStatusFilterChange?: (value: boolean | null) => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  onPharmacyClick?: (pharmacy: Pharmacy) => void;

  onRefresh?: () => void;
  leadStatusFilter?: string | null;
  onLeadStatusFilterChange?: (value: string | null) => void;
  leadStatusOptions?: string[];
  showComments?: boolean;
  commentUserFilter?: string | null;
  onCommentUserFilterChange?: (value: string | null) => void;
  commentUserOptions?: string[];
  commentDateFilter?: { from: string | null; to: string | null };
  onCommentDateFilterChange?: (value: { from: string | null; to: string | null }) => void;
  // Leads page specific props
  isLeadsPage?: boolean;
  selectedRows?: Set<number>;
  onSelectionChange?: (selectedIds: Set<number>) => void;
  onSettingsClick?: () => void;
  columnSettings?: ColumnSettings[];
  // STIR Filter props
  stirFilter?: string[];
  stirSortOrder: 'asc' | 'desc' | null;
  onStirFilterClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  filesFilter?: boolean | null;
  onFilesFilterChange?: (value: boolean | null) => void;
  onFilesClick?: (pharmacy: Pharmacy) => void;
  onLeadHistoryClick?: (pharmacy: Pharmacy) => void;
  // Region and District Filter props
  regionFilter?: string[];
  onRegionFilterClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  regionSortOrder?: 'asc' | 'desc' | null;
  districtFilter?: string[];
  onDistrictFilterClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  districtSortOrder?: 'asc' | 'desc' | null;
  // Copy and Download actions
  onCopyRequisites?: () => void;
  onDownload?: () => void;
  onUpdateLeadStatus?: (status: string) => void;
}

export function PharmacyTable({
  pharmacies,
  isLoading,
  isAdmin = false,
  activeFilter,
  onFilterChange,
  telegramBotFilter,
  onTelegramBotFilterChange,
  brandedPacketFilter,
  onBrandedPacketFilterChange,
  trainingFilter,
  onTrainingFilterChange,
  merchantStatusFilter,
  onMerchantStatusFilterChange,
  searchQuery = "",
  onSearchChange,
  onPharmacyClick,
  onRefresh,
  leadStatusFilter,
  onLeadStatusFilterChange,
  leadStatusOptions = [],
  showComments = false,
  commentUserFilter,
  onCommentUserFilterChange,
  commentUserOptions = [],
  commentDateFilter,
  onCommentDateFilterChange,
  isLeadsPage = false,
  selectedRows = new Set(),
  onSelectionChange,
  onSettingsClick,
  columnSettings,
  stirFilter = [],
  stirSortOrder = null,
  onStirFilterClick,

  filesFilter,
  onFilesFilterChange,
  onFilesClick,
  onLeadHistoryClick,

  regionFilter = [],
  onRegionFilterClick,
  regionSortOrder = null,
  districtFilter = [],
  onDistrictFilterClick,
  districtSortOrder = null,
  onCopyRequisites,
  onDownload,
  onUpdateLeadStatus,
}: PharmacyTableProps) {
  const { t } = useLanguage();
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isStatusPickerOpen, setIsStatusPickerOpen] = useState(false);
  const [pickedStatus, setPickedStatus] = useState<string | null>(null);

  const LEAD_STATUSES = ["NA", "ACCEPTED", "WB", "WMO", "WDO", "SBC", "REJECTED"];

  const orderedColumns = isLeadsPage && columnSettings
    ? columnSettings.filter(c => c.visible).sort((a, b) => a.order - b.order)
    : null;

  const handleDateFilterChange = (type: "from" | "to", value: string) => {
    if (onCommentDateFilterChange && commentDateFilter) {
      onCommentDateFilterChange({
        ...commentDateFilter,
        [type]: value || null
      })
    }
  }

  // ... handlers ...

  const getLastComment = (comments: any[]) => {
    if (!comments || !Array.isArray(comments) || comments.length === 0) return null;

    // Sort by createdAt descending
    const sorted = [...comments].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Descending
    });

    return sorted[0];
  };

  const renderDynamicHeader = (col: ColumnSettings) => {
    switch (col.id) {
      case "number":
        return <th key={col.id} className="px-2 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap" style={{ width: "50px" }}>{t.number}</th>;
      case "code":
        return <th key={col.id} className="px-2 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap" style={{ width: "100px" }}>{t.code}</th>;
      case "name":
        return <th key={col.id} className="px-2 py-2 md:py-3 text-left font-semibold text-gray-700" style={{ width: "150px", minWidth: "150px" }}><div className="break-words">{t.pharmacyName}</div></th>;
      case "address":
        return <th key={col.id} className="px-2 py-2 md:py-3 text-left font-semibold text-gray-700" style={{ width: "170px", minWidth: "170px" }}><div className="break-words">{t.address}</div></th>;
      case "landmark":
        return <th key={col.id} className="px-2 py-2 md:py-3 text-left font-semibold text-gray-700" style={{ width: "130px", minWidth: "130px" }}><div className="break-words">{t.landmark}</div></th>;
      case "pharmacyPhone":
        return <th key={col.id} className="px-2 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap" style={{ width: "110px" }}>{t.pharmacyPhone}</th>;
      case "leadPhone":
        return <th key={col.id} className="px-2 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap" style={{ width: "110px" }}>{t.leadPhone}</th>;

      case "files":
        const hasFilesFilter = filesFilter !== null;
        return (
          <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-max">
            <div className="flex items-center justify-center gap-1">
              {t.files}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700 ${hasFilesFilter ? "text-blue-600" : "text-gray-400"
                      }`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuRadioGroup
                    value={
                      filesFilter === null
                        ? "all"
                        : filesFilter
                          ? "yes"
                          : "no"
                    }
                    onValueChange={(value) => {
                      if (value === "all") onFilesFilterChange?.(null);
                      if (value === "yes") onFilesFilterChange?.(true);
                      if (value === "no") onFilesFilterChange?.(false);
                    }}
                  >
                    <DropdownMenuRadioItem value="all">
                      {t.all || "All"}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="yes">
                      {t.yes || "YES"}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="no">
                      {t.no || "NO"}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </th>
        );

      case "merchantStatus":
        const hasMerchantStatusFilter = merchantStatusFilter !== null;
        return (
          <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-max">
            {onMerchantStatusFilterChange ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white">
                    <div className="flex items-center gap-2">
                      <span>{t.merchantStatus || "Merchant - статус"}</span>
                      {hasMerchantStatusFilter && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">1</span>
                      )}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={merchantStatusFilter === true ? "true" : merchantStatusFilter === false ? "false" : "null"} onValueChange={(val) => handleFilterChange(val, onMerchantStatusFilterChange)}>
                    <DropdownMenuRadioItem value="null">{t.allPharmacies}</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="true" className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 focus:bg-emerald-200 dark:focus:bg-emerald-800 focus:text-emerald-900 dark:focus:text-emerald-200 m-1 cursor-pointer">{t.online}</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="false" className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 focus:bg-red-200 dark:focus:bg-red-800 focus:text-red-900 dark:focus:text-red-200 m-1 cursor-pointer">{t.offline}</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex flex-col items-start">
                <span>{t.merchantStatus || "Merchant - статус"}</span>
              </div>
            )}
          </th>
        );

      case "telegramBot":
        const hasTelegramFilter = telegramBotFilter !== null;
        return (
          <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-max">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white">
                  <div className="flex items-center gap-2">
                    <span>{t.telegramBot}</span>
                    {hasTelegramFilter && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">1</span>
                    )}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup value={telegramBotFilter === true ? "true" : telegramBotFilter === false ? "false" : "null"} onValueChange={(val) => handleFilterChange(val, onTelegramBotFilterChange)}>
                  <DropdownMenuRadioItem value="null">{t.allPharmacies}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="true" className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 focus:bg-emerald-200 dark:focus:bg-emerald-800 focus:text-emerald-900 dark:focus:text-emerald-200 m-1 cursor-pointer">{t.yes}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="false" className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 focus:bg-red-200 dark:focus:bg-red-800 focus:text-red-900 dark:focus:text-red-200 m-1 cursor-pointer">{t.no}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </th>
        );

      case "training":
        const hasTrainingFilter = trainingFilter !== null;
        return (
          <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-max">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white">
                  <div className="flex items-center gap-2">
                    <span>{t.training}</span>
                    {hasTrainingFilter && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded">1</span>
                    )}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup value={trainingFilter === true ? "true" : trainingFilter === false ? "false" : "null"} onValueChange={(val) => handleFilterChange(val, onTrainingFilterChange)}>
                  <DropdownMenuRadioItem value="null">{t.allPharmacies}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="true" className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 focus:bg-emerald-200 dark:focus:bg-emerald-800 focus:text-emerald-900 dark:focus:text-emerald-200 m-1 cursor-pointer">{t.yes}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="false" className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 focus:bg-red-200 dark:focus:bg-red-800 focus:text-red-900 dark:focus:text-red-200 m-1 cursor-pointer">{t.no}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </th>
        );

      case "brandedPacket":
        const hasBrandedPacketFilter = brandedPacketFilter !== null;
        return (
          <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-max">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white">
                  <div className="flex items-center gap-2">
                    <span>{t.brandedPacket}</span>
                    {hasBrandedPacketFilter && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded">1</span>
                    )}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup value={brandedPacketFilter === true ? "true" : brandedPacketFilter === false ? "false" : "null"} onValueChange={(val) => handleFilterChange(val, onBrandedPacketFilterChange)}>
                  <DropdownMenuRadioItem value="null">{t.allPharmacies}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="true" className="bg-emerald-100 text-emerald-800 focus:bg-emerald-200 focus:text-emerald-900 m-1 cursor-pointer">{t.yes}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="false" className="bg-red-100 text-red-800 focus:bg-red-200 focus:text-red-900 m-1 cursor-pointer">{t.no}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </th>
        );

      case "status":
        return <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">{t.status}</th>;

      case "leadStatus":
        if (!isAdmin) return null;
        const hasLeadStatusFilter = leadStatusFilter !== null;
        return (
          <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">
            {onLeadStatusFilterChange && leadStatusOptions && leadStatusOptions.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white">
                    <div className="flex items-center gap-2">
                      <span>{t.leadStatus}</span>
                      {hasLeadStatusFilter && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">1</span>
                      )}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={leadStatusFilter || "null"} onValueChange={(val) => handleStringFilterChange(val, onLeadStatusFilterChange)}>
                    <DropdownMenuRadioItem value="null">{t.all || "Все"}</DropdownMenuRadioItem>
                    {leadStatusOptions.map((status) => (
                      <DropdownMenuRadioItem key={status} value={status} className="cursor-pointer">{status}</DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : t.leadStatus}
          </th>
        );

      case "commentDate":
        return (
          <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">
            {onCommentDateFilterChange ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white">
                    <div className="flex flex-col items-start">
                      <span>{t.lastCommentDate || "Дата"}</span>
                      <span className="text-[10px] font-normal text-gray-500">Lead</span>
                    </div>
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 p-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t.dateFrom}</label>
                      <Input type="date" value={commentDateFilter?.from || ""} onChange={(e) => handleDateFilterChange("from", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t.dateTo}</label>
                      <Input type="date" value={commentDateFilter?.to || ""} onChange={(e) => handleDateFilterChange("to", e.target.value)} />
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : t.lastCommentDate || "Дата"}
          </th>
        );

      case "commentUser":
        const hasCommentUserFilter = commentUserFilter !== null;
        return (
          <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">
            {onCommentUserFilterChange && commentUserOptions && commentUserOptions.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-start">
                        <span>{t.lastCommentUser || "Автор"}</span>
                        <span className="text-[10px] font-normal text-gray-500">Lead</span>
                      </div>
                      {hasCommentUserFilter && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">1</span>
                      )}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={commentUserFilter || "null"} onValueChange={(val) => handleStringFilterChange(val, onCommentUserFilterChange)}>
                    <DropdownMenuRadioItem value="null">{t.all || "Все"}</DropdownMenuRadioItem>
                    {commentUserOptions.map((user) => (
                      <DropdownMenuRadioItem key={user} value={user} className="cursor-pointer">{user}</DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : t.lastCommentUser || "Автор"}
          </th>
        );

      case "comments":
        return <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[200px]"><div className="flex flex-col items-start"><span>{t.lastComment || "Коммент"}</span><span className="text-[10px] font-normal text-gray-500">Lead</span></div></th>;

      case "creationDate":
        return <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">{t.date || "Дата"}</th>;

      case "stir":
        const hasStirFilter = stirFilter && stirFilter.length > 0;
        const hasStirSort = stirSortOrder !== null;
        return (
          <th
            key={col.id}
            className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max"
          >
            {onStirFilterClick ? (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 hover:bg-purple-600 hover:text-white transition-colors"
                onClick={onStirFilterClick}
              >
                <div className="flex items-center gap-2">
                  <span>{t.stir || "СТИР"}</span>
                  {(hasStirFilter || hasStirSort) && (
                    <div className="flex items-center gap-1">
                      {hasStirFilter && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          {stirFilter.length}
                        </span>
                      )}
                      {hasStirSort && (
                        <span className="text-xs text-blue-600">
                          {stirSortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Button>
            ) : (
              t.stir || "СТИР"
            )}
          </th>
        );

      case "additionalPhone":
        return <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max"><div className="flex flex-col items-start"><span>{t.additionalPhone || "Доп. телефон Lead"}</span><span className="text-[10px] font-normal text-gray-500">Lead</span></div></th>;

      case "juridicalName":
        return <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[180px]">{t.juridicalName || "Юридическое название"}</th>;

      case "juridicalAddress":
        return <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700" style={{ width: "200px", minWidth: "200px" }}><div className="break-words">{t.juridicalAddress || "Юридический адрес"}</div></th>;

      case "bankName":
        return <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[150px]">{t.bankName || "Название банка"}</th>;

      case "bankAccount":
        return <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[150px]">{t.bankAccount || "Банковский счет"}</th>;

      case "mfo":
        return <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">{t.mfo || "МФО"}</th>;

      case "region":
        const hasRegionFilter = regionFilter && regionFilter.length > 0;
        const hasRegionSort = regionSortOrder !== null;
        return (
          <th
            key={col.id}
            className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max"
          >
            {onRegionFilterClick ? (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 hover:bg-purple-600 hover:text-white transition-colors"
                onClick={onRegionFilterClick}
              >
                <div className="flex items-center gap-2">
                  <span>{t.region}</span>
                  {(hasRegionFilter || hasRegionSort) && (
                    <div className="flex items-center gap-1">
                      {hasRegionFilter && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          {regionFilter.length}
                        </span>
                      )}
                      {hasRegionSort && (
                        <span className="text-xs text-blue-600">
                          {regionSortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Button>
            ) : t.region}
          </th>
        );

      case "district":
        const hasDistrictFilter = districtFilter && districtFilter.length > 0;
        const hasDistrictSort = districtSortOrder !== null;
        return (
          <th
            key={col.id}
            className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max"
          >
            {onDistrictFilterClick ? (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 hover:bg-purple-600 hover:text-white transition-colors"
                onClick={onDistrictFilterClick}
              >
                <div className="flex items-center gap-2">
                  <span>{t.district}</span>
                  {(hasDistrictFilter || hasDistrictSort) && (
                    <div className="flex items-center gap-1">
                      {hasDistrictFilter && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          {districtFilter.length}
                        </span>
                      )}
                      {hasDistrictSort && (
                        <span className="text-xs text-blue-600">
                          {districtSortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Button>
            ) : t.district}
          </th>
        );

      case "davoContract":
        return (
          <th key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
            {(t as any).davoContract || "Davo - договор"}
          </th>
        );

      default:
        return null;
    }
  };

  const renderDynamicCell = (col: ColumnSettings, pharmacy: Pharmacy, index: number) => {
    switch (col.id) {
      case "number": return <td key={col.id} className="px-2 py-2 md:py-3 text-gray-900 font-medium whitespace-nowrap align-top">{index + 1}</td>;
      case "code": return (
        <td key={col.id} className="px-2 py-2 md:py-3 text-gray-900 whitespace-nowrap align-top">
          <div className="flex flex-col gap-0.5">
            <button onClick={() => onPharmacyClick?.(pharmacy)} className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors text-left">
              {pharmacy.code}
            </button>
            {(pharmacy as any).marketCode && (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 leading-none">
                {(pharmacy as any).marketCode}
              </span>
            )}
          </div>
        </td>
      );
      case "name": return <td key={col.id} className="px-2 py-2 md:py-3 text-gray-900 font-medium align-top"><div className="break-words overflow-hidden" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", lineHeight: "1.4em", minHeight: "4.2em" }}>{pharmacy.name}</div></td>;
      case "address": return <td key={col.id} className="px-2 py-2 md:py-3 text-gray-600 align-top"><div className="break-words overflow-hidden" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", lineHeight: "1.4em", minHeight: "4.2em" }}>{pharmacy.address}</div></td>;
      case "landmark": return <td key={col.id} className="px-2 py-2 md:py-3 text-gray-600 align-top"><div className="break-words" style={{ lineHeight: "1.4em", minHeight: "4.2em" }}>{pharmacy.landmark || "-"}</div></td>;
      case "pharmacyPhone": return <td key={col.id} className="px-2 py-2 md:py-3 text-gray-900 whitespace-nowrap align-top">{pharmacy.phone || "-"}</td>;
      case "leadPhone": return <td key={col.id} className="px-2 py-2 md:py-3 text-gray-900 whitespace-nowrap align-top">{pharmacy.lead?.phone || "-"}</td>;

      case "merchantStatus": {
        const isOnline = pharmacy.merchantOnline ?? false;
        return (
          <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-center">
            <span className={`px-2 py-1 rounded text-xs font-bold inline-block whitespace-nowrap ${isOnline
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
              }`}>
              {isOnline ? (t.online || "Online") : (t.offline || "Offline")}
            </span>
          </td>
        );
      }

      case "telegramBot": {
        const marketChats = pharmacy.marketChats;
        const hasTelegramBot = marketChats && Array.isArray(marketChats) && marketChats.length > 0;
        return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-center"><div className={`font-bold text-xs px-2 py-1 rounded inline-block whitespace-nowrap ${hasTelegramBot ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"}`}>{getTelegramBotStatus(marketChats)}</div></td>;
      }

      case "training": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold inline-block whitespace-nowrap ${pharmacy.training ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"}`}>{getTrainingStatusText(pharmacy.training || false)}</span></td>;
      case "brandedPacket": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold inline-block whitespace-nowrap ${pharmacy.brandedPacket ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"}`}>{getStatusText(pharmacy.brandedPacket || false)}</span></td>;
      case "status": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3"><span className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap inline-block ${pharmacy.active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"}`}>{pharmacy.active ? t.active : t.inactive}</span></td>;

      case "leadStatus": return isAdmin ? <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs">{pharmacy.lead?.status || "-"}</td> : null;

      case "commentDate": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap align-middle" onClick={() => onLeadHistoryClick?.(pharmacy)} style={onLeadHistoryClick ? { cursor: "pointer" } : {}}>{(() => { const last = getLastComment(pharmacy.comments || []); if (!last) return "-"; return <span className="font-semibold hover:text-blue-600 hover:underline">{formatDate(last.createdAt)}</span>; })()}</td>;
      case "commentUser": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap align-middle" onClick={() => onLeadHistoryClick?.(pharmacy)} style={onLeadHistoryClick ? { cursor: "pointer" } : {}}>{(() => { const last = getLastComment(pharmacy.comments || []); if (!last) return "-"; return <span className="text-gray-500 text-xs hover:text-blue-600 hover:underline">{last.creator?.phone || "-"}</span>; })()}</td>;
      case "comments": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs align-middle" onClick={() => onLeadHistoryClick?.(pharmacy)} style={onLeadHistoryClick ? { cursor: "pointer" } : {}}><div className="max-w-[200px] break-words hover:text-blue-600 hover:underline">{getLastComment(pharmacy.comments || [])?.coment || getLastComment(pharmacy.comments || [])?.comment || "-"}</div></td>;
      case "creationDate": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap align-middle">{formatDate(pharmacy.creationDate)}</td>;

      case "stir": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap align-middle">{pharmacy.stir || "-"}</td>;
      case "additionalPhone": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap align-middle">{pharmacy.additionalPhone || "-"}</td>;
      case "juridicalName": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs align-middle"><div className="break-words">{pharmacy.juridicalName || "-"}</div></td>;
      case "juridicalAddress": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs align-middle"><div className="break-words">{pharmacy.juridicalAddress || "-"}</div></td>;
      case "bankName": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs align-middle"><div className="break-words">{pharmacy.bankName || "-"}</div></td>;
      case "bankAccount": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap align-middle">{pharmacy.bankAccount || "-"}</td>;
      case "mfo": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap align-middle">{pharmacy.mfo || "-"}</td>;

      case "region": {
        const regionSource = pharmacy.region || pharmacy.lead?.region;
        const regionName = typeof regionSource === 'object' && regionSource?.name ? regionSource.name : (typeof regionSource === 'string' ? regionSource : '-');
        return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap align-middle">{regionName}</td>;
      }
      case "district": return <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap align-middle">{pharmacy.district || pharmacy.lead?.district || "-"}</td>;

      case "davoContract": {
        const c = (pharmacy as any).davoContract as DavoContractStatus | null | undefined;
        const cls = {
          signed:   "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
          pending:  "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
          rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
          none:     "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
        }[c?.status || "none"];
        return (
          <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-center">
            <button
              onClick={() => onPharmacyClick?.(pharmacy)}
              className={`px-2 py-1 rounded text-xs font-bold inline-block whitespace-nowrap ${cls}`}
              title={c?.status_comment || undefined}
            >
              {c?.label || ((t as any).noContract || "Нет договора")}
            </button>
          </td>
        );
      }

      case "files":
        return (
          <td key={col.id} className="px-2 md:px-4 py-2 md:py-3 text-center">
            {pharmacy.licence ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onFilesClick?.(pharmacy);
                }}
                className="px-2 py-1 rounded text-xs font-bold inline-block whitespace-nowrap bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 cursor-pointer hover:underline"
              >
                {t.yes}
              </span>
            ) : (
              <span className="px-2 py-1 rounded text-xs font-bold inline-block whitespace-nowrap bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                {t.no}
              </span>
            )}
          </td>
        );

      default: return null;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("ru-RU", { // Or dynamic locale
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleFilterChange = (
    value: string,
    setter: (val: boolean | null) => void,
  ) => {
    if (value === "true") {
      setter(true);
    } else if (value === "false") {
      setter(false);
    } else {
      setter(null);
    }
  };

  const handleStringFilterChange = (
    value: string,
    setter?: (val: string | null) => void,
  ) => {
    if (!setter) return;
    if (value === "null") {
      setter(null);
    } else {
      setter(value);
    }
  };

  const getStatusText = (value: boolean) => {
    return value ? t.yes : t.no;
  };

  const getTrainingStatusText = (value: boolean) => {
    return value ? t.yesTraining : t.noTraining;
  };

  const getTelegramBotStatus = (marketChats: any[]) => {
    const hasChat =
      marketChats && Array.isArray(marketChats) && marketChats.length > 0;
    return hasChat ? t.yes : t.no;
  };

  const getTelegramBotDetails = (marketChats: any[]) => {
    if (
      !marketChats ||
      !Array.isArray(marketChats) ||
      marketChats.length === 0
    ) {
      return null;
    }
    return marketChats[0];
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Input
            type="text"
            placeholder={`${t.pharmacyName} / ${t.address}...`}
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full sm:max-w-md"
            disabled
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled>
                {t.filter}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
          </DropdownMenu>
        </div>
        <div className="flex items-center justify-center py-8">
          <span className="text-gray-500">{t.loadingPharmacies}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 space-y-4 sticky top-[82px] z-30 bg-gray-50 dark:bg-gray-800">
      {isLeadsPage ? (
        // Leads page layout: Single row with selection | centered search | action buttons
        <>
        <div className="flex items-center justify-between gap-4">
          {/* Left: Selection button */}
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedRows && selectedRows.size === 0) {
                  // Select all
                  const allIds = new Set(pharmacies.map(p => p.id));
                  onSelectionChange?.(allIds);
                } else {
                  // Clear selection
                  onSelectionChange?.(new Set());
                }
              }}
              className="whitespace-nowrap"
            >
              {selectedRows && selectedRows.size > 0 ? t.clearSelection : t.select}
            </Button>
            {selectedRows && selectedRows.size > 0 && (
              <span className="text-sm text-gray-600 flex items-center whitespace-nowrap">
                {t.selected}: {selectedRows.size}
              </span>
            )}
          </div>

          {/* Center: Search field — full width */}
          <Input
            type="text"
            placeholder={`${t.pharmacyName} / ${t.address}...`}
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="flex-1 min-w-0"
          />

          {/* Right: Action buttons */}
          <div className="flex gap-2 flex-shrink-0">
            {onRefresh && (
              <Button
                variant="outline"
                size="icon"
                onClick={onRefresh}
                className="bg-blue-500 hover:bg-blue-600 text-white border-blue-500 hover:border-blue-600"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  {t.filter}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={
                    activeFilter === true
                      ? "true"
                      : activeFilter === false
                        ? "false"
                        : "null"
                  }
                  onValueChange={(val) => handleFilterChange(val, onFilterChange)}
                >
                  <DropdownMenuRadioItem value="null">
                    {t.allPharmacies}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="true"
                    className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 focus:bg-emerald-200 dark:focus:bg-emerald-800 focus:text-emerald-900 dark:focus:text-emerald-200 m-1 cursor-pointer"
                  >
                    {t.active}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="false"
                    className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 focus:bg-red-200 dark:focus:bg-red-800 focus:text-red-900 dark:focus:text-red-200 m-1 cursor-pointer"
                  >
                    {t.inactive}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Actions button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsActionsOpen(true)}
              className="gap-1.5 whitespace-nowrap"
            >
              <Zap className="w-4 h-4" />
              {t.actions}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Actions Modal */}
        {isActionsOpen && (
          <>
            <div className="fixed inset-0 bg-black bg-opacity-50 z-[60]" onClick={() => setIsActionsOpen(false)} />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t.actions}</h2>
                  <button onClick={() => setIsActionsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 space-y-1">
                  <button
                    onClick={() => { onSettingsClick?.(); setIsActionsOpen(false); }}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">{t.reorderColumns}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.dragToReorder}</div>
                  </button>

                  {onCopyRequisites && (
                    <button
                      onClick={() => { onCopyRequisites(); setIsActionsOpen(false); }}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100">{t.copyRequisites}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {selectedRows && selectedRows.size > 0
                          ? `${t.selected}: ${selectedRows.size}`
                          : t.allPharmacies}
                      </div>
                    </button>
                  )}

                  {onDownload && (
                    <button
                      onClick={() => { onDownload(); setIsActionsOpen(false); }}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100">{t.downloadXlsx}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {selectedRows && selectedRows.size > 0
                          ? `${t.selected}: ${selectedRows.size}`
                          : t.allPharmacies}
                      </div>
                    </button>
                  )}

                  <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

                  {onUpdateLeadStatus && (
                    <button
                      onClick={() => {
                        if (!selectedRows || selectedRows.size === 0) return;
                        setPickedStatus(null);
                        setIsActionsOpen(false);
                        setIsStatusPickerOpen(true);
                      }}
                      disabled={!selectedRows || selectedRows.size === 0}
                      className="w-full text-left px-4 py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-800"
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100">{t.updateLeadStatus}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {!selectedRows || selectedRows.size === 0
                          ? t.noRowsSelectedForUpdate
                          : `${t.selected}: ${selectedRows.size}`}
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Status Picker Modal */}
        {isStatusPickerOpen && (
          <>
            <div className="fixed inset-0 bg-black bg-opacity-50 z-[60]" onClick={() => setIsStatusPickerOpen(false)} />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t.updateLeadStatus}</h2>
                  <button onClick={() => setIsStatusPickerOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 space-y-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400 px-4 pb-2">{t.selectLeadStatus}</p>
                  {LEAD_STATUSES.map(status => (
                      <button
                        key={status}
                        onClick={() => setPickedStatus(status)}
                        className={`w-full text-left px-4 py-2.5 rounded-lg transition-colors font-medium ${
                          pickedStatus === status
                            ? "bg-blue-600 text-white"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsStatusPickerOpen(false)}>
                    {t.cancel || "Отмена"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!pickedStatus}
                    onClick={() => {
                      if (pickedStatus) {
                        onUpdateLeadStatus?.(pickedStatus);
                        setIsStatusPickerOpen(false);
                      }
                    }}
                  >
                    {t.update}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
        </>
      ) : (
        // Original layout for other pages
        <div className="flex flex-row gap-2 sm:gap-4 items-center justify-between">
          <Input
            type="text"
            placeholder={`${t.pharmacyName} / ${t.address}...`}
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="flex-1 min-w-0 sm:max-w-md"
          />
          <div className="flex gap-2 flex-shrink-0">
            {onRefresh && (
              <Button
                variant="outline"
                size="icon"
                onClick={onRefresh}
                className="bg-blue-500 hover:bg-blue-600 text-white border-blue-500 hover:border-blue-600"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 px-2 sm:px-4">
                  <ListFilter className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">{t.filter}</span>
                  <ChevronDown className="w-4 h-4 hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={
                    activeFilter === true
                      ? "true"
                      : activeFilter === false
                        ? "false"
                        : "null"
                  }
                  onValueChange={(val) => handleFilterChange(val, onFilterChange)}
                >
                  <DropdownMenuRadioItem value="null">
                    {t.allPharmacies}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="true"
                    className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 focus:bg-emerald-200 dark:focus:bg-emerald-800 focus:text-emerald-900 dark:focus:text-emerald-200 m-1 cursor-pointer"
                  >
                    {t.active}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="false"
                    className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 focus:bg-red-200 dark:focus:bg-red-800 focus:text-red-900 dark:focus:text-red-200 m-1 cursor-pointer"
                  >
                    {t.inactive}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <div
        className="border dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 shadow-sm overflow-auto"
        style={{ maxHeight: "calc(100vh - 100px)" }}
      >
        <table className="w-full text-xs md:text-sm relative">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 sticky top-0 z-40 bg-white dark:bg-gray-800 shadow-sm">
            <tr>
              {orderedColumns ? (
                <>
                  {/* Fallback Checkbox if 'number' is hidden */}
                  {isLeadsPage && !orderedColumns.some(c => c.id === 'number') && (
                    <th className="px-2 py-2 md:py-3 text-center font-semibold text-gray-700" style={{ width: "40px" }}>
                      <input
                        type="checkbox"
                        checked={selectedRows?.size === pharmacies.length && pharmacies.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onSelectionChange?.(new Set(pharmacies.map(p => p.id)));
                          } else {
                            onSelectionChange?.(new Set());
                          }
                        }}
                        className="cursor-pointer"
                      />
                    </th>
                  )}
                  {orderedColumns.map(col => (
                    <React.Fragment key={col.id}>
                      {renderDynamicHeader(col)}
                      {/* Checkbox after Number column to match original layout */}
                      {isLeadsPage && col.id === 'number' && (
                        <th className="px-2 py-2 md:py-3 text-center font-semibold text-gray-700" style={{ width: "40px" }}>
                          <input
                            type="checkbox"
                            checked={selectedRows?.size === pharmacies.length && pharmacies.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                onSelectionChange?.(new Set(pharmacies.map(p => p.id)));
                              } else {
                                onSelectionChange?.(new Set());
                              }
                            }}
                            className="cursor-pointer"
                          />
                        </th>
                      )}
                    </React.Fragment>
                  ))}
                </>
              ) : (
                <>
                  <th
                    className="px-2 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap"
                    style={{ width: "50px" }}
                  >
                    {t.number}
                  </th>
                  {isLeadsPage && (
                    <th
                      className="px-2 py-2 md:py-3 text-center font-semibold text-gray-700"
                      style={{ width: "40px" }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRows?.size === pharmacies.length && pharmacies.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onSelectionChange?.(new Set(pharmacies.map(p => p.id)));
                          } else {
                            onSelectionChange?.(new Set());
                          }
                        }}
                        className="cursor-pointer"
                      />
                    </th>
                  )}
                  <th
                    className="px-2 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap"
                    style={{ width: "100px" }}
                  >
                    {t.code}
                  </th>
                  <th
                    className="px-2 py-2 md:py-3 text-left font-semibold text-gray-700"
                    style={{ width: "150px", minWidth: "150px" }}
                  >
                    <div className="break-words">{t.pharmacyName}</div>
                  </th>
                  <th
                    className="px-2 py-2 md:py-3 text-left font-semibold text-gray-700"
                    style={{ width: "170px", minWidth: "170px" }}
                  >
                    <div className="break-words">{t.address}</div>
                  </th>
                  <th
                    className="px-2 py-2 md:py-3 text-left font-semibold text-gray-700"
                    style={{ width: "130px", minWidth: "130px" }}
                  >
                    <div className="break-words">{t.landmark}</div>
                  </th>
                  <th
                    className="px-2 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap"
                    style={{ width: "110px" }}
                  >
                    {t.pharmacyPhone}
                  </th>
                  <th
                    className="px-2 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap"
                    style={{ width: "110px" }}
                  >
                    {t.leadPhone}
                  </th>
                  <th
                    className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max"
                  >
                    {t.region}
                  </th>
                  <th
                    className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max"
                  >
                    {t.district}
                  </th>

                  <th className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-max">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white"
                        >
                          <span>{t.files || "Files"}</span>
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-40">
                        <DropdownMenuRadioGroup
                          value={
                            filesFilter === null
                              ? "all"
                              : filesFilter
                                ? "yes"
                                : "no"
                          }
                          onValueChange={(value) => {
                            if (value === "all") onFilesFilterChange?.(null);
                            if (value === "yes") onFilesFilterChange?.(true);
                            if (value === "no") onFilesFilterChange?.(false);
                          }}
                        >
                          <DropdownMenuRadioItem value="all">
                            {t.allPharmacies || "All Pharmacies"}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem
                            value="yes"
                            className="bg-emerald-100 text-emerald-800 focus:bg-emerald-200 focus:text-emerald-900 m-1 cursor-pointer"
                          >
                            {t.yes || "YES"}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem
                            value="no"
                            className="bg-red-100 text-red-800 focus:bg-red-200 focus:text-red-900 m-1 cursor-pointer"
                          >
                            {t.no || "NO"}
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>

                  <th className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-max">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white"
                        >
                          <span>{t.merchantStatus || "Merchant - статус"}</span>
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuRadioGroup
                          value={
                            merchantStatusFilter === true
                              ? "true"
                              : merchantStatusFilter === false
                                ? "false"
                                : "null"
                          }
                          onValueChange={(val) =>
                            handleFilterChange(val, onMerchantStatusFilterChange)
                          }
                        >
                          <DropdownMenuRadioItem value="null">
                            {t.allPharmacies}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem
                            value="true"
                            className="bg-emerald-100 text-emerald-800 focus:bg-emerald-200 focus:text-emerald-900 m-1 cursor-pointer"
                          >
                            {t.online}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem
                            value="false"
                            className="bg-red-100 text-red-800 focus:bg-red-200 focus:text-red-900 m-1 cursor-pointer"
                          >
                            {t.offline}
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>

                  <th className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-max">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white"
                        >
                          <span>{t.telegramBot}</span>
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuRadioGroup
                          value={
                            telegramBotFilter === true
                              ? "true"
                              : telegramBotFilter === false
                                ? "false"
                                : "null"
                          }
                          onValueChange={(val) =>
                            handleFilterChange(val, onTelegramBotFilterChange)
                          }
                        >
                          <DropdownMenuRadioItem value="null">
                            {t.allPharmacies}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem
                            value="true"
                            className="bg-emerald-100 text-emerald-800 focus:bg-emerald-200 focus:text-emerald-900 m-1 cursor-pointer"
                          >
                            {t.yes}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem
                            value="false"
                            className="bg-red-100 text-red-800 focus:bg-red-200 focus:text-red-900 m-1 cursor-pointer"
                          >
                            {t.no}
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-max">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white"
                        >
                          <span>{t.training}</span>
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuRadioGroup
                          value={
                            trainingFilter === true
                              ? "true"
                              : trainingFilter === false
                                ? "false"
                                : "null"
                          }
                          onValueChange={(val) =>
                            handleFilterChange(val, onTrainingFilterChange)
                          }
                        >
                          <DropdownMenuRadioItem value="null">
                            {t.allPharmacies}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem
                            value="true"
                            className="bg-emerald-100 text-emerald-800 focus:bg-emerald-200 focus:text-emerald-900 m-1 cursor-pointer"
                          >
                            {t.yes}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem
                            value="false"
                            className="bg-red-100 text-red-800 focus:bg-red-200 focus:text-red-900 m-1 cursor-pointer"
                          >
                            {t.no}
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-max">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white"
                        >
                          <span>{t.brandedPacket}</span>
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuRadioGroup
                          value={
                            brandedPacketFilter === true
                              ? "true"
                              : brandedPacketFilter === false
                                ? "false"
                                : "null"
                          }
                          onValueChange={(val) =>
                            handleFilterChange(val, onBrandedPacketFilterChange)
                          }
                        >
                          <DropdownMenuRadioItem value="null">
                            {t.allPharmacies}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem
                            value="true"
                            className="bg-emerald-100 text-emerald-800 focus:bg-emerald-200 focus:text-emerald-900 m-1 cursor-pointer"
                          >
                            {t.yes}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem
                            value="false"
                            className="bg-red-100 text-red-800 focus:bg-red-200 focus:text-red-900 m-1 cursor-pointer"
                          >
                            {t.no}
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">
                    {t.status}
                  </th>
                  {isAdmin && (
                    <>
                      <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">
                        {onLeadStatusFilterChange && leadStatusOptions && leadStatusOptions.length > 0 ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white"
                              >
                                <span>{t.leadStatus}</span>
                                <ChevronDown className="ml-2 h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuRadioGroup
                                value={leadStatusFilter || "null"}
                                onValueChange={(val) =>
                                  handleStringFilterChange(val, onLeadStatusFilterChange)
                                }
                              >
                                <DropdownMenuRadioItem value="null">
                                  {t.all || "Все"}
                                </DropdownMenuRadioItem>
                                {leadStatusOptions.map((status) => (
                                  <DropdownMenuRadioItem
                                    key={status}
                                    value={status}
                                    className="cursor-pointer"
                                  >
                                    {status}
                                  </DropdownMenuRadioItem>
                                ))}
                              </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          t.leadStatus
                        )}
                      </th>

                      {/* New Comment Headers */}
                      {showComments && (
                        <>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white"
                                >
                                  <div className="flex flex-col items-start">
                                    <span>{t.lastCommentDate || "Дата"}</span>
                                    <span className="text-[10px] font-normal text-gray-500">Lead</span>
                                  </div>
                                  <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-64 p-4" align="start">
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">{t.dateFrom}</label>
                                    <Input
                                      type="date"
                                      value={commentDateFilter?.from || ""}
                                      onChange={(e) => handleDateFilterChange("from", e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">{t.dateTo}</label>
                                    <Input
                                      type="date"
                                      value={commentDateFilter?.to || ""}
                                      onChange={(e) => handleDateFilterChange("to", e.target.value)}
                                    />
                                  </div>
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">
                            {onCommentUserFilterChange && commentUserOptions && commentUserOptions.length > 0 ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="-ml-3 h-8 data-[state=open]:bg-purple-600 data-[state=open]:text-white"
                                  >
                                    <div className="flex flex-col items-start">
                                      <span>{t.lastCommentUser || "Автор"}</span>
                                      <span className="text-[10px] font-normal text-gray-500">Lead</span>
                                    </div>
                                    <ChevronDown className="ml-2 h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuRadioGroup
                                    value={commentUserFilter || "null"}
                                    onValueChange={(val) =>
                                      handleStringFilterChange(val, onCommentUserFilterChange)
                                    }
                                  >
                                    <DropdownMenuRadioItem value="null">
                                      {t.all || "Все"}
                                    </DropdownMenuRadioItem>
                                    {commentUserOptions.map((user) => (
                                      <DropdownMenuRadioItem
                                        key={user}
                                        value={user}
                                        className="cursor-pointer"
                                      >
                                        {user}
                                      </DropdownMenuRadioItem>
                                    ))}
                                  </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <div className="flex flex-col items-start">
                                <span>{t.lastCommentUser || "Автор"}</span>
                                <span className="text-[10px] font-normal text-gray-500">Lead</span>
                              </div>
                            )}
                          </th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[200px]">
                            <div className="flex flex-col items-start">
                              <span>{t.lastComment || "Коммент"}</span>
                              <span className="text-[10px] font-normal text-gray-500">Lead</span>
                            </div>
                          </th>
                        </>
                      )}
                    </>
                  )}

                  {/* STIR Column - Now visible for all roles */}
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">
                    {onStirFilterClick ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 hover:bg-purple-600 hover:text-white transition-colors"
                        onClick={onStirFilterClick}
                      >
                        <div className="flex items-center gap-2">
                          <span>{t.stir || "СТИР"}</span>
                          {((stirFilter && stirFilter.length > 0) || stirSortOrder !== null) && (
                            <div className="flex items-center gap-1">
                              {stirFilter && stirFilter.length > 0 && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                  {stirFilter.length}
                                </span>
                              )}
                              {stirSortOrder !== null && (
                                <span className="text-xs text-blue-600">
                                  {stirSortOrder === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </Button>
                    ) : (
                      t.stir || "СТИР"
                    )}
                  </th>

                  {/* Additional Phone - Only for admin */}
                  {isAdmin && (
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">
                      <div className="flex flex-col items-start">
                        <span>{t.additionalPhone}</span>
                        <span className="text-[10px] font-normal text-gray-500">Lead</span>
                      </div>
                    </th>
                  )}

                  {/* Juridical Data Columns - Now visible for all roles */}
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[180px]">
                    {t.juridicalName}
                  </th>
                  <th
                    className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700"
                    style={{ width: "200px", minWidth: "200px" }}
                  >
                    <div className="break-words">{t.juridicalAddress}</div>
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[150px]">
                    {t.bankName}
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[150px]">
                    {t.bankAccount}
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">
                    {t.mfo}
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pharmacies.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 20 : 11}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  {t.noData}
                </td>
              </tr>
            ) : (
              pharmacies.map((pharmacy, index) => {
                const marketChats = pharmacy.marketChats;
                const telegramBotDetails = getTelegramBotDetails(marketChats);
                const hasTelegramBot =
                  marketChats && Array.isArray(marketChats) && marketChats.length > 0;
                const telegramBotCount = hasTelegramBot ? marketChats.length : 0;

                return (
                  <tr
                    key={pharmacy.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {orderedColumns ? (
                      <>
                        {/* Fallback Checkbox if 'number' is hidden */}
                        {isLeadsPage && !orderedColumns.some(c => c.id === 'number') && (
                          <td className="px-2 py-2 md:py-3 text-center align-top">
                            <input
                              type="checkbox"
                              checked={selectedRows?.has(pharmacy.id) || false}
                              onChange={(e) => {
                                const newSelection = new Set(selectedRows);
                                if (e.target.checked) {
                                  newSelection.add(pharmacy.id);
                                } else {
                                  newSelection.delete(pharmacy.id);
                                }
                                onSelectionChange?.(newSelection);
                              }}
                              className="cursor-pointer"
                            />
                          </td>
                        )}
                        {orderedColumns.map(col => (
                          <React.Fragment key={col.id}>
                            {renderDynamicCell(col, pharmacy, index)}
                            {/* Checkbox after Number column to match original layout */}
                            {isLeadsPage && col.id === 'number' && (
                              <td className="px-2 py-2 md:py-3 text-center align-top">
                                <input
                                  type="checkbox"
                                  checked={selectedRows?.has(pharmacy.id) || false}
                                  onChange={(e) => {
                                    const newSelection = new Set(selectedRows);
                                    if (e.target.checked) {
                                      newSelection.add(pharmacy.id);
                                    } else {
                                      newSelection.delete(pharmacy.id);
                                    }
                                    onSelectionChange?.(newSelection);
                                  }}
                                  className="cursor-pointer"
                                />
                              </td>
                            )}
                          </React.Fragment>
                        ))}
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-2 md:py-3 text-gray-900 font-medium whitespace-nowrap align-top">
                          {index + 1}
                        </td>
                        {isLeadsPage && (
                          <td className="px-2 py-2 md:py-3 text-center align-top">
                            <input
                              type="checkbox"
                              checked={selectedRows?.has(pharmacy.id) || false}
                              onChange={(e) => {
                                const newSelection = new Set(selectedRows);
                                if (e.target.checked) {
                                  newSelection.add(pharmacy.id);
                                } else {
                                  newSelection.delete(pharmacy.id);
                                }
                                onSelectionChange?.(newSelection);
                              }}
                              className="cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-2 py-2 md:py-3 text-gray-900 whitespace-nowrap align-top">
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => onPharmacyClick?.(pharmacy)}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors text-left"
                            >
                              {pharmacy.code}
                            </button>
                            {(pharmacy as any).marketCode && (
                              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 leading-none">
                                {(pharmacy as any).marketCode}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 md:py-3 text-gray-900 font-medium align-top">
                          <div
                            className="break-words overflow-hidden"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              lineHeight: "1.4em",
                              minHeight: "4.2em",
                            }}
                          >
                            {pharmacy.name}
                          </div>
                        </td>
                        <td className="px-2 py-2 md:py-3 text-gray-600 align-top">
                          <div
                            className="break-words overflow-hidden"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              lineHeight: "1.4em",
                              minHeight: "4.2em",
                            }}
                          >
                            {pharmacy.address}
                          </div>
                        </td>
                        <td className="px-2 py-2 md:py-3 text-gray-600 align-top">
                          <div
                            className="break-words"
                            style={{ lineHeight: "1.4em", minHeight: "4.2em" }}
                          >
                            {(pharmacy as any).landmark || "-"}
                          </div>
                        </td>
                        <td className="px-2 py-2 md:py-3 text-gray-900 whitespace-nowrap align-top">
                          {pharmacy.phone || "-"}
                        </td>
                        <td className="px-2 py-2 md:py-3 text-gray-900 whitespace-nowrap align-top">
                          {pharmacy.lead?.phone || "-"}
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap align-middle">
                          {(() => {
                            // Check top-level region first, then fall back to lead.region
                            const regionSource = pharmacy.region || pharmacy.lead?.region;
                            return typeof regionSource === 'object' && regionSource?.name ? regionSource.name : (typeof regionSource === 'string' ? regionSource : '-');
                          })()}
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap align-middle">
                          {pharmacy.district || pharmacy.lead?.district || "-"}
                        </td>

                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          {pharmacy.licence ? (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                onFilesClick?.(pharmacy);
                              }}
                              className="px-2 py-1 rounded text-xs font-bold inline-block whitespace-nowrap bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 cursor-pointer hover:underline"
                            >
                              {t.yes}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs font-bold inline-block whitespace-nowrap bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                              {t.no}
                            </span>
                          )}
                        </td>

                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold inline-block whitespace-nowrap ${pharmacy.merchantOnline
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                            }`}>
                            {pharmacy.merchantOnline ? (t.online || "Online") : (t.offline || "Offline")}
                          </span>
                        </td>

                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <div
                            className={`font-bold text-xs px-2 py-1 rounded inline-block whitespace-nowrap ${hasTelegramBot
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                              }`}
                          >
                            {getTelegramBotStatus(marketChats)}
                          </div>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold inline-block whitespace-nowrap ${(pharmacy as any).training
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                              }`}
                          >
                            {getTrainingStatusText((pharmacy as any).training)}
                          </span>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-center">
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold inline-block whitespace-nowrap ${(pharmacy as any).brandedPacket
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                              }`}
                          >
                            {getStatusText((pharmacy as any).brandedPacket)}
                          </span>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap inline-block ${pharmacy.active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                              }`}
                          >
                            {pharmacy.active ? t.active : t.inactive}
                          </span>
                        </td>
                        {isAdmin && (
                          <>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs">
                              {pharmacy.lead?.status || "-"}
                            </td>

                            {/* New Comment Columns */}
                            {showComments && (
                              <>
                                {/* Date Column: Just Date */}
                                <td className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap align-middle" onClick={() => onLeadHistoryClick?.(pharmacy)} style={onLeadHistoryClick ? { cursor: "pointer" } : {}}>
                                  {(() => {
                                    const last = getLastComment(pharmacy.comments || []);
                                    if (!last) return "-";
                                    return (
                                      <span className="font-semibold hover:text-blue-600 hover:underline">{formatDate(last.createdAt)}</span>
                                    );
                                  })()}
                                </td>
                                {/* Author Column: Just Phone/Name */}
                                <td className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap align-middle" onClick={() => onLeadHistoryClick?.(pharmacy)} style={onLeadHistoryClick ? { cursor: "pointer" } : {}}>
                                  {(() => {
                                    const last = getLastComment(pharmacy.comments || []);
                                    if (!last) return "-";
                                    return (
                                      <span className="text-gray-500 text-xs hover:text-blue-600 hover:underline">{last.creator?.phone || "-"}</span>
                                    );
                                  })()}
                                </td>
                                {/* Comment Text Column */}
                                <td className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs align-middle" onClick={() => onLeadHistoryClick?.(pharmacy)} style={onLeadHistoryClick ? { cursor: "pointer" } : {}}>
                                  <div className="max-w-[200px] break-words hover:text-blue-600 hover:underline">
                                    {getLastComment(pharmacy.comments || [])?.coment || getLastComment(pharmacy.comments || [])?.comment || "-"}
                                  </div>
                                </td>
                              </>
                            )}
                          </>
                        )}

                        {/* STIR Column - Now visible for all roles */}
                        <td className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap">
                          {(pharmacy.lead as any)?.stir || "-"}
                        </td>

                        {/* Additional Phone - Only for admin */}
                        {isAdmin && (
                          <td className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap">
                            {(pharmacy.lead as any)?.additionalPhone || "-"}
                          </td>
                        )}

                        {/* Juridical Data Columns - Now visible for all roles */}
                        <td className="px-2 md:px-4 py-2 md:py-3 text-gray-600 text-xs max-w-xs truncate">
                          {(pharmacy.lead as any)?.juridicalName || "-"}
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-gray-600 text-xs align-top">
                          <div
                            className="break-words"
                            style={{ lineHeight: "1.4em", minHeight: "4.2em" }}
                          >
                            {(pharmacy.lead as any)?.juridicalAddress || "-"}
                          </div>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-gray-600 text-xs max-w-xs truncate">
                          {(pharmacy.lead as any)?.bankName || "-"}
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs font-mono whitespace-nowrap">
                          {(pharmacy.lead as any)?.bankAccount || "-"}
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-3 text-gray-900 text-xs whitespace-nowrap">
                          {(pharmacy.lead as any)?.mfo || "-"}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div >
    </div >
  );
}
