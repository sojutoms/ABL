const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
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
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'ABL API is running 🏀', timestamp: new Date() });
});

// Routes
app.use('/api/teams', require('./routes/teamRoutes'));
app.use('/api/players', require('./routes/playerRoutes'));
app.use('/api/games', require('./routes/gameRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/league', require('./routes/leagueRoutes'));

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 ABL Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});