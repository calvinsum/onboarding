# 🚀 Deploy WhatsApp Onboarding Assistant to Render

## **Quick Deploy (5 minutes)**

### **Step 1: Go to Render Dashboard**
1. Visit [render.com](https://render.com)
2. Sign up/login with your GitHub account
3. Click **"New"** → **"Web Service"**

### **Step 2: Connect Repository**
1. Select **"Build and deploy from a Git repository"**
2. Connect your GitHub account if not already connected
3. Find and select: `calvinsum/onboarding`
4. Click **"Connect"**

### **Step 3: Configure Service**
```yaml
Name: whatsapp-onboarding-assistant
Environment: Node
Region: Any (Oregon recommended)
Branch: master
Root Directory: (leave empty)
Build Command: npm install
Start Command: npm run safe
```

### **Step 4: Environment Variables**
Add these in the **Environment** section:

| Variable | Value |
|----------|-------|
| `GREEN_API_ID_INSTANCE` | `7105261695` |
| `GREEN_API_TOKEN_INSTANCE` | `fa7c8226d9c54aa58e716c0f80b4414f7b0706c9a3114ddcaa` |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |

### **Step 5: Deploy**
1. Click **"Create Web Service"**
2. Wait 3-5 minutes for deployment
3. Your app will be live at: `https://[your-service-name].onrender.com`

---

## **Step 6: Configure Webhooks for Live WhatsApp**

Once deployed, update Green API webhooks with your Render URL:

```bash
curl -X POST "https://api.green-api.com/waInstance7105261695/setSettings/fa7c8226d9c54aa58e716c0f80b4414f7b0706c9a3114ddcaa" \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://[your-service-name].onrender.com/api/webhook/green-api",
    "incomingWebhook": "yes",
    "outgoingMessageWebhook": "yes"
  }'
```

---

## **🎯 What Happens After Deployment**

### **✅ Immediate Benefits:**
- **Public webhook URL** - Green API can send real-time notifications
- **No more `null` polling** - Live WhatsApp message processing
- **Zero infrastructure management** - Render handles everything
- **HTTPS by default** - Secure webhook endpoints
- **Auto-scaling** - Handles traffic spikes

### **📱 Live Testing:**
1. Send a WhatsApp message to your Green API number
2. System will automatically process and respond
3. Monitor at: `https://[your-url].onrender.com/api/merchants`
4. Check health: `https://[your-url].onrender.com/health`

---

## **🔧 Alternative Deploy Commands**

### **Use Firestore Mode (No MongoDB):**
```yaml
Start Command: npm run firestore
```

Add Firebase environment variables:
```yaml
FIREBASE_PROJECT_ID: onboarding-d7866
```

### **Use Demo Mode (Presentations):**
```yaml
Start Command: npm run demo
```

---

## **🎉 Expected Results**

After deployment with webhook configuration:

- ✅ **Real-time WhatsApp processing** (no more `null` polling)
- ✅ **Automatic merchant onboarding**
- ✅ **Live conversation tracking**
- ✅ **Production-ready system**

Your system will go from:
```
🔍 Raw notification received: null
```

To:
```
📱 WhatsApp message received from 60179715809: "Hello"
✅ Processing onboarding conversation...
✅ Response sent: BAE5621F2B4FB9A9
```

---

## **🚨 Troubleshooting**

### **Common Issues:**

1. **Build fails:**
   - Check Node.js version in `package.json`
   - Ensure all dependencies are in `package.json`

2. **Service starts but crashes:**
   - Check environment variables are set correctly
   - Verify Green API credentials

3. **Webhooks not working:**
   - Ensure webhook URL is the exact Render URL
   - Check Green API settings are saved

### **Logs:**
View real-time logs in Render dashboard: **Service** → **Logs**

---

## **💰 Render Free Tier Limits**

- **750 hours/month** (enough for 24/7 operation)
- **500 MB RAM**
- **100 GB bandwidth**
- **Perfect for WhatsApp onboarding system**

---

**🎯 Result: Production-ready WhatsApp onboarding with zero infrastructure management!** 