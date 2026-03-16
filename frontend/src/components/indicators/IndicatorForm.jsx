import { useState, useEffect } from "react";
import { createIndicator, updateIndicator } from "../../api/indicators";
import toast from "react-hot-toast";

const COMPONENTS = ["Hazard", "Socioeconomic", "Environmental", "Infrastructural"];
const SUBCATEGORIES_BY_COMPONENT = {
  Hazard: ["Hazard"],
  Socioeconomic: ["Exposure", "Sensitivity", "Adaptive Capacity"],
  Environmental: ["Exposure", "Sensitivity", "Adaptive Capacity"],
  Infrastructural: ["Exposure", "Sensitivity", "Adaptive Capacity"],
};

export default function IndicatorForm({ indicator, onClose, onSaved }) {
  const isEdit = !!indicator;
  const [form, setForm] = useState({
    component: "",
    subcategory: "",
    indicator_name: "",
    code: "",
    unit: "",
    source: "",
    gis_attribute_id: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (indicator) {
      setForm({
        component: indicator.component || "",
        subcategory: indicator.subcategory || "",
        indicator_name: indicator.indicator_name || "",
        code: indicator.code || "",
        unit: indicator.unit || "",
        source: indicator.source || "",
        gis_attribute_id: indicator.gis_attribute_id || "",
      });
    }
  }, [indicator]);

  function handleChange(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "component") {
        next.subcategory = "";
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.component || !form.indicator_name || !form.code) {
      toast.error("Component, name, and code are required");
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        const { code, ...updateData } = form;
        await updateIndicator(indicator.id, updateData);
        toast.success("Indicator updated");
      } else {
        await createIndicator(form);
        toast.success("Indicator created");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }

  const subcategories = SUBCATEGORIES_BY_COMPONENT[form.component] || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            {isEdit ? "Edit Indicator" : "Create Indicator"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Component *</label>
            <select
              value={form.component}
              onChange={(e) => handleChange("component", e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
            >
              <option value="">Select component</option>
              {COMPONENTS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
            <select
              value={form.subcategory}
              onChange={(e) => handleChange("subcategory", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
            >
              <option value="">None</option>
              {subcategories.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Indicator Name *</label>
            <input
              type="text"
              value={form.indicator_name}
              onChange={(e) => handleChange("indicator_name", e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => handleChange("code", e.target.value)}
              required
              disabled={isEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72] disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => handleChange("unit", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <input
                type="text"
                value={form.source}
                onChange={(e) => handleChange("source", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GIS Attribute ID</label>
            <input
              type="text"
              value={form.gis_attribute_id}
              onChange={(e) => handleChange("gis_attribute_id", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#1B4F72] text-white rounded-md text-sm hover:bg-[#154360] disabled:opacity-50"
            >
              {submitting ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
