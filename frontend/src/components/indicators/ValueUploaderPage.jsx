import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { bulkUploadIndicatorValues, downloadSampleCsv } from "../../api/indicators";
import toast from "react-hot-toast";

export default function ValueUploaderPage() {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  async function handleDownloadSample() {
    try {
      const res = await downloadSampleCsv();
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "indicator_values_sample.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('uploader.downloadSampleError'));
    }
  }

  function splitCSVRow(line) {
    const cells = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  }

  function parseCSVPreview(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return null;
    const headers = splitCSVRow(lines[0]);
    const rows = lines.slice(1, 11).map((line) => {
      const cells = splitCSVRow(line);
      const row = {};
      headers.forEach((h, i) => {
        row[h] = cells[i] || "";
      });
      return row;
    });
    return { headers, rows, totalRows: lines.length - 1 };
  }

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (selected && !selected.name.endsWith(".csv") && !selected.name.endsWith(".xlsx")) {
      toast.error(t('uploader.invalidFileType'));
      e.target.value = "";
      return;
    }
    setFile(selected || null);
    setResult(null);
    setPreview(null);

    if (selected && selected.name.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const parsed = parseCSVPreview(ev.target.result);
        if (parsed) setPreview(parsed);
      };
      reader.readAsText(selected);
    } else if (selected && selected.name.endsWith(".xlsx")) {
      setPreview({ headers: [], rows: [], totalRows: 0, isXlsx: true });
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      toast.error(t('uploader.noFileSelected'));
      return;
    }

    setUploading(true);
    setResult(null);
    try {
      const res = await bulkUploadIndicatorValues(file);
      const data = res.data.data;
      setResult(data);
      setPreview(null);
      if (data.errors.length === 0) {
        toast.success(t('uploader.uploadSuccess', { created: data.created, updated: data.updated }));
      } else {
        toast.success(t('uploader.uploadWarnings', { count: data.errors.length }));
      }
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : t('uploader.uploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  function handleClearFile() {
    setFile(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('uploader.title')}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {t('uploader.subtitle')}
      </p>

      {/* Instructions */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">{t('uploader.instructions')}</h2>
        <ul className="text-sm text-gray-600 space-y-2">
          <li className="flex gap-2">
            <span className="text-gray-400">1.</span>
            Download the sample CSV file to see the required format.
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400">2.</span>
            Fill in the CSV with your data. Required columns: <code className="bg-gray-100 px-1 rounded text-xs">indicator_code</code>, <code className="bg-gray-100 px-1 rounded text-xs">boundary_pcode</code>, <code className="bg-gray-100 px-1 rounded text-xs">value</code>.
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400">3.</span>
            Optional column: <code className="bg-gray-100 px-1 rounded text-xs">source_name</code> (must match an existing source).
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400">4.</span>
            If a value already exists for the same indicator + boundary, it will be updated.
          </li>
        </ul>
        <button
          onClick={handleDownloadSample}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-[#1B4F72] text-[#1B4F72] rounded-md text-sm font-medium hover:bg-[#1B4F72] hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {t('uploader.downloadSample')}
        </button>
      </div>

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">{t('uploader.uploadFile')}</h2>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <svg className="mx-auto h-10 w-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-[#1B4F72] file:text-white hover:file:bg-[#154360] file:cursor-pointer"
          />
          {file && (
            <div className="mt-2 flex items-center justify-center gap-3">
              <p className="text-sm text-gray-600">
                {t('uploader.selectedFile')}: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
              </p>
              <button
                type="button"
                onClick={handleClearFile}
                className="text-xs text-red-500 hover:text-red-700 underline"
              >
                {t('uploader.clear')}
              </button>
            </div>
          )}
        </div>

        {/* Preview Table */}
        {preview && !preview.isXlsx && preview.rows.length > 0 && (
          <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-600">{t('uploader.previewTitle')}</h3>
              <span className="text-xs text-gray-400">
                {t('uploader.previewShowing', { shown: preview.rows.length, total: preview.totalRows })}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    {preview.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {preview.headers.map((h) => (
                        <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap">{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50 px-4 py-2">
              <p className="text-xs text-gray-500">
                {t('uploader.previewColumns')}: {preview.headers.join(", ")}
              </p>
            </div>
          </div>
        )}

        {preview && preview.isXlsx && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            {t('uploader.xlsxPreviewNote')}
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !file}
          className="mt-4 w-full py-3 px-4 bg-[#1B4F72] text-white rounded-md font-medium hover:bg-[#154360] disabled:opacity-50 transition-colors"
        >
          {uploading ? t('uploader.uploading') : t('uploader.upload')}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div className="mt-6 bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">{t('uploader.resultTitle')}</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{result.created}</div>
              <div className="text-xs text-green-700">{t('uploader.created')}</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{result.updated}</div>
              <div className="text-xs text-blue-700">{t('uploader.updated')}</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{result.errors?.length || 0}</div>
              <div className="text-xs text-red-700">{t('uploader.errors')}</div>
            </div>
          </div>
          {result.warnings?.length > 0 && (
            <div className="bg-yellow-50 rounded-lg p-3 max-h-32 overflow-y-auto mb-3">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">Warnings ({result.warnings.length}):</h3>
              <ul className="text-xs text-yellow-700 space-y-1">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {result.errors?.length > 0 && (
            <div className="bg-red-50 rounded-lg p-3 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-red-800">{t('uploader.errors')}:</h3>
                <button
                  onClick={() => {
                    const header = "row_number,indicator_code,boundary_pcode,value,error_message\n";
                    const rows = result.errors.map((e) =>
                      typeof e === "object"
                        ? `${e.row},${e.indicator_code},${e.boundary_pcode},${e.value},"${(e.error || "").replace(/"/g, '""')}"`
                        : `,,,"${String(e).replace(/"/g, '""')}"`
                    ).join("\n");
                    const blob = new Blob([header + rows], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "upload_errors.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-xs text-red-700 underline hover:text-red-900"
                >
                  {t('uploader.downloadErrorReport')}
                </button>
              </div>
              <ul className="text-xs text-red-700 space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i}>{typeof err === "object" ? `Row ${err.row}: ${err.error}` : err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
