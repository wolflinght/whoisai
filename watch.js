const fs = require('fs');
const path = require('path');

// 监听的目录
const watchDir = __dirname;

// 创建文件监听器
fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    
    const filePath = path.join(watchDir, filename);
    
    // 检查文件是否存在
    if (fs.existsSync(filePath)) {
        console.log(`File ${filename} ${eventType}`);
        
        // 如果是 .env 文件变化，特殊处理
        if (filename === '.env') {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                console.log('ENV file content updated:', content);
            } catch (err) {
                console.error('Error reading .env file:', err);
            }
        }
    }
});

console.log('Watching for file changes...');

// 保持进程运行
setInterval(() => {}, 1000);
