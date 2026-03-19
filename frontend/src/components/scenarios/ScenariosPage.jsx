import { useState, useEffect, useCallback } from "react";
import { listScenarios, deleteScenario } from "../../api/simulation";
import { useAuth } from "../../contexts/AuthContext";

const CRI_CATEGORY_COLORS = {
  "Very Low": "text-green-700 bg-green-100",
  Low: "text-lime-700 bg-lime-100",
  Medium: "text-yellow-700 bg-yellow-100",
  High: "text-orange-700 bg-orange-100",
  "Very High": "text-red-700 bg-red-100",
};

function getCriCategory(cri) {
  if (cri == null) return null;
  if (cri < 0.2) return "Very Low";
  if (cri < 0.4) return "Low";
  if (cri < 0.6) return "Medium";
  if (cri < 0.8) return "High";
  return "Very High";
}

export default function ScenariosPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [scenarios, setScenarios] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const limit = 20;

  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    try {
      const params = { skip: page * limit, limit };
      if (search) params.search = search;
      const res = await listScenarios(params);
      setScenarios(res.data.data.scenarios || []);
      setTotal(res.data.data.total || 0);
    } catch {
      setScenarios([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  async function handleDelete(id) {
    if (!confirm("Delete this scenario?")) return;
    try {
      await deleteScenario(id);
      fetchScenarios();
    } catch {
      // ignore
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Saved Scenarios</h1>
          <p className="text-sm text-gray-500 mt-1">What-if simulation scenarios saved by administrators</p>
        </div>
        <div className="text-sm text-gray-500">{total} scenario{total !== 1 ? "s" : ""}</div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search scenarios..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="w-full max-w-sm px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading scenarios...</div>
      ) : scenarios.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <p className="text-gray-400">No scenarios found</p>
          <p className="text-sm text-gray-400 mt-1">Run a simulation from the dashboard and save it as a scenario</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scenarios.map((s) => {
            const delta = s.delta_cri;
            const origCat = getCriCategory(s.original_cri);
            const simCat = getCriCategory(s.simulated_cri);
            const isExpanded = expanded === s.id;

            return (
              <div
                key={s.id}
                className="border rounded-lg bg-white overflow-hidden hover:shadow-sm transition-shadow"
              >
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : s.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{s.name}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {s.boundary_pcode}
                      </span>
                    </div>
                    {s.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{s.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 ml-4">
                    {/* CRI scores */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">{s.original_cri?.toFixed(3) ?? "N/A"}</span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className={`font-medium ${
                        delta != null && delta < 0 ? "text-green-600" : delta > 0 ? "text-red-600" : "text-gray-700"
                      }`}>
                        {s.simulated_cri?.toFixed(3) ?? "N/A"}
                      </span>
                    </div>

                    {/* Delta badge */}
                    {delta != null && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        delta < 0 ? "bg-green-100 text-green-700" : delta > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {delta >= 0 ? "+" : ""}{delta.toFixed(4)}
                      </span>
                    )}

                    {/* Date */}
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : ""}
                    </span>

                    {/* Expand indicator */}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* CRI comparison */}
                      <div className="bg-white rounded-lg p-3 border">
                        <div className="text-xs text-gray-500 mb-2">CRI Comparison</div>
                        <div className="flex items-center gap-2">
                          <div className="text-center flex-1">
                            <div className="text-xl font-bold text-gray-700">{s.original_cri?.toFixed(3)}</div>
                            {origCat && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${CRI_CATEGORY_COLORS[origCat] || ""}`}>
                                {origCat}
                              </span>
                            )}
                          </div>
                          <span className="text-gray-400">&rarr;</span>
                          <div className="text-center flex-1">
                            <div className={`text-xl font-bold ${
                              delta < 0 ? "text-green-600" : delta > 0 ? "text-red-600" : "text-gray-700"
                            }`}>
                              {s.simulated_cri?.toFixed(3)}
                            </div>
                            {simCat && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${CRI_CATEGORY_COLORS[simCat] || ""}`}>
                                {simCat}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Modified values */}
                      <div className="bg-white rounded-lg p-3 border">
                        <div className="text-xs text-gray-500 mb-2">
                          Modified Indicators ({Object.keys(s.modified_values || {}).length})
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {Object.entries(s.modified_values || {}).map(([code, val]) => (
                            <div key={code} className="flex justify-between text-xs">
                              <span className="text-gray-600">{code}</span>
                              <span className="font-medium text-blue-600">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="bg-white rounded-lg p-3 border">
                        <div className="text-xs text-gray-500 mb-2">Details</div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Created by</span>
                            <span className="text-gray-700">{s.creator_name || "Unknown"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Date</span>
                            <span className="text-gray-700">
                              {s.created_at ? new Date(s.created_at).toLocaleString() : ""}
                            </span>
                          </div>
                          {s.weights && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Custom weights</span>
                              <span className="text-gray-700">Yes</span>
                            </div>
                          )}
                        </div>
                        {isAdmin && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                            className="mt-3 w-full text-xs text-red-600 border border-red-200 rounded-md py-1 hover:bg-red-50 transition-colors"
                          >
                            Delete Scenario
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page + 1} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
