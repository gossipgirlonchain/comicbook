'use client';

import * as React from 'react';
import {
  fileToAvatarDataUrl,
  validateUsername,
  writeProfile,
  type UserProfile,
} from '@/lib/profile-storage';

type Props = {
  address?: string;
  profile: UserProfile;
  onProfileChange: (next: UserProfile) => void;
  rank: number | null;
};

export default function ProfileIdentity({
  address,
  profile,
  onProfileChange,
  rank,
}: Props) {
  const [editing, setEditing] = React.useState(false);
  const [draftUsername, setDraftUsername] = React.useState(
    profile.username ?? ''
  );
  const [draftAvatar, setDraftAvatar] = React.useState<string | null>(
    profile.avatarDataUrl
  );
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDraftUsername(profile.username ?? '');
    setDraftAvatar(profile.avatarDataUrl);
  }, [profile.username, profile.avatarDataUrl]);

  const startEdit = () => {
    setError(null);
    setDraftUsername(profile.username ?? '');
    setDraftAvatar(profile.avatarDataUrl);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
    setDraftUsername(profile.username ?? '');
    setDraftAvatar(profile.avatarDataUrl);
  };

  const save = () => {
    if (!address) return;
    const trimmed = draftUsername.trim();
    if (trimmed) {
      const err = validateUsername(trimmed);
      if (err) {
        setError(err);
        return;
      }
    }
    const next: UserProfile = {
      username: trimmed || null,
      avatarDataUrl: draftAvatar,
    };
    writeProfile(address, next);
    onProfileChange(next);
    setEditing(false);
    setError(null);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setDraftAvatar(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAvatar = () => setDraftAvatar(null);

  const displayName =
    profile.username ||
    (address
      ? `${address.slice(0, 6)}...${address.slice(-6)}`
      : 'Profile');

  const avatarSrc = (editing ? draftAvatar : profile.avatarDataUrl) || null;

  return (
    <div className="rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-[var(--cb-primary)] flex items-center justify-center overflow-hidden border-2 border-[var(--cb-border)]">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/cb-bug-yellow.png"
                alt=""
                className="w-9 h-9"
              />
            )}
          </div>
          {editing && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-accent-text)] flex items-center justify-center shadow-md disabled:opacity-50"
              title="Upload avatar"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16v4a1 1 0 001 1h16a1 1 0 001-1v-4M16 8l-4-4m0 0l-4 4m4-4v12"
                />
              </svg>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={draftUsername}
                onChange={(e) => setDraftUsername(e.target.value)}
                placeholder="Username"
                maxLength={20}
                className="w-full max-w-xs h-9 px-3 rounded-lg border border-[var(--cb-border)] bg-[var(--cb-bg)] text-[var(--cb-text)] text-sm focus:outline-none focus:border-[var(--cb-accent)]"
                autoFocus
              />
              {draftAvatar && (
                <button
                  onClick={removeAvatar}
                  className="text-[10px] text-[var(--cb-text-muted)] hover:text-[var(--cb-error)] underline transition-colors"
                >
                  Remove avatar
                </button>
              )}
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold">{displayName}</h1>
              {address && (
                <p className="text-[10px] font-mono text-[var(--cb-text-muted)] truncate mt-0.5">
                  {address}
                </p>
              )}
            </>
          )}
          {error && (
            <p className="text-xs text-[var(--cb-error)] mt-1">{error}</p>
          )}
        </div>

        {/* Actions + rank */}
        <div className="flex items-center gap-3">
          {rank && !editing && (
            <div className="text-right">
              <span className="text-xs text-[var(--cb-text-muted)] uppercase tracking-wider">
                Rank
              </span>
              <p className="text-2xl font-bold text-[var(--cb-accent)]">
                #{rank}
              </p>
            </div>
          )}
          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={cancelEdit}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg border border-[var(--cb-border)] text-xs font-semibold text-[var(--cb-text-muted)] hover:text-[var(--cb-text)] hover:bg-[var(--cb-surface-hover)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-accent-text)] text-xs font-bold transition-colors disabled:opacity-50"
              >
                {busy ? 'Loading...' : 'Save'}
              </button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              disabled={!address}
              className="px-3 py-1.5 rounded-lg border border-[var(--cb-border)] text-xs font-semibold text-[var(--cb-text-muted)] hover:text-[var(--cb-text)] hover:bg-[var(--cb-surface-hover)] transition-colors disabled:opacity-40"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Stored-locally notice */}
      {editing && (
        <p className="text-[10px] text-[var(--cb-text-muted)] mt-3 italic">
          Profile is stored locally on this device until the team picks a backend.
        </p>
      )}
    </div>
  );
}
