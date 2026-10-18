// server/ai.js
import { Ollama } from 'ollama';

const LANG_NAMES = { en: 'English', zh: 'Simplified Chinese', ms: 'Malay', ta: 'Tamil' };

// Create an instance connecting to your local Ollama server
const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434' });

export const aiEnabled = () => true; // Always enabled since it's running locally

export async function explainWithAI(text, ruleResult = {}, lang = 'en') {
  const prompt = `You are KakiGuard, an expert AI scam detector protecting people in Singapore from phone scams, phishing, and fraud.

Analyze the following live call transcript / message:
"""${text.slice(0, 3000)}"""

Reply ONLY with a valid JSON object matching this exact shape:
{
  "score": 85,
  "verdict": "likely_scam",
  "summary": "2 short sentences explaining why this is or isn't a scam",
  "extra_red_flags": ["short flag 1", "short flag 2"],
  "next_step": "one short sentence advising what to do next"
}

Guidelines for scoring:
- Score 70-100 (likely_scam): Impersonating authority (police, ICA, bank, government), asking for money transfers, OTPs, urgent account suspensions, or asking to keep calls secret.
- Score 30-69 (suspicious): Unknown caller claiming to be a friend asking for money, unclear identity, pressure tactics.
- Score 0-29 (probably_safe): Casual normal conversation with no financial or personal information requests.

Write summary, extra_red_flags, and next_step in ${LANG_NAMES[lang] || 'English'}.
Never say something is 100% safe. If money was sent or requested, advise calling their bank and ScamShield Helpline 1799.`;

  try {
    const response = await ollama.chat({
      model: process.env.OLLAMA_MODEL || 'llama3.2', // or qwen2.5
      messages: [{ role: 'user', content: prompt }],
      format: 'json', // Ensures Ollama outputs clean JSON
    });

    const rawText = response.message?.content || '';
    return JSON.parse(rawText);
  } catch (err) {
    console.warn('Local Ollama AI evaluation failed:', err.message);
    return null;
  }
}