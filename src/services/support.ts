/**
 * Support service — MOCK. `sendFeedback` waits and succeeds. To go live, post to your help desk
 * (or backend) here; the Help screen only uses this function.
 */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendFeedback(input: { email: string; message: string; device?: string }): Promise<void> {
  await wait(900);
  if (input.message.trim().length < 10) throw new Error('Tell us a little more (10+ characters).');
}
