import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      toast.error(t('users.failedLoad'));
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
      toast.error(t('users.emailNameRequired'));
      return;
    }
    if (!editItem && !form.password) {
      toast.error(t('users.passwordRequired'));
      return;
    }
    setSubmitting(true);
    try {
      if (editItem) {
        const payload = { email: form.email, full_name: form.full_name, role: form.role };
        await updateUserApi(editItem.id, payload);
        toast.success(t('users.userUpdated'));
      } else {
        await createUserApi({ email: form.email, full_name: form.full_name, password: form.password, role: form.role });
        toast.success(t('users.userCreated'));
      }
      setShowForm(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('users.operationFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteUserApi(deleteTarget.id);
      toast.success(t('users.userDeactivated'));
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error(t('users.failedDelete'));
    }
  }

  const columns = useMemo(() => [
    { accessorKey: "full_name", header: t('users.name') },
    { accessorKey: "email", header: t('users.email') },
    {
      accessorKey: "role",
      header: t('users.role'),
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
      header: t('users.status'),
      cell: ({ getValue }) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          getValue() ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}>{getValue() ? t('users.active') : t('users.inactive')}</span>
      ),
    },
    {
      accessorKey: "created_at",
      header: t('users.created'),
      cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
    },
    ...(isSuperadmin ? [{
      id: "actions",
      header: t('users.actions'),
      cell: ({ row }) => {
        const u = row.original;
        const isSelf = u.id === currentUser?.id;
        return (
          <div className="flex gap-2">
            <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800 text-sm">{t('users.edit')}</button>
            {!isSelf && (
              <button onClick={() => setDeleteTarget(u)} className="text-red-600 hover:text-red-800 text-sm">
                {u.is_active ? t('users.deactivate') : t('users.deactivated')}
              </button>
            )}
          </div>
        );
      },
    }] : []),
  ], [isSuperadmin, currentUser, t]);

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
        <h1 className="text-2xl font-bold text-gray-800 mb-4">{t('users.title')}</h1>
        <p className="text-gray-500">{t('users.onlySuperadmin')}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('users.title')}</h1>
        <span className="text-sm text-gray-500">{total} {t('users.totalUsers')}</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <button onClick={openCreate} className="px-3 py-1.5 bg-[#1B4F72] text-white rounded-md text-sm hover:bg-[#154360]">
          {t('users.addUser')}
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
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">{t('users.loading')}</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">{t('users.noUsers')}</td></tr>
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
              <h2 className="text-lg font-semibold text-gray-800">{editItem ? t('users.editUser') : t('users.createUser')}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.fullName')} *</label>
                <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.email')} *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
              </div>
              {!editItem && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.password')} *</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.role')}</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">{t('users.cancel')}</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-[#1B4F72] text-white rounded-md text-sm hover:bg-[#154360] disabled:opacity-50">{submitting ? t('users.saving') : editItem ? t('users.update') : t('users.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('users.deactivateUser')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {t('users.deactivateMessage', { name: deleteTarget.full_name, email: deleteTarget.email })}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">{t('users.cancel')}</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700">{t('users.deactivate')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
