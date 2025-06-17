# 🤖 WhatsApp Onboarding Assistant

A comprehensive, production-ready WhatsApp automation system for merchant onboarding with SLA-aware conversation flows, built with Node.js and multiple WhatsApp API integrations.

## ✨ Features

- **🚀 Multiple Deployment Options**: Safe (Green API), Free (WhatsApp Web), Demo Mode, LLM-Enhanced
- **📊 SLA-Aware Workflows**: Automatic timeline validation and merchant escalation
- **💬 Interactive Conversations**: Step-by-step onboarding with context awareness
- **🛡️ Zero Ban Risk**: Official API integrations (Green API recommended for production)
- **📱 Real-time Monitoring**: Live conversation tracking and merchant management
- **🔄 Webhook Support**: Real-time message processing via webhooks
- **🎯 Admin Dashboard**: React-based management interface
- **🤖 LLM Integration**: Natural language processing with Ollama/OpenAI

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/calvinsum/onboarding.git
cd onboarding
npm install
```

### 2. Environment Setup
```bash
cp env.example .env
```

Edit `.env` with your credentials:
```env
# Green API Configuration (Recommended for Production)
GREEN_API_ID_INSTANCE=your_instance_id
GREEN_API_TOKEN_INSTANCE=your_token
GREEN_API_WEBHOOK_TOKEN=your_webhook_token

# Server Configuration
PORT=3000
NODE_ENV=production
```

### 3. Run Different Modes

#### 🔥 **Firestore Mode (Recommended - No MongoDB required)**
```bash
npm run firestore
```
- **Zero database setup** - Cloud Firestore handles everything
- **Auto-scaling** - Handles millions of users
- **Real-time sync** - Live updates across all devices
- **No installation** - Works immediately
- **Perfect for production** - Enterprise-grade reliability

#### 🛡️ **Safe Mode (Production - Green API)**
```bash
npm run safe
```
- **Zero ban risk** - Official API partner
- **3,000 free messages/month**
- **Webhook support for live testing**
- **Best for production deployment**

#### 🆓 **Free Mode (WhatsApp Web)**
```bash
npm run free
```
- **Completely free** - No API costs
- **QR code authentication**
- **Good for development/testing**

#### 🎭 **Demo Mode (No WhatsApp needed)**
```bash
npm run demo
```
- **Perfect for presentations**
- **Simulated conversations**
- **No external dependencies**

#### 🤖 **LLM Demo Mode**
```bash
npm run llm-demo
```
- **AI-powered conversations**
- **Natural language processing**
- **Intelligent response generation**

## 🌐 Live Deployment & Testing

### Step 1: Deploy to Production

#### 🥇 Option A: Render (Recommended - 5 minutes)
1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect GitHub: `calvinsum/onboarding`
3. **Start Command:** `npm run safe`
4. **Environment Variables:**
   - `GREEN_API_ID_INSTANCE`: `7105261695`
   - `GREEN_API_TOKEN_INSTANCE`: `fa7c8226d9c54aa58e716c0f80b4414f7b0706c9a3114ddcaa`
5. Deploy! 🚀

**📘 Detailed Guide:** See [DEPLOY_RENDER.md](./DEPLOY_RENDER.md)

#### Option B: Railway
1. Fork this repository
2. Connect to [Railway](https://railway.app)
3. Deploy with environment variables
4. Get your public URL: `https://your-app.railway.app`

#### Option C: Heroku
```bash
heroku create your-onboarding-app
heroku config:set GREEN_API_ID_INSTANCE=your_instance_id
heroku config:set GREEN_API_TOKEN_INSTANCE=your_token
git push heroku main
```

### Step 2: Configure Live Webhooks

1. **Get your public URL** from deployment (e.g., `https://your-app.railway.app`)

2. **Set Green API webhook URL**:
```bash
curl -X POST "https://api.green-api.com/waInstance{INSTANCE}/setSettings/{TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://your-app.railway.app/api/webhook/green-api",
    "incomingWebhook": "yes",
    "outgoingMessageWebhook": "yes"
  }'
```

3. **Test the webhook**:
```bash
curl https://your-app.railway.app/health
```

### Step 3: Live Testing

1. **Trigger onboarding** from your deployed app:
```bash
curl -X POST https://your-app.railway.app/api/acquisition/merchant \
  -H "Content-Type: application/json" \
  -d '{
    "merchantName": "Test Merchant",
    "companyName": "Test Company", 
    "contactNumber": "60179715809"
  }'
```

2. **Real WhatsApp conversation** will start automatically!

3. **Monitor progress**:
```bash
curl https://your-app.railway.app/api/merchants
```

## 📱 API Endpoints

### Core Endpoints
- `GET /` - API information and status
- `GET /health` - Health check
- `GET /api/merchants` - List all merchants
- `POST /api/acquisition/merchant` - Trigger onboarding

### Testing Endpoints
- `POST /api/test/inject-message` - Simulate WhatsApp messages
- `GET /api/merchants/{phone}/conversation` - View conversation

### Webhook Endpoints
- `POST /api/webhook/green-api` - Green API webhook receiver

### Admin Dashboard
- `GET /dashboard.html` - Admin management interface
- `GET /api/admin/dashboard` - Dashboard data

## 🔧 Environment Variables

### Required (Green API)
```env
GREEN_API_ID_INSTANCE=your_instance_id      # From green-api.com
GREEN_API_TOKEN_INSTANCE=your_token         # From green-api.com
```

### Firestore Configuration (for Firestore mode)
```env
# Option 1: Using Firebase Project ID (requires gcloud CLI)
FIREBASE_PROJECT_ID=your-firebase-project-id

# Option 2: Using Service Account Key (for production)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project",...}'
```

### Optional
```env
GREEN_API_WEBHOOK_TOKEN=your_webhook_token  # For webhook verification
PORT=3000                                    # Server port
NODE_ENV=production                          # Environment mode
```

## 🔥 Firestore Setup (Quick Start)

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project: `whatsapp-onboarding`
3. Enable Firestore Database

### 2. Configure Authentication

#### Option A: Development (using gcloud CLI)
```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
gcloud init
gcloud auth application-default login

# Set project ID in .env
echo "FIREBASE_PROJECT_ID=your-project-id" >> .env
```

#### Option B: Production (using Service Account)
1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key
3. Copy the JSON content to your `.env`:
```env
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

### 3. Run Firestore Mode
```bash
npm run firestore
```

**That's it!** 🎉 No MongoDB installation, no database setup, no connection issues!

## 🛠️ Development

### Local Development
```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run different modes
npm run safe    # Green API mode
npm run free    # WhatsApp Web mode  
npm run demo    # Demo simulation mode
npm run llm-demo # LLM-enhanced mode
```

### Project Structure
```
whatsapp-onboarding-assistant/
├── backend/
│   ├── index-safe.js          # Green API implementation
│   ├── index-free.js          # WhatsApp Web implementation
│   ├── index-demo.js          # Demo mode
│   ├── index-llm-demo.js      # LLM-enhanced mode
│   ├── services/              # WhatsApp service implementations
│   ├── routes/                # API route handlers
│   └── models/                # Data models
├── frontend/
│   └── admin-dashboard/       # React admin interface
├── public/                    # Static web pages
└── package.json               # Dependencies and scripts
```

## 🎯 Complete Onboarding Flow

### Automated Conversation Steps:

1. **Welcome Message** 👋
   ```
   Hello [Merchant]! Welcome to our onboarding assistant!
   Please share your Go-Live date (DD/MM/YYYY format)
   ```

2. **Date Validation & SLA Check** ⏰
   ```
   ✅ Great! We can meet your Go-Live date of 25/08/2025.
   You have 68 days until Go-Live.
   Reply "continue" to proceed.
   ```

3. **Delivery Address Collection** 📦
   ```
   Step 1: Please provide your delivery address
   Format: Street, City, State, ZIP, Country
   ```

4. **Hardware Package Selection** 💻
   ```
   Step 2: Choose hardware package:
   • Basic Package
   • Standard Package  
   • Premium Package
   ```

5. **Installation Scheduling** 📅
   ```
   Step 3: Preferred installation date?
   (Must be at least 5 days before Go-Live)
   ```

6. **Completion & Summary** ✅
   ```
   🎉 Onboarding Complete!
   Summary: [All collected information]
   Next steps: [Automatic handoff to team]
   ```

## 🔍 Testing Your Deployment

### 1. Health Check
```bash
curl https://your-app.railway.app/health
```

### 2. Start Conversation
```bash
curl -X POST https://your-app.railway.app/api/acquisition/merchant \
  -H "Content-Type: application/json" \
  -d '{
    "merchantName": "Your Name",
    "companyName": "Your Company",
    "contactNumber": "your_whatsapp_number"
  }'
```

### 3. Check Real WhatsApp
- Open WhatsApp on your phone
- You should receive the welcome message
- Reply with a date (e.g., "25/12/2024")
- Continue the conversation flow

### 4. Monitor Progress
```bash
curl https://your-app.railway.app/api/merchants
```

## 🚨 Troubleshooting

### Webhook Not Working?
1. Check webhook URL is publicly accessible
2. Verify Green API settings: `incomingWebhook: "yes"`
3. Test webhook endpoint: `curl https://your-app/api/webhook/green-api`

### Messages Not Sending?
1. Verify Green API credentials
2. Check API token validity
3. Ensure WhatsApp number format (with country code)

### Local Testing Issues?
1. Use test injection endpoint: `/api/test/inject-message`
2. Check logs for error details
3. Verify environment variables are set

## 📞 Support

- **GitHub Issues**: [Report bugs](https://github.com/calvinsum/onboarding/issues)
- **Documentation**: This README
- **Green API Docs**: [green-api.com/docs](https://green-api.com/docs)

## 🎉 Success Metrics

With proper deployment, you should achieve:
- ✅ **Real-time WhatsApp conversations**
- ✅ **Automatic SLA validation**
- ✅ **Step-by-step merchant guidance**
- ✅ **Zero manual intervention required**
- ✅ **Complete conversation tracking**
- ✅ **Production-ready scalability**

---

## 🚀 Ready for Live Testing!

Once deployed with webhooks configured, your WhatsApp onboarding assistant will handle real conversations automatically. The system processes merchant replies in real-time and guides them through the complete onboarding flow without any manual intervention.

**Perfect for production use! 🎯**
