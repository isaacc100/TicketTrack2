'use client';

import { useState, useEffect, useCallback } from 'react';
import { TouchButton } from '@/components/ui/TouchButton';
import { PermissionGate } from '@/components/ui/PermissionGate';
import { toast } from '@/components/ui/Toaster';
import { useSocketRefresh } from '@/hooks/useSocket';
import { Permission } from '@/lib/permissions';
import {
  Plus, Pencil, Trash2, Eye, EyeOff,
  ChevronDown, ChevronRight, Save, X, Package,
} from 'lucide-react';
import type { ModifierGroup, ModifierOption } from '@/types';

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  colour: string | null;
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  description: string | null;
  colour: string | null;
  sortOrder: number;
  modifierGroups: ModifierGroup[] | null;
  isAvailable: boolean;
}

export default function MenuManagementPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [isNewItem, setIsNewItem] = useState(false);

  useSocketRefresh(['menu:updated']);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/menu/categories');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      toast({ title: 'Failed to load menu', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // ─── Category CRUD ─────────────────────────────────────────────────────────

  const handleSaveCategory = async () => {
    if (!editingCategory?.name) {
      toast({ title: 'Category name required', variant: 'error' });
      return;
    }

    try {
      const method = isNewCategory ? 'POST' : 'PATCH';
      const res = await fetch('/api/menu/categories', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCategory),
      });

      if (res.ok) {
        toast({ title: isNewCategory ? 'Category created' : 'Category updated', variant: 'success' });
        setEditingCategory(null);
        setIsNewCategory(false);
        fetchCategories();
      } else {
        const err = await res.json();
        toast({ title: err.error || 'Failed', variant: 'error' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}" and all its items?`)) return;

    try {
      const res = await fetch('/api/menu/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        toast({ title: 'Category deleted', variant: 'success' });
        fetchCategories();
      }
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  // ─── Item CRUD ─────────────────────────────────────────────────────────────

  const handleSaveItem = async () => {
    if (!editingItem?.name || editingItem.price === undefined || !editingItem.categoryId) {
      toast({ title: 'Name, price, and category required', variant: 'error' });
      return;
    }

    try {
      const method = isNewItem ? 'POST' : 'PATCH';
      const res = await fetch('/api/menu/items', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem),
      });

      if (res.ok) {
        toast({ title: isNewItem ? 'Item created' : 'Item updated', variant: 'success' });
        setEditingItem(null);
        setIsNewItem(false);
        fetchCategories();
      } else {
        const err = await res.json();
        toast({ title: err.error || 'Failed', variant: 'error' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;

    try {
      const res = await fetch('/api/menu/items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        toast({ title: 'Item deleted', variant: 'success' });
        fetchCategories();
      }
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      const res = await fetch('/api/menu/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, isAvailable: !item.isAvailable }),
      });

      if (res.ok) {
        toast({ title: item.isAvailable ? 'Marked unavailable' : 'Marked available', variant: 'success' });
        fetchCategories();
      }
    } catch {
      toast({ title: 'Network error', variant: 'error' });
    }
  };

  // ─── Modifier Editor helpers ───────────────────────────────────────────────

  const addModifierGroup = () => {
    if (!editingItem) return;
    const groups = [...(editingItem.modifierGroups || [])];
    groups.push({ name: '', required: false, multiSelect: false, options: [{ name: '', price: 0 }] });
    setEditingItem({ ...editingItem, modifierGroups: groups });
  };

  const updateModifierGroup = (idx: number, field: string, value: any) => {
    if (!editingItem) return;
    const groups = [...(editingItem.modifierGroups || [])];
    (groups[idx] as any)[field] = value;
    setEditingItem({ ...editingItem, modifierGroups: groups });
  };

  const removeModifierGroup = (idx: number) => {
    if (!editingItem) return;
    const groups = [...(editingItem.modifierGroups || [])];
    groups.splice(idx, 1);
    setEditingItem({ ...editingItem, modifierGroups: groups });
  };

  const addModifierOption = (groupIdx: number) => {
    if (!editingItem) return;
    const groups = [...(editingItem.modifierGroups || [])];
    groups[groupIdx].options.push({ name: '', price: 0 });
    setEditingItem({ ...editingItem, modifierGroups: groups });
  };

  const updateModifierOption = (groupIdx: number, optIdx: number, field: string, value: any) => {
    if (!editingItem) return;
    const groups = [...(editingItem.modifierGroups || [])];
    (groups[groupIdx].options[optIdx] as any)[field] = value;
    setEditingItem({ ...editingItem, modifierGroups: groups });
  };

  const removeModifierOption = (groupIdx: number, optIdx: number) => {
    if (!editingItem) return;
    const groups = [...(editingItem.modifierGroups || [])];
    groups[groupIdx].options.splice(optIdx, 1);
    setEditingItem({ ...editingItem, modifierGroups: groups });
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="bg-white shadow-sm h-20 px-8 flex items-center justify-between z-10 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Menu Management</h1>
          <p className="text-sm text-gray-500">{categories.length} categories, {categories.reduce((s, c) => s + c.items.length, 0)} items</p>
        </div>
        <PermissionGate required={Permission.EDIT_MENU}>
          <TouchButton
            className="bg-green-600 hover:bg-green-700 h-12 px-6 text-base gap-2"
            onClick={() => {
              setEditingCategory({ name: '', sortOrder: categories.length, colour: null });
              setIsNewCategory(true);
            }}
          >
            <Plus className="w-5 h-5" /> Add Category
          </TouchButton>
        </PermissionGate>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {categories.map(cat => (
          <div key={cat.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
            {/* Category Header */}
            <div
              className="flex items-center px-6 py-4 cursor-pointer hover:bg-gray-50 transition"
              onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
            >
              {expandedCategory === cat.id
                ? <ChevronDown className="w-5 h-5 text-gray-400 mr-3" />
                : <ChevronRight className="w-5 h-5 text-gray-400 mr-3" />
              }
              {cat.colour && (
                <span className="w-4 h-4 rounded-full mr-3 shrink-0" style={{ backgroundColor: cat.colour }} />
              )}
              <h2 className="text-lg font-bold flex-1">{cat.name}</h2>
              <span className="text-sm text-gray-500 mr-4">{cat.items.length} items</span>

              <PermissionGate required={Permission.EDIT_MENU}>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                    onClick={() => {
                      setEditingCategory({ id: cat.id, name: cat.name, sortOrder: cat.sortOrder, colour: cat.colour });
                      setIsNewCategory(false);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </PermissionGate>
            </div>

            {/* Items List */}
            {expandedCategory === cat.id && (
              <div className="border-t">
                {cat.items.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center px-6 py-3 border-b last:border-0 hover:bg-gray-50 transition ${
                      !item.isAvailable ? 'opacity-50' : ''
                    }`}
                  >
                    <Package className="w-4 h-4 text-gray-400 mr-4" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        {item.modifierGroups && (item.modifierGroups as any[]).length > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {(item.modifierGroups as any[]).length} mod group(s)
                          </span>
                        )}
                        {!item.isAvailable && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Unavailable</span>
                        )}
                      </div>
                      {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                    </div>
                    <span className="font-bold text-lg mr-6">£{Number(item.price).toFixed(2)}</span>

                    <PermissionGate required={Permission.EDIT_MENU}>
                      <div className="flex gap-1">
                        <button
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          onClick={() => handleToggleAvailability(item)}
                          title={item.isAvailable ? 'Mark unavailable' : 'Mark available'}
                        >
                          {item.isAvailable ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                        </button>
                        <button
                          className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                          onClick={() => {
                            setEditingItem({
                              id: item.id,
                              categoryId: item.categoryId,
                              name: item.name,
                              price: Number(item.price),
                              description: item.description,
                              colour: item.colour,
                              sortOrder: item.sortOrder,
                              modifierGroups: (item.modifierGroups as ModifierGroup[]) || [],
                              isAvailable: item.isAvailable,
                            });
                            setIsNewItem(false);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                          onClick={() => handleDeleteItem(item.id, item.name)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </PermissionGate>
                  </div>
                ))}

                {/* Add Item button */}
                <PermissionGate required={Permission.EDIT_MENU}>
                  <div className="px-6 py-3 border-t">
                    <button
                      className="w-full flex items-center justify-center gap-2 py-3 text-blue-600 hover:bg-blue-50 rounded-xl transition text-sm font-medium"
                      onClick={() => {
                        setEditingItem({
                          categoryId: cat.id,
                          name: '',
                          price: 0,
                          description: null,
                          colour: null,
                          sortOrder: cat.items.length,
                          modifierGroups: [],
                          isAvailable: true,
                        });
                        setIsNewItem(true);
                      }}
                    >
                      <Plus className="w-4 h-4" /> Add Item to {cat.name}
                    </button>
                  </div>
                </PermissionGate>
              </div>
            )}
          </div>
        ))}

        {categories.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No categories yet. Create one to get started.</p>
          </div>
        )}
      </div>

      {/* ─── Category Editor Modal ──────────────────────────────────────────── */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingCategory(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-bold">{isNewCategory ? 'New Category' : 'Edit Category'}</h3>
              <button onClick={() => setEditingCategory(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
                <input
                  type="text"
                  value={editingCategory.name || ''}
                  onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Colour</label>
                <input
                  type="color"
                  value={editingCategory.colour || '#3b82f6'}
                  onChange={e => setEditingCategory({ ...editingCategory, colour: e.target.value })}
                  className="w-16 h-12 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Sort Order</label>
                <input
                  type="number"
                  value={editingCategory.sortOrder ?? 0}
                  onChange={e => setEditingCategory({ ...editingCategory, sortOrder: Number(e.target.value) })}
                  className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <TouchButton variant="outline" className="flex-1 h-14" onClick={() => setEditingCategory(null)}>Cancel</TouchButton>
              <TouchButton className="flex-1 h-14 bg-green-600 hover:bg-green-700 gap-2" onClick={handleSaveCategory}>
                <Save className="w-5 h-5" /> Save
              </TouchButton>
            </div>
          </div>
        </div>
      )}

      {/* ─── Item Editor Modal ────────────────────────────────────────────────── */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingItem(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b shrink-0">
              <h3 className="text-xl font-bold">{isNewItem ? 'New Item' : 'Edit Item'}</h3>
              <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-4">
              {/* Basic fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
                  <input
                    type="text"
                    value={editingItem.name || ''}
                    onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Price (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.price ?? ''}
                    onChange={e => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                    className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
                  <select
                    value={editingItem.categoryId || ''}
                    onChange={e => setEditingItem({ ...editingItem, categoryId: e.target.value })}
                    className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
                  <input
                    type="text"
                    value={editingItem.description || ''}
                    onChange={e => setEditingItem({ ...editingItem, description: e.target.value || null })}
                    className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={editingItem.sortOrder ?? 0}
                    onChange={e => setEditingItem({ ...editingItem, sortOrder: Number(e.target.value) })}
                    className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingItem.isAvailable ?? true}
                      onChange={e => setEditingItem({ ...editingItem, isAvailable: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <span className="font-medium">Available</span>
                  </label>
                </div>
              </div>

              {/* Modifier Groups */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-700">Modifier Groups</h4>
                  <button
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    onClick={addModifierGroup}
                  >
                    <Plus className="w-4 h-4" /> Add Group
                  </button>
                </div>

                {(editingItem.modifierGroups || []).map((group, gi) => (
                  <div key={gi} className="border rounded-xl p-4 mb-3 bg-gray-50">
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="text"
                        value={group.name}
                        onChange={e => updateModifierGroup(gi, 'name', e.target.value)}
                        placeholder="Group name (e.g. Size, Extras)"
                        className="flex-1 h-10 px-3 border rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                      />
                      <label className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={group.required}
                          onChange={e => updateModifierGroup(gi, 'required', e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        Required
                      </label>
                      <label className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={group.multiSelect}
                          onChange={e => updateModifierGroup(gi, 'multiSelect', e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        Multi
                      </label>
                      <button onClick={() => removeModifierGroup(gi)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {group.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2 mb-2 ml-4">
                        <input
                          type="text"
                          value={opt.name}
                          onChange={e => updateModifierOption(gi, oi, 'name', e.target.value)}
                          placeholder="Option name"
                          className="flex-1 h-9 px-3 border rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <span className="text-sm text-gray-500">+£</span>
                        <input
                          type="number"
                          step="0.01"
                          value={opt.price}
                          onChange={e => updateModifierOption(gi, oi, 'price', Number(e.target.value))}
                          className="w-20 h-9 px-2 border rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <button onClick={() => removeModifierOption(gi, oi)} className="p-1 text-red-400 hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      className="ml-4 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                      onClick={() => addModifierOption(gi)}
                    >
                      <Plus className="w-3 h-3" /> Add Option
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t flex gap-3 shrink-0">
              <TouchButton variant="outline" className="flex-1 h-14" onClick={() => setEditingItem(null)}>Cancel</TouchButton>
              <TouchButton className="flex-1 h-14 bg-green-600 hover:bg-green-700 gap-2" onClick={handleSaveItem}>
                <Save className="w-5 h-5" /> Save Item
              </TouchButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
