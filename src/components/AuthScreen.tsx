import React, { useState } from 'react';
import { authClient } from '../lib/auth-client';
import { Activity, Loader2 } from 'lucide-react';

export default function AuthScreen({ onLogin }: { onLogin: () => void }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: window.location.origin
      });
    } catch (e: any) {
      setError(e.message || "Google sign in failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-sm border border-zinc-100">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center mb-6 shadow-sm">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900">
            Sign in to CalmLogs
          </h2>
          <p className="mt-2 text-center text-sm text-zinc-500">
            Realtime observability & distributed log streaming
          </p>
        </div>

        {error && (
          <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-800 shadow-sm ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 hover:ring-zinc-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
                <span>Redirecting to Google...</span>
              </>
            ) : (
              <>
                <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
                  <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
                  <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
                  <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26537 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-zinc-400">
          Sign in or create an account with your Google identity.
        </p>
      </div>
    </div>
  );
}
