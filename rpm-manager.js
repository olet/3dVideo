class RPMManager {
    constructor() {
        this.subdomain = 'olet.readyplayer.me';
        this.appId = '675dbac2d50a553383ba8fbd';
    }

    async createAvatar() {
        try {
            return new Promise((resolve, reject) => {
                // 创建遮罩层
                const overlay = document.createElement('div');
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 9998;
                `;
                document.body.appendChild(overlay);

                // 创建 iframe 容器
                const container = document.createElement('div');
                container.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 90%;
                    height: 90%;
                    z-index: 9999;
                    background: white;
                    border-radius: 10px;
                    overflow: hidden;
                `;

                // 创建关闭按钮
                const closeButton = document.createElement('button');
                closeButton.innerHTML = '×';
                closeButton.style.cssText = `
                    position: absolute;
                    right: 10px;
                    top: 10px;
                    border: none;
                    background: none;
                    color: black;
                    font-size: 24px;
                    cursor: pointer;
                    z-index: 10000;
                `;
                closeButton.onclick = () => {
                    document.body.removeChild(overlay);
                    document.body.removeChild(container);
                    reject(new Error('用户取消'));
                };

                // 创建 iframe
                const iframe = document.createElement('iframe');
                iframe.style.cssText = `
                    width: 100%;
                    height: 100%;
                    border: none;
                `;
                iframe.src = `https://${this.subdomain}/avatar?frameApi`;

                // 组装 DOM
                container.appendChild(closeButton);
                container.appendChild(iframe);
                document.body.appendChild(container);

                // 监听消息
                const messageHandler = (event) => {
                    if (event.data.type === 'avatar-exported') {
                        // 直接使用 URL，不需要用户复制
                        const avatarUrl = event.data.data.url || event.data.data.avatarUrl;
                        document.body.removeChild(overlay);
                        document.body.removeChild(container);
                        window.removeEventListener('message', messageHandler);
                        
                        // 确保我们有 URL
                        if (avatarUrl) {
                            console.log('获取到角色 URL:', avatarUrl);
                            resolve(avatarUrl);
                        } else {
                            reject(new Error('未获取到角色 URL'));
                        }
                    }
                };
                window.addEventListener('message', messageHandler);
            });
        } catch (error) {
            console.error('创建角色失败:', error);
            throw error;
        }
    }

    async updateAvatar(features) {
        try {
            // 使用 postMessage 更新头像
            const iframe = document.querySelector('iframe[src*="' + this.subdomain + '"]');
            if (iframe) {
                iframe.contentWindow.postMessage(
                    {
                        target: 'readyplayerme',
                        type: 'update',
                        data: { features }
                    },
                    '*'
                );
            }
        } catch (error) {
            console.error('更新角色失败:', error);
            throw error;
        }
    }

    addEventListeners() {
        window.addEventListener('message', (event) => {
            if (event.data.type === 'avatar-exported') {
                console.log('头像已导出:', event.data.data);
            }
        });
    }

    async createMultipleAvatars(count) {
        const avatarUrls = [];
        for(let i = 0; i < count; i++) {
            try {
                const url = await this.createAvatar();
                avatarUrls.push(url);
                // 建议加入适当延迟，避免频繁调用
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch(error) {
                console.error(`创建第 ${i+1} 个头像失败:`, error);
            }
        }
        return avatarUrls;
    }
} 