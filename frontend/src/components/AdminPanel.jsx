import React, { useState, useEffect, useMemo } from 'react';
import { authFetch } from '../services/authService';
import { LogOut, Search, Users, Stethoscope, FlaskConical, User, X, Trash2, Eye } from 'lucide-react';

const TYPE_LABELS = { doctor: 'Doctor', researcher: 'Researcher', personal: 'Personal' };

const TypeBadge = ({ userType, isAdmin }) => {
  if (isAdmin) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Admin</span>;
  if (userType === 'doctor') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Doctor</span>;
  if (userType === 'researcher') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Researcher</span>;
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Personal</span>;
};

const formatDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};

export default function AdminPanel({ loginData, onLogout }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/admin/users', { method: 'GET' });
      if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
      setUsers(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async (userId) => {
    try {
      const res = await authFetch(`/admin/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Delete failed (${res.status})`);
      }
      setUsers(prev => prev.filter(u => u.id !== userId));
      setDeleteConfirm(null);
      showToast('Account deleted successfully');
    } catch (err) {
      setDeleteConfirm(null);
      showToast(err.message, true);
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return users.filter(u => {
      const matchType = filterType === 'all' || u.user_type === filterType;
      const matchSearch = !q || (u.display_name || '').toLowerCase().includes(q)
        || (u.email || '').toLowerCase().includes(q)
        || (u.hospital || '').toLowerCase().includes(q);
      return matchType && matchSearch;
    });
  }, [users, searchQuery, filterType]);

  const stats = useMemo(() => ({
    total: users.length,
    doctors: users.filter(u => u.user_type === 'doctor').length,
    researchers: users.filter(u => u.user_type === 'researcher').length,
    personal: users.filter(u => u.user_type === 'personal' && !u.is_admin).length,
  }), [users]);

  const adminEmail = loginData?.email || '';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">SUDerm Admin</h1>
            <p className="text-xs text-gray-500">Account Management</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden sm:block">{adminEmail}</span>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-6 max-w-7xl mx-auto w-full">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Accounts', value: stats.total, icon: <Users className="w-5 h-5 text-gray-500" /> },
            { label: 'Doctors', value: stats.doctors, icon: <Stethoscope className="w-5 h-5 text-green-600" /> },
            { label: 'Researchers', value: stats.researchers, icon: <FlaskConical className="w-5 h-5 text-blue-600" /> },
            { label: 'Personal', value: stats.personal, icon: <User className="w-5 h-5 text-gray-500" /> },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
              {s.icon}
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 px-4 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or hospital…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="all">All types</option>
            <option value="doctor">Doctors</option>
            <option value="researcher">Researchers</option>
            <option value="personal">Personal</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading && (
            <div className="text-center py-16 text-gray-500 text-sm">Loading accounts…</div>
          )}
          {error && !loading && (
            <div className="text-center py-16 text-red-500 text-sm">{error}</div>
          )}
          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Name', 'Email', 'Type', 'Hospital / Org', 'Joined', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400">No accounts found</td></tr>
                  )}
                  {filtered.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{u.display_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{u.email || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><TypeBadge userType={u.user_type} isAdmin={!!u.is_admin} /></td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{u.hospital || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(u)}
                            disabled={u.email === adminEmail}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={u.email === adminEmail ? 'Cannot delete your own account' : 'Delete account'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-3 text-right">Showing {filtered.length} of {users.length} accounts</p>
      </main>

      {/* Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedUser.display_name}</h2>
                <TypeBadge userType={selectedUser.user_type} isAdmin={!!selectedUser.is_admin} />
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <dl className="space-y-3 text-sm">
              {[
                { label: 'Full Name', value: selectedUser.full_name },
                { label: 'Email', value: selectedUser.email },
                { label: 'Phone', value: selectedUser.phone_number },
                { label: 'Hospital / Org', value: selectedUser.hospital },
                { label: 'Doctor ID', value: selectedUser.doctor_id },
                { label: 'Account Type', value: TYPE_LABELS[selectedUser.user_type] || selectedUser.user_type },
                { label: 'Joined', value: formatDate(selectedUser.created_at) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-gray-500 shrink-0">{label}</dt>
                  <dd className="text-gray-900 text-right break-all">{value || '—'}</dd>
                </div>
              ))}
            </dl>
            <button
              onClick={() => setSelectedUser(null)}
              className="mt-6 w-full py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Delete Account</h2>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              Are you sure you want to delete the account for <strong>{deleteConfirm.display_name}</strong> ({deleteConfirm.email})?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="flex-1 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.isError ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
