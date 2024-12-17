// chat.js - AI聊天功能
const API_URL = 'https://api.vveai.com/v1';
const API_TOKEN = 'sk-saveRyf2gDXdENZn97B11a6a8d8a4fD9A5FeE779961f64B0';

function initChat() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendMessage');
    const chatMessages = document.getElementById('chatMessages');
    const selectedModelLabel = document.getElementById('selectedModelLabel');
    let selectedModelInfo = null;  // 存储选中的模型信息
    let lastOperation = null;  // 记住上一次操作

    // 监听模型选择事件
    window.addEventListener('modelSelected', (event) => {
        selectedModelInfo = event.detail;
        
        // 更新选中模型标签
        if (selectedModelInfo) {
            const modelName = {
                'flamingo': '火烈鸟',
                'parrot': '鹦鹉',
                'stork': '鹳',
                'female': '女性角色',
                'female2': '女性角色2'
            }[selectedModelInfo.type] || selectedModelInfo.type;
            
            selectedModelLabel.textContent = modelName;
            selectedModelLabel.style.display = 'block';
        } else {
            selectedModelLabel.style.display = 'none';
        }
    });

    // 处理场景命令
    async function handleSceneCommand(text) {
        console.log('检查场景命令:', text);
        
        // 分别定义 add 和 modify 命令的正则表达式
        const addCmdRegex = /\[cmd:add:([^:]+):(\d+):([^\]]+)\]/g;
        const modifyCmdRegex = /\[cmd:modify:([^:]+):({[^}]+})\]/g;
        
        let executed = false;
        let executedCommands = [];
        
        // 处理 add 命令
        let addMatch;
        while ((addMatch = addCmdRegex.exec(text)) !== null) {
            try {
                const [_, modelType, countStr, options] = addMatch;
                console.log('解析到add命令:', {modelType, countStr, options});
                
                const count = parseInt(countStr) || 1;
                await window.sceneActions.addAndModify(modelType, count);
                executedCommands.push(`添加了 ${count} 个 ${modelType}`);
                executed = true;
            } catch (error) {
                console.error('执行add命令失败:', error);
                continue;
            }
        }
        
        // 处理 modify 命令
        let modifyMatch;
        while ((modifyMatch = modifyCmdRegex.exec(text)) !== null) {
            try {
                const [_, modelId, optionsStr] = modifyMatch;
                console.log('解析到modify命令:', {modelId, optionsStr});
                
                // 清理 JSON 字符串
                const cleanOptionsStr = optionsStr
                    .replace(/\s+/g, '')
                    .replace(/\\"/g, '"')
                    .replace(/^'|'$/g, '');
                    
                console.log('清理后的选项字符串:', cleanOptionsStr);
                const parsedOptions = JSON.parse(cleanOptionsStr);
                
                // 执行修改操作
                await window.sceneActions.modifyModel(parsedOptions);
                
                // 记录执行的操作
                if (parsedOptions.rotation !== undefined) {
                    executedCommands.push(`旋转至 ${parsedOptions.rotation} 度`);
                }
                if (parsedOptions.scale !== undefined) {
                    executedCommands.push(`缩放至 ${parsedOptions.scale} 倍`);
                }
                executed = true;
            } catch (e) {
                console.error('解析或执行修改命令失败:', e);
                console.error('原始选项字符串:', optionsStr);
                continue;
            }
        }

        if (executedCommands.length > 0) {
            addMessage('system', `已执行操作：${executedCommands.join('，')}`, executedCommands);
        }

        return executed;
    }

    // 发送消息函数
    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        // 构建上下文息，包含隐藏的选中模型信息
        let contextMessage = message;
        let displayMessage = message;  // 用于显示的消息，包含隐式信息
        
        if (selectedModelInfo) {
            const selectedInfo = `[selected:${selectedModelInfo.type}:${selectedModelInfo.id}:${JSON.stringify({
                position: selectedModelInfo.position,
                rotation: selectedModelInfo.rotation,
                scale: selectedModelInfo.scale
            })}]`;
            contextMessage = `${message} ${selectedInfo}`;
            displayMessage = `${message} ${selectedInfo}`;  // 在显示消息中也含选中信息
        }

        // 添加用户消息到界面（包含隐式信息）
        addMessage('user', displayMessage);
        chatInput.value = '';

        try {
            const response = await fetch(`${API_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_TOKEN}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: '你是一个友好的3D场景助手。\n' +
                                    '规则：\n' +
                                    '1. 回复要简短自然，像朋友间聊天\n' +
                                    '2. 不要问"要多大"、"要多少只"这样的问题\n' +
                                    '3. 根据上下文理解用户意图\n' +
                                    '4. 当户说"再来"时，参考上次操作\n' +
                                    '5. 当用户说"大一点"时，scale增加0.5，"小一点"时减少0.3\n' +
                                    '6. 当用户说"几"时，默认添加2-3个\n' +
                                    '8. 用户消息中的[selected:type:id:info]表示当前选中的模型\n' +
                                    '9. 修改命令必须使用选中模型的ID，格式为[cmd:modify:id:options]\n\n' +
                                    '9. 主要的鸟有火烈鸟flamingo、鹦鹉parrot鹤stork\n' +
                                    '10. 主要的人物有女性角色female、女性角色2female2\n\n' +

                                    '可用命令：\n' +
                                    '- [cmd:add:type:count:new] 添加新模型\n' +
                                    '- [cmd:modify:id:{"scale":1.5}] 修改选中模型大小\n' +
                                    '- [cmd:modify:id:{"rotation":45}] 旋转选中模型\n\n' +
                                    '示例对话（不要机械回复，这些只是格式参考）：\n' +
                                    'Q: "来几只鸟"\n' +
                                    'A: "来两只火烈鸟 [cmd:add:flamingo:2:new]"\n' +
                                    'Q: "这只太小了 [selected:flamingo:abc123:{}]"\n' +
                                    'A: "放大一点 [cmd:modify:abc123:{"scale":1.5}]"\n' +
                                    'Q: "再大一点 [selected:flamingo:abc123:{}]"\n' +
                                    'A: "好嘞 [cmd:modify:abc123:{"scale":1.5}]"'
                        },
                        {
                            role: 'user',
                            content: contextMessage
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error('API 请求失败');
            }

            const data = await response.json();
            const reply = data.choices[0].message.content;

            // 显示AI回复（包含命令信息）
            addMessage('assistant', reply);  // 不再过滤掉命令分

            // 执行命令
            try {
                if (await handleSceneCommand(reply)) {
                    // 移除这行，因为 handleSceneCommand 中已经添加了系统消息
                    // addMessage('system', '已执行场景操作');
                }
            } catch (error) {
                console.error('执行场景命令失败:', error);
                addMessage('system', '执行场景操作失败');
            }

        } catch (error) {
            console.error('发送消息失败:', error);
            addMessage('assistant', '抱歉，发生了一些错误，请稍后重试。');
        }
    }

    // 添加消息到界面
    function addMessage(role, content, executedCommands = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;

        // 消息内容
        const mainContent = document.createElement('div');
        mainContent.className = 'message-main';
        if (role === 'system' && executedCommands) {
            mainContent.className = 'message-main system-message';
            mainContent.textContent = '已执行场景操作';
        } else {
            mainContent.textContent = content
                .replace(/\[(selected|cmd):[^\]]+\]/g, '')
                .replace(/,"rotation":\[[^\]]+\]/, '')
                .replace(/,"scale":\[[^\]]+\]/, '')
                .trim();
        }
        messageDiv.appendChild(mainContent);

        // 提取隐式信息
        let implicitInfo = [];
        
        // 上行信息：选中的模型
        if (role === 'user') {
            const selectedMatch = content.match(/\[selected:[^\]]+\]/);
            if (selectedMatch) {
                implicitInfo.push({
                    type: '选中模型',
                    content: selectedMatch[0]
                });
            }
        }
        
        // 下行信息：执行的命令
        if (role === 'assistant') {
            const cmdMatches = content.match(/\[cmd:[^\]]+\]/g);
            if (cmdMatches) {
                implicitInfo.push({
                    type: '执行命令',
                    content: cmdMatches.join('\n')
                });
            }
        }

        // 系统执行结果
        if (role === 'system' && executedCommands) {
            implicitInfo.push({
                type: '执行结果',
                content: executedCommands.join('\n')
            });
        }

        // 如果有隐式信息，加可折叠区域
        if (implicitInfo.length > 0) {
            const detailsDiv = document.createElement('details');
            detailsDiv.className = 'message-commands';
            
            const summary = document.createElement('summary');
            summary.textContent = '隐式信息';
            detailsDiv.appendChild(summary);

            implicitInfo.forEach(info => {
                const infoDiv = document.createElement('div');
                infoDiv.className = 'implicit-info';
                
                const typeSpan = document.createElement('span');
                typeSpan.className = 'info-type';
                typeSpan.textContent = info.type + ': ';
                infoDiv.appendChild(typeSpan);

                const contentPre = document.createElement('pre');
                contentPre.className = 'command-text';
                contentPre.textContent = info.content;
                infoDiv.appendChild(contentPre);

                detailsDiv.appendChild(infoDiv);
            });

            messageDiv.appendChild(detailsDiv);
        }

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