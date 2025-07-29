const path    = require('path');
const express = require('express');
const morgan  = require('morgan');

const app      = express();
const PORT     = process.env.PORT     || 3000;
const ROOT_DIR = process.env.ROOT_DIR || process.cwd();

// ---------------------------------------------------------------------------
// Basic‑Auth credentials (override via env vars in production)
// ---------------------------------------------------------------------------
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'password';

function basicAuth(req, res, next) {
  const header = req.headers.authorization || '';          // e.g. "Basic abc123"
  const token  = header.split(' ')[1];                     // "abc123"
  if (!token) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.sendStatus(401);
  }

  const [user, pass] = Buffer.from(token, 'base64')
                              .toString()
                              .split(':');

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
  res.sendStatus(401);
}

// ---------------------------------------------------------------------------
// Middleware & static file serving
// ---------------------------------------------------------------------------
app.use(morgan('tiny'));

app.use(
  express.static(ROOT_DIR, {
    extensions: ['html'], // allows "/page" -> "page.html"
    maxAge: 0             // disable caching for dev
  })
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get('/admin', basicAuth, (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'admin.html'));
});

// Fallback to user.html for any other route (SPA‑friendly)
app.use((req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'user.html'));
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\nGenAI Prompt Feedback POC running at http://localhost:${PORT}`);
  console.log(`Serving files from: ${ROOT_DIR}`);
  console.log(`Admin credentials -> user: ${ADMIN_USER}, pass: ${ADMIN_PASS}`);
});
