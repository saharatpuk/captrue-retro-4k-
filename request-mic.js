const btnGrant = document.getElementById('btnGrant');
const statusText = document.getElementById('statusText');

btnGrant.addEventListener('click', async () => {
  btnGrant.disabled = true;
  statusText.textContent = 'กำลังขอสิทธิ์การเข้าถึงไมโครโฟน...';
  statusText.className = 'status';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Permission granted! Stop immediately.
    stream.getTracks().forEach(track => track.stop());
    
    statusText.textContent = '✓ อนุญาตไมโครโฟนเรียบร้อยแล้ว! หน้าต่างนี้จะปิดโดยอัตโนมัติ...';
    statusText.className = 'status success';
    
    setTimeout(() => {
      window.close();
    }, 1500);
  } catch (err) {
    console.error('Permission error:', err);
    statusText.textContent = '✕ ไม่อนุญาตหรือเกิดข้อผิดพลาด: ' + err.message;
    statusText.className = 'status error';
    btnGrant.disabled = false;
  }
});
