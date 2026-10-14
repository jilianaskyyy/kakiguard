import { GoogleGenAI } from '@google/genai';

const LANG_NAMES = { en: 'English', zh: 'Simplified Chinese', ms: 'Malay', ta: 'Tamil' };

// Initialize Gemini (automatically uses GEMINI_API_KEY from server/.env)
const ai = new GoogleGenAI({});

export const aiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

export async function explainWithAI(text, ruleResult, lang = 'en') {
  if (!aiEnabled()) return null;

  const prompt = `You help people in Singapore check whether a message or call might be a scam.
Our rule engine scored this ${ruleResult.score}/100 and found these red flags: ${ruleResult.flags?.map((f) => f.flag).join(', ') || 'none'}.

Message:
"""${text.slice(0, 3000)}"""

Reply ONLY with JSON in this shape:
{"verdict":"likely_scam"|"suspicious"|"probably_safe","summary":"2 short sentences a 70-year-old can understand","extra_red_flags":["short phrase", "..."],"next_step":"one short sentence"}
Write summary, extra_red_flags and next_step in ${LANG_NAMES[lang] || 'English'}.
Never say something is 100% safe. If money was already sent, tell them to call their bank and the ScamShield Helpline 1799 now.`;

  try {
    // Request JSON formatted output directly from Gemini 2.0 Flash
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '';
    return JSON.parse(rawText);
  } catch (err) {
    console.warn('AI explanation skipped:', err.message);
    return null; // The rule engine result will still display safely if the AI call fails
  }
}

// // Optional AI layer. If ANTHROPIC_API_KEY is set in server/.env, Claude writes a short,
// // plain-language explanation in the user's language. If not, the app still works fully
// // using the rule engine in shared/scamEngine.js — great for offline hackathon demos.

// const LANG_NAMES = { en: 'English', zh: 'Simplified Chinese', ms: 'Malay', ta: 'Tamil' };

// export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

// export async function explainWithAI(text, ruleResult, lang = 'en') {
//   if (!aiEnabled()) return null;
//   const prompt = `You help people in Singapore check whether a message or call might be a scam.
// Our rule engine scored this ${ruleResult.score}/100 and found these red flags: ${ruleResult.flags.map((f) => f.flag).join(', ') || 'none'}.

// Message:
// """${text.slice(0, 3000)}"""

// Reply ONLY with JSON in this shape:
// {"verdict":"likely_scam"|"suspicious"|"probably_safe","summary":"2 short sentences a 70-year-old can understand","extra_red_flags":["short phrase", "..."],"next_step":"one short sentence"}
// Write summary, extra_red_flags and next_step in ${LANG_NAMES[lang] || 'English'}.
// Never say something is 100% safe. If money was already sent, tell them to call their bank and the ScamShield Helpline 1799 now.`;

//   try {
//     const res = await fetch('https://api.anthropic.com/v1/messages', {
//       method: 'POST',
//       headers: {
//         'content-type': 'application/json',
//         'x-api-key': process.env.ANTHROPIC_API_KEY,
//         'anthropic-version': '2023-06-01',
//       },
//       body: JSON.stringify({
//         model: process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
//         max_tokens: 400,
//         messages: [{ role: 'user', content: prompt }],
//       }),
//       signal: AbortSignal.timeout(12000),
//     });
//     if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
//     const data = await res.json();
//     const raw = data.content?.[0]?.text || '';
//     return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
//   } catch (err) {
//     console.warn('AI explanation skipped:', err.message);
//     return null; // rule engine result is still returned
//   }
// }


