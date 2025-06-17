const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
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
// Middleware to remove morgan logging for health checks
app.use((req, res, next) => {
    if (req.path === '/health') {
        return next();
    }
    morgan("combined")(req, res, next);
});

// Serve static files from public directory
app.use(express.static('public'));

// In-memory storage for merchants
const merchants = new Map();

// Setup app.locals for sharing data between routes
app.locals.merchants = merchants;
app.locals.whatsappService = whatsappService;
app.locals.handleIncomingMessage = handleIncomingMessage;

// ===== ROUTES =====

// Staff-facing Merchant Acquisition UI
app.get("/staff/onboard", (req, res) => {
    res.sendFile(path.join(__dirname, '../public/merchant-acquisition.html'));
});

// API Routes
app.use('/api/webhook', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/acquisition', acquisitionRoutes);

// ===== Health and Status =====

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: "Green API (Safe & Legal)"
  });
});

app.get('/api/merchants', (req, res) => {
    const detailed = req.query.detailed === 'true';
    const merchantArray = Array.from(app.locals.merchants.values());
    
    if (detailed) {
        res.json(merchantArray);
    } else {
        const summary = merchantArray.map(m => ({
            id: m.id,
            businessName: m.businessName,
            phoneNumber: m.whatsappNumber,
            status: m.status,
            onboardingStep: m.onboardingStep,
            createdAt: m.createdAt
        }));
        res.json(summary);
    }
});

// ===== Server Startup =====

const server = app.listen(PORT, () => {
  console.log('🚀 Server running on port ${PORT}');
  console.log("📱 WhatsApp Onboarding Assistant (SAFE/WEBHOOK) is ready!");
  console.log('🔗 API URL: http://localhost:${PORT}');
  console.log('💼 Staff UI: http://localhost:${PORT}/staff/onboard');
  console.log('📊 Merchants: http://localhost:${PORT}/api/merchants');
  console.log('🏥 Health: http://localhost:${PORT}/health');
});

process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ All connections closed');
        process.exit(0);
    });
}); 