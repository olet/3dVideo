import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// 添加延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 添加重试函数
async function ttsWithRetry(text: string, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await new Promise((resolve, reject) => {
                const tts = spawn('edge-tts', [
                    '--voice', 'zh-CN-XiaoxiaoNeural',
                    '--text', text,
                    '--write-media', '-'
                ]);

                let errorOutput = '';
                const chunks: Buffer[] = [];

                tts.stdout.on('data', (chunk) => {
                    chunks.push(Buffer.from(chunk));
                });

                tts.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });

                tts.on('close', (code) => {
                    if (code === 0 && chunks.length > 0) {
                        resolve(Buffer.concat(chunks));
                    } else {
                        reject(new Error(`TTS 进程退出码: ${code}\n${errorOutput}`));
                    }
                });

                tts.on('error', reject);

                // 设置超时
                const timeout = setTimeout(() => {
                    tts.kill();
                    reject(new Error('TTS 进程超时'));
                }, 15000);

                // 清理超时
                tts.on('close', () => clearTimeout(timeout));
            });
        } catch (error) {
            console.error(`第 ${i + 1} 次尝试失败:`, error);
            if (i === maxRetries - 1) throw error;
            // 指数退避，每次失败后等待更长时间
            await delay(Math.min(1000 * Math.pow(2, i), 10000));
        }
    }
}

app.get('/tts/:text', async (req, res) => {
    const text = decodeURIComponent(req.params.text);
    let retryCount = 0;
    
    try {
        console.log('处理 TTS 请求:', text);
        
        // 设置响应头
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-cache');
        
        // 使用重试机制获取音频数据
        const audioData = await ttsWithRetry(text);
        
        // 验证音频数据
        if (!audioData || audioData.length === 0) {
            throw new Error('生成的音频数据为空');
        }
        
        // 发送音频数据
        res.end(audioData);

    } catch (error) {
        console.error('TTS 失败:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'TTS 失败',
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('未处理的 Promise 拒绝:', error);
});

app.listen(5000, () => {
    console.log('TTS 服务已启动在端口 5000');
}); 