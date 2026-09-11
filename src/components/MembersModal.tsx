import React, { useState, useEffect } from 'react';
import { X, Users, UserPlus, Mail, Shield, Check, Copy, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { authClient } from '../lib/auth-client';
import { useCachedAvatar } from '../lib/avatar-cache';

function CachedMemberAvatar({ user }: { user: any }) {
  const cachedSrc = useCachedAvatar(user?.image);
  if (cachedSrc) {
    return (
      <img
        src={cachedSrc}
        alt=""
        referrerPolicy="no-referrer"
        className="w-7 h-7 rounded-full object-cover border border-zinc-200 shrink-0"
      />
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-bold text-zinc-700 text-[11px] shrink-0">
      {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
    </div>
  );
}

interface MembersModalProps {
  isOpen: boolean;
  activeOrgId: string | null;
  currentUserRole: 'read' | 'write';
  currentUserEmail?: string;
  onClose: () => void;
}

export default function MembersModal({
  isOpen,
  activeOrgId,
  currentUserRole,
  currentUserEmail,
  onClose
}: MembersModalProps) {
  const [orgData, setOrgData] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'read' | 'write'>('read');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeOrgId) {
      loadOrg();
    }
  }, [isOpen, activeOrgId]);

  const loadOrg = async () => {
    setLoading(true);
    setInviteError(null);
    try {
      const res = await authClient.organization.getFullOrganization({ query: {} } as any);
      if (res.data) {
        setOrgData(res.data);
        setMembers(res.data.members || []);
        setInvitations(res.data.invitations || []);
      }
    } catch (e: any) {
      setInviteError(e?.message || 'Failed to load organization');
    }
    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeOrgId) return;

    setInviting(true);
    setInviteError(null);
    setLastInviteLink(null);
    try {
      const res = await authClient.organization.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole,
        organizationId: activeOrgId,
        resend: true,
      } as any);

      if (res.error) {
        setInviteError(res.error.message || 'Failed to send invitation');
      } else {
        const invId = res.data?.id;
        if (invId) {
          const link = `${window.location.origin}/?invitation_id=${invId}`;
          setLastInviteLink(link);
        }
        setInviteEmail('');
        await loadOrg();
      }
    } catch (e: any) {
      setInviteError(e?.message || 'Failed to invite user');
    }
    setInviting(false);
  };

  const handleCancelInvite = async (invitationId: string) => {
    try {
      await authClient.organization.cancelInvitation({ invitationId });
      await loadOrg();
    } catch (e: any) {
      setInviteError(e?.message || 'Failed to cancel invitation');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const canManage = currentUserRole === 'write';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 text-sm font-sans">
                {orgData?.name || 'Workspace'} Members
              </h3>
              <p className="text-[11px] text-zinc-500 font-mono">
                Your role: <span className="font-semibold text-zinc-800 uppercase">{currentUserRole}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-6 text-xs">
          {/* Invite Section */}
          {canManage ? (
            <div className="bg-zinc-50/70 p-4 rounded-xl border border-zinc-200/80 space-y-3">
              <div className="flex items-center gap-2 font-medium text-zinc-800 font-sans text-xs">
                <UserPlus className="w-3.5 h-3.5 text-zinc-600" />
                <span>Invite to workspace</span>
              </div>

              {inviteError && (
                <div className="flex items-center gap-2 p-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{inviteError}</span>
                </div>
              )}

              {lastInviteLink && (
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-emerald-900 font-semibold text-xs font-sans">Direct Invite Link Created</p>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">No email server required</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 font-sans leading-relaxed">
                    Share this link directly via Slack, Teams, WhatsApp, or email. The recipient will sign in with their Google or Google Workspace account to accept.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={lastInviteLink}
                      className="flex-1 px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-[11px] font-mono text-zinc-800 select-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(lastInviteLink)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleInvite} className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
                    <input
                      type="email"
                      required
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      className="w-full pl-8.5 pr-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
                    />
                  </div>

                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as 'read' | 'write')}
                    className="px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  >
                    <option value="read">Read (Viewer)</option>
                    <option value="write">Write (Editor)</option>
                  </select>

                  <button
                    type="submit"
                    disabled={inviting || !inviteEmail.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-medium rounded-lg transition-colors font-sans text-xs"
                  >
                    {inviting ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                    <span>Invite</span>
                  </button>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-zinc-500 font-mono">
                  <span>• <strong>read</strong>: View, search, and inspect logs</span>
                  <span>• <strong>write</strong>: Create projects, services, & invite</span>
                </div>

                {/* Google Account Requirement Notice */}
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/70 border border-blue-200/70 rounded-lg text-[11px] text-blue-900 font-sans">
                  <svg className="w-3.5 h-3.5 shrink-0" aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
                    <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
                    <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
                    <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26537 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
                  </svg>
                  <span>
                    Note: The recipient will need a <strong>Google Account</strong> or <strong>Google Workspace account</strong> (@company.com) to sign in, as CalmLogs only supports login/signup via Google.
                  </span>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-zinc-600 text-[11px] font-mono">
              You have read-only access to this workspace. Only members with write permissions can invite others.
            </div>
          )}

          {/* Members List */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">
              Members ({members.length})
            </h4>

            {loading ? (
              <div className="py-6 flex justify-center text-zinc-400 font-mono text-xs">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span>Loading members...</span>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-lg overflow-hidden bg-white">
                {members.map(m => {
                  const roleNormalized = m.role === 'owner' ? 'write' : m.role;
                  const isYou = m.user?.email === currentUserEmail;

                  return (
                    <div key={m.id} className="p-3 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <CachedMemberAvatar user={m.user} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-zinc-900 font-sans">{m.user?.name || 'User'}</span>
                            {isYou && (
                              <span className="px-1.5 py-0.2 bg-zinc-100 text-zinc-600 rounded text-[9px] font-mono font-medium">
                                you
                              </span>
                            )}
                          </div>
                          <p className="text-zinc-500 font-mono text-[11px]">{m.user?.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                            roleNormalized === 'write'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                          }`}
                        >
                          {roleNormalized}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">
                Pending Invitations ({invitations.length})
              </h4>

              <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-lg overflow-hidden bg-white">
                {invitations.map(inv => {
                  const directLink = `${window.location.origin}/?invitation_id=${inv.id}`;

                  return (
                    <div key={inv.id} className="p-3 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                      <div>
                        <p className="font-semibold text-zinc-900 font-mono">{inv.email}</p>
                        <p className="text-zinc-400 text-[10px] font-mono">
                          Role: <strong className="uppercase text-zinc-700">{inv.role || 'read'}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(directLink)}
                          title="Copy shareable invitation link"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-zinc-700 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 rounded-md border border-zinc-200 transition-colors shadow-xs"
                        >
                          <Copy className="w-3 h-3 text-zinc-500" />
                          <span>Copy Link</span>
                        </button>

                        {canManage && (
                          confirmingCancelId === inv.id ? (
                            <div className="flex items-center gap-1 text-[11px] font-mono animate-in fade-in">
                              <span className="text-rose-600 font-medium">Revoke?</span>
                              <button
                                type="button"
                                onClick={() => {
                                  handleCancelInvite(inv.id);
                                  setConfirmingCancelId(null);
                                }}
                                className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-medium transition-colors"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmingCancelId(null)}
                                className="px-1.5 py-0.5 text-zinc-600 hover:text-zinc-900 rounded text-[10px] transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmingCancelId(inv.id)}
                              title="Cancel invitation"
                              className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors font-sans"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
