// Green API Debug Script
require('dotenv').config();
const https = require('https');

const GREEN_API_ID_INSTANCE = process.env.GREEN_API_ID_INSTANCE;
const GREEN_API_TOKEN_INSTANCE = process.env.GREEN_API_TOKEN_INSTANCE;

console.log('🔧 Green API Debug Tool');
console.log('======================');

if (!GREEN_API_ID_INSTANCE || !GREEN_API_TOKEN_INSTANCE) {
    console.log('❌ Missing Green API credentials in .env file');
    console.log('Please set GREEN_API_ID_INSTANCE and GREEN_API_TOKEN_INSTANCE');
    process.exit(1);
}

console.log(`📊 Instance ID: ${GREEN_API_ID_INSTANCE}`);
console.log(`🔑 Token: ${GREEN_API_TOKEN_INSTANCE.substring(0, 10)}...`);

// Function to check Green API status
function checkGreenAPIStatus() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.green-api.com',
            port: 443,
            path: `/waInstance${GREEN_API_ID_INSTANCE}/getStateInstance/${GREEN_API_TOKEN_INSTANCE}`,
            method: 'GET'
        };

        console.log('\n🔍 Checking Green API status...');
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (e) {
                    reject(new Error('Invalid response: ' + data));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Function to get account info
function getAccountInfo() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.green-api.com',
            port: 443,
            path: `/waInstance${GREEN_API_ID_INSTANCE}/getSettings/${GREEN_API_TOKEN_INSTANCE}`,
            method: 'GET'
        };

        console.log('\n📱 Getting account info...');
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (e) {
                    reject(new Error('Invalid response: ' + data));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Function to send test message
function sendTestMessage(phoneNumber, message) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            chatId: `${phoneNumber}@c.us`,
            message: message
        });

        const options = {
            hostname: 'api.green-api.com',
            port: 443,
            path: `/waInstance${GREEN_API_ID_INSTANCE}/sendMessage/${GREEN_API_TOKEN_INSTANCE}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        console.log(`\n📤 Sending test message to ${phoneNumber}...`);
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    resolve(result);
                } catch (e) {
                    reject(new Error('Invalid response: ' + responseData));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function runDebug() {
    try {
        // Check API status
        const status = await checkGreenAPIStatus();
        console.log(`✅ Status: ${status.stateInstance}`);
        
        if (status.stateInstance !== 'authorized') {
            console.log('❌ WhatsApp not authorized! Please check your Green API setup.');
            console.log('💡 Go to green-api.com and ensure your instance is authorized.');
            return;
        }

        // Get account info
        try {
            const accountInfo = await getAccountInfo();
            console.log(`📱 WhatsApp Number: ${accountInfo.wid || 'Not available'}`);
            console.log(`🔧 Instance Name: ${accountInfo.instanceName || 'Not set'}`);
        } catch (error) {
            console.log('⚠️ Could not get account info:', error.message);
        }

        // Test sending message
        console.log('\n🧪 Testing message sending...');
        
        // Test with your number format
        try {
            const result1 = await sendTestMessage('01154230831', '🧪 Test message from debug script');
            console.log(`✅ Message sent to 01154230831: ${result1.idMessage || 'Success'}`);
        } catch (error) {
            console.log(`❌ Failed to send to 01154230831: ${error.message}`);
        }

        // Test with full international format
        try {
            const result2 = await sendTestMessage('601154230831', '🧪 Test message from debug script');
            console.log(`✅ Message sent to 601154230831: ${result2.idMessage || 'Success'}`);
        } catch (error) {
            console.log(`❌ Failed to send to 601154230831: ${error.message}`);
        }

        console.log('\n📋 Summary:');
        console.log('- If messages were sent successfully, check your WhatsApp');
        console.log('- If you receive messages, your setup is working');
        console.log('- If not, check your Green API dashboard');

    } catch (error) {
        console.log(`❌ Debug failed: ${error.message}`);
        console.log('\n💡 Possible issues:');
        console.log('1. Check your .env file has correct GREEN_API_ID_INSTANCE and GREEN_API_TOKEN_INSTANCE');
        console.log('2. Ensure your Green API instance is authorized');
        console.log('3. Verify your account has sufficient credits');
    }
}

runDebug(); 