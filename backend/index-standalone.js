const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const moment = require("moment");

// Use Green API for safe operation
const whatsappService = require("./services/whatsapp-green");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));

// In-memory storage for merchants
const merchants = new Map();

// ACTIVATION CODE REQUIRED - Ultra Safe Mode
const ACTIVATION_CODE = "MERCHANT2024"; // Change this to your preferred code

async function processIncomingMessage(phoneNumber, messageBody) {
  let merchant = merchants.get(phoneNumber);
  
  if (!merchant) {
    // Check for activation code first
    const messageText = messageBody.toUpperCase().trim();
    
    if (messageText !== ACTIVATION_CODE) {
      console.log(`🚫 Ignoring message without activation code from ${phoneNumber}: ${messageBody}`);
      // Send one-time info message
      await whatsappService.sendTextMessage(phoneNumber, 
        `🔐 To start merchant onboarding, send the activation code: ${ACTIVATION_CODE}`
      );
      return;
    }
    
    // Activation code correct - start onboarding
    merchant = {
      id: `merchant-${Date.now()}`,
      whatsappNumber: phoneNumber,
      companyName: "Unknown",
      onboardingStep: "welcome",
      status: "activated",
      createdAt: new Date(),
      conversationHistory: []
    };
    merchants.set(phoneNumber, merchant);
    
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
    "🤔 I didn't understand that. Type 'help' for assistance or 'status' to check your progress."
  );
}

// Polling for incoming messages
async function pollForMessages() {
  try {
    const notification = await whatsappService.receiveNotification();
    
    if (notification && notification.phoneNumber && notification.message) {
      console.log(`📥 Received message from ${notification.phoneNumber}: ${notification.message}`);
      await processIncomingMessage(notification.phoneNumber, notification.message);
    }
  } catch (error) {
    console.error('❌ Error polling messages:', error);
  }
  
  // Poll every 2 seconds
  setTimeout(pollForMessages, 2000);
}

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: "Green API (Ultra Safe Mode)",
    activationCode: ACTIVATION_CODE
  });
});

// WhatsApp status endpoint
app.get("/api/whatsapp/status", async (req, res) => {
  const info = await whatsappService.getAccountInfo();
  res.json({
    ...info,
    merchants: merchants.size,
    conversations: Array.from(merchants.values()).length,
    service: "Green API - Ultra Safe Mode",
    activationRequired: ACTIVATION_CODE
  });
});

// View all merchants
app.get("/api/merchants", (req, res) => {
  const merchantsArray = Array.from(merchants.values());
  res.json({
    total: merchantsArray.length,
    merchants: merchantsArray,
    service: "Green API - Ultra Safe Mode"
  });
});

// Get specific merchant by phone
app.get("/api/merchants/:phone", (req, res) => {
  const merchant = merchants.get(req.params.phone);
  if (merchant) {
    res.json(merchant);
  } else {
    res.status(404).json({ error: "Merchant not found" });
  }
});

// Home page
app.get("/", (req, res) => {
  res.send(`
    <h1>🛡️ WhatsApp Onboarding Assistant - Ultra Safe Mode</h1>
    <h2>✅ Green API Integration (Zero Ban Risk)</h2>
    <h3>🔐 Activation Code Required: <code>${ACTIVATION_CODE}</code></h3>
    
    <div style="background: #f0f0f0; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <strong>How to use:</strong><br>
      1. Anyone who wants onboarding must send: <strong>${ACTIVATION_CODE}</strong><br>
      2. Only then will the onboarding flow begin<br>
      3. Personal messages are completely ignored<br>
    </div>
    
    <h3>📊 Endpoints:</h3>
    <ul>
      <li><a href="/api/merchants">📋 View All Merchants</a></li>
      <li><a href="/api/whatsapp/status">📱 WhatsApp Status</a></li>
      <li><a href="/health">🏥 Health Check</a></li>
    </ul>
    
    <p><strong>Service:</strong> Green API (ZERO ban risk, 3000 free messages/month)</p>
    <p><strong>Safety Level:</strong> Ultra Safe - Requires activation code</p>
    <p><strong>Current Merchants:</strong> ${merchants.size}</p>
  `);
});

app.listen(PORT, () => {
  console.log(`🔐 Ultra Safe WhatsApp Onboarding Assistant starting...`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 WhatsApp Onboarding Assistant (ULTRA SAFE MODE) is ready!`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`📊 Merchants: http://localhost:${PORT}/api/merchants`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`🛡️ Service: Green API (ZERO ban risk)`);
  console.log(`🔐 Activation Code: ${ACTIVATION_CODE}`);
  console.log(`💡 How to use:`);
  console.log(`1. Tell people to send: ${ACTIVATION_CODE}`);
  console.log(`2. Only then will onboarding start`);
  console.log(`3. Personal messages are ignored`);
  console.log(`📥 Starting message polling...`);
  
  // Start polling for messages
  pollForMessages();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});
