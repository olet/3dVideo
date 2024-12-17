// recording.js - 录制功能相关
let isRecording = false;
let recordedVideos = [];
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = 0;
let recordingTimer = null;
let thumbnailCanvas = document.createElement('canvas');
let audioContext = null;
let audioSource = null;
let audioBuffer = null;
let audioCtx = null;
let audioDestination = null;
let audioStream = null;

const STORAGE_KEY = 'recordedVideos';

// 加载保存的视频记录
function loadSavedVideos() {
    const savedVideos = localStorage.getItem(STORAGE_KEY);
    if (savedVideos) {
        try {
            recordedVideos = JSON.parse(savedVideos);
            recordedVideos.forEach(videoInfo => {
                if (videoInfo.thumbnail) {
                    updateProgressWithPreview(videoInfo);
                }
            });
        } catch (error) {
            console.error('恢复历史记录失败:', error);
            recordedVideos = [];
        }
    }
}

function updateRecordingTime() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('recordingTime').textContent = `${minutes}:${seconds}`;
}

function checkRecordingSize() {
    const maxDuration = document.getElementById('maxDuration').value;
    const elapsed = (Date.now() - recordingStartTime) / 1000;
    
    if (elapsed >= maxDuration) {
        toggleRecording(); // 停止录制
    }
}

async function createThumbnail(canvas) {
    // 创建临时canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 160;
    tempCanvas.height = 90;
    const ctx = tempCanvas.getContext('2d');
    
    // 清空画布并设置黑色背景
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    try {
        // 等待一帧确保场景已渲染
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // 保持宽高比绘制
        const canvasAspect = canvas.width / canvas.height;
        const thumbAspect = tempCanvas.width / tempCanvas.height;
        
        let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
        
        if (canvasAspect > thumbAspect) {
            drawHeight = tempCanvas.height;
            drawWidth = drawHeight * canvasAspect;
            offsetX = (tempCanvas.width - drawWidth) / 2;
        } else {
            drawWidth = tempCanvas.width;
            drawHeight = drawWidth / canvasAspect;
            offsetY = (tempCanvas.height - drawHeight) / 2;
        }
        
        // 绘制缩略图
        ctx.drawImage(canvas, offsetX, offsetY, drawWidth, drawHeight);
        
        // 返回base64图数据
        return tempCanvas.toDataURL('image/jpeg', 0.85);
    } catch (error) {
        console.error('创建缩略图失败:', error);
        return 'data:image/jpeg;base64,...';
    }
}

function updateProgressWithPreview(videoInfo) {
    const videosList = document.querySelector('.videos-list');
    if (!videosList) return;

    const previewDiv = document.createElement('div');
    previewDiv.className = 'recordingPreview';
    previewDiv.innerHTML = `
        <div class="preview-image">
            <img src="${videoInfo.thumbnail}" alt="预览图">
        </div>
        <div class="preview-info">
            <div class="title">✨ ${videoInfo.name}</div>
            <div class="details">
                时长: ${Math.floor(videoInfo.duration / 60)}:${(videoInfo.duration % 60).toString().padStart(2, '0')} | 
                大小: ${videoInfo.size}MB
            </div>
            <div class="preview-actions">
                <button onclick="playVideo('${videoInfo.url}')" class="preview-btn play-btn">▶</button>
                <button onclick="downloadVideo('${videoInfo.url}', '${videoInfo.name}')" class="preview-btn download-btn">⭳</button>
                <button onclick="deleteVideo('${videoInfo.timestamp}')" class="preview-btn delete-btn">×</button>
            </div>
        </div>
    `;
    
    const firstChild = videosList.firstElementChild;
    if (firstChild) {
        videosList.insertBefore(previewDiv, firstChild);
    } else {
        videosList.appendChild(previewDiv);
    }
}

function toggleRecording() {
    const recordingTime = document.getElementById('recordingTime');
    const progressContainer = document.getElementById('progressContainer');
    
    if (!isRecording) {
        try {
            // 开始录制
            isRecording = true;
            recordedChunks = [];
            recordingStartTime = Date.now();
            subtitles = [];  // 清空字幕数组
            
            // 清空字幕画布
            const subtitleCanvas = document.getElementById('subtitleCanvas');
            if (subtitleCanvas) {
                const ctx = subtitleCanvas.getContext('2d');
                ctx.clearRect(0, 0, subtitleCanvas.width, subtitleCanvas.height);
            }
            
            // 更新录制时长显示
            recordingTime.style.display = 'inline';
            recordingTimer = setInterval(updateRecordingTime, 1000);

            // 初始化音频上下文
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            audioDestination = audioCtx.createMediaStreamDestination();

            // 创建合成 canvas
            const gameScene = document.getElementById('gameScene');
            const compositeCanvas = document.createElement('canvas');
            compositeCanvas.width = gameScene.clientWidth;
            compositeCanvas.height = gameScene.clientHeight;
            const compositeCtx = compositeCanvas.getContext('2d');

            // 保存渲染函数
            const originalRender = renderer.render;
            renderer.render.__original = originalRender;

            // 修改渲染函数
            renderer.render = function(scene, camera) {
                originalRender.call(this, scene, camera);
                if (isRecording) {
                    // 先清除合成画布
                    compositeCtx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
                    
                    // 绘制3D场景
                    compositeCtx.drawImage(this.domElement, 0, 0);
                    
                    // 如果有活动字幕，先渲染到字幕 canvas 上
                    const currentTime = (Date.now() - recordingStartTime) / 1000;
                    const activeSubtitle = subtitles.find(sub => 
                        currentTime >= sub.startTime && currentTime < (sub.startTime + sub.duration)
                    );
                    
                    if (activeSubtitle) {
                        const subtitleCanvas = document.getElementById('subtitleCanvas');
                        if (subtitleCanvas) {
                            // 确保字幕 canvas 尺寸正确
                            subtitleCanvas.width = compositeCanvas.width;
                            subtitleCanvas.height = compositeCanvas.height;
                            
                            // 渲染字幕
                            const ctx = subtitleCanvas.getContext('2d');
                            renderSubtitle(ctx, activeSubtitle.text);
                            
                            // 将字幕合成到录制画布上
                            compositeCtx.drawImage(subtitleCanvas, 0, 0);
                        }
                    }
                }
            };

            // 添加窗口大小变化监听
            window.addEventListener('resize', () => {
                if (isRecording) {
                    compositeCanvas.width = gameScene.clientWidth;
                    compositeCanvas.height = gameScene.clientHeight;
                }
            });

            // 创建视频流
            const videoStream = compositeCanvas.captureStream(60);
            
            // 并视频和音频
            const tracks = [
                ...videoStream.getVideoTracks(),
                audioDestination.stream.getAudioTracks()[0]
            ];
            const combinedStream = new MediaStream(tracks);

            // 置 MediaRecorder
            const quality = document.getElementById('qualitySelect').value;
            const bitrate = quality === 'high' ? 8000000 : 
                        quality === 'medium' ? 5000000 : 2500000;

            mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType: 'video/webm;codecs=vp8,opus',
                videoBitsPerSecond: bitrate
            });

            // 处理录制的数据
            mediaRecorder.ondataavailable = function(e) {
                if (e.data.size > 0) {
                    recordedChunks.push(e.data);
                }
            };

            // 开始录制
            mediaRecorder.start(100);
            
            const button = document.getElementById('recordButton');
            button.textContent = '停止录制';
            button.classList.add('recording');
            
            // 始 AI 语音和字幕生成
            startAINarration();

        } catch (error) {
            console.error('录制初始化失败:', error);
            alert('录制初始化败，请重试');
            isRecording = false;
        }
    } else {
        // 停止录制
        isRecording = false;
        
        // 立即清除字幕显示
        const subtitleCanvas = document.getElementById('subtitleCanvas');
        if (subtitleCanvas) {
            const ctx = subtitleCanvas.getContext('2d');
            ctx.clearRect(0, 0, subtitleCanvas.width, subtitleCanvas.height);
        }
        subtitles = [];  // 清空字幕数组
        
        // 停止音频流
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }
        
        // 清理音频上下文
        if (audioCtx) {
            audioCtx.close();
            audioCtx = null;
            audioDestination = null;
        }
        
        // 恢复原始渲染函数
        if (renderer.render.__original) {
            renderer.render = renderer.render.__original;
        }
        
        // 停止 MediaRecorder
        mediaRecorder.stop();
        
        // 显示进度条
        progressContainer.style.display = 'block';
        
        // 等数据处理完成
        mediaRecorder.onstop = async () => {
            try {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                
                await new Promise(resolve => setTimeout(resolve, 100));
                const thumbnailUrl = await createThumbnail(renderer.domElement);
                
                const filename = `3D场景录制_${new Date().toLocaleString().replace(/[/:]/g, '-')}`;
                
                const videoInfo = {
                    name: filename,
                    url: url,
                    thumbnail: thumbnailUrl,
                    timestamp: Date.now(),
                    duration: Math.round((Date.now() - recordingStartTime) / 1000),
                    size: (blob.size / (1024 * 1024)).toFixed(1)
                };
                
                recordedVideos.push(videoInfo);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(recordedVideos));
                updateProgressWithPreview(videoInfo);
            } catch (error) {
                console.error('处理录制文件失败:', error);
            }
        };
        
        // 清理
        clearInterval(recordingTimer);
        recordingTime.style.display = 'none';
        
        const button = document.getElementById('recordButton');
        button.textContent = '开始录制';
        button.classList.remove('recording');
    }
}

// 添加一个带频制备用函数
function startRecordingWithoutAudio() {
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = window.innerWidth;
    compositeCanvas.height = window.innerHeight;
    const compositeCtx = compositeCanvas.getContext('2d');

    const originalRender = renderer.render;
    renderer.render.__original = originalRender;

    renderer.render = function(scene, camera) {
        originalRender.call(this, scene, camera);
        if (isRecording) {
            compositeCtx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
            compositeCtx.drawImage(this.domElement, 0, 0);
            compositeCtx.drawImage(window.subtitleCanvas, 0, 0);
        }
    };

    const videoStream = compositeCanvas.captureStream(60);
    const quality = document.getElementById('qualitySelect').value;
    const bitrate = quality === 'high' ? 8000000 : 
                    quality === 'medium' ? 5000000 : 2500000;

    mediaRecorder = new MediaRecorder(videoStream, {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: bitrate
    });

    // 处理录制的数据
    mediaRecorder.ondataavailable = function(e) {
        if (e.data.size > 0) {
            recordedChunks.push(e.data);
        }
    };

    mediaRecorder.start(100);
}

// 添加视频放能
function playVideo(videoUrl) {
    const videoPlayer = document.getElementById('videoPlayer');
    const video = videoPlayer.querySelector('video');
    const overlay = document.getElementById('overlay');
    
    video.src = videoUrl;
    overlay.style.display = 'block';
    videoPlayer.style.display = 'block';
    video.play();
}

// 添加下载视频功能
function downloadVideo(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// 添加删除功能
function deleteVideo(timestamp) {
    const index = recordedVideos.findIndex(v => v.timestamp === parseInt(timestamp));
    if (index !== -1) {
        URL.revokeObjectURL(recordedVideos[index].url);
        recordedVideos.splice(index, 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recordedVideos));
        
        const videosList = document.querySelector('.videos-list');
        if (videosList) {
            videosList.innerHTML = '';
            recordedVideos.forEach(videoInfo => {
                updateProgressWithPreview(videoInfo);
            });
        }
    }
}

// ... 继续下一部分 ...
