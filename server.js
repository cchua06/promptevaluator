require('dotenv').config();
const path = require('path');
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = process.env.ROOT_DIR || process.cwd();
const { Pool, Client } = require('pg');
const { time } = require('console');

// Admin password
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 12 * 60 * 60 * 1000 } // 12 hours
}));

// Basic request logging and JSON parsing (must be before routes)
app.use(morgan('tiny'));
app.use(express.json({ limit: '2mb' }));

// Postgres connection
const pool = new Pool();

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS passwords (
        id TEXT PRIMARY KEY,
        workshop_name TEXT,
        date_of_expiry TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prompts (
        id UUID PRIMARY KEY,
        timestamp TEXT,
        firstname TEXT,
        lastname  TEXT,
        prompt    TEXT,
        notes     TEXT,
        facilitatorfeedback TEXT,
        workshop_name TEXT
      );
    `);
    console.log('Connected to Postgres');
  } catch (err) {
    console.error('Postgres init error:', err);
    process.exit(1);
  }
})();

// ---- OpenAI API Key (now loaded from .env) ----
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;


// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

// Middleware to check if password is still valid (not deleted/expired)
const requireValidPassword = async (req, res, next) => {
  const password = req.session.password;
  if (!password) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Your workshop password is no longer valid. Please log in again.' });
  }
  try {
    const pwResult = await pool.query(
      'SELECT * FROM passwords WHERE id = $1 AND date_of_expiry > NOW()',
      [password]
    );
    if (pwResult.rows.length === 0) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Your workshop password is no longer valid. Please log in again.' });
    }
    next();
  } catch (err) {
    req.session.destroy(() => {});
    return res.status(500).json({ error: 'Failed to validate password' });
  }
};

const requireAdminAuth = (req, res, next) => {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ error: 'Admin authentication required' });
  }
};

// Authentication endpoints
app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  try {
    // Check if password exists in passwords table and is not expired
    const result = await pool.query(
      'SELECT * FROM passwords WHERE id = $1 AND date_of_expiry > NOW()',
      [password]
    );
    
    if (result.rows.length > 0) {
      req.session.authenticated = true;
      req.session.password = password;
      req.session.workshopName = result.rows[0].workshop_name;
      res.json({ success: true, workshopName: result.rows[0].workshop_name });
    } else {
      res.status(401).json({ error: 'Invalid or expired password' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/admin-login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid admin password' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
    } else {
      res.json({ success: true });
    }
  });
});

// Check authentication status
app.get('/api/auth-status', (req, res) => {
  res.json({ 
    authenticated: !!req.session.authenticated,
    isAdmin: !!req.session.isAdmin,
    workshopName: req.session.workshopName || null
  });
});

// Proxy endpoint for prompt evaluation
app.post('/api/evaluate', requireAuth, requireValidPassword, async (req, res) => {
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
app.post('/api/facilitator-feedback', requireAuth, async (req, res) => {
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
      temperature: 0
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


// API: Save a new record
app.post('/api/record', requireAuth, requireValidPassword, async (req, res) => {
  const { id, timestamp, firstname, lastname, prompt, notes, facilitatorfeedback } = req.body;
  const workshopName = req.session.workshopName; // Get workshop name from session
  try {
    await pool.query(
      `INSERT INTO prompts (id, timestamp, firstname, lastname, prompt, notes, facilitatorfeedback, workshop_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, timestamp, firstname, lastname, prompt, notes, facilitatorfeedback, workshopName]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error inserting record:', err);
    res.status(500).json({ error: 'Failed to save record' });
  }
});

// API: Get all records (admin only)
app.get('/api/records', requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM prompts 
      ORDER BY timestamp DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching records:', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// API: Delete a record (admin only)
app.delete('/api/record/:id', requireAdminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM prompts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting record:', err);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

// API: Edit a record (admin only)
app.put('/api/record/:id', requireAdminAuth, async (req, res) => {
  const { firstname, lastname, prompt, notes, facilitatorfeedback } = req.body;
  try {
    await pool.query(
      `UPDATE prompts SET firstname=$1, lastname=$2, prompt=$3, notes=$4, facilitatorfeedback=$5 WHERE id=$6`,
      [firstname, lastname, prompt, notes, facilitatorfeedback, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating record:', err);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

// API: Get all passwords (admin only)
app.get('/api/passwords', requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM passwords ORDER BY date_of_expiry DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching passwords:', err);
    res.status(500).json({ error: 'Failed to fetch passwords' });
  }
});

// API: Create a new password (admin only)
app.post('/api/password', requireAdminAuth, async (req, res) => {
  const { workshopName, expiryDate } = req.body;
  try {
    // Generate a 6-digit numeric password
    let password = '';
    for (let i = 0; i < 6; i++) {
      password += Math.floor(Math.random() * 10).toString();
    }
    
    await pool.query(
      'INSERT INTO passwords (id, workshop_name, date_of_expiry) VALUES ($1, $2, $3)',
      [password, workshopName, expiryDate]
    );
    
    res.json({ 
      password, 
      workshop_name: workshopName, 
      date_of_expiry: expiryDate 
    });
  } catch (err) {
    console.error('Error creating password:', err);
    res.status(500).json({ error: 'Failed to create password' });
  }
});

// API: Delete a password (admin only)
app.delete('/api/password/:id', requireAdminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM passwords WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting password:', err);
    res.status(500).json({ error: 'Failed to delete password' });
  }
});

// API: Clean expired passwords (admin only)
app.delete('/api/passwords/expired', requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM passwords WHERE date_of_expiry <= NOW() RETURNING *');
    res.json({ success: true, deletedCount: result.rowCount, deletedPasswords: result.rows });
  } catch (err) {
    console.error('Error cleaning expired passwords:', err);
    res.status(500).json({ error: 'Failed to clean expired passwords' });
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

// Route to handle password-based URLs for auto-login
app.get('/:password', async (req, res) => {
  const { password } = req.params;
  
  // Skip if it's a known static route or starts with api
  if (password === 'admin' || password.startsWith('api') || password.includes('.')) {
    return res.sendFile(path.join(ROOT_DIR, 'user.html'));
  }
  
  try {
    // Check if password exists in passwords table and is not expired
    const result = await pool.query(
      'SELECT * FROM passwords WHERE id = $1 AND date_of_expiry > NOW()',
      [password]
    );
    
    if (result.rows.length > 0) {
      // Valid password - set session and serve user.html
      req.session.authenticated = true;
      req.session.password = password;
      req.session.workshopName = result.rows[0].workshop_name;
    }
    // Always serve user.html regardless of password validity
    // The frontend will check auth status and show appropriate UI
    res.sendFile(path.join(ROOT_DIR, 'user.html'));
  } catch (err) {
    console.error('Error checking password from URL:', err);
    res.sendFile(path.join(ROOT_DIR, 'user.html'));
  }
});

// Main route to serve user.html (fallback)
app.use((req, res, next) => {
  res.sendFile(path.join(ROOT_DIR, 'user.html'));
});

app.listen(PORT, () => {
  console.log(`\nGenAI Prompt Feedback POC running at http://localhost:${PORT}`);
  console.log(`Serving files from: ${ROOT_DIR}`);
});
