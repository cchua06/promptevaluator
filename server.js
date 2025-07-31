const path = require('path');
const express = require('express');
const morgan = require('morgan');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = process.env.ROOT_DIR || process.cwd();



// Basic request logging (comment out if unwanted)
app.use(morgan('tiny'));
app.use(express.json({ limit: '2mb' }));

// Proxy endpoint for prompt evaluation
app.post('/api/evaluate', async (req, res) => {
  try {
    const { prompt, systemInstructions } = req.body;
    if (!prompt || !systemInstructions) {
      return res.status(400).json({ error: 'Missing prompt or systemInstructions' });
    }
    const openaiEndpoint = 'https://api.openai.com/v1/chat/completions';
    const body = {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemInstructions },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    };
    const apiRes = await fetch(openaiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ error: 'OpenAI API error', statusText: apiRes.statusText });
    }
    const data = await apiRes.json();
    const notes = data.choices?.[0]?.message?.content?.trim() || '';
    res.json({ notes });
  } catch (err) {
    console.error('Error in /api/evaluate:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Proxy endpoint for Facilitator Feedback generation
app.post('/api/facilitator-feedback', async (req, res) => {
  try {
    const { prompt, systemInstructions } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }
    const openaiEndpoint = 'https://api.openai.com/v1/chat/completions';
    const body = {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemInstructions },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    };
    const apiRes = await fetch(openaiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ error: 'OpenAI API error', statusText: apiRes.statusText });
    }
    const data = await apiRes.json();
    const feedback = data.choices?.[0]?.message?.content?.trim() || '';
    res.json({ feedback });
  } catch (err) {
    console.error('Error in /api/facilitator-feedback:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use(express.static(ROOT_DIR, {
  extensions: ['html'],
  maxAge: 0
}));

// Route to serve admin.html for /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'admin.html'));
});

// Main route to serve user.html
app.use((req, res, next) => {
  res.sendFile(path.join(ROOT_DIR, 'user.html'));
});

app.listen(PORT, () => {
  console.log(`\nGenAI Prompt Feedback POC running at http://localhost:${PORT}`);
  console.log(`Serving files from: ${ROOT_DIR}`);
});
