let recordedChunks = [];
const CHUNK_SIZE = 100; // 每批处理的帧数

self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'init':
            recordedChunks = [];
            break;
            
        case 'start':
            recordedChunks = [];
            break;
            
        case 'capture':
            if (data) {
                recordedChunks.push(data);
                // 发送当前收集的帧数作为进度
                self.postMessage({
                    type: 'progress',
                    data: Math.min(recordedChunks.length / 300, 0.5)  // 假设总共录制300帧
                });
            }
            break;
            
        case 'stop':
            processChunks();
            break;
    }
};

function processChunks() {
    const totalChunks = recordedChunks.length;
    let processedChunks = [];
    
    // 分批处理数据
    for (let i = 0; i < totalChunks; i += CHUNK_SIZE) {
        const chunk = recordedChunks.slice(i, i + CHUNK_SIZE);
        processedChunks = processedChunks.concat(chunk);
        
        // 发送处理进度
        self.postMessage({
            type: 'progress',
            data: 0.5 + (i / totalChunks) * 0.5  // 从50%开始到100%
        });
    }
    
    // 创建最终的视频blob
    const blob = new Blob(processedChunks, {
        type: 'video/webm; codecs=vp8'
    });
    
    // 发送完成消息
    self.postMessage({
        type: 'finished',
        data: blob
    });
    
    // 清理内存
    recordedChunks = [];
    processedChunks = [];
} 