const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { Ollama } = require('ollama');
const moment = require('moment');

class LLMService {
  constructor() {
    // Initialize providers based on available API keys
    this.providers = {};
    
    if (process.env.OPENAI_API_KEY) {
      this.providers.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      console.log('✅ OpenAI LLM initialized');
    }
    
    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      console.log('✅ Anthropic Claude LLM initialized');
    }
    
    // Ollama for local models (free)
    try {
      this.providers.ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
      console.log('✅ Ollama local LLM initialized');
    } catch (error) {
      console.log('⚠️ Ollama not available:', error.message);
    }
    
    // Default provider priority
    this.defaultProvider = process.env.LLM_PROVIDER || this.getAvailableProvider();
    console.log(`🤖 Using LLM provider: ${this.defaultProvider}`);
  }
  
  getAvailableProvider() {
    if (this.providers.openai) return 'openai';
    if (this.providers.anthropic) return 'anthropic';
    if (this.providers.ollama) return 'ollama';
    return null;
  }
  
  /**
   * Generate an intelligent response for the onboarding conversation
   */
  async generateResponse(merchant, userMessage, context = {}) {
    if (!this.defaultProvider) {
      return this.fallbackResponse(merchant, userMessage);
    }
    
    try {
      const systemPrompt = this.buildSystemPrompt(merchant, context);
      const conversationHistory = this.buildConversationHistory(merchant);
      
      let response;
      
      switch (this.defaultProvider) {
        case 'openai':
          response = await this.queryOpenAI(systemPrompt, conversationHistory, userMessage);
          break;
        case 'anthropic':
          response = await this.queryClaude(systemPrompt, conversationHistory, userMessage);
          break;
        case 'ollama':
          response = await this.queryOllama(systemPrompt, conversationHistory, userMessage);
          break;
        default:
          response = this.fallbackResponse(merchant, userMessage);
      }
      
      return this.processLLMResponse(response, merchant, userMessage);
      
    } catch (error) {
      console.error('❌ LLM Error:', error);
      return this.fallbackResponse(merchant, userMessage);
    }
  }
  
  buildSystemPrompt(merchant, context) {
    const currentStep = merchant?.onboardingStep || 'welcome';
    const currentDate = moment().format('DD/MM/YYYY');
    
    return `You are a professional WhatsApp onboarding assistant for a payment processing company. Your role is to guide merchants through a 5-step onboarding process.

CURRENT CONTEXT:
- Date: ${currentDate}
- Customer Phone: ${merchant?.whatsappNumber || 'Unknown'}
- Current Step: ${currentStep}
- Company: ${merchant?.companyName || 'Not provided'}
- Status: ${merchant?.status || 'new'}

ONBOARDING STEPS:
1. WELCOME - Get go-live date in DD/MM/YYYY format
2. DELIVERY - Collect delivery address 
3. HARDWARE - Choose installation type (1=self, 2=professional)
4. PRODUCTS - Get product list/description
5. TRAINING - Schedule training session
6. CONFIRMATION - Final review and confirmation

CURRENT STEP DETAILS:
${this.getStepInstructions(currentStep, merchant)}

PERSONALITY & TONE:
- Professional yet friendly
- Use emojis appropriately (📅 📦 🔧 📋 🎓 ✅)
- Be concise but helpful
- Show empathy and understanding
- Maintain business context

CRITICAL RULES:
1. ALWAYS stay in character as a payment processing onboarding assistant
2. ONLY progress to next step when current step requirements are met
3. For go-live dates, calculate if we can meet 5+ day SLA requirement
4. If user is confused, offer help but keep them in the onboarding flow
5. Handle common requests: 'help', 'support', 'status', 'restart'
6. Validate inputs appropriately for each step
7. Be encouraging but realistic about timelines

RESPONSE FORMAT:
Provide a natural, conversational response that:
- Addresses the user's message directly
- Guides them to the next appropriate action
- Maintains the professional onboarding context
- Uses appropriate emojis and formatting for WhatsApp`;
  }
  
  getStepInstructions(step, merchant) {
    switch (step) {
      case 'welcome':
        return `GOAL: Get the customer's preferred go-live date
- Ask for date in DD/MM/YYYY format (e.g., 25/12/2024)
- Calculate days until go-live
- If 5+ days: proceed to delivery step
- If <5 days: escalate to specialist team`;
        
      case 'delivery':
        return `GOAL: Collect delivery address for hardware shipment
- Ask for complete address: Street, City, State, ZIP, Country
- Ensure address is complete and valid for shipping`;
        
      case 'hardware':
        return `GOAL: Choose installation type
- Option 1: Self-installation (Free)
- Option 2: Professional installation ($99)
- If option 2, ask for preferred installation date`;
        
      case 'products':
        return `GOAL: Get product information
- Request product list, description, or photos
- This helps configure their payment system properly`;
        
      case 'training':
        return `GOAL: Schedule training session
- Options: Video call (recommended), Phone call, In-person
- Ask for type, date (DD/MM/YYYY), and time preference (Morning/Afternoon/Evening)`;
        
      case 'confirmation':
        return `GOAL: Final review and confirmation
- Show summary of all collected information
- Allow user to 'confirm' or request 'changes'
- If confirmed, mark as completed`;
        
      default:
        return 'Handle general inquiries and guide back to onboarding process';
    }
  }
  
  buildConversationHistory(merchant) {
    if (!merchant?.conversationHistory) return [];
    
    return merchant.conversationHistory.slice(-10).map(msg => ({
      role: msg.direction === 'incoming' ? 'user' : 'assistant',
      content: msg.message
    }));
  }
  
  async queryOpenAI(systemPrompt, history, userMessage) {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage }
    ];
    
    const completion = await this.providers.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });
    
    return completion.choices[0].message.content;
  }
  
  async queryClaude(systemPrompt, history, userMessage) {
    const messages = [
      ...history,
      { role: 'user', content: userMessage }
    ];
    
    const completion = await this.providers.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages,
    });
    
    return completion.content[0].text;
  }
  
  async queryOllama(systemPrompt, history, userMessage) {
    const conversation = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage }
    ];
    
    const response = await this.providers.ollama.chat({
      model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
      messages: conversation,
      stream: false,
    });
    
    return response.message.content;
  }
  
  /**
   * Process LLM response and extract structured data
   */
  processLLMResponse(llmResponse, merchant, userMessage) {
    const response = {
      message: llmResponse,
      stepUpdate: null,
      dataExtracted: {},
      nextAction: null
    };
    
    // Extract structured data based on current step and message content
    const currentStep = merchant?.onboardingStep || 'welcome';
    const userText = userMessage.toLowerCase().trim();
    
    switch (currentStep) {
      case 'welcome':
        // Look for date patterns
        const dateMatch = userMessage.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dateMatch) {
          const goLiveDate = moment(userMessage, "DD/MM/YYYY");
          if (goLiveDate.isValid()) {
            const daysUntilGoLive = goLiveDate.diff(moment(), "days");
            const canMeetSLA = daysUntilGoLive >= 5;
            
            response.stepUpdate = canMeetSLA ? 'delivery' : 'escalated';
            response.dataExtracted = {
              goLiveDate: goLiveDate.toDate(),
              daysUntilGoLive,
              slaStatus: canMeetSLA ? 'within_sla' : 'at_risk'
            };
          }
        }
        break;
        
      case 'delivery':
        // Check if message looks like an address (length > 10 and contains common address elements)
        if (userMessage.length > 10 && /[\d\w\s,]+/.test(userMessage)) {
          response.stepUpdate = 'hardware';
          response.dataExtracted = { deliveryAddress: userMessage };
        }
        break;
        
      case 'hardware':
        if (userText === '1' || userText === '2') {
          response.stepUpdate = 'products';
          response.dataExtracted = { 
            hardwareChoice: userText === '1' ? 'self' : 'professional' 
          };
        }
        break;
        
      case 'products':
        if (userMessage.length > 5) {
          response.stepUpdate = 'training';
          response.dataExtracted = { productList: userMessage };
        }
        break;
        
      case 'training':
        if (userMessage.length > 5) {
          response.stepUpdate = 'confirmation';
          response.dataExtracted = { trainingInfo: userMessage };
        }
        break;
        
      case 'confirmation':
        if (userText === 'confirm') {
          response.stepUpdate = 'completed';
          response.dataExtracted = { status: 'completed' };
        } else if (userText === 'changes') {
          response.stepUpdate = 'delivery';
        }
        break;
    }
    
    // Handle common commands
    if (userText === 'help') {
      response.nextAction = 'help';
    } else if (userText === 'support') {
      response.nextAction = 'support';
      response.dataExtracted = { status: 'support_requested' };
    } else if (userText === 'status') {
      response.nextAction = 'status';
    } else if (userText === 'restart') {
      response.nextAction = 'restart';
    }
    
    return response;
  }
  
  /**
   * Fallback to rule-based responses when LLM is unavailable
   */
  fallbackResponse(merchant, userMessage) {
    const step = merchant?.onboardingStep || 'welcome';
    const message = userMessage.toLowerCase().trim();
    
    // This mirrors your existing logic but with better structure
    if (message === 'help') {
      return {
        message: `🆘 Help Menu:\n\n• Send your go-live date in DD/MM/YYYY format\n• Type 'support' to speak with an agent\n• Type 'status' to check your progress\n• Type 'restart' to begin again`,
        stepUpdate: null,
        dataExtracted: {},
        nextAction: 'help'
      };
    }
    
    // Add more fallback logic as needed
    return {
      message: "🤖 LLM service unavailable. Using basic responses. Please contact support for assistance.",
      stepUpdate: null,
      dataExtracted: {},
      nextAction: null
    };
  }
  
  /**
   * Generate a summary of the merchant's onboarding progress
   */
  generateProgressSummary(merchant) {
    if (!merchant) return "No onboarding data available.";
    
    const summary = `📊 Onboarding Progress Summary:

🆔 ID: ${merchant.id}
📱 Phone: ${merchant.whatsappNumber}
🏢 Company: ${merchant.companyName || 'Not provided'}
📅 Started: ${moment(merchant.createdAt).format('DD/MM/YYYY HH:mm')}
🔄 Current Step: ${merchant.onboardingStep}
✅ Status: ${merchant.status}`;

    if (merchant.goLiveDate) {
      summary += `\n📅 Go-Live: ${moment(merchant.goLiveDate).format('DD/MM/YYYY')}`;
    }
    
    if (merchant.deliveryAddress) {
      summary += `\n📦 Delivery: ${merchant.deliveryAddress.substring(0, 50)}...`;
    }
    
    return summary;
  }
}

module.exports = new LLMService(); 