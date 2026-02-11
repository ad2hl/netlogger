'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { updateUserProfile } from '@/lib/auth';
import { UserProfile, DEFAULT_DISPOSITION_METHODS } from '@/types';

export default function SettingsPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState<Partial<UserProfile>>({
    callsign: '',
    name: '',
    location: '',
    netManagerCall: '',
    qrzUsername: '',
    qrzPassword: '',
  });
  const [dispositionMethods, setDispositionMethods] = useState<string[]>(DEFAULT_DISPOSITION_METHODS);
  const [newMethod, setNewMethod] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) {
      setFormData({
        callsign: profile.callsign || '',
        name: profile.name || '',
        location: profile.location || '',
        netManagerCall: profile.netManagerCall || '',
        qrzUsername: profile.qrzUsername || '',
        qrzPassword: profile.qrzPassword || '',
      });
      setDispositionMethods(profile.dispositionMethods ?? DEFAULT_DISPOSITION_METHODS);
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'callsign' ? value.toUpperCase() : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage(null);

    const success = await updateUserProfile(user.uid, { ...formData, dispositionMethods });

    if (success) {
      await refreshProfile();
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } else {
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div>
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <Link
            href="/net"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Back to Net
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Your Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Callsign
                </label>
                <input
                  type="text"
                  name="callsign"
                  value={formData.callsign}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="e.g., K3ABC"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name (for radiogram signature)
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., John"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location (place of origin)
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., BALTIMORE MD"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Net Manager Callsign
                </label>
                <input
                  type="text"
                  name="netManagerCall"
                  value={formData.netManagerCall}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="e.g., W3XYZ"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">QRZ.com Credentials (Optional)</h2>
            <p className="text-sm text-gray-600 mb-4">
              If you have a QRZ.com account, enter your credentials to automatically look up operator names and locations. Without credentials, you can enter this information manually.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  QRZ Username
                </label>
                <input
                  type="text"
                  name="qrzUsername"
                  value={formData.qrzUsername}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your QRZ username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  QRZ Password
                </label>
                <input
                  type="password"
                  name="qrzPassword"
                  value={formData.qrzPassword}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your QRZ password"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Disposition Methods</h2>
            <p className="text-sm text-gray-600 mb-4">
              Customize the disposition methods available in radiogram forms.
            </p>

            <div className="space-y-2 mb-4">
              {dispositionMethods.map((method, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={method}
                    onChange={(e) => {
                      const updated = [...dispositionMethods];
                      updated[index] = e.target.value;
                      setDispositionMethods(updated);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setDispositionMethods(dispositionMethods.filter((_, i) => i !== index))}
                    className="text-red-500 hover:text-red-700 px-2 py-1 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newMethod}
                onChange={(e) => setNewMethod(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = newMethod.trim();
                    if (trimmed && !dispositionMethods.includes(trimmed)) {
                      setDispositionMethods([...dispositionMethods, trimmed]);
                      setNewMethod('');
                    }
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="New method name"
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = newMethod.trim();
                  if (trimmed && !dispositionMethods.includes(trimmed)) {
                    setDispositionMethods([...dispositionMethods, trimmed]);
                    setNewMethod('');
                  }
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm"
              >
                Add
              </button>
            </div>
          </div>

          {message && (
            <div
              className={`p-4 rounded-md ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </main>
    </div>
  );
}
