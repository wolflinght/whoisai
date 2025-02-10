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
    model: 'anthropic.claude-3-haiku'
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

// 生成推荐问题
export async function generateSuggestedQuestions() {
  // 默认问题列表
  const defaultQuestions = [
    "如果你可以选择成为任何动物，你会选择什么？为什么？",
    "你认为人工智能会在未来取代人类的工作吗？为什么？",
    "你最近一次让你感动或感激的经历是什么？",
    "如果你可以立即掌握一项技能，你会选择什么？为什么？",
    "你认为在数字时代保持真实的人际关系有多重要？",
    "如果你可以和历史上任何一个人共进晚餐，你会选择谁？为什么？",
    "你觉得什么样的生活才算是有意义的生活？",
    "在你看来，什么是真正的快乐？",
    "如果你可以改变过去的一件事，你会选择改变什么？",
    "你认为人类最宝贵的品质是什么？为什么？"
  ];

  const model = AI_MODELS['gpt35'];
  const systemPrompt = `生成3个有趣的问题，这些问题应该能帮助区分AI和人类的回答。要求：
1. 问题要开放性强，能引发思考和讨论
2. 每个问题都应该独特且有深度
3. 避免技术性或专业性太强的问题
4. 问题应该关注个人经历、观点和情感
5. 确保问题适合所有年龄段的人回答`;
  
  try {
    console.log('Generating suggested questions...');
    const response = await axios.post(model.url, {
      messages: [
        {
          role: "system",
          content: systemPrompt
        }
      ],
      model: model.model,
      max_tokens: 200,
      temperature: 0.8,
      top_p: 0.9
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.key}`
      }
    });

    if (!response.data?.choices?.[0]?.message?.content) {
      console.error('Invalid response structure for suggested questions:', response.data);
      throw new Error('Invalid response structure');
    }

    const content = response.data.choices[0].message.content;
    const questions = content.split('\n').filter(q => q.trim());
    
    if (questions.length < 3) {
      console.warn('Not enough questions generated, using default questions');
      return getRandomQuestions(defaultQuestions, 3);
    }

    return questions.slice(0, 3);
  } catch (error) {
    console.error('Error generating suggested questions:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    // 在出错时返回随机的默认问题
    console.log('Using default questions due to error');
    return getRandomQuestions(defaultQuestions, 3);
  }
}

// 从问题列表中随机获取指定数量的问题
function getRandomQuestions(questions, count) {
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
