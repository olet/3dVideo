const STORAGE_KEY = 'recordedVideos';

let scene, camera, renderer, cube, controls;
let isRecording = false;
let recordedVideos = [];
let lastTime = performance.now();
let frameCount = 0;
let fpsDisplay;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = 0;
let recordingTimer = null;
let thumbnailCanvas = document.createElement('canvas');
let subtitles = [];
let audioContext = null;
let audioSource = null;
let audioBuffer = null;
let synth = window.speechSynthesis;
let subtitleTemplates = [
    "这只优雅的火烈鸟正在翩翩起舞",
    "看它轻盈的动作，像一位舞者",
    "粉色的羽毛在阳光下闪耀",
    "它展开翅膀，准备起飞",
    "这是大自然最美的舞蹈"
];
let originalAnimate;
let outputCtx = null;
let capturer = null;
let audioCtx = null;
let audioDestination = null;
let speechSynthesisUtterance = null;
let audioStream = null;
let loader;
let currentModel = null;
let modelsConfig = null;
let stats;

// 添加聊天相关变量
const API_URL = 'https://api.vveai.com';
const API_TOKEN = 'sk-saveRyf2gDXdENZn97B11a6a8d8a4fD9A5FeE779961f64B0';

// 初始化聊天功能
function initChat() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendMessage');
    const chatMessages = document.getElementById('chatMessages');

    // 发送消息函数
    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        // 添加用户消息到界面
        addMessage('user', message);
        chatInput.value = '';

        try {
            // 调用 API
            const response = await fetch(`${API_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_TOKEN}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                        role: 'user',
                        content: message
                    }]
                })
            });

            if (!response.ok) {
                throw new Error('API 请求失败');
            }

            const data = await response.json();
            const reply = data.choices[0].message.content;

            // 添加 AI 回复到界面
            addMessage('assistant', reply);
        } catch (error) {
            console.error('发送消息失败:', error);
            addMessage('assistant', '抱歉，发生了一些错误，请稍后重试。');
        }
    }

    // 添加消息到界面
    function addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        messageDiv.textContent = content;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 添加事件监听
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

// 添加场景初始化函数
async function initScene() {
    // 创建场景
    scene = new THREE.Scene();
    
    // 添加渐变背景
    const vertexShader = `
        varying vec3 vWorldPosition;
        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
            float h = normalize(vWorldPosition + offset).y;
            gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
    `;

    const uniforms = {
        topColor: { value: new THREE.Color(0x0077ff) },  // 天空蓝
        bottomColor: { value: new THREE.Color(0xffffff) },  // 白色
        offset: { value: 33 },
        exponent: { value: 0.6 }
    };

    const skyGeo = new THREE.SphereGeometry(500, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: uniforms,
        side: THREE.BackSide
    });

    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
    
    // 设置相机
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1, 5);
    
    // 设置渲染器
    const gameScene = document.getElementById('gameScene');
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(gameScene.clientWidth, gameScene.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    gameScene.appendChild(renderer.domElement);

    // 添加窗口大小变化监听
    window.addEventListener('resize', () => {
        camera.aspect = gameScene.clientWidth / gameScene.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(gameScene.clientWidth, gameScene.clientHeight);
    });
    
    // 添加光源
    const hemisphereLight = new THREE.HemisphereLight(0x0077ff, 0xffffff, 1);
    scene.add(hemisphereLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // 添加轨道控制器
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // 初始化 GLTFLoader
    loader = new THREE.GLTFLoader();

    // 添加 Stats
    stats = new Stats();
    stats.dom.style.cssText = 'position:fixed;top:20px;right:20px;';
    document.body.appendChild(stats.dom);

    // 创建字幕 canvas
    const subtitleCanvas = document.createElement('canvas');
    subtitleCanvas.id = 'subtitleCanvas';
    subtitleCanvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999;
    `;
    gameScene.appendChild(subtitleCanvas);
    
    // 设置初始尺寸
    subtitleCanvas.width = gameScene.clientWidth;
    subtitleCanvas.height = gameScene.clientHeight;

    // 存储全局引用
    window.subtitleCanvas = subtitleCanvas;
}

// 修改 init 函数
async function init() {
    try {
        // 加载历史记录
        const savedVideos = localStorage.getItem(STORAGE_KEY);
        if (savedVideos) {
            try {
                recordedVideos = JSON.parse(savedVideos);
                // 不要尝试重新获取 blob，而是直接显示预览
                recordedVideos.forEach(videoInfo => {
                    if (videoInfo.thumbnail) {  // 只显示有缩略图的记录
                        updateProgressWithPreview(videoInfo);
                    }
                });
            } catch (error) {
                console.error('恢复历史记录失败:', error);
                recordedVideos = [];  // 如果恢复失败，重置数组
            }
        }
        
        // 初始化场景
        await initScene();

        // 载模型配置
        const response = await fetch('models.json');
        modelsConfig = await response.json();
        
        // 动态生成模型选择列表
        const modelList = document.querySelector('.model-list');
        modelList.innerHTML = Object.entries(modelsConfig)
            .map(([id, model]) => `
                <div class="model-item${id === 'flamingo' ? ' active' : ''}" data-model="${id}">
                    <div class="model-icon">${model.icon}</div>
                    <span class="model-name">${model.name}</span>
                </div>
            `).join('');

        // 添加模型选择事件监听
        document.querySelectorAll('.model-item').forEach(item => {
            item.addEventListener('click', async () => {
                const modelId = item.dataset.model;
                
                // 更新选中状态
                document.querySelectorAll('.model-item').forEach(el => {
                    el.classList.remove('active');
                });
                item.classList.add('active');

                // 加载新模型
                try {
                    await loadModel(modelId);
                } catch (error) {
                    console.error('加载模型失败:', error);
                }
            });
        });

        // 加载认模型
        await loadModel('flamingo');

        // 添加录制按钮事件
        document.getElementById('recordButton').addEventListener('click', toggleRecording);

        // 开始动画循环
        animate();

        // 初始化聊天功能
        initChat();
        
        // 修改 Split.js 配置以适应新的面板
        Split(['.split-horizontal'], {
            sizes: [20, 60, 20],
            minSize: [300, 600, 300],
            gutterSize: 8,
            cursor: 'col-resize'
        });
        
    } catch (error) {
        console.error('初始化失败:', error);
    }
}

// 改 loadModel 函数，添加错误处理
async function loadModel(modelId) {
    const modelConfig = modelsConfig[modelId];
    if (!modelConfig) {
        console.error('未找到模型配置:', modelId);
        return;
    }

    try {
        console.log('加载模型:', modelConfig.name);
        return await new Promise((resolve, reject) => {
            loader.load(
                modelConfig.url,
                (gltf) => {
                    if (currentModel) {
                        scene.remove(currentModel);
                    }

                    const model = gltf.scene;
                    model.scale.set(
                        modelConfig.scale, 
                        modelConfig.scale, 
                        modelConfig.scale
                    );
                    model.position.set(
                        modelConfig.position[0],
                        modelConfig.position[1],
                        modelConfig.position[2]
                    );
                    scene.add(model);
                    currentModel = model;

                    if (gltf.animations && gltf.animations.length) {
                        const mixer = new THREE.AnimationMixer(model);
                        const action = mixer.clipAction(gltf.animations[0]);
                        action.play();

                        window.mixerUpdateDelta = function(delta) {
                            mixer.update(delta);
                        };
                    }

                    resolve(model);
                },
                (xhr) => {
                    console.log(`${modelConfig.name} ${(xhr.loaded / xhr.total * 100).toFixed(2)}% 加载中...`);
                },
                reject
            );
        });
    } catch (error) {
        console.error('加载模型失败:', modelConfig.name, error);
        throw error;
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
        // 返回一个默认的缩略图或错误图片
        return 'data:image/jpeg;base64,...'; // 添加��个默认的缩略base64数
    }
}

function updateProgressWithPreview(videoInfo) {
    const videosList = document.querySelector('.videos-list');
    if (!videosList) return;  // 确保元素存在

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
    
    // 确保在第一个子元素之前插入
    const firstChild = videosList.firstElementChild;
    if (firstChild) {
        videosList.insertBefore(previewDiv, firstChild);
    } else {
        videosList.appendChild(previewDiv);
    }
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
            compositeCanvas.width = gameScene.clientWidth;  // 用游戏场景的宽度
            compositeCanvas.height = gameScene.clientHeight;  // 使用游戏场景的高度
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
                            
                            console.log('合成字幕:', activeSubtitle.text);
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
                
                // 添加到数组并保存
                recordedVideos.push(videoInfo);
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(recordedVideos));
                } catch (error) {
                    console.error('保存到 localStorage 失败:', error);
                }
                
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

// 添加关闭视图功能
document.getElementById('closeVideo').onclick = function() {
    const videoPlayer = document.getElementById('videoPlayer');
    const video = videoPlayer.querySelector('video');
    const overlay = document.getElementById('overlay');
    video.pause();
    video.src = '';
    videoPlayer.style.display = 'none';
    overlay.style.display = 'none';
};

// 添加点击遮罩层关闭视频的功能
document.getElementById('overlay').onclick = function() {
    document.getElementById('closeVideo').click();
};

// 在页面关闭清理资源
window.onbeforeunload = function() {
    recordedVideos.forEach(video => URL.revokeObjectURL(video.url));
};

function updateFPS() {
    frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime;
    
    if (deltaTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / deltaTime);
        fpsDisplay.textContent = fps + ' FPS';
        frameCount = 0;
        lastTime = currentTime;
    }
}

// 定义基本 animate 函数
function animate() {
    requestAnimationFrame(animate);
    if (stats) stats.begin();

    // 更新动画
    const delta = 0.016;
    if (window.mixerUpdateDelta) {
        window.mixerUpdateDelta(delta);
    }

    // 更新轨道控制器
    if (controls) {
        controls.update();
    }
    
    // 渲染场景
    if (renderer && scene && camera) {  // 添加检查
        renderer.render(scene, camera);
    }
    
    // 渲染字幕
    if (isRecording && subtitles.length > 0) {
        const currentTime = (Date.now() - recordingStartTime) / 1000;
        const activeSubtitle = subtitles.find(sub => 
            currentTime >= sub.startTime && currentTime < (sub.startTime + sub.duration)
        );
        
        const subtitleCanvas = document.getElementById('subtitleCanvas');
        if (activeSubtitle && subtitleCanvas) {
            const ctx = subtitleCanvas.getContext('2d');
            renderSubtitle(ctx, activeSubtitle.text);
        }
    }
    
    if (stats) stats.end();
}

// 修改 renderSubtitle 函数
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

// 修改 playTTS 函数，确保时同步
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

// 修改 startAINarration 函数
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

// 添加音频流捕获函数
function captureAudioStream(audioElement) {
    const source = audioCtx.createMediaElementSource(audioElement);
    source.connect(audioDestination);
    return audioDestination.stream;
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

init();
animate(); 