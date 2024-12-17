// ui.js - UI相关功能
function initUI() {
    // 添加录制按钮事件监听
    const recordButton = document.getElementById('recordButton');
    if (recordButton) {
        recordButton.addEventListener('click', toggleRecording);
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
}

// 播放视频
function playVideo(videoUrl) {
    const videoPlayer = document.getElementById('videoPlayer');
    const video = videoPlayer.querySelector('video');
    const overlay = document.getElementById('overlay');
    
    video.src = videoUrl;
    videoPlayer.style.display = 'block';
    overlay.style.display = 'block';
    
    video.play().catch(error => {
        console.error('播放视频失败:', error);
    });
}

// 下载视频
function downloadVideo(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// 删除视频
function deleteVideo(timestamp) {
    const index = recordedVideos.findIndex(v => v.timestamp === parseInt(timestamp));
    if (index !== -1) {
        // 释放 URL
        URL.revokeObjectURL(recordedVideos[index].url);
        
        // 从数组中移除
        recordedVideos.splice(index, 1);
        
        // 更新 localStorage
        localStorage.setItem('recordedVideos', JSON.stringify(recordedVideos));
        
        // 更新 UI
        const videosList = document.querySelector('.videos-list');
        if (videosList) {
            videosList.innerHTML = '';
            recordedVideos.forEach(videoInfo => {
                updateProgressWithPreview(videoInfo);
            });
        }
    }
}

// 将函数挂载到 window 对象上，使其全局可用
window.playVideo = playVideo;
window.downloadVideo = downloadVideo;
window.deleteVideo = deleteVideo;