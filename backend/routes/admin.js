const express = require("express");
const Merchant = require("../models/Merchant");

const router = express.Router();

// Get all merchants with pagination
router.get("/merchants", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const merchants = await Merchant.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-conversationHistory");
    
    const total = await Merchant.countDocuments();
    
    res.json({
      merchants,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalMerchants: total,
    });
  } catch (error) {
    console.error("Admin merchants error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get merchant details
router.get("/merchants/:merchantId", async (req, res) => {
  try {
    const merchant = await Merchant.findOne({
      merchantId: req.params.merchantId
    });
    
    if (!merchant) {
      return res.status(404).json({ error: "Merchant not found" });
    }
    
    res.json(merchant);
  } catch (error) {
    console.error("Admin merchant detail error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get dashboard stats
router.get("/dashboard", async (req, res) => {
  try {
    const totalMerchants = await Merchant.countDocuments();
    const activeMerchants = await Merchant.countDocuments({ status: "in_progress" });
    const completedMerchants = await Merchant.countDocuments({ status: "completed" });
    const escalatedMerchants = await Merchant.countDocuments({ status: "escalated" });
    const atRiskMerchants = await Merchant.countDocuments({ slaStatus: "at_risk" });
    
    res.json({
      totalMerchants,
      activeMerchants,
      completedMerchants,
      escalatedMerchants,
      atRiskMerchants,
      completionRate: totalMerchants > 0 ? Math.round((completedMerchants / totalMerchants) * 100) : 0,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;