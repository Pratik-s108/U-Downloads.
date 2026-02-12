const express  = require('express');
const { spawn, execSync } = require('child_process');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const crypto   = require('crypto');

const app = express();
app.use(express.static(path.join(__dirname)));

// ─── AUTO-UPDATE yt-dlp on startup ───────────────────────────────────────────
try {
  console.log('[startup] Updating yt-dlp...');
  execSync('pip3 install --upgrade --break-system-packages yt-dlp', { stdio: 'inherit' });
  console.log('[startup] yt-dlp up to date.');
} catch (e) {
  console.warn('[startup] Could not update yt-dlp:', e.message);
}

// ─── COOKIES PATH ────────────────────────────────────────────────────────────
// Mount cookies.txt next to this file (or via Docker volume).
// Export from Chrome/Firefox using the "Get cookies.txt LOCALLY" extension.
const COOKIES_FILE = path.join(__dirname, 'cookies.txt');
const hasCookies   = fs.existsSync(COOKIES_FILE);
console.log(hasCookies
  ? `[startup] cookies.txt found — YouTube auth enabled.`
  : `[startup] No cookies.txt — downloads may be blocked by YouTube bot detection.`
);

// ─── FORMAT SELECTOR ─────────────────────────────────────────────────────────
function qualityToFormat(quality) {
  const h = { '240p': 240, '360p': 360, '480p': 480, '720p': 720, '1080p': 1080 }[quality];
  if (!h) return 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
  return [
    `bestvideo[height=${h}][ext=mp4]+bestaudio[ext=m4a]`,
    `bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]`,
    `bestvideo[height=${h}]+bestaudio`,
    `bestvideo[height<=${h}]+bestaudio`,
    `best[height<=${h}]`,
    `best`,
  ].join('/');
}

// ─── FRIENDLY ERROR PARSER ───────────────────────────────────────────────────
function parseYtdlpError(stderr) {
  if (!stderr) return 'Unknown yt-dlp error.';
  if (stderr.includes('Sign in to confirm') || stderr.includes('bot') || stderr.includes('429'))
    return 'YouTube bot detection triggered. Add a cookies.txt file — see README.';
  if (stderr.includes('Video unavailable') || stderr.includes('not available'))
    return 'Video unavailable (private, deleted, or region-locked).';
  if (stderr.includes('Premieres in') || stderr.includes('is not yet available'))
    return 'This video has not premiered yet.';
  if (stderr.includes('members-only') || stderr.includes('join this channel'))
    return 'This is a members-only video.';
  if (stderr.includes('age-restricted') || stderr.includes('age gate'))
    return 'Age-restricted — add cookies.txt from a signed-in browser.';
  if (stderr.includes('No such format') || stderr.includes('Requested format is not available'))
    return 'That quality is not available for this video. Try a lower setting.';
  if (stderr.includes('urlopen error') || stderr.includes('getaddrinfo'))
    return 'Network error inside container — check Docker internet access.';
  if (stderr.includes('ffmpeg') && stderr.includes('not found'))
    return 'ffmpeg not found — rebuild the Docker image.';
  const errLines = stderr.split('\n').filter(l => /ERROR/i.test(l));
  if (errLines.length) return errLines[errLines.length - 1].replace(/^\s*ERROR:\s*/i, '').trim();
  return 'yt-dlp failed. Run: docker compose logs for details.';
}

// ─── DOWNLOAD ROUTE ───────────────────────────────────────────────────────────
app.get('/download', (req, res) => {
  const videoUrl         = (req.query.url || '').trim();
  let   fileName         = (req.query.filename || 'video').trim();
  const requestedQuality = req.query.quality || '480p';

  if (!videoUrl) return res.status(400).send('Missing YouTube URL.');

  fileName = fileName.replace(/\.mp4$/i, '') + '.mp4';

  const formatSelector = qualityToFormat(requestedQuality);
  const tmpId   = crypto.randomBytes(8).toString('hex');
  const tmpFile = path.join(os.tmpdir(), `u-dl-${tmpId}.mp4`);

  console.log(`\n[download] URL     : ${videoUrl}`);
  console.log(`[download] Quality : ${requestedQuality} → ${formatSelector}`);
  console.log(`[download] Cookies : ${hasCookies ? 'yes' : 'no'}`);
  console.log(`[download] Tmp     : ${tmpFile}`);

  const args = [
  '--no-playlist',
  '--merge-output-format', 'mp4',
  '--remux-video', 'mp4',
  '--force-ipv4',
  '--js-runtimes', 'node',
  '--extractor-args', 'youtube:player_client=web',
  '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  '-f', formatSelector,
  '-o', tmpFile,
  ];

  // Inject cookies if available — this bypasses bot detection
  if (hasCookies) {
    args.push('--cookies', COOKIES_FILE);
  }

  args.push(videoUrl);

  let fullStderr = '';
  const ytDlp = spawn('yt-dlp', args);

  ytDlp.stdout.on('data', d => process.stdout.write(d));
  ytDlp.stderr.on('data', d => {
    const chunk = d.toString();
    fullStderr += chunk;
    process.stderr.write(chunk);
  });

  ytDlp.on('error', err => {
    console.error('[yt-dlp] spawn error:', err.message);
    cleanup(tmpFile);
    if (!res.headersSent)
      res.status(500).send('yt-dlp not found — rebuild the Docker image.');
  });

  ytDlp.on('close', code => {
    console.log(`[yt-dlp] exit code: ${code}`);

    if (code !== 0) {
      cleanup(tmpFile);
      const msg = parseYtdlpError(fullStderr);
      console.error(`[yt-dlp] ${msg}`);
      if (!res.headersSent) res.status(500).send(msg);
      return;
    }

    let stat;
    try { stat = fs.statSync(tmpFile); } catch (_) {
      cleanup(tmpFile);
      return res.status(500).send('Output file missing after download.');
    }

    if (stat.size === 0) {
      cleanup(tmpFile);
      return res.status(500).send('Output file is 0 bytes — try a different quality.');
    }

    console.log(`[server] Sending "${fileName}" (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(tmpFile);
    stream.pipe(res);
    stream.on('error', e => { console.error('[stream]', e.message); cleanup(tmpFile); });

    const done = once(() => cleanup(tmpFile));
    res.on('finish', done);
    res.on('close',  done);
  });

  req.on('close', () => { ytDlp.kill('SIGTERM'); cleanup(tmpFile); });
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function cleanup(f) { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {} }
function once(fn)   { let c = false; return (...a) => { if (!c) { c = true; fn(...a); } }; }

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✓ U-Download on http://localhost:${PORT}`));
