import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { searchBoundaries } from "../../api/geo";
import useMapContext from "../../contexts/MapContext";

const LEVEL_LABELS = { 1: "Division", 2: "District", 3: "Upazila", 4: "Union" };
const LEVEL_LABELS_BN = { 1: "\u09AC\u09BF\u09AD\u09BE\u0997", 2: "\u099C\u09C7\u09B2\u09BE", 3: "\u0989\u09AA\u099C\u09C7\u09B2\u09BE", 4: "\u0987\u0989\u09A8\u09BF\u09AF\u09BC\u09A8" };

export default function BoundarySearch() {
  const { t, i18n } = useTranslation();
  const { navigateTo } = useMapContext();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const isBn = i18n.language === "bn";

  const doSearch = useCallback(async (q) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await searchBoundaries(q);
      setResults(res.data.data || []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setActiveIndex(-1);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (item) => {
    if (item.adm_level === 1) {
      navigateTo({ level: 1, parentPcode: null, drillHistory: [] });
    } else {
      navigateTo({
        level: item.adm_level,
        parentPcode: item.parent_pcode,
        drillHistory: item.ancestry,
      });
    }
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i < results.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : results.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  function getBreadcrumb(item) {
    const parts = [];
    if (item.division_name) parts.push(item.division_name);
    if (item.district_name) parts.push(item.district_name);
    if (item.upazila_name) parts.push(item.upazila_name);
    return parts.join(" > ");
  }

  const levelLabels = isBn ? LEVEL_LABELS_BN : LEVEL_LABELS;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center bg-white/10 rounded-md border border-white/20 focus-within:border-white/40 transition-colors">
        {/* Search icon */}
        <svg className="w-4 h-4 text-white/50 ml-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={t("search.placeholder")}
          className="bg-transparent text-white text-sm placeholder-white/40 px-2 py-1.5 outline-none w-[160px]"
          aria-label={t("search.placeholder")}
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
        />
        {query && (
          <button onClick={handleClear} className="p-1 mr-1 hover:bg-white/10 rounded" aria-label={t("common.close")}>
            <svg className="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {loading && (
          <div className="mr-2 shrink-0">
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full right-0 mt-1 w-80 bg-white rounded-lg shadow-xl border border-gray-200 max-h-80 overflow-y-auto z-[9999]" role="listbox">
          {results.length === 0 && !loading && query.length >= 2 && (
            <div className="px-4 py-3 text-sm text-gray-500">{t("search.noResults")}</div>
          )}
          {results.map((item, idx) => (
            <button
              key={item.pcode}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors border-b border-gray-50 last:border-0 ${
                idx === activeIndex ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
              role="option"
              aria-selected={idx === activeIndex}
            >
              <span className={`shrink-0 mt-0.5 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                item.adm_level === 1 ? "bg-purple-100 text-purple-700" :
                item.adm_level === 2 ? "bg-blue-100 text-blue-700" :
                item.adm_level === 3 ? "bg-teal-100 text-teal-700" :
                "bg-amber-100 text-amber-700"
              }`}>
                {levelLabels[item.adm_level]}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {isBn && item.name_bn ? item.name_bn : item.name_en}
                  {isBn && item.name_bn && item.name_en && (
                    <span className="text-gray-400 font-normal ml-1.5">({item.name_en})</span>
                  )}
                </div>
                {getBreadcrumb(item) && (
                  <div className="text-xs text-gray-400 truncate">{getBreadcrumb(item)}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
