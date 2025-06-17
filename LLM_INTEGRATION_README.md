# 🤖 LLM Integration for WhatsApp Onboarding Assistant

This document explains how to integrate Large Language Models (LLMs) into your WhatsApp onboarding assistant for intelligent, context-aware conversations.

## 🎯 Overview

The LLM integration transforms your rule-based onboarding flow into an intelligent conversational assistant that can:

- **Understand natural language** instead of requiring exact keywords
- **Maintain conversation context** across multiple messages
- **Extract structured data** from conversational input
- **Provide helpful, contextual responses** while maintaining the onboarding flow
- **Fall back gracefully** to rule-based responses if LLM services fail

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

The following LLM packages are now included:
- `openai` - OpenAI GPT models
- `@anthropic-ai/sdk` - Anthropic Claude models  
- `ollama` - Local LLM models

### 2. Configure Environment

Copy the environment template and configure your preferred LLM provider:

```bash
cp env.example .env
```

**Choose one or more LLM providers:**

#### Option A: OpenAI GPT (Recommended)
```env
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-3.5-turbo
```
- **Cost**: ~$0.002 per 1K tokens
- **Quality**: Excellent
- **Setup**: Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)

#### Option B: Anthropic Claude
```env
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
ANTHROPIC_MODEL=claude-3-haiku-20240307
```
- **Cost**: ~$0.00025 per 1K tokens (Haiku model)
- **Quality**: Excellent
- **Setup**: Get API key from [Anthropic Console](https://console.anthropic.com/)

#### Option C: Ollama (Free Local LLM)
```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```
- **Cost**: Free (runs locally)
- **Quality**: Good
- **Setup**: Install [Ollama](https://ollama.ai) and run `ollama pull llama3.1:8b`

### 3. Run LLM-Powered Versions

```bash
# Demo version with LLM (web interface)
npm run llm-demo

# Production version with Green API + LLM
npm run llm-safe
```

## 📋 Available Versions

### New LLM-Powered Scripts

| Script | Description | Port | Use Case |
|--------|-------------|------|----------|
| `npm run llm-demo` | Interactive LLM demo | 3002 | Team demos, testing |
| `npm run llm-safe` | Green API + LLM | 3000 | Production WhatsApp |

### Existing Scripts (Enhanced)

All existing scripts now support LLM fallback mode if configured:

```bash
npm run demo     # Original demo (can use LLM if configured)
npm run safe     # Original Green API (can use LLM if configured)
npm run free     # WhatsApp Web (can use LLM if configured)
```

## 🧠 LLM Features

### Natural Language Understanding

**Before (Rule-based):**
```
User: "I want to start"
Bot: "🤔 I don't understand. Try: 'merchant onboarding'"
```

**After (LLM-powered):**
```
User: "I want to start my business setup"
Bot: "🎉 Welcome! I'd love to help you with your business onboarding. To get started, please share your preferred Go-Live date in DD/MM/YYYY format..."
```

### Context-Aware Responses

The LLM maintains conversation context and provides relevant responses based on:
- Current onboarding step
- Previous conversation history
- Extracted merchant data
- Business context

### Smart Data Extraction

**Examples:**
```
User: "I need to go live by Christmas this year"
→ Extracts: 25/12/2024, calculates SLA automatically

User: "My store is at 123 Main St, New York, NY 10001, USA"
→ Extracts: Complete delivery address, advances to next step

User: "I sell coffee, pastries, and light snacks"
→ Extracts: Product information, configures payment system
```

### Graceful Fallbacks

If LLM services fail or aren't configured:
1. **Automatic fallback** to rule-based responses
2. **No service interruption**
3. **Clear error logging**
4. **Maintains core functionality**

## 🔧 Configuration Options

### LLM Provider Priority

The system automatically detects available providers in this order:
1. OpenAI (if `OPENAI_API_KEY` is set)
2. Anthropic (if `ANTHROPIC_API_KEY` is set)  
3. Ollama (if running locally)
4. Fallback mode (rule-based responses)

### Advanced Settings

```env
# Response configuration
LLM_MAX_TOKENS=500          # Maximum response length
LLM_TEMPERATURE=0.7         # Creativity vs consistency (0-1)
LLM_TIMEOUT_MS=30000        # Request timeout
LLM_HISTORY_LIMIT=10        # Conversation history to include

# Fallback behavior
LLM_FALLBACK_ENABLED=true   # Enable fallback to rule-based responses
```

## 💰 Cost Analysis

### OpenAI GPT-3.5-turbo
- **Input**: $0.0015 per 1K tokens
- **Output**: $0.002 per 1K tokens
- **Average conversation**: ~5K tokens = $0.01-0.02
- **1000 onboardings/month**: ~$15-25

### Anthropic Claude Haiku
- **Input**: $0.00025 per 1K tokens  
- **Output**: $0.00125 per 1K tokens
- **Average conversation**: ~5K tokens = $0.004-0.007
- **1000 onboardings/month**: ~$5-10

### Ollama (Local)
- **Cost**: Free
- **Requirements**: 8GB+ RAM, modern CPU/GPU
- **Models**: Llama 3.1, Mistral, CodeLlama, etc.

## 🛡️ Safety & Reliability

### Business Context Enforcement

The LLM is trained to:
- **Stay in character** as a payment processing onboarding assistant
- **Maintain business context** throughout conversations
- **Follow the structured onboarding flow**
- **Validate user inputs** appropriately
- **Handle edge cases** gracefully

### Error Handling

- **API timeouts**: Automatic fallback to rule-based responses
- **Rate limits**: Built-in retry logic with exponential backoff
- **Invalid responses**: Validation and re-prompting
- **Service outages**: Seamless fallback mode

### Data Privacy

- **No conversation storage** in LLM provider systems (when using API mode)
- **Local processing** option with Ollama
- **Configurable data retention**
- **PII handling** according to your privacy policy

## 📊 Monitoring & Analytics

### LLM Status Endpoint

```bash
curl http://localhost:3002/api/llm-demo/status
```

Response:
```json
{
  "llmProvider": "openai",
  "availableProviders": ["openai", "ollama"],
  "fallbackMode": false,
  "timestamp": "2024-06-17T02:34:38.000Z"
}
```

### Conversation Analytics

All LLM-powered conversations include:
- **Response source** (LLM provider or fallback)
- **Processing time**
- **Token usage** (if available)
- **Step progression tracking**
- **Data extraction success**

## 🔄 Migration from Rule-Based

### Gradual Migration

1. **Start with LLM demo** to test responses
2. **Configure fallback mode** for safety
3. **Monitor conversation quality**
4. **Gradually increase LLM usage**
5. **Fine-tune prompts** based on real conversations

### A/B Testing

Run both versions simultaneously:
```bash
# Terminal 1: Original rule-based
npm run safe

# Terminal 2: LLM-powered  
npm run llm-safe
```

Compare conversation quality, completion rates, and user satisfaction.

## 🎯 Best Practices

### Prompt Engineering

The system includes optimized prompts for:
- **Professional business tone**
- **Clear step-by-step guidance**
- **Appropriate emoji usage**
- **WhatsApp-optimized formatting**
- **Context-aware responses**

### Token Management

- **Conversation history limit** prevents token bloat
- **Smart context inclusion** maintains relevance
- **Response length limits** ensure concise answers
- **Automatic cleanup** of old conversations

### Quality Assurance

- **Regular prompt testing** with various inputs
- **Fallback scenario testing**
- **Edge case handling validation**
- **Performance monitoring**

## 🚀 Advanced Features

### Custom Business Logic

Extend the LLM service with custom business rules:

```javascript
// backend/services/llm.js
processLLMResponse(llmResponse, merchant, userMessage) {
  // Add custom business logic
  if (merchant.companyType === 'restaurant') {
    // Special handling for restaurants
  }
  
  return response;
}
```

### Multi-Language Support

Configure language-specific prompts:

```env
LLM_LANGUAGE=english
LLM_LANGUAGE_FALLBACK=spanish
```

### Integration with CRM

Connect LLM insights to your CRM:

```javascript
// Extract business intelligence
const insights = await llmService.analyzeConversation(merchant);
await crmService.updateMerchantProfile(merchant.id, insights);
```

## 🆘 Troubleshooting

### Common Issues

#### LLM Not Responding
```bash
# Check API key configuration
curl http://localhost:3002/api/llm-demo/status

# Check logs for errors
npm run llm-demo 2>&1 | grep ERROR
```

#### High Token Usage
- Reduce `LLM_HISTORY_LIMIT`
- Decrease `LLM_MAX_TOKENS`
- Use cheaper models (Claude Haiku, GPT-3.5)

#### Poor Response Quality
- Adjust `LLM_TEMPERATURE` (lower = more consistent)
- Update system prompts
- Switch to better models (GPT-4, Claude Sonnet)

#### Fallback Mode Active
- Check API key validity
- Verify network connectivity
- Check service status pages

### Getting Help

1. **Check logs** for specific error messages
2. **Test API connectivity** with curl
3. **Verify environment configuration**
4. **Review LLM provider documentation**
5. **Contact support** with specific error details

## 🔮 Future Enhancements

### Planned Features

- **Voice message transcription** and processing
- **Multi-modal support** (images, documents)
- **Advanced analytics** and conversation insights
- **Custom model fine-tuning**
- **Real-time sentiment analysis**
- **Automated quality scoring**

### Contributing

To contribute LLM improvements:

1. **Test new prompts** in demo mode
2. **Submit conversation examples** that work well
3. **Report edge cases** or problematic responses
4. **Suggest new LLM providers** or models
5. **Share optimization strategies**

---

## 📞 Support

For LLM integration support:
- **Documentation issues**: Check this README
- **Configuration help**: Review `env.example`
- **API errors**: Check provider status pages
- **Performance issues**: Monitor token usage and response times

The LLM integration maintains backward compatibility with all existing features while adding powerful conversational AI capabilities to your WhatsApp onboarding assistant. 