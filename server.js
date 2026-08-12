require('dotenv').config();

const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const initSockets = require('./sockets');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chat');
const metricsRoutes = require('./routes/metrics');
const clockRoutes = require('./routes/clocks');
const meetingRoutes = require('./routes/meetings');
const inboxRoutes = require('./routes/inbox');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
});
app.set('io', io);

// --- Security & parsing middleware ---
app.use(
  helmet({
    contentSecurityPolicy: false, // relaxed for the bundled static frontend; tighten if you add a CDN-only policy
  })
);
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// --- Static frontend ---
app.use(express.static(path.join(__dirname, 'public')));

// --- API routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/clocks', clockRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/inbox', inboxRoutes);

// Health check for Render/Railway
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// SPA-style fallback: unknown non-API routes get the dashboard shell
// (client-side auth guard in dashboard.js redirects to login.html if unauthenticated)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Central error handler ---
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

initSockets(io);

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`[Server] Pryme X Command Center live on port ${PORT}`);
  });
}

start();

module.exports = { app, server };
