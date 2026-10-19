import { apiBaseUrl } from './http';

export type ImageKind = 'avatar' | 'storefront' | 'listing';

export const uploadService = {
  async image(file: File, kind: ImageKind): Promise<{ url: string; path: string }> {
    const response = await fetch(`${apiBaseUrl}/uploads/${kind}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': file.type, Accept: 'application/json' },
      body: file,
    });
    const payload = await response.json().catch(() => undefined) as { url?: string; path?: string; message?: string } | undefined;
    if (!response.ok || !payload?.url || !payload.path) throw new Error(payload?.message || 'Could not upload this image.');
    return { url: payload.url.startsWith('http') ? payload.url : `${apiBaseUrl}${payload.url}`, path: payload.path };
  },
};
