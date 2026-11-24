/** Profile edits, backed by the API (PATCH /me). */
import { api } from '@/api/client';
import type { ApiUser } from '@/api/types';
import { setUser, userFromApi } from '@/data/session';

export async function updateProfile(patch: { name?: string; company?: string }) {
  const res = await api<{ user: ApiUser }>('/me', { method: 'PATCH', body: patch });
  setUser(userFromApi(res.user));
}
