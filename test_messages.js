// WhatsApp Onboarding Flow Test Script
const https = require('https');
const readline = require('readline');

// Environment variables (replace with your actual values)
const GREEN_API_ID_INSTANCE = process.env.GREEN_API_ID_INSTANCE;
const GREEN_API_TOKEN_INSTANCE = process.env.GREEN_API_TOKEN_INSTANCE;

if (!GREEN_API_ID_INSTANCE || !GREEN_API_TOKEN_INSTANCE) {
    console.log('❌ Error: Please set GREEN_API_ID_INSTANCE and GREEN_API_TOKEN_INSTANCE environment variables');
    console.log('💡 Or update the script with your actual credentials');
    process.exit(1);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\n🧪 WhatsApp Onboarding Flow Tester');
console.log('=====================================');
console.log(`📱 Your WhatsApp Number: 601154230831`);
console.log(`🔧 Instance ID: ${GREEN_API_ID_INSTANCE}`);
console.log(`🔑 Token: ${GREEN_API_TOKEN_INSTANCE.substring(0, 10)}...`);

// Function to send message via Green API
function sendMessage(phoneNumber, message) {
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

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    if (result.idMessage) {
                        resolve(result);
                    } else {
                        reject(new Error(responseData));
                    }
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

// Function to check message status
function checkMessageStatus() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.green-api.com',
            port: 443,
            path: `/waInstance${GREEN_API_ID_INSTANCE}/getStateInstance/${GREEN_API_TOKEN_INSTANCE}`,
            method: 'GET'
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid response: ' + data));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Test scenarios
const testScenarios = [
    {
        name: "Business Inquiry Trigger",
        message: "Hi, I need help with merchant onboarding for my business",
        description: "This should trigger the welcome message and start onboarding"
    },
    {
        name: "Go-Live Date Entry",
        message: "25/12/2024",
        description: "Sets go-live date and checks SLA (Should be within SLA)"
    },
    {
        name: "Continue Onboarding",
        message: "continue",
        description: "Proceeds to delivery address step"
    },
    {
        name: "Delivery Address",
        message: "123 Jalan Bukit Bintang, Kuala Lumpur, 50200 Malaysia",
        description: "Provides delivery address for hardware"
    },
    {
        name: "Hardware Choice",
        message: "1",
        description: "Chooses self-installation (Option 1)"
    },
    {
        name: "Product List",
        message: "Coffee, pastries, sandwiches, beverages",
        description: "Lists products for business setup"
    },
    {
        name: "Training Preference",
        message: "I prefer online training sessions on weekdays",
        description: "Provides training preferences"
    },
    {
        name: "Help Command",
        message: "help",
        description: "Tests help functionality"
    },
    {
        name: "Status Check",
        message: "status",
        description: "Checks current onboarding status"
    }
];

async function runTests() {
    try {
        // First check Green API status
        console.log('\n🔍 Checking Green API status...');
        const status = await checkMessageStatus();
        console.log(`✅ Green API Status: ${status.stateInstance}`);
        
        if (status.stateInstance !== 'authorized') {
            console.log('❌ Warning: WhatsApp not authorized. Please check your Green API setup.');
        }

        rl.question('\nEnter phone number to test (e.g., 60123456789): ', async (phoneNumber) => {
            console.log(`\n📱 Testing with phone number: +${phoneNumber}`);
            console.log('=====================================');

            for (let i = 0; i < testScenarios.length; i++) {
                const scenario = testScenarios[i];
                
                console.log(`\n${i + 1}. ${scenario.name}`);
                console.log(`📝 Message: "${scenario.message}"`);
                console.log(`💡 Expected: ${scenario.description}`);
                
                rl.question('Press Enter to send this message (or "s" to skip): ', async (action) => {
                    if (action.toLowerCase() === 's') {
                        console.log('⏭️ Skipped');
                        return;
                    }

                    try {
                        console.log('📤 Sending message...');
                        const result = await sendMessage(phoneNumber, scenario.message);
                        console.log(`✅ Message sent! ID: ${result.idMessage}`);
                        
                        // Wait a bit for response
                        console.log('⏳ Waiting 3 seconds for response...');
                        setTimeout(() => {
                            console.log('💡 Check your WhatsApp for the assistant\'s response');
                            
                            if (i === testScenarios.length - 1) {
                                console.log('\n🎉 All test scenarios completed!');
                                console.log('📊 Check http://localhost:3000/api/merchants to see stored data');
                                rl.close();
                            }
                        }, 3000);
                        
                    } catch (error) {
                        console.log(`❌ Error sending message: ${error.message}`);
                    }
                });
            }
        });

    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        rl.close();
    }
}

// Manual testing mode
function manualTest() {
    rl.question('Enter phone number to send test message to: ', (phoneNumber) => {
        rl.question('Enter message to send: ', async (message) => {
            try {
                console.log('📤 Sending message...');
                const result = await sendMessage(phoneNumber, message);
                console.log(`✅ Message sent! ID: ${result.idMessage}`);
                console.log('💡 Check your WhatsApp for the response');
            } catch (error) {
                console.log(`❌ Error: ${error.message}`);
            }
            rl.close();
        });
    });
}

// Main menu
console.log('\nChoose testing mode:');
console.log('1. Run full onboarding flow test');
console.log('2. Send single manual message');

rl.question('Enter choice (1 or 2): ', (choice) => {
    if (choice === '1') {
        runTests();
    } else if (choice === '2') {
        manualTest();
    } else {
        console.log('Invalid choice');
        rl.close();
    }
}); 