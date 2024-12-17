class CharacterCreator {
    constructor(scene, model) {
        this.scene = scene;
        this.model = model;
        this.morphTargets = {};
        
        // 初始化变形目标
        this.initMorphTargets();
        // 绑定UI事件
        this.bindEvents();
    }

    initMorphTargets() {
        // 定义基础变形目标
        const baseMorphs = {
            faceWidth: { min: -0.5, max: 0.5 },
            faceHeight: { min: -0.5, max: 0.5 },
            eyeSize: { min: -0.3, max: 0.3 },
            eyeDistance: { min: -0.2, max: 0.2 },
            noseSize: { min: -0.3, max: 0.3 },
            mouthSize: { min: -0.3, max: 0.3 }
        };

        // 为每个变形目标创建 BlendShape
        Object.entries(baseMorphs).forEach(([name, range]) => {
            this.morphTargets[name] = {
                value: 0,
                range: range,
                mesh: null  // 将在加载模型时设置
            };
        });
    }

    bindEvents() {
        // 绑定滑块事件
        Object.keys(this.morphTargets).forEach(name => {
            const slider = document.getElementById(name);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    this.updateMorphTarget(name, e.target.value / 100);
                });
            }
        });

        // 随机生成按钮
        document.getElementById('randomize').addEventListener('click', () => {
            this.randomizeFeatures();
        });

        // 保存预设按钮
        document.getElementById('savePreset').addEventListener('click', () => {
            this.saveCurrentPreset();
        });
    }

    async updateMorphTarget(name, value) {
        const morph = this.morphTargets[name];
        if (!morph) return;

        // 计算实际值
        const range = morph.range;
        const actualValue = range.min + (range.max - range.min) * value;
        
        // 如果是 RPM 模型，使用 SDK 更新
        if (this.model && this.model.userData.type === 'rpm_character') {
            await rpmManager.updateAvatar({
                [name]: actualValue
            });
        } else {
            // 原有的更新逻辑
            if (morph.mesh && morph.mesh.morphTargetInfluences) {
                morph.mesh.morphTargetInfluences[morph.index] = actualValue;
            }
        }

        // 存储当前值
        morph.value = value;
    }

    randomizeFeatures() {
        Object.keys(this.morphTargets).forEach(name => {
            const value = Math.random();
            this.updateMorphTarget(name, value);
            
            // 更新UI
            const slider = document.getElementById(name);
            if (slider) {
                slider.value = value * 100;
            }
        });
    }

    saveCurrentPreset() {
        const preset = {};
        Object.entries(this.morphTargets).forEach(([name, morph]) => {
            preset[name] = morph.value;
        });

        // 保存到本地存储
        const presets = JSON.parse(localStorage.getItem('characterPresets') || '[]');
        presets.push(preset);
        localStorage.setItem('characterPresets', JSON.stringify(presets));
    }

    // 加载基础模型
    async loadBaseModel() {
        // 这里需要一个支持变形目标的基础模型
        const loader = new THREE.GLTFLoader();
        const model = await new Promise((resolve, reject) => {
            loader.load('models/base-character.glb', resolve, undefined, reject);
        });

        // 设置变形目标
        const mesh = model.scene.getObjectByName('Face');  // 假设模型中有一个名为 Face 的网格
        if (mesh) {
            Object.keys(this.morphTargets).forEach((name, index) => {
                this.morphTargets[name].mesh = mesh;
                this.morphTargets[name].index = index;
            });
        }

        return model.scene;
    }
} 