const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');
const notFound = require('./src/middleware/notFound');

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001')
      .split(',')
      .map(s => s.trim()),
    methods: ['GET', 'POST'],
  },
});

// Attach io to app so controllers can access it
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Join a specific game room for live updates
  socket.on('joinGame', (gameId) => {
    socket.join(`game_${gameId}`);
    console.log(`📺 Client ${socket.id} joined game_${gameId}`);
  });

  socket.on('leaveGame', (gameId) => {
    socket.leave(`game_${gameId}`);
    console.log(`👋 Client ${socket.id} left game_${gameId}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'ABL API is running 🏀', timestamp: new Date() });
});

// Routes
app.use('/api/teams', require('./src/routes/teamRoutes'));
app.use('/api/players', require('./src/routes/playerRoutes'));
app.use('/api/games', require('./src/routes/gameRoutes'));
app.use('/api/stats', require('./src/routes/statsRoutes'));
app.use('/api/league', require('./src/routes/leagueRoutes'));

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 ABL Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
