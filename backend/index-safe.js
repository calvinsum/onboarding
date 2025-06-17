const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

// Import services and routes
const whatsappService = require("./services/whatsapp-green");
const { handleIncomingMessage } = require("./services/onboardingService");
const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');
const acquisitionRoutes = require('./routes/acquisition');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));

// Serve static files from public directory
app.use(express.static('public'));

// In-memory storage for merchants
const merchants = new Map();

// Setup app.locals for sharing data between routes
app.locals.merchants = merchants;
app.locals.whatsappService = whatsappService;
app.locals.handleIncomingMessage = handleIncomingMessage;

// Mount routers
app.use('/api/webhook', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/acquisition', acquisitionRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: "Green API (Safe & Legal)"
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("📱 WhatsApp Onboarding Assistant (SAFE/WEBHOOK) is ready!");
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`📊 Merchants: http://localhost:${PORT}/api/merchants`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

module.exports = { app, server }; 