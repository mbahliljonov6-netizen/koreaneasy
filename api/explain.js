// Vercel serverless function. The API key stays on the server (never in the page).
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "Server is missing GEMINI_API_KEY." });

  const { text, lang } = req.body || {};
  const language = lang === "Uzbek" ? "Uzbek" : "English";
  if (!text || typeof text !== "string" || !text.trim())
    return res.status(400).json({ error: "Please paste a Korean text." });
  if (text.length > 3000)
    return res.status(400).json({ error: "Text is too long (max 3000 characters)." });

  const prompt = `You are a friendly Korean language helper for international students in Korea.
Read the Korean text below and reply ONLY with valid JSON in this exact shape:
{"summary":"2-4 simple sentences explaining what the text says and what the student must do",
"words":[{"ko":"Korean word","meaning":"meaning in ${language}","note":"very short hint or example"}],
"quiz":[{"question":"question in ${language} about the text","answer":"short correct answer"}]}
Rules: exactly 5 items in "words", exactly 3 items in "quiz". Write summary, meanings and quiz in ${language}, using simple beginner-level words. Keep Korean words in Korean. If the text is not Korean, return {"error":"Please paste a Korean text."}.
Korean text:
"""${text}"""`;

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    if (!r.ok) return res.status(502).json({ error: "AI service error " + r.status + ". Try again in a minute." });
    const data = await r.json();
    const out = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return res.status(502).json({ error: "AI returned an unexpected answer. Try again." });
    return res.status(200).json(JSON.parse(m[0]));
  } catch (e) {
    return res.status(500).json({ error: "Server error. Try again." });
  }
};
