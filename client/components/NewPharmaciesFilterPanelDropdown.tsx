import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { endOfMonth } from "date-fns";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

// Local-timezone-safe helpers (toISOString shifts the date in UTC+N zones)
function toMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

interface NewPharmaciesFilterPanelDropdownProps {
  onFiltersChange: (
    fromDate: Date,
    toDate: Date,
    compareFromDate?: Date | null,
    compareToDate?: Date | null,
  ) => void;
  onReset: () => void;
  isLoading?: boolean;
}

export function NewPharmaciesFilterPanelDropdown({
  onFiltersChange,
  onReset,
  isLoading = false,
}: NewPharmaciesFilterPanelDropdownProps) {
  const { t } = useLanguage();
  const today = useMemo(() => new Date(), []);

  const [mode, setMode] = useState<"months" | "range">("months");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => toMonthKey(today));
  const [compareMonth, setCompareMonth] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>(() => toDateInputValue(today));
  const [toDate, setToDate] = useState<string>(() => toDateInputValue(today));
  const [validationError, setValidationError] = useState<string | null>(null);

  const months = useMemo(() => {
    const result = [];
    for (let i = 0; i < 24; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      result.push({
        value: toMonthKey(d),
        label: new Intl.DateTimeFormat("ru", {
          year: "numeric",
          month: "long",
        }).format(d),
      });
    }
    return result;
  }, [today]);

  const validateDates = (from: Date, to: Date): boolean => {
    setValidationError(null);

    if (from > to) {
      setValidationError('Дата "С" не может быть позже даты "По"');
      return false;
    }

    const diffDays = Math.ceil(
      Math.abs(to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays > 366) {
      toast.warning(
        "⚠️ Период больше 366 дней. Показаны данные, но это может быть слишком большой диапазон.",
      );
    }

    return true;
  };

  const handleApply = () => {
    if (mode === "months") {
      const [year, month] = selectedMonth.split("-").map(Number);
      const from = new Date(year, month - 1, 1);
      const to = endOfMonth(from);

      if (!compareMonth) {
        if (validateDates(from, to)) {
          onFiltersChange(from, to, null, null);
        }
        return;
      }

      const [cYear, cMonth] = compareMonth.split("-").map(Number);
      const compareFrom = new Date(cYear, cMonth - 1, 1);
      const compareTo = endOfMonth(compareFrom);

      if (validateDates(from, to) && validateDates(compareFrom, compareTo)) {
        onFiltersChange(from, to, compareFrom, compareTo);
      }
    } else {
      const from = parseDateInput(fromDate);
      const to = parseDateInput(toDate);
      to.setHours(23, 59, 59, 999);

      if (validateDates(from, to)) {
        onFiltersChange(from, to, null, null);
      }
    }
  };

  const handleReset = () => {
    setMode("months");
    setSelectedMonth(toMonthKey(today));
    setCompareMonth("");
    setFromDate(toDateInputValue(today));
    setToDate(toDateInputValue(today));
    setValidationError(null);
    onReset();
  };

  return (
    <Card className="p-4 md:p-6 mb-6">
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700 block mb-2">
          {t.filterMode}
        </label>
        <Select
          value={mode}
          onValueChange={(value) => {
            setMode(value as "months" | "range");
            setValidationError(null);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="months">{t.byMonths}</SelectItem>
            <SelectItem value="range">{t.byPeriod}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "months" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              {t.currentMonth}
            </label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              {t.compareTo}
            </label>
            <Select value={compareMonth} onValueChange={setCompareMonth}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">—</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              {t.from}
            </label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setValidationError(null);
              }}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              {t.to}
            </label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setValidationError(null);
              }}
              className="w-full"
            />
          </div>
        </div>
      )}

      {validationError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {validationError}
        </div>
      )}

      <div className="flex gap-2 flex-col sm:flex-row">
        <Button
          onClick={handleApply}
          disabled={isLoading || !!validationError}
          className="bg-purple-700 hover:bg-purple-800 text-white flex-1 sm:flex-none"
        >
          {isLoading ? t.loading_action : t.apply_action}
        </Button>
        <Button
          onClick={handleReset}
          variant="outline"
          className="border-purple-700 text-purple-700 hover:bg-purple-50 flex-1 sm:flex-none"
        >
          {t.reset}
        </Button>
      </div>
    </Card>
  );
}
