import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
const envPath = join(__dirname, '.env');
console.log('Loading environment variables from:', envPath);
const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

// 验证环境变量
if (!result.parsed?.FRIDAY_API_URL || !result.parsed?.FRIDAY_API_KEY) {
  console.error('错误: 环境变量未设置');
  console.error('请确保 .env 文件中包含以下变量:');
  console.error('FRIDAY_API_URL=your_friday_api_url');
  console.error('FRIDAY_API_KEY=your_friday_api_key');
  console.error('当前环境变量值:');
  console.error('FRIDAY_API_URL:', result.parsed?.FRIDAY_API_URL);
  console.error('FRIDAY_API_KEY:', result.parsed?.FRIDAY_API_KEY);
  process.exit(1);
}

// 手动设置环境变量
process.env.FRIDAY_API_URL = result.parsed.FRIDAY_API_URL;
process.env.FRIDAY_API_KEY = result.parsed.FRIDAY_API_KEY;

console.log('环境变量已加载:');
console.log('FRIDAY_API_URL:', process.env.FRIDAY_API_URL);
console.log('FRIDAY_API_KEY:', process.env.FRIDAY_API_KEY.substring(0, 5) + '...');

// 导入 AI 模块
import { AI_MODELS, generateAIAnswer } from './server/src/services/ai.js';

async function testModels() {
  const question = "你最喜欢的一道菜是什么？为什么？";
  
  console.log('\n开始测试模型...\n');
  
  for (const [modelKey, model] of Object.entries(AI_MODELS)) {
    console.log(`\n测试模型: ${model.name} (${modelKey})`);
    console.log('-'.repeat(50));
    
    try {
      console.log('请求配置:');
      console.log('URL:', model.url);
      console.log('Model:', model.model);
      
      const answer = await generateAIAnswer(question, modelKey);
      console.log('\n回答:', answer);
    } catch (error) {
      console.error(`Error generating AI answer with ${model.name}:`, error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }
  }
}

testModels().catch(error => {
  console.error('测试过程中发生错误:', error);
  process.exit(1);
});
