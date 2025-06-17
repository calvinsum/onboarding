#!/bin/bash

echo "🚀 Green API Webhook Configuration"
echo "Run this script AFTER your Render deployment is complete"
echo ""
echo "1. Replace YOUR_RENDER_URL with your actual Render URL"
echo "2. Run these commands:"
echo ""

cat << 'EOF'
# Set webhook URL (replace YOUR_RENDER_URL with your actual URL)
curl -X POST "https://api.green-api.com/waInstance7105261695/setSettings/fa7c8226d9c54aa58e716c0f80b4414f7b0706c9a3114ddcaa" \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://YOUR_RENDER_URL.onrender.com/api/webhook/whatsapp",
    "delaySendMessagesMilliseconds": 1000,
    "markIncomingMessagesReaded": "yes"
  }'

# Enable webhook notifications  
curl -X POST "https://api.green-api.com/waInstance7105261695/setStateWebhook/fa7c8226d9c54aa58e716c0f80b4414f7b0706c9a3114ddcaa" \
  -H "Content-Type: application/json" \
  -d '{"stateWebhook": "yes"}'

# Test the system
curl -X POST "https://YOUR_RENDER_URL.onrender.com/api/acquisition/merchant" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Restaurant", 
    "phone": "60179715809"
  }'
EOF

echo ""
echo "✅ After running these commands, send a WhatsApp message to your Green API number"
echo "📱 The system will automatically respond and process the onboarding!" 