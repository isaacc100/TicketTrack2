'use client';

import { TouchButton } from './TouchButton';
import { Delete } from 'lucide-react';

interface NumpadProps {
  onKeyPress: (key: string) => void;
  onClear: () => void;
  onDelete: () => void;
  onSubmit: () => void;
  maxLength?: number;
  currentValue: string;
}

export function Numpad({ onKeyPress, onClear, onDelete, onSubmit, maxLength, currentValue }: NumpadProps) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const handleKeyPress = (key: string) => {
    if (maxLength && currentValue.length >= maxLength) return;
    onKeyPress(key);
  };

  return (
    <div className="grid grid-cols-3 gap-4 w-fit mx-auto">
      {keys.map((key) => (
        <TouchButton
          key={key}
          size="numpad"
          variant="outline"
          onClick={() => handleKeyPress(key)}
        >
          {key}
        </TouchButton>
      ))}
      <TouchButton size="numpad" variant="outline" onClick={onClear} className="bg-red-50 hover:bg-red-100 text-red-600">
        C
      </TouchButton>
      <TouchButton size="numpad" variant="outline" onClick={() => handleKeyPress('0')}>
        0
      </TouchButton>
      <TouchButton size="numpad" variant="outline" onClick={onDelete}>
        <Delete className="w-8 h-8" />
      </TouchButton>
      <TouchButton 
        className="col-span-3 h-20 text-xl font-bold bg-green-600 hover:bg-green-700" 
        onClick={onSubmit}
        disabled={currentValue.length === 0}
      >
        Enter
      </TouchButton>
    </div>
  );
}
