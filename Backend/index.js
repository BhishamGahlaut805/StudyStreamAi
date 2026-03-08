const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ quiet: true });

// Import routes
const authRoutes = require("./routes/authRoutes");
const testRoutes = require("./routes/testRoutes");
const studentRoutes = require("./routes/studentRoutes");
const questionRoutes = require("./Services/questionRoutes");
const retentionSessionRoutes = require("./routes/retentionSessionRoutes");
const retentionScheduleRoutes = require("./routes/retentionScheduleRoutes");
const retentionMetricsRoutes = require("./routes/retentionMetricsRoutes");
const retentionAnalyticsRoutes = require("./routes/retentionAnalyticsRoutes");
const questionRepetitionRoutes = require("./routes/questionRepetitionRoutes");
const retentionFlaskBridgeRoutes = require("./routes/retentionFlaskBridgeRoutes");
const {
  initializeRetentionSocket,
} = require("./Services/retentionSocketHandler");

// Import socket handler
const { initializeTestSocket } = require("./sockets/testSocket");

// Import services
const timerService = require("./Services/timerService");
const analyticsService = require("./Services/analyticsService");
const flaskApiService = require("./Services/flaskAPIService");

const app = express();
const server = http.createServer(app);

// CORS configuration
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

// Socket.IO configuration
const io = socketIo(server, {
  cors: {
    origin: corsOptions.origin,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ==================== Middleware ====================
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(cors(corsOptions));

// Rate limiting
const isRetentionSessionPath = (req) => {
  const pathName = String(req.originalUrl || req.path || "");
  return /\/retention\/sessions\//.test(pathName);
};

const isRetentionRepetitionPath = (req) => {
  const pathName = String(req.originalUrl || req.path || "");
  return /\/retention\/repetitions\//.test(pathName);
};

const isRetentionInteractivePath = (req) => {
  const pathName = String(req.originalUrl || req.path || "");
  return /\/retention\/sessions\/[^/]+\/(submit|next|complete|state)(\?|$)/.test(
    pathName,
  );
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  skip: (req) => isRetentionSessionPath(req) || isRetentionRepetitionPath(req),
});

const retentionInteractiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message:
    "Too many retention requests in a short time. Please retry in a moment.",
});
app.use("/api/", limiter);
app.use("/api/retention/sessions", (req, res, next) =>
  retentionInteractiveLimiter(req, res, next),
);
app.use("/api/retention/repetitions", (req, res, next) =>
  isRetentionInteractivePath(req) || isRetentionRepetitionPath(req)
    ? retentionInteractiveLimiter(req, res, next)
    : next(),
);

// Static files
app.use("/exports", express.static(path.join(__dirname, "exports")));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ==================== Database Connection ====================
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MongoDB URI not found in environment variables");
    }

    await mongoose.connect(mongoUri);

    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

connectDB();

// ==================== Services Initialization ====================
const timerServiceInstance = timerService(io);

// Attach services to app
app.set("timerService", timerServiceInstance);
app.set("analyticsService", analyticsService);
app.set("io", io);
app.set("flaskApiService", flaskApiService);

// Check Flask health on startup (silent)
flaskApiService.healthCheck().catch(() => null);

// ==================== Routes ====================
app.use("/api/auth", authRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/questions", questionRoutes);

app.use("/api/retention/sessions", retentionSessionRoutes);
app.use("/api/retention/schedules", retentionScheduleRoutes);
app.use("/api/retention/metrics", retentionMetricsRoutes);
app.use("/api/retention/analytics", retentionAnalyticsRoutes);
app.use("/api/retention/repetitions", questionRepetitionRoutes);
app.use("/api/ml", retentionFlaskBridgeRoutes);

// Health check endpoints
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      socket: "active",
      flask: flaskApiService ? "available" : "unavailable",
    },
  });
});

// ==================== Socket.IO ====================
initializeTestSocket(io, timerServiceInstance, analyticsService);
initializeRetentionSocket(io);

// ==================== Error Handling ====================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ==================== Start Server ====================
const PORT = process.env.PORT || 5000;
const MAX_PORT_BIND_RETRIES = 10;
let portBindRetries = 0;

const startServer = () => {
  server.listen(PORT, () => {
    portBindRetries = 0;
    console.log(`Server running on port ${PORT}`);
  });
};

server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && portBindRetries < MAX_PORT_BIND_RETRIES) {
    portBindRetries += 1;
    setTimeout(() => {
      startServer();
    }, 500);
    return;
  }

  throw error;
});

startServer();

// Graceful shutdown
let isShuttingDown = false;
const gracefulShutdown = async (signal, done) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    timerServiceInstance.cleanup();

    await new Promise((resolve) => {
      server.close(() => resolve());
    });

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false);
    }
  } catch (error) {
    console.error(`Error during ${signal} shutdown:`, error.message);
  } finally {
    if (typeof done === "function") {
      done();
    } else {
      process.exit(0);
    }
  }
};

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM");
});

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT");
});

process.once("SIGUSR2", () => {
  gracefulShutdown("SIGUSR2", () => {
    process.kill(process.pid, "SIGUSR2");
  });
});

module.exports = { app, server, io };
