const logger = require('./logger');

// 定义模型接口配置
const MODEL_CONFIGS = {
  gpt35: {
    name: 'GPT-3.5',
    model: 'gpt-3.5-turbo-1106',
    maxTokens: 150
  },
  gpt4: {
    name: 'GPT-4',
    model: 'gpt-4o-mini',
    maxTokens: 150
  },
  claude2: {
    name: 'Claude-2',
    model: 'anthropic.claude-3-haiku',
    maxTokens: 150
  },
  doubao: {
    name: '豆包',
    model: 'Doubao-pro-32k-1215',
    maxTokens: 150
  },
  moonshot: {
    name: 'Moonshot',
    model: 'moonshot-v1-8k',
    maxTokens: 150
  },
  qwen: {
    name: '通义千问',
    model: 'qwen-turbo-latest',
    maxTokens: 150
  },
  step: {
    name: '阶跃星辰',
    model: 'step-2-mini',
    maxTokens: 150
  },
  abab: {
    name: 'ABAB',
    model: 'abab6.5s-chat',
    maxTokens: 150
  },
  longcat: {
    name: 'LongCat',
    model: 'LongCat-8B-128K-Chat',
    maxTokens: 150
  }
};

// 统一的请求处理函数
async function makeModelRequest(modelKey, prompt, options = {}) {
  const config = MODEL_CONFIGS[modelKey];
  if (!config) {
    throw new Error(`Unknown model: ${modelKey}`);
  }

  logger.info(`Sending request to ${config.name}`, {
    modelKey,
    prompt: prompt.substring(0, 100) + '...' // 只记录前100个字符
  });

  try {
    const response = await makeFridayRequest(config, prompt, options);

    logger.info(`Received response from ${config.name}`, {
      modelKey,
      response: response.substring(0, 100) + '...' // 只记录前100个字符
    });

    return response;
  } catch (error) {
    logger.error(`Error from ${config.name}:`, {
      modelKey,
      error: error.message
    });
    throw error;
  }
}

// Friday One-API 请求
async function makeFridayRequest(config, prompt, options) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.FRIDAY_API_KEY}`
  };

  const body = {
    model: config.model,
    messages: [
      {
        role: 'system',
        content: options.systemPrompt || '你是一个AI助手，请简洁地回答问题。'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: config.maxTokens,
    temperature: options.temperature || 0.7,
    stream: false
  };

  // 为 ABAB 模型添加特殊参数
  if (config.model.startsWith('abab')) {
    body.minimax_api_name = 'chat_v2';
  }

  const response = await fetch('https://aigc.sankuai.com/v1/openai/native/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Friday API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// 批量发送请求给所有模型
async function sendToAllModels(prompt, options = {}) {
  const requests = Object.keys(MODEL_CONFIGS).map(async modelKey => {
    try {
      const response = await makeModelRequest(modelKey, prompt, options);
      return {
        modelKey,
        success: true,
        response
      };
    } catch (error) {
      return {
        modelKey,
        success: false,
        error: error.message
      };
    }
  });

  return Promise.all(requests);
}

module.exports = {
  MODEL_CONFIGS,
  makeModelRequest,
  sendToAllModels
};
