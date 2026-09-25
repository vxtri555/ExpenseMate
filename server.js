require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const connectDB = require('./config/db');
const expenseRoutes = require('./routes/expenses');
const budgetRoutes = require('./routes/budget');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ---------- Security & parsing ----------
app.use(helmet({ contentSecurityPolicy: false })); // secure HTTP headers (CSP off so CDN chart + font load)
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '10kb' }));           // reject huge request bodies
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 })); // basic abuse protection

// ---------- Frontend (PWA) ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- API ----------
app.get('/api/health', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));
// When MongoDB is not connected, data routes reply 503 and the frontend switches to offline mode
const requireDB = (req, res, next) =>
  mongoose.connection.readyState === 1 ? next() : res.status(503).json({ error: 'Offline mode: MongoDB not connected', offline: true });
app.use('/api/expenses', requireDB, expenseRoutes);
app.use('/api/budget', requireDB, budgetRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }));
app.use(errorHandler);

// ---------- Start ----------
// The server always starts; MongoDB is optional (offline mode if missing or unreachable)
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`🚀 ExpenseMate running at http://localhost:${PORT}`);
  const online = await connectDB();
  console.log(online ? '📦 Mode: ONLINE (MongoDB Atlas)' : '📴 Mode: OFFLINE (browser storage) - open the app, it works fully');
});
