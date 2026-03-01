'use client';

import * as React from 'react';
import * as Toast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
  duration?: number;
}

// Global toast state
let toastListeners: ((toast: ToastMessage) => void)[] = [];

export function toast(message: Omit<ToastMessage, 'id'>) {
  const id = Math.random().toString(36).slice(2, 9);
  const toastMessage: ToastMessage = { ...message, id };
  toastListeners.forEach(listener => listener(toastMessage));
}

const variantStyles: Record<string, string> = {
  default: 'bg-white border-gray-200',
  success: 'bg-green-50 border-green-300',
  error: 'bg-red-50 border-red-300',
  warning: 'bg-amber-50 border-amber-300',
};

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  React.useEffect(() => {
    const listener = (toast: ToastMessage) => {
      setToasts(prev => [...prev, toast]);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <Toast.Provider swipeDirection="right" duration={3000}>
      {toasts.map(t => (
        <Toast.Root
          key={t.id}
          className={cn(
            'border rounded-xl shadow-lg p-4 flex items-start gap-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-top-full',
            variantStyles[t.variant || 'default']
          )}
          duration={t.duration || 3000}
          onOpenChange={(open) => {
            if (!open) removeToast(t.id);
          }}
        >
          <div className="flex-1">
            <Toast.Title className="text-sm font-semibold">{t.title}</Toast.Title>
            {t.description && (
              <Toast.Description className="text-sm text-gray-600 mt-1">
                {t.description}
              </Toast.Description>
            )}
          </div>
          <Toast.Close className="p-1 rounded-md hover:bg-black/5">
            <X className="w-4 h-4" />
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed top-4 right-4 flex flex-col gap-2 w-96 max-w-[90vw] z-[100]" />
    </Toast.Provider>
  );
}
