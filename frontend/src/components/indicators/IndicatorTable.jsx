import { useState, useEffect, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import { listIndicators, deleteIndicator, exportIndicators } from "../../api/indicators";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";

const COMPONENT_COLORS = {
  Hazard: "bg-red-100 text-red-700",
  Socioeconomic: "bg-blue-100 text-blue-700",
  Environmental: "bg-green-100 text-green-700",
  Infrastructural: "bg-orange-100 text-orange-700",
};

const COMPONENTS = ["Hazard", "Socioeconomic", "Environmental", "Infrastructural"];
const SUBCATEGORIES = ["Hazard", "Exposure", "Sensitivity", "Adaptive Capacity"];

export default function IndicatorTable({ onEdit, onCreate }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [sorting, setSorting] = useState([]);
  const [componentFilter, setComponentFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const pageSize = 20;

  async function fetchData() {
    setLoading(true);
    try {
      const params = { skip: page * pageSize, limit: pageSize };
      if (componentFilter) params.component = componentFilter;
      if (subcategoryFilter) params.subcategory = subcategoryFilter;
      if (search) params.search = search;
      const res = await listIndicators(params);
      setData(res.data.data.indicators);
      setTotal(res.data.data.total);
    } catch {
      toast.error("Failed to load indicators");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [page, componentFilter, subcategoryFilter, search]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteIndicator(deleteId);
      toast.success("Indicator deleted");
      setDeleteId(null);
      fetchData();
    } catch {
      toast.error("Failed to delete indicator");
    }
  }

  async function handleExport() {
    try {
      const res = await exportIndicators("csv");
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "climate_indicators.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
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
      { accessorKey: "subcategory", header: "Subcategory" },
      { accessorKey: "indicator_name", header: "Name" },
      { accessorKey: "code", header: "Code" },
      { accessorKey: "unit_name", header: "Unit" },
      { accessorKey: "source_name", header: "Source" },
      ...(isAdmin
        ? [
            {
              id: "actions",
              header: "Actions",
              cell: ({ row }) => (
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(row.original)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteId(row.original.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [isAdmin, onEdit]
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
    <div>
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
        <select
          value={subcategoryFilter}
          onChange={(e) => { setSubcategoryFilter(e.target.value); setPage(0); }}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All Subcategories</option>
          {SUBCATEGORIES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search indicator name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm flex-1 min-w-[200px]"
        />
        <div className="flex gap-2 ml-auto">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Export CSV
          </button>
          {isAdmin && (
            <button
              onClick={onCreate}
              className="px-3 py-1.5 bg-[#1B4F72] text-white rounded-md text-sm hover:bg-[#154360]"
            >
              Add Indicator
            </button>
          )}
        </div>
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
                  No indicators found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-gray-700">
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

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Indicator</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to delete this indicator? This action cannot be undone.</p>
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
