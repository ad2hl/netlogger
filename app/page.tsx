'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

const isDesktop = process.env.NEXT_PUBLIC_DESKTOP_MODE === 'true';
import ReactMarkdown from 'react-markdown';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  sendPasswordReset,
  resendVerificationEmail,
  signOut,
} from '@/lib/auth';
import { apiFetch } from '@/lib/api-fetch';
import Image from 'next/image';

type Tab = 'signin' | 'signup';
type View = 'auth' | 'forgot' | 'verify';

const signupDisabled = process.env.NEXT_PUBLIC_DISABLE_SIGNUP === 'true';

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default function Home() {
  const { user, loading, emailVerified, refreshUser } = useAuth();
  const router = useRouter();

  // Desktop mode: no sign-in needed — redirect immediately
  useEffect(() => {
    if (isDesktop) {
      router.replace('/sessions');
    }
  }, [router]);

  if (isDesktop) {
    return null;
  }

  const [tab, setTab] = useState<Tab>('signin');
  const [view, setView] = useState<View>('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bannerContent, setBannerContent] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/login-background')
      .then((res) => {
        if (res.ok) return res.blob();
        return null;
      })
      .then((blob) => {
        if (blob) setBgUrl(URL.createObjectURL(blob));
      })
      .catch(() => {});

    apiFetch('/api/login-banner')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.content) setBannerContent(data.content);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && user && emailVerified) {
      router.push('/home');
    }
    if (!loading && user && !emailVerified) {
      setView('verify');
    }
  }, [user, loading, emailVerified, router]);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setSubmitting(true);
    const result = await signInWithEmail(email, password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    const result = await signUpWithEmail(email, password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    }
  };

  const handleGoogleSignIn = async () => {
    clearMessages();
    setSubmitting(true);
    const result = await signInWithGoogle();
    setSubmitting(false);
    if (!result.user) {
      setError(result.error || 'Google sign-in failed. Please try again.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setSubmitting(true);
    const result = await sendPasswordReset(email);
    setSubmitting(false);
    if (result.success) {
      setSuccess('Password reset email sent. Check your inbox.');
    } else if (result.error) {
      setError(result.error);
    }
  };

  const handleResendVerification = async () => {
    clearMessages();
    if (!user) return;
    setSubmitting(true);
    const result = await resendVerificationEmail(user);
    setSubmitting(false);
    if (result.success) {
      setSuccess('Verification email sent. Check your inbox.');
    } else if (result.error) {
      setError(result.error);
    }
  };

  const handleCheckVerification = async () => {
    clearMessages();
    if (!user) return;
    setSubmitting(true);
    await refreshUser();
    setSubmitting(false);
    if (user.emailVerified) {
      router.push('/home');
    } else {
      setError('Email not yet verified. Please check your inbox and click the verification link.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setView('auth');
    setTab('signin');
    clearMessages();
  };

  const bgStyle = bgUrl
    ? { backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
        {bgUrl && <div className="absolute inset-0 bg-black/40" />}
        <div className="text-lg text-slate-600 relative">Loading...</div>
      </div>
    );
  }

  // Email verification screen
  if (view === 'verify' && user) {
    return (
      <div className="flex-1 flex items-center justify-center relative" style={bgStyle}>
        {bgUrl && <div className="absolute inset-0 bg-black/40" />}
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 relative z-10">
          <h1 className="text-3xl font-bold text-center mb-2">AD2HL Net Logger</h1>
          <h2 className="text-lg font-semibold text-center mb-4">Verify Your Email</h2>
          <p className="text-slate-600 text-center mb-4">
            A verification email has been sent to <strong>{user.email}</strong>.
            Please click the link in the email to verify your account.
          </p>
          <p className="text-slate-500 text-center text-sm mb-6">
            If you don&apos;t see it, check your spam or junk folder.
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {success}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleCheckVerification}
              disabled={submitting}
              className="w-full bg-cyan-700 text-white rounded-lg py-3 px-4 hover:bg-cyan-900 transition-colors disabled:opacity-50"
            >
              I&apos;ve Verified My Email
            </button>
            <button
              onClick={handleResendVerification}
              disabled={submitting}
              className="w-full bg-white border border-slate-300 text-slate-700 rounded-lg py-3 px-4 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Resend Verification Email
            </button>
            <button
              onClick={handleSignOut}
              className="w-full text-slate-500 text-sm hover:text-slate-700 py-2"
            >
              Sign Out
            </button>
          </div>
        </div>
        {bannerContent && (
          <div className="max-w-md w-full mx-4 mt-4 relative z-10 bg-amber-50 border border-amber-200 rounded-lg px-6 py-4 text-sm text-amber-900">
            {bannerContent}
          </div>
        )}
      </div>
    );
  }

  // Forgot password view
  if (view === 'forgot') {
    return (
      <div className="flex-1 flex items-center justify-center relative" style={bgStyle}>
        {bgUrl && <div className="absolute inset-0 bg-black/40" />}
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 relative z-10">
          <h1 className="text-3xl font-bold text-center mb-2">AD2HL Net Logger</h1>
          <h2 className="text-lg font-semibold text-center mb-4">Reset Password</h2>
          <p className="text-slate-600 text-center mb-6">
            Enter your email and we&apos;ll send you a reset link.
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-cyan-700 text-white rounded-lg py-3 px-4 hover:bg-cyan-900 transition-colors disabled:opacity-50"
            >
              Send Reset Email
            </button>
          </form>

          <button
            onClick={() => { setView('auth'); clearMessages(); }}
            className="w-full text-slate-500 text-sm hover:text-slate-700 py-2 mt-4"
          >
            Back to Sign In
          </button>
        </div>
        {bannerContent && (
          <div className="max-w-md w-full mx-4 mt-4 relative z-10 bg-amber-50 border border-amber-200 rounded-lg px-6 py-4 text-sm text-amber-900">
            {bannerContent}
          </div>
        )}
      </div>
    );
  }

  // Main auth view (sign in / sign up tabs)
  return (
    <div className="flex-1 flex items-center justify-center relative" style={bgStyle}>
      {bgUrl && <div className="absolute inset-0 bg-black/40" />}
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 relative z-10">
        <div className="flex items-center justify-center gap-3" style={{ marginBottom: '23px' }}>
          <Image src="/icon.png" alt="NetLogger icon" width={40} height={40} />
          <h1 className="text-3xl font-bold">AD2HL Net Logger</h1>
        </div>
        {/* Tabs */}
        {signupDisabled ? (
          <div className="border-b border-slate-200 mb-6 pb-3">
            <span className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-3">
              Sign In
            </span>
          </div>
        ) : (
          <div className="flex border-b border-slate-200 mb-6">
            <button
              onClick={() => { setTab('signin'); clearMessages(); }}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === 'signin'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('signup'); clearMessages(); }}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === 'signup'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {success}
          </div>
        )}

        {/* Sign In Form */}
        {tab === 'signin' && (
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label htmlFor="signin-email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label htmlFor="signin-password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="signin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-cyan-700 text-white rounded-lg py-3 px-4 hover:bg-cyan-900 transition-colors disabled:opacity-50"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setView('forgot'); clearMessages(); }}
              className="w-full text-sm text-blue-600 hover:text-blue-800"
            >
              Forgot password?
            </button>
          </form>
        )}

        {/* Sign Up Form */}
        {tab === 'signup' && (
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="At least 6 characters"
                required
              />
            </div>
            <div>
              <label htmlFor="signup-confirm" className="block text-sm font-medium text-slate-700 mb-1">
                Confirm Password
              </label>
              <input
                id="signup-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Confirm your password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-cyan-700 text-white rounded-lg py-3 px-4 hover:bg-cyan-900 transition-colors disabled:opacity-50"
            >
              Create Account
            </button>
          </form>
        )}

        {/* Divider and Google Sign In */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-slate-200" />
          <span className="px-4 text-sm text-slate-400">OR</span>
          <div className="flex-1 border-t border-slate-200" />
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 rounded-lg py-3 px-4 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <GoogleIcon />
          <span className="text-slate-700 font-medium">
            Sign in with Google
          </span>
        </button>

        {signupDisabled ? (
          <p className="text-sm text-slate-500 text-center mt-6">
            Account creation is disabled. Contact an administrator.
          </p>
        ) : (
          <p className="text-sm text-slate-500 text-center mt-6">
            Track check-ins, manage traffic, and generate net reports
          </p>
        )}
      </div>
      {bannerContent && (
        <div className="max-w-md w-full mx-4 mt-4 relative z-10 bg-amber-50 border border-amber-200 rounded-lg px-6 py-4 text-sm text-amber-900 prose prose-sm prose-amber">
          <ReactMarkdown>{bannerContent}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
