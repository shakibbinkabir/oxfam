import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { listAuditLogs, exportAuditLogs } from "../../api/auditLog";
import toast from "react-hot-toast";

const ACTION_COLORS = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  restore: "bg-purple-100 text-purple-700",
};

const ENTITY_TYPES = ["indicator_value", "risk_index", "bulk_upload", "indicator", "user", "scenario"];
const ACTIONS = ["create", "update", "delete", "restore"];

export default function AuditLogPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const pageSize = 20;

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = { skip: page * pageSize, limit: pageSize };
      if (entityFilter) params.entity_type = entityFilter;
      if (actionFilter) params.action = actionFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await listAuditLogs(params);
      setLogs(res.data.data.logs || []);
      setTotal(res.data.data.total || 0);
    } catch {
      toast.error(t('audit.failedLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, [page, entityFilter, actionFilter, dateFrom, dateTo]);

  async function handleExport() {
    try {
      const params = {};
      if (entityFilter) params.entity_type = entityFilter;
      if (actionFilter) params.action = actionFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await exportAuditLogs(params);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit_logs.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('audit.failedExport'));
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('audit.title')}</h1>
        <button
          onClick={handleExport}
          className="px-4 py-2 border border-[#1B4F72] text-[#1B4F72] rounded-md text-sm font-medium hover:bg-[#1B4F72] hover:text-white transition-colors"
        >
          {t('audit.exportCsv')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="">{t('audit.allEntities')}</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="">{t('audit.allActions')}</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          placeholder="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          placeholder="To date"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('audit.timestamp')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('audit.user')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('audit.action')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('audit.entity')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('audit.entityId')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('audit.changes')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t('audit.loading')}</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t('audit.noLogs')}</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{log.user_name || "Unknown"}</div>
                    <div className="text-xs text-gray-400">{log.user_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-700"}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{log.entity_type}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{log.entity_id}</td>
                  <td className="px-4 py-3">
                    {(log.old_values || log.new_values) ? (
                      <button
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="text-[#1B4F72] text-xs hover:underline"
                      >
                        {expandedId === log.id ? t('audit.hide') : t('audit.viewChanges')}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Expanded change details */}
      {expandedId && logs.find((l) => l.id === expandedId) && (
        <div className="mt-2 bg-gray-50 border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">{t('audit.changeDetails')}</h3>
          <div className="grid grid-cols-2 gap-4">
            {logs.find((l) => l.id === expandedId).old_values && (
              <div>
                <div className="text-xs font-medium text-red-600 mb-1">{t('audit.oldValues')}</div>
                <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-48">
                  {JSON.stringify(logs.find((l) => l.id === expandedId).old_values, null, 2)}
                </pre>
              </div>
            )}
            {logs.find((l) => l.id === expandedId).new_values && (
              <div>
                <div className="text-xs font-medium text-green-600 mb-1">{t('audit.newValues')}</div>
                <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-48">
                  {JSON.stringify(logs.find((l) => l.id === expandedId).new_values, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>{t('audit.showing')} {page * pageSize + 1}--{Math.min((page + 1) * pageSize, total)} {t('audit.ofTotal')} {total}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 border rounded-md disabled:opacity-40 hover:bg-gray-50"
            >
              {t('audit.previous')}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 border rounded-md disabled:opacity-40 hover:bg-gray-50"
            >
              {t('audit.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
