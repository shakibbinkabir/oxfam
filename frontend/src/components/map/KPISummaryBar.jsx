import { useState, useEffect } from "react";
import { getScoresSummary } from "../../api/scores";
import useMapContext from "../../contexts/MapContext";

const LEVEL_LABELS = { 1: "Divisions", 2: "Districts", 3: "Upazilas", 4: "Unions" };

export default function KPISummaryBar() {
  const { level, parentPcode } = useMapContext();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
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

  const levelLabel = LEVEL_LABELS[level] || "Areas";

  if (loading && !summary) {
    return (
      <div className="h-[60px] bg-[#1B4F72] flex items-center justify-center">
        <span className="text-white/60 text-sm">Loading summary...</span>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="h-[60px] bg-[#1B4F72] flex items-center justify-center">
        <span className="text-white/60 text-sm">No summary data available</span>
      </div>
    );
  }

  return (
    <div className="h-[60px] bg-[#1B4F72] flex items-center px-4 gap-6 overflow-x-auto">
      {/* Highest Risk */}
      <KPIItem
        label="Highest Risk"
        value={summary.highest_risk ? `${summary.highest_risk.name}` : "—"}
        sub={summary.highest_risk ? `CRI ${summary.highest_risk.cri?.toFixed(3)}` : null}
        highlight
      />

      <Divider />

      {/* Average CRI */}
      <KPIItem
        label="Average CRI"
        value={summary.average_cri != null ? summary.average_cri.toFixed(3) : "—"}
      />

      <Divider />

      {/* High Risk Count */}
      <KPIItem
        label={`High Risk ${levelLabel}`}
        value={summary.high_risk_boundaries ?? 0}
        sub="CRI > 0.6"
      />

      <Divider />

      {/* Data Coverage */}
      <KPIItem
        label="Data Coverage"
        value={`${summary.data_coverage_pct?.toFixed(1) ?? 0}%`}
        sub={`${summary.boundaries_with_data ?? 0} of ${summary.total_boundaries ?? 0} ${levelLabel.toLowerCase()}`}
      />
    </div>
  );
}

function KPIItem({ label, value, sub, highlight }) {
  return (
    <div className="flex flex-col min-w-0 shrink-0">
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
