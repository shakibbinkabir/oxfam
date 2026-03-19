import { useState, useEffect, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import { listIndicatorValues, deleteIndicatorValue, restoreIndicatorValue } from "../../api/indicators";
import { exportCsv } from "../../api/exports";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";

const COMPONENT_COLORS = {
  Hazard: "bg-red-100 text-red-700",
  Socioeconomic: "bg-blue-100 text-blue-700",
  Environmental: "bg-green-100 text-green-700",
  Infrastructural: "bg-orange-100 text-orange-700",
};

const COMPONENTS = ["Hazard", "Socioeconomic", "Environmental", "Infrastructural"];

export default function IndicatorValuesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [sorting, setSorting] = useState([]);
  const [componentFilter, setComponentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const pageSize = 20;

  async function handleExportCsv() {
    try {
      const res = await exportCsv({ level: 4 });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "crvap_export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export CSV");
    }
  }

  async function handleRestore(id) {
    try {
      await restoreIndicatorValue(id);
      toast.success("Value restored");
      fetchData();
    } catch {
      toast.error("Failed to restore value");
    }
  }

  async function fetchData() {
    setLoading(true);
    try {
      const params = { skip: page * pageSize, limit: pageSize };
      if (componentFilter) params.component = componentFilter;
      if (search) params.search = search;
      if (includeDeleted) params.include_deleted = true;
      const res = await listIndicatorValues(params);
      setData(res.data.data.values);
      setTotal(res.data.data.total);
    } catch {
      toast.error("Failed to load indicator values");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [page, componentFilter, search, includeDeleted]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteIndicatorValue(deleteId);
      toast.success("Value deleted");
      setDeleteId(null);
      fetchData();
    } catch {
      toast.error("Failed to delete value");
    }
  }

  const columns = useMemo(
    () => [
      {
        accessorKey: "component",
        header: "Component",
        cell: ({ getValue }) => {
          const val = getValue();
          return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COMPONENT_COLORS[val] || "bg-gray-100 text-gray-700"}`}>
              {val}
            </span>
          );
        },
      },
      { accessorKey: "indicator_name", header: "Indicator" },
      { accessorKey: "indicator_code", header: "Code" },
      {
        accessorKey: "boundary_name",
        header: "Boundary",
        cell: ({ row }) => {
          const r = row.original;
          const parts = [r.boundary_name || r.boundary_pcode];
          if (r.upazila_name) parts.push(r.upazila_name);
          if (r.district_name) parts.push(r.district_name);
          return (
            <div>
              <div className="font-medium">{parts[0]}</div>
              {parts.length > 1 && (
                <div className="text-xs text-gray-400">{parts.slice(1).join(", ")}</div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "value",
        header: "Value",
        cell: ({ getValue }) => (
          <span className="font-mono">{getValue()}</span>
        ),
      },
      { accessorKey: "source_name", header: "Source" },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
      },
      ...(isAdmin
        ? [
            {
              id: "actions",
              header: "Actions",
              cell: ({ row }) => {
                if (row.original.is_deleted) {
                  return (
                    <button
                      onClick={() => handleRestore(row.original.id)}
                      className="text-purple-600 hover:text-purple-800 text-sm"
                    >
                      Restore
                    </button>
                  );
                }
                return (
                  <button
                    onClick={() => setDeleteId(row.original.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                );
              },
            },
          ]
        : []),
    ],
    [isAdmin]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / pageSize),
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Indicator Values</h1>
        <button
          onClick={handleExportCsv}
          className="px-4 py-2 border border-[#1B4F72] text-[#1B4F72] rounded-md text-sm font-medium hover:bg-[#1B4F72] hover:text-white transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select
          value={componentFilter}
          onChange={(e) => { setComponentFilter(e.target.value); setPage(0); }}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All Components</option>
          {COMPONENTS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search indicator name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm flex-1 min-w-[200px]"
        />
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => { setIncludeDeleted(e.target.checked); setPage(0); }}
              className="rounded border-gray-300"
            />
            Show deleted
          </label>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && " \u2191"}
                      {header.column.getIsSorted() === "desc" && " \u2193"}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  No indicator values found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className={`hover:bg-gray-50 ${row.original.is_deleted ? "opacity-50" : ""}`}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={`px-4 py-3 text-gray-700 ${row.original.is_deleted ? "line-through" : ""}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 border rounded-md disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 border rounded-md disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Value</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to delete this indicator value? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
