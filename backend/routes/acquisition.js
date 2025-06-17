const express = require('express');
const router = express.Router();

// Merchant acquisition endpoints
// POST /api/acquisition/merchant - Add new merchant and trigger onboarding
router.post('/merchant', async (req, res) => {
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
    const existingMerchant = req.app.locals.merchants?.get(cleanPhoneNumber);
    if (existingMerchant) {
      return res.status(409).json({ 
        success: false, 
        error: 'Merchant with this contact number already exists',
        existingMerchant: {
          id: existingMerchant.id,
          merchantName: existingMerchant.merchantName,
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
    
    // Store in merchants map
    if (!req.app.locals.merchants) {
      req.app.locals.merchants = new Map();
    }
    req.app.locals.merchants.set(cleanPhoneNumber, newMerchant);
    
    // Trigger WhatsApp onboarding message
    const whatsappService = req.app.locals.whatsappService;
    if (whatsappService) {
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
    } else {
      newMerchant.status = "pending";
      res.json({
        success: true,
        message: 'Merchant added (WhatsApp service not available)',
        merchant: {
          id: newMerchant.id,
          merchantName: newMerchant.merchantName,
          contactNumber: cleanPhoneNumber,
          status: newMerchant.status,
          onboardingStep: newMerchant.onboardingStep
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
router.get('/merchants', (req, res) => {
  try {
    const merchants = req.app.locals.merchants || new Map();
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

// GET /api/acquisition/merchant/:id - Get specific merchant details
router.get('/merchant/:id', (req, res) => {
  try {
    const merchants = req.app.locals.merchants || new Map();
    const merchant = Array.from(merchants.values()).find(m => m.id === req.params.id);
    
    if (!merchant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Merchant not found' 
      });
    }
    
    res.json({
      success: true,
      merchant: merchant
    });
  } catch (error) {
    console.error('❌ Error fetching merchant:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/acquisition/retry/:id - Retry onboarding for a merchant
router.post('/retry/:id', async (req, res) => {
  try {
    const merchants = req.app.locals.merchants || new Map();
    const merchant = Array.from(merchants.values()).find(m => m.id === req.params.id);
    
    if (!merchant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Merchant not found' 
      });
    }
    
    const whatsappService = req.app.locals.whatsappService;
    if (!whatsappService) {
      return res.status(503).json({ 
        success: false, 
        error: 'WhatsApp service not available' 
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

module.exports = router; 