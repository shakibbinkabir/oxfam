import { useState, useEffect, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import { listSources, createSource, updateSource, deleteSource } from "../../api/sources";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";

export default function SourcesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", url: "" });
  const [submitting, setSubmitting] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      const res = await listSources(params);
      setData(res.data.data.sources);
    } catch {
      toast.error("Failed to load sources");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [search]);

  function openCreate() {
    setEditItem(null);
    setForm({ name: "", description: "", url: "" });
    setShowForm(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setForm({ name: item.name, description: item.description || "", url: item.url || "" });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSubmitting(true);
    try {
      if (editItem) {
        await updateSource(editItem.id, form);
        toast.success("Source updated");
      } else {
        await createSource(form);
        toast.success("Source created");
      }
      setShowForm(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteSource(deleteId);
      toast.success("Source deleted");
      setDeleteId(null);
      fetchData();
    } catch {
      toast.error("Failed to delete source");
    }
  }

  const columns = useMemo(() => [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "description", header: "Description" },
    {
      accessorKey: "url",
      header: "URL",
      cell: ({ getValue }) => {
        const val = getValue();
        return val ? (
          <a href={val} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm truncate block max-w-[200px]">{val}</a>
        ) : null;
      },
    },
    ...(isAdmin ? [{
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(row.original)} className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
          <button onClick={() => setDeleteId(row.original.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
        </div>
      ),
    }] : []),
  ], [isAdmin]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Sources</h1>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="text"
          placeholder="Search sources..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm flex-1 min-w-[200px]"
        />
        {isAdmin && (
          <button onClick={openCreate} className="px-3 py-1.5 bg-[#1B4F72] text-white rounded-md text-sm hover:bg-[#154360]">
            Add Source
          </button>
        )}
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none" onClick={header.column.getToggleSortingHandler()}>
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && " ↑"}
                      {header.column.getIsSorted() === "desc" && " ↓"}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">No sources found</td></tr>
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

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{editItem ? "Edit Source" : "Create Source"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-[#1B4F72] text-white rounded-md text-sm hover:bg-[#154360] disabled:opacity-50">{submitting ? "Saving..." : editItem ? "Update" : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Source?</h3>
            <p className="text-sm text-gray-500 mb-4">This action cannot be undone. Indicators using this source will have their source cleared.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
