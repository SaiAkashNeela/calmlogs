import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { authClient } from '../lib/auth-client';

interface DeleteAccountModalProps {
  isOpen: boolean;
  userEmail?: string;
  onClose: () => void;
}

export default function DeleteAccountModal({ isOpen, userEmail, onClose }: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        throw new Error('Failed to delete account');
      }

      await authClient.signOut({} as any);
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Error deleting account');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white text-zinc-900 rounded-2xl shadow-2xl border border-rose-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-rose-100 bg-rose-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-rose-950 text-sm font-sans">Delete Account</h3>
              <p className="text-[10px] text-rose-700 font-mono">Irreversible Action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 font-mono text-xs">
          <p className="text-zinc-600 leading-relaxed font-sans text-xs">
            This will permanently delete your CalmLogs user account associated with{' '}
            <strong className="text-zinc-900 font-semibold">{userEmail}</strong>. All active sessions will be terminated immediately.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Type <span className="text-rose-600 font-bold">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 outline-none focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-200 transition-all font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || confirmText !== 'DELETE'}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold font-sans text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all shadow-xs"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Permanently Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
