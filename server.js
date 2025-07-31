// Toggle for localStorage mode (true = use localStorage in browser, false = use Postgres)
const USE_LOCAL_STORAGE = true;

const path = require('path');
const express = require('express');
const morgan = require('morgan');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = process.env.ROOT_DIR || process.cwd();
const { Pool } = require('pg');



// Expose storage mode to frontend
app.get('/api/storage-mode', (req, res) => {
  res.json({ useLocalStorage: USE_LOCAL_STORAGE });
});

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

// Postgres endpoints
// Set your Postgres connection string here or use an environment variable
const PG_CONNECTION_STRING = process.env.PG_CONNECTION_STRING || 'postgres://username:password@localhost:5432/yourdb';
const pool = new Pool({ connectionString: PG_CONNECTION_STRING });

/*
// Ensure table exists (run once at startup)
pool.query(`
  CREATE TABLE IF NOT EXISTS prompt_records (
    id UUID PRIMARY KEY,
    timestamp TEXT,
    firstName TEXT,
    lastName TEXT,
    prompt TEXT,
    notes TEXT,
    facilitatorFeedback TEXT
  )
`).catch(console.error);
*/

// API: Save a new record
app.post('/api/record', async (req, res) => {
  const { id, timestamp, firstName, lastName, prompt, notes, facilitatorFeedback } = req.body;
  try {
    await pool.query(
      `INSERT INTO prompt_records (id, timestamp, firstName, lastName, prompt, notes, facilitatorFeedback)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, timestamp, firstName, lastName, prompt, notes, facilitatorFeedback]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error inserting record:', err);
    res.status(500).json({ error: 'Failed to save record' });
  }
});

// API: Get all records
app.get('/api/records', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM prompt_records ORDER BY timestamp DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching records:', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// API: Delete a record
app.delete('/api/record/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM prompt_records WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting record:', err);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

// API: Edit a record (admin only)
app.put('/api/record/:id', async (req, res) => {
  const { firstName, lastName, prompt, notes, facilitatorFeedback } = req.body;
  try {
    await pool.query(
      `UPDATE prompt_records SET firstName=$1, lastName=$2, prompt=$3, notes=$4, facilitatorFeedback=$5 WHERE id=$6`,
      [firstName, lastName, prompt, notes, facilitatorFeedback, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating record:', err);
    res.status(500).json({ error: 'Failed to update record' });
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
