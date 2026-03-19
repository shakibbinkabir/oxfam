import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { runSimulation } from "../../api/simulation";
import { createScenario } from "../../api/simulation";
import { getIndicatorValuesByBoundary } from "../../api/indicators";
import { listIndicatorReferences } from "../../api/scores";
import useMapContext from "../../contexts/MapContext";
import { useAuth } from "../../contexts/AuthContext";

const DIMENSION_GROUPS = [
  {
    key: "hazard",
    label: "Hazard",
    labelKey: "dimensions.hazard",
    color: "border-red-300 bg-red-50",
    codes: ["rainfall", "heat", "colddays", "drought", "water", "erosion", "surge", "salinity", "lightning"],
  },
  {
    key: "soc_exposure",
    label: "Socioeconomic Exposure",
    labelKey: "sim.socExposure",
    color: "border-amber-300 bg-amber-50",
    codes: ["population", "household", "female", "child_old"],
  },
  {
    key: "sensitivity",
    label: "Sensitivity",
    labelKey: "dimensions.sensitivity",
    color: "border-orange-300 bg-orange-50",
    codes: [
      "pop_density", "dependency", "disable", "unemployed", "fm_ratio",
      "vulnerable_hh", "hh_size", "slum_float", "poverty", "crop_damage",
      "occupation", "edu_hamper", "migration",
    ],
  },
  {
    key: "adaptive_capacity",
    label: "Adaptive Capacity",
    labelKey: "dimensions.adaptive_capacity",
    color: "border-emerald-300 bg-emerald-50",
    codes: [
      "literacy", "electricity", "solar", "drink_water", "sanitation",
      "handwash", "edu_institute", "shelter_cov", "market_cov", "mfs",
      "internet", "production", "mangrove", "cc_awareness", "disaster_prep",
      "safety_net", "pavedroad",
    ],
  },
  {
    key: "env_exposure",
    label: "Environmental Exposure",
    labelKey: "sim.envExposure",
    color: "border-teal-300 bg-teal-50",
    codes: ["forest", "waterbody", "agri_land"],
  },
  {
    key: "env_sensitivity",
    label: "Environmental Sensitivity",
    labelKey: "sim.envSensitivity",
    color: "border-cyan-300 bg-cyan-50",
    codes: ["ndvi", "wetland_loss", "groundwater"],
  },
];

const CRI_CATEGORY_COLORS = {
  "Very Low": "text-green-700 bg-green-100",
  Low: "text-lime-700 bg-lime-100",
  Medium: "text-yellow-700 bg-yellow-100",
  High: "text-orange-700 bg-orange-100",
  "Very High": "text-red-700 bg-red-100",
};

export default function SimulationModal() {
  const { t } = useTranslation();
  const { simulationModalOpen, simulationPcode, closeSimulation, setSimulationResult, selectedFeature } = useMapContext();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [indicators, setIndicators] = useState([]);
  const [references, setReferences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Editable values keyed by gis_attribute_id
  const [editedValues, setEditedValues] = useState({});

  // Weight sliders
  const [showWeights, setShowWeights] = useState(false);
  const [weights, setWeights] = useState({
    hazard: 0.25, exposure: 0.25, sensitivity: 0.25, adaptive_capacity: 0.25,
  });

  // Save scenario
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioDesc, setScenarioDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Collapsed dimension groups
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const pcode = simulationPcode;
  const boundaryName = selectedFeature?.name_en || pcode;

  // Build indicator lookup by code
  const indicatorMap = useMemo(() => {
    const map = {};
    for (const iv of indicators) {
      if (iv.indicator_code) map[iv.indicator_code] = iv;
    }
    return map;
  }, [indicators]);

  // Reference lookup by gis_attribute_id
  const refMap = useMemo(() => {
    const map = {};
    for (const ref of references) {
      if (ref.gis_attribute_id) map[ref.gis_attribute_id] = ref;
    }
    return map;
  }, [references]);

  // Stored values keyed by code
  const storedValues = useMemo(() => {
    const map = {};
    for (const iv of indicators) {
      if (iv.indicator_code && iv.value != null) {
        map[iv.indicator_code] = iv.value;
      }
    }
    return map;
  }, [indicators]);

  // Load data when modal opens
  useEffect(() => {
    if (simulationModalOpen && pcode) {
      loadData();
    }
    if (!simulationModalOpen) {
      setResult(null);
      setError(null);
      setEditedValues({});
      setShowSaveForm(false);
    }
  }, [simulationModalOpen, pcode]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [ivRes, refRes] = await Promise.all([
        getIndicatorValuesByBoundary(pcode),
        listIndicatorReferences(),
      ]);
      setIndicators(ivRes.data.data || []);
      setReferences(refRes.data.data || []);
      // Initialize edited values from stored
      const initial = {};
      for (const iv of ivRes.data.data || []) {
        if (iv.indicator_code && iv.value != null) {
          initial[iv.indicator_code] = iv.value;
        }
      }
      setEditedValues(initial);
    } catch {
      setError(t('sim.failedLoad'));
    } finally {
      setLoading(false);
    }
  }

  function handleValueChange(code, value) {
    setEditedValues((prev) => ({ ...prev, [code]: value }));
  }

  function handleWeightChange(key, value) {
    const newVal = Math.max(0, Math.min(1, value));
    const others = Object.keys(weights).filter((k) => k !== key);
    const remaining = 1.0 - newVal;
    const otherSum = others.reduce((s, k) => s + weights[k], 0);

    const newWeights = { ...weights, [key]: newVal };
    if (otherSum > 0) {
      for (const k of others) {
        newWeights[k] = Math.max(0, (weights[k] / otherSum) * remaining);
      }
    } else {
      const each = remaining / others.length;
      for (const k of others) newWeights[k] = each;
    }
    setWeights(newWeights);
  }

  function resetWeights() {
    setWeights({ hazard: 0.25, exposure: 0.25, sensitivity: 0.25, adaptive_capacity: 0.25 });
  }

  // Which codes have been modified
  const modifiedCodes = useMemo(() => {
    const mods = {};
    for (const [code, val] of Object.entries(editedValues)) {
      const stored = storedValues[code];
      if (stored != null && val !== stored && val !== "" && !isNaN(val)) {
        mods[code] = parseFloat(val);
      }
    }
    return mods;
  }, [editedValues, storedValues]);

  const hasChanges = Object.keys(modifiedCodes).length > 0;

  async function handleRunSimulation() {
    if (!hasChanges) return;
    setRunning(true);
    setError(null);
    try {
      const payload = {
        boundary_pcode: pcode,
        modified_values: modifiedCodes,
      };
      if (showWeights) {
        payload.weights = weights;
      }
      const res = await runSimulation(payload);
      const simResult = res.data.data;
      setResult(simResult);
      setSimulationResult(simResult);
    } catch (err) {
      setError(err.response?.data?.detail || t('sim.failedSim'));
    } finally {
      setRunning(false);
    }
  }

  function handleResetAll() {
    const initial = {};
    for (const [code, val] of Object.entries(storedValues)) {
      initial[code] = val;
    }
    setEditedValues(initial);
    setResult(null);
    setSimulationResult(null);
    setError(null);
  }

  async function handleSaveScenario() {
    if (!scenarioName.trim()) return;
    setSaving(true);
    try {
      await createScenario({
        name: scenarioName,
        description: scenarioDesc || null,
        boundary_pcode: pcode,
        modified_values: modifiedCodes,
        weights: showWeights ? weights : null,
        original_cri: result?.original_scores?.cri,
        simulated_cri: result?.simulated_scores?.cri,
      });
      setShowSaveForm(false);
      setScenarioName("");
      setScenarioDesc("");
    } catch {
      setError(t('sim.failedSave'));
    } finally {
      setSaving(false);
    }
  }

  function toggleGroup(key) {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (!simulationModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={closeSimulation} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[95vw] max-w-[900px] md:w-[90vw] max-h-[90vh] flex flex-col" role="dialog" aria-modal="true" aria-label={`${t('sim.title')} - ${boundaryName}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-[#1B4F72] text-white rounded-t-xl">
          <div>
            <h2 className="text-lg font-semibold">{t('sim.title')}</h2>
            <p className="text-sm text-blue-200">{boundaryName} ({pcode})</p>
          </div>
          <button
            onClick={closeSimulation}
            className="p-1.5 hover:bg-[#154360] rounded-md transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-gray-400">{t('sim.loadingData')}</div>
            </div>
          ) : error && !result ? (
            <div className="text-red-600 text-sm bg-red-50 rounded-lg p-4">{error}</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column — Inputs */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t('sim.indicatorValues')}</h3>

                {DIMENSION_GROUPS.map((group) => {
                  const available = group.codes.filter((c) => c in storedValues);
                  if (available.length === 0) return null;
                  const isCollapsed = collapsedGroups[group.key];

                  return (
                    <div key={group.key} className={`border rounded-lg overflow-hidden ${group.color}`}>
                      <button
                        onClick={() => toggleGroup(group.key)}
                        className="w-full flex items-center justify-between px-3 py-2"
                      >
                        <span className="text-xs font-semibold uppercase">{t(group.labelKey)} ({available.length})</span>
                        <svg
                          className={`w-4 h-4 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {!isCollapsed && (
                        <div className="bg-white divide-y">
                          {available.map((code) => {
                            const iv = indicatorMap[code];
                            const ref = refMap[code];
                            const stored = storedValues[code];
                            const edited = editedValues[code];
                            const isModified = edited != null && parseFloat(edited) !== stored;
                            return (
                              <div key={code} className="px-3 py-2">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-medium text-gray-700">
                                      {iv?.indicator_name || code}
                                    </span>
                                    {ref && (
                                      <span className="text-xs text-gray-400 ml-1">
                                        ({ref.direction === "-" ? "inv" : "+"})
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-400 ml-2">
                                    {t('sim.stored')}: {stored}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    step="any"
                                    value={edited ?? ""}
                                    onChange={(e) => handleValueChange(code, e.target.value === "" ? "" : parseFloat(e.target.value))}
                                    className={`w-full px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                                      isModified ? "border-blue-400 bg-blue-50" : "border-gray-200"
                                    }`}
                                  />
                                  {isModified && (
                                    <span className="text-xs font-medium text-blue-600 whitespace-nowrap">
                                      {((parseFloat(edited) - stored) >= 0 ? "+" : "")}{(parseFloat(edited) - stored).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Weight Sliders */}
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowWeights(!showWeights)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50"
                  >
                    <span className="text-xs font-semibold text-gray-600 uppercase">{t('sim.customWeights')}</span>
                    <svg
                      className={`w-4 h-4 transition-transform ${showWeights ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showWeights && (
                    <div className="p-3 bg-white space-y-3">
                      {Object.entries(weights).map(([key, val]) => (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-600 capitalize">
                              {t('dimensions.' + key)}
                            </span>
                            <span className="text-xs font-bold text-gray-700">{val.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={val}
                            onChange={(e) => handleWeightChange(key, parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1B4F72]"
                          />
                        </div>
                      ))}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          {t('sim.sum')}: {Object.values(weights).reduce((s, v) => s + v, 0).toFixed(2)}
                        </span>
                        <button
                          onClick={resetWeights}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {t('sim.resetEqual')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column — Results */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t('sim.results')}</h3>

                {!result ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-gray-50 rounded-lg">
                    <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <p className="text-sm">{t('sim.modifyAndRun')}</p>
                  </div>
                ) : (
                  <>
                    {/* CRI Comparison */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-center flex-1">
                          <div className="text-xs text-gray-500 mb-1">{t('sim.originalCri')}</div>
                          <div className="text-3xl font-bold text-gray-700">
                            {result.original_scores.cri?.toFixed(3) ?? "N/A"}
                          </div>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            CRI_CATEGORY_COLORS[result.original_category] || ""
                          }`}>
                            {result.original_category}
                          </span>
                        </div>
                        <div className="px-4">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-xs text-gray-500 mb-1">{t('sim.simulatedCri')}</div>
                          <div className={`text-3xl font-bold ${
                            result.deltas.cri < 0 ? "text-green-600" : result.deltas.cri > 0 ? "text-red-600" : "text-gray-700"
                          }`}>
                            {result.simulated_scores.cri?.toFixed(3) ?? "N/A"}
                          </div>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            CRI_CATEGORY_COLORS[result.simulated_category] || ""
                          }`}>
                            {result.simulated_category}
                          </span>
                        </div>
                      </div>
                      {result.deltas.cri != null && (
                        <div className={`text-center text-sm font-medium ${
                          result.deltas.cri < 0 ? "text-green-600" : result.deltas.cri > 0 ? "text-red-600" : "text-gray-500"
                        }`}>
                          {t('sim.delta')}: {result.deltas.cri >= 0 ? "+" : ""}{result.deltas.cri.toFixed(4)}
                          {result.original_scores.cri > 0 && (
                            <span className="text-gray-400 ml-1">
                              ({((result.deltas.cri / result.original_scores.cri) * 100).toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Category Change Alert */}
                    {result.category_changed && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                        {t('sim.categoryChanged')}: <strong>{result.original_category}</strong> &rarr; <strong>{result.simulated_category}</strong>
                      </div>
                    )}

                    {/* Dimension Comparison Bars */}
                    <div className="space-y-3">
                      {["hazard", "exposure", "sensitivity", "adaptive_capacity", "vulnerability"].map((dim) => {
                        const orig = result.original_scores[dim];
                        const sim = result.simulated_scores[dim];
                        const delta = result.deltas[dim];
                        if (orig == null && sim == null) return null;
                        return (
                          <div key={dim}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium text-gray-700 capitalize">{t('dimensions.' + dim)}</span>
                              <span className="text-gray-500">
                                {orig?.toFixed(3)} &rarr; {sim?.toFixed(3)}
                                {delta != null && (
                                  <span className={delta < 0 ? "text-green-600 ml-1" : delta > 0 ? "text-red-600 ml-1" : "text-gray-400 ml-1"}>
                                    ({delta >= 0 ? "+" : ""}{delta.toFixed(3)})
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="absolute h-full bg-gray-300 rounded-full"
                                style={{ width: `${(orig ?? 0) * 100}%` }}
                              />
                              <div
                                className="absolute h-full rounded-full opacity-70"
                                style={{
                                  width: `${(sim ?? 0) * 100}%`,
                                  background: "repeating-linear-gradient(45deg, #1B4F72, #1B4F72 2px, #2C6E94 2px, #2C6E94 4px)",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Modified Indicators Table */}
                    {result.modified_indicators?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('sim.modifiedIndicators')}</h4>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium text-gray-600">{t('sim.indicator')}</th>
                                <th className="px-3 py-2 text-right font-medium text-gray-600">{t('sim.original')}</th>
                                <th className="px-3 py-2 text-right font-medium text-gray-600">{t('sim.simulated_col')}</th>
                                <th className="px-3 py-2 text-right font-medium text-gray-600">{t('sim.normOrig')}</th>
                                <th className="px-3 py-2 text-right font-medium text-gray-600">{t('sim.normSim')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {result.modified_indicators.map((mi) => (
                                <tr key={mi.code}>
                                  <td className="px-3 py-1.5 text-gray-700">{mi.name}</td>
                                  <td className="px-3 py-1.5 text-right text-gray-500">{mi.original_value}</td>
                                  <td className="px-3 py-1.5 text-right font-medium text-blue-600">{mi.simulated_value}</td>
                                  <td className="px-3 py-1.5 text-right text-gray-400">{mi.original_normalised?.toFixed(3)}</td>
                                  <td className="px-3 py-1.5 text-right text-blue-500">{mi.simulated_normalised?.toFixed(3)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Save as Scenario (Admin) */}
                    {isAdmin && result && (
                      <div>
                        {!showSaveForm ? (
                          <button
                            onClick={() => setShowSaveForm(true)}
                            className="w-full py-2 text-sm font-medium rounded-md bg-[#1B4F72] text-white hover:bg-[#154360] transition-colors"
                          >
                            {t('sim.saveAsScenario')}
                          </button>
                        ) : (
                          <div className="border rounded-lg p-3 space-y-2">
                            <input
                              type="text"
                              placeholder={t('sim.scenarioName')}
                              value={scenarioName}
                              onChange={(e) => setScenarioName(e.target.value)}
                              className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                            <textarea
                              placeholder={t('sim.description')}
                              value={scenarioDesc}
                              onChange={(e) => setScenarioDesc(e.target.value)}
                              className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveScenario}
                                disabled={!scenarioName.trim() || saving}
                                className="flex-1 py-1.5 text-sm font-medium rounded-md bg-[#1B4F72] text-white hover:bg-[#154360] disabled:opacity-50 transition-colors"
                              >
                                {saving ? t('sim.saving') : t('sim.save')}
                              </button>
                              <button
                                onClick={() => setShowSaveForm(false)}
                                className="px-3 py-1.5 text-sm border rounded-md text-gray-600 hover:bg-gray-50"
                              >
                                {t('sim.cancel')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {error && result && (
                  <div className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{error}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={handleResetAll}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
          >
            {t('sim.resetAll')}
          </button>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-blue-600">
                {Object.keys(modifiedCodes).length} indicator{Object.keys(modifiedCodes).length > 1 ? "s" : ""} {t('sim.modified')}
              </span>
            )}
            <button
              onClick={handleRunSimulation}
              disabled={!hasChanges || running}
              className="px-6 py-2 text-sm font-medium rounded-md bg-[#1B4F72] text-white hover:bg-[#154360] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {running ? t('sim.running') : t('sim.runSimulation')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
