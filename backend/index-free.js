const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const moment = require("moment");
require("dotenv").config();

// Import free WhatsApp service
const whatsappService = require("./services/whatsapp-free");

const app = express();
const PORT = process.env.PORT || 3000;

// Security and middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));

// In-memory storage for merchants (no MongoDB required for testing)
const merchants = new Map();

// Setup message handler for incoming WhatsApp messages
whatsappService.onMessage(async (phoneNumber, messageBody, message) => {
  console.log(`🔄 Processing message from ${phoneNumber}: ${messageBody}`);
  
  let merchant = merchants.get(phoneNumber);
  
  if (!merchant) {
    // New merchant
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
    
    // Send welcome message
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
});

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
    "🤔 I didn't understand that. Type 'help' for assistance or 'status' to check your progress."
  );
}

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    whatsappReady: whatsappService.isReady
  });
});

// WhatsApp status endpoint
app.get("/api/whatsapp/status", async (req, res) => {
  const info = await whatsappService.getClientInfo();
  res.json({
    ...info,
    merchants: merchants.size,
    conversations: Array.from(merchants.values()).length
  });
});

// Get all merchants
app.get("/api/merchants", (req, res) => {
  const merchantList = Array.from(merchants.values()).map(merchant => ({
    ...merchant,
    conversationHistory: merchant.conversationHistory.length // Just count, don't expose full history
  }));
  res.json(merchantList);
});

// Get specific merchant
app.get("/api/merchants/:id", (req, res) => {
  const merchant = Array.from(merchants.values()).find(m => m.id === req.params.id);
  if (!merchant) {
    return res.status(404).json({ error: "Merchant not found" });
  }
  res.json(merchant);
});

// Manual message sending (for testing)
app.post("/api/send", async (req, res) => {
  const { phoneNumber, message } = req.body;
  
  if (!phoneNumber || !message) {
    return res.status(400).json({ error: "Phone number and message required" });
  }
  
  const result = await whatsappService.sendTextMessage(phoneNumber, message);
  res.json(result);
});

// Welcome endpoint
app.get("/", (req, res) => {
  res.json({
    message: "🤖 WhatsApp Onboarding Assistant API (Free Version)",
    version: "1.0.0",
    whatsappReady: whatsappService.isReady,
    features: [
      "✅ SLA-aware onboarding flow",
      "📱 FREE WhatsApp integration (no Twilio needed!)",
      "🚨 Automatic escalation handling",
      "📊 Real-time conversation tracking",
      "🔄 Interactive step-by-step guidance",
      "💰 100% Free - No API costs!"
    ],
    endpoints: {
      health: "/health",
      whatsappStatus: "/api/whatsapp/status",
      merchants: "/api/merchants",
      sendMessage: "/api/send"
    },
    instructions: [
      "1. Scan QR code with your WhatsApp mobile app",
      "2. Send a message to this WhatsApp number from any phone",
      "3. Follow the onboarding flow",
      "4. Check merchant data at /api/merchants"
    ]
  });
});

// Error handling
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((error, req, res, next) => {
  console.error("❌ Express error:", error);
  res.status(500).json({ error: "Internal server error" });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  await whatsappService.destroy();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received, shutting down gracefully");
  await whatsappService.destroy();
  process.exit(0);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 WhatsApp Onboarding Assistant (FREE VERSION) is ready!`);
    console.log(`🔗 API URL: http://localhost:${PORT}`);
    console.log(`📊 Merchants: http://localhost:${PORT}/api/merchants`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
    console.log('\n💡 How to use:');
    console.log('1. Wait for QR code to appear below');
    console.log('2. Scan it with your WhatsApp mobile app');
    console.log('3. Send a message to this WhatsApp number from any phone');
    console.log('4. Follow the onboarding conversation flow!');
  });
}

module.exports = app; 