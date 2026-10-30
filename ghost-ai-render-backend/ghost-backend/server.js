
import express from "express";
import OpenAI from "openai";

const app = express();

app.disable("x-powered-by");

app.use(express.json({
  limit: "16kb"
}));

// =====================================================
// GHOST AI - SERVER CONFIGURATION
// =====================================================

const PORT = Number(process.env.PORT) || 10000;

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || "";

const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL ||
  "https://openrouter.ai/api/v1";

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ||
  "openrouter/free";

const GHOST_ACCESS_TOKEN =
  process.env.GHOST_ACCESS_TOKEN || "";

// Keep OpenRouter credentials on the server.
// Never expose them in the Android application.

const ai = OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
      timeout: 30000,
      maxRetries: 1,
      defaultHeaders: {
        "X-OpenRouter-Title": "GHOST AI"
      }
    })
  : null;

// =====================================================
// GHOST PERSONALITY
// =====================================================

const GHOST_PERSONALITY = `
You are GHOST, a sophisticated personal AI assistant
created for one private Android user.

Your personality is inspired by the idea of an intelligent,
natural, capable digital companion.

VOICE AND PERSONALITY:
- Speak naturally, intelligently and confidently.
- Be warm, perceptive, engaging and conversational.
- Avoid sounding like a generic voice assistant.
- Address the user as "sir" occasionally when natural.
- Be concise when the question is simple.
- Give detailed answers when the situation requires them.
- Maintain conversation continuity using available history.
- Understand casual English and Nigerian Pidgin.
- Be capable of friendly humor and informal conversation.
- Do not introduce yourself repeatedly.
- Never include Markdown formatting in spoken responses.

BEHAVIOUR:
- Listen to the user's intentions carefully.
- Use conversation context to resolve follow-up questions.
- Do not demand a wake phrase inside a conversation.
- Do not invent memories or personal information.
- Be honest about uncertainty.
- Respect the user's privacy.
- Never claim to have read messages, accessed emails,
  opened apps or controlled the phone unless the Android
  application actually confirms the action.

DEVICE ACTIONS:
Android actions are executed by the phone's local
command system, not by this language model.
Do not claim an action succeeded without confirmation.

Your goal is to provide a natural, useful, intelligent
conversational experience through GHOST's voice interface.
`;

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (_req, res) => {

  res.json({
    status: "online",
    service: "ghost-ai",
    aiConfigured: Boolean(ai),
    provider: "openrouter"
  });

});

// =====================================================
// AUTHENTICATION
// =====================================================

function authenticateGhost(req, res, next) {

  if (!GHOST_ACCESS_TOKEN) {

    return res.status(503).json({
      error: "Server access token not configured"
    });

  }

  const suppliedToken =
    req.get("x-ghost-token") || "";

  if (suppliedToken !== GHOST_ACCESS_TOKEN) {

    return res.status(401).json({
      error: "Unauthorized"
    });

  }

  next();
}

// =====================================================
// AI CHAT ENDPOINT
// =====================================================

app.post(
  "/api/chat",
  authenticateGhost,
  async (req, res) => {

    if (!ai) {

      return res.status(503).json({
        error: "OpenRouter API key is not configured"
      });

    }

    const {
      message,
      history = []
    } = req.body || {};

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 2000
    ) {

      return res.status(400).json({
        error: "Message must be 1-2000 characters"
      });

    }

    // Validate and limit conversation history.

    const safeHistory = Array.isArray(history)
      ? history
          .slice(-12)
          .filter(item =>
            item &&
            ["user", "assistant"].includes(item.role) &&
            typeof item.content === "string"
          )
          .map(item => ({
            role: item.role,
            content: item.content.slice(0, 2000)
          }))
      : [];

    try {

      console.log(
        "[GHOST] Processing AI request"
      );

      const completion =
        await ai.chat.completions.create({

          model: OPENROUTER_MODEL,

          max_tokens: 500,

          temperature: 0.7,

          messages: [
            {
              role: "system",
              content: GHOST_PERSONALITY
            },

            ...safeHistory,

            {
              role: "user",
              content: message.trim()
            }
          ]
        });

      const reply =
        completion.choices?.[0]
          ?.message?.content?.trim();

      if (!reply) {

        return res.status(502).json({
          error: "AI provider returned an empty response"
        });

      }

      console.log(
        "[GHOST] AI response completed"
      );

      return res.json({
        reply
      });

    } catch (error) {

      const providerStatus =
        Number(error?.status) || 0;

      console.error(
        "[GHOST] AI provider error",
        {
          status: providerStatus,
          type: error?.name || "UnknownError"
        }
      );

      if (providerStatus === 401) {

        return res.status(502).json({
          error: "OpenRouter rejected the API key"
        });

      }

      if (providerStatus === 402) {

        return res.status(502).json({
          error: "AI provider credits unavailable"
        });

      }

      if (providerStatus === 429) {

        return res.status(429).json({
          error: "AI rate limit reached. Try again later."
        });

      }

      if (providerStatus === 400) {

        return res.status(502).json({
          error: "AI provider rejected the model request"
        });

      }

      return res.status(502).json({
        error: "AI service temporarily unavailable"
      });

    }
  }
);

// =====================================================
// INVALID ROUTES
// =====================================================

app.use((_req, res) => {

  res.status(404).json({
    error: "Ghost endpoint not found"
  });

});

// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `[GHOST] Backend listening on port ${PORT}`
    );

    console.log(
      `[GHOST] AI provider: OpenRouter`
    );

    console.log(
      `[GHOST] AI configured: ${Boolean(ai)}`
    );

  }
);
