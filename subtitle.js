// subtitle.js - 字幕处理
let subtitles = [];
let subtitleTemplates = [
    "这只优雅的火烈鸟正在翩翩起舞",
    "看它轻盈的动作，像一位舞者",
    "粉色的羽毛在阳光下闪耀",
    "它展开翅膀，准备起飞",
    "这是大自然最美的舞蹈"
];

function renderSubtitle(ctx, text) {
    // 清除整个画布
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // 置文字样式
    ctx.font = 'bold 42px "Microsoft YaHei"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 计算底部位置（距离底部 100px）
    const bottomY = ctx.canvas.height - 100;
    
    // 计算文字宽度
    const textWidth = ctx.measureText(text).width;
    const padding = 40;
    const bgHeight = 60;  // 背景条高度
    
    // 绘制半透明黑色背景条
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(
        ctx.canvas.width/2 - textWidth/2 - padding,
        bottomY - bgHeight/2,
        textWidth + padding * 2,
        bgHeight
    );
    
    // 绘制文字
    ctx.fillStyle = 'white';
    ctx.fillText(text, ctx.canvas.width/2, bottomY);
}

async function playTTS(text) {
    try {
        // 确保 audioCtx 存在且状态正确
        if (!audioCtx || audioCtx.state === 'closed') {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            audioDestination = audioCtx.createMediaStreamDestination();
        }
        
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        const response = await fetch(`http://localhost:5000/tts/${encodeURIComponent(text)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        
        return new Promise((resolve, reject) => {
            audio.oncanplaythrough = async () => {
                try {
                    console.log('音频加载完成，准备播放');
                    
                    const source = audioCtx.createMediaElementSource(audio);
                    source.connect(audioDestination);
                    source.connect(audioCtx.destination);
                    
                    // 在音频实际开始播放时添加字幕
                    audio.onplay = () => {
                        const startTime = (Date.now() - recordingStartTime) / 1000;
                        subtitles.push({
                            text: text,
                            startTime: startTime,
                            duration: audio.duration
                        });
                    };
                    
                    await audio.play();
                } catch (error) {
                    reject(error);
                }
            };
            
            audio.onended = () => {
                console.log('音频播放完成');
                URL.revokeObjectURL(audioUrl);
                resolve(audio.duration);
            };
            
            audio.onerror = (e) => {
                console.error('音频错误:', e);
                URL.revokeObjectURL(audioUrl);
                reject(new Error('音频加载失败'));
            };
            
            audio.src = audioUrl;
        });
    } catch (error) {
        console.error('TTS 播放失败:', error);
        throw error;
    }
}

async function startAINarration() {
    let currentIndex = 0;
    
    async function speakNext() {
        if (currentIndex >= subtitleTemplates.length || !isRecording) return;
        
        const text = subtitleTemplates[currentIndex];
        console.log(`开始处理第 ${currentIndex + 1} 条文本:`, text);
        
        try {
            // 播放音频，字幕会在音频实际开始播放时添加
            const duration = await playTTS(text);
            
            currentIndex++;
            if (currentIndex < subtitleTemplates.length && isRecording) {
                await new Promise(resolve => setTimeout(resolve, 500));
                await speakNext();
            }
        } catch (error) {
            console.error('TTS 处理失败:', error);
            currentIndex++;
            if (currentIndex < subtitleTemplates.length && isRecording) {
                await new Promise(resolve => setTimeout(resolve, 4000));
                await speakNext();
            }
        }
    }
    
    await speakNext();
}