import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js'
import errorHandler from './middleware/errorHandler.js'

import authRoutes from './routes/authRoutes.js'
import documentRoutes from './routes/documentRoutes.js'
import flashcardRoutes from './routes/flashcardRoutes.js'
import aiRoutes from './routes/aiRoutes.js'
import quizRoutes from './routes/quizRoutes.js'
import progressRoutes from './routes/progressRoutes.js'

// Initialize express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware to handle CORS
// Uploaded PDFs now live on Vercel Blob (not this server) and auth is a
// header-based JWT rather than a cookie, so a specific allowed origin is
// enough here — `credentials: true` isn't needed and was previously an
// invalid combination alongside a wildcard `origin`.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/flashcards', flashcardRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/quizzes', quizRoutes)
app.use('/api/progress', progressRoutes)

app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    statusCode: 404
  });
});

process.on('unhandledRejection', (err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});

// On Vercel, this file is imported by api/index.js and invoked per-request
// as a serverless function — it never calls `.listen()`. Locally there's no
// `VERCEL` env var, so `npm run dev` still starts a normal long-running
// server exactly as before.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
}

export default app;