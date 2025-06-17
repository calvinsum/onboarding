const twilio = require("twilio");
const moment = require("moment");

class WhatsAppService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
  }

  async sendTextMessage(to, message) {
    try {
      const response = await this.client.messages.create({
        body: message,
        from: this.whatsappNumber,
        to: `whatsapp:${to}`,
      });
      console.log(`✅ Message sent to ${to}: ${response.sid}`);
      return { success: true, messageId: response.sid };
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
}

module.exports = new WhatsAppService();