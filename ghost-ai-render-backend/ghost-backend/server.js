import express from 'express';
import OpenAI from 'openai';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const accessToken = process.env.GHOST_ACCESS_TOKEN;

app.get('/health', (_req, res) => res.json({ status: 'online', service: 'ghost-ai' }));

app.post('/api/chat', async (req, res) => {
  if (!accessToken) return res.status(503).json({ error: 'Server access token not configured' });
  if (req.get('x-ghost-token') !== accessToken) return res.status(401).json({ error: 'Unauthorized' });

  const { message, history = [] } = req.body ?? {};
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) {
    return res.status(400).json({ error: 'Message must be 1–2000 characters' });
  }
  const safeHistory = Array.isArray(history)
    ? history.slice(-8).filter(x => x && ['user', 'assistant'].includes(x.role) && typeof x.content === 'string').map(x => ({ role: x.role, content: x.content.slice(0, 2000) }))
    : [];
  try {
    const result = await client.chat.completions.create({
      model,
      max_tokens: 300,
      messages: [
        { role: 'system', content: 'You are Ghost, a helpful personal AI assistant in an Android app. Speak concisely and naturally in a refined, friendly tone. Address the user as sir when natural. Never claim you executed phone actions; those are handled by the app. Avoid Markdown because your replies are spoken aloud.' },
        ...safeHistory,
        { role: 'user', content: message.trim() }
      ]
    });
    res.json({ reply: result.choices[0]?.message?.content?.trim() || 'I have no response at the moment, sir.' });
  } catch (err) {
    console.error('OpenAI request failed', err.status || err.name);
    res.status(502).json({ error: 'AI service temporarily unavailable' });
  }
});

const port = Number(process.env.PORT) || 10000;
app.listen(port, '0.0.0.0', () => console.log(`Ghost backend listening on ${port}`));
