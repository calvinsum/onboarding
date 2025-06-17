require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Firestore service instead of MongoDB
const firestoreService = require('./services/firestore');
const GreenWhatsAppService = require('./services/whatsapp-green');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Static files
app.use(express.static('public'));

// Initialize services
let greenApi;

// Initialize Green API service
async function initializeServices() {
    try {
        await firestoreService.initialize();
        
        if (process.env.GREEN_API_ID_INSTANCE && process.env.GREEN_API_TOKEN_INSTANCE) {
            greenApi = new GreenWhatsAppService(
                process.env.GREEN_API_ID_INSTANCE,
                process.env.GREEN_API_TOKEN_INSTANCE
            );
            await greenApi.initialize();
            console.log('✅ Green API WhatsApp client initialized');
        } else {
            console.log('⚠️ Green API not configured. Set GREEN_API_ID_INSTANCE and GREEN_API_TOKEN_INSTANCE');
        }
    } catch (error) {
        console.error('❌ Service initialization failed:', error.message);
    }
}

// Message polling for Green API
async function pollForMessages() {
    if (!greenApi) return;
    
    try {
        const notifications = await greenApi.receiveNotification();
        if (notifications && notifications.length > 0) {
            for (const notification of notifications) {
                await processIncomingMessage(notification);
            }
        } else {
            console.log('🔍 Raw notification received: null');
        }
    } catch (error) {
        console.error('❌ Error receiving notification:', error.message);
    }
}

// Process incoming WhatsApp messages
async function processIncomingMessage(notification) {
    try {
        if (!notification.body) return;

        const { senderData, messageData } = notification.body;
        const phoneNumber = senderData.sender.replace('@c.us', '');
        const messageText = messageData.textMessageData?.textMessage || '';

        console.log(`📨 Message from ${phoneNumber}: "${messageText}"`);

        // Find existing merchant
        let merchant = await firestoreService.findMerchant({ phoneNumber });
        
        if (!merchant) {
            console.log(`❌ No merchant found for ${phoneNumber}`);
            return;
        }

        // Add message to conversation history
        await firestoreService.addMessageToConversation(merchant.id, {
            direction: 'incoming',
            content: messageText,
            messageId: messageData.idMessage
        });

        // Process conversation step
        await processConversationStep(merchant, messageText);

    } catch (error) {
        console.error('❌ Error processing message:', error.message);
    }
}

// Process conversation flow
async function processConversationStep(merchant, messageText) {
    try {
        const phoneNumber = merchant.phoneNumber;
        let response = '';
        let nextStep = merchant.currentStep;
        let updateData = {};

        switch (merchant.currentStep) {
            case 'welcome':
                if (isDateFormat(messageText)) {
                    const goLiveDate = parseDate(messageText);
                    const daysUntilGoLive = calculateDaysUntilGoLive(goLiveDate);
                    const slaStatus = daysUntilGoLive >= 30 ? 'within_sla' : 
                                    daysUntilGoLive >= 14 ? 'at_risk' : 'overdue';

                    response = `✅ Thank you! Your go-live date is ${formatDate(goLiveDate)} (${daysUntilGoLive} days from today).

📊 SLA Status: ${slaStatus.replace('_', ' ').toUpperCase()}

We can definitely accommodate your timeline! To proceed with your onboarding, please reply with "continue".`;

                    updateData = {
                        goLiveDate: goLiveDate.toISOString(),
                        daysUntilGoLive,
                        slaStatus,
                        currentStep: 'sla_confirmation'
                    };
                    nextStep = 'sla_confirmation';
                } else {
                    response = `Please provide your desired go-live date in DD/MM/YYYY format (e.g., 25/08/2025).`;
                }
                break;

            case 'sla_confirmation':
                if (messageText.toLowerCase().includes('continue')) {
                    response = `Perfect! Let's continue with your onboarding.

📍 Please provide your complete business address for equipment delivery:

Include:
• Street address
• City, State/Province  
• Postal code
• Country`;

                    updateData = { currentStep: 'address_collection' };
                    nextStep = 'address_collection';
                } else {
                    response = `Please reply with "continue" to proceed with the onboarding process.`;
                }
                break;

            case 'address_collection':
                response = `✅ Thank you for providing your address:
"${messageText}"

🏢 Hardware Package Selection:

Please choose your preferred package:

1️⃣ **PREMIUM PACKAGE** ($299/month)
   • Advanced POS terminal
   • Contactless payment support
   • Inventory management
   • 24/7 priority support

2️⃣ **STANDARD PACKAGE** ($199/month)  
   • Basic POS terminal
   • Card payment processing
   • Basic reporting
   • Business hours support

Reply with "premium package" or "standard package"`;

                updateData = { 
                    address: messageText,
                    currentStep: 'package_selection' 
                };
                nextStep = 'package_selection';
                break;

            case 'package_selection':
                const isValidPackage = messageText.toLowerCase().includes('premium') || 
                                     messageText.toLowerCase().includes('standard');
                
                if (isValidPackage) {
                    const packageType = messageText.toLowerCase().includes('premium') ? 'premium' : 'standard';
                    
                    response = `🎉 Excellent choice! You've selected the ${packageType.toUpperCase()} PACKAGE.

📦 Next Steps:
1. Equipment delivery (2-3 business days)
2. Hardware installation & setup
3. Staff training session
4. Go-live testing

Our team will contact you within 24 hours to schedule the delivery and installation.

Is there anything else you'd like to know about your onboarding process?`;

                    updateData = { 
                        packageType,
                        currentStep: 'delivery_scheduling',
                        status: 'onboarding'
                    };
                    nextStep = 'delivery_scheduling';
                } else {
                    response = `Please select either "premium package" or "standard package".`;
                }
                break;

            default:
                response = `Thank you for your message. Our team will review it and get back to you soon.`;
        }

        // Send response
        if (response) {
            await greenApi.sendTextMessage(phoneNumber, response);
            
            // Add response to conversation history
            await firestoreService.addMessageToConversation(merchant.id, {
                direction: 'outgoing',
                content: response
            });
        }

        // Update merchant data
        if (Object.keys(updateData).length > 0) {
            await firestoreService.updateMerchant(merchant.id, updateData);
        }

    } catch (error) {
        console.error('❌ Error in conversation step:', error.message);
    }
}

// Utility functions
function isDateFormat(text) {
    return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text);
}

function parseDate(dateString) {
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
}

function formatDate(date) {
    return date.toLocaleDateString('en-GB');
}

function calculateDaysUntilGoLive(goLiveDate) {
    const today = new Date();
    const diffTime = goLiveDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        database: 'firestore',
        whatsapp: greenApi ? 'green-api' : 'not_configured'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.send(`
        <h1>🔥 WhatsApp Onboarding Assistant (Firestore)</h1>
        <p><strong>Database:</strong> Google Firestore</p>
        <p><strong>WhatsApp:</strong> Green API (ZERO ban risk)</p>
        <p><strong>Status:</strong> ${greenApi ? '✅ Ready' : '⚠️ Configure Green API'}</p>
        <h3>🔗 Endpoints:</h3>
        <ul>
            <li><a href="/api/merchants">📊 View Merchants</a></li>
            <li><a href="/health">🏥 Health Check</a></li>
            <li><a href="/acquisition.html">📝 Merchant Acquisition Form</a></li>
        </ul>
    `);
});

// WhatsApp status
app.get('/api/whatsapp/status', async (req, res) => {
    try {
        if (!greenApi) {
            return res.json({ 
                status: 'not_configured',
                message: 'Green API credentials not set'
            });
        }

        const status = await greenApi.getStateInstance();
        res.json({ 
            status: 'connected',
            green_api_status: status,
            instance_id: process.env.GREEN_API_ID_INSTANCE
        });
    } catch (error) {
        res.json({ 
            status: 'error',
            message: error.message
        });
    }
});

// Get all merchants
app.get('/api/merchants', async (req, res) => {
    try {
        const merchants = await firestoreService.getAllMerchants();
        res.json(merchants);
    } catch (error) {
        console.error('❌ Error fetching merchants:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get merchant stats
app.get('/api/merchants/stats', async (req, res) => {
    try {
        const stats = await firestoreService.getMerchantStats();
        res.json(stats);
    } catch (error) {
        console.error('❌ Error fetching stats:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get specific merchant
app.get('/api/merchants/:id', async (req, res) => {
    try {
        const merchant = await firestoreService.findMerchant({ id: req.params.id });
        if (!merchant) {
            return res.status(404).json({ error: 'Merchant not found' });
        }
        res.json(merchant);
    } catch (error) {
        console.error('❌ Error fetching merchant:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Trigger onboarding for a new merchant
app.post('/api/acquisition/merchant', async (req, res) => {
    try {
        const { businessName, phoneNumber } = req.body;

        if (!businessName || !phoneNumber) {
            return res.status(400).json({ 
                error: 'Business name and phone number are required' 
            });
        }

        // Check if merchant already exists
        const existingMerchant = await firestoreService.findMerchant({ phoneNumber });
        if (existingMerchant) {
            return res.status(409).json({ 
                error: 'Merchant already exists',
                merchant: existingMerchant
            });
        }

        // Create new merchant
        const merchant = await firestoreService.createMerchant({
            businessName,
            phoneNumber
        });

        // Send welcome message if Green API is configured
        if (greenApi) {
            await greenApi.sendWelcomeMessage(phoneNumber, businessName);
            
            // Add welcome message to conversation history
            await firestoreService.addMessageToConversation(merchant.id, {
                direction: 'outgoing',
                content: `🎉 Welcome to our onboarding process, ${businessName}!

To get started, please provide your desired go-live date in DD/MM/YYYY format (e.g., 25/08/2025).

This will help us plan your implementation timeline and ensure everything is ready for your launch! 🚀`
            });

            console.log(`✅ Onboarding triggered for ${businessName} (${phoneNumber})`);
        }

        res.status(200).json({
            message: 'Merchant onboarding initiated',
            merchant
        });

    } catch (error) {
        console.error('❌ Error in merchant acquisition:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint for message injection (development)
app.post('/api/test/inject-message', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber || !message) {
            return res.status(400).json({ error: 'Phone number and message are required' });
        }

        console.log(`🧪 Test: Injecting message from ${phoneNumber}: "${message}"`);

        // Find merchant
        const merchant = await firestoreService.findMerchant({ phoneNumber });
        if (!merchant) {
            return res.status(404).json({ error: 'Merchant not found' });
        }

        // Add message to conversation
        await firestoreService.addMessageToConversation(merchant.id, {
            direction: 'incoming',
            content: message,
            messageId: `test-${Date.now()}`
        });

        // Process conversation step
        await processConversationStep(merchant, message);

        res.json({ message: 'Message injected and processed successfully' });

    } catch (error) {
        console.error('❌ Error injecting test message:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get conversation history for a merchant
app.get('/api/merchants/:phoneNumber/conversation', async (req, res) => {
    try {
        const merchant = await firestoreService.findMerchant({ 
            phoneNumber: req.params.phoneNumber 
        });
        
        if (!merchant) {
            return res.status(404).json({ error: 'Merchant not found' });
        }

        res.json({
            merchant: {
                id: merchant.id,
                businessName: merchant.businessName,
                phoneNumber: merchant.phoneNumber,
                status: merchant.status,
                currentStep: merchant.currentStep
            },
            conversation: merchant.conversationHistory || []
        });

    } catch (error) {
        console.error('❌ Error fetching conversation:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('❌ Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    
    if (greenApi) {
        await greenApi.destroy();
    }
    
    await firestoreService.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    
    if (greenApi) {
        await greenApi.destroy();
    }
    
    await firestoreService.close();
    process.exit(0);
});

// Start server
async function startServer() {
    await initializeServices();
    
    app.listen(PORT, () => {
        console.log('🚀 Server running on port', PORT);
        console.log('🔥 WhatsApp Onboarding Assistant (FIRESTORE VERSION) is ready!');
        console.log('🔗 API URL:', `http://localhost:${PORT}`);
        console.log('📊 Merchants:', `http://localhost:${PORT}/api/merchants`);
        console.log('🏥 Health:', `http://localhost:${PORT}/health`);
        console.log('🛡️ Database: Google Firestore');
        console.log('📱 WhatsApp: Green API (ZERO ban risk)');
        
        console.log('💡 How to use:');
        console.log('1. Configure FIREBASE_PROJECT_ID in your .env file');
        console.log('2. Set up Firebase credentials (gcloud CLI or service account)');
        console.log('3. Configure GREEN_API_ID_INSTANCE and GREEN_API_TOKEN_INSTANCE');
        console.log('4. Send messages to your Green API WhatsApp number');
        console.log('5. Monitor conversations at /api/merchants');

        // Start message polling
        if (greenApi) {
            console.log('📥 Starting message polling...');
            setInterval(pollForMessages, 5000);
        }
    });
}

startServer().catch(console.error); 