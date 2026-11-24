/** Help-screen feedback, saved by the API (POST /support/feedback). */
import { api } from '@/api/client';

export async function sendFeedback(input: { email: string; message: string; device?: string }): Promise<void> {
  await api('/support/feedback', { method: 'POST', body: { message: input.message.trim(), email: input.email.trim() || undefined, device: input.device } });
}
