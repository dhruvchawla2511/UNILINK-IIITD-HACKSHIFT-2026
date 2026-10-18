import { HttpError } from './rest.js';

const MAX_QUESTION = 1800;
const MAX_HISTORY = 8;
const SYSTEM_PROMPT = `You are UniLink Assistant, a friendly and practical helper inside a college community platform. Help with campus life, study planning, events, community features, student safety, and general questions. Be concise, clear, and honest. Do not claim to have accessed a student's private data or live campus records unless supplied in the conversation. For urgent safety concerns, recommend contacting campus staff or local emergency services. Never ask for passwords, verification codes, or payment credentials.`;

export async function answerWithAI(body) {
  const question = String(body?.question ?? '').trim().slice(0, MAX_QUESTION);
  if (!question) throw new HttpError('Enter a question first', 400);
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new HttpError('AI is not configured yet. Add AI_API_KEY (or OPENAI_API_KEY) to your server environment; the built-in assistant can still answer common UniLink questions.', 503);
  const base = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  const history = Array.isArray(body?.messages) ? body.messages.slice(-MAX_HISTORY).map((m) => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: String(m?.content ?? '').slice(0, MAX_QUESTION),
  })).filter((m) => m.content) : [];
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content: question }];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.5, max_tokens: 2048 }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Log the provider's real reason in the server console (never sent to the browser), so a wrong key or model name is easy to spot.
      console.error(`[assistant] ${base} answered ${response.status}:`, JSON.stringify(payload?.error ?? payload ?? '').slice(0, 400));
      const status = response.status === 429 ? 429 : 502;
      throw new HttpError(response.status === 429 ? 'The AI service is busy. Please try again shortly.' : 'The AI service could not answer just now. Check the server AI configuration and try again.', status);
    }
    const text = String(payload?.choices?.[0]?.message?.content ?? '').trim();
    if (!text) throw new HttpError('The AI service returned an empty answer. Please try again.', 502);
    return { data: { answer: text.slice(0, 7000), model, provider: 'ai' } };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error?.name === 'AbortError') throw new HttpError('The AI request timed out. Please try again.', 504);
    throw new HttpError('Could not connect to the AI service. Check your connection and AI provider settings.', 502);
  } finally {
    clearTimeout(timeout);
  }
}
