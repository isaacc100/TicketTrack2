'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { TouchButton } from '@/components/ui/TouchButton';
import { ALLERGENS } from '@/types';
import type { TableWithTabs } from '@/types';

interface CreateTabModalProps {
  table: TableWithTabs;
  onConfirm: (data: { tableId: string; name?: string; allergens?: string[] }) => void;
  onClose: () => void;
}

export function CreateTabModal({ table, onConfirm, onClose }: CreateTabModalProps) {
  const [tabName, setTabName] = useState('');
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleAllergen = (allergen: string) => {
    setSelectedAllergens(prev =>
      prev.includes(allergen)
        ? prev.filter(a => a !== allergen)
        : [...prev, allergen]
    );
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    await onConfirm({
      tableId: table.id,
      name: tabName || undefined,
      allergens: selectedAllergens.length > 0 ? selectedAllergens : undefined,
    });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">Open Tab — Table {table.number}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Tab Name (optional) */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Tab Name (optional)
            </label>
            <input
              type="text"
              value={tabName}
              onChange={e => setTabName(e.target.value)}
              placeholder="e.g. Birthday Party, John's table..."
              className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl text-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Allergen Prompt */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              ⚠️ Customer Allergens
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Select any allergens the customer has informed you about.
              These will be displayed as warnings on the order screen.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {ALLERGENS.map(allergen => {
                const isSelected = selectedAllergens.includes(allergen);
                return (
                  <button
                    key={allergen}
                    onClick={() => toggleAllergen(allergen)}
                    className={`px-3 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                      isSelected
                        ? 'bg-red-100 border-red-400 text-red-800'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {allergen}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex gap-4">
          <TouchButton
            variant="outline"
            className="flex-1 h-16 text-lg"
            onClick={onClose}
          >
            Cancel
          </TouchButton>
          <TouchButton
            className="flex-1 h-16 text-lg bg-green-600 hover:bg-green-700"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Opening...' : 'Open Tab'}
          </TouchButton>
        </div>
      </div>
    </div>
  );
}
