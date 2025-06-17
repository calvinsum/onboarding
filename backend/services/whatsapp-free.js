const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const moment = require("moment");

class FreeWhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.messageHandlers = new Map();
    this.initializeClient();
  }

  initializeClient() {
    console.log('🔄 Initializing WhatsApp Web client...');
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: "whatsapp-onboarding-assistant"
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });

    this.client.on('qr', (qr) => {
      console.log('\n📱 Scan this QR code with your WhatsApp mobile app:');
      console.log('─'.repeat(50));
      qrcode.generate(qr, { small: true });
      console.log('─'.repeat(50));
      console.log('👆 Open WhatsApp on your phone → Settings → Linked Devices → Link a Device');
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp Web client is ready!');
      this.isReady = true;
    });

    this.client.on('authenticated', () => {
      console.log('🔐 WhatsApp authenticated successfully!');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ Authentication failed:', msg);
    });

    this.client.on('disconnected', (reason) => {
      console.log('🔌 WhatsApp disconnected:', reason);
      this.isReady = false;
    });

    // Handle incoming messages
    this.client.on('message_create', async (message) => {
      // Only process messages sent TO us (not from us)
      if (!message.fromMe && message.body) {
        const contact = await message.getContact();
        const phoneNumber = contact.number;
        
        console.log(`📥 Received message from ${phoneNumber}: ${message.body}`);
        
        // Trigger webhook-like processing
        if (this.messageHandlers.has('incoming')) {
          this.messageHandlers.get('incoming')(phoneNumber, message.body, message);
        }
      }
    });

    this.client.initialize();
  }

  // Register message handler (replaces webhook)
  onMessage(handler) {
    this.messageHandlers.set('incoming', handler);
  }

  async sendTextMessage(to, message) {
    try {
      if (!this.isReady) {
        console.log('⏳ WhatsApp client not ready yet. Please scan QR code first.');
        return { success: false, error: 'Client not ready' };
      }

      // Format phone number (remove whatsapp: prefix if present)
      const phoneNumber = to.replace('whatsapp:', '').replace('+', '');
      const chatId = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
      
      await this.client.sendMessage(chatId, message);
      console.log(`✅ Message sent to ${phoneNumber}`);
      return { success: true, messageId: `msg_${Date.now()}` };
    } catch (error) {
      console.error(`❌ Failed to send message to ${to}:`, error);
      return { success: false, error: error.message };
    }
  }

  async sendWelcomeMessage(to, businessName = "") {
    const greeting = businessName ? `Hello ${businessName}! 👋` : "Hello! 👋";
    const message = `${greeting}\n\nWelcome to our onboarding assistant! 🚀\n\nTo get started, please share your preferred Go-Live date in DD/MM/YYYY format (e.g., 25/12/2024).\n\nReply with:\n• Your go-live date\n• "help" for assistance\n• "support" to speak with an agent`;
    return await this.sendTextMessage(to, message);
  }

  async sendSLAResult(to, slaResult) {
    let message = "";
    if (slaResult.canMeetSLA) {
      message = `✅ Great! We can meet your Go-Live date of ${moment(slaResult.goLiveDate).format("DD/MM/YYYY")}.\n\nYou have ${slaResult.daysUntilGoLive} days until Go-Live.\n\nReply "continue" to proceed with onboarding steps.`;
    } else {
      message = `⚠️ Your Go-Live date of ${moment(slaResult.goLiveDate).format("DD/MM/YYYY")} is challenging.\n\nWith only ${slaResult.daysUntilGoLive} days available, we need to escalate to our specialist team.\n\nAn onboarding manager will contact you within 2 hours.`;
    }
    return await this.sendTextMessage(to, message);
  }

  async sendStepMessage(to, step) {
    const stepMessages = {
      delivery: "📦 Step 1: Please provide your delivery address for hardware shipment.\n\nFormat: Street, City, State, ZIP, Country",
      hardware: "🔧 Step 2: Choose installation type:\n\n1️⃣ Self-installation (Free)\n2️⃣ Professional installation ($99)\n\nReply with 1 or 2, plus preferred date if choosing option 2.",
      products: "📋 Step 3: Upload your product list\n\nSend a photo, PDF, or text description of your products. This helps us configure your system properly.",
      training: "🎓 Step 4: Schedule training session\n\nChoose:\n1️⃣ Video call (recommended)\n2️⃣ Phone call\n3️⃣ In-person (if available)\n\nReply with: Type [1,2,3], Date: DD/MM/YYYY, Time: [Morning/Afternoon/Evening]",
      confirmation: "🎉 Final Step: Review and confirm\n\nAll steps completed! Your setup summary will be sent shortly.\n\nReply \"confirm\" to finalize or \"changes\" to modify anything."
    };
    const message = stepMessages[step] || "Invalid step";
    return await this.sendTextMessage(to, message);
  }

  async getClientInfo() {
    if (!this.isReady) {
      return { ready: false, message: 'Please scan QR code first' };
    }
    
    try {
      const info = this.client.info;
      return {
        ready: true,
        phone: info.wid.user,
        platform: info.platform,
        name: info.pushname
      };
    } catch (error) {
      return { ready: false, error: error.message };
    }
  }

  async destroy() {
    if (this.client) {
      await this.client.destroy();
    }
  }
}

module.exports = new FreeWhatsAppService(); 