// ─── QUALITY PILLS ───
document.querySelectorAll('.pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    document.getElementById('qualitySelect').value = pill.dataset.val;
  });
});

// ─── DOWNLOAD FORM ───
document.getElementById('downloadForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const urlInput    = document.getElementById('urlInput').value.trim();
  let filenameInput = document.getElementById('filenameInput').value.trim();
  const quality     = document.getElementById('qualitySelect').value;

  if (!urlInput) {
    showStatus('Please provide a YouTube URL.', 'error');
    return;
  }

  // Strip .mp4 if already present then add back (prevents .mp4.mp4)
  filenameInput = filenameInput.replace(/\.mp4$/i, '') || 'video';
  const filename = filenameInput + '.mp4';

  const btn       = document.getElementById('downloadBtn');
  const btnLabel  = btn.querySelector('.btn-label');
  const btnLoad   = btn.querySelector('.btn-loading');

  // Show loading state
  btnLabel.style.display = 'none';
  btnLoad.style.display  = 'flex';
  btn.disabled = true;
  showStatus('Fetching video — this may take a moment…', 'info');

  try {
    const url = `/download?url=${encodeURIComponent(urlInput)}&filename=${encodeURIComponent(filename)}&quality=${encodeURIComponent(quality)}`;

    const response = await fetch(url);

    if (!response.ok) {
      // Try to read error body
      let msg = 'Unable to download the video.';
      try { msg = await response.text(); } catch (_) {}
      showStatus(`Error: ${msg}`, 'error');
      resetBtn();
      return;
    }

    // Stream to blob then trigger save
    const blob        = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href     = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Short delay before revoking so Safari can handle it
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

    showStatus('✓ Download complete! Check your downloads folder.', 'success');
  } catch (error) {
    console.error('Download error:', error);
    showStatus('Network error — make sure the server is running and the URL is valid.', 'error');
  } finally {
    resetBtn();
  }
});

function resetBtn() {
  const btn      = document.getElementById('downloadBtn');
  const btnLabel = btn.querySelector('.btn-label');
  const btnLoad  = btn.querySelector('.btn-loading');
  btnLabel.style.display = 'flex';
  btnLoad.style.display  = 'none';
  btn.disabled = false;
}

function showStatus(msg, type) {
  const el = document.getElementById('downloadStatus');
  el.textContent  = msg;
  el.className    = `status-msg ${type}`;
}
