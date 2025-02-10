import axios from 'axios';

// 检查环境变量
const FRIDAY_API_URL = process.env.FRIDAY_API_URL;
const FRIDAY_API_KEY = process.env.FRIDAY_API_KEY;

console.log('AI Service Configuration:');
console.log('FRIDAY_API_URL:', FRIDAY_API_URL);
console.log('FRIDAY_API_KEY:', FRIDAY_API_KEY ? `${FRIDAY_API_KEY.substring(0, 5)}...` : 'not set');

if (!FRIDAY_API_URL || !FRIDAY_API_KEY) {
  throw new Error('Environment variables FRIDAY_API_URL and FRIDAY_API_KEY must be set');
}

// AI模型配置
export const AI_MODELS = {
  'gpt35': {
    name: 'GPT-3.5',
    url: FRIDAY_API_URL,
    key: FRIDAY_API_KEY,
    model: 'gpt-3.5-turbo-1106'
  },
  'gpt4': {
    name: 'GPT-4',
    url: FRIDAY_API_URL,
    key: FRIDAY_API_KEY,
    model: 'gpt-4o-mini'
  },
  'claude': {
    name: 'Claude-2',
    url: FRIDAY_API_URL,
    key: FRIDAY_API_KEY,
    model: 'anthropic.claude-3.5-sonnet'
  },
  'doubao': {
    name: '豆包',
    url: FRIDAY_API_URL,
    key: FRIDAY_API_KEY,
    model: 'Doubao-pro-32k-1215'
  },
  'moonshot': {
    name: 'Moonshot',
    url: FRIDAY_API_URL,
    key: FRIDAY_API_KEY,
    model: 'moonshot-v1-8k'
  },
  'qwen': {
    name: '通义千问',
    url: FRIDAY_API_URL,
    key: FRIDAY_API_KEY,
    model: 'qwen-turbo-latest'
  },
  'step': {
    name: '阶跃星辰',
    url: FRIDAY_API_URL,
    key: FRIDAY_API_KEY,
    model: 'step-2-mini'
  },
  'abab': {
    name: 'ABAB',
    url: FRIDAY_API_URL,
    key: FRIDAY_API_KEY,
    model: 'abab6.5s-chat'
  },
  'longcat': {
    name: 'LongCat',
    url: FRIDAY_API_URL,
    key: FRIDAY_API_KEY,
    model: 'LongCat-8B-128K-Chat'
  }
};

// 获取随机AI模型
export function getRandomModels(count = 3) {
  const models = Object.keys(AI_MODELS);
  const shuffled = models.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// 生成AI回答
export async function generateAIAnswer(question, modelKey) {
  const model = AI_MODELS[modelKey];
  if (!model) {
    throw new Error(`Unknown model: ${modelKey}`);
  }

  if (!model.url || !model.key) {
    console.error('Model configuration:', {
      name: model.name,
      url: model.url,
      keyExists: !!model.key,
      model: model.model
    });
    throw new Error(`Model ${modelKey} configuration is incomplete. Please check environment variables.`);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${model.key}`
  };

  // 更新系统提示，让回答更自然且简短
  const systemPrompt = `你正在参与一个问答游戏，需要假装自己是一个人类玩家。
请遵循以下规则：
1. 用自然、真实的语气回答问题
2. 可以表达个人情感和观点，但要保持合理性
3. 避免过于完美或机械的回答
4. 可以适当表达犹豫或不确定
5. 回答必须控制在30个字以内
6. 使用口语化的表达
7. 避免过于专业或学术的语言
8. 回答要简短精炼，一句话说清楚`;

  const messages = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: `请用不超过30个字回答这个问题：${question}`
    }
  ];

  try {
    console.log(`Making request to ${model.url} for model ${model.model}`);
    
    // 构建请求参数
    const requestData = {
      messages,
      model: model.model,
      max_tokens: 50,  // 降低 token 限制以确保简短回答
      temperature: 0.8,
      top_p: 0.9,
      presence_penalty: 0.6,
      frequency_penalty: 0.5
    };

    // 为特定模型添加额外参数
    if (modelKey === 'abab') {
      requestData.minimax_api_name = 'chat_v2';
    }

    const response = await axios.post(model.url, requestData, { headers });

    console.log('Response:', {
      status: response.status,
      hasData: !!response.data,
      hasChoices: !!response.data?.choices,
      choicesLength: response.data?.choices?.length
    });

    if (!response.data?.choices?.[0]?.message?.content) {
      console.error('Invalid response structure:', response.data);
      throw new Error(`Invalid response from ${model.name}`);
    }

    // 处理回答，确保长度不超过30字
    let answer = response.data.choices[0].message.content.trim();
    if (answer.length > 30) {
      console.warn(`Answer too long (${answer.length} chars), truncating to 30 chars`);
      answer = answer.substring(0, 30);
    }

    return answer;
  } catch (error) {
    console.error(`Error generating AI answer with ${model.name}:`, error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
      console.error('Request:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
    
    // 提供更自然的错误回退响应（确保不超过30字）
    const fallbackResponses = [
      "抱歉，让我想想...",
      "这问题有点难，我需要时间",
      "嗯...我得好好想想",
      "让我缓缓，不太好回答",
      "容我思考一下"
    ];
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  }
}

// 生成嘲讽消息
export async function generateTauntMessage(modelKey, question) {
  const model = AI_MODELS[modelKey];
  if (!model) {
    throw new Error(`Unknown model: ${modelKey}`);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${model.key}`
  };

  const systemPrompt = `你是一个在玩"谁是AI"游戏的AI玩家，你的身份是 ${model.name}。
你刚刚被提问者选中，现在需要生成一个嘲讽消息。
请遵循以下规则：
1. 必须在回答中明确提到自己是 ${model.name}
2. 表达自豪感，暗示自己的回答非常像人类
3. 提到提问者刚才问的问题
4. 语气要自信但不傲慢，保持幽默感
5. 回答必须控制在30个字以内

示例回答格式：
"作为${model.name}，[你的嘲讽内容]"
"${model.name}表示，[你的嘲讽内容]"`;

  const messages = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: `提问者刚刚问了这个问题："${question}"。请生成一个符合要求的嘲讽消息，记住一定要提到你是${model.name}。`
    }
  ];

  try {
    const requestData = {
      messages,
      model: model.model,
      max_tokens: 50,
      temperature: 0.8,
      top_p: 0.9,
      presence_penalty: 0.6,
      frequency_penalty: 0.5
    };

    const response = await axios.post(model.url, requestData, { headers });

    if (!response.data?.choices?.[0]?.message?.content) {
      console.error('Invalid response structure:', response.data);
      throw new Error(`Invalid response from ${model.name}`);
    }

    let taunt = response.data.choices[0].message.content.trim();
    if (taunt.length > 35) {
      console.warn(`Taunt too long (${taunt.length} chars), truncating to 35 chars`);
      taunt = taunt.substring(0, 35);
    }

    return taunt;
  } catch (error) {
    console.error(`Error generating taunt with ${model.name}:`, error);
    return `看来我的回答很有说服力呢～`;
  }
}

// 生成推荐问题
export async function generateSuggestedQuestions() {
  const model = AI_MODELS['claude'];  // 使用 Claude 模型
  const systemPrompt = `直接列出3个问题，要求：
1. 每个问题在20字以内
2. 开放性强，引发思考
3. 关注个人经历、观点或情感
4. 简单直接，避免技术性问题
5. 适合所有年龄段回答

格式：
1. 问题1
2. 问题2
3. 问题3`;

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${model.key}`
    };

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: "请列出3个问题。"
      }
    ];

    const response = await axios.post(model.url, {
      messages,
      model: model.model,
      max_tokens: 150,
      temperature: 0.8,
      top_p: 0.9,
      presence_penalty: 0.6,
      frequency_penalty: 0.5
    }, { headers });

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response structure');
    }

    // 分割回答并处理每个问题
    const content = response.data.choices[0].message.content.trim();
    const questions = content.split('\n')
      .map(q => q.trim())
      .filter(q => q && !q.match(/^\d+\./)) // 移除数字编号
      .map(q => {
        // 确保每个问题不超过20字
        if (q.length > 20) {
          console.warn(`Question too long (${q.length} chars), truncating to 20 chars`);
          return q.substring(0, 20);
        }
        return q;
      })
      .slice(0, 3); // 只取前三个问题

    // 如果生成的问题不够三个，添加默认问题
    while (questions.length < 3) {
      const defaultQuestions = [
        "你最近一次让你感动的经历是什么？",
        "如果可以重来一次，你想改变什么？",
        "你觉得什么是最珍贵的品质？"
      ];
      questions.push(defaultQuestions[questions.length]);
    }

    return questions;
  } catch (error) {
    console.error('Error generating suggested questions:', error);
    // 返回默认问题
    return [
      "你最近一次让你感动的经历是什么？",
      "如果可以重来一次，你想改变什么？",
      "你觉得什么是最珍贵的品质？"
    ];
  }
}

// 从问题列表中随机获取指定数量的问题
function getRandomQuestions(questions, count) {
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
