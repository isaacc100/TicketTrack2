'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

type FieldType = 'number' | 'boolean' | 'text' | 'select';

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  description?: string;
}

const FIELD_DEFS: FieldDef[] = [
  { key: 'sessionTimeoutMinutes', label: 'Session Timeout (minutes)', type: 'number', description: 'Auto-lock after inactivity' },
  { key: 'maxPinAttempts', label: 'Max PIN Attempts', type: 'number', description: 'Failed attempts before lockout' },
  { key: 'lockoutDurationMinutes', label: 'Lockout Duration (minutes)', type: 'number', description: 'How long to lock after max attempts' },
  { key: 'roundingRule', label: 'Rounding Rule', type: 'select', options: ['NONE', 'UP', 'DOWN', 'NEAREST'] },
  { key: 'pickupScreenEnabled', label: 'Pickup Screen Enabled', type: 'boolean' },
  { key: 'tipSuggestions', label: 'Tip Suggestions (%)', type: 'text', description: 'Comma-separated, e.g. 10,12.5,15,20' },
];

const INPUT_CLS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function SettingsPage() {
  const { rank, isAuthenticated } = useAuth();
  const router = useRouter();

  const [config, setConfig] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isAuthenticated && rank < 4) router.replace('/tables');
  }, [isAuthenticated, rank, router]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config');
      if (!res.ok) throw new Error('Failed to load config');
      const data = await res.json();
      // API returns { config: Record<string, unknown> }
      const flat: Record<string, string> = {};
      if (data.config && typeof data.config === 'object' && !Array.isArray(data.config)) {
        Object.entries(data.config as Record<string, unknown>).forEach(([k, v]) => {
          flat[k] = String(v);
        });
      }
      setConfig(flat);
      setOriginal(flat);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleChange(key: string, value: string) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Only send changed values
      const changed = Object.entries(config).filter(([k, v]) => original[k] !== v);
      if (changed.length === 0) {
        showToast('No changes to save', 'success');
        setSaving(false);
        return;
      }
      await Promise.all(
        changed.map(([key, value]) =>
          fetch('/api/admin/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value }),
          }).then(async (res) => {
            if (!res.ok) throw new Error((await res.json()).error || `Failed to save ${key}`);
          })
        )
      );
      setOriginal(config);
      showToast('Settings saved', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {FIELD_DEFS.map((field) => {
            const value = config[field.key] ?? '';
            return (
              <div key={field.key} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{field.label}</p>
                    {field.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
                    )}
                  </div>
                  <div className="w-56 shrink-0">
                    {field.type === 'boolean' ? (
                      <button
                        type="button"
                        onClick={() => handleChange(field.key, value === 'true' ? 'false' : 'true')}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          value === 'true' ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            value === 'true' ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    ) : field.type === 'select' ? (
                      <select
                        className={INPUT_CLS}
                        value={value}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                      >
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        className={INPUT_CLS}
                        value={value}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unknown keys from config that aren't in FIELD_DEFS */}
      {!loading && (() => {
        const knownKeys = new Set(FIELD_DEFS.map((f) => f.key));
        const extraEntries = Object.entries(config).filter(([k]) => !knownKeys.has(k));
        if (extraEntries.length === 0) return null;
        return (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Other Settings</h2>
            <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
              {extraEntries.map(([key, value]) => (
                <div key={key} className="px-5 py-4 flex items-center justify-between gap-4">
                  <p className="text-sm text-gray-700 font-mono">{key}</p>
                  <input
                    className={`${INPUT_CLS} w-56`}
                    value={value}
                    onChange={(e) => handleChange(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
