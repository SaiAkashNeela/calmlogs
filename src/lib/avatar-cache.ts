import { useState, useEffect } from 'react';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

interface CachedAvatarRecord {
  dataUrl: string;
  cachedAt: number;
}

/**
 * Retrieves a Google or external profile picture from localStorage cache.
 * Automatically refreshes the cache if older than 7 days.
 */
export async function getCachedAvatar(url: string): Promise<string> {
  if (!url) return '';
  const cacheKey = `calmlogs_avatar_${encodeURIComponent(url.split('?')[0])}`;

  let existingRecord: CachedAvatarRecord | null = null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      existingRecord = JSON.parse(raw);
      if (existingRecord && Date.now() - existingRecord.cachedAt < ONE_WEEK_MS && existingRecord.dataUrl) {
        return existingRecord.dataUrl;
      }
    }
  } catch {}

  // Fetch and cache for 1 week
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Avatar fetch failed: ${res.status}`);
    const blob = await res.blob();

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        dataUrl,
        cachedAt: Date.now()
      }));
    } catch {
      // Storage quota or private mode protection
    }

    return dataUrl;
  } catch {
    // If offline or network issue, fallback to existing stale cache or original URL
    return existingRecord?.dataUrl || url;
  }
}

/**
 * React hook to transparently load and cache a user profile picture for 1 week.
 */
export function useCachedAvatar(url?: string | null): string | null {
  const [cachedSrc, setCachedSrc] = useState<string | null>(url || null);

  useEffect(() => {
    if (!url) {
      setCachedSrc(null);
      return;
    }

    let isMounted = true;
    getCachedAvatar(url).then(src => {
      if (isMounted) {
        setCachedSrc(src);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [url]);

  return cachedSrc;
}
