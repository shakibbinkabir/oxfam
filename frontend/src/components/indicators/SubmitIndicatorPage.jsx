import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { listIndicators, submitIndicatorValue } from "../../api/indicators";
import { listSources } from "../../api/sources";
import { getUnions, getUpazilas, getDistricts, getDivisions } from "../../api/geo";
import toast from "react-hot-toast";

const COMPONENTS = ["Hazard", "Socioeconomic", "Environmental", "Infrastructural"];
const SUBCATEGORIES_BY_COMPONENT = {
  Hazard: ["Hazard"],
  Socioeconomic: ["Exposure", "Sensitivity", "Adaptive Capacity"],
  Environmental: ["Exposure", "Sensitivity", "Adaptive Capacity"],
  Infrastructural: ["Exposure", "Sensitivity", "Adaptive Capacity"],
};

export default function SubmitIndicatorPage() {
  const { t } = useTranslation();
  // Cascading selectors
  const [component, setComponent] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [indicatorId, setIndicatorId] = useState("");
  const [value, setValue] = useState("");
  const [sourceId, setSourceId] = useState("");

  // Boundary selectors
  const [divisionPcode, setDivisionPcode] = useState("");
  const [districtPcode, setDistrictPcode] = useState("");
  const [upazilaPcode, setUpazilaPcode] = useState("");
  const [unionPcode, setUnionPcode] = useState("");

  // Data
  const [indicators, setIndicators] = useState([]);
  const [sources, setSources] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [upazilas, setUpazilas] = useState([]);
  const [unions, setUnions] = useState([]);

  const [submitting, setSubmitting] = useState(false);

  // Load sources and divisions on mount
  useEffect(() => {
    listSources({ limit: 500 }).then((res) => setSources(res.data.data.sources)).catch(() => {});
    getDivisions().then((res) => setDivisions(res.data.data)).catch(() => {});
  }, []);

  // Load indicators when component or subcategory changes
  useEffect(() => {
    if (!component) { setIndicators([]); return; }
    const params = { component, limit: 200 };
    if (subcategory) params.subcategory = subcategory;
    listIndicators(params).then((res) => setIndicators(res.data.data.indicators)).catch(() => {});
    setIndicatorId("");
  }, [component, subcategory]);

  // Cascading boundary selectors
  useEffect(() => {
    if (!divisionPcode) { setDistricts([]); setDistrictPcode(""); return; }
    getDistricts(divisionPcode).then((res) => setDistricts(res.data.data)).catch(() => {});
    setDistrictPcode("");
    setUpazilaPcode("");
    setUnionPcode("");
  }, [divisionPcode]);

  useEffect(() => {
    if (!districtPcode) { setUpazilas([]); setUpazilaPcode(""); return; }
    getUpazilas(districtPcode).then((res) => setUpazilas(res.data.data)).catch(() => {});
    setUpazilaPcode("");
    setUnionPcode("");
  }, [districtPcode]);

  useEffect(() => {
    if (!upazilaPcode) { setUnions([]); setUnionPcode(""); return; }
    getUnions(upazilaPcode).then((res) => setUnions(res.data.data)).catch(() => {});
    setUnionPcode("");
  }, [upazilaPcode]);

  const subcategories = useMemo(
    () => SUBCATEGORIES_BY_COMPONENT[component] || [],
    [component]
  );

  async function handleSubmit(e) {
    e.preventDefault();

    if (!indicatorId || !unionPcode || !value) {
      toast.error(t('submitIndicator.requiredFields'));
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      toast.error(t('submitIndicator.invalidNumber'));
      return;
    }

    setSubmitting(true);
    try {
      await submitIndicatorValue({
        indicator_id: Number(indicatorId),
        boundary_pcode: unionPcode,
        value: numValue,
        source_id: sourceId ? Number(sourceId) : null,
      });
      toast.success(t('submitIndicator.submitSuccess'));
      // Reset form
      setValue("");
    } catch (err) {
      toast.error(err.response?.data?.detail || t('submitIndicator.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  const selectClass = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('submitIndicator.title')}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {t('submitIndicator.subtitle')}
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Select Indicator */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">{t('submitIndicator.selectIndicator')}</h2>

          <div>
            <label className={labelClass}>Component *</label>
            <select value={component} onChange={(e) => { setComponent(e.target.value); setSubcategory(""); }} required className={selectClass}>
              <option value="">{t('submitIndicator.selectComponent')}</option>
              {COMPONENTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {subcategories.length > 0 && (
            <div>
              <label className={labelClass}>Subcategory</label>
              <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className={selectClass}>
                <option value="">{t('submitIndicator.selectSubcategory')}</option>
                {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>Indicator *</label>
            <select value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)} required disabled={!component} className={selectClass + " disabled:bg-gray-100"}>
              <option value="">{t('submitIndicator.selectIndicatorOption')}</option>
              {indicators.map((ind) => (
                <option key={ind.id} value={ind.id}>
                  {ind.indicator_name} ({ind.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Step 2: Select Boundary */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">{t('submitIndicator.selectBoundary')}</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('detail.division')}</label>
              <select value={divisionPcode} onChange={(e) => setDivisionPcode(e.target.value)} className={selectClass}>
                <option value="">{t('wizard.selectDivision')}</option>
                {divisions.map((d) => <option key={d.pcode} value={d.pcode}>{d.name_en}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('detail.district')}</label>
              <select value={districtPcode} onChange={(e) => setDistrictPcode(e.target.value)} disabled={!divisionPcode} className={selectClass + " disabled:bg-gray-100"}>
                <option value="">{t('wizard.selectDistrict')}</option>
                {districts.map((d) => <option key={d.pcode} value={d.pcode}>{d.name_en}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('detail.upazila')}</label>
              <select value={upazilaPcode} onChange={(e) => setUpazilaPcode(e.target.value)} disabled={!districtPcode} className={selectClass + " disabled:bg-gray-100"}>
                <option value="">{t('wizard.selectUpazila')}</option>
                {upazilas.map((u) => <option key={u.pcode} value={u.pcode}>{u.name_en}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('detail.union')} *</label>
              <select value={unionPcode} onChange={(e) => setUnionPcode(e.target.value)} required disabled={!upazilaPcode} className={selectClass + " disabled:bg-gray-100"}>
                <option value="">{t('wizard.selectUnion')}</option>
                {unions.map((u) => <option key={u.pcode} value={u.pcode}>{u.name_en}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Step 3: Enter Value */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">{t('submitIndicator.enterValueSection')}</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Value *</label>
              <input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                placeholder={t('submitIndicator.enterValue')}
                className={selectClass}
              />
            </div>
            <div>
              <label className={labelClass}>Source</label>
              <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={selectClass}>
                <option value="">{t('submitIndicator.selectSource')}</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 px-4 bg-[#1B4F72] text-white rounded-md font-medium hover:bg-[#154360] disabled:opacity-50 transition-colors"
        >
          {submitting ? t('submitIndicator.submitting') : t('submitIndicator.submitBtn')}
        </button>
      </form>
    </div>
  );
}
