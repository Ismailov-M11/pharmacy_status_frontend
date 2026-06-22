import { useLanguage } from "@/contexts/LanguageContext";
import { StatusHistoryRecord } from "@/lib/api";
import { format } from "date-fns";
import { ru, uz } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useState } from "react";
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

interface ChangeHistoryProps {
  records: StatusHistoryRecord[];
  onDelete?: (ids: number[]) => void;
  isAdmin?: boolean;
}

export function ChangeHistory({ records, onDelete, isAdmin = false }: ChangeHistoryProps) {
  const { t, language } = useLanguage();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Select locale based on current language
  const dateLocale = language === 'uz' ? uz : ru;

  if (records.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">{t.noChanges || "No changes yet"}</p>
      </div>
    );
  }

  const handleCheckboxChange = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  };

  const handleDeleteClick = () => {
    if (selectedIds.length > 0) {
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmDelete = () => {
    if (onDelete && selectedIds.length > 0) {
      onDelete(selectedIds);
      setSelectedIds([]);
    }
    setShowConfirmDialog(false);
  };

  const handleCancelDelete = () => {
    setShowConfirmDialog(false);
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  return (
    <div>
      {/* Action buttons - shown when items are selected */}
      {isAdmin && selectedIds.length > 0 && (
        <div className="flex gap-2 mb-3 justify-end">
          <Button variant="outline" size="sm" onClick={handleClearSelection} className="gap-2">
            {t.clear || "Очистить"}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDeleteClick} className="gap-2">
            <Trash2 className="h-4 w-4" />
            {t.deleteSelected || "Удалить выбранные"} ({selectedIds.length})
          </Button>
        </div>
      )}

      <div>
        {records
          .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
          .map((record) => {
            const fieldLabel = record.field === "training"
              ? (t.training || "Обучение")
              : (t.brandedPacket || "Брендированный пакет");
            const valueLabel = record.new_value
              ? (record.field === "training" ? (t.yesTraining || "ДА") : (t.yes || "ДА"))
              : (record.field === "training" ? (t.noTraining || "НЕТ") : (t.no || "НЕТ"));
            const badgeCls = record.new_value
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
              : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";

            return (
              <div key={record.id} className="py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(record.id)}
                      onChange={() => handleCheckboxChange(record.id)}
                      className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                  )}
                  {/* Date */}
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 w-32">
                    {format(new Date(record.changed_at), "dd.MM.yyyy HH:mm")}
                  </span>
                  {/* Status badge */}
                  <div className="flex-1 flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{fieldLabel}:</span>
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${badgeCls}`}>
                      {valueLabel}
                    </span>
                  </div>
                  {/* Author */}
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0 text-right">
                    {record.changed_by}
                  </span>
                </div>
                {record.comment && (
                  <p className="mt-1.5 ml-[140px] text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {record.comment}
                  </p>
                )}
              </div>
            );
          })}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDelete || "Вы действительно хотите удалить?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.length === 1
                ? (t.deleteWarning || "Эта запись будет удалена безвозвратно.")
                : `${t.deleteWarningMultiple || "Выбранные записи будут удалены безвозвратно."} (${selectedIds.length})`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>
              {t.confirmNo || "НЕТ"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              {t.confirmYes || "ДА"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
