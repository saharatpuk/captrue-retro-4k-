let mediaRecorder = null;
let recordedChunks = [];
let screenStream = null;
let micStream = null;
let audioContext = null;
let recordingStartTime = 0;
let recordingConfig = null;

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

  // 3. Audio Mixing using Web Audio API
  let combinedStream = new MediaStream();
  // Add video track
  combinedStream.addTrack(screenStream.getVideoTracks()[0]);

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
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
  }
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
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
