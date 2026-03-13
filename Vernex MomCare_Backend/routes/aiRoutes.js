const express = require("express");
const router = express.Router();
const AiMessage = require("../models/AiMessage");
const ChatSession = require("../models/ChatSession");

const buildSystemPrompt = () =>
  [
    "Your name is Thozhi.",
    "You are a soft, caring, feminine pregnancy and maternal-care companion.",
    "Be warm, gentle, medically responsible, emotionally reassuring, and practical.",
    "Do not diagnose or replace a clinician.",
    "Reply in simple, natural English.",
    "Give a compact voice-friendly answer that sounds natural when spoken aloud.",
    "Do not use pet names like dear, dear one, sweetheart, or similar wording.",
    "You only answer topics related to pregnancy, prenatal care, postpartum maternal care, baby movement, labor warning signs, maternal nutrition, emotional wellbeing during pregnancy, safe exercise, medication safety in pregnancy, breastfeeding, and pregnancy-related public health guidance.",
    "Do not act like a general chatbot.",
    "If the user asks about unrelated topics, broad chit-chat, technology, finance, entertainment, or non-maternal topics, gently redirect in 1 short sentence back to pregnancy or maternal care.",
    "If the user asks for current pregnancy news or live updates, do not invent news. Say you can provide general pregnancy guidance but cannot verify live news in real time.",
    "Answer in 2 short complete sentences in most cases. Use 3 sentences only if an urgent warning is truly necessary.",
    "Sentence 1 should reassure and stay focused on the pregnancy or maternal-care concern. Sentence 2 should give the safest next step.",
    "Avoid long paragraphs, long lists, repeated phrases, and fertility-window or cycle-day coaching unless the user clearly asks about pregnancy planning.",
    "Mention urgent red flags only if relevant to the user's message.",
    "Keep the reply clear enough to be spoken in English voice mode during testing.",
  ].join("\n");

const cleanReplyTone = (reply) =>
  String(reply || "")
    .replace(/\b(oh[, ]*)?(my )?(dear|dear one|sweetheart|honey|love)\b[:, ]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

const ensureCompleteSentence = (text) => {
  const normalized = String(text || "").trim();
  if (!normalized) return "";
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
};

const addHelpfulFollowUp = (reply, originalMessage) => {
  const normalizedReply = cleanReplyTone(reply);
  const sentences =
    normalizedReply.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter(Boolean) || [];

  if (sentences.length >= 2) {
    return normalizedReply;
  }

  const text = String(originalMessage || "").toLowerCase();
  let followUp = "Sip fluids slowly, eat small bland meals, and contact your doctor if symptoms are severe or you cannot keep liquids down.";

  if (/vomit|vomiting|nausea|morning sickness/.test(text)) {
    followUp = "Try small sips of water and bland food, and contact your doctor if you cannot keep fluids down, feel weak, or notice dehydration.";
  } else if (/pain|cramp|cramps|stomach|abdominal|pelvic|back pain/.test(text)) {
    followUp = "Please rest, drink water, and contact your doctor soon if the pain gets stronger or comes with bleeding, fever, or vomiting.";
  } else if (/bleeding|spotting|fluid leak|water broke|reduced baby movement|no baby movement/.test(text)) {
    followUp = "Please contact your doctor or go to a hospital now, because these symptoms can need urgent medical review.";
  }

  return `${ensureCompleteSentence(normalizedReply)} ${ensureCompleteSentence(followUp)}`.trim();
};

const limitReplyLength = (reply, originalMessage = "") => {
  const normalizedReply = addHelpfulFollowUp(reply, originalMessage);

  if (!normalizedReply) {
    return "I am here with you. Please tell me a little more.";
  }

  const sentenceMatches =
    normalizedReply.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter(Boolean) || [];
  const maxSentences = 3;
  const maxWords = 34;
  let sentenceCount = 0;
  let wordCount = 0;
  const selected = [];

  for (const sentence of sentenceMatches) {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (selected.length > 0 && (sentenceCount >= maxSentences || wordCount + words.length > maxWords)) {
      break;
    }

    selected.push(sentence);
    sentenceCount += 1;
    wordCount += words.length;

    if (sentenceCount >= maxSentences || wordCount >= maxWords) {
      break;
    }
  }

  const limited = (selected.length > 0 ? selected.join(" ") : normalizedReply)
    .split(/\s+/)
    .slice(0, maxWords)
    .join(" ")
    .trim();

  return /[.!?]$/.test(limited) ? limited : `${limited}.`;
};

const buildFallbackReply = (message) => {
  const text = String(message || "").toLowerCase();
  const isUrgentConcern =
    /bleeding|spotting|severe pain|unbearable pain|faint|fainted|dizzy|dizziness|trouble breathing|can't breathe|fluid leak|water broke|reduced baby movement|no baby movement|fever|fits|seizure/.test(
      text
    );
  const mentionsPain = /pain|cramp|cramps|stomach|abdomen|abdominal|back pain|pelvic/.test(text);

  if (isUrgentConcern) {
    return "I am here with you. I am having trouble reaching my full AI service right now, but your symptoms may need urgent medical attention. Please contact your doctor or go to the nearest hospital now, especially if you have bleeding, severe pain, fever, fluid leakage, trouble breathing, fainting, or reduced baby movement.";
  }

  if (mentionsPain) {
    return "I am here with you. I am having trouble reaching my full AI service right now, but because you mentioned pain, please rest, drink water, avoid heavy activity, and contact your doctor today if the pain is strong, getting worse, one-sided, or comes with bleeding, fever, vomiting, fluid leakage, or reduced baby movement.";
  }

  return "I am here with you. I am having trouble reaching my full AI service right now, but you can still tell me your symptom, how long it has been happening, and whether you have bleeding, fever, fluid leakage, severe pain, or reduced baby movement. If any of those are present, please contact your doctor immediately.";
};

const saveAssistantReply = async (userId, sessionId, reply) => {
  try {
    await AiMessage.create({
      userId,
      sessionId,
      role: "assistant",
      content: reply,
    });
  } catch (err) {
    console.error("Assistant message persistence error:", err);
  }

  try {
    await ChatSession.findByIdAndUpdate(
      sessionId,
      { lastMessage: reply, lastAt: new Date() },
      { upsert: true }
    );
  } catch (err) {
    console.error("Assistant session persistence error:", err);
  }
};

const saveUserMessage = async (userId, sessionId, message) => {
  try {
    await AiMessage.create({
      userId,
      sessionId,
      role: "user",
      content: message,
    });
  } catch (err) {
    console.error("User message persistence error:", err);
  }

  try {
    await ChatSession.findByIdAndUpdate(
      sessionId,
      { lastMessage: message, lastAt: new Date() },
      { upsert: true }
    );
  } catch (err) {
    console.error("User session persistence error:", err);
  }
};

const candidateModels = () =>
  [...new Set([
    String(process.env.GEMINI_MODEL || "").trim(),
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ].filter(Boolean))];

const extractGeminiError = (data) => {
  const message = data?.error?.message;
  const reason = data?.error?.details?.find(
    (detail) => detail?.["@type"] === "type.googleapis.com/google.rpc.ErrorInfo"
  )?.reason;

  return {
    message: message || "Gemini request failed",
    reason: reason || "",
  };
};

const isInvalidApiKeyError = (status, data) => {
  const error = extractGeminiError(data);
  return (
    status === 400 &&
    (error.reason === "API_KEY_INVALID" || /api key not valid/i.test(error.message))
  );
};

const isModelUnavailableError = (status, data) => {
  const error = extractGeminiError(data);
  return (
    status === 404 ||
    /not found/i.test(error.message) ||
    /is not found for api version/i.test(error.message)
  );
};

const isPermissionOrQuotaError = (status, data) => {
  const error = extractGeminiError(data);
  return (
    status === 403 ||
    status === 429 ||
    /permission/i.test(error.message) ||
    /quota/i.test(error.message) ||
    /rate limit/i.test(error.message)
  );
};

const callGemini = async (modelName, message, apiKey) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  const resolvedModel = String(modelName || "").replace(/^models\//, "").trim();
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    resolvedModel +
    ":generateContent";
  const prompt = `${buildSystemPrompt()}\n\nUser message:\n${message}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.65,
          topP: 0.9,
          maxOutputTokens: 900,
        },
      }),
    });

    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeoutId);
  }
};

router.post("/chat", async (req, res) => {
  try {
    const { message, userId, sessionId } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });
    if (!userId) return res.status(400).json({ error: "User ID required" });
    if (!sessionId) return res.status(400).json({ error: "Session ID required" });

    await saveUserMessage(userId, sessionId, message);

    const apiKey = String(process.env.GEMINI_API_KEY || "").trim();

    if (!apiKey || apiKey === "your_gemini_api_key") {
      return res.status(500).json({
        error: "Gemini API key is missing in backend .env. Set GEMINI_API_KEY and restart the backend.",
      });
    }

    let lastModelError = null;

    for (const modelName of candidateModels()) {
      const result = await callGemini(modelName, message, apiKey);

      if (result.ok) {
        const reply = limitReplyLength(
          result?.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "I am here with you. Please tell me more.",
          message
        );

        await saveAssistantReply(userId, sessionId, reply);
        res.set("X-Gemini-Model", modelName);
        return res.json({ reply });
      }

      console.error("Gemini API error:", modelName, result.data);
      lastModelError = { modelName, ...extractGeminiError(result.data), status: result.status };

      if (isInvalidApiKeyError(result.status, result.data)) {
        const fallbackReply = buildFallbackReply(message);
        await saveAssistantReply(userId, sessionId, fallbackReply);
        return res.json({
          reply: fallbackReply,
          fallback: true,
          warning:
            "Gemini rejected the backend API key for the running backend process. Verify Vernex MomCare_Backend/.env and restart the backend to restore live AI responses.",
        });
      }

      if (isPermissionOrQuotaError(result.status, result.data)) {
        const errorDetails = extractGeminiError(result.data);
        if (/quota/i.test(errorDetails.message) || /rate limit/i.test(errorDetails.message) || result.status === 429) {
          continue;
        }
        const fallbackReply = buildFallbackReply(message);
        await saveAssistantReply(userId, sessionId, fallbackReply);
        return res.json({
          reply: fallbackReply,
          fallback: true,
          warning:
            /reported as leaked/i.test(errorDetails.message)
              ? "Gemini blocked the current backend API key because Google flagged it as leaked. Create a new Gemini key, update Vernex MomCare_Backend/.env, and restart the backend."
              : `Gemini access failed for the running backend process: ${errorDetails.message}`,
        });
      }

      if (!isModelUnavailableError(result.status, result.data)) {
        break;
      }
    }

    if (lastModelError?.message) {
      if (/quota|rate limit/i.test(lastModelError.message) || lastModelError.status === 429) {
        const fallbackReply = buildFallbackReply(message);
        await saveAssistantReply(userId, sessionId, fallbackReply);
        return res.json({ reply: fallbackReply, fallback: true });
      }

      const fallbackReply = buildFallbackReply(message);
      await saveAssistantReply(userId, sessionId, fallbackReply);
      return res.json({
        reply: fallbackReply,
        fallback: true,
        warning: `Gemini request failed for the running backend process: ${lastModelError.message}`,
      });
    }

    const fallbackReply = buildFallbackReply(message);
    await saveAssistantReply(userId, sessionId, fallbackReply);
    return res.json({
      reply: fallbackReply,
      fallback: true,
      warning: "Gemini request failed for the running backend process. Check backend GEMINI_MODEL and GEMINI_API_KEY configuration.",
    });
  } catch (err) {
    console.error("Gemini error:", err);
    const fallbackReply = buildFallbackReply(req.body?.message);
    if (req.body?.userId && req.body?.sessionId) {
      await saveAssistantReply(req.body.userId, req.body.sessionId, fallbackReply);
    }
    res.json({
      reply: fallbackReply,
      fallback: true,
      warning: err?.message || "Gemini request failed. Check backend logs.",
    });
  }
});

router.get("/history", async (req, res) => {
  try {
    const { userId, sessionId, limit } = req.query;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    if (!sessionId) return res.status(400).json({ error: "Session ID required" });

    const safeLimit = Math.min(Number(limit) || 50, 200);
    const messages = await AiMessage.find({ userId, sessionId })
      .sort({ createdAt: 1 })
      .limit(safeLimit)
      .lean();

    res.json({ messages });
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ error: "History failed" });
  }
});

router.post("/sessions", async (req, res) => {
  try {
    const { userId, title } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    const session = await ChatSession.create({
      userId,
      title: title || "",
      lastMessage: "",
      lastAt: new Date(),
    });
    res.json({ session });
  } catch (err) {
    console.error("Create session error:", err);
    res.status(500).json({ error: "Create session failed" });
  }
});

router.get("/sessions", async (req, res) => {
  try {
    const { userId, limit } = req.query;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    const safeLimit = Math.min(Number(limit) || 50, 200);

    const sessions = await ChatSession.find({ userId })
      .sort({ lastAt: -1 })
      .limit(safeLimit)
      .lean();

    res.json({ sessions });
  } catch (err) {
    console.error("Sessions error:", err);
    res.status(500).json({ error: "Sessions failed" });
  }
});

router.delete("/sessions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await ChatSession.deleteOne({ _id: id });
    await AiMessage.deleteMany({ sessionId: id });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete session error:", err);
    res.status(500).json({ error: "Delete session failed" });
  }
});

router.patch("/sessions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Title required" });
    const session = await ChatSession.findByIdAndUpdate(
      id,
      { title },
      { new: true }
    );
    res.json({ session });
  } catch (err) {
    console.error("Rename session error:", err);
    res.status(500).json({ error: "Rename session failed" });
  }
});

module.exports = router;
