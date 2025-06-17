const express = require("express");
const router = express.Router();

/**
 * Handles incoming WhatsApp webhooks from Green API.
 */
router.post("/whatsapp", async (req, res) => {
  const { merchants, whatsappService, handleIncomingMessage } = req.app.locals;

  try {
    // Green API nests the actual payload inside a "body" property
    const webhookBody = req.body.body;

    // Log the raw payload for debugging if you need it
    // console.log("📥 Received Green API webhook:", JSON.stringify(req.body, null, 2));

    if (!webhookBody) {
        console.warn("⚠️ Webhook received but it has no 'body' property. Skipping.");
        return res.status(200).json({ success: true, message: "Webhook acknowledged, but no body found." });
    }
    
    // We only care about incoming text messages
    if (webhookBody.typeWebhook === 'incomingMessageReceived' && webhookBody.messageData?.typeMessage === 'textMessage') {
      const messageData = webhookBody.messageData.textMessageData;
      const senderData = webhookBody.senderData;
      
      const phoneNumber = senderData.chatId.split('@')[0];
      const message = messageData.textMessage;

      if (!phoneNumber || !message) {
        console.warn("⚠️ Webhook missing phone number or message.", { phoneNumber, message });
        return res.status(400).json({ error: "Missing phone number or message" });
      }

      // Process the message using the dedicated onboarding service
      await handleIncomingMessage(phoneNumber, message, merchants, whatsappService);

      res.status(200).json({ success: true, message: "Webhook processed successfully" });
    } else {
      // Acknowledge other webhook types without processing (e.g., message sent, read receipts)
      console.log(`✅ Webhook type "${webhookBody.typeWebhook}" acknowledged but not processed.`);
      res.status(200).json({ success: true, message: "Webhook acknowledged." });
    }
  } catch (error) {
    console.error("❌ Webhook processing error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router; 