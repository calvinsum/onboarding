const express = require("express");
const cors = require("cors");
const path = require("path");
const moment = require("moment");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// In-memory storage for demo conversations
const conversations = new Map();

// Demo message processing logic (same as real system)
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
      return {
        response: "🤔 I don't understand. Try: 'merchant onboarding', 'business setup', or 'MERCHANT2024'",
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
    
    const welcomeMsg = `🎉 Welcome! I'm your merchant onboarding assistant! 🚀

To get started, please share your preferred Go-Live date in DD/MM/YYYY format (e.g., 25/12/2024).

Reply with:
• Your go-live date
• "help" for assistance
• "support" to speak with an agent`;

    merchant.conversationHistory.push({
      message: messageBody,
      direction: "incoming",
      timestamp: new Date()
    });
    merchant.conversationHistory.push({
      message: welcomeMsg,
      direction: "outgoing",
      timestamp: new Date()
    });
    
    return {
      response: welcomeMsg,
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
  let response = "";
  
  // Handle common commands
  if (message === 'help') {
    response = `🆘 Help Menu:

• Send your go-live date in DD/MM/YYYY format
• Type 'support' to speak with an agent
• Type 'status' to check your progress
• Type 'restart' to begin again`;
  }
  else if (message === 'support') {
    response = `🎧 Support Request Logged

A human agent will contact you within 2 hours.
Reference ID: ${merchant.id}`;
    merchant.status = "support_requested";
  }
  else if (message === 'status') {
    response = `📊 Your Onboarding Status:

🆔 ID: ${merchant.id}
📱 Step: ${merchant.onboardingStep}
✅ Status: ${merchant.status}
📅 Started: ${merchant.createdAt.toLocaleDateString()}`;
  }
  else if (message === 'restart') {
    conversations.delete(phoneNumber);
    response = "🔄 Conversation reset. Send 'start' to begin again.";
  }
  // Check if it's a date format (DD/MM/YYYY)
  else if (messageBody.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/) && merchant.onboardingStep === "welcome") {
    const goLiveDate = moment(messageBody, "DD/MM/YYYY");
    
    if (!goLiveDate.isValid()) {
      response = "❌ Invalid date format. Please use DD/MM/YYYY (e.g., 25/12/2024)";
    } else {
      // Calculate SLA
      const today = moment();
      const daysUntilGoLive = goLiveDate.diff(today, "days");
      const slaThreshold = 5; // 5 days minimum
      const canMeetSLA = daysUntilGoLive >= slaThreshold;
      
      merchant.goLiveDate = goLiveDate.toDate();
      merchant.slaStatus = canMeetSLA ? "within_sla" : "at_risk";
      merchant.daysUntilGoLive = daysUntilGoLive;
      
      if (canMeetSLA) {
        response = `✅ Great! We can meet your Go-Live date of ${moment(goLiveDate).format("DD/MM/YYYY")}.

You have ${daysUntilGoLive} days until Go-Live.

Reply "continue" to proceed with onboarding steps.`;
        merchant.onboardingStep = "continue";
      } else {
        response = `⚠️ Your Go-Live date of ${moment(goLiveDate).format("DD/MM/YYYY")} is challenging.

With only ${daysUntilGoLive} days available, we need to escalate to our specialist team.

An onboarding manager will contact you within 2 hours.`;
        merchant.status = "escalated";
        merchant.onboardingStep = "escalated";
      }
    }
  }
  // Handle continue flow
  else if (message === 'continue' && merchant.onboardingStep === "continue") {
    merchant.onboardingStep = "delivery";
    response = `📦 Step 1: Please provide your delivery address for hardware shipment.

Format: Street, City, State, ZIP, Country`;
  }
  // Handle delivery step
  else if (merchant.onboardingStep === "delivery" && messageBody.length > 10) {
    merchant.deliveryAddress = messageBody;
    merchant.onboardingStep = "hardware";
    response = `🔧 Step 2: Choose installation type:

1️⃣ Self-installation (Free)
2️⃣ Professional installation ($99)

Reply with 1 or 2, plus preferred date if choosing option 2.`;
  }
  // Handle hardware step
  else if (merchant.onboardingStep === "hardware" && (message === '1' || message === '2')) {
    merchant.hardwareChoice = message === '1' ? 'self' : 'professional';
    merchant.onboardingStep = "products";
    response = `📋 Step 3: Upload your product list

Send a photo, PDF, or text description of your products. This helps us configure your system properly.`;
  }
  // Handle products step
  else if (merchant.onboardingStep === "products" && messageBody.length > 5) {
    merchant.productList = messageBody;
    merchant.onboardingStep = "training";
    response = `🎓 Step 4: Schedule training session

Choose:
1️⃣ Video call (recommended)
2️⃣ Phone call
3️⃣ In-person (if available)

Reply with: Type [1,2,3], Date: DD/MM/YYYY, Time: [Morning/Afternoon/Evening]`;
  }
  // Handle training step
  else if (merchant.onboardingStep === "training" && messageBody.length > 5) {
    merchant.trainingInfo = messageBody;
    merchant.onboardingStep = "confirmation";
    response = `🎉 Final Step: Review and confirm

All steps completed! Your setup summary will be sent shortly.

Reply "confirm" to finalize or "changes" to modify anything.`;
  }
  // Handle confirmation
  else if (merchant.onboardingStep === "confirmation") {
    if (message === 'confirm') {
      merchant.status = "completed";
      response = `🎉 Congratulations! Your onboarding is complete!

📋 Summary:
📅 Go-Live: ${moment(merchant.goLiveDate).format('DD/MM/YYYY')}
📦 Delivery: ${merchant.deliveryAddress}
🔧 Installation: ${merchant.hardwareChoice}
📋 Products: Configured
🎓 Training: Scheduled

✅ You'll receive confirmation emails shortly.
📞 Support: Type 'support' anytime for help!`;
    } else if (message === 'changes') {
      merchant.onboardingStep = "delivery";
      response = `🔄 Let's review your information. Starting from delivery address...

📦 Step 1: Please provide your delivery address for hardware shipment.

Format: Street, City, State, ZIP, Country`;
    }
  }
  else {
    // Default response for unrecognized input
    response = "🤔 I didn't understand that. Type 'help' for assistance or 'status' to check your progress.";
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

// API endpoint to send a message and get response
app.post('/api/demo/message', async (req, res) => {
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
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation history
app.get('/api/demo/conversation/:phoneNumber', (req, res) => {
  const merchant = conversations.get(req.params.phoneNumber);
  if (merchant) {
    res.json(merchant);
  } else {
    res.json({ conversationHistory: [] });
  }
});

// Get all conversations
app.get('/api/demo/conversations', (req, res) => {
  const allConversations = Array.from(conversations.values());
  res.json({
    total: allConversations.length,
    conversations: allConversations
  });
});

// Reset conversation
app.delete('/api/demo/conversation/:phoneNumber', (req, res) => {
  conversations.delete(req.params.phoneNumber);
  res.json({ success: true, message: 'Conversation reset' });
});

// Demo web interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Onboarding Assistant - Demo</title>
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
            background: #25D366;
            color: white;
            padding: 20px;
            text-align: center;
        }
        
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        
        .header p {
            margin: 10px 0 0;
            opacity: 0.9;
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
            padding: 20px;
            background: #e5ddd5;
        }
        
        .message {
            margin: 10px 0;
            display: flex;
        }
        
        .message.incoming {
            justify-content: flex-start;
        }
        
        .message.outgoing {
            justify-content: flex-end;
        }
        
        .message-bubble {
            max-width: 70%;
            padding: 12px 16px;
            border-radius: 18px;
            white-space: pre-wrap;
            font-size: 14px;
            line-height: 1.4;
        }
        
        .message.incoming .message-bubble {
            background: white;
            border-bottom-left-radius: 4px;
        }
        
        .message.outgoing .message-bubble {
            background: #dcf8c6;
            border-bottom-right-radius: 4px;
        }
        
        .input-area {
            padding: 20px;
            border-top: 1px solid #ddd;
            background: white;
        }
        
        .input-group {
            display: flex;
            gap: 10px;
        }
        
        .input-group input {
            flex: 1;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 25px;
            font-size: 16px;
            outline: none;
        }
        
        .input-group button {
            background: #25D366;
            color: white;
            border: none;
            border-radius: 50%;
            width: 48px;
            height: 48px;
            cursor: pointer;
            font-size: 18px;
        }
        
        .input-group button:hover {
            background: #128C7E;
        }
        
        .quick-actions {
            margin-top: 15px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .quick-btn {
            background: #e3f2fd;
            border: 1px solid #2196f3;
            color: #1976d2;
            padding: 8px 12px;
            border-radius: 15px;
            font-size: 12px;
            cursor: pointer;
        }
        
        .quick-btn:hover {
            background: #2196f3;
            color: white;
        }
        
        .stats {
            background: #f5f5f5;
            padding: 15px;
            text-align: center;
            border-top: 1px solid #ddd;
        }
        
        .stats button {
            background: #ff9800;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 15px;
            cursor: pointer;
            margin: 0 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 WhatsApp Onboarding Assistant</h1>
            <p>🎭 DEMO MODE - Test the conversation flow</p>
        </div>
        
        <div class="phone-input">
            <input type="text" id="phoneNumber" placeholder="Enter phone number (e.g., +1234567890)" value="+1234567890">
        </div>
        
        <div class="chat-container" id="chatContainer">
            <div class="message outgoing">
                <div class="message-bubble">
                    👋 Hi! I'm your WhatsApp Onboarding Assistant demo!
                    
                    Try sending:
                    • "merchant onboarding"
                    • "business setup" 
                    • "MERCHANT2024"
                    • Or just "start"
                </div>
            </div>
        </div>
        
        <div class="input-area">
            <div class="input-group">
                <input type="text" id="messageInput" placeholder="Type a message..." onkeypress="handleKeyPress(event)">
                <button onclick="sendMessage()">▶</button>
            </div>
            
            <div class="quick-actions">
                <button class="quick-btn" onclick="sendQuickMessage('start')">Start</button>
                <button class="quick-btn" onclick="sendQuickMessage('merchant onboarding')">Merchant Onboarding</button>
                <button class="quick-btn" onclick="sendQuickMessage('25/12/2024')">Go-Live Date</button>
                <button class="quick-btn" onclick="sendQuickMessage('continue')">Continue</button>
                <button class="quick-btn" onclick="sendQuickMessage('help')">Help</button>
                <button class="quick-btn" onclick="sendQuickMessage('status')">Status</button>
            </div>
        </div>
        
        <div class="stats">
            <button onclick="resetConversation()">🔄 Reset Chat</button>
            <button onclick="viewAllConversations()">📊 All Conversations</button>
            <button onclick="exportData()">💾 Export Data</button>
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
            const message = document.getElementById('messageInput').value;
            
            if (!message.trim()) return;
            
            // Add user message to chat
            addMessageToChat(message, 'incoming');
            document.getElementById('messageInput').value = '';
            
            try {
                const response = await fetch('/api/demo/message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ phoneNumber, message })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Add bot response to chat
                    setTimeout(() => {
                        addMessageToChat(data.response, 'outgoing');
                    }, 500);
                } else {
                    addMessageToChat('❌ Error: ' + data.error, 'outgoing');
                }
            } catch (error) {
                addMessageToChat('❌ Connection error', 'outgoing');
            }
        }
        
        function addMessageToChat(message, type) {
            const chatContainer = document.getElementById('chatContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + type;
            messageDiv.innerHTML = '<div class="message-bubble">' + message + '</div>';
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        async function resetConversation() {
            const phoneNumber = document.getElementById('phoneNumber').value;
            
            try {
                await fetch('/api/demo/conversation/' + encodeURIComponent(phoneNumber), {
                    method: 'DELETE'
                });
                
                // Clear chat
                document.getElementById('chatContainer').innerHTML = \`
                    <div class="message outgoing">
                        <div class="message-bubble">
                            🔄 Conversation reset! Try sending "start" or "merchant onboarding"
                        </div>
                    </div>
                \`;
            } catch (error) {
                alert('Error resetting conversation');
            }
        }
        
        async function viewAllConversations() {
            try {
                const response = await fetch('/api/demo/conversations');
                const data = await response.json();
                
                const popup = window.open('', '_blank', 'width=800,height=600');
                popup.document.write(\`
                    <html>
                        <head><title>All Conversations</title></head>
                        <body>
                            <h1>All Demo Conversations (\${data.total})</h1>
                            <pre>\${JSON.stringify(data, null, 2)}</pre>
                        </body>
                    </html>
                \`);
            } catch (error) {
                alert('Error loading conversations');
            }
        }
        
        async function exportData() {
            try {
                const response = await fetch('/api/demo/conversations');
                const data = await response.json();
                
                const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'whatsapp-demo-data.json';
                a.click();
            } catch (error) {
                alert('Error exporting data');
            }
        }
    </script>
</body>
</html>
  `);
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    mode: "DEMO",
    conversations: conversations.size,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🎭 WhatsApp Onboarding Assistant - DEMO MODE`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Demo URL: http://localhost:${PORT}`);
  console.log(`📱 Interactive WhatsApp simulation ready!`);
  console.log(`💡 Perfect for team demos and testing!`);
  console.log(`🎯 Features:`);
  console.log(`   • Full conversation flow simulation`);
  console.log(`   • Multiple phone number testing`);
  console.log(`   • Real-time chat interface`);
  console.log(`   • Export conversation data`);
  console.log(`   • Zero WhatsApp dependencies`);
}); 