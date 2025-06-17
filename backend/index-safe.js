const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const moment = require("moment");
require("dotenv").config();

// Import SAFE WhatsApp service (no ban risk)
const whatsappService = require("./services/whatsapp-green");

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

// Polling for incoming messages (Green API method)
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
    "🤔 I didn't understand that. Type 'help' for assistance or 'status' to check your progress."
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

// WhatsApp status endpoint
app.get("/api/whatsapp/status", async (req, res) => {
  const info = await whatsappService.getAccountInfo();
  res.json({
    ...info,
    merchants: merchants.size,
    conversations: Array.from(merchants.values()).length,
    service: "Green API - No Ban Risk"
  });
});

// ===== MERCHANT MANAGEMENT ENDPOINTS =====

// GET /api/merchants - Get all merchants with optional detailed view
app.get("/api/merchants", (req, res) => {
  try {
    const merchantArray = Array.from(merchants.values());
    const detailed = req.query.detailed === 'true';
    
    if (detailed) {
      res.json(merchantArray);
    } else {
      // Simple view - only essential info
      const simplifiedMerchants = merchantArray.map(merchant => ({
        id: merchant.id,
        whatsappNumber: merchant.whatsappNumber,
        merchantName: merchant.merchantName,
        companyName: merchant.companyName,
        onboardingStep: merchant.onboardingStep,
        status: merchant.status,
        source: merchant.source,
        createdAt: merchant.createdAt,
        conversationHistory: merchant.conversationHistory?.length || 0,
        acquisitionTriggered: merchant.acquisitionTriggered,
        goLiveDate: merchant.goLiveDate,
        slaStatus: merchant.slaStatus,
        daysUntilGoLive: merchant.daysUntilGoLive,
        deliveryAddress: merchant.deliveryAddress
      }));
      res.json(simplifiedMerchants);
    }
  } catch (error) {
    console.error('❌ Error fetching merchants:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch merchants',
      details: error.message 
    });
  }
});

// GET /api/merchants/:phoneNumber/conversation - Get conversation history for a specific merchant
app.get("/api/merchants/:phoneNumber/conversation", (req, res) => {
  try {
    const phoneNumber = req.params.phoneNumber;
    const merchant = merchants.get(phoneNumber);
    
    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: "Merchant not found"
      });
    }
    
    res.json({
      success: true,
      merchant: {
        id: merchant.id,
        merchantName: merchant.merchantName,
        phoneNumber: merchant.whatsappNumber,
        currentStep: merchant.onboardingStep,
        status: merchant.status,
        slaStatus: merchant.slaStatus,
        daysUntilGoLive: merchant.daysUntilGoLive,
        goLiveDate: merchant.goLiveDate
      },
      conversation: merchant.conversationHistory || [],
      nextAction: getNextActionForStep(merchant.onboardingStep)
    });
  } catch (error) {
    console.error('❌ Error fetching conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation',
      details: error.message
    });
  }
});

// Helper function to suggest next action
function getNextActionForStep(step) {
  const stepActions = {
    'welcome': 'Reply with your go-live date in DD/MM/YYYY format (e.g., 25/12/2024)',
    'sla_confirmation': 'Reply "continue" to proceed with onboarding steps',
    'delivery': 'Provide your delivery address (Street, City, State, ZIP, Country)',
    'hardware': 'Choose hardware package: "basic", "standard", or "premium"',
    'training': 'Choose training type: "online", "onsite", or "self-paced"',
    'completed': 'Onboarding completed! You can ask questions or request support.'
  };
  
  return stepActions[step] || 'Continue the conversation by sending a message';
}

// Manual message sending (for testing)
app.post("/api/send", async (req, res) => {
  const { phoneNumber, message } = req.body;
  
  if (!phoneNumber || !message) {
    return res.status(400).json({ error: "Phone number and message required" });
  }
  
  const result = await whatsappService.sendTextMessage(phoneNumber, message);
  res.json(result);
});

// Test endpoint to simulate incoming messages (for testing onboarding flow)
app.post("/api/test/message", async (req, res) => {
  const { phoneNumber, message } = req.body;
  
  if (!phoneNumber || !message) {
    return res.status(400).json({ error: "Phone number and message required" });
  }
  
  try {
    console.log(`🧪 TEST: Simulating message from ${phoneNumber}: ${message}`);
    await processIncomingMessage(phoneNumber, message);
    
    // Get the merchant to see updated state
    const merchant = merchants.get(phoneNumber);
    
    res.json({
      success: true,
      message: "Message processed successfully",
      merchant: merchant ? {
        id: merchant.id,
        onboardingStep: merchant.onboardingStep,
        status: merchant.status,
        conversationLength: merchant.conversationHistory.length
      } : null
    });
  } catch (error) {
    console.error('❌ Test message error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Test endpoint to inject messages (simulates receiving WhatsApp messages)
app.post("/api/test/inject-message", async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: "phoneNumber and message are required"
      });
    }
    
    console.log(`🧪 Test: Injecting message from ${phoneNumber}: "${message}"`);
    
    // Process the message as if it came from WhatsApp
    await processIncomingMessage(phoneNumber, message);
    
    res.json({
      success: true,
      message: "Test message processed successfully",
      phoneNumber,
      injectedMessage: message
    });
    
  } catch (error) {
    console.error('❌ Error injecting test message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process test message',
      details: error.message
    });
  }
});

// Green API Webhook endpoint for incoming messages
app.post("/api/webhook/green-api", async (req, res) => {
  try {
    console.log("📥 Green API webhook received:", JSON.stringify(req.body, null, 2));
    
    const notification = req.body;
    
    // Check if this is an incoming message notification
    if (notification.typeWebhook === 'incomingMessageReceived') {
      const messageData = notification.messageData;
      const senderData = notification.senderData;
      
      if (messageData && senderData) {
        const phoneNumber = senderData.sender; // Full number with country code
        const messageBody = messageData.textMessageData?.textMessage || 
                           messageData.extendedTextMessageData?.text ||
                           '[Non-text message]';
        
        console.log(`📱 Incoming message from ${phoneNumber}: "${messageBody}"`);
        
        // Process the message using existing logic
        await processIncomingMessage(phoneNumber, messageBody);
        
        // Acknowledge the webhook
        res.status(200).json({
          success: true,
          message: "Webhook processed successfully",
          phoneNumber,
          messageBody
        });
      } else {
        console.log("⚠️ Invalid message format in webhook");
        res.status(400).json({
          success: false,
          error: "Invalid message format"
        });
      }
    } else {
      console.log(`📋 Other webhook type: ${notification.typeWebhook}`);
      // Acknowledge other webhook types
      res.status(200).json({
        success: true,
        message: "Non-message webhook acknowledged"
      });
    }
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed',
      details: error.message
    });
  }
});

// ===== MERCHANT ACQUISITION ENDPOINTS =====

// POST /api/acquisition/merchant - Add new merchant and trigger onboarding
app.post("/api/acquisition/merchant", async (req, res) => {
  try {
    const { merchantName, contactNumber, companyName, source = 'acquisition' } = req.body;
    
    // Validation
    if (!merchantName || !contactNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Merchant name and contact number are required' 
      });
    }
    
    // Clean and validate phone number
    const cleanPhoneNumber = contactNumber.replace(/\D/g, '');
    if (cleanPhoneNumber.length < 10) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid phone number format' 
      });
    }
    
    // Check if merchant already exists
    const existingMerchant = merchants.get(cleanPhoneNumber);
    if (existingMerchant) {
      return res.status(409).json({ 
        success: false, 
        error: 'Merchant with this contact number already exists',
        existingMerchant: {
          id: existingMerchant.id,
          merchantName: existingMerchant.merchantName || existingMerchant.companyName,
          status: existingMerchant.status,
          onboardingStep: existingMerchant.onboardingStep
        }
      });
    }
    
    // Create new merchant record
    const newMerchant = {
      id: `merchant-${Date.now()}`,
      whatsappNumber: cleanPhoneNumber,
      merchantName: merchantName,
      companyName: companyName || merchantName,
      onboardingStep: "triggered",
      status: "acquiring",
      source: source,
      createdAt: new Date(),
      conversationHistory: [],
      acquisitionTriggered: true
    };
    
    // Store merchant
    merchants.set(cleanPhoneNumber, newMerchant);
    
    // Trigger WhatsApp onboarding message
    const welcomeResult = await whatsappService.sendWelcomeMessage(cleanPhoneNumber, merchantName);
    
    if (welcomeResult.success) {
      newMerchant.onboardingStep = "welcome";
      newMerchant.status = "onboarding";
      newMerchant.conversationHistory.push({
        message: "Welcome message sent",
        direction: "outgoing",
        timestamp: new Date(),
        messageId: welcomeResult.messageId
      });
      
      console.log(`✅ Onboarding triggered for ${merchantName} (${cleanPhoneNumber})`);
      
      res.json({
        success: true,
        message: 'Merchant added and onboarding message sent successfully',
        merchant: {
          id: newMerchant.id,
          merchantName: newMerchant.merchantName,
          contactNumber: cleanPhoneNumber,
          status: newMerchant.status,
          onboardingStep: newMerchant.onboardingStep,
          messageId: welcomeResult.messageId
        }
      });
    } else {
      newMerchant.status = "failed";
      newMerchant.error = welcomeResult.error;
      
      res.status(500).json({
        success: false,
        error: 'Merchant added but failed to send WhatsApp message',
        details: welcomeResult.error,
        merchant: {
          id: newMerchant.id,
          merchantName: newMerchant.merchantName,
          contactNumber: cleanPhoneNumber,
          status: newMerchant.status
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error in merchant acquisition:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// GET /api/acquisition/merchants - Get all acquired merchants
app.get("/api/acquisition/merchants", (req, res) => {
  try {
    const merchantList = Array.from(merchants.values())
      .filter(merchant => merchant.source === 'acquisition')
      .map(merchant => ({
        id: merchant.id,
        merchantName: merchant.merchantName,
        companyName: merchant.companyName,
        contactNumber: merchant.whatsappNumber,
        status: merchant.status,
        onboardingStep: merchant.onboardingStep,
        createdAt: merchant.createdAt,
        conversationHistory: merchant.conversationHistory.length,
        lastActivity: merchant.conversationHistory.length > 0 
          ? merchant.conversationHistory[merchant.conversationHistory.length - 1].timestamp 
          : merchant.createdAt
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      count: merchantList.length,
      merchants: merchantList
    });
  } catch (error) {
    console.error('❌ Error fetching acquired merchants:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/acquisition/retry/:id - Retry onboarding for a merchant
app.post("/api/acquisition/retry/:id", async (req, res) => {
  try {
    const merchant = Array.from(merchants.values()).find(m => m.id === req.params.id);
    
    if (!merchant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Merchant not found' 
      });
    }
    
    // Retry welcome message
    const welcomeResult = await whatsappService.sendWelcomeMessage(merchant.whatsappNumber, merchant.merchantName);
    
    if (welcomeResult.success) {
      merchant.onboardingStep = "welcome";
      merchant.status = "onboarding";
      merchant.conversationHistory.push({
        message: "Welcome message resent",
        direction: "outgoing",
        timestamp: new Date(),
        messageId: welcomeResult.messageId
      });
      
      res.json({
        success: true,
        message: 'Onboarding message resent successfully',
        messageId: welcomeResult.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to resend onboarding message',
        details: welcomeResult.error
      });
    }
    
  } catch (error) {
    console.error('❌ Error retrying onboarding:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Welcome endpoint
app.get("/", (req, res) => {
  res.json({
    message: "🤖 WhatsApp Onboarding Assistant API (SAFE VERSION)",
    version: "1.0.0",
    service: "Green API",
    banRisk: "ZERO - Completely Safe & Legal",
    features: [
      "✅ SLA-aware onboarding flow",
      "📱 SAFE WhatsApp integration (Green API)",
      "🚨 Automatic escalation handling",
      "📊 Real-time conversation tracking",
      "🔄 Interactive step-by-step guidance",
      "🛡️ ZERO Ban Risk - Official API Partner",
      "💰 3,000 Free Messages/Month"
    ],
    endpoints: {
      health: "/health",
      whatsappStatus: "/api/whatsapp/status",
      merchants: "/api/merchants",
      sendMessage: "/api/send",
      testInject: "/api/test/inject-message"
    },
    instructions: [
      "1. Sign up at green-api.com",
      "2. Get your Instance ID and Token",
      "3. Add them to your .env file",
      "4. Send messages to your Green API WhatsApp number",
      "5. Use /api/test/inject-message to simulate replies for testing"
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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 WhatsApp Onboarding Assistant (SAFE VERSION) is ready!`);
    console.log(`🔗 API URL: http://localhost:${PORT}`);
    console.log(`📊 Merchants: http://localhost:${PORT}/api/merchants`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
    console.log(`🛡️ Service: Green API (ZERO ban risk)`);
    console.log('\n💡 How to use:');
    console.log('1. Sign up at green-api.com');
    console.log('2. Configure GREEN_API_ID_INSTANCE and GREEN_API_TOKEN_INSTANCE');
    console.log('3. Send messages to your Green API WhatsApp number');
    console.log('4. Monitor conversations at /api/merchants');
    
    // Start polling for messages
    console.log('\n📥 Starting message polling...');
    pollForMessages();
  });
}

module.exports = app; 