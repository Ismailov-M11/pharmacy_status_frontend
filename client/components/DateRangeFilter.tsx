import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import {
    format,
    subDays,
    startOfMonth,
    endOfMonth,
    subMonths,
    startOfDay,
    endOfDay,
} from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { DateRange } from "react-day-picker";

interface DateRangeFilterProps {
    onFilterChange: (from: Date | undefined, to: Date | undefined) => void;
    onReset: () => void;
}

export function DateRangeFilter({ onFilterChange, onReset }: DateRangeFilterProps) {
    const { t } = useLanguage();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [open, setOpen] = useState(false);
    const [activePreset, setActivePreset] = useState<string | null>(null);

    const today = new Date();

    const presets = [
        {
            id: "today",
            label: t.today,
            getRange: () => ({ from: startOfDay(today), to: endOfDay(today) }),
        },
        {
            id: "yesterday",
            label: t.yesterday,
            getRange: () => {
                const d = subDays(today, 1);
                return { from: startOfDay(d), to: endOfDay(d) };
            },
        },
        {
            id: "last7",
            label: t.last7Days,
            getRange: () => ({ from: startOfDay(subDays(today, 6)), to: endOfDay(today) }),
        },
        {
            id: "last30",
            label: t.last30Days,
            getRange: () => ({ from: startOfDay(subDays(today, 29)), to: endOfDay(today) }),
        },
        {
            id: "thisMonth",
            label: t.thisMonth,
            getRange: () => ({ from: startOfMonth(today), to: endOfMonth(today) }),
        },
        {
            id: "lastMonth",
            label: t.lastMonth,
            getRange: () => {
                const last = subMonths(today, 1);
                return { from: startOfMonth(last), to: endOfMonth(last) };
            },
        },
    ];

    const handlePresetClick = (preset: (typeof presets)[number]) => {
        const range = preset.getRange();
        setDateRange(range);
        setActivePreset(preset.id);
        onFilterChange(range.from, range.to);
        setOpen(false);
    };

    const handleCalendarSelect = (range: DateRange | undefined) => {
        setDateRange(range);
        setActivePreset(null);
    };

    const handleApply = () => {
        if (dateRange?.from) {
            onFilterChange(dateRange.from, dateRange.to ?? dateRange.from);
        }
        setOpen(false);
    };

    const handleReset = () => {
        setDateRange(undefined);
        setActivePreset(null);
        onReset();
        setOpen(false);
    };

    const triggerLabel = dateRange?.from
        ? dateRange.to
            ? `${format(dateRange.from, "dd.MM.yyyy")} – ${format(dateRange.to, "dd.MM.yyyy")}`
            : format(dateRange.from, "dd.MM.yyyy")
        : t.selectPeriod;

    return (
        <div className="flex flex-wrap items-center gap-3 mb-6">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className="justify-start text-left font-normal min-w-[220px]"
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        <span>{triggerLabel}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <div className="flex">
                        {/* Preset buttons */}
                        <div className="flex flex-col gap-1 p-3 border-r border-gray-200 dark:border-gray-700 min-w-[140px]">
                            {presets.map((preset) => (
                                <Button
                                    key={preset.id}
                                    variant={activePreset === preset.id ? "default" : "ghost"}
                                    size="sm"
                                    className="justify-start"
                                    onClick={() => handlePresetClick(preset)}
                                >
                                    {preset.label}
                                </Button>
                            ))}
                        </div>

                        {/* Calendar */}
                        <div className="flex flex-col">
                            <Calendar
                                mode="range"
                                selected={dateRange}
                                onSelect={handleCalendarSelect}
                                numberOfMonths={1}
                                initialFocus
                            />
                            <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                                <Button onClick={handleApply} size="sm" className="flex-1">
                                    {t.apply}
                                </Button>
                                <Button
                                    onClick={handleReset}
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                >
                                    {t.reset}
                                </Button>
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
