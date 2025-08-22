import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import { fetchExamples } from './trainingStore.js';
import { buildPrompt } from './prompt.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 10000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL   = process.env.OPENAI_MODEL   || "gpt-4o-mini";

function parseAgencyContext(thread) {
  const ctx = {};
  const mBlock = String(thread).match(/=== AGENCY CONTEXT START ===([\s\S]*?)=== AGENCY CONTEXT END ===/);
  if (mBlock) {
    const lines = mBlock[1].split('\n').map(s=>s.trim());
    for (const ln of lines) {
      const [k, ...rest] = ln.split(':');
      if (!k || !rest.length) continue;
      ctx[k.trim()] = rest.join(':').trim();
    }
  }
  return ctx;
}

app.post('/api/generate', async (req, res) => {
  try {
    const { thread = "", instruction = "" } = req.body || {};
    const ctx = parseAgencyContext(thread);

    const onBehalf    = /^true$/i.test(ctx.OnBehalf || '');
    const creatorName = ctx.CreatorName || '';
    const brandDomain = (ctx.BrandDomain || '').toLowerCase();

    const kws = [];
    const lc = (thread + " " + instruction).toLowerCase();
    ["rate","compensation","budget","timeline","deliverables","usage","exclusivity","call"].forEach(k => { if (lc.includes(k)) kws.push(k); });

    const examples = fetchExamples({ limit: 3, onBehalf, keywords: kws, brandDomain });

    const { system, user } = buildPrompt({
      thread,
      instruction,
      agentName: ctx.AgentName || "Brian",
      agencyName: ctx.AgencyName || "Creators United",
      examples,
      onBehalf,
      creatorName
    });

    // 🔧 No temperature parameter (some models only allow default)
    const apiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });

    const json = await apiResp.json();
    if (!apiResp.ok) {
      return res.status(apiResp.status).json({ error: json.error?.message || `LLM error ${apiResp.status}` });
    }

    const draft = json.choices?.[0]?.message?.content?.trim() || "";
    res.json({ draft });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

// Resync endpoint – trigger ingestion of Training/Approved Sent
async function runResync(_req, res) {
  try {
    const { spawn } = await import('node:child_process');
    const p = spawn(process.execPath, ['imapSync.js'], { stdio: 'inherit' });
    p.on('close', (code) => res.json({ ok: code === 0, code }));
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
app.get('/api/resync', runResync);
app.post('/api/resync', runResync);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`[API] Listening on :${PORT}`));
