// Check Green API incoming message format
require('dotenv').config();
const https = require('https');

const GREEN_API_ID_INSTANCE = process.env.GREEN_API_ID_INSTANCE;
const GREEN_API_TOKEN_INSTANCE = process.env.GREEN_API_TOKEN_INSTANCE;

function checkIncomingMessages() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.green-api.com',
            port: 443,
            path: `/waInstance${GREEN_API_ID_INSTANCE}/receiveNotification/${GREEN_API_TOKEN_INSTANCE}`,
            method: 'GET'
        };

        console.log('📥 Checking for incoming messages...');
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (data.trim() === 'null' || data.trim() === '') {
                        resolve({ message: 'No new messages' });
                    } else {
                        resolve(JSON.parse(data));
                    }
                } catch (e) {
                    resolve({ raw: data, error: 'Could not parse JSON' });
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function checkMessages() {
    try {
        console.log('🔍 Checking for any pending messages...');
        
        for (let i = 0; i < 5; i++) {
            const result = await checkIncomingMessages();
            
            if (result.message === 'No new messages') {
                console.log(`📭 Check ${i + 1}: No messages`);
            } else {
                console.log(`📬 Check ${i + 1}: Found message!`);
                console.log(JSON.stringify(result, null, 2));
                
                // If we found a message, show the sender format
                if (result.senderData && result.senderData.sender) {
                    console.log(`📱 Sender format: ${result.senderData.sender}`);
                } else if (result.chatId) {
                    console.log(`📱 Chat ID format: ${result.chatId}`);
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('\n💡 Instructions:');
        console.log('1. Now send "Hi, I need help with business onboarding" to 01154230831');
        console.log('2. Wait 10 seconds');
        console.log('3. Run this script again to see the message format');
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

checkMessages(); 