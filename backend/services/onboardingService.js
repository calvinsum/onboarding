const moment = require("moment");

async function processMessage(merchant, messageBody, whatsappService) {
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
    
    const today = moment();
    const daysUntilGoLive = goLiveDate.diff(today, "days");
    const slaThreshold = 5; // 5 days minimum
    const canMeetSLA = daysUntilGoLive >= slaThreshold;
    
    merchant.goLiveDate = goLiveDate.toDate();
    merchant.slaStatus = canMeetSLA ? "within_sla" : "at_risk";
    merchant.daysUntilGoLive = daysUntilGoLive;
    
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

  if (message === 'continue' && merchant.onboardingStep === "continue") {
    merchant.onboardingStep = "delivery";
    await whatsappService.sendStepMessage(phoneNumber, "delivery");
    return;
  }

  if (merchant.onboardingStep === "delivery" && messageBody.length > 10) {
    merchant.deliveryAddress = messageBody;
    merchant.onboardingStep = "hardware";
    await whatsappService.sendStepMessage(phoneNumber, "hardware");
    return;
  }

  if (merchant.onboardingStep === "hardware" && (message === '1' || message === '2')) {
    merchant.hardwareChoice = message === '1' ? 'self' : 'professional';
    merchant.onboardingStep = "products";
    await whatsappService.sendStepMessage(phoneNumber, "products");
    return;
  }

  if (merchant.onboardingStep === "products" && messageBody.length > 5) {
    merchant.productList = messageBody;
    merchant.onboardingStep = "training";
    await whatsappService.sendStepMessage(phoneNumber, "training");
    return;
  }

  if (merchant.onboardingStep === "training" && messageBody.length > 5) {
    merchant.trainingInfo = messageBody;
    merchant.onboardingStep = "confirmation";
    await whatsappService.sendStepMessage(phoneNumber, "confirmation");
    return;
  }

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

  await whatsappService.sendTextMessage(phoneNumber,
    "🤔 I'm sorry, I didn't understand that. Please type 'help' for a list of commands."
  );
}

async function handleIncomingMessage(phoneNumber, messageBody, merchants, whatsappService) {
  let merchant = merchants.get(phoneNumber);
  
  if (!merchant) {
    const businessKeywords = [
      'onboarding', 'merchant', 'business', 'setup', 'go-live', 'golive',
      'store', 'shop', 'payment', 'pos', 'terminal', 'help', 'support',
      'start', 'begin', 'register', 'signup', 'sign up', 'join'
    ];
    
    const messageText = messageBody.toLowerCase();
    const isBusinessMessage = businessKeywords.some(keyword => 
      messageText.includes(keyword)
    );
    
    if (!isBusinessMessage) {
      console.log(`🚫 Ignoring non-business message from ${phoneNumber}: ${messageBody}`);
      return;
    }
    
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
    
    await whatsappService.sendWelcomeMessage(phoneNumber);
    return;
  }
  
  merchant.conversationHistory.push({
    message: messageBody,
    direction: "incoming",
    timestamp: new Date()
  });
  
  await processMessage(merchant, messageBody, whatsappService);
}

module.exports = {
  handleIncomingMessage
}; 