let characterCreator;
let rpmManager;

async function initCharacterCreator() {
    try {
        characterCreator = new CharacterCreator(scene);
        const baseModel = await characterCreator.loadBaseModel();
        scene.add(baseModel);
    } catch (error) {
        console.error('初始化角色创建器失败:', error);
    }
}

async function initRPM() {
    rpmManager = new RPMManager();
}

async function init() {
    try {
        await loadSavedVideos();
        await initScene();
        await initRPM();
        initChat();
        initUI();
        
        Split(['.split-horizontal'], {
            sizes: [20, 60, 20],
            minSize: [300, 300, 300],
            gutterSize: 8,
            cursor: 'col-resize'
        });
        
        animate();
    } catch (error) {
        console.error('初始化失败:', error);
    }
}

init();