import { useState, useEffect, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import { listUsersApi, createUserApi, updateUserApi, deleteUserApi } from "../../api/users";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";

const ROLES = ["user", "admin", "superadmin"];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const isSuperadmin = currentUser?.role === "superadmin";

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ email: "", full_name: "", password: "", role: "user" });
  const [submitting, setSubmitting] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await listUsersApi(0, 200);
      setData(res.data.data.users);
      setTotal(res.data.data.total);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  function openCreate() {
    setEditItem(null);
    setForm({ email: "", full_name: "", password: "", role: "user" });
    setShowForm(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setForm({ email: item.email, full_name: item.full_name, password: "", role: item.role });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email.trim() || !form.full_name.trim()) {
      toast.error("Email and name are required");
      return;
    }
    if (!editItem && !form.password) {
      toast.error("Password is required for new users");
      return;
    }
    setSubmitting(true);
    try {
      if (editItem) {
        const payload = { email: form.email, full_name: form.full_name, role: form.role };
        await updateUserApi(editItem.id, payload);
        toast.success("User updated");
      } else {
        await createUserApi({ email: form.email, full_name: form.full_name, password: form.password, role: form.role });
        toast.success("User created");
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
    if (!deleteTarget) return;
    try {
      await deleteUserApi(deleteTarget.id);
      toast.success("User deactivated");
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error("Failed to delete user");
    }
  }

  const columns = useMemo(() => [
    { accessorKey: "full_name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ getValue }) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          getValue() === "superadmin" ? "bg-purple-100 text-purple-800" :
          getValue() === "admin" ? "bg-blue-100 text-blue-800" :
          "bg-gray-100 text-gray-700"
        }`}>{getValue()}</span>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ getValue }) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          getValue() ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}>{getValue() ? "Active" : "Inactive"}</span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
    },
    ...(isSuperadmin ? [{
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const u = row.original;
        const isSelf = u.id === currentUser?.id;
        return (
          <div className="flex gap-2">
            <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
            {!isSelf && (
              <button onClick={() => setDeleteTarget(u)} className="text-red-600 hover:text-red-800 text-sm">
                {u.is_active ? "Deactivate" : "Deactivated"}
              </button>
            )}
          </div>
        );
      },
    }] : []),
  ], [isSuperadmin, currentUser]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!isSuperadmin) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">User Management</h1>
        <p className="text-gray-500">Only superadmins can manage users.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
        <span className="text-sm text-gray-500">{total} users total</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <button onClick={openCreate} className="px-3 py-1.5 bg-[#1B4F72] text-white rounded-md text-sm hover:bg-[#154360]">
          Add User
        </button>
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
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>
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
              <h2 className="text-lg font-semibold text-gray-800">{editItem ? "Edit User" : "Create User"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
              </div>
              {!editItem && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
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
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Deactivate User?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will deactivate <strong>{deleteTarget.full_name}</strong> ({deleteTarget.email}). They will no longer be able to log in.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700">Deactivate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
