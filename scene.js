// scene.js - 3D场景相关
let scene, camera, renderer, cube, controls;
let loader;
let currentModel = null;
let modelsConfig = null;
let stats;
let lastTime = performance.now();
let frameCount = 0;
let fpsDisplay;
let originalAnimate;
let outputCtx = null;
let capturer = null;
let models = [];  // 存储所有添加的模型
let selectedModel = null;  // 存储当前选中的模型

// 添加骨骼名称映射
const BONE_MAPPING = {
    'mixamorigHips': 'Hips',
    'mixamorigSpine': 'Spine',
    'mixamorigSpine1': 'Spine1',
    'mixamorigSpine2': 'Spine2',
    'mixamorigNeck': 'Neck',
    'mixamorigHead': 'Head',
    'mixamorigLeftShoulder': 'LeftShoulder',
    'mixamorigLeftArm': 'LeftArm',
    'mixamorigLeftForeArm': 'LeftForeArm',
    'mixamorigLeftHand': 'LeftHand',
    'mixamorigRightShoulder': 'RightShoulder',
    'mixamorigRightArm': 'RightArm',
    'mixamorigRightForeArm': 'RightForeArm',
    'mixamorigRightHand': 'RightHand',
    'mixamorigLeftUpLeg': 'LeftUpLeg',
    'mixamorigLeftLeg': 'LeftLeg',
    'mixamorigLeftFoot': 'LeftFoot',
    'mixamorigLeftToeBase': 'LeftToeBase',
    'mixamorigRightUpLeg': 'RightUpLeg',
    'mixamorigRightLeg': 'RightLeg',
    'mixamorigRightFoot': 'RightFoot',
    'mixamorigRightToeBase': 'RightToeBase'
};

// 辅助函数
function printBoneStructure(model) {
    console.log('打印骨骼结构:');
    model.traverse(node => {
        if (node.isBone) {
            console.log(node.name);
        }
    });
}

function getModelBones(model) {
    const bones = [];
    model.traverse(node => {
        if (node.isBone) {
            bones.push(node.name);
        }
    });
    return bones;
}

function getAnimationBones(clip) {
    const bones = new Set();
    clip.tracks.forEach(track => {
        bones.add(track.name.split('.')[0]);
    });
    return Array.from(bones);
}

// 添加场景控制方法
const sceneActions = {
    // 添加火烈鸟
    addFlamingo: async () => {
        console.log('正在添加火烈鸟...');
        try {
            const model = await loadModel('flamingo');
            // 随机位置
            const x = (Math.random() - 0.5) * 5;
            const z = (Math.random() - 0.5) * 5;
            model.position.set(x, 0, z);
            models.push(model);
            console.log('火烈鸟添加成功');
        } catch (error) {
            console.error('添加火烈鸟失败:', error);
            throw error;
        }
    },
    
    // 添加
    addParrot: async () => {
        const model = await loadModel('parrot');
        const x = (Math.random() - 0.5) * 5;
        const z = (Math.random() - 0.5) * 5;
        model.position.set(x, 0, z);
        models.push(model);
    },
    
    // 添加鹳
    addStork: async () => {
        const model = await loadModel('stork');
        const x = (Math.random() - 0.5) * 5;
        const z = (Math.random() - 0.5) * 5;
        model.position.set(x, 0, z);
        models.push(model);
    },
    
    // 旋转当前选中的模型
    rotateModel: (degrees) => {
        if (selectedModel) {
            selectedModel.rotation.y = (degrees * Math.PI) / 180;
            console.log('旋转模型:', degrees, '度');
        } else {
            console.warn('没有选中的模型可以旋转');
        }
    },
    
    // 缩放当前选中的模型
    scaleModel: (scale) => {
        if (selectedModel && selectedModel.scale) {
            selectedModel.scale.setScalar(scale);
        }
    },
    
    // 移动当前选中的模型
    moveModel: (x, y, z) => {
        if (selectedModel) {
            selectedModel.position.set(x, y, z);
        }
    },

    // 清空场景中的所有模型
    clearModels: () => {
        models.forEach(model => scene.remove(model));
        models = [];
        currentModel = null;
    },

    // 组合操作
    addAndModify: async (type, count, options = {}) => {
        console.log('开始添加模型:', type, count, options);
        
        if (!modelsConfig || !modelsConfig[type]) {
            console.error('无效的模型类型:', type);
            throw new Error(`未找到模型配置: ${type}`);
        }

        const newModels = [];
        for(let i = 0; i < count; i++) {
            try {
                // 加载模型但不自动添加到场景
                const model = await loadModel(type, false);
                
                // 应用变换
                if (options.scale) {
                    // 在原有缩放基础上乘以新的缩放值
                    const currentScale = model.scale.x;  // 假设xyz缩放一致
                    const newScale = currentScale * options.scale;
                    model.scale.setScalar(newScale);
                }
                if (options.rotation) {
                    model.rotation.y = options.rotation * Math.PI / 180;
                }
                
                // 随机位置，但保持一定的群组关系
                const angle = (Math.PI * 2 * i) / count;
                const radius = 2 + Math.random();
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                model.position.set(x, 0, z);

                // 手动添加到场景和数组
                scene.add(model);
                models.push(model);
                newModels.push(model);
                
                console.log(`成功添加第 ${i + 1} 个模型，实际缩放比例:`, model.scale.x);
            } catch (error) {
                console.error(`添加第 ${i + 1} 个模型失败:`, error);
                throw error;
            }
        }
        return newModels;
    },

    // 修改选中的模型
    modifyModel: async (options = {}) => {
        if (!selectedModel) {
            console.warn('没有选中的模型');
            return;
        }

        console.log('修改模型:', options);
        
        // 应用缩放
        if (options.scale !== undefined) {
            selectedModel.scale.setScalar(options.scale);
            console.log('应用缩放:', options.scale);
        }

        // 应用旋转
        if (options.rotation !== undefined) {
            selectedModel.rotation.y = (options.rotation * Math.PI) / 180;
            console.log('应用旋转:', options.rotation);
        }

        return selectedModel;
    },

    // 播放指定动画
    playAnimation: (modelId, animationName) => {
        const model = models.find(m => m.userData.type === modelId);
        if (!model || !model.userData.animations) {
            console.warn('未找到模型或动画:', modelId);
            return;
        }

        const anim = model.userData.animations.get(animationName);
        if (!anim) {
            console.warn('未找到动画:', animationName);
            return;
        }

        if (model.userData.currentAction) {
            model.userData.currentAction.fadeOut(0.5);
        }

        anim.action.reset()
            .fadeIn(0.5)
            .play();
        
        model.userData.currentAction = anim.action;
    }
};

// 将方法挂载到 window 对象上，使其全局可用
window.sceneActions = sceneActions;

// 添加模型选择功能
function initModelSelection() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('click', (event) => {
        // 计算鼠标位置
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // 发射射线
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(models, true);

        if (intersects.length > 0) {
            // 找到模型的根节点
            let modelRoot = intersects[0].object;
            while (modelRoot.parent && !models.includes(modelRoot)) {
                modelRoot = modelRoot.parent;
            }
            
            // 更新选中状态
            selectedModel = modelRoot;
            // 可以添加选中效果，比如高亮
            models.forEach(model => {
                model.traverse(child => {
                    if (child.material) {
                        child.material.emissive = new THREE.Color(0x000000);
                    }
                });
            });
            selectedModel.traverse(child => {
                if (child.material) {
                    child.material.emissive = new THREE.Color(0x333333);
                }
            });

            // 触发选中事件
            const modelInfo = {
                type: modelRoot.userData.type || 'unknown',
                id: modelRoot.uuid,
                position: modelRoot.position.toArray(),
                rotation: modelRoot.rotation.toArray(),
                scale: modelRoot.scale.toArray()
            };
            window.dispatchEvent(new CustomEvent('modelSelected', { detail: modelInfo }));
        } else {
            selectedModel = null;
            // 清除所有高亮
            models.forEach(model => {
                model.traverse(child => {
                    if (child.material) {
                        child.material.emissive = new THREE.Color(0x000000);
                    }
                });
            });
            window.dispatchEvent(new CustomEvent('modelSelected', { detail: null }));
        }
    });
}

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

    // 始化 GLTFLoader
    loader = new THREE.GLTFLoader();

    // 添加 Stats
    stats = new Stats();
    stats.dom.style.cssText = 'position:fixed;top:20px;left:20px;';
    document.body.appendChild(stats.dom);

    // 载入模型配置
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

    // 加载默认模型
    const defaultModel = await loadModel('flamingo');
    models.push(defaultModel);  // 将默认模型添加到数组中

    initModelSelection();
}

async function loadModel(modelId, addToScene = true) {
    console.log('开始加载模型:', modelId);
    
    if (!modelsConfig || !modelsConfig[modelId]) {
        console.error('模型配置未找到:', modelId, modelsConfig);
        throw new Error('未找到模型配置');
    }

    const modelConfig = modelsConfig[modelId];
    console.log('使用模型配置:', modelConfig);

    try {
        // 如果是 RPM 角色，先创建角色获取 URL
        if (modelConfig.useRPM) {
            try {
                console.log('创建 RPM 角色...');
                const avatarUrl = await rpmManager.createAvatar();
                if (!avatarUrl) {
                    throw new Error('未获取到角色 URL');
                }
                console.log('获取到角色 URL:', avatarUrl);
                modelConfig.url = avatarUrl;  // 更新 URL
            } catch (error) {
                if (error.message === '用户取消') {
                    console.log('用户取消创建角色');
                    return null;  // 用户取消时直接返回
                }
                throw error;  // 其他错误继续抛出
            }
        }

        // 加载模型
        const gltf = await new Promise((resolve, reject) => {
            loader.load(modelConfig.url, resolve, undefined, reject);
        });

        const model = gltf.scene;
        model.userData.type = modelId;
        model.userData.animations = new Map();

        // 应用缩放
        if (modelConfig.scale) {
            model.scale.setScalar(modelConfig.scale);
        }

        // 创建动画混合器
        const mixer = new THREE.AnimationMixer(model);
        model.mixer = mixer;

        // 处理内置动画
        if (gltf.animations && gltf.animations.length > 0) {
            const action = mixer.clipAction(gltf.animations[0]);
            action.play();
        }

        // 加载额外的 FBX 动画
        if (modelConfig.animations && modelConfig.animations.length > 0) {
            const fbxLoader = new THREE.FBXLoader();
            
            for (const anim of modelConfig.animations) {
                try {
                    console.log(`开始加载动画: ${anim.name}, URL: ${anim.url}`);
                    const animData = await new Promise((resolve, reject) => {
                        fbxLoader.load(anim.url, resolve, undefined, reject);
                    });
                    
                    if (animData.animations && animData.animations.length > 0) {
                        console.log(`动画 ${anim.name} 加载成功`);
                        const clip = animData.animations[0];
                        clip.name = anim.name;

                        // 创建动作
                        const action = mixer.clipAction(clip);
                        action.setLoop(THREE.LoopRepeat);
                        action.clampWhenFinished = false;
                        
                        // 存储动画信息
                        model.userData.animations.set(anim.name, {
                            clip,
                            action,
                            duration: anim.duration
                        });

                        console.log(`动画 ${anim.name} 设置完成`);
                    }
                } catch (error) {
                    console.error(`加载动画 ${anim.name} 失败:`, error);
                }
            }
        }

        // 添加到场景
        if (addToScene) {
            scene.add(model);
            models.push(model);
            currentModel = model;
        }

        return model;
    } catch (error) {
        console.error('加载模型失败:', error);
        throw error;
    }
}

// 动画更新函数
function animate() {
    requestAnimationFrame(animate);
    if (stats) stats.begin();

    // 更新动画
    const delta = 0.016;
    models.forEach(model => {
        if (model.mixer) {
            model.mixer.update(delta);
        }
    });

    // 更新控制器和渲染
    if (controls) controls.update();
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
    
    if (stats) stats.end();
}
 