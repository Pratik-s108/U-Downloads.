// const express = require('express');
// const { spawn } = require('child_process');
// const path = require('path');
// const app = express();

// // Serve static files (frontend)
// app.use(express.static(path.join(__dirname)));

// // YouTube video download route
// app.get('/download', async (req, res) => {
//     const videoUrl = req.query.url;
//     let fileName = req.query.filename || 'video.mp4';
//     const requestedQuality = req.query.quality || 'best';

//     if (!videoUrl) {
//         return res.status(400).send('Invalid YouTube URL');
//     }

//     // Ensure filename ends with .mp4
//     if (!fileName.endsWith('.mp4')) {
//         fileName += '.mp4';
//     }


//     try {
//         // Step 1: Get available formats
//         const formatProcess = spawn('yt-dlp', ['-F', videoUrl]);

//         let formatData = '';

//         formatProcess.stdout.on('data', (data) => {
//             formatData += data.toString();
//         });

//         formatProcess.on('close', (code) => {
//             if (code !== 0) {
//                 console.error(`yt-dlp format check failed with code ${code}`);
//                 return res.status(500).send('Failed to retrieve available formats');
//             }

//             // Parse available formats
//             const availableFormats = formatData
//                 .split('\n')
//                 .map((line) => line.trim())
//                 .filter((line) => /^\d+\s/.test(line)) // Lines that start with a format ID
//                 .map((line) => {
//                     const parts = line.split(/\s+/);
//                     return {
//                         id: parts[0],
//                         quality: parts.slice(1).join(' '), // Rest of the line
//                     };
//                 });

//             if (availableFormats.length === 0) {
//                 return res.status(500).send('No available formats found for this video');
//             }

//             // Step 2: Select the best available format
//             let bestFormat = availableFormats.find((f) => f.quality.includes(requestedQuality))?.id 
//             || availableFormats[0].id;

//             console.log(`Selected format: ${bestFormat}`);

//             // Step 3: Start video download
//             res.setHeader('Content-Type', 'video/mp4');
//             res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

//             const ytDlpProcess = spawn('yt-dlp', ['-o', '-', '-f', bestFormat, videoUrl]);

//             ytDlpProcess.stdout.pipe(res);

//             ytDlpProcess.stderr.on('data', (data) => {
//                 console.error(`yt-dlp error: ${data.toString()}`);
//             });

//             ytDlpProcess.on('close', (code) => {
//                 if (code !== 0) {
//                     console.error(`yt-dlp download failed with code ${code}`);
//                     res.end();
//                 }
//             });
//         });
//     } catch (error) {
//         console.error('Error during video download:', error.message);
//         if (!res.headersSent) {
//             res.status(500).send('Failed to download the video');
//         }
//     }
// });

// // Start the server
// app.listen(3000, () => {
//     console.log('Server running on http://localhost:3000');
// });
