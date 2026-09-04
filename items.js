let currentRecordings = [];
let activePlayingItem = null;

const recordingsGrid = document.getElementById('recordingsGrid');
const emptyState = document.getElementById('emptyState');
const itemsCount = document.getElementById('itemsCount');
const searchInput = document.getElementById('searchInput');

// Modal Elements
const playerModal = document.getElementById('playerModal');
const modalVideo = document.getElementById('modalVideo');
const modalVideoTitle = document.getElementById('modalVideoTitle');
const modalVideoMeta = document.getElementById('modalVideoMeta');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnModalDownload = document.getElementById('btnModalDownload');

// Load recordings on startup
document.addEventListener('DOMContentLoaded', async () => {
  await loadRecordings();

  // Check URL param for auto-play (e.g. items.html?id=rec_12345)
  const urlParams = new URLSearchParams(window.location.search);
  const autoPlayId = urlParams.get('id');
  if (autoPlayId) {
    const target = currentRecordings.find(r => r.id === autoPlayId);
    if (target) {
      openPlayer(target);
    }
  }
});

searchInput.addEventListener('input', () => {
  renderRecordings();
});

btnCloseModal.addEventListener('click', closePlayer);
playerModal.addEventListener('click', (e) => {
  if (e.target === playerModal) closePlayer();
});

btnModalDownload.addEventListener('click', () => {
  if (activePlayingItem) {
    downloadItem(activePlayingItem);
  }
});

async function loadRecordings() {
  try {
    currentRecordings = await getAllRecordings();
    renderRecordings();
  } catch (err) {
    console.error('Failed to load recordings:', err);
    itemsCount.textContent = 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
  }
}

function renderRecordings() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = currentRecordings.filter(item => {
    return item.title.toLowerCase().includes(query);
  });

  itemsCount.textContent = `รายการทั้งหมด: ${filtered.length} รายการ`;

  if (filtered.length === 0) {
    recordingsGrid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  recordingsGrid.innerHTML = '';

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `card-${item.id}`;

    const durationText = formatDuration(item.durationMs || 0);
    const sizeText = formatBytes(item.size || (item.blob ? item.blob.size : 0));
    const dateText = new Date(item.createdAt).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const thumbnailSrc = item.thumbnail || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" fill="%231e293b"><rect width="100%" height="100%"/></svg>';

    card.innerHTML = `
      <div class="thumbnail-box" data-id="${item.id}">
        <img class="thumbnail-img" src="${thumbnailSrc}" alt="${item.title}">
        <div class="play-overlay">
          <div class="play-button-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <span class="badge-res">${item.resolution || '4K'}</span>
        <span class="badge-duration">${durationText}</span>
      </div>
      <div class="card-body">
        <div class="card-title" title="คลิกเพื่อเล่นวิดีโอ" data-id="${item.id}">${escapeHtml(item.title)}</div>
        <div class="card-meta">
          <span>📅 ${dateText}</span>
          <span>💾 ${sizeText}</span>
          ${item.hasMic ? '<span>🎙️ ไมค์</span>' : ''}
          ${item.hasSystemAudio ? '<span>🔊 ระบบ</span>' : ''}
        </div>
        <div class="card-actions">
          <button class="btn-action btn-rename" data-id="${item.id}">
            ✏️ เปลี่ยนชื่อ
          </button>
          <div style="display: flex; gap: 8px;">
            <button class="btn-action btn-download" data-id="${item.id}">
              ⬇️ ดาวน์โหลด
            </button>
            <button class="btn-action btn-delete" data-id="${item.id}">
              🗑️ ลบ
            </button>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    card.querySelector('.thumbnail-box').addEventListener('click', () => openPlayer(item));
    card.querySelector('.card-title').addEventListener('click', () => openPlayer(item));
    
    card.querySelector('.btn-rename').addEventListener('click', (e) => {
      e.stopPropagation();
      handleRename(item);
    });

    card.querySelector('.btn-download').addEventListener('click', (e) => {
      e.stopPropagation();
      downloadItem(item);
    });

    card.querySelector('.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      handleDelete(item);
    });

    recordingsGrid.appendChild(card);
  });
}

function openPlayer(item) {
  activePlayingItem = item;
  modalVideoTitle.textContent = item.title;
  modalVideoMeta.textContent = `${item.resolution || '4K'} • ${formatDuration(item.durationMs || 0)} • ${formatBytes(item.size || 0)}`;
  
  if (modalVideo.src) {
    URL.revokeObjectURL(modalVideo.src);
  }

  const videoUrl = URL.createObjectURL(item.blob);
  modalVideo.src = videoUrl;
  playerModal.style.display = 'flex';
  modalVideo.play().catch(() => {});
}

function closePlayer() {
  playerModal.style.display = 'none';
  if (modalVideo.src) {
    modalVideo.pause();
    URL.revokeObjectURL(modalVideo.src);
    modalVideo.src = '';
  }
  activePlayingItem = null;
}

function downloadItem(item) {
  const ext = item.mimeType && item.mimeType.includes('mp4') ? 'mp4' : 'webm';
  const cleanTitle = (item.title || 'recording').replace(/[\\/:*?"<>|]/g, '_');
  const filename = `${cleanTitle}.${ext}`;

  const url = URL.createObjectURL(item.blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

async function handleRename(item) {
  const newTitle = prompt('ระบุชื่อวิดีโอใหม่:', item.title);
  if (newTitle && newTitle.trim() && newTitle.trim() !== item.title) {
    await updateRecordingTitle(item.id, newTitle.trim());
    item.title = newTitle.trim();
    renderRecordings();
  }
}

async function handleDelete(item) {
  if (confirm(`คุณต้องการลบวิดีโอ "${item.title}" ใช่หรือไม่?`)) {
    await deleteRecording(item.id);
    currentRecordings = currentRecordings.filter(r => r.id !== item.id);
    renderRecordings();
    if (activePlayingItem && activePlayingItem.id === item.id) {
      closePlayer();
    }
  }
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
