// API Testing Script for WhatsApp Onboarding
const http = require('http');

const SERVER_URL = 'http://localhost:3000';

// Function to simulate incoming message
function simulateMessage(phoneNumber, message) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            phoneNumber: phoneNumber,
            message: message
        });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/test/message',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(responseData));
                } catch (e) {
                    resolve({ response: responseData });
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// Function to get merchants data
function getMerchants() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/merchants',
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve([]);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Test scenarios for onboarding flow
const testScenarios = [
    { message: "Hi, I need help with business onboarding", expected: "Welcome message" },
    { message: "25/12/2024", expected: "SLA check and proceed option" },
    { message: "continue", expected: "Delivery address request" },
    { message: "123 Main Street, KL", expected: "Hardware installation choice" },
    { message: "1", expected: "Product list request" },
    { message: "Coffee and pastries", expected: "Training preference request" },
    { message: "Online training preferred", expected: "Confirmation summary" },
    { message: "help", expected: "Help menu" },
    { message: "status", expected: "Current status" }
];

async function runAPITests() {
    const testPhoneNumber = "60123456789";
    
    console.log('\n🧪 API Testing Mode');
    console.log('=====================================');
    console.log(`📱 Test Phone: ${testPhoneNumber}`);
    console.log(`🔗 Server: ${SERVER_URL}`);
    
    console.log('\n📋 Running onboarding flow simulation...');
    
    for (let i = 0; i < testScenarios.length; i++) {
        const scenario = testScenarios[i];
        console.log(`\n${i + 1}. Testing: "${scenario.message}"`);
        console.log(`   Expected: ${scenario.expected}`);
        
        try {
            const result = await simulateMessage(testPhoneNumber, scenario.message);
            console.log(`   ✅ Response: ${result.response || result.message || 'Success'}`);
            
            // Small delay between messages
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }
    
    // Check final merchant data
    console.log('\n📊 Final merchant data:');
    try {
        const merchants = await getMerchants();
        console.log(JSON.stringify(merchants, null, 2));
    } catch (error) {
        console.log(`❌ Error getting merchants: ${error.message}`);
    }
}

runAPITests(); 