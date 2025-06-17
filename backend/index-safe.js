const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const moment = require("moment");
require("dotenv").config();

// Import SAFE WhatsApp service (no ban risk)
const whatsappService = require("./services/whatsapp-green");
const webhookRoutes = require('./routes/webhook');

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

// Mount the webhook router to handle incoming messages
app.use('/api/webhook', webhookRoutes);

// This function is now called by the webhook handler
async function processIncomingMessage(phoneNumber, messageBody) {
  let merchant = merchants.get(phoneNumber);
  
  if (!merchant) {
    // Check if message contains business keywords before starting onboarding
    const businessKeywords = [
      'onboarding', 'merchant', 'business', 'setup', 'go-live', 'golive',
      'store', 'shop', 'payment', 'pos', 'terminal', 'help', 'support',
      'start', 'begin', 'register', 'signup', 'sign up', 'join'
    ];
    
    const messageText = messageBody.toLowerCase();
    const isBusinessMessage = businessKeywords.some(keyword => 
      messageText.includes(keyword)
    );
    
    // Only start onboarding if it looks like a business inquiry
    if (!isBusinessMessage) {
      console.log(`🚫 Ignoring non-business message from ${phoneNumber}: ${messageBody}`);
      return; // Don't respond to casual messages
    }
    
    // New merchant - business inquiry detected
    merchant = {
      id: `merchant-${Date.now()}`,
      whatsappNumber: phoneNumber,
      companyName: "Unknown",
      onboardingStep: "welcome",
      status: "not_started",
      createdAt: new Date(),
      conversationHistory: []
    };
    merchants.set(phoneNumber, merchant);
    
    // Send welcome message only for business inquiries
    await whatsappService.sendWelcomeMessage(phoneNumber);
    return;
  }
  
  // Add to conversation history
  merchant.conversationHistory.push({
    message: messageBody,
    direction: "incoming",
    timestamp: new Date()
  });
  
  // Process based on current step
  await processMessage(merchant, messageBody);
}

async function processMessage(merchant, messageBody) {
  const phoneNumber = merchant.whatsappNumber;
  const message = messageBody.toLowerCase().trim();
  
  // Handle common commands
  if (message === 'help') {
    await whatsappService.sendTextMessage(phoneNumber, 
      "🆘 Help Menu:\n\n" +
      "• Send your go-live date in DD/MM/YYYY format\n" +
      "• Type 'support' to speak with an agent\n" +
      "• Type 'status' to check your progress\n" +
      "• Type 'restart' to begin again"
    );
    return;
  }
  
  if (message === 'support') {
    await whatsappService.sendTextMessage(phoneNumber,
      "🎧 Support Request Logged\n\n" +
      "A human agent will contact you within 2 hours.\n" +
      "Reference ID: " + merchant.id
    );
    merchant.status = "support_requested";
    return;
  }
  
  if (message === 'status') {
    const statusMsg = `📊 Your Onboarding Status:\n\n` +
      `🆔 ID: ${merchant.id}\n` +
      `📱 Step: ${merchant.onboardingStep}\n` +
      `✅ Status: ${merchant.status}\n` +
      `📅 Started: ${merchant.createdAt.toLocaleDateString()}`;
    await whatsappService.sendTextMessage(phoneNumber, statusMsg);
    return;
  }
  
  // Check if it's a date format (DD/MM/YYYY)
  const dateMatch = messageBody.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateMatch && merchant.onboardingStep === "welcome") {
    const goLiveDate = moment(messageBody, "DD/MM/YYYY");
    
    if (!goLiveDate.isValid()) {
      await whatsappService.sendTextMessage(phoneNumber,
        "❌ Invalid date format. Please use DD/MM/YYYY (e.g., 25/12/2024)"
      );
      return;
    }
    
    // Calculate SLA
    const today = moment();
    const daysUntilGoLive = goLiveDate.diff(today, "days");
    const slaThreshold = 5; // 5 days minimum
    const canMeetSLA = daysUntilGoLive >= slaThreshold;
    
    merchant.goLiveDate = goLiveDate.toDate();
    merchant.slaStatus = canMeetSLA ? "within_sla" : "at_risk";
    merchant.daysUntilGoLive = daysUntilGoLive;
    
    // Send SLA result
    await whatsappService.sendSLAResult(phoneNumber, {
      canMeetSLA,
      goLiveDate: goLiveDate.toDate(),
      daysUntilGoLive
    });
    
    if (canMeetSLA) {
      merchant.onboardingStep = "continue";
    } else {
      merchant.status = "escalated";
      merchant.onboardingStep = "escalated";
    }
    return;
  }
  
  // Handle continue flow
  if (message === 'continue' && merchant.onboardingStep === "continue") {
    merchant.onboardingStep = "delivery";
    await whatsappService.sendStepMessage(phoneNumber, "delivery");
    return;
  }
  
  // Handle delivery step
  if (merchant.onboardingStep === "delivery" && messageBody.length > 10) {
    merchant.deliveryAddress = messageBody;
    merchant.onboardingStep = "hardware";
    await whatsappService.sendStepMessage(phoneNumber, "hardware");
    return;
  }
  
  // Handle hardware step
  if (merchant.onboardingStep === "hardware" && (message === '1' || message === '2')) {
    merchant.hardwareChoice = message === '1' ? 'self' : 'professional';
    merchant.onboardingStep = "products";
    await whatsappService.sendStepMessage(phoneNumber, "products");
    return;
  }
  
  // Handle products step
  if (merchant.onboardingStep === "products" && messageBody.length > 5) {
    merchant.productList = messageBody;
    merchant.onboardingStep = "training";
    await whatsappService.sendStepMessage(phoneNumber, "training");
    return;
  }
  
  // Handle training step
  if (merchant.onboardingStep === "training" && messageBody.length > 5) {
    merchant.trainingInfo = messageBody;
    merchant.onboardingStep = "confirmation";
    await whatsappService.sendStepMessage(phoneNumber, "confirmation");
    return;
  }
  
  // Handle confirmation
  if (merchant.onboardingStep === "confirmation") {
    if (message === 'confirm') {
      merchant.status = "completed";
      await whatsappService.sendTextMessage(phoneNumber,
        "🎉 Congratulations! Your onboarding is complete!\n\n" +
        "📋 Summary:\n" +
        `📅 Go-Live: ${moment(merchant.goLiveDate).format('DD/MM/YYYY')}\n` +
        `📦 Delivery: ${merchant.deliveryAddress}\n` +
        `🔧 Installation: ${merchant.hardwareChoice}\n` +
        `📋 Products: Configured\n` +
        `🎓 Training: Scheduled\n\n` +
        "✅ You'll receive confirmation emails shortly.\n" +
        "📞 Support: Type 'support' anytime for help!"
      );
    } else if (message === 'changes') {
      merchant.onboardingStep = "delivery";
      await whatsappService.sendTextMessage(phoneNumber,
        "🔄 Let's review your information. Starting from delivery address..."
      );
      await whatsappService.sendStepMessage(phoneNumber, "delivery");
    }
    return;
  }
  
  // Default response for unrecognized input
  await whatsappService.sendTextMessage(phoneNumber,
    "🤔 I'm sorry, I didn't understand that. Please type 'help' for a list of commands."
  );
}

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: "Green API (Safe & Legal)"
  });
});

// ===== Admin & Dashboard Endpoints =====
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// ===== Test Endpoints (for development) =====
const testRoutes = require('./routes/test');
app.use('/api/test', testRoutes);

// ===== Merchant Acquisition Endpoints =====
const acquisitionRoutes = require('./routes/acquisition');
app.use('/api/acquisition', acquisitionRoutes);

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("📱 WhatsApp Onboarding Assistant (SAFE VERSION) is ready!");
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`📊 Merchants: http://localhost:${PORT}/api/merchants`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log("🛡️ Service: Green API (ZERO ban risk)");
  console.log("✅ Webhook handler is active. Polling is disabled.");
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Make the app and its processIncomingMessage function available for import
module.exports = { app, processIncomingMessage }; 