chrome.runtime.onInstalled.addListener(() => {
  console.log('Local Screen & Video Recorder extension installed.');
});

let previewWindowId = null;

// Manage offscreen document creation
async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA', 'DISPLAY_MEDIA'],
    justification: 'Recording screen and audio in background'
  });
}

// Listen for messages from popup or offscreen
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === 'START_RECORDING_REQUEST') {
      try {
        await ensureOffscreenDocument();
        
        // Forward start command to offscreen
        const response = await chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'START_RECORDING',
          data: message.data
        });
        
        // Update badge
        chrome.action.setBadgeText({ text: 'REC' });
        chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

        // If webcam is enabled, open a floating live preview window so the user can see themselves
        if (message.data && message.data.cam) {
          try {
            const devParam = message.data.camDeviceId ? `?deviceId=${encodeURIComponent(message.data.camDeviceId)}` : '';
            const previewWin = await chrome.windows.create({
              url: `camera-preview.html${devParam}`,
              type: 'popup',
              width: 340,
              height: 260,
              top: 50,
              left: 50,
              focused: true
            });
            previewWindowId = previewWin.id;
          } catch (winErr) {
            console.warn('Could not open preview window:', winErr);
          }
        }
        
        sendResponse(response || { success: true });
      } catch (err) {
        console.error('Error starting recording:', err);
        sendResponse({ success: false, error: err.message });
      }
    } else if (message.type === 'STOP_RECORDING_REQUEST') {
      try {
        const response = await chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'STOP_RECORDING'
        });
        
        chrome.action.setBadgeText({ text: '' });

        // Close camera preview window if open
        if (previewWindowId) {
          try {
            await chrome.windows.remove(previewWindowId);
          } catch (e) {}
          previewWindowId = null;
        }

        sendResponse(response || { success: true });
      } catch (err) {
        console.error('Error stopping recording:', err);
        sendResponse({ success: false, error: err.message });
      }
    } else if (message.type === 'GET_RECORDING_STATE') {
      try {
        await ensureOffscreenDocument();
        const response = await chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'GET_STATE'
        });
        sendResponse(response);
      } catch (err) {
        sendResponse({ isRecording: false });
      }
    } else if (message.type === 'RECORDING_FINISHED') {
      chrome.action.setBadgeText({ text: '' });
      // Open the local items dashboard to preview the saved clip
      chrome.tabs.create({ url: `items.html?id=${message.id}` });
    }
  })();
  return true; // Keep message channel open for async response
});
