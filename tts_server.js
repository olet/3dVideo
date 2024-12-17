import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { EdgeTTS } from 'edge-tts';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

app.get('/tts/:text', async (req, res) => {
    const text = decodeURIComponent(req.params.text);
    const filename = `temp_${Date.now()}.mp3`;
    const filepath = path.join(__dirname, filename);
    
    try {
        const tts = new EdgeTTS();
        // 使用中文女声
        await tts.setVoice('zh-CN-XiaoxiaoNeural');
        
        // 生成音频文件
        await tts.saveToFile(text, filepath);
        
        // 发送文件
        res.sendFile(filepath, err => {
            if (err) {
                console.error('发送文件失败:', err);
            }
            // 延迟删除临时文件
            setTimeout(() => {
                fs.unlink(filepath, err => {
                    if (err) console.error('删除文件失败:', err);
                });
            }, 1000);
        });
        
    } catch (error) {
        console.error('TTS 失败:', error);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        res.status(500).json({
            error: 'TTS 失败',
            message: error.message
        });
    }
});

app.listen(5000, () => {
    console.log('TTS 服务已启动在端口 5000');
});