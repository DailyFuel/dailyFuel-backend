import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

// Minimal LLM wrapper to keep provider pluggable
export function getLLM() {
  const apiKey = process.env.OPEN_AI_SECRET_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const client = new OpenAI({ apiKey });

  // Lazy import to avoid startup error if not configured
  const fetcher = async (input) => {
    try {
      const model = process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || process.env.LLM_MODEL || 'gpt-4o-mini';
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: input?.system || 'You are an expert habit coach.' },
          { role: 'user', content: input?.user || (typeof input === 'string' ? input : '') },
        ],
        temperature: 0.7,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      });
      const text = response?.choices?.[0]?.message?.content?.trim?.() || '';
      // Try JSON parse if model respected the schema
      try {
        return JSON.parse(text);
      } catch {
        return text ? { summary: text } : null;
      }
    } catch (e) {
      console.warn('LLM call failed', e?.message);
      return null;
    }
  };

  return fetcher;
}

