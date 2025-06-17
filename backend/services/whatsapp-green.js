const whatsAppClient = require('@green-api/whatsapp-api-client');
const moment = require("moment");

class GreenWhatsAppService {
  constructor() {
    this.init();
  }

  init() {
    this.idInstance = process.env.GREEN_API_ID_INSTANCE;
    this.apiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
    
    console.log(`🔍 Environment check: ID=${this.idInstance ? 'SET' : 'NOT SET'}, Token=${this.apiTokenInstance ? 'SET' : 'NOT SET'}`);
    
    if (this.idInstance && this.apiTokenInstance) {
      try {
        this.restAPI = whatsAppClient.restAPI({
          idInstance: this.idInstance,
          apiTokenInstance: this.apiTokenInstance
        });
        console.log('✅ Green API WhatsApp client initialized');
        console.log('🔍 Available API methods:', Object.keys(this.restAPI));
      } catch (error) {
        console.error('❌ Failed to initialize Green API client:', error);
        this.restAPI = null;
      }
    } else {
      console.log('⚠️ Green API not configured. Set GREEN_API_ID_INSTANCE and GREEN_API_TOKEN_INSTANCE');
      this.restAPI = null;
    }
  }

  async sendTextMessage(to, message) {
    try {
      if (!this.idInstance || !this.apiTokenInstance) {
        console.log('⚠️ Green API not configured');
        return { success: false, error: 'API not configured' };
      }

      // Clean phone number (remove any non-digits)
      const cleanPhoneNumber = to.replace(/\D/g, '');
      const chatId = `${cleanPhoneNumber}@c.us`;
      
      // Use direct HTTP API call
      const url = `https://api.green-api.com/waInstance${this.idInstance}/sendMessage/${this.apiTokenInstance}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatId: chatId,
          message: message
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`❌ Green API HTTP error ${response.status}:`, errorData);
        return { success: false, error: `HTTP ${response.status}: ${errorData}` };
      }
      
      const data = await response.json();
      
      if (data.idMessage) {
        console.log(`✅ Green API message sent to ${to}: ${data.idMessage}`);
        return { success: true, messageId: data.idMessage };
      } else {
        console.error(`❌ Green API error:`, data);
        return { success: false, error: data };
      }
    } catch (error) {
      console.error(`❌ Failed to send Green API message to ${to}:`, error);
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

  async getAccountInfo() {
    try {
      if (!this.idInstance || !this.apiTokenInstance) {
        return { 
          error: 'API not configured',
          configured: false,
          idInstance: this.idInstance ? 'Set' : 'Missing',
          tokenInstance: this.apiTokenInstance ? 'Set' : 'Missing'
        };
      }
      
      // Use direct HTTP API call
      const url = `https://api.green-api.com/waInstance${this.idInstance}/getSettings/${this.apiTokenInstance}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        return { error: `HTTP ${response.status}`, configured: false };
      }
      
      const data = await response.json();
      return { ...data, configured: true };
    } catch (error) {
      return { error: error.message, configured: false };
    }
  }

  async receiveNotification() {
    try {
      if (!this.idInstance || !this.apiTokenInstance) {
        return null;
      }
      
      // Use direct HTTP API call instead of the library
      const url = `https://api.green-api.com/waInstance${this.idInstance}/receiveNotification/${this.apiTokenInstance}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`❌ receiveNotification HTTP error ${response.status}: ${await response.text()}`);
        return null;
      }
      
      const notification = await response.json();
      console.log('🔍 Raw notification received:', JSON.stringify(notification, null, 2));
      
      if (!notification) {
        return null;
      }
      
      // Handle different types of incoming messages
      if (notification.typeWebhook === 'incomingMessageReceived') {
        const messageData = notification.messageData;
        const phoneNumber = messageData.chatId.replace('@c.us', '');
        const messageText = messageData.textMessageData?.textMessage || '';
        
        console.log(`📱 Incoming message from ${phoneNumber}: "${messageText}"`);
        
        // Delete the notification after processing
        if (notification.receiptId) {
          await this.deleteNotificationByReceiptId(notification.receiptId);
        }
        
        return {
          phoneNumber: phoneNumber,
          message: messageText,
          messageId: notification.idMessage,
          timestamp: notification.timestamp,
          receiptId: notification.receiptId
        };
      }
      
      // For other webhook types, just delete the notification
      if (notification.receiptId) {
        await this.deleteNotificationByReceiptId(notification.receiptId);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error receiving notification:', error);
      return null;
    }
  }

  async deleteNotificationByReceiptId(receiptId) {
    try {
      if (!this.idInstance || !this.apiTokenInstance || !receiptId) {
        return false;
      }
      
      const url = `https://api.green-api.com/waInstance${this.idInstance}/deleteNotification/${this.apiTokenInstance}/${receiptId}`;
      
      const response = await fetch(url, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log(`🗑️ Deleted notification ${receiptId}`);
      }
      
      return response.ok;
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      return false;
    }
  }
}

module.exports = new GreenWhatsAppService(); 