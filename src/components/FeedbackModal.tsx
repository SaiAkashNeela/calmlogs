import React, { useState } from 'react';
import { X, HelpCircle, Send, CheckCircle2, MessageSquare, BookOpen } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  userEmail?: string;
  onClose: () => void;
}

export default function FeedbackModal({ isOpen, userEmail, onClose }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState('');
  const [category, setCategory] = useState('feedback');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      setFeedback('');
      setSubmitted(false);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white text-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
              <HelpCircle className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 text-sm font-sans">Feedback & Help</h3>
              <p className="text-[10px] text-zinc-500 font-mono">CalmLogs Support & Community</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 flex flex-col items-center text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 animate-in zoom-in-90 duration-200" />
            <h4 className="font-sans font-semibold text-zinc-900">Feedback received</h4>
            <p className="text-xs text-zinc-500 font-mono">Thank you! Your feedback helps improve CalmLogs.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 font-mono">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                Topic
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-800 outline-none focus:bg-white focus:border-zinc-500 transition-all"
              >
                <option value="feedback">General Feedback & Ideas</option>
                <option value="bug">Report an Issue / Bug</option>
                <option value="help">Question about Ingestion & SDK</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                Your Note
              </label>
              <textarea
                required
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Describe your issue or suggest an improvement..."
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-400 outline-none focus:bg-white focus:border-zinc-500 transition-all font-sans resize-none"
              />
            </div>

            {userEmail && (
              <p className="text-[10px] text-zinc-400">
                Submitting as <span className="text-zinc-700 font-medium">{userEmail}</span>
              </p>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
              <div className="flex items-center gap-3 text-zinc-500 text-xs">
                <a
                  href="https://ai.google.dev"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-zinc-900 flex items-center gap-1 text-[11px]"
                >
                  <BookOpen className="w-3 h-3" /> Docs
                </a>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!feedback.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold font-sans text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all shadow-xs"
                >
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
