import { useState, useEffect, useRef, ChangeEvent } from "react";
import { Pharmacy, StatusHistoryRecord, uploadPharmacyFile, getLeadNotes, LeadNote, createLeadNote } from "@/lib/api";
import { ContractPanel } from "./ContractPanel";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChangeHistory } from "./ChangeHistory";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, Upload, FileText, Download, Trash2 } from "lucide-react";

interface PharmacyDetailModalProps {
  pharmacy: Pharmacy | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (
    pharmacyId: number,
    field: "brandedPacket" | "training",
    value: boolean,
    comment: string,
  ) => Promise<void>;
  isAdmin?: boolean;
  currentUsername?: string;
  changeHistory?: StatusHistoryRecord[];
  onDeleteHistory?: (ids: number[]) => void;
  onUpdate?: () => void;
  initialTab?: "details" | "files" | "leadHistory" | "contract";
}

export function PharmacyDetailModal({
  pharmacy,
  isOpen,
  onClose,
  onUpdateStatus,
  isAdmin = false,
  currentUsername = "User",
  changeHistory = [],
  onDeleteHistory,
  onUpdate,
  initialTab = "details",
}: PharmacyDetailModalProps) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "details" | "training" | "package" | "history" | "leadHistory" | "files" | "contract"
  >("details");
  const [trainingComment, setTrainingComment] = useState("");
  const [packageComment, setPackageComment] = useState("");
  const [trainingError, setTrainingError] = useState("");

  const [packageError, setPackageError] = useState("");
  const [pendingTraining, setPendingTraining] = useState<boolean | null>(null);
  const [pendingPacket, setPendingPacket] = useState<boolean | null>(null);

  const [leadNotes, setLeadNotes] = useState<LeadNote[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  useEffect(() => {
    if (activeTab === "leadHistory" && pharmacy) {
      const leadId = pharmacy.lead?.id || pharmacy.id;
      const authToken = token || localStorage.getItem("auth_token");
      if (!authToken) return;
      setIsLoadingNotes(true);
      setLeadNotes([]);
      getLeadNotes(authToken, leadId)
        .then(setLeadNotes)
        .catch(() => setLeadNotes([]))
        .finally(() => setIsLoadingNotes(false));
    }
  }, [activeTab, pharmacy?.id]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && pharmacy) {
      // Try to get token from context or localStorage
      const authToken = token || localStorage.getItem("auth_token");

      if (!authToken) {
        console.error("No auth token found in context or localStorage");
        toast.error("Authentication token not found");
        return;
      }

      setIsUploading(true);
      try {
        await uploadPharmacyFile(authToken, pharmacy.id, file);
        toast.success(t.saved || "File uploaded successfully");
        if (onUpdate) {
          onUpdate(); // Trigger refresh in parent
        }
        // Clear input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        console.error("Upload failed", error);
        toast.error(t.error || "Failed to upload file");
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Reset to initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Reset pending state when pharmacy changes or tab changes
  if (pharmacy && pendingTraining === null && activeTab === 'training') {
    setPendingTraining((pharmacy as any).training);
  }
  if (pharmacy && pendingPacket === null && activeTab === 'package') {
    setPendingPacket((pharmacy as any).brandedPacket);
  }

  if (!pharmacy) return null;

  const handleCreateComment = async () => {
    if (!newComment.trim() || !pharmacy) return;
    const authToken = token || localStorage.getItem("auth_token");
    if (!authToken) return;
    const leadId = pharmacy.lead?.id || pharmacy.id;
    setIsSubmittingComment(true);
    try {
      await createLeadNote(authToken, leadId, newComment.trim());
      setNewComment("");
      toast.success(t.saved || "Saved");
    } catch (error) {
      toast.error(t.error || "Error");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleStatusChange = async (
    field: "brandedPacket" | "training",
    newValue: boolean,
    comment: string,
    setError: (err: string) => void,
  ) => {
    if (!comment.trim()) {
      setError(t.commentRequired || "Comment is required");
      return;
    }

    setError("");
    setIsUpdating(true);

    try {
      await onUpdateStatus(pharmacy.id, field, newValue, comment);

      if (field === "training") {
        setTrainingComment("");
      } else {
        setPackageComment("");
      }

      toast.success(t.saved);
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error(t.error);
    } finally {
      setIsUpdating(false);
    }
  };

  const pharmacyChangeHistory = changeHistory;

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("ru-RU", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden sm:w-full p-0 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        {/* Sticky header with tabs */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 z-20 border-b dark:border-gray-700">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <DialogTitle className="break-words text-base sm:text-lg text-gray-900 dark:text-gray-100">
                  {t.pharmacyDetails || "Pharmacy Details"}
                </DialogTitle>
                <DialogDescription className="break-words text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {t.code || "Code"}: {pharmacy.code}
                </DialogDescription>
              </div>
              <button
                onClick={onClose}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground text-gray-500 dark:text-gray-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span className="sr-only">Close</span>
              </button>
            </div>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 border-t dark:border-gray-700 overflow-x-auto px-4 sm:px-6">
            <button
              onClick={() => setActiveTab("details")}
              className={`px-2 sm:px-4 py-2 font-medium border-b-2 transition-colors text-xs sm:text-sm whitespace-nowrap ${activeTab === "details"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
            >
              {t.details || "Details"}
            </button>
            <button
              onClick={() => setActiveTab("training")}
              className={`px-2 sm:px-4 py-2 font-medium border-b-2 transition-colors text-xs sm:text-sm whitespace-nowrap ${activeTab === "training"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
            >
              {t.training || "Training"}
            </button>
            <button
              onClick={() => setActiveTab("package")}
              className={`px-2 sm:px-4 py-2 font-medium border-b-2 transition-colors text-xs sm:text-sm whitespace-nowrap ${activeTab === "package"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
            >
              {t.brandedPacket || "Branded Packet"}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-2 sm:px-4 py-2 font-medium border-b-2 transition-colors text-xs sm:text-sm whitespace-nowrap ${activeTab === "history"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
            >
              {t.history || "History"}
            </button>
            {/* New Lead History Tab */}
            <button
              onClick={() => setActiveTab("leadHistory")}
              className={`px-2 sm:px-4 py-2 font-medium border-b-2 transition-colors text-xs sm:text-sm whitespace-nowrap ${activeTab === "leadHistory"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
            >
              {t.leadHistory || "Lead History"}
            </button>
            {/* Files Tab */}
            <button
              onClick={() => setActiveTab("files")}
              className={`px-2 sm:px-4 py-2 font-medium border-b-2 transition-colors text-xs sm:text-sm whitespace-nowrap ${activeTab === "files"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
            >
              {t.files || "Files"}
            </button>
            {/* Contract Tab */}
            <button
              onClick={() => setActiveTab("contract")}
              className={`px-2 sm:px-4 py-2 font-medium border-b-2 transition-colors text-xs sm:text-sm whitespace-nowrap ${activeTab === "contract"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
            >
              {(t as any).contract || "Договор"}
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 bg-white dark:bg-gray-800">

          {/* Details Tab */}
          {activeTab === "details" && (
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.code || "Code"}
                  </label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs sm:text-sm break-words text-gray-900 dark:text-gray-100">
                    {pharmacy.code}
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.status || "Status"}
                  </label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium inline-block ${pharmacy.active
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                        }`}
                    >
                      {pharmacy.active ? t.active : t.inactive}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.pharmacyName || "Pharmacy Name"}
                </label>
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs sm:text-sm break-words text-gray-900 dark:text-gray-100">
                  {pharmacy.name}
                </div>
              </div>

              {(pharmacy as any).slug && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Slug
                  </label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs sm:text-sm break-words text-gray-900 dark:text-gray-100 font-mono">
                    {(pharmacy as any).slug}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.address || "Address"}
                </label>
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs sm:text-sm break-words text-gray-900 dark:text-gray-100">
                  {pharmacy.address}
                </div>
              </div>

              {(pharmacy as any).landmark && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.landmark || "Landmark"}
                  </label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs sm:text-sm break-words text-gray-900 dark:text-gray-100">
                    {(pharmacy as any).landmark}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.pharmacyPhone || "Pharmacy Phone"}
                  </label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                    {pharmacy.phone || "-"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.leadPhone || "Lead Phone"}
                  </label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs sm:text-sm break-words text-gray-900 dark:text-gray-100">
                    {pharmacy.lead?.phone || "-"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col h-full">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex-grow">
                    {t.telegramBot || "Telegram Bot"}
                  </label>
                  <div className={`p-2 rounded border border-gray-200 dark:border-gray-700 text-center text-xs sm:text-sm mt-auto ${(pharmacy as any).marketChats?.length > 0
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-200"
                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-200"
                    }`}>
                    {(pharmacy as any).marketChats?.length > 0 ? t.yes : t.no}
                  </div>
                </div>
                <div className="flex flex-col h-full">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex-grow">
                    {t.training || "Training"}
                  </label>
                  <div className={`p-2 rounded border border-gray-200 dark:border-gray-700 text-center text-xs sm:text-sm mt-auto ${(pharmacy as any).training
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-200"
                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-200"
                    }`}>
                    {(pharmacy as any).training ? t.yesTraining : t.noTraining}
                  </div>
                </div>
                <div className="flex flex-col h-full">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex-grow">
                    {t.brandedPacket || "Branded Packet"}
                  </label>
                  <div className={`p-2 rounded border border-gray-200 dark:border-gray-700 text-center text-xs sm:text-sm mt-auto ${(pharmacy as any).brandedPacket
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-200"
                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-200"
                    }`}>
                    {(pharmacy as any).brandedPacket ? t.yes : t.no}
                  </div>
                </div>
              </div>

              {/* Telegram Bot Users Section - shown for all users */}
              {(pharmacy as any).marketChats && (pharmacy as any).marketChats.length > 0 && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t.telegramUsers || "Telegram Bot Users"}
                  </label>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                            №
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                            {t.name || "Name"}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                            {t.username || "Username"}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                            {t.chatId || "Chat ID"}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {(pharmacy as any).marketChats.map((chat: any, index: number) => (
                          <tr key={chat.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-3 py-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                              {index + 1}
                            </td>
                            <td className="px-3 py-2 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                              {chat.name || "-"}
                            </td>
                            <td className="px-3 py-2 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                              @{chat.username || "-"}
                            </td>
                            <td className="px-3 py-2 text-xs sm:text-sm text-gray-900 dark:text-gray-100 font-mono">
                              {chat.id}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Lead Status - shown for admins only */}
              {isAdmin && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.leadStatus || "Lead Status"}
                  </label>
                  <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                    {pharmacy.lead?.status || "-"}
                  </div>
                </div>
              )}

              {isAdmin && (
                <>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t.stir || "STIR"}
                      </label>
                      <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                        {(pharmacy.lead as any)?.stir || "-"}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t.additionalPhone || "Additional Phone"}
                      </label>
                      <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                        {(pharmacy.lead as any)?.additionalPhone || "-"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      {t.juridicalName || "Juridical Name"}
                    </label>
                    <div className="p-2 bg-gray-50 rounded border border-gray-200 text-xs sm:text-sm">
                      {(pharmacy.lead as any)?.juridicalName || "-"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      {t.juridicalAddress || "Juridical Address"}
                    </label>
                    <div className="p-2 bg-gray-50 rounded border border-gray-200 text-xs sm:text-sm">
                      {(pharmacy.lead as any)?.juridicalAddress || "-"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        {t.bankName || "Bank Name"}
                      </label>
                      <div className="p-2 bg-gray-50 rounded border border-gray-200 text-xs sm:text-sm">
                        {(pharmacy.lead as any)?.bankName || "-"}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        {t.mfo || "MFO"}
                      </label>
                      <div className="p-2 bg-gray-50 rounded border border-gray-200 text-xs sm:text-sm">
                        {(pharmacy.lead as any)?.mfo || "-"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      {t.bankAccount || "Bank Account"}
                    </label>
                    <div className="p-2 bg-gray-50 rounded border border-gray-200 text-xs sm:text-sm">
                      {(pharmacy.lead as any)?.bankAccount || "-"}
                    </div>
                  </div>
                </>
              )}

            </div>
          )}

          {/* Training Tab */}
          {activeTab === "training" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="space-y-0.5">
                  <Label className="text-sm sm:text-base font-medium">
                    {t.changeStatus || "Change Status"}
                  </Label>
                </div>
                <Select
                  value={
                    (pendingTraining ?? (pharmacy as any).training) ? "true" : "false"
                  }
                  onValueChange={(value) => setPendingTraining(value === "true")}
                >
                  <SelectTrigger
                    className={`w-36 border font-bold h-9 ${(pendingTraining ?? (pharmacy as any).training)
                      ? "bg-green-100 text-green-800 border-green-200"
                      : "bg-red-100 text-red-800 border-red-200"
                      }`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">{t.yesTraining || "YES"}</SelectItem>
                    <SelectItem value="false">{t.noTraining || "NO"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t.comment || "Comment"} *
                </label>
                <Textarea
                  value={trainingComment}
                  onChange={(e) => {
                    setTrainingComment(e.target.value);
                    setTrainingError("");
                  }}
                  placeholder={t.enterComment || "Enter your comment..."}
                  className="min-h-24 text-sm"
                />
                {trainingError && (
                  <p className="text-red-500 text-xs sm:text-sm mt-1">{trainingError}</p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  onClick={() =>
                    handleStatusChange(
                      "training",
                      pendingTraining ?? (pharmacy as any).training,
                      trainingComment,
                      setTrainingError,
                    )
                  }
                  disabled={isUpdating || pendingTraining === (pharmacy as any).training}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-sm sm:text-base h-10 sm:h-11"
                >
                  {isUpdating ? "..." : t.update || "Update"}
                </Button>
              </div>
            </div>
          )}

          {/* Package Tab */}
          {activeTab === "package" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="space-y-0.5">
                  <Label className="text-sm sm:text-base font-medium">
                    {t.changeStatus || "Change Status"}
                  </Label>
                </div>
                <Select
                  value={
                    (pendingPacket ?? (pharmacy as any).brandedPacket) ? "true" : "false"
                  }
                  onValueChange={(value) => setPendingPacket(value === "true")}
                >
                  <SelectTrigger
                    className={`w-36 border font-bold h-9 ${(pendingPacket ?? (pharmacy as any).brandedPacket)
                      ? "bg-green-100 text-green-800 border-green-200"
                      : "bg-red-100 text-red-800 border-red-200"
                      }`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">{t.yes || "YES"}</SelectItem>
                    <SelectItem value="false">{t.no || "NO"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t.comment || "Comment"} *
                </label>
                <Textarea
                  value={packageComment}
                  onChange={(e) => {
                    setPackageComment(e.target.value);
                    setPackageError("");
                  }}
                  placeholder={t.enterComment || "Enter your comment..."}
                  className="min-h-24 text-sm"
                />
                {packageError && (
                  <p className="text-red-500 text-xs sm:text-sm mt-1">{packageError}</p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  onClick={() =>
                    handleStatusChange(
                      "brandedPacket",
                      pendingPacket ?? (pharmacy as any).brandedPacket,
                      packageComment,
                      setPackageError,
                    )
                  }
                  disabled={isUpdating || pendingPacket === (pharmacy as any).brandedPacket}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-sm sm:text-base h-10 sm:h-11"
                >
                  {isUpdating ? "..." : t.update || "Update"}
                </Button>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <ChangeHistory
              records={pharmacyChangeHistory}
              onDelete={onDeleteHistory}
              isAdmin={isAdmin}
            />
          )}

          {/* Lead History Tab Content */}
          {activeTab === "leadHistory" && (
            <div className="space-y-4">
              {/* Add Comment Form */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.addComment || "Добавить комментарий"}
                </label>
                <div className="flex items-stretch gap-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={t.commentPlaceholder || "Введите комментарий..."}
                    className="flex-1 text-xs sm:text-sm resize-y"
                    rows={2}
                    style={{ minHeight: "64px" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleCreateComment();
                      }
                    }}
                  />
                  <Button
                    onClick={handleCreateComment}
                    disabled={isSubmittingComment || !newComment.trim()}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 self-start mt-0 h-[64px] px-4"
                  >
                    {isSubmittingComment ? "..." : (t.send || "Отправить")}
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Ctrl+Enter для отправки</p>
              </div>

              {/* Notes Table */}
              <div className="overflow-x-auto border rounded-md">
                {isLoadingNotes ? (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {t.loading || "Loading..."}
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t.lastCommentDate || "Дата"}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          {t.lastCommentUser || "Автор"}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Комментарий
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {leadNotes.length > 0 ? (
                        leadNotes.map((note, index) => {
                          const dateStr = note.createdAt || note.date || note.createdDate || "";
                          const userInfo = note.creator || note.user;
                          const userPhone = userInfo?.phone || userInfo?.name || userInfo?.username || "-";
                          const noteText = note.note || note.text || note.comment || "-";
                          const formattedDate = dateStr
                            ? new Date(dateStr).toLocaleString("ru-RU", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-";
                          return (
                            <tr key={note.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap align-top">
                                {formattedDate}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap align-top">
                                {userPhone}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 align-top">
                                <div className="break-words max-w-sm whitespace-pre-wrap">
                                  {noteText}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            {t.noData || "No data"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Files Tab Content */}
          {activeTab === "files" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t.filesList || "Files List"}
                </h3>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploading ? (t.loading || "...") : (t.uploadFile || "Upload File")}
                </Button>
              </div>

              <div className="border rounded-md border-gray-200 dark:border-gray-700 overflow-x-auto">
                <table className="divide-y divide-gray-200 dark:divide-gray-700 min-w-[600px] w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {t.fileName || "File Name"}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                        {t.date || "Date"}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                        {t.createdBy || "Created By"}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                        {t.actions || "Actions"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {pharmacy.licence ? (
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          <div className="flex items-center min-w-0">
                            <FileText className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0" />
                            <div className="text-sm text-gray-900 dark:text-gray-100 break-words whitespace-normal min-w-[200px]">
                              {pharmacy.licence.originalName}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {formatDate(pharmacy.licence.creationDate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {pharmacy.licence.createdBy || "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          <a
                            href={pharmacy.licence.attachmentLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <FileText className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                            <p>{t.noFiles || "No files uploaded yet"}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Contract Tab Content */}
          {activeTab === "contract" && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {(t as any).contract || "Договор"}
              </h3>
              <ContractPanel
                tin={(pharmacy.lead as any)?.stir || (pharmacy as any)?.stir || null}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog >
  );
}
