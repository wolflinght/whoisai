const axios = require('axios');

// AI模型配置
const AI_MODELS = {
  'deepseek': {
    name: 'Deepseek',
    url: 'https://api.deepseek.com/v1/chat/completions',
    key: process.env.DEEPSEEK_API_KEY
  },
  'longcat': {
    name: 'Longcat-128k',
    url: process.env.FRIDAY_API_URL,
    key: process.env.FRIDAY_API_KEY,
    model: 'longcat-128k-chat'
  },
  'gpt4': {
    name: 'GPT-4',
    url: process.env.FRIDAY_API_URL,
    key: process.env.FRIDAY_API_KEY,
    model: 'gpt-4o-2024-11-20'
  },
  'doubao': {
    name: 'Doubao-Pro',
    url: process.env.FRIDAY_API_URL,
    key: process.env.FRIDAY_API_KEY,
    model: 'Doubao-pro-128k'
  },
  'claude': {
    name: 'Claude-3',
    url: process.env.FRIDAY_API_URL,
    key: process.env.FRIDAY_API_KEY,
    model: 'anthropic.claude-3.5-sonnet-v2'
  }
};

// 获取随机AI模型
function getRandomModels(count = 3) {
  const models = Object.keys(AI_MODELS);
  const shuffled = models.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// 生成AI回答
async function generateAIAnswer(question, modelKey) {
  const model = AI_MODELS[modelKey];
  if (!model) {
    throw new Error(`Unknown model: ${modelKey}`);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${model.key}`
  };

  const messages = [
    {
      role: "system",
      content: "你正在参与一个问答游戏，需要假装自己是一个人类玩家。请用自然、真实的语气回答问题，避免过于完美或机械的回答。可以适当表达一些个人情感和观点，但要保持合理性。回答长度应该在50-150字之间。"
    },
    {
      role: "user",
      content: question
    }
  ];

  try {
    let response;
    if (modelKey === 'deepseek') {
      response = await axios.post(model.url, {
        messages,
        model: 'deepseek-chat',
        max_tokens: 150,
        temperature: 0.7
      }, { headers });
    } else {
      // Friday API调用
      response = await axios.post(model.url, {
        messages,
        model: model.model,
        max_tokens: 150,
        temperature: 0.7
      }, { headers });
    }

    return {
      answer: response.data.choices[0].message.content,
      model: model.name
    };
  } catch (error) {
    console.error(`Error generating AI answer with ${model.name}:`, error);
    return {
      answer: "抱歉，我现在有点累，让我想想...",
      model: model.name
    };
  }
}

// 生成推荐问题
async function generateSuggestedQuestions() {
  const systemPrompt = "生成3个有趣的问题，这些问题应该能帮助区分AI和人类的回答。问题应该开放性强，能引发思考和讨论。每个问题都应该独特且有深度。";
  
  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      messages: [
        {
          role: "system",
          content: systemPrompt
        }
      ],
      model: 'deepseek-chat',
      max_tokens: 150,
      temperature: 0.8
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const questions = response.data.choices[0].message.content
      .split('\n')
      .filter(q => q.trim())
      .slice(0, 3);

    return questions;
  } catch (error) {
    console.error('Error generating suggested questions:', error);
    return [
      "如果你可以选择一个超能力，你会选择什么？为什么？",
      "你最难忘的一次经历是什么？",
      "你对人工智能的未来有什么看法？"
    ];
  }
}

module.exports = {
  AI_MODELS,
  getRandomModels,
  generateAIAnswer,
  generateSuggestedQuestions
};
