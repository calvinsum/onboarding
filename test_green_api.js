// Quick Green API Test Script
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔧 Green API Setup Helper');
console.log('=====================================');

rl.question('Enter your GREEN_API_ID_INSTANCE: ', (instanceId) => {
  rl.question('Enter your GREEN_API_TOKEN_INSTANCE: ', (apiToken) => {
    
    console.log('\n📝 Your .env configuration:');
    console.log('=====================================');
    const envContent = `PORT=3000
NODE_ENV=development

# Green API Configuration
GREEN_API_ID_INSTANCE=${instanceId}
GREEN_API_TOKEN_INSTANCE=${apiToken}

# Business keywords
BUSINESS_KEYWORDS=onboarding,merchant,business,setup,go-live,store,shop,payment,pos,terminal`;

    console.log(envContent);
    
    console.log('\n🧪 Testing Green API connection...');
    
    const https = require('https');
    const url = `https://api.green-api.com/waInstance${instanceId}/getStateInstance/${apiToken}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.stateInstance === 'authorized') {
            console.log('✅ Green API connection successful!');
            console.log('📱 Phone number 601154230831 is ready to receive messages');
            
            // Save .env file
            require('fs').writeFileSync('.env', envContent);
            console.log('💾 Configuration saved to .env file');
            
            console.log('\n🚀 Next steps:');
            console.log('1. Run: npm run safe');
            console.log('2. Send a WhatsApp message to 601154230831');
            console.log('3. Include keywords like "business", "onboarding", "merchant"');
            
          } else {
            console.log('❌ Connection issue:', result);
          }
        } catch (e) {
          console.log('❌ Error:', data);
        }
        rl.close();
      });
    }).on('error', (e) => {
      console.log('❌ Network error:', e.message);
      rl.close();
    });
  });
}); 