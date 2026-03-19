import { useState, useEffect } from "react";
import { getDivisions, getDistricts, getUpazilas, getUnions } from "../../api/geo";
import { getIndicatorValuesByBoundary } from "../../api/indicators";
import { listIndicatorReferences } from "../../api/scores";
import { createRiskIndex, updateRiskIndex } from "../../api/riskIndex";
import { runSimulation } from "../../api/simulation";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

const HAZARD_FIELDS = [
  { code: "rainfall", label: "Rainfall Risk Index", unit: "Index", source: "BAMIS/DAE" },
  { code: "heat", label: "Heat Index", unit: "degC", source: "NEX-GDDP" },
  { code: "colddays", label: "Number of Cold Days", unit: "Intensity", source: "BAMIS/DAE" },
  { code: "drought", label: "Drought Intensity", unit: "Category", source: "BARC" },
  { code: "water", label: "Water Occurrence (Flood)", unit: "%", source: "JRC-EC" },
  { code: "erosion", label: "Eroded Area", unit: "%", source: "BARC" },
  { code: "surge", label: "Storm Surge Inundation Depth", unit: "m", source: "MRVAM" },
  { code: "salinity", label: "Salinity Concentration", unit: "ppt", source: "CEGIS" },
  { code: "lightning", label: "Lightning Severity", unit: "No.", source: "BMD" },
];

const SOC_EXPOSURE_FIELDS = [
  { code: "population", label: "Population", unit: "No.", source: "BBS" },
  { code: "household", label: "Number of Households", unit: "No.", source: "BBS" },
  { code: "female", label: "Female Population", unit: "No.", source: "BBS" },
  { code: "child_old", label: "Children & Elderly", unit: "No.", source: "BBS" },
];

const SENSITIVITY_FIELDS = [
  { code: "pop_density", label: "Population Density", unit: "Pop/km2", source: "BBS" },
  { code: "dependency", label: "Dependency Ratio", unit: "%", source: "BBS" },
  { code: "disable", label: "Disabled People", unit: "%", source: "BBS" },
  { code: "unemployed", label: "Unemployed Population", unit: "%", source: "BBS" },
  { code: "fm_ratio", label: "Female to Male Ratio", unit: "Ratio", source: "BBS" },
  { code: "vulnerable_hh", label: "Vulnerable Households", unit: "%", source: "BBS" },
  { code: "hh_size", label: "Household Size", unit: "People/HH", source: "BBS" },
  { code: "slum_float", label: "Slum / Floating Population", unit: "%", source: "BBS" },
  { code: "poverty", label: "Poverty Level", unit: "Class", source: "BBS" },
  { code: "crop_damage", label: "Crop Damage", unit: "M BDT", source: "BDRS" },
  { code: "occupation", label: "Occupation Shifting", unit: "No.", source: "BDRS" },
  { code: "edu_hamper", label: "Education Hamper", unit: "No.", source: "BDRS" },
  { code: "migration", label: "Migration Rate", unit: "No.", source: "BDRS" },
];

const ADAPTIVE_CAPACITY_FIELDS = [
  { code: "literacy", label: "Literacy Rate", unit: "%", source: "BBS" },
  { code: "electricity", label: "Electricity Coverage", unit: "%", source: "BBS" },
  { code: "solar", label: "Solar Panel Coverage", unit: "%", source: "BBS" },
  { code: "drink_water", label: "Safe Drinking Water", unit: "%", source: "BBS" },
  { code: "sanitation", label: "Sanitation Services", unit: "%", source: "BBS" },
  { code: "handwash", label: "Handwashing Facilities", unit: "%", source: "BBS" },
  { code: "edu_institute", label: "Educational Institutes", unit: "No./Pop", source: "LGED/BBS" },
  { code: "shelter_cov", label: "Shelter Coverage", unit: "No./Pop", source: "LGED/BBS" },
  { code: "market_cov", label: "Market Coverage", unit: "No./Pop", source: "LGED/BBS" },
  { code: "mfs", label: "Mobile Financial Services", unit: "%", source: "BBS" },
  { code: "internet", label: "Internet Users", unit: "%", source: "BBS" },
  { code: "production", label: "Agri/Livestock/Fish Production", unit: "BDT", source: "BBS" },
  { code: "mangrove", label: "Mangrove / Green Belt", unit: "km2", source: "DoE" },
  { code: "cc_awareness", label: "CC Awareness", unit: "No.", source: "BDRS" },
  { code: "disaster_prep", label: "Disaster Preparedness", unit: "No.", source: "BDRS" },
  { code: "safety_net", label: "Social Safety Net", unit: "No.", source: "BDRS" },
  { code: "pavedroad", label: "Paved Road Access", unit: "km/km2", source: "RHD/LGED" },
];

const ENV_EXPOSURE_FIELDS = [
  { code: "forest", label: "Forest Coverage", unit: "%", source: "Sentinel-2 2024" },
  { code: "waterbody", label: "Waterbody Coverage", unit: "%", source: "Sentinel-2 2024" },
  { code: "agri_land", label: "Agriculture Land Coverage", unit: "%", source: "Sentinel-2 2024" },
];

const ENV_SENSITIVITY_FIELDS = [
  { code: "ndvi", label: "NDVI", unit: "Index", source: "Sentinel-2" },
  { code: "wetland_loss", label: "Wetland Area Loss", unit: "%", source: "JRC-EC" },
  { code: "groundwater", label: "Groundwater Level", unit: "m", source: "BWDB" },
];

const ALL_FIELDS = [
  ...HAZARD_FIELDS, ...SOC_EXPOSURE_FIELDS, ...SENSITIVITY_FIELDS,
  ...ADAPTIVE_CAPACITY_FIELDS, ...ENV_EXPOSURE_FIELDS, ...ENV_SENSITIVITY_FIELDS,
];

const CRI_CATEGORY_COLORS = {
  "Very Low": "bg-green-100 text-green-800",
  Low: "bg-lime-100 text-lime-800",
  Medium: "bg-yellow-100 text-yellow-800",
  High: "bg-orange-100 text-orange-800",
  "Very High": "bg-red-100 text-red-800",
};

function getCriCategory(cri) {
  if (cri == null) return null;
  if (cri < 0.2) return "Very Low";
  if (cri < 0.4) return "Low";
  if (cri < 0.6) return "Medium";
  if (cri < 0.8) return "High";
  return "Very High";
}

export default function RiskIndexWizard() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const editPcode = searchParams.get("edit");

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [previewScores, setPreviewScores] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [existingData, setExistingData] = useState(false);

  // Step 1 - location
  const [divisions, setDivisions] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [unions, setUnions] = useState([]);
  const [divisionPcode, setDivisionPcode] = useState("");
  const [districtPcode, setDistrictPcode] = useState("");
  const [upazilaPcode, setUpazilaPcode] = useState("");
  const [unionPcode, setUnionPcode] = useState(editPcode || "");
  const [year, setYear] = useState(new Date().getFullYear());

  // Indicator values
  const [values, setValues] = useState(() => {
    const initial = {};
    ALL_FIELDS.forEach((f) => { initial[f.code] = ""; });
    return initial;
  });

  // Reference data for range warnings
  const [references, setReferences] = useState({});

  // Load divisions on mount
  useEffect(() => {
    getDivisions().then((res) => setDivisions(res.data.data || [])).catch(() => {});
    listIndicatorReferences().then((res) => {
      const refs = {};
      (res.data.data || []).forEach((r) => {
        refs[r.gis_attribute_id || r.code] = { global_min: r.global_min, global_max: r.global_max };
      });
      setReferences(refs);
    }).catch(() => {});
  }, []);

  // Cascade location dropdowns
  useEffect(() => {
    if (divisionPcode) {
      getDistricts(divisionPcode).then((res) => setDistricts(res.data.data || [])).catch(() => {});
    } else {
      setDistricts([]);
    }
    setDistrictPcode("");
  }, [divisionPcode]);

  useEffect(() => {
    if (districtPcode) {
      getUpazilas(districtPcode).then((res) => setUpazilas(res.data.data || [])).catch(() => {});
    } else {
      setUpazilas([]);
    }
    setUpazilaPcode("");
  }, [districtPcode]);

  useEffect(() => {
    if (upazilaPcode) {
      getUnions(upazilaPcode).then((res) => setUnions(res.data.data || [])).catch(() => {});
    } else {
      setUnions([]);
    }
    if (!editPcode) setUnionPcode("");
  }, [upazilaPcode]);

  // Load existing data for edit mode
  useEffect(() => {
    if (editPcode) {
      getIndicatorValuesByBoundary(editPcode).then((res) => {
        const data = res.data.data || [];
        if (data.length > 0) {
          setExistingData(true);
          const newValues = { ...values };
          data.forEach((iv) => {
            const code = iv.indicator_code;
            if (code in newValues) {
              newValues[code] = iv.value;
            }
          });
          setValues(newValues);
        }
      }).catch(() => {});
    }
  }, [editPcode]);

  // Check if union already has data
  useEffect(() => {
    if (unionPcode && !editPcode) {
      getIndicatorValuesByBoundary(unionPcode).then((res) => {
        const data = res.data.data || [];
        setExistingData(data.length > 0);
        if (data.length > 0) {
          const newValues = { ...values };
          data.forEach((iv) => {
            const code = iv.indicator_code;
            if (code in newValues) {
              newValues[code] = iv.value;
            }
          });
          setValues(newValues);
        }
      }).catch(() => setExistingData(false));
    }
  }, [unionPcode]);

  function updateValue(code, val) {
    setValues((prev) => ({ ...prev, [code]: val }));
  }

  function isOutOfRange(code, val) {
    const ref = references[code];
    if (!ref || val === "" || val == null) return false;
    const num = parseFloat(val);
    return isNaN(num) ? false : num < ref.global_min || num > ref.global_max;
  }

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      const modifiedValues = {};
      ALL_FIELDS.forEach((f) => {
        if (values[f.code] !== "" && values[f.code] != null) {
          modifiedValues[f.code] = parseFloat(values[f.code]);
        }
      });

      const res = await runSimulation({
        boundary_pcode: unionPcode,
        modified_values: modifiedValues,
      });
      setPreviewScores(res.data.data?.simulated_scores || null);
    } catch {
      // If simulation fails (no existing data), compute locally isn't possible
      setPreviewScores(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const submitValues = {};
      ALL_FIELDS.forEach((f) => {
        if (values[f.code] !== "" && values[f.code] != null) {
          submitValues[f.code] = parseFloat(values[f.code]);
        }
      });

      if (editPcode) {
        await updateRiskIndex(editPcode, { values: submitValues });
      } else {
        await createRiskIndex({
          boundary_pcode: unionPcode,
          year,
          values: submitValues,
        });
      }
      toast.success(t('wizard.saved'));
      setSuccess(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : t('wizard.failedSave'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setStep(1);
    setSuccess(false);
    setPreviewScores(null);
    setExistingData(false);
    const initial = {};
    ALL_FIELDS.forEach((f) => { initial[f.code] = ""; });
    setValues(initial);
    setUnionPcode("");
  }

  if (success) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white border border-green-200 rounded-lg p-8 text-center">
          <svg className="mx-auto w-16 h-16 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <h2 className="text-xl font-bold text-gray-800 mb-2">{t('wizard.successTitle')}</h2>
          <p className="text-gray-500 mb-6">{t('wizard.successMessage')}</p>
          <div className="flex justify-center gap-3">
            <button onClick={handleReset} className="px-4 py-2 bg-[#1B4F72] text-white rounded-md hover:bg-[#154360]">
              {t('wizard.enterAnother')}
            </button>
            <a href="/dashboard" className="px-4 py-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50">
              {t('wizard.viewOnMap')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        {editPcode ? t('wizard.editTitle') : t('wizard.submitTitle')}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {t('wizard.subtitle')} {editPcode ? t('wizard.editingExisting') : t('wizard.validationNote')}
      </p>

      {/* Progress bar */}
      <div className="flex items-center mb-8">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex-1 flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                s === step ? "bg-[#1B4F72] text-white" : s < step ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              {s < step ? "\u2713" : s}
            </div>
            {s < 5 && <div className={`flex-1 h-1 mx-1 ${s < step ? "bg-green-500" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400 mb-4">
        {t('wizard.step')} {step} {t('wizard.of')} 5: {[t('wizard.steps.1'), t('wizard.steps.2'), t('wizard.steps.3'), t('wizard.steps.4'), t('wizard.steps.5')][step - 1]}
      </div>

      {/* Step 1: Location */}
      {step === 1 && (
        <div className="bg-white border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-700">{t('wizard.locationSelection')}</h2>
          {!editPcode && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t('detail.division')}</label>
                  <select value={divisionPcode} onChange={(e) => setDivisionPcode(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm">
                    <option value="">{t('wizard.selectDivision')}</option>
                    {divisions.map((d) => <option key={d.pcode} value={d.pcode}>{d.name_en}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t('detail.district')}</label>
                  <select value={districtPcode} onChange={(e) => setDistrictPcode(e.target.value)} disabled={!divisionPcode} className="w-full px-3 py-2 border rounded-md text-sm disabled:opacity-50">
                    <option value="">{t('wizard.selectDistrict')}</option>
                    {districts.map((d) => <option key={d.pcode} value={d.pcode}>{d.name_en}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t('detail.upazila')}</label>
                  <select value={upazilaPcode} onChange={(e) => setUpazilaPcode(e.target.value)} disabled={!districtPcode} className="w-full px-3 py-2 border rounded-md text-sm disabled:opacity-50">
                    <option value="">{t('wizard.selectUpazila')}</option>
                    {upazilas.map((d) => <option key={d.pcode} value={d.pcode}>{d.name_en}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t('detail.union')}</label>
                  <select value={unionPcode} onChange={(e) => setUnionPcode(e.target.value)} disabled={!upazilaPcode} className="w-full px-3 py-2 border rounded-md text-sm disabled:opacity-50">
                    <option value="">{t('wizard.selectUnion')}</option>
                    {unions.map((d) => <option key={d.pcode} value={d.pcode}>{d.name_en}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t('wizard.year')}</label>
                <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())} className="w-32 px-3 py-2 border rounded-md text-sm" />
              </div>
            </>
          )}
          {editPcode && (
            <p className="text-sm text-gray-600">{t('wizard.editingBoundary')} <span className="font-mono font-medium">{editPcode}</span></p>
          )}
          {existingData && !editPcode && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
              {t('wizard.dataExists')}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Hazard Indicators */}
      {step === 2 && (
        <FieldGroup title={t('wizard.hazardIndicators')} fields={HAZARD_FIELDS} values={values} onUpdate={updateValue} references={references} isOutOfRange={isOutOfRange} t={t} />
      )}

      {/* Step 3: Socioeconomic Data */}
      {step === 3 && (
        <div className="space-y-6">
          <FieldGroup title={t('wizard.socExposure')} fields={SOC_EXPOSURE_FIELDS} values={values} onUpdate={updateValue} references={references} isOutOfRange={isOutOfRange} t={t} />
          <FieldGroup title={t('wizard.sensitivity')} fields={SENSITIVITY_FIELDS} values={values} onUpdate={updateValue} references={references} isOutOfRange={isOutOfRange} t={t} />
        </div>
      )}

      {/* Step 4: Adaptive Capacity & Environmental */}
      {step === 4 && (
        <div className="space-y-6">
          <FieldGroup title={t('wizard.adaptiveCapacity')} fields={ADAPTIVE_CAPACITY_FIELDS} values={values} onUpdate={updateValue} references={references} isOutOfRange={isOutOfRange} t={t} />
          <FieldGroup title={t('wizard.envExposure')} fields={ENV_EXPOSURE_FIELDS} values={values} onUpdate={updateValue} references={references} isOutOfRange={isOutOfRange} t={t} />
          <FieldGroup title={t('wizard.envSensitivity')} fields={ENV_SENSITIVITY_FIELDS} values={values} onUpdate={updateValue} references={references} isOutOfRange={isOutOfRange} t={t} />
        </div>
      )}

      {/* Step 5: Review & Submit */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">{t('wizard.reviewValues')}</h2>
            <ReviewSection title={t('wizard.hazardIndicators')} fields={HAZARD_FIELDS} values={values} />
            <ReviewSection title={t('wizard.socExposure')} fields={SOC_EXPOSURE_FIELDS} values={values} />
            <ReviewSection title={t('wizard.sensitivity')} fields={SENSITIVITY_FIELDS} values={values} />
            <ReviewSection title={t('wizard.adaptiveCapacity')} fields={ADAPTIVE_CAPACITY_FIELDS} values={values} />
            <ReviewSection title={t('wizard.envExposure')} fields={ENV_EXPOSURE_FIELDS} values={values} />
            <ReviewSection title={t('wizard.envSensitivity')} fields={ENV_SENSITIVITY_FIELDS} values={values} />
          </div>

          {/* CVI Preview */}
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700">{t('wizard.cviPreview')}</h2>
              <button onClick={handlePreview} disabled={previewLoading} className="px-4 py-2 bg-[#1B4F72] text-white text-sm rounded-md hover:bg-[#154360] disabled:opacity-50">
                {previewLoading ? t('wizard.computing') : t('wizard.computePreview')}
              </button>
            </div>
            {previewScores && (
              <div className="grid grid-cols-3 gap-4">
                {["hazard", "exposure", "sensitivity", "adaptive_capacity", "vulnerability", "cri"].map((key) => {
                  const val = previewScores[key];
                  const category = key === "cri" ? getCriCategory(val) : null;
                  return (
                    <div key={key} className={`p-3 rounded-lg border text-center ${key === "cri" && category ? CRI_CATEGORY_COLORS[category] : "bg-gray-50"}`}>
                      <div className="text-xs font-medium text-gray-500 uppercase">{key.replace("_", " ")}</div>
                      <div className="text-xl font-bold mt-1">{val != null ? val.toFixed(3) : "N/A"}</div>
                      {category && <div className="text-xs font-semibold mt-1">{category}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="px-6 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          {t('wizard.back')}
        </button>
        {step < 5 ? (
          <button
            onClick={() => setStep((s) => Math.min(5, s + 1))}
            disabled={step === 1 && !unionPcode && !editPcode}
            className="px-6 py-2 bg-[#1B4F72] text-white rounded-md text-sm hover:bg-[#154360] disabled:opacity-40"
          >
            {t('wizard.next')}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? t('wizard.submitting') : t('wizard.confirmSubmit')}
          </button>
        )}
      </div>
    </div>
  );
}


function FieldGroup({ title, fields, values, onUpdate, references, isOutOfRange, t }) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) => {
          const outOfRange = isOutOfRange(f.code, values[f.code]);
          const ref = references[f.code];
          return (
            <div key={f.code}>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {f.label}
                <span className="text-gray-400 ml-1 text-xs">({f.unit})</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  value={values[f.code]}
                  onChange={(e) => onUpdate(f.code, e.target.value)}
                  placeholder={f.code}
                  className={`flex-1 px-3 py-2 border rounded-md text-sm ${outOfRange ? "border-yellow-400 bg-yellow-50" : ""}`}
                />
                {outOfRange && (
                  <span className="text-yellow-500" title={`Expected range: [${ref?.global_min}, ${ref?.global_max}]`}>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{t('wizard.source')}: {f.source}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function ReviewSection({ title, fields, values }) {
  const filledFields = fields.filter((f) => values[f.code] !== "" && values[f.code] != null);
  if (filledFields.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {filledFields.map((f) => (
          <div key={f.code} className="flex justify-between text-sm px-2 py-1 bg-gray-50 rounded">
            <span className="text-gray-600 truncate mr-2">{f.label}</span>
            <span className="font-mono font-medium">{values[f.code]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
