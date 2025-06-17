const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

class FirestoreService {
    constructor() {
        this.db = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Initialize Firebase Admin SDK
            const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
                ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
                : null;

            if (serviceAccount) {
                // Production: Use service account key
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
                });
                console.log('🔥 Firestore initialized with service account');
            } else {
                // Development: Use default credentials (requires gcloud CLI)
                admin.initializeApp({
                    projectId: process.env.FIREBASE_PROJECT_ID || 'whatsapp-onboarding-dev'
                });
                console.log('🔥 Firestore initialized with default credentials');
            }

            this.db = admin.firestore();
            this.initialized = true;
            console.log('✅ Firestore service ready');
        } catch (error) {
            console.error('❌ Firestore initialization failed:', error.message);
            throw error;
        }
    }

    // Merchant operations
    async createMerchant(merchantData) {
        await this.initialize();
        
        const merchantId = `merchant-${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const merchant = {
            id: merchantId,
            businessName: merchantData.businessName,
            phoneNumber: merchantData.phoneNumber,
            status: 'onboarding',
            currentStep: 'welcome',
            goLiveDate: null,
            daysUntilGoLive: null,
            slaStatus: null,
            address: null,
            packageType: null,
            conversationHistory: [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = this.db.collection('merchants').doc(merchantId);
        await docRef.set(merchant);
        
        return { ...merchant, createdAt: new Date(), updatedAt: new Date() };
    }

    async findMerchant(query) {
        await this.initialize();
        
        if (query.phoneNumber) {
            const snapshot = await this.db.collection('merchants')
                .where('phoneNumber', '==', query.phoneNumber)
                .limit(1)
                .get();
            
            if (snapshot.empty) return null;
            
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() };
        }
        
        if (query.id) {
            const doc = await this.db.collection('merchants').doc(query.id).get();
            if (!doc.exists) return null;
            return { id: doc.id, ...doc.data() };
        }
        
        return null;
    }

    async updateMerchant(merchantId, updateData) {
        await this.initialize();
        
        const updatePayload = {
            ...updateData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await this.db.collection('merchants').doc(merchantId).update(updatePayload);
        
        // Return updated document
        const doc = await this.db.collection('merchants').doc(merchantId).get();
        return { id: doc.id, ...doc.data() };
    }

    async addMessageToConversation(merchantId, message) {
        await this.initialize();
        
        const messageWithTimestamp = {
            ...message,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await this.db.collection('merchants').doc(merchantId).update({
            conversationHistory: admin.firestore.FieldValue.arrayUnion(messageWithTimestamp),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    async getAllMerchants() {
        await this.initialize();
        
        const snapshot = await this.db.collection('merchants')
            .orderBy('createdAt', 'desc')
            .get();
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async getMerchantStats() {
        await this.initialize();
        
        const snapshot = await this.db.collection('merchants').get();
        const merchants = snapshot.docs.map(doc => doc.data());
        
        const stats = {
            total: merchants.length,
            onboarding: merchants.filter(m => m.status === 'onboarding').length,
            completed: merchants.filter(m => m.status === 'completed').length,
            within_sla: merchants.filter(m => m.slaStatus === 'within_sla').length,
            at_risk: merchants.filter(m => m.slaStatus === 'at_risk').length,
            overdue: merchants.filter(m => m.slaStatus === 'overdue').length
        };
        
        return stats;
    }

    // Clean up (optional)
    async close() {
        if (this.initialized) {
            // Firestore doesn't need explicit cleanup
            console.log('🔥 Firestore connection closed');
        }
    }
}

module.exports = new FirestoreService(); 