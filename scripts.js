document.getElementById('downloadForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const urlInput = document.getElementById('urlInput').value;
    let filenameInput = document.getElementById('filenameInput').value;
    let qualitySelect = document.getElementById('qualitySelect').value;

    if (!urlInput) {
        alert('Please provide a YouTube URL.');
        return;
    }

    // Ensure the filename ends with .mp4
    if (!filenameInput.endsWith('.mp4')) {
        filenameInput += '.mp4';
    }

    const downloadStatus = document.getElementById('downloadStatus');
    downloadStatus.innerText = 'Download started...';

    try {
        const response = await fetch(`/download?url=${encodeURIComponent(urlInput)}&filename=${encodeURIComponent(filenameInput)}&quality=${encodeURIComponent(qualitySelect)}`);
        
        if (!response.ok) {
            downloadStatus.innerText = 'Error: Unable to download the video.';
            return;
        }

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filenameInput;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(downloadUrl);
        downloadStatus.innerText = 'Download completed!';
    } catch (error) {
        console.error('Error during download:', error);
        downloadStatus.innerText = 'Error: Failed to download the video.';
    }
});
