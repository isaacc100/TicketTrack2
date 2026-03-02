'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface Category {
  id: string;
  name: string;
  colour: string | null;
  sortOrder: number;
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  description: string | null;
  colour: string | null;
  sortOrder: number;
  isAvailable: boolean;
  kdsStation: string | null;
}

interface KdsStation {
  id: string;
  name: string;
}

interface CategoryForm {
  name: string;
  colour: string;
  sortOrder: number;
}

interface ItemForm {
  name: string;
  price: string;
  description: string;
  colour: string;
  sortOrder: number;
  kdsStation: string;
  isAvailable: boolean;
}

const defaultCatForm: CategoryForm = { name: '', colour: '', sortOrder: 0 };
const defaultItemForm: ItemForm = {
  name: '', price: '', description: '', colour: '', sortOrder: 0, kdsStation: '', isAvailable: true,
};

export default function MenuPage() {
  const { rank, isAuthenticated } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [stations, setStations] = useState<KdsStation[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Category modal
  const [catModal, setCatModal] = useState<'add' | 'edit' | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>(defaultCatForm);
  const [editCatId, setEditCatId] = useState<string | null>(null);

  // Item modal
  const [itemModal, setItemModal] = useState<'add' | 'edit' | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(defaultItemForm);
  const [editItemId, setEditItemId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAuthenticated && rank < 4) router.replace('/tables');
  }, [isAuthenticated, rank, router]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/menu/categories');
      if (!res.ok) throw new Error('Failed to load categories');
      const data = await res.json();
      const cats: Category[] = data.categories ?? data;
      setCategories(cats);
      if (cats.length > 0 && !selectedCatId) {
        setSelectedCatId(cats[0].id);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedCatId]);

  const loadItems = useCallback(async (catId: string) => {
    try {
      const res = await fetch(`/api/menu/items?categoryId=${catId}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? data);
    } catch {}
  }, []);

  useEffect(() => {
    loadCategories();
    fetch('/api/kds/stations').then(r => r.json()).then(d => setStations(d.stations ?? d)).catch(() => {});
  }, [loadCategories]);

  useEffect(() => {
    if (selectedCatId) loadItems(selectedCatId);
  }, [selectedCatId, loadItems]);

  // Category actions
  function openAddCat() {
    setCatForm(defaultCatForm);
    setEditCatId(null);
    setCatModal('add');
  }

  function openEditCat(cat: Category) {
    setCatForm({ name: cat.name, colour: cat.colour ?? '', sortOrder: cat.sortOrder });
    setEditCatId(cat.id);
    setCatModal('edit');
  }

  async function handleSaveCat() {
    setSaving(true);
    try {
      if (catModal === 'add') {
        const res = await fetch('/api/menu/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(catForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        const newCat = data.category ?? data;
        setSelectedCatId(newCat.id);
      } else if (editCatId) {
        const res = await fetch(`/api/menu/categories/${editCatId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(catForm),
        });
        if (!res.ok) throw new Error('Failed to update');
      }
      setCatModal(null);
      await loadCategories();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCat(id: string) {
    if (!confirm('Delete this category and all its items?')) return;
    try {
      const res = await fetch(`/api/menu/categories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      if (selectedCatId === id) setSelectedCatId(null);
      loadCategories();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  // Item actions
  function openAddItem() {
    setItemForm(defaultItemForm);
    setEditItemId(null);
    setItemModal('add');
  }

  function openEditItem(item: MenuItem) {
    setItemForm({
      name: item.name,
      price: (item.price / 100).toFixed(2),
      description: item.description ?? '',
      colour: item.colour ?? '',
      sortOrder: item.sortOrder,
      kdsStation: item.kdsStation ?? '',
      isAvailable: item.isAvailable,
    });
    setEditItemId(item.id);
    setItemModal('edit');
  }

  async function handleSaveItem() {
    if (!selectedCatId) return;
    setSaving(true);
    try {
      const payload = {
        ...itemForm,
        categoryId: selectedCatId,
        price: Math.round(parseFloat(itemForm.price || '0') * 100),
        kdsStation: itemForm.kdsStation || null,
        colour: itemForm.colour || null,
        description: itemForm.description || null,
      };
      if (itemModal === 'add') {
        const res = await fetch('/api/menu/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
      } else if (editItemId) {
        const res = await fetch(`/api/menu/items/${editItemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update');
      }
      setItemModal(null);
      if (selectedCatId) loadItems(selectedCatId);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(id: string) {
    if (!confirm('Delete this item?')) return;
    try {
      const res = await fetch(`/api/menu/items/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      if (selectedCatId) loadItems(selectedCatId);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div className="p-8 h-full">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Menu Editor</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading…</div>
      ) : (
        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Categories panel */}
          <div className="w-64 bg-white rounded-xl shadow-sm flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-700 text-sm">Categories</span>
              <button
                onClick={openAddCat}
                className="text-blue-600 hover:text-blue-700 text-xs font-medium"
              >
                + Add
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${selectedCatId === cat.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {cat.colour && (
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.colour }} />
                    )}
                    <span className="text-sm font-medium text-gray-800 truncate">{cat.name}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditCat(cat); }}
                      className="text-xs text-gray-400 hover:text-blue-600 px-1"
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteCat(cat.id); }}
                      className="text-xs text-gray-400 hover:text-red-500 px-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Items panel */}
          <div className="flex-1 bg-white rounded-xl shadow-sm flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-700 text-sm">
                {categories.find(c => c.id === selectedCatId)?.name ?? 'Select a category'}
              </span>
              {selectedCatId && (
                <button
                  onClick={openAddItem}
                  className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                >
                  + Add Item
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedCatId ? (
                <p className="text-gray-400 text-sm">Select a category to see items.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-200 rounded-xl p-3 relative"
                      style={{ borderTopColor: item.colour ?? undefined, borderTopWidth: item.colour ? 3 : undefined }}
                    >
                      <p className="font-medium text-sm text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">£{(item.price / 100).toFixed(2)}</p>
                      {!item.isAvailable && (
                        <span className="text-xs text-red-500 mt-0.5 block">Unavailable</span>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => openEditItem(item)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-gray-400 text-sm col-span-full">No items in this category.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {catModal && (
        <Modal
          title={catModal === 'add' ? 'Add Category' : 'Edit Category'}
          onClose={() => setCatModal(null)}
        >
          <div className="space-y-4 mb-5">
            <Field label="Name">
              <input
                className={INPUT_CLS}
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                placeholder="Category name"
              />
            </Field>
            <Field label="Colour (hex)">
              <input
                className={INPUT_CLS}
                value={catForm.colour}
                onChange={(e) => setCatForm({ ...catForm, colour: e.target.value })}
                placeholder="#3b82f6"
              />
            </Field>
            <Field label="Sort Order">
              <input
                type="number"
                className={INPUT_CLS}
                value={catForm.sortOrder}
                onChange={(e) => setCatForm({ ...catForm, sortOrder: Number(e.target.value) })}
              />
            </Field>
          </div>
          <ModalActions onCancel={() => setCatModal(null)} onConfirm={handleSaveCat} confirmLabel="Save" loading={saving} />
        </Modal>
      )}

      {/* Item Modal */}
      {itemModal && (
        <Modal
          title={itemModal === 'add' ? 'Add Item' : 'Edit Item'}
          onClose={() => setItemModal(null)}
        >
          <div className="space-y-4 mb-5">
            <Field label="Name">
              <input className={INPUT_CLS} value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Item name" />
            </Field>
            <Field label="Price (£)">
              <input type="number" step="0.01" min="0" className={INPUT_CLS} value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} placeholder="0.00" />
            </Field>
            <Field label="Description">
              <input className={INPUT_CLS} value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} placeholder="Optional description" />
            </Field>
            <Field label="Colour (hex)">
              <input className={INPUT_CLS} value={itemForm.colour} onChange={(e) => setItemForm({ ...itemForm, colour: e.target.value })} placeholder="#3b82f6" />
            </Field>
            <Field label="Sort Order">
              <input type="number" className={INPUT_CLS} value={itemForm.sortOrder} onChange={(e) => setItemForm({ ...itemForm, sortOrder: Number(e.target.value) })} />
            </Field>
            <Field label="KDS Station">
              <select
                className={INPUT_CLS}
                value={itemForm.kdsStation}
                onChange={(e) => setItemForm({ ...itemForm, kdsStation: e.target.value })}
              >
                <option value="">None</option>
                {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isAvailable"
                checked={itemForm.isAvailable}
                onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="isAvailable" className="text-sm text-gray-700">Available</label>
            </div>
          </div>
          <ModalActions onCancel={() => setItemModal(null)} onConfirm={handleSaveItem} confirmLabel="Save" loading={saving} />
        </Modal>
      )}
    </div>
  );
}

const INPUT_CLS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onConfirm, confirmLabel, loading }: { onCancel: () => void; onConfirm: () => void; confirmLabel: string; loading: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition">Cancel</button>
      <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50">
        {loading ? 'Saving…' : confirmLabel}
      </button>
    </div>
  );
}

