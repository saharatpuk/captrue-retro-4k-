let timerInterval = null;
let recordingStartTime = 0;

const btnToggleRecord = document.getElementById('btnToggleRecord');
const btnText = document.getElementById('btnText');
const recordingStatus = document.getElementById('recordingStatus');
const timerText = document.getElementById('timerText');
const controlsArea = document.getElementById('controlsArea');
const resolutionSelect = document.getElementById('resolutionSelect');
const micToggle = document.getElementById('micToggle');
const systemAudioToggle = document.getElementById('systemAudioToggle');
const btnOpenItems = document.getElementById('btnOpenItems');

// Load stored preferences
chrome.storage.local.get(['pref_res', 'pref_mic', 'pref_sys'], (res) => {
  if (res.pref_res) resolutionSelect.value = res.pref_res;
  if (res.pref_mic !== undefined) micToggle.checked = res.pref_mic;
  if (res.pref_sys !== undefined) systemAudioToggle.checked = res.pref_sys;
});

// Save settings on change
resolutionSelect.addEventListener('change', () => {
  chrome.storage.local.set({ pref_res: resolutionSelect.value });
});
micToggle.addEventListener('change', async () => {
  chrome.storage.local.set({ pref_mic: micToggle.checked });
  if (micToggle.checked) {
    await requestMicPermission();
  }
});
systemAudioToggle.addEventListener('change', () => {
  chrome.storage.local.set({ pref_sys: systemAudioToggle.checked });
});

async function requestMicPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop immediately once permission is acquired
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch (err) {
    console.warn('Microphone permission request failed/dismissed in popup:', err);
    // If permission prompt fails in popup, open request-mic tab
    chrome.tabs.create({ url: 'request-mic.html' });
    return false;
  }
}

async function checkOrRequestMicPermission() {
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: 'microphone' });
      if (status.state === 'granted') {
        return true;
      }
    } catch (e) {
      // Ignore and fallback to getUserMedia
    }
  }
  return await requestMicPermission();
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
    // Check microphone permission first if enabled
    if (micToggle.checked) {
      const hasPermission = await checkOrRequestMicPermission();
      if (!hasPermission) {
        btnToggleRecord.disabled = false;
        return;
      }
    }

    // Start Recording
    const options = {
      resolution: resolutionSelect.value,
      mic: micToggle.checked,
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
    btnText.textContent = 'หยุดการบันทึก (Stop Recording)';
    
    recordingStartTime = startTime;
    startTimer();
  } else {
    recordingStatus.style.display = 'none';
    controlsArea.style.display = 'block';
    btnToggleRecord.className = 'btn-record btn-start';
    btnText.textContent = 'เริ่มบันทึก (Start Recording)';
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
