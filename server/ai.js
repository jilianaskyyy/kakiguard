import ollama from 'ollama';

const LANG_NAMES = { en: 'English', zh: 'Simplified Chinese', ms: 'Malay', ta: 'Tamil' };

export const aiEnabled = () => true;

export async function explainWithAI(text, ruleResult = {}, lang = 'en') {
  const prompt = `You are KakiGuard, an expert AI scam detector protecting people in Singapore from phone scams, phishing, and fraud.

Analyze the following live call transcript / message:
"""${text.slice(0, 3000)}"""

Reply ONLY with valid JSON in this exact shape:
{
  "score": 85,
  "verdict": "likely_scam",
  "summary": "2 short sentences explaining why this is or isn't a scam",
  "extra_red_flags": ["short flag 1", "short flag 2"],
  "next_step": "one short sentence advising what to do next"
}

Write summary, extra_red_flags and next_step in ${LANG_NAMES[lang] || 'English'}.
Never say something is 100% safe. If money was sent or requested, tell them to call their bank and ScamShield Helpline 1799.`;

  try {
    const response = await ollama.chat({
      model: process.env.OLLAMA_MODEL || 'llama3.2',
      messages: [{ role: 'user', content: prompt }],
      format: 'json',
    });

    const rawText = response.message?.content || '';
    return JSON.parse(rawText);
  } catch (err) {
    console.error('Local Ollama AI error:', err.message);
    return null;
  }
}