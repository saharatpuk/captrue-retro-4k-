let mediaRecorder = null;
let recordedChunks = [];
let screenStream = null;
let micStream = null;
let camStream = null;
let audioContext = null;
let recordingStartTime = 0;
let recordingConfig = null;
let pipRenderLoopId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  if (message.type === 'START_RECORDING') {
    startRecording(message.data)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  } else if (message.type === 'STOP_RECORDING') {
    stopRecording()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  } else if (message.type === 'GET_STATE') {
    sendResponse({
      isRecording: mediaRecorder && mediaRecorder.state === 'recording',
      startTime: recordingStartTime
    });
  }
});

async function startRecording(config) {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    throw new Error('Already recording');
  }

  recordingConfig = config || {};
  const resolution = recordingConfig.resolution || '4k'; // '4k', '2k', '1080p'
  const recordMic = !!recordingConfig.mic;
  const recordCam = !!recordingConfig.cam;
  const camPosition = recordingConfig.camPosition || 'bottom-right';
  const recordSystem = !!recordingConfig.system;

  // Setup resolution constraints
  let width = 3840;
  let height = 2160;
  let frameRate = 60;

  if (resolution === '1080p') {
    width = 1920;
    height = 1080;
  } else if (resolution === '2k') {
    width = 2560;
    height = 1440;
  }

  // 1. Get Screen Stream (DisplayMedia)
  const displayMediaOptions = {
    video: {
      width: { ideal: width, max: 3840 },
      height: { ideal: height, max: 2160 },
      frameRate: { ideal: frameRate, max: 60 }
    },
    audio: recordSystem ? {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    } : false
  };

  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
  } catch (err) {
    console.error('getDisplayMedia error:', err);
    throw new Error('Screen capture permission cancelled or failed: ' + err.message);
  }

  // Handle user clicking "Stop Sharing" from browser native bar
  screenStream.getVideoTracks()[0].addEventListener('ended', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      stopRecording();
    }
  });

  // 2. Get Mic Stream if enabled
  if (recordMic) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log('Microphone stream successfully acquired:', micStream.getAudioTracks().length);
    } catch (err) {
      console.warn('Microphone permission denied or failed in offscreen:', err);
      // Proceed without mic if failed
    }
  }

  // 3. Get Webcam Stream if enabled
  if (recordCam) {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      });
      console.log('Camera stream successfully acquired:', camStream.getVideoTracks().length);
    } catch (err) {
      console.warn('Camera permission denied or failed in offscreen:', err);
      camStream = null;
    }
  }

  // 4. Video Track Setup (Direct Screen Stream or PiP Composite via Canvas)
  let videoTrackToRecord = null;
  if (camStream && camStream.getVideoTracks().length > 0) {
    try {
      videoTrackToRecord = await createPiPStream(screenStream, camStream, width, height, frameRate, camPosition);
    } catch (pipErr) {
      console.error('Error creating PiP composite stream, fallback to screen stream:', pipErr);
      videoTrackToRecord = screenStream.getVideoTracks()[0];
    }
  } else {
    videoTrackToRecord = screenStream.getVideoTracks()[0];
  }

  // 5. Audio Mixing using Web Audio API
  let combinedStream = new MediaStream();
  combinedStream.addTrack(videoTrackToRecord);

  const hasSystemAudio = screenStream.getAudioTracks().length > 0;
  const hasMicAudio = micStream && micStream.getAudioTracks().length > 0;

  console.log(`Audio tracks status: System Audio = ${hasSystemAudio}, Mic Audio = ${hasMicAudio}`);

  if (hasSystemAudio || hasMicAudio) {
    audioContext = new AudioContext();
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    const dest = audioContext.createMediaStreamDestination();

    if (hasSystemAudio) {
      const sysSource = audioContext.createMediaStreamSource(new MediaStream(screenStream.getAudioTracks()));
      sysSource.connect(dest);
    }

    if (hasMicAudio) {
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(dest);
    }

    dest.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
  }

  // 4. Initialize MediaRecorder with high bitrate for 4K quality
  recordedChunks = [];
  
  // Pick codec
  let mimeType = 'video/webm;codecs=vp9,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }
  }

  // Set Bitrate: 40 Mbps for 4K, 20 Mbps for 2K, 10 Mbps for 1080p
  let bitsPerSecond = 40000000;
  if (resolution === '2k') bitsPerSecond = 20000000;
  if (resolution === '1080p') bitsPerSecond = 10000000;

  mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType: mimeType,
    videoBitsPerSecond: bitsPerSecond
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    const finalBlob = new Blob(recordedChunks, { type: mimeType });
    const durationMs = Date.now() - recordingStartTime;
    
    // Generate a thumbnail from video blob
    const thumbnail = await generateThumbnail(finalBlob);

    // Date formatting
    const dateStr = new Date().toLocaleString('th-TH');
    const recordingId = 'rec_' + Date.now();
    const recordItem = {
      id: recordingId,
      title: `Captrue Retro ${resolution.toUpperCase()} - ${dateStr}`,
      blob: finalBlob,
      size: finalBlob.size,
      mimeType: mimeType,
      durationMs: durationMs,
      resolution: resolution.toUpperCase(),
      hasMic: hasMicAudio,
      hasCam: !!(camStream && camStream.getVideoTracks().length > 0),
      hasSystemAudio: hasSystemAudio,
      thumbnail: thumbnail,
      createdAt: Date.now()
    };

    // Save to IndexedDB
    await saveRecording(recordItem);

    // Clean up streams & context
    cleanUpStreams();

    // Inform background script to open dashboard
    chrome.runtime.sendMessage({
      type: 'RECORDING_FINISHED',
      id: recordingId
    });
  };

  mediaRecorder.start(1000); // 1s slice
  recordingStartTime = Date.now();

  return { success: true, startTime: recordingStartTime };
}

function cleanUpStreams() {
  if (pipRenderLoopId) {
    clearInterval(pipRenderLoopId);
    pipRenderLoopId = null;
  }
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
  }
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  if (camStream) {
    camStream.getTracks().forEach(t => t.stop());
    camStream = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
}

async function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    return { success: true };
  }

  return new Promise((resolve) => {
    mediaRecorder.onstop = async () => {
      const finalBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
      const durationMs = Date.now() - recordingStartTime;
      const thumbnail = await generateThumbnail(finalBlob);

      const dateStr = new Date().toLocaleString('th-TH');
      const recordingId = 'rec_' + Date.now();
      const recordItem = {
        id: recordingId,
        title: `Captrue Retro ${(recordingConfig.resolution || '4k').toUpperCase()} - ${dateStr}`,
        blob: finalBlob,
        size: finalBlob.size,
        mimeType: mediaRecorder.mimeType,
        durationMs: durationMs,
        resolution: (recordingConfig.resolution || '4k').toUpperCase(),
        hasMic: !!recordingConfig.mic,
        hasCam: !!(camStream && camStream.getVideoTracks().length > 0),
        hasSystemAudio: !!recordingConfig.system,
        thumbnail: thumbnail,
        createdAt: Date.now()
      };

      await saveRecording(recordItem);
      cleanUpStreams();

      chrome.runtime.sendMessage({
        type: 'RECORDING_FINISHED',
        id: recordingId
      });

      resolve({ success: true, id: recordingId });
    };

    mediaRecorder.stop();
  });
}

function generateThumbnail(blob) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(blob);
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      video.currentTime = Math.min(1.0, video.duration / 2);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = Math.round((480 * (video.videoHeight || 9)) / (video.videoWidth || 16));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(video.src);
        resolve(dataUrl);
      } catch (e) {
        URL.revokeObjectURL(video.src);
        resolve(null);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(null);
    };
  });
}

/**
 * Composites Screen Video + Webcam PiP into a single video track via Canvas
 */
async function createPiPStream(screenMediaStream, webcamMediaStream, targetWidth, targetHeight, fps, position) {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  // Append to body so Chromium treats canvas as active
  canvas.style.position = 'fixed';
  canvas.style.top = '-9999px';
  canvas.style.left = '-9999px';
  canvas.style.width = '1px';
  canvas.style.height = '1px';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: false });

  const screenVideo = document.createElement('video');
  screenVideo.srcObject = screenMediaStream;
  screenVideo.muted = true;
  screenVideo.playsInline = true;
  document.body.appendChild(screenVideo);

  const camVideo = document.createElement('video');
  camVideo.srcObject = webcamMediaStream;
  camVideo.muted = true;
  camVideo.playsInline = true;
  document.body.appendChild(camVideo);

  const playVideo = (v) => {
    return new Promise((resolve) => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };
      v.onloadedmetadata = () => {
        v.play().then(done).catch(done);
      };
      // Fallback timeout in case onloadedmetadata hangs in offscreen
      setTimeout(done, 1500);
    });
  };

  await Promise.all([playVideo(screenVideo), playVideo(camVideo)]);

  // PiP circle sizing: ~22% of min(width, height)
  const pipSize = Math.round(Math.min(targetWidth, targetHeight) * 0.22);
  const padding = Math.round(Math.min(targetWidth, targetHeight) * 0.03);
  const radius = pipSize / 2;

  let centerX = targetWidth - padding - radius;
  let centerY = targetHeight - padding - radius;

  if (position === 'top-left') {
    centerX = padding + radius;
    centerY = padding + radius;
  } else if (position === 'top-right') {
    centerX = targetWidth - padding - radius;
    centerY = padding + radius;
  } else if (position === 'bottom-left') {
    centerX = padding + radius;
    centerY = targetHeight - padding - radius;
  } else {
    // bottom-right
    centerX = targetWidth - padding - radius;
    centerY = targetHeight - padding - radius;
  }

  function renderFrame() {
    // 1. Draw screen video
    if (screenVideo.videoWidth > 0) {
      ctx.drawImage(screenVideo, 0, 0, targetWidth, targetHeight);
    } else {
      ctx.fillStyle = '#0b0d13';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    // 2. Draw webcam in circular PiP frame
    if (camVideo.videoWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Crop center of webcam feed
      const vw = camVideo.videoWidth;
      const vh = camVideo.videoHeight;
      const minDim = Math.min(vw, vh);
      const sx = (vw - minDim) / 2;
      const sy = (vh - minDim) / 2;

      ctx.drawImage(
        camVideo,
        sx, sy, minDim, minDim,
        centerX - radius, centerY - radius, pipSize, pipSize
      );

      ctx.restore();

      // Draw cyber retro glowing border around PiP circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(4, Math.round(pipSize * 0.02));
      ctx.strokeStyle = '#00ffcc';
      ctx.shadowColor = 'rgba(0, 255, 204, 0.6)';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw first frame immediately
  renderFrame();

  // Use setInterval for deterministic rendering in background/offscreen context
  const targetFps = fps || 60;
  const intervalMs = Math.round(1000 / targetFps);
  pipRenderLoopId = setInterval(renderFrame, intervalMs);

  const canvasStream = canvas.captureStream(targetFps);
  return canvasStream.getVideoTracks()[0];
}
