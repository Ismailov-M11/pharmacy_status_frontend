import { useEffect, useState } from "react";
import { Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDavoContractStatus, getDavoContractLinks, DavoContractStatus, DavoContractLinks } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

const CONTRACTS_API_BASE = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000/api")
  .replace(/\/status$/, "");

export function ContractPanel({ tin }: { tin: string | null }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<DavoContractStatus | null>(null);
  const [links, setLinks] = useState<DavoContractLinks | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!tin) { setLoading(false); return; }
      const [s, l] = await Promise.all([
        getDavoContractStatus(tin),
        getDavoContractLinks(tin),
      ]);
      if (!alive) return;
      setStatus(s);
      setLinks(l);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [tin]);

  if (!tin) {
    return <p className="text-sm text-gray-500">У аптеки не указан ИНН (stir).</p>;
  }
  if (loading) {
    return <p className="text-sm text-gray-500">Загрузка…</p>;
  }
  if (!status || status.status === "none" || !links?.doc_id) {
    return <p className="text-sm text-gray-500">Договор в Didox не найден.</p>;
  }

  const badgeCls = {
    signed:   "bg-emerald-100 text-emerald-800",
    pending:  "bg-amber-100 text-amber-800",
    rejected: "bg-red-100 text-red-800",
  }[status.status] || "bg-gray-100 text-gray-600";

  const downloadUrl = `${CONTRACTS_API_BASE}/contracts/${encodeURIComponent(tin)}/pdf`;

  const handleCopy = async () => {
    if (!links?.copyUrl) return;
    await navigator.clipboard.writeText(links.copyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`px-2 py-1 rounded text-xs font-bold ${badgeCls}`}>
          {status.label}
        </span>
        {status.contract_number && (
          <span className="text-sm text-gray-600">№ {status.contract_number}</span>
        )}
      </div>

      {status.status === "rejected" && status.status_comment && (
        <p className="text-sm text-red-600">
          Причина отказа: {status.status_comment}
        </p>
      )}

      <div className="flex gap-3 flex-wrap">
        <Button asChild>
          <a href={downloadUrl} target="_blank" rel="noreferrer">
            <Download className="h-4 w-4 mr-2" />
            Скачать договор
          </a>
        </Button>
        <Button variant="outline" onClick={handleCopy}>
          {copied
            ? <><Check className="h-4 w-4 mr-2" />Скопировано</>
            : <><Copy className="h-4 w-4 mr-2" />Скопировать ссылку</>
          }
        </Button>
      </div>
    </div>
  );
}
