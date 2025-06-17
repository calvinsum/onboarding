const express = require('express');
const cors = require('cors');
require('dotenv').config();

const greenApiService = require('./services/whatsapp-green');
const llmService = require('./services/llm');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory merchant storage (for demo - use MongoDB in production)
const merchants = new Map();

// Enhanced message processing with LLM
async function processIncomingMessage(phoneNumber, messageBody) {
  console.log(`📥 Processing message from ${phoneNumber}: ${messageBody}`);
  
  let merchant = merchants.get(phoneNumber);
  
  if (!merchant) {
    // Check for business keywords to activate onboarding
    const businessKeywords = [
      'onboarding', 'merchant', 'business', 'setup', 'go-live', 'golive',
      'store', 'shop', 'payment', 'pos', 'terminal', 'help', 'support',
      'start', 'begin', 'register', 'signup', 'sign up', 'join', 'MERCHANT2024'
    ];
    
    const messageText = messageBody.toLowerCase();
    const isBusinessMessage = businessKeywords.some(keyword => 
      messageText.includes(keyword)
    ) || messageBody.toUpperCase().trim() === 'MERCHANT2024';
    
    if (!isBusinessMessage) {
      console.log(`🛡️ Non-business message from ${phoneNumber}, ignoring`);
      return; // Don't respond to non-business messages
    }
    
    // Create new merchant
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
    console.log(`👤 New merchant created: ${merchant.id}`);
  }
  
  // Add message to conversation history
  merchant.conversationHistory.push({
    message: messageBody,
    direction: "incoming",
    timestamp: new Date()
  });
  
  try {
    // Generate intelligent response using LLM
    const llmResponse = await llmService.generateResponse(merchant, messageBody, {
      currentStep: merchant.onboardingStep,
      conversationLength: merchant.conversationHistory.length,
      isRealWhatsApp: true
    });
    
    let responseMessage = llmResponse.message;
    
    // Apply any step updates from LLM analysis
    if (llmResponse.stepUpdate) {
      merchant.onboardingStep = llmResponse.stepUpdate;
      console.log(`📊 Step updated to: ${merchant.onboardingStep}`);
    }
    
    // Apply any extracted data
    if (llmResponse.dataExtracted && Object.keys(llmResponse.dataExtracted).length > 0) {
      Object.assign(merchant, llmResponse.dataExtracted);
      console.log(`💾 Data extracted:`, llmResponse.dataExtracted);
    }
    
    // Handle special actions
    if (llmResponse.nextAction) {
      switch (llmResponse.nextAction) {
        case 'support':
          merchant.status = "support_requested";
          console.log(`🎧 Support requested by ${phoneNumber}`);
          break;
        case 'status':
          responseMessage = llmService.generateProgressSummary(merchant);
          break;
        case 'restart':
          merchants.delete(phoneNumber);
          console.log(`🔄 Conversation reset for ${phoneNumber}`);
          responseMessage = "🔄 Conversation reset. Send 'merchant onboarding' to begin again.";
          break;
      }
    }
    
    // Handle completion
    if (merchant.onboardingStep === 'completed' && !merchant.completionSent) {
      merchant.completionSent = true;
      merchant.status = 'completed';
      responseMessage = `🎉 Congratulations! Your onboarding is complete!

📋 Summary:
📅 Go-Live: ${merchant.goLiveDate ? new Date(merchant.goLiveDate).toLocaleDateString() : 'Not set'}
📦 Delivery: ${merchant.deliveryAddress || 'Not provided'}
🔧 Installation: ${merchant.hardwareChoice || 'Not selected'}
📋 Products: ${merchant.productList ? 'Configured' : 'Not provided'}
🎓 Training: ${merchant.trainingInfo ? 'Scheduled' : 'Not scheduled'}

✅ You'll receive confirmation emails shortly.
📞 Support: Type 'support' anytime for help!`;
    }
    
    // Send response via Green API
    const result = await greenApiService.sendTextMessage(phoneNumber, responseMessage);
    
    if (result.success) {
      merchant.conversationHistory.push({
        message: responseMessage,
        direction: "outgoing",
        timestamp: new Date()
      });
      console.log(`✅ Response sent to ${phoneNumber}`);
    } else {
      console.error(`❌ Failed to send response to ${phoneNumber}:`, result.error);
    }
    
  } catch (error) {
    console.error(`❌ Error processing message from ${phoneNumber}:`, error);
    
    // Fallback response
    const fallbackMessage = "🤖 I'm having trouble processing that. Please try again or type 'help' for assistance.";
    await greenApiService.sendTextMessage(phoneNumber, fallbackMessage);
  }
}

// Polling for new messages
async function pollForMessages() {
  try {
    const notification = await greenApiService.receiveNotification();
    
    if (notification && notification.phoneNumber && notification.message) {
      await processIncomingMessage(notification.phoneNumber, notification.message);
    }
  } catch (error) {
    console.error('Error receiving notification:', error);
  }
}

// API Routes
app.get('/', (req, res) => {
  const llmStatus = llmService.defaultProvider || 'fallback';
  const llmIndicator = llmStatus === 'fallback' ? '⚠️ Fallback Mode' : `🤖 ${llmStatus.toUpperCase()} Powered`;
  
  res.json({
    service: 'WhatsApp Onboarding Assistant (LLM + Green API)',
    status: 'running',
    llmProvider: llmStatus,
    timestamp: new Date(),
    endpoints: {
      status: '/api/whatsapp/status',
      merchants: '/api/merchants',
      health: '/health'
    }
  });
});

app.get('/api/whatsapp/status', async (req, res) => {
  try {
    const accountInfo = await greenApiService.getAccountInfo();
    res.json({
      service: 'LLM + Green API',
      llmProvider: llmService.defaultProvider || 'fallback',
      greenApi: accountInfo.error ? 'Not configured' : 'Connected',
      timestamp: new Date()
    });
  } catch (error) {
    res.json({
      service: 'LLM + Green API',
      llmProvider: llmService.defaultProvider || 'fallback',
      greenApi: 'Error',
      error: error.message,
      timestamp: new Date()
    });
  }
});

app.get('/api/merchants', (req, res) => {
  const merchantList = Array.from(merchants.values()).map(merchant => ({
    ...merchant,
    conversationHistory: merchant.conversationHistory.slice(-5) // Last 5 messages only
  }));
  
  res.json({
    total: merchantList.length,
    llmProvider: llmService.defaultProvider || 'fallback',
    merchants: merchantList
  });
});

app.get('/api/merchants/:phoneNumber', (req, res) => {
  const merchant = merchants.get(req.params.phoneNumber);
  if (merchant) {
    res.json(merchant);
  } else {
    res.status(404).json({ error: 'Merchant not found' });
  }
});

app.delete('/api/merchants/:phoneNumber', (req, res) => {
  const deleted = merchants.delete(req.params.phoneNumber);
  res.json({ 
    success: deleted, 
    message: deleted ? 'Merchant deleted' : 'Merchant not found' 
  });
});

app.get('/api/llm/status', (req, res) => {
  res.json({
    provider: llmService.defaultProvider,
    availableProviders: Object.keys(llmService.providers),
    fallbackMode: !llmService.defaultProvider,
    timestamp: new Date()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'WhatsApp Onboarding Assistant - LLM + Green API',
    llmProvider: llmService.defaultProvider || 'fallback',
    activeMerchants: merchants.size,
    timestamp: new Date()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date()
  });
});

// Start server and polling
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🎭 WhatsApp Onboarding Assistant - LLM + GREEN API MODE`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 API URL: http://localhost:${PORT}`);
  console.log(`📊 Merchants: http://localhost:${PORT}/api/merchants`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`🤖 LLM Provider: ${llmService.defaultProvider || 'fallback mode'}`);
  console.log(`🛡️ Service: Green API + LLM (ZERO ban risk)`);
  console.log(`💡 Features:`);
  console.log(`   • Natural language understanding with LLM`);
  console.log(`   • Context-aware intelligent responses`);
  console.log(`   • Smart data extraction and validation`);
  console.log(`   • Professional WhatsApp integration`);
  console.log(`   • Graceful fallback system`);
  console.log(`💡 How to use:`);
  console.log(`1. Configure GREEN_API_ID_INSTANCE and GREEN_API_TOKEN_INSTANCE`);
  console.log(`2. Optionally configure LLM provider (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)`);
  console.log(`3. Send messages to your Green API WhatsApp number`);
  console.log(`4. Monitor conversations at /api/merchants`);
  
  // Check Green API configuration
  if (!process.env.GREEN_API_ID_INSTANCE || !process.env.GREEN_API_TOKEN_INSTANCE) {
    console.log(`⚠️ Green API not configured. Set GREEN_API_ID_INSTANCE and GREEN_API_TOKEN_INSTANCE`);
  } else {
    console.log(`✅ Green API configured`);
  }
  
  // Start message polling
  console.log(`📥 Starting LLM-powered message polling...`);
  setInterval(pollForMessages, 2000); // Poll every 2 seconds
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