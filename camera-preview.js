const previewVideo = document.getElementById('previewVideo');
const btnPip = document.getElementById('btnPip');
let localStream = null;

// Read query params for deviceId
const urlParams = new URLSearchParams(window.location.search);
const deviceId = urlParams.get('deviceId');

async function startCamera() {
  const constraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    }
  };
  if (deviceId) {
    constraints.video.deviceId = { exact: deviceId };
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    previewVideo.srcObject = localStream;
  } catch (err) {
    console.warn('Failed with specific device, trying generic video:', err);
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true });
      previewVideo.srcObject = localStream;
    } catch (e) {
      console.error('Camera preview failed:', e);
    }
  }
}

// Request Native Picture-in-Picture or Document Picture-in-Picture
btnPip.addEventListener('click', async () => {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled && previewVideo.readyState >= 2) {
      await previewVideo.requestPictureInPicture();
    }
  } catch (err) {
    console.warn('PiP error:', err);
  }
});

// Auto-trigger video Picture-in-Picture when loaded
previewVideo.addEventListener('loadedmetadata', async () => {
  try {
    // Attempt automatic requestPictureInPicture (might require user gesture in some Chrome versions)
    if (document.pictureInPictureEnabled) {
      await previewVideo.requestPictureInPicture().catch(() => {});
    }
  } catch (e) {}
});

// Clean up when window closes
window.addEventListener('beforeunload', () => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
});

startCamera();
