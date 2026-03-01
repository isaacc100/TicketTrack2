'use client';

import { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { TouchButton } from '@/components/ui/TouchButton';
import type { ModifierGroup, ModifierSelection, MenuItemData } from '@/types';

interface ModifierModalProps {
  item: MenuItemData;
  onConfirm: (modifiers: ModifierSelection[], notes: string) => void;
  onClose: () => void;
}

export function ModifierModal({ item, onConfirm, onClose }: ModifierModalProps) {
  const groups: ModifierGroup[] = (item.modifierGroups as ModifierGroup[]) || [];
  const [selections, setSelections] = useState<Record<string, { name: string; price: number }[]>>({});
  const [notes, setNotes] = useState('');

  const toggleSelection = (groupName: string, option: { name: string; price: number }, multiSelect: boolean) => {
    setSelections(prev => {
      const current = prev[groupName] || [];
      const exists = current.find(s => s.name === option.name);

      if (exists) {
        return { ...prev, [groupName]: current.filter(s => s.name !== option.name) };
      }

      if (multiSelect) {
        return { ...prev, [groupName]: [...current, option] };
      }

      // Single select — replace
      return { ...prev, [groupName]: [option] };
    });
  };

  const isSelected = (groupName: string, optionName: string) => {
    return (selections[groupName] || []).some(s => s.name === optionName);
  };

  const isValid = () => {
    return groups.every(g => {
      if (!g.required) return true;
      const selected = (selections[g.name] || []).length;
      const min = g.min || 1;
      return selected >= min;
    });
  };

  const totalExtra = Object.values(selections)
    .flat()
    .reduce((sum, s) => sum + s.price, 0);

  const handleConfirm = () => {
    const modifierSelections: ModifierSelection[] = Object.entries(selections)
      .filter(([, sels]) => sels.length > 0)
      .map(([groupName, sels]) => ({ groupName, selections: sels }));

    onConfirm(modifierSelections, notes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <div>
            <h2 className="text-xl font-bold">{item.name}</h2>
            <p className="text-gray-500">£{Number(item.price).toFixed(2)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          {groups.map(group => (
            <div key={group.name}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-lg">{group.name}</h3>
                {group.required && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Required</span>
                )}
                {group.multiSelect && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Multi</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {group.options.map(option => {
                  const selected = isSelected(group.name, option.name);
                  return (
                    <button
                      key={option.name}
                      onClick={() => toggleSelection(group.name, option, group.multiSelect)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? 'bg-blue-50 border-blue-400 text-blue-800'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="block font-medium text-sm">{option.name}</span>
                      {option.price > 0 && (
                        <span className="text-xs text-gray-500">+£{option.price.toFixed(2)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. no onions, extra sauce..."
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t shrink-0 flex gap-3">
          <TouchButton variant="outline" className="flex-1 h-14 text-base" onClick={onClose}>
            Cancel
          </TouchButton>
          <TouchButton
            className="flex-1 h-14 text-base bg-green-600 hover:bg-green-700"
            onClick={handleConfirm}
            disabled={!isValid()}
          >
            Add — £{(Number(item.price) + totalExtra).toFixed(2)}
          </TouchButton>
        </div>
      </div>
    </div>
  );
}
