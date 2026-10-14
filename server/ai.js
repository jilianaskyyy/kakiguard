// server/ai.js
import { GoogleGenAI } from '@google/genai';

const LANG_NAMES = { en: 'English', zh: 'Simplified Chinese', ms: 'Malay', ta: 'Tamil' };

export const aiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

export async function explainWithAI(text, ruleResult = {}, lang = 'en') {
  if (!aiEnabled()) return null;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `You are KakiGuard, an expert AI scam detector protecting people in Singapore from phone scams, phishing, and fraud.

Analyze the following live call transcript / message:
"""${text.slice(0, 3000)}"""

Evaluate the content and provide a risk assessment.
Reply ONLY with a valid JSON object matching this exact shape:
{
  "score": <integer from 0 to 100 representing scam risk level>,
  "verdict": "likely_scam" | "suspicious" | "probably_safe",
  "summary": "<2 simple, clear sentences explaining why this is or isn't a scam>",
  "extra_red_flags": ["<short tag 1>", "<short tag 2>"],
  "next_step": "<1 short actionable advice sentence>"
}

Guidelines for scoring:
- Score 70-100 (likely_scam): Impersonating authority (police, ICA, bank, government), asking for money transfers, OTPs, urgent account suspensions, or asking to keep calls secret.
- Score 30-69 (suspicious): Unknown caller claiming to be a friend asking for money, unclear identity, pressure tactics.
- Score 0-29 (probably_safe): Casual normal conversation with no financial or personal information requests.

Write summary, extra_red_flags, and next_step in ${LANG_NAMES[lang] || 'English'}.
Never say something is 100% safe. If money was sent or requested, advise calling their bank and ScamShield Helpline 1799.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '';
    return JSON.parse(rawText);
  } catch (err) {
    console.warn('AI evaluation failed:', err.message);
    return null;
  }
}