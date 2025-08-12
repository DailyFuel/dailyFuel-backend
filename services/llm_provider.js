import OpenAI from 'openai';
import dotenv from 'dotenv';
import LlmUsage from '../models/llm_usage.js';
dotenv.config();

// Minimal LLM wrapper to keep provider pluggable
export function getLLM() {
  const apiKey = process.env.OPEN_AI_SECRET_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null; // LLM is optional; callers must handle null and skip LLM features
  const client = new OpenAI({ apiKey });

  // Lazy import to avoid startup error if not configured
  const fetcher = async (input) => {
    const model = process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || process.env.LLM_MODEL || 'gpt-4o-mini';
    const payload = {
      model,
      messages: [
        { role: 'system', content: input?.system || 'You are an expert habit coach.' },
        { role: 'user', content: input?.user || (typeof input === 'string' ? input : '') },
      ],
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    };
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000 + Math.random() * 2_000);
        const response = await client.chat.completions.create(payload, { signal: controller.signal });
        clearTimeout(timeout);
        const text = response?.choices?.[0]?.message?.content?.trim?.() || '';
        const usage = response?.usage || {};
        // Persist usage for observability
        try {
          await LlmUsage.create({
            model,
            promptTokens: usage?.prompt_tokens || null,
            completionTokens: usage?.completion_tokens || null,
            totalTokens: usage?.total_tokens || null,
            context: input?.context || null,
          });
        } catch {}
        try { return JSON.parse(text); } catch { return text ? { summary: text } : null; }
      } catch (e) {
        const isLast = attempt === maxAttempts;
        const jitter = 250 * attempt + Math.floor(Math.random() * 250);
        if (isLast) {
          console.warn('LLM call failed', e?.message);
          return null;
        }
        await new Promise(r => setTimeout(r, jitter));
      }
    }
    return null;
  };

  return fetcher;
}

