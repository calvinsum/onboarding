const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const merchantSchema = new mongoose.Schema({
  merchantId: {
    type: String,
    unique: true,
    default: uuidv4,
  },
  whatsappNumber: {
    type: String,
    required: true,
    unique: true,
  },
  businessName: String,
  goLiveDate: {
    type: Date,
    required: true,
  },
  slaStatus: {
    type: String,
    enum: ["within_sla", "at_risk", "breached", "escalated"],
    default: "within_sla",
  },
  currentStep: {
    type: String,
    default: "welcome",
  },
  status: {
    type: String,
    enum: ["initiated", "in_progress", "completed", "cancelled"],
    default: "initiated",
  },
  onboardingData: {
    deliveryAddress: String,
    hardwareInstallation: String,
    productList: String,
    trainingSession: String,
    finalConfirmation: Boolean,
  },
  conversationHistory: [{
    message: String,
    direction: String,
    timestamp: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

// Calculate days until go-live
merchantSchema.virtual("daysUntilGoLive").get(function() {
  if (!this.goLiveDate) return null;
  const today = new Date();
  const goLive = new Date(this.goLiveDate);
  const diffTime = goLive - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model("Merchant", merchantSchema);