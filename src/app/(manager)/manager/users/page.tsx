'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface StaffMember {
  id: string;
  name: string;
  rank: number;
  isActive: boolean;
  createdAt: string;
  failedAttempts: number;
  lockedUntil: string | null;
}

const RANK_LABELS: Record<number, string> = {
  0: 'Deactivated',
  1: 'View Only',
  2: 'Kitchen',
  3: 'FOH',
  4: 'Custom L1',
  5: 'Custom L2',
  6: 'Supervisor',
  7: 'Admin',
};

function rankBadgeClass(rank: number): string {
  if (rank === 0) return 'bg-gray-200 text-gray-600';
  if (rank === 1) return 'bg-slate-200 text-slate-700';
  if (rank === 2) return 'bg-yellow-100 text-yellow-800';
  if (rank === 3) return 'bg-blue-100 text-blue-800';
  if (rank >= 4 && rank <= 6) return 'bg-purple-100 text-purple-800';
  return 'bg-red-100 text-red-800'; // rank 7
}

interface FormState {
  name: string;
  rank: number;
  pinLength: number;
}

const defaultForm: FormState = { name: '', rank: 3, pinLength: 4 };

export default function UsersPage() {
  const { rank, isAuthenticated } = useAuth();
  const router = useRouter();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);

  // PIN display modal
  const [newPin, setNewPin] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && rank < 4) router.replace('/tables');
  }, [isAuthenticated, rank, router]);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/staff');
      if (!res.ok) throw new Error('Failed to load staff');
      const data = await res.json();
      setStaff(data.staff ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  function openAdd() {
    setForm(defaultForm);
    setShowAdd(true);
  }

  function openEdit(member: StaffMember) {
    setEditTarget(member);
    setForm({ name: member.name, rank: member.rank, pinLength: 4 });
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, rank: form.rank, pinLength: form.pinLength }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create');
      setShowAdd(false);
      setNewPin(data.pin ?? data.staff?.pin ?? null);
      loadStaff();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/staff/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, rank: form.rank }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setEditTarget(null);
      loadStaff();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(member: StaffMember) {
    try {
      const res = await fetch(`/api/admin/staff/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !member.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      loadStaff();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  async function handleRegenPin(member: StaffMember) {
    if (!confirm(`Regenerate PIN for ${member.name}?`)) return;
    try {
      const res = await fetch(`/api/admin/staff/${member.id}?action=regenerate-pin`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setNewPin(data.pin ?? data.staff?.pin ?? null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + Add User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Rank</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{member.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${rankBadgeClass(member.rank)}`}>
                      {RANK_LABELS[member.rank] ?? `Rank ${member.rank}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${member.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {member.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(member)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRegenPin(member)}
                      className="text-purple-600 hover:underline text-xs"
                    >
                      Regen PIN
                    </button>
                    <button
                      onClick={() => handleToggleActive(member)}
                      className={`text-xs ${member.isActive ? 'text-red-500 hover:underline' : 'text-green-600 hover:underline'}`}
                    >
                      {member.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      {showAdd && (
        <Modal title="Add User" onClose={() => setShowAdd(false)}>
          <StaffForm form={form} setForm={setForm} showPinLength />
          <ModalActions
            onCancel={() => setShowAdd(false)}
            onConfirm={handleCreate}
            confirmLabel="Create"
            loading={saving}
          />
        </Modal>
      )}

      {/* Edit User Modal */}
      {editTarget && (
        <Modal title={`Edit — ${editTarget.name}`} onClose={() => setEditTarget(null)}>
          <StaffForm form={form} setForm={setForm} showPinLength={false} />
          <ModalActions
            onCancel={() => setEditTarget(null)}
            onConfirm={handleEdit}
            confirmLabel="Save"
            loading={saving}
          />
        </Modal>
      )}

      {/* PIN Display Modal */}
      {newPin && (
        <Modal title="New PIN (one-time display)" onClose={() => setNewPin(null)}>
          <p className="text-sm text-gray-600 mb-4">
            Record this PIN — it will not be shown again.
          </p>
          <div className="text-center py-6 bg-gray-50 rounded-xl">
            <span className="text-5xl font-mono font-bold tracking-widest text-gray-900">
              {newPin}
            </span>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setNewPin(null)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StaffForm({
  form,
  setForm,
  showPinLength,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  showPinLength: boolean;
}) {
  return (
    <div className="space-y-4 mb-6">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Staff name"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Rank</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.rank}
          onChange={(e) => setForm({ ...form, rank: Number(e.target.value) })}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((r) => (
            <option key={r} value={r}>
              {r} — {RANK_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      {showPinLength && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">PIN Length</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.pinLength}
            onChange={(e) => setForm({ ...form, pinLength: Number(e.target.value) })}
          >
            <option value={4}>4 digits</option>
            <option value={6}>6 digits</option>
          </select>
        </div>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  loading,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  loading: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        onClick={onCancel}
        className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={loading}
        className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? 'Saving…' : confirmLabel}
      </button>
    </div>
  );
}
