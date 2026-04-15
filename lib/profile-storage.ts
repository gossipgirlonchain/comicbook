/**
 * Client-side profile storage shim.
 *
 * TODO: replace with real persistence once the DB decision is made.
 * Candidates: Privy user metadata, Vercel KV, Postgres, or a
 * CollectorCrypt-provided endpoint. Until then we use localStorage so
 * the editor UX is testable end-to-end.
 *
 * Keyed by wallet address so multiple wallets on the same browser don't
 * collide.
 */

export type UserProfile = {
  username: string | null;
  avatarDataUrl: string | null;
};

const KEY = (address: string) => `cb-profile:${address}`;

export function readProfile(address: string): UserProfile {
  if (typeof window === 'undefined') {
    return { username: null, avatarDataUrl: null };
  }
  try {
    const raw = localStorage.getItem(KEY(address));
    if (!raw) return { username: null, avatarDataUrl: null };
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      username: parsed.username ?? null,
      avatarDataUrl: parsed.avatarDataUrl ?? null,
    };
  } catch {
    return { username: null, avatarDataUrl: null };
  }
}

export function writeProfile(address: string, profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY(address), JSON.stringify(profile));
  } catch {
    /* quota exceeded or disabled */
  }
}

/** Lightweight username validation. */
export function validateUsername(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 3) return 'Username must be at least 3 characters.';
  if (trimmed.length > 20) return 'Username must be 20 characters or fewer.';
  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return 'Only letters, numbers, and _.- are allowed.';
  }
  return null;
}

/** Resize an image file to a data URL capped at 256x256 to keep storage small. */
export function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Image must be under 5MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image.'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported.'));
          return;
        }
        // cover-fit crop
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
