const axios = require('axios');
const moment = require("moment");

class OfficialWhatsAppService {
  constructor() {
    // Official WhatsApp Business API - 100% Free tier
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.apiVersion = 'v21.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  async sendTextMessage(to, message) {
    try {
      if (!this.accessToken || !this.phoneNumberId) {
        console.log('⚠️ WhatsApp Business API not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID');
        return { success: false, error: 'API not configured' };
      }

      const cleanPhoneNumber = to.replace(/\D/g, '');
      
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: cleanPhoneNumber,
          type: "text",
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Official WhatsApp message sent to ${to}: ${response.data.messages[0].id}`);
      return { success: true, messageId: response.data.messages[0].id };
    } catch (error) {
      console.error(`❌ Failed to send official WhatsApp message to ${to}:`, error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
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

  // Webhook verification for official API
  verifyWebhook(mode, token, challenge) {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token';
    
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook verified successfully');
      return challenge;
    } else {
      console.error('❌ Webhook verification failed');
      return null;
    }
  }

  // Process incoming webhook from official API
  processWebhook(body) {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      
      if (value?.messages && value.messages.length > 0) {
        const message = value.messages[0];
        const from = message.from;
        const messageBody = message.text?.body || '';
        const messageId = message.id;
        
        console.log(`📥 Official WhatsApp webhook - From: ${from}, Message: ${messageBody}`);
        
        return {
          phoneNumber: from,
          message: messageBody,
          messageId: messageId,
          timestamp: message.timestamp
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error processing official WhatsApp webhook:', error);
      return null;
    }
  }
}

module.exports = new OfficialWhatsAppService(); 