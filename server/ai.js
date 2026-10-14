import { GoogleGenAI } from '@google/genai';

const LANG_NAMES = { en: 'English', zh: 'Simplified Chinese', ms: 'Malay', ta: 'Tamil' };

export const aiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

export async function explainWithAI(text, ruleResult, lang = 'en') {
  if (!aiEnabled()) return null;

  // Initialize the Gemini client using key from process.env
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `You help people in Singapore check whether a message or call might be a scam.
Our rule engine scored this ${ruleResult.score}/100 and found these red flags: ${ruleResult.flags?.map((f) => f.flag).join(', ') || 'none'}.

Message:
"""${text.slice(0, 3000)}"""

Reply ONLY with JSON in this shape:
{"verdict":"likely_scam"|"suspicious"|"probably_safe","summary":"2 short sentences a 70-year-old can understand","extra_red_flags":["short phrase", "..."],"next_step":"one short sentence"}
Write summary, extra_red_flags and next_step in ${LANG_NAMES[lang] || 'English'}.
Never say something is 100% safe. If money was already sent, tell them to call their bank and the ScamShield Helpline 1799 now.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '';
    return JSON.parse(rawText);
  } catch (err) {
    console.warn('AI explanation skipped:', err.message);
    return null;
  }
}

// import { GoogleGenAI } from '@google/genai';

// const LANG_NAMES = { en: 'English', zh: 'Simplified Chinese', ms: 'Malay', ta: 'Tamil' };

// // Initialize Gemini (automatically uses GEMINI_API_KEY from server/.env)
// const ai = new GoogleGenAI({});

// export const aiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

// export async function explainWithAI(text, ruleResult, lang = 'en') {
//   if (!aiEnabled()) return null;

//   const prompt = `You help people in Singapore check whether a message or call might be a scam.
// Our rule engine scored this ${ruleResult.score}/100 and found these red flags: ${ruleResult.flags?.map((f) => f.flag).join(', ') || 'none'}.

// Message:
// """${text.slice(0, 3000)}"""

// Reply ONLY with JSON in this shape:
// {"verdict":"likely_scam"|"suspicious"|"probably_safe","summary":"2 short sentences a 70-year-old can understand","extra_red_flags":["short phrase", "..."],"next_step":"one short sentence"}
// Write summary, extra_red_flags and next_step in ${LANG_NAMES[lang] || 'English'}.
// Never say something is 100% safe. If money was already sent, tell them to call their bank and the ScamShield Helpline 1799 now.`;

//   try {
//     // Request JSON formatted output directly from Gemini 2.0 Flash
//     const response = await ai.models.generateContent({
//       model: 'gemini-3.5-flash-lite',
//       contents: prompt,
//       config: {
//         responseMimeType: 'application/json',
//       },
//     });

//     const rawText = response.text || '';
//     return JSON.parse(rawText);
//   } catch (err) {
//     console.warn('AI explanation skipped:', err.message);
//     return null; // The rule engine result will still display safely if the AI call fails
//   }
// }