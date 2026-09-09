let timerInterval = null;
let recordingStartTime = 0;

const btnToggleRecord = document.getElementById('btnToggleRecord');
const btnIcon = document.getElementById('btnIcon');
const btnText = document.getElementById('btnText');
const recordingStatus = document.getElementById('recordingStatus');
const timerText = document.getElementById('timerText');
const controlsArea = document.getElementById('controlsArea');
const resolutionSelect = document.getElementById('resolutionSelect');
const micToggle = document.getElementById('micToggle');
const micDeviceRow = document.getElementById('micDeviceRow');
const micDeviceSelect = document.getElementById('micDeviceSelect');
const camToggle = document.getElementById('camToggle');
const camDeviceRow = document.getElementById('camDeviceRow');
const camDeviceSelect = document.getElementById('camDeviceSelect');
const camPositionRow = document.getElementById('camPositionRow');
const camPositionSelect = document.getElementById('camPositionSelect');
const systemAudioToggle = document.getElementById('systemAudioToggle');
const btnOpenItems = document.getElementById('btnOpenItems');

// Load stored preferences
chrome.storage.local.get(['pref_res', 'pref_mic', 'pref_mic_device', 'pref_cam', 'pref_cam_device', 'pref_cam_pos', 'pref_sys'], (res) => {
  if (res.pref_res) resolutionSelect.value = res.pref_res;
  if (res.pref_mic !== undefined) {
    micToggle.checked = res.pref_mic;
    micDeviceRow.style.display = res.pref_mic ? 'flex' : 'none';
    if (res.pref_mic) {
      populateMicrophoneDevices(res.pref_mic_device);
    }
  }
  if (res.pref_cam !== undefined) {
    camToggle.checked = res.pref_cam;
    camDeviceRow.style.display = res.pref_cam ? 'flex' : 'none';
    camPositionRow.style.display = res.pref_cam ? 'flex' : 'none';
    if (res.pref_cam) {
      populateCameraDevices(res.pref_cam_device);
    }
  }
  if (res.pref_cam_pos) camPositionSelect.value = res.pref_cam_pos;
  if (res.pref_sys !== undefined) systemAudioToggle.checked = res.pref_sys;
});

// Save settings on change
resolutionSelect.addEventListener('change', () => {
  chrome.storage.local.set({ pref_res: resolutionSelect.value });
});
micToggle.addEventListener('change', async () => {
  const isEnabled = micToggle.checked;
  micDeviceRow.style.display = isEnabled ? 'flex' : 'none';
  chrome.storage.local.set({ pref_mic: isEnabled });
  if (isEnabled) {
    const granted = await requestMediaPermission({ audio: true });
    if (granted) {
      await populateMicrophoneDevices();
    }
  }
});
micDeviceSelect.addEventListener('change', () => {
  chrome.storage.local.set({ pref_mic_device: micDeviceSelect.value });
});
camToggle.addEventListener('change', async () => {
  const isEnabled = camToggle.checked;
  camDeviceRow.style.display = isEnabled ? 'flex' : 'none';
  camPositionRow.style.display = isEnabled ? 'flex' : 'none';
  chrome.storage.local.set({ pref_cam: isEnabled });
  if (isEnabled) {
    const granted = await requestMediaPermission({ video: true });
    if (granted) {
      await populateCameraDevices();
    }
  }
});
camDeviceSelect.addEventListener('change', () => {
  chrome.storage.local.set({ pref_cam_device: camDeviceSelect.value });
});
camPositionSelect.addEventListener('change', () => {
  chrome.storage.local.set({ pref_cam_pos: camPositionSelect.value });
});
systemAudioToggle.addEventListener('change', () => {
  chrome.storage.local.set({ pref_sys: systemAudioToggle.checked });
});

async function populateMicrophoneDevices(preferredDeviceId = null) {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevices = devices.filter(d => d.kind === 'audioinput');
    
    micDeviceSelect.innerHTML = '';
    if (audioDevices.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'ไม่พบไมโครโฟนในระบบ';
      micDeviceSelect.appendChild(opt);
      return;
    }

    audioDevices.forEach((device, idx) => {
      const opt = document.createElement('option');
      opt.value = device.deviceId;
      opt.textContent = device.label || `ไมโครโฟนตัวที่ ${idx + 1}`;
      if (preferredDeviceId && device.deviceId === preferredDeviceId) {
        opt.selected = true;
      }
      micDeviceSelect.appendChild(opt);
    });

    // Save current selected device
    chrome.storage.local.set({ pref_mic_device: micDeviceSelect.value });
  } catch (err) {
    console.error('enumerateDevices (mic) error:', err);
  }
}

async function populateCameraDevices(preferredDeviceId = null) {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    
    camDeviceSelect.innerHTML = '';
    if (videoDevices.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'ไม่พบกล้องในระบบ';
      camDeviceSelect.appendChild(opt);
      return;
    }

    videoDevices.forEach((device, idx) => {
      const opt = document.createElement('option');
      opt.value = device.deviceId;
      opt.textContent = device.label || `กล้องตัวที่ ${idx + 1}`;
      if (preferredDeviceId && device.deviceId === preferredDeviceId) {
        opt.selected = true;
      }
      camDeviceSelect.appendChild(opt);
    });

    // Save current selected device
    chrome.storage.local.set({ pref_cam_device: camDeviceSelect.value });
  } catch (err) {
    console.error('enumerateDevices error:', err);
  }
}

async function requestMediaPermission(constraints = { audio: true }) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    // Stop immediately once permission is acquired
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch (err) {
    console.warn('Media permission request failed/dismissed in popup:', err);
    // If permission prompt fails in popup, open request-mic tab
    chrome.tabs.create({ url: 'request-mic.html' });
    return false;
  }
}

async function checkOrRequestMediaPermissions(needMic, needCam) {
  if (!needMic && !needCam) return true;

  let micOk = !needMic;
  let camOk = !needCam;

  if (navigator.permissions && navigator.permissions.query) {
    try {
      if (needMic) {
        const status = await navigator.permissions.query({ name: 'microphone' });
        if (status.state === 'granted') micOk = true;
      }
      if (needCam) {
        const status = await navigator.permissions.query({ name: 'camera' });
        if (status.state === 'granted') camOk = true;
      }
    } catch (e) {
      // Ignore and fallback to getUserMedia
    }
  }

  if (micOk && camOk) return true;

  return await requestMediaPermission({
    audio: needMic,
    video: needCam
  });
}

// Check current recording state on popup open
checkRecordingState();

btnOpenItems.addEventListener('click', () => {
  chrome.tabs.create({ url: 'items.html' });
});

async function checkRecordingState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' });
    if (response && response.isRecording) {
      setRecordingUI(true, response.startTime);
    } else {
      setRecordingUI(false);
    }
  } catch (err) {
    setRecordingUI(false);
  }
}

btnToggleRecord.addEventListener('click', async () => {
  btnToggleRecord.disabled = true;

  const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' });
  const isCurrentlyRecording = response && response.isRecording;

  if (!isCurrentlyRecording) {
    // Check permissions if enabled
    const needMic = micToggle.checked;
    const needCam = camToggle.checked;

    if (needMic || needCam) {
      const hasPermission = await checkOrRequestMediaPermissions(needMic, needCam);
      if (!hasPermission) {
        btnToggleRecord.disabled = false;
        return;
      }
    }

    // Start Recording
    const options = {
      resolution: resolutionSelect.value,
      mic: micToggle.checked,
      micDeviceId: micDeviceSelect.value || null,
      cam: camToggle.checked,
      camDeviceId: camDeviceSelect.value || null,
      camPosition: camPositionSelect.value || 'bottom-right',
      system: systemAudioToggle.checked
    };

    try {
      const startRes = await chrome.runtime.sendMessage({
        type: 'START_RECORDING_REQUEST',
        data: options
      });

      if (startRes && startRes.success) {
        setRecordingUI(true, startRes.startTime || Date.now());
        window.close(); // Close popup so user can focus on screen
      } else {
        alert('ไม่สามารถเริ่มบันทึกได้: ' + ((startRes && startRes.error) || 'เกิดข้อผิดพลาด'));
        setRecordingUI(false);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการเริ่มบันทึก: ' + e.message);
      setRecordingUI(false);
    }
  } else {
    // Stop Recording
    try {
      const stopRes = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING_REQUEST' });
      setRecordingUI(false);
      window.close();
    } catch (e) {
      alert('ไม่สามารถหยุดบันทึกได้: ' + e.message);
    }
  }

  btnToggleRecord.disabled = false;
});

function setRecordingUI(isRecording, startTime = Date.now()) {
  if (isRecording) {
    recordingStatus.style.display = 'block';
    controlsArea.style.display = 'none';
    btnToggleRecord.className = 'btn-record btn-stop';
    if (btnIcon) btnIcon.className = 'stop-square';
    btnText.textContent = 'หยุดการบันทึก';
    
    recordingStartTime = startTime;
    startTimer();
  } else {
    recordingStatus.style.display = 'none';
    controlsArea.style.display = 'block';
    btnToggleRecord.className = 'btn-record btn-start';
    if (btnIcon) btnIcon.className = 'record-bullet';
    btnText.textContent = 'เริ่มบันทึกหน้าจอ';
    stopTimer();
  }
}

function startTimer() {
  stopTimer();
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const elapsed = Math.max(0, Date.now() - recordingStartTime);
  const totalSeconds = Math.floor(elapsed / 1000);
  const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');
  timerText.textContent = `${hrs}:${mins}:${secs}`;
}
