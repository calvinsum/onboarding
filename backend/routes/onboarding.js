const express = require("express");
const moment = require("moment");
const Merchant = require("../models/Merchant");
const whatsappService = require("../services/whatsapp");

const router = express.Router();

// Start onboarding process with SLA check
router.post("/start", async (req, res) => {
  try {
    const { whatsappNumber, goLiveDate, businessName } = req.body;
    
    if (!whatsappNumber || !goLiveDate) {
      return res.status(400).json({
        error: "WhatsApp number and go-live date are required"
      });
    }

    const goLive = moment(goLiveDate, "DD/MM/YYYY");
    const today = moment();
    const daysUntilGoLive = goLive.diff(today, "days");
    const slaThreshold = parseInt(process.env.DEFAULT_SLA_DAYS) || 5;
    
    const canMeetSLA = daysUntilGoLive >= slaThreshold;
    
    let merchant = await Merchant.findOne({ whatsappNumber });
    if (!merchant) {
      merchant = new Merchant({
        whatsappNumber,
        businessName,
        goLiveDate: goLive.toDate(),
        slaStatus: canMeetSLA ? "within_sla" : "at_risk",
      });
    } else {
      merchant.goLiveDate = goLive.toDate();
      merchant.businessName = businessName;
      merchant.slaStatus = canMeetSLA ? "within_sla" : "at_risk";
    }
    
    await merchant.save();
    
    // Send SLA result message
    const slaResult = {
      canMeetSLA,
      goLiveDate: goLive.toDate(),
      daysUntilGoLive,
    };
    
    await whatsappService.sendSLAResult(whatsappNumber, slaResult);
    
    if (!canMeetSLA) {
      // Escalate case
      merchant.status = "escalated";
      merchant.escalatedAt = new Date();
      merchant.escalationReason = "Insufficient time to meet SLA";
      await merchant.save();
      
      // TODO: Trigger CRM notification
      console.log(`🚨 Escalated case for ${whatsappNumber}`);
    }
    
    res.json({
      success: true,
      merchantId: merchant.merchantId,
      canMeetSLA,
      daysUntilGoLive,
      status: merchant.status,
    });
    
  } catch (error) {
    console.error("Onboarding start error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get merchant status
router.get("/status/:merchantId", async (req, res) => {
  try {
    const merchant = await Merchant.findOne({ 
      merchantId: req.params.merchantId 
    });
    
    if (!merchant) {
      return res.status(404).json({ error: "Merchant not found" });
    }
    
    res.json({
      merchantId: merchant.merchantId,
      businessName: merchant.businessName,
      currentStep: merchant.currentStep,
      status: merchant.status,
      slaStatus: merchant.slaStatus,
      daysUntilGoLive: merchant.daysUntilGoLive,
      progressPercentage: merchant.progressPercentage || 0,
    });
    
  } catch (error) {
    console.error("Status check error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;