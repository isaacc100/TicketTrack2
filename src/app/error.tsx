'use client';

import { TouchButton } from '@/components/ui/TouchButton';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md p-8">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-6">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <div className="flex gap-4 justify-center">
          <TouchButton onClick={reset} className="bg-blue-600 hover:bg-blue-700 h-14 px-8 text-lg">
            Try Again
          </TouchButton>
          <TouchButton
            variant="outline"
            className="h-14 px-8 text-lg"
            onClick={() => window.location.href = '/tables'}
          >
            Go to Tables
          </TouchButton>
        </div>
      </div>
    </div>
  );
}
