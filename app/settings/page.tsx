'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { changePassword } from '@/lib/auth';
import { updateUserProfile } from '@/lib/firestore';

const isDesktop = process.env.NEXT_PUBLIC_DESKTOP_MODE === 'true';

const FIXED_TAG_ACRONYMS = new Set(Object.keys(SPECIAL_TAGS));
import { UserProfile, CustomTag, SPECIAL_TAGS, DEFAULT_DISPOSITION_METHODS, DEFAULT_RECEIVED_METHODS } from '@/types';
import HeaderBanner from '@/components/HeaderBanner';
import NavMenu from '@/components/NavMenu';
import { apiFetch } from '@/lib/api-fetch';

export default function SettingsPage() {
  const { user, profile, loading, emailVerified, refreshProfile } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState<Partial<UserProfile>>({
    callsign: '',
    name: '',
    location: '',
    netManagerCall: '',
    phone: '',
    streetAddress: '',
    city: '',
    state: '',
    zip: '',
    receivingStationName: '',
    qrzUsername: '',
    qrzPassword: '',
  });
  const [dispositionMethods, setDispositionMethods] = useState<string[]>(DEFAULT_DISPOSITION_METHODS);
  const [newMethod, setNewMethod] = useState('');
  const [receivedMethods, setReceivedMethods] = useState<string[]>(DEFAULT_RECEIVED_METHODS);
  const [newReceivedMethod, setNewReceivedMethod] = useState('');
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
  const [newTagAcronym, setNewTagAcronym] = useState('');
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagInReport, setNewTagInReport] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!isDesktop && !loading && (!user || !emailVerified)) {
      router.push('/');
    }
  }, [user, loading, emailVerified, router]);

  const hasQrzCredentials = !!(profile?.qrzUsername && profile?.qrzPassword);

  useEffect(() => {
    if (profile) {
      setFormData({
        callsign: profile.callsign || '',
        name: profile.name || '',
        location: profile.location || '',
        netManagerCall: profile.netManagerCall || '',
        phone: profile.phone || '',
        streetAddress: profile.streetAddress || '',
        city: profile.city || '',
        state: profile.state || '',
        zip: profile.zip || '',
        receivingStationName: profile.receivingStationName || '',
        qrzUsername: profile.qrzUsername || '',
        qrzPassword: '',
      });
      setDispositionMethods(profile.dispositionMethods ?? DEFAULT_DISPOSITION_METHODS);
      setReceivedMethods(profile.receivedMethods ?? DEFAULT_RECEIVED_METHODS);
      setCustomTags(profile.customTags ?? []);
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

    const dataToSave = { ...formData, dispositionMethods, receivedMethods, customTags };

    if (dataToSave.qrzPassword && !isDesktop) {
      try {
        const token = await user.getIdToken();
        const res = await apiFetch('/api/credentials', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ password: dataToSave.qrzPassword }),
        });
        if (!res.ok) throw new Error('Encryption failed');
        const { encrypted } = await res.json();
        dataToSave.qrzPassword = encrypted;
      } catch {
        setMessage({ type: 'error', text: 'Failed to encrypt QRZ password. Please try again.' });
        setSaving(false);
        return;
      }
    } else if (!dataToSave.qrzPassword) {
      delete dataToSave.qrzPassword;
    }

    const success = await updateUserProfile(user.uid, dataToSave);

    if (success) {
      await refreshProfile();
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } else {
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    }

    setSaving(false);
  };

  const isPasswordUser = user?.providerData.some((p) => p.providerId === 'password') ?? false;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPasswordMessage(null);
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setChangingPassword(true);
    const result = await changePassword(user, currentPassword, newPassword);
    setChangingPassword(false);
    if (result.success) {
      setPasswordMessage({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } else {
      setPasswordMessage({ type: 'error', text: result.error || 'Failed to change password.' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!isDesktop && !user) {
    return null;
  }

  return (
    <div>
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">Settings</h1>
            <HeaderBanner />
          </div>
          <div className="flex items-center gap-4">
            <NavMenu helpPage="settings" />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Your Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Your Callsign
                </label>
                <input
                  type="text"
                  name="callsign"
                  value={formData.callsign}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  placeholder="e.g., K3ABC"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Your Name (for radiogram signature)
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g., John"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Location (place of origin)
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g., BALTIMORE MD"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Default Net Manager Callsign
                </label>
                <input
                  type="text"
                  name="netManagerCall"
                  value={formData.netManagerCall}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  placeholder="e.g., W3XYZ"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-1">Receiving Station</h2>
            <p className="text-sm text-slate-600 mb-4">
              Used to complete the &ldquo;This Radio Message Was Received At&rdquo; section of the ARRL radiogram form.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  name="receivingStationName"
                  value={formData.receivingStationName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g., Jane Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g., 410-555-1234"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  name="streetAddress"
                  value={formData.streetAddress}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g., 123 Main St"
                />
              </div>

              <div className="grid grid-cols-6 gap-3">
                <div className="col-span-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="e.g., Baltimore"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="MD"
                    maxLength={2}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ZIP
                  </label>
                  <input
                    type="text"
                    name="zip"
                    value={formData.zip}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="21201"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">QRZ.com Credentials (Optional)</h2>
            <p className="text-sm text-slate-600 mb-4">
              If you have a QRZ.com account, enter your credentials to automatically look up operator names and locations. Without credentials, you can enter this information manually.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  QRZ Username
                </label>
                <input
                  type="text"
                  name="qrzUsername"
                  value={formData.qrzUsername}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Your QRZ username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  QRZ Password
                </label>
                <input
                  type="password"
                  name="qrzPassword"
                  value={formData.qrzPassword}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder={hasQrzCredentials ? 'Password saved (leave blank to keep)' : 'Your QRZ password'}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Sent Methods</h2>
            <p className="text-sm text-slate-600 mb-4">
              Customize the methods available in the Sent section of radiogram forms.
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
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
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
                className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
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
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-300 text-sm"
              >
                Add
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Received Methods</h2>
            <p className="text-sm text-slate-600 mb-4">
              Customize the methods available in the Received section of radiogram forms.
            </p>

            <div className="space-y-2 mb-4">
              {receivedMethods.map((method, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={method}
                    onChange={(e) => {
                      const updated = [...receivedMethods];
                      updated[index] = e.target.value;
                      setReceivedMethods(updated);
                    }}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setReceivedMethods(receivedMethods.filter((_, i) => i !== index))}
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
                value={newReceivedMethod}
                onChange={(e) => setNewReceivedMethod(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = newReceivedMethod.trim();
                    if (trimmed && !receivedMethods.includes(trimmed)) {
                      setReceivedMethods([...receivedMethods, trimmed]);
                      setNewReceivedMethod('');
                    }
                  }
                }}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                placeholder="New method name"
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = newReceivedMethod.trim();
                  if (trimmed && !receivedMethods.includes(trimmed)) {
                    setReceivedMethods([...receivedMethods, trimmed]);
                    setNewReceivedMethod('');
                  }
                }}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-300 text-sm"
              >
                Add
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-1">Quick Tag Buttons</h2>
            <p className="text-sm text-slate-600 mb-4">
              Add shortcut buttons for liaison networks or other tags you use regularly. They appear in the Station check-in bar alongside NC, ANC, T, and A.
            </p>

            <div className="space-y-2 mb-4">
              {customTags.map((tag, index) => (
                <div key={index} className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={tag.acronym}
                    onChange={(e) => {
                      const updated = [...customTags];
                      updated[index] = { ...updated[index], acronym: e.target.value.toUpperCase() };
                      setCustomTags(updated);
                    }}
                    className="w-20 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-mono"
                    placeholder="OC"
                    maxLength={8}
                  />
                  <input
                    type="text"
                    value={tag.label}
                    onChange={(e) => {
                      const updated = [...customTags];
                      updated[index] = { ...updated[index], label: e.target.value };
                      setCustomTags(updated);
                    }}
                    className="flex-1 min-w-40 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                    placeholder="e.g., Orange County Net"
                  />
                  <label className="flex items-center gap-1 text-sm text-slate-600 whitespace-nowrap cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tag.inReport ?? true}
                      onChange={(e) => {
                        const updated = [...customTags];
                        updated[index] = { ...updated[index], inReport: e.target.checked };
                        setCustomTags(updated);
                      }}
                      className="rounded"
                    />
                    In report
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomTags(customTags.filter((_, i) => i !== index))}
                    className="text-red-500 hover:text-red-700 px-2 py-1 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={newTagAcronym}
                onChange={(e) => setNewTagAcronym(e.target.value.toUpperCase())}
                className={`w-20 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-mono ${FIXED_TAG_ACRONYMS.has(newTagAcronym.trim()) ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                placeholder="OC"
                maxLength={8}
              />
              <input
                type="text"
                value={newTagLabel}
                onChange={(e) => setNewTagLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const acronym = newTagAcronym.trim().toUpperCase();
                    const label = newTagLabel.trim();
                    if (acronym && label && !FIXED_TAG_ACRONYMS.has(acronym) && !customTags.some(t => t.acronym === acronym)) {
                      setCustomTags([...customTags, { acronym, label, inReport: newTagInReport }]);
                      setNewTagAcronym('');
                      setNewTagLabel('');
                      setNewTagInReport(true);
                    }
                  }
                }}
                className="flex-1 min-w-40 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                placeholder="New tag label"
              />
              <label className="flex items-center gap-1 text-sm text-slate-600 whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTagInReport}
                  onChange={(e) => setNewTagInReport(e.target.checked)}
                  className="rounded"
                />
                In report
              </label>
              <button
                type="button"
                onClick={() => {
                  const acronym = newTagAcronym.trim().toUpperCase();
                  const label = newTagLabel.trim();
                  if (acronym && label && !FIXED_TAG_ACRONYMS.has(acronym) && !customTags.some(t => t.acronym === acronym)) {
                    setCustomTags([...customTags, { acronym, label, inReport: newTagInReport }]);
                    setNewTagAcronym('');
                    setNewTagLabel('');
                    setNewTagInReport(true);
                  }
                }}
                disabled={FIXED_TAG_ACRONYMS.has(newTagAcronym.trim())}
                className="bg-slate-200 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            {FIXED_TAG_ACRONYMS.has(newTagAcronym.trim()) && (
              <p className="mt-2 text-sm text-red-600">{newTagAcronym.trim()} is a built-in tag and cannot be redefined.</p>
            )}
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
            className="w-full bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>

        {isPasswordUser && !isDesktop && (
          <form onSubmit={handleChangePassword} className="mt-6 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Change Password</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="At least 6 characters"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
              </div>

              {passwordMessage && (
                <div
                  className={`mt-4 p-4 rounded-md ${
                    passwordMessage.type === 'success'
                      ? 'bg-green-50 text-green-800'
                      : 'bg-red-50 text-red-800'
                  }`}
                >
                  {passwordMessage.text}
                </div>
              )}

              <button
                type="submit"
                disabled={changingPassword}
                className="mt-4 w-full bg-cyan-700 text-white py-2 px-4 rounded-md hover:bg-cyan-900 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
              >
                {changingPassword ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
