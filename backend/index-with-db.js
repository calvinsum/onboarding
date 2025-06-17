const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Import routes
const onboardingRoutes = require("./routes/onboarding");
const webhookRoutes = require("./routes/webhook");
const adminRoutes = require("./routes/admin");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

// Security and middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests, please try again later.",
});
app.use(limiter);

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/whatsapp-onboarding");
    console.log("🗄️  MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Routes
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api/admin", adminRoutes);

// Welcome endpoint
app.get("/", (req, res) => {
  res.json({
    message: "🤖 WhatsApp Onboarding Assistant API",
    version: "1.0.0",
    features: [
      "✅ SLA-aware onboarding flow",
      "📱 WhatsApp integration via Twilio",
      "🚨 Automatic escalation handling",
      "📊 Admin dashboard and analytics",
      "🔄 Interactive step-by-step guidance"
    ],
    endpoints: {
      health: "/health",
      onboarding: "/api/onboarding",
      webhook: "/api/webhook/whatsapp",
      admin: "/api/admin",
    },
  });
});

// Error handling
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});
app.use(errorHandler);

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  await mongoose.connection.close();
  process.exit(0);
});

if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 WhatsApp Onboarding Assistant is ready!`);
      console.log(`🔗 API URL: http://localhost:${PORT}`);
      console.log(`📊 Admin Dashboard: http://localhost:${PORT}/api/admin/dashboard`);
    });
  });
}

module.exports = app;