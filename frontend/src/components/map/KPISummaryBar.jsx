import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getScoresSummary } from "../../api/scores";
import { exportCsv, exportShapefile } from "../../api/exports";
import useMapContext from "../../contexts/MapContext";
import { useAuth } from "../../contexts/AuthContext";
import BoundarySearch from "./BoundarySearch";
import toast from "react-hot-toast";

export default function KPISummaryBar() {
  const { t } = useTranslation();
  const { level, parentPcode } = useMapContext();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleExportCsv() {
    try {
      const res = await exportCsv({ level });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crvap_export_adm${level}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('kpi.failedCsv'));
    }
  }

  async function handleExportShapefile() {
    try {
      const res = await exportShapefile({ level });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crvap_shapefile_adm${level}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('kpi.failedShapefile'));
    }
  }

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const params = { level };
    if (parentPcode) params.parent_pcode = parentPcode;

    getScoresSummary(params)
      .then((res) => {
        if (!cancelled) setSummary(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [level, parentPcode]);

  const levelLabel = t('levels.' + level) || t('levels.4');

  if (loading && !summary) {
    return (
      <div className="h-[60px] bg-[#1B4F72] flex items-center justify-center">
        <span className="text-white/60 text-sm">{t('kpi.loadingSummary')}</span>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="h-[60px] bg-[#1B4F72] flex items-center justify-center">
        <span className="text-white/60 text-sm">{t('kpi.noSummaryData')}</span>
      </div>
    );
  }

  return (
    <div className="h-[60px] bg-[#1B4F72] flex items-center px-4 gap-6 overflow-x-auto" role="region" aria-label="Key performance indicators">
      {/* Highest Risk */}
      <KPIItem
        label={t('kpi.highestRisk')}
        value={summary.highest_risk ? `${summary.highest_risk.name}` : "—"}
        sub={summary.highest_risk ? `CRI ${summary.highest_risk.cri?.toFixed(3)}` : null}
        highlight
      />

      <Divider />

      {/* Average CRI */}
      <KPIItem
        label={t('kpi.averageCri')}
        value={summary.average_cri != null ? summary.average_cri.toFixed(3) : "—"}
      />

      <Divider />

      {/* High Risk Count */}
      <KPIItem
        label={t('kpi.highRisk') + ' ' + levelLabel}
        value={summary.high_risk_boundaries ?? 0}
        sub="CRI > 0.6"
      />

      <Divider />

      {/* Data Coverage */}
      <KPIItem
        label={t('kpi.dataCoverage')}
        value={`${summary.data_coverage_pct?.toFixed(1) ?? 0}%`}
        sub={`${summary.boundaries_with_data ?? 0} ${t('kpi.of')} ${summary.total_boundaries ?? 0} ${levelLabel.toLowerCase()}`}
      />

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <BoundarySearch />
        <div className="w-px h-6 bg-white/20" />
        <button
          onClick={handleExportCsv}
          className="px-2.5 py-1 text-xs font-medium text-white/80 border border-white/30 rounded hover:bg-white/10 transition-colors"
          title={t('kpi.exportCsv')}
        >
          CSV
        </button>
        {isAdmin && (
          <button
            onClick={handleExportShapefile}
            className="px-2.5 py-1 text-xs font-medium text-white/80 border border-white/30 rounded hover:bg-white/10 transition-colors"
            title={t('kpi.exportShapefile')}
          >
            SHP
          </button>
        )}
      </div>
    </div>
  );
}

function KPIItem({ label, value, sub, highlight }) {
  return (
    <div className="flex flex-col min-w-0 shrink-0" aria-label={`${label}: ${value}`}>
      <span className="text-white/60 text-[10px] uppercase tracking-wider font-medium">{label}</span>
      <span className={`text-sm font-bold truncate ${highlight ? "text-yellow-300" : "text-white"}`}>
        {value}
      </span>
      {sub && <span className="text-white/40 text-[10px]">{sub}</span>}
    </div>
  );
}

function Divider() {
  return <div className="w-px h-8 bg-white/20 shrink-0" />;
}
