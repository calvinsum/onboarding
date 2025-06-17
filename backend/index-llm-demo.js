const express = require("express");
const cors = require("cors");
const path = require("path");
const moment = require("moment");
require('dotenv').config();

const llmService = require('./services/llm');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// In-memory storage for demo conversations
const conversations = new Map();

// LLM-powered message processing
async function processMessage(phoneNumber, messageBody) {
  let merchant = conversations.get(phoneNumber);
  
  if (!merchant) {
    // Check for business keywords or activation code
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
      // Use LLM to generate a more intelligent "not understood" response
      const llmResponse = await llmService.generateResponse(null, messageBody, {
        isNewConversation: true,
        noBusinessContext: true
      });
      
      return {
        response: llmResponse.message || "🤔 I don't understand. Try: 'merchant onboarding', 'business setup', or 'MERCHANT2024'",
        merchant: null
      };
    }
    
    // New merchant - business inquiry detected
    merchant = {
      id: `merchant-${Date.now()}`,
      whatsappNumber: phoneNumber,
      companyName: "Unknown",
      onboardingStep: "welcome",
      status: "activated",
      createdAt: new Date(),
      conversationHistory: []
    };
    conversations.set(phoneNumber, merchant);
    
    // Add initial message to history
    merchant.conversationHistory.push({
      message: messageBody,
      direction: "incoming",
      timestamp: new Date()
    });
    
    // Generate intelligent welcome message using LLM
    const llmResponse = await llmService.generateResponse(merchant, messageBody, {
      isWelcome: true,
      isNewMerchant: true
    });
    
    const response = llmResponse.message || `🎉 Welcome! I'm your merchant onboarding assistant! 🚀

To get started, please share your preferred Go-Live date in DD/MM/YYYY format (e.g., 25/12/2024).

Reply with:
• Your go-live date
• "help" for assistance
• "support" to speak with an agent`;

    merchant.conversationHistory.push({
      message: response,
      direction: "outgoing",
      timestamp: new Date()
    });
    
    return {
      response: response,
      merchant: merchant
    };
  }
  
  // Add to conversation history
  merchant.conversationHistory.push({
    message: messageBody,
    direction: "incoming",
    timestamp: new Date()
  });
  
  const message = messageBody.toLowerCase().trim();
  
  // Handle restart command immediately
  if (message === 'restart') {
    conversations.delete(phoneNumber);
    return { 
      response: "🔄 Conversation reset. Send 'start' to begin again.",
      merchant: null
    };
  }
  
  let response = "";
  
  try {
    // Use LLM to generate intelligent response
    const llmResponse = await llmService.generateResponse(merchant, messageBody, {
      currentStep: merchant.onboardingStep,
      conversationLength: merchant.conversationHistory.length
    });
    
    response = llmResponse.message;
    
    // Apply any step updates from LLM analysis
    if (llmResponse.stepUpdate) {
      merchant.onboardingStep = llmResponse.stepUpdate;
    }
    
    // Apply any extracted data
    if (llmResponse.dataExtracted && Object.keys(llmResponse.dataExtracted).length > 0) {
      Object.assign(merchant, llmResponse.dataExtracted);
    }
    
    // Handle special actions
    if (llmResponse.nextAction) {
      switch (llmResponse.nextAction) {
        case 'help':
          // LLM already generated help response
          break;
        case 'support':
          merchant.status = "support_requested";
          break;
        case 'status':
          response = llmService.generateProgressSummary(merchant);
          break;
        case 'restart':
          conversations.delete(phoneNumber);
          return { 
            response: "🔄 Conversation reset. Send 'start' to begin again.",
            merchant: null
          };
      }
    }
    
    // Handle completion
    if (merchant.onboardingStep === 'completed' && !merchant.completionSent) {
      merchant.completionSent = true;
      response = `🎉 Congratulations! Your onboarding is complete!

📋 Summary:
📅 Go-Live: ${merchant.goLiveDate ? moment(merchant.goLiveDate).format('DD/MM/YYYY') : 'Not set'}
📦 Delivery: ${merchant.deliveryAddress || 'Not provided'}
🔧 Installation: ${merchant.hardwareChoice || 'Not selected'}
📋 Products: ${merchant.productList ? 'Configured' : 'Not provided'}
🎓 Training: ${merchant.trainingInfo ? 'Scheduled' : 'Not scheduled'}

✅ You'll receive confirmation emails shortly.
📞 Support: Type 'support' anytime for help!`;
    }
    
  } catch (error) {
    console.error('❌ LLM Processing Error:', error);
    // Fallback to basic response
    response = "🤖 I'm having trouble processing that. Please try again or type 'help' for assistance.";
  }
  
  // Add response to conversation history
  merchant.conversationHistory.push({
    message: response,
    direction: "outgoing",
    timestamp: new Date()
  });
  
  return {
    response: response,
    merchant: merchant
  };
}

// API endpoints
app.post('/api/llm-demo/message', async (req, res) => {
  const { phoneNumber, message } = req.body;
  
  if (!phoneNumber || !message) {
    return res.status(400).json({ error: 'Phone number and message required' });
  }
  
  try {
    const result = await processMessage(phoneNumber, message);
    res.json({
      success: true,
      response: result.response,
      merchant: result.merchant,
      timestamp: new Date(),
      llmPowered: true
    });
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/llm-demo/conversation/:phoneNumber', (req, res) => {
  const merchant = conversations.get(req.params.phoneNumber);
  if (merchant) {
    res.json(merchant);
  } else {
    res.json({ conversationHistory: [] });
  }
});

app.get('/api/llm-demo/conversations', (req, res) => {
  const allConversations = Array.from(conversations.values());
  res.json({
    total: allConversations.length,
    conversations: allConversations,
    llmProvider: llmService.defaultProvider || 'fallback'
  });
});

app.get('/api/llm-demo/status', (req, res) => {
  res.json({
    llmProvider: llmService.defaultProvider,
    availableProviders: Object.keys(llmService.providers),
    fallbackMode: !llmService.defaultProvider,
    timestamp: new Date()
  });
});

app.delete('/api/llm-demo/conversation/:phoneNumber', (req, res) => {
  conversations.delete(req.params.phoneNumber);
  res.json({ success: true, message: 'Conversation reset' });
});

// Demo web interface 
app.get('/', (req, res) => {
  const llmStatus = llmService.defaultProvider || 'fallback';
  const llmIndicator = llmStatus === 'fallback' ? '⚠️ Fallback Mode' : `🤖 ${llmStatus.toUpperCase()} Powered`;
  
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Onboarding Assistant - LLM Demo</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
            color: white;
            padding: 20px;
            text-align: center;
            position: relative;
        }
        
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        
        .header p {
            margin: 10px 0 0;
            opacity: 0.9;
        }
        
        .llm-status {
            position: absolute;
            top: 10px;
            right: 15px;
            background: rgba(255,255,255,0.2);
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
        }
        
        .phone-input {
            background: #f0f0f0;
            padding: 15px;
            border-bottom: 1px solid #ddd;
        }
        
        .phone-input input {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
        }
        
        .chat-container {
            height: 400px;
            overflow-y: auto;
            background: #e5ddd5;
            background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="whatsapp-bg" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="%23ffffff" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23whatsapp-bg)"/></svg>');
            padding: 20px;
        }
        
        .message {
            margin: 10px 0;
            display: flex;
        }
        
        .message.outgoing {
            justify-content: flex-end;
        }
        
        .message-bubble {
            max-width: 70%;
            padding: 12px 16px;
            border-radius: 18px;
            word-wrap: break-word;
            white-space: pre-wrap;
            position: relative;
        }
        
        .message.incoming .message-bubble {
            background: white;
            border-bottom-left-radius: 4px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        
        .message.outgoing .message-bubble {
            background: #dcf8c6;
            border-bottom-right-radius: 4px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        
        .message-time {
            font-size: 11px;
            color: #666;
            margin-top: 5px;
            text-align: right;
        }
        
        .input-area {
            background: #f0f0f0;
            padding: 15px;
            display: flex;
            gap: 10px;
        }
        
        .input-area input {
            flex: 1;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 25px;
            outline: none;
        }
        
        .send-btn {
            background: #25D366;
            color: white;
            border: none;
            border-radius: 50%;
            width: 45px;
            height: 45px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        
        .send-btn:hover {
            background: #128C7E;
        }
        
        .quick-actions {
            padding: 15px;
            background: #f8f9fa;
            border-top: 1px solid #ddd;
        }
        
        .quick-actions h4 {
            margin-bottom: 10px;
            color: #333;
        }
        
        .quick-btn {
            background: #25D366;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 15px;
            margin: 5px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        }
        
        .quick-btn:hover {
            background: #128C7E;
        }
        
        .info-panel {
            padding: 20px;
            background: #f8f9fa;
            border-top: 1px solid #ddd;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        
        .info-card {
            background: white;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .info-card h5 {
            color: #25D366;
            margin-bottom: 8px;
        }
        
        .feature-highlight {
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
            color: white;
            padding: 10px;
            border-radius: 8px;
            margin: 10px 0;
            text-align: center;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="llm-status">${llmIndicator}</div>
            <h1>🤖 LLM-Powered WhatsApp Assistant</h1>
            <p>Intelligent onboarding with AI conversation</p>
        </div>
        
        <div class="feature-highlight">
            ✨ Now with Advanced LLM: Natural conversation, context understanding, and intelligent responses!
        </div>
        
        <div class="phone-input">
            <input type="tel" id="phoneNumber" placeholder="Enter phone number (e.g., +1234567890)" value="+1234567890">
        </div>
        
        <div class="chat-container" id="chatContainer">
            <div class="message incoming">
                <div class="message-bubble">
                    🤖 Welcome to the LLM-powered onboarding assistant! I can understand natural language and provide intelligent responses.<br><br>Try saying "Hi, I need help setting up my business" or "I want to onboard as a merchant"
                    <div class="message-time">System • Now</div>
                </div>
            </div>
        </div>
        
        <div class="input-area">
            <input type="text" id="messageInput" placeholder="Type your message..." onkeypress="handleKeyPress(event)">
            <button class="send-btn" onclick="sendMessage()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
            </button>
        </div>
        
        <div class="quick-actions">
            <h4>🚀 Try these intelligent prompts:</h4>
            <button class="quick-btn" onclick="sendQuickMessage('I want to start merchant onboarding')">Start Onboarding</button>
            <button class="quick-btn" onclick="sendQuickMessage('My go-live date is 25/12/2024')">Set Go-Live Date</button>
            <button class="quick-btn" onclick="sendQuickMessage('I need help with the process')">Get Help</button>
            <button class="quick-btn" onclick="sendQuickMessage('What is my current status?')">Check Status</button>
            <button class="quick-btn" onclick="sendQuickMessage('Can you explain the next step?')">Next Step</button>
            <button class="quick-btn" onclick="sendQuickMessage('I want to speak to support')">Contact Support</button>
        </div>
        
        <div class="info-panel">
            <h4>🧠 LLM Features Active:</h4>
            <div class="info-grid">
                <div class="info-card">
                    <h5>🎯 Natural Language</h5>
                    <p>Understands conversational input, not just commands</p>
                </div>
                <div class="info-card">
                    <h5>🧠 Context Awareness</h5>
                    <p>Remembers conversation history and maintains context</p>
                </div>
                <div class="info-card">
                    <h5>📊 Smart Data Extraction</h5>
                    <p>Automatically extracts dates, addresses, and preferences</p>
                </div>
                <div class="info-card">
                    <h5>🛡️ Graceful Fallback</h5>
                    <p>Falls back to rule-based responses if LLM fails</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        function handleKeyPress(event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        }
        
        function sendQuickMessage(message) {
            document.getElementById('messageInput').value = message;
            sendMessage();
        }
        
        async function sendMessage() {
            const phoneNumber = document.getElementById('phoneNumber').value;
            const message = document.getElementById('messageInput').value.trim();
            
            if (!message) return;
            
            // Add user message to chat
            addMessage(message, 'outgoing');
            document.getElementById('messageInput').value = '';
            
            try {
                const response = await fetch('/api/llm-demo/message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        phoneNumber: phoneNumber,
                        message: message
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    addMessage(result.response, 'incoming');
                } else {
                    addMessage('Error: ' + result.error, 'incoming');
                }
            } catch (error) {
                addMessage('Connection error: ' + error.message, 'incoming');
            }
        }
        
        function addMessage(text, type) {
            const chatContainer = document.getElementById('chatContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + type;
            
            const now = new Date();
            const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            messageDiv.innerHTML = \`
                <div class="message-bubble">
                    \${text}
                    <div class="message-time">\${timeString}</div>
                </div>
            \`;
            
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        // Auto-focus on message input
        document.getElementById('messageInput').focus();
    </script>
</body>
</html>
  `);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'WhatsApp Onboarding Assistant - LLM Demo',
    timestamp: new Date(),
    llmProvider: llmService.defaultProvider || 'fallback',
    availableProviders: Object.keys(llmService.providers),
    activeConversations: conversations.size
  });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`🎭 WhatsApp Onboarding Assistant - LLM DEMO MODE`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Demo URL: http://localhost:${PORT}`);
  console.log(`🤖 LLM Provider: ${llmService.defaultProvider || 'fallback mode'}`);
  console.log(`📱 Interactive LLM-powered WhatsApp simulation ready!`);
  console.log(`💡 Advanced features:`);
  console.log(`   • Natural language understanding`);
  console.log(`   • Context-aware responses`);
  console.log(`   • Intelligent data extraction`);
  console.log(`   • Multiple LLM provider support`);
  console.log(`   • Graceful fallback system`);
  console.log(`🎯 Features:`);
  console.log(`   • Full conversation flow simulation`);
  console.log(`   • Multiple phone number testing`);
  console.log(`   • Real-time chat interface`);
  console.log(`   • Export conversation data`);
  console.log(`   • Zero WhatsApp dependencies`);
}); 