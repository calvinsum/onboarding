# 🚀 5-Minute Render Deployment Guide

Deploy your WhatsApp Onboarding Assistant to production in under 5 minutes with **zero infrastructure management**.

## ✅ Prerequisites (2 minutes)

1. **GitHub Repository**: Your code must be pushed to GitHub
2. **Green API Account**: Sign up at [green-api.com](https://green-api.com) (free tier available)
3. **Render Account**: Sign up at [render.com](https://render.com) (free tier included)

## 🔥 Quick Deploy (3 minutes)

### Step 1: Connect GitHub to Render

1. Go to [render.com](https://render.com) and sign up/login
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account
4. Select your repository: `whatsapp-onboarding-assistant`

### Step 2: Configure Service

- **Name**: `whatsapp-onboarding-assistant`
- **Environment**: `Node`
- **Build Command**: `npm install --production`
- **Start Command**: `npm run safe`

### Step 3: Set Environment Variables

Add these environment variables in Render:

```
GREEN_API_ID_INSTANCE=7105261695
GREEN_API_TOKEN_INSTANCE=fa7c8226d9c54aa58e716c0f80b4414f7b0706c9a3114ddcaa
NODE_ENV=production
PORT=3000
```

### Step 4: Deploy!

Click **"Create Web Service"** and wait 2-3 minutes for deployment.

## 🌐 After Deployment

Your app will be live at: `https://whatsapp-onboarding-assistant.onrender.com`

### Essential Endpoints:
- **Health Check**: `/health`
- **API Status**: `/api/whatsapp/status`
- **Merchants**: `/api/merchants`
- **Trigger Onboarding**: `POST /api/acquisition/merchant`

## 🔧 Configure Webhooks (Critical!)

Once deployed, configure your Green API webhook URL:

```bash
# Set webhook URL (replace with your actual Render URL)
curl -X POST "https://api.green-api.com/waInstance7105261695/SetWebhook/fa7c8226d9c54aa58e716c0f80b4414f7b0706c9a3114ddcaa" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://whatsapp-onboarding-assistant.onrender.com/api/webhook/whatsapp"}'
```

## 🧪 Test Your Deployment

```bash
# Test health
curl https://whatsapp-onboarding-assistant.onrender.com/health

# Test WhatsApp status
curl https://whatsapp-onboarding-assistant.onrender.com/api/whatsapp/status

# Trigger onboarding for a merchant
curl -X POST https://whatsapp-onboarding-assistant.onrender.com/api/acquisition/merchant \
  -H "Content-Type: application/json" \
  -d '{"merchantName": "Test Restaurant", "contactNumber": "601234567890"}'
```

## 🎯 Expected Results

**Before Webhook Configuration:**
```
🔍 Raw notification received: null
🔍 Raw notification received: null
```

**After Webhook Configuration:**
```
📱 WhatsApp message received from 601234567890: "Hello"
✅ Processing onboarding conversation...
✅ Response sent: BAE5621F2B4FB9A9
```

## 🔄 Automatic Deployments

Render automatically redeploys when you push to GitHub:

```bash
git add .
git commit -m "✨ New feature"
git push origin master
# 🚀 Render auto-deploys in ~2 minutes
```

## 🛡️ Security Features

✅ **Zero WhatsApp Ban Risk**: Uses Green API (official partner)  
✅ **Production Ready**: Helmet security, CORS, rate limiting  
✅ **Auto-scaling**: Handles traffic spikes automatically  
✅ **HTTPS**: SSL certificates included  
✅ **Monitoring**: Built-in logs and metrics  

## 📊 Free Tier Limits

- **750 hours/month** (always-on for 31 days)
- **500MB RAM** (sufficient for most use cases)
- **100GB bandwidth/month**
- **Automatic SSL certificates**
- **Custom domains** (premium feature)

## 🚨 Troubleshooting

### Common Deployment Issues

#### "username is required" Error
**Fixed in latest version!** This was caused by Twilio dependency conflicts. The latest `package.json` moves conflicting dependencies to `optionalDependencies`.

If you still see this error:
```bash
git pull origin master  # Get latest fixes
git push origin master  # Trigger new deployment
```

#### Slow Cold Starts
Free tier services spin down after 15 minutes of inactivity. First request may take 10-30 seconds.

**Solution**: Upgrade to paid plan ($7/month) for always-on service.

#### Green API 401 Errors
Check your environment variables:
- `GREEN_API_ID_INSTANCE` should be numeric (e.g., 7105261695)
- `GREEN_API_TOKEN_INSTANCE` should be 50+ character string
- No quotes or extra spaces

#### Build Failures
Ensure your `package.json` has the latest configuration:
```json
{
  "dependencies": {
    "@green-api/whatsapp-api-client": "^0.4.4",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "optionalDependencies": {
    "twilio": "^4.19.3",
    "whatsapp-web.js": "^1.23.0"
  }
}
```

## 🎉 Success Indicators

1. ✅ Build completes without errors
2. ✅ Service shows "Live" status in Render dashboard
3. ✅ Health check returns `200 OK`
4. ✅ WhatsApp messages trigger responses
5. ✅ No continuous `null` polling (after webhook setup)

## 🔗 Useful Links

- **Render Dashboard**: [dashboard.render.com](https://dashboard.render.com)
- **Green API Console**: [console.green-api.com](https://console.green-api.com)
- **GitHub Repository**: [github.com/calvinsum/onboarding](https://github.com/calvinsum/onboarding)
- **Live Demo**: Check your Render URL after deployment

---

**🎯 Goal**: Transform your localhost development into a production-ready WhatsApp onboarding system that can handle real customer conversations within 5 minutes! 