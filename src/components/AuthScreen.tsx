import React, { useState } from 'react';
import { authClient } from '../lib/auth-client';
import { Activity, Loader2, ShieldCheck } from 'lucide-react';

/* Hallmark · component: AuthScreen · genre: modern-minimal · theme: Workbench Light
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */
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
      setError(e.message || "Google authentication failed. Check credentials.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fbfbfa] text-zinc-900 py-12 px-4 sm:px-6 lg:px-8 selection:bg-zinc-200">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl border border-zinc-200 shadow-xl shadow-zinc-200/50">
        
        {/* Brand Lockup */}
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="CalmLogs" className="w-14 h-14 object-contain rounded-2xl mb-4 shadow-sm" />
          <h1 className="text-2xl font-bold font-sans tracking-tight text-zinc-900">
            CalmLogs Console
          </h1>
          <p className="mt-1.5 text-xs text-zinc-500 font-mono">
            High-density telemetry & distributed log streaming
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-mono">
            {error}
          </div>
        )}

        {/* Primary Google Auth */}
        <div className="space-y-4 pt-2">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-white hover:bg-zinc-50 active:translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 border border-zinc-300 text-zinc-900 px-4 py-3 text-sm font-sans font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-zinc-900" />
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

        {/* Security badge */}
        <div className="pt-4 border-t border-zinc-100 flex items-center justify-center gap-2 text-[11px] font-mono text-zinc-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>OAuth 2.0 secured · Zero password storage</span>
        </div>
      </div>
    </div>
  );
}
