'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Numpad } from '@/components/ui/Numpad';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleKeyPress = (key: string) => {
    setPin((prev) => prev + key);
    setError('');
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        router.push('/tables'); // Will navigate to /tables instead of (foh)/tables
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed');
        setPin(''); // Clear PIN on failure
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 select-none touch-manipulation">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
        <h1 className="text-3xl font-bold mb-2">TicketTrack2</h1>
        <p className="text-gray-500 mb-8">Enter your PIN to log in</p>

        <div className="mb-8 flex justify-center gap-4">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-6 h-6 rounded-full border-2 ${
                pin.length > index ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
              }`}
            />
          ))}
          {/* For 6 digit pins support, optionally render 2 more dots if pin length > 4 */}
          {pin.length > 4 && (
            <>
              <div className="w-6 h-6 rounded-full border-2 bg-blue-600 border-blue-600" />
              {pin.length > 5 && (
                <div className="w-6 h-6 rounded-full border-2 bg-blue-600 border-blue-600" />
              )}
            </>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <Numpad
            currentValue={pin}
            onKeyPress={handleKeyPress}
            onDelete={handleDelete}
            onClear={handleClear}
            onSubmit={handleSubmit}
            maxLength={6}
          />
        )}
      </div>
    </div>
  );
}
