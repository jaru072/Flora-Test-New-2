// ==================== BACKUP & RESTORE MODULE (backup_restore.js) ====================
import { 
  doc, 
  setDoc, 
  getDocs, 
  collection, 
  deleteDoc, 
  getDoc, 
  onSnapshot, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject, 
  getBlob, 
  getBytes 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

let tempParsedRestoreData = null;

async function replaceCollectionInFirestore(collName, newList) {
  if (!window.db || !window.isFirebaseReady) return;
  try {
    const snap = await getDocs(collection(window.db, collName));
    const newIds = new Set((newList || []).map(x => x && x.id).filter(Boolean));
    const newImageUrls = new Set((newList || []).map(x => x && (x.imageUrl || x.photoUrl)).filter(Boolean));

    for (const docSnap of snap.docs) {
      if (!newIds.has(docSnap.id)) {
        await deleteDoc(doc(window.db, collName, docSnap.id));
      }
    }
    for (const item of (newList || [])) {
      if (item && item.id) {
        await setDoc(doc(window.db, collName, item.id), item);
      }
    }
  } catch (err) {
    console.warn(`Error replacing Firestore collection ${collName}:`, err);
  }
}

window.localImageBackupDirectoryHandle = null;
window.localBackupFolderName = '';
window.localFolderFilesList = [];

// Helper to safely obtain window global functions
function getGlobalToast() {
  return typeof window.showToast === 'function' ? window.showToast : (msg) => console.log("Toast:", msg);
}

// Thailand Timezone (UTC+7 Asia/Bangkok) Formatted Timestamp Filename Generator
window.getThaiDateTimeFilenameString = function(date = new Date()) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    const thaiFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = thaiFmt.formatToParts(d);
    const partMap = {};
    parts.forEach(p => { partMap[p.type] = p.value; });
    return `${partMap.year}-${partMap.month}-${partMap.day}_${partMap.hour}-${partMap.minute}-${partMap.second}`;
  } catch (e) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().replace(/[:.]/g, '-');
  }
};

function safeJsonClone(obj) {
  try {
    if (typeof window.safeJsonStringify === 'function') {
      return JSON.parse(window.safeJsonStringify(obj || []));
    }
    return JSON.parse(JSON.stringify(obj || []));
  } catch (e) {
    console.warn("safeJsonClone fallback:", e);
    return Array.isArray(obj) ? [...obj] : { ...obj };
  }
}

function getComprehensiveDepartmentsList() {
  const seen = new Set();
  const list = [];
  const addDept = (item) => {
    if (!item) return;
    const name = (typeof item === 'object' ? (item.name || item.id || '') : String(item)).trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      list.push(name);
    }
  };
  if (Array.isArray(window.departmentsList) && window.departmentsList.length > 0) {
    window.departmentsList.forEach(addDept);
  } else if (Array.isArray(window.employeeList)) {
    window.employeeList.forEach(emp => {
      if (emp && emp.department) {
        addDept(emp.department);
      }
    });
  }
  return list;
}

function getComprehensiveLocationsList() {
  const set = new Set(window.locationsList || []);
  (window.equipmentList || []).forEach(eq => {
    if (eq && eq.location && typeof eq.location === 'string' && eq.location.trim()) {
      set.add(eq.location.trim());
    }
  });
  return Array.from(set).filter(Boolean);
}

function getComprehensivePositionsList() {
  const seen = new Set();
  const list = [];
  const addPos = (item) => {
    if (!item) return;
    const name = (typeof item === 'object' ? (item.name || item.id || '') : String(item)).trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      if (typeof item === 'object' && item.name) {
        list.push(item);
      } else {
        list.push({ id: `POS-${String(list.length + 1).padStart(3, '0')}`, code: `POS-${String(list.length + 1).padStart(3, '0')}`, name: name, group: 'ตำแหน่งทั่วไป' });
      }
    }
  };
  if (Array.isArray(window.positionsList) && window.positionsList.length > 0) {
    window.positionsList.forEach(addPos);
  } else if (Array.isArray(window.employeeList)) {
    window.employeeList.forEach(emp => {
      if (emp && emp.position) {
        addPos(emp.position);
      }
    });
  }
  return list;
}

// Helper to refresh live database stats inside Backup/Restore modal
window.refreshBackupModalLiveStats = function() {
  const equipCount = (window.equipmentList || []).length;
  const empCount = (window.employeeList || []).length;
  const txCount = (window.transactionHistory || []).length;
  const attCount = (window.attendanceLogs || []).length;
  const metaCount = (window.categoriesList || []).length + (window.departmentsList || []).length + (window.positionsList || []).length;

  let imageCount = 0;
  (window.equipmentList || []).forEach(item => { if (item && item.imageUrl) imageCount++; });
  (window.employeeList || []).forEach(emp => { if (emp && emp.photoUrl) imageCount++; });

  const elEquip = document.getElementById('backupCountEquip');
  const elEmp = document.getElementById('backupCountEmp');
  const elTx = document.getElementById('backupCountTx');
  const elAtt = document.getElementById('backupCountAtt');
  const elMeta = document.getElementById('backupCountMeta');
  const elImg = document.getElementById('backupCountImg');

  const audCount = (window.auditLogs || []).length;
  if (elEquip) elEquip.textContent = `${equipCount} รายการ`;
  if (elEmp) elEmp.textContent = `${empCount} คน`;
  if (elTx) elTx.textContent = `${txCount} รายการ (+ audit ${audCount})`;
  if (elAtt) elAtt.textContent = `${attCount} รายการ`;
  if (elMeta) elMeta.textContent = `${metaCount} หมวด/แผนก`;
  if (elImg) elImg.textContent = `${imageCount} รูปภาพ`;
};

// 1. Open Backup/Restore Modal
window.openBackupRestoreModal = function() {
  const isAuthorized = (typeof window.isThammaSrithongAdminStrict === 'function' && window.isThammaSrithongAdminStrict()) ||
                       (typeof window.canAccessDatabaseEditor === 'function' && window.canAccessDatabaseEditor());
  if (!isAuthorized) {
    getGlobalToast()("⚠️ เฉพาะผู้ดูแลระบบหลัก คุณ Thamma Srithong (jaru072@gmail.com) เท่านั้นที่มีสิทธิ์เข้าถึงส่วนสำรอง/กู้คืนข้อมูล");
    return;
  }
  try {
    window.refreshBackupModalLiveStats();

    tempParsedRestoreData = null;
    if (typeof window.updateBackupProgress === 'function') {
      window.updateBackupProgress(0, '', '', false);
    }
    const restoreInput = document.getElementById('restoreFileInput');
    if (restoreInput) restoreInput.value = '';

    const previewCard = document.getElementById('restorePreviewCard');
    if (previewCard) previewCard.classList.add('d-none');

    const btnRestore = document.getElementById('btnExecuteRestore');
    if (btnRestore) btnRestore.classList.add('d-none');

    const modalElem = document.getElementById('backupRestoreModal');
    if (modalElem) {
      const modalInst = bootstrap.Modal.getOrCreateInstance(modalElem);
      modalInst.show();
    } else {
      alert("ไม่พบส่วนประกอบ Modal สำรองข้อมูล");
    }
  } catch (err) {
    console.error("Error opening Backup Restore modal:", err);
    alert("เกิดข้อผิดพลาดในการเปิดหน้าต่างสำรอง/กู้คืนข้อมูล: " + err.message);
  }
};

// ==================== 2. PROGRESS BAR & TIMER CONTROLLER ====================
let backupTimerInterval = null;
let backupTimerStartTime = null;
let backupTimerElapsedMs = 0;
let isBackupTimerLocked = false;

window.formatBackupTimerDisplay = function(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

window.startBackupTimer = function() {
  if (backupTimerInterval) {
    clearInterval(backupTimerInterval);
    backupTimerInterval = null;
  }
  isBackupTimerLocked = false;
  backupTimerStartTime = Date.now();
  backupTimerElapsedMs = 0;

  const timerElems = document.querySelectorAll('#backupProgressTimer');
  const timerBadges = document.querySelectorAll('#backupProgressTimerBadge');
  const timerIcons = document.querySelectorAll('#backupProgressTimerIcon');
  const timerLabels = document.querySelectorAll('#backupProgressTimerLabel');

  timerElems.forEach(el => {
    el.textContent = '00:00';
    el.className = 'font-monospace text-white fw-bolder';
  });
  timerBadges.forEach(b => {
    b.className = 'badge bg-danger text-white rounded-pill px-3 py-1 fs-7 fw-bold d-flex align-items-center gap-1.5 shadow-2xs';
  });
  timerIcons.forEach(i => {
    i.className = 'bi bi-stopwatch text-white';
  });
  timerLabels.forEach(l => {
    l.textContent = 'เวลา:';
    l.className = 'text-white';
  });

  backupTimerInterval = setInterval(() => {
    if (!backupTimerStartTime || isBackupTimerLocked) return;
    backupTimerElapsedMs = Date.now() - backupTimerStartTime;
    const formatted = window.formatBackupTimerDisplay(backupTimerElapsedMs);
    document.querySelectorAll('#backupProgressTimer').forEach(el => {
      el.textContent = formatted;
      el.className = 'font-monospace text-white fw-bolder';
    });
  }, 200);
};

window.stopBackupTimer = function(markComplete = false) {
  if (backupTimerInterval) {
    clearInterval(backupTimerInterval);
    backupTimerInterval = null;
  }
  if (backupTimerStartTime && !isBackupTimerLocked) {
    backupTimerElapsedMs = Date.now() - backupTimerStartTime;
  }
  isBackupTimerLocked = true;

  const formatted = window.formatBackupTimerDisplay(backupTimerElapsedMs || 0);
  const totalSec = Math.max(0, Math.floor((backupTimerElapsedMs || 0) / 1000));
  
  document.querySelectorAll('#backupProgressTimer').forEach(el => {
    el.textContent = formatted;
    el.className = 'font-monospace text-white fw-bolder fs-6';
  });

  if (markComplete) {
    const timerBadges = document.querySelectorAll('#backupProgressTimerBadge');
    const timerIcons = document.querySelectorAll('#backupProgressTimerIcon');
    const timerLabels = document.querySelectorAll('#backupProgressTimerLabel');
    timerBadges.forEach(b => {
      b.className = 'badge bg-danger text-white rounded-pill px-3.5 py-1.5 fs-7 fw-bold d-flex align-items-center gap-1.5 shadow-sm';
    });
    timerIcons.forEach(i => {
      i.className = 'bi bi-check-circle-fill text-white fs-6';
    });
    timerLabels.forEach(l => {
      l.textContent = '⏱️ ใช้เวลา:';
      l.className = 'text-white';
    });

    const subStatus = document.querySelectorAll('#backupProgressSubStatus');
    subStatus.forEach(s => {
      s.innerHTML = `<span class="badge bg-danger text-white px-2.5 py-1 rounded-pill fw-bold shadow-2xs me-1"><i class="bi bi-stopwatch-fill me-1"></i>ใช้เวลาประมวลผล: ${formatted} (${totalSec} วินาที)</span> <i class="bi bi-check-circle-fill text-success ms-1"></i> ดำเนินการเสร็จสมบูรณ์ 100%`;
    });
  }
};

window.resetBackupTimer = function() {
  if (backupTimerInterval) {
    clearInterval(backupTimerInterval);
    backupTimerInterval = null;
  }
  isBackupTimerLocked = false;
  backupTimerStartTime = null;
  backupTimerElapsedMs = 0;

  document.querySelectorAll('#backupProgressTimer').forEach(el => {
    el.textContent = '00:00';
    el.className = 'font-monospace text-white fw-bolder';
  });
  const timerBadges = document.querySelectorAll('#backupProgressTimerBadge');
  const timerIcons = document.querySelectorAll('#backupProgressTimerIcon');
  const timerLabels = document.querySelectorAll('#backupProgressTimerLabel');
  timerBadges.forEach(b => {
    b.className = 'badge bg-danger text-white rounded-pill px-3 py-1 fs-7 fw-bold d-flex align-items-center gap-1.5 shadow-2xs';
  });
  timerIcons.forEach(i => {
    i.className = 'bi bi-stopwatch text-white';
  });
  timerLabels.forEach(l => {
    l.textContent = 'เวลา:';
    l.className = 'text-white';
  });
};

// 2. Progress Bar Updater
window.updateBackupProgress = function(percent, statusText, detailsText = '', isVisible = true, colorClass = 'bg-primary') {
  const containers = document.querySelectorAll('#backupProgressContainer');
  if (!containers || containers.length === 0) return;

  const cleanPercent = Math.min(100, Math.max(0, Math.round(percent)));

  // Auto control timer state based on visibility and percentage
  if (!isVisible) {
    window.resetBackupTimer();
  } else if (colorClass && colorClass.includes('danger')) {
    // Error state: freeze timer without completing
    window.stopBackupTimer(false);
  } else if (cleanPercent >= 100) {
    // Process complete: immediately freeze timer with red text & summary
    window.stopBackupTimer(true);
  } else if (cleanPercent > 0 && (cleanPercent <= 15 || isBackupTimerLocked)) {
    // When a new process starts (low percentage > 0) or if it was locked from previous run, restart fresh
    window.startBackupTimer();
  } else if (cleanPercent > 0 && cleanPercent < 100) {
    if (!backupTimerInterval && !backupTimerStartTime) {
      window.startBackupTimer();
    }
  }

  containers.forEach(container => {
    if (!isVisible) {
      container.classList.add('d-none');
      return;
    }

    container.classList.remove('d-none');

    const bar = container.querySelector('#backupProgressBar') || document.getElementById('backupProgressBar');
    const percentElem = container.querySelector('#backupProgressPercent') || document.getElementById('backupProgressPercent');
    const titleElem = container.querySelector('#backupProgressTitle') || document.getElementById('backupProgressTitle');
    const textElem = container.querySelector('#backupProgressText') || document.getElementById('backupProgressText');
    const spinnerElem = container.querySelector('#backupProgressSpinner') || document.getElementById('backupProgressSpinner');

    if (bar) {
      bar.style.width = `${cleanPercent}%`;
      bar.textContent = `${cleanPercent}%`;
      bar.className = `progress-bar progress-bar-striped progress-bar-animated ${colorClass} fw-bold fs-8`;
    }
    if (percentElem) {
      percentElem.textContent = `${cleanPercent}%`;
      percentElem.className = `badge rounded-pill px-3 py-1 fs-7 fw-bold ${colorClass}`;
    }
    if (titleElem && statusText) titleElem.textContent = statusText;
    if (textElem) textElem.textContent = detailsText || statusText;

    if (spinnerElem) {
      if (cleanPercent >= 100) {
        spinnerElem.classList.add('d-none');
      } else {
        spinnerElem.classList.remove('d-none');
      }
    }

    // Auto-scroll to progress bar when it is shown or active
    if (isVisible && (cleanPercent <= 15 || cleanPercent === 70 || cleanPercent === 90 || cleanPercent >= 100)) {
      try {
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (scrollErr) {}
    }
  });
};

// 3. Delete Image from Firebase Storage Helper
window.deleteImageFromFirebaseStorage = async function(imagePathOrUrl) {
  if (!window.isFirebaseReady || !window.storage || !imagePathOrUrl) return;
  try {
    if (typeof imagePathOrUrl === 'string') {
      let storagePath = imagePathOrUrl;
      if (imagePathOrUrl.includes('/o/')) {
        storagePath = decodeURIComponent(imagePathOrUrl.split('/o/')[1].split('?')[0]);
      } else if (imagePathOrUrl.startsWith('gs://')) {
        storagePath = imagePathOrUrl.replace(/^gs:\/\/[^\/]+\//, '');
      }
      const storageRef = ref(window.storage, storagePath);
      await deleteObject(storageRef);
      console.log("Deleted old image from Firebase Storage path:", storagePath);
    }
  } catch (err) {
    console.warn("Notice: Firebase Storage image delete notice:", err.message);
  }
};

// 4. Data URL to Blob Helper
window.dataURLToBlob = function(dataurl) {
  if (!dataurl || typeof dataurl !== 'string' || !dataurl.startsWith('data:')) return null;
  try {
    const arr = dataurl.split(',');
    if (arr.length < 2) return null;
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.warn("Notice: dataURLToBlob conversion failed:", e);
    return null;
  }
};

// 5. Placeholder Canvas Generator
window.generateImageBlobPlaceholder = function(fallbackLabel = 'Flora Item', itemType = 'EQUIPMENT') {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 500;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");

      const grad = ctx.createLinearGradient(0, 0, 500, 500);
      if (itemType === 'EMPLOYEE') {
        grad.addColorStop(0, '#1d3557');
        grad.addColorStop(1, '#457b9d');
      } else {
        grad.addColorStop(0, '#2d6a4f');
        grad.addColorStop(1, '#1b4332');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 500, 500);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(itemType === 'EMPLOYEE' ? "👤 Flora Staff" : "🌿 Flora Equipment", 250, 200);

      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = itemType === 'EMPLOYEE' ? '#a8dadc' : '#d8f3dc';
      ctx.fillText(String(fallbackLabel || 'Item').slice(0, 28), 250, 270);

      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    } catch (e) {
      resolve(null);
    }
  });
};

// 6. Fetch Image as Blob Helper
window.fetchImageAsBlobOrBase64 = async function(imageUrl, fallbackLabel = 'Flora Item', itemType = 'EQUIPMENT') {
  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
    return await window.generateImageBlobPlaceholder(fallbackLabel, itemType);
  }

  const trimmedUrl = imageUrl.trim();

  if (trimmedUrl.startsWith('data:')) {
    const directBlob = window.dataURLToBlob(trimmedUrl);
    if (directBlob && directBlob.size > 0) return directBlob;
    try {
      const res = await fetch(trimmedUrl);
      const b = await res.blob();
      if (b && b.size > 0) return b;
    } catch (e) {}
  }

  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 15000));

  const fetchWork = (async () => {
    if (window.isFirebaseReady && window.storage && 
       (trimmedUrl.includes('firebasestorage') || trimmedUrl.includes('storage.googleapis.com') || trimmedUrl.startsWith('gs://'))) {
      
      try {
        const stRef = ref(window.storage, trimmedUrl);
        const buf = await getBytes(stRef);
        if (buf && buf.byteLength > 0) return new Blob([buf], { type: 'image/jpeg' });
      } catch (e1) {}

      try {
        const stRef = ref(window.storage, trimmedUrl);
        const stBlob = await getBlob(stRef);
        if (stBlob && stBlob.size > 0) return stBlob;
      } catch (e2) {}

      let storagePath = trimmedUrl;
      if (trimmedUrl.includes('/o/')) {
        storagePath = decodeURIComponent(trimmedUrl.split('/o/')[1].split('?')[0]);
      } else if (trimmedUrl.startsWith('gs://')) {
        storagePath = trimmedUrl.replace(/^gs:\/\/[^\/]+\//, '');
      }

      try {
        const stRefPath = ref(window.storage, storagePath);
        const buf = await getBytes(stRefPath);
        if (buf && buf.byteLength > 0) return new Blob([buf], { type: 'image/jpeg' });
      } catch (e3) {}

      try {
        const stRefPath = ref(window.storage, storagePath);
        const stBlob = await getBlob(stRefPath);
        if (stBlob && stBlob.size > 0) return stBlob;
      } catch (e4) {}

      try {
        const stRefPath = ref(window.storage, storagePath);
        const freshUrl = await getDownloadURL(stRefPath);
        const res = await fetch(freshUrl);
        if (res.ok) {
          const freshBlob = await res.blob();
          if (freshBlob && freshBlob.size > 0) return freshBlob;
        }
      } catch (e5) {}
    }

    try {
      const res = await fetch(trimmedUrl, { mode: 'cors' });
      if (res.ok) {
        const b = await res.blob();
        if (b && b.size > 0) return b;
      }
    } catch (e) {}

    try {
      const res2 = await fetch(trimmedUrl);
      if (res2.ok) {
        const b2 = await res2.blob();
        if (b2 && b2.size > 0) return b2;
      }
    } catch (e) {}

    const corsProxies = [
      (u) => `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=${encodeURIComponent(u)}`,
      (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
    ];

    for (const proxyFn of corsProxies) {
      try {
        const proxyUrl = proxyFn(trimmedUrl);
        const resP = await fetch(proxyUrl);
        if (resP.ok) {
          const bP = await resP.blob();
          if (bP && bP.size > 0) return bP;
        }
      } catch (eProxy) {}
    }

    try {
      const canvasBlob = await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || img.width || 500;
            canvas.height = img.naturalHeight || img.height || 500;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
          } catch (e) {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = trimmedUrl;
      });

      if (canvasBlob && canvasBlob.size > 0) return canvasBlob;
    } catch (e2) {}

    return await window.generateImageBlobPlaceholder(fallbackLabel, itemType);
  })();

  const result = await Promise.race([fetchWork, timeoutPromise]);
  if (result && result.size > 0) return result;
  return await window.generateImageBlobPlaceholder(fallbackLabel, itemType);
};

// 7. Blob to Base64 Helper
window.blobToBase64 = function(blob) {
  return new Promise((resolve) => {
    if (!blob) return resolve(null);
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
};

// 8. Export Backup to Selected Folder
window.exportBackupToSelectedFolder = async function() {
  if (!('showDirectoryPicker' in window)) {
    alert("⚠️ เบราว์เซอร์หรือสภาพแวดล้อมปัจจุบันไม่รองรับการเลือกโฟลเดอร์โดยตรง (Directory Picker API)\n\nระบบจะสลับไปดาวน์โหลดเป็นแพ็กเกจ ZIP ครบชุด (.zip) ซึ่งมีโฟลเดอร์ images/ และไฟล์ flora_garden_backup_data.json แทนให้อัตโนมัติ");
    await window.downloadBackupAsZipPackage();
    return;
  }

  let dirHandle = null;
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.warn("Folder picker blocked or error, fallback to zip:", err);
    alert("⚠️ ไม่สามารถเปิดระบบเลือกโฟลเดอร์ในสภาพแวดล้อมปัจจุบันได้\n\nระบบจะสลับไปดาวน์โหลดเป็นแพ็กเกจ ZIP สำรองข้อมูลครบชุด ให้ทันทีครับ");
    await window.downloadBackupAsZipPackage();
    return;
  }

  try {
    getGlobalToast()("⏳ กำลังสำรองข้อมูลและดาวน์โหลดรูปภาพจริงลงโฟลเดอร์...");

    const imgDirHandle = await dirHandle.getDirectoryHandle('images', { create: true });
    const imagesBase64Map = {};
    let savedImagesCount = 0;

    const clonedEquipment = safeJsonClone(window.equipmentList);
    const clonedEmployees = safeJsonClone(window.employeeList);

    for (let i = 0; i < (window.equipmentList || []).length; i++) {
      const eq = window.equipmentList[i];
      const imgSource = eq ? (eq.imageUrl || eq.imageBase64 || eq.photoUrl || eq.photoBase64) : null;
      if (imgSource) {
        const safeCode = (eq.code || eq.id || `item_${i+1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeId = String(eq.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');

        try {
          const blob = await window.fetchImageAsBlobOrBase64(imgSource, eq.name || 'Equipment');
          if (blob && blob.size > 0) {
            const ext = blob.type.includes('png') ? '.png' : (blob.type.includes('webp') ? '.webp' : '.jpg');
            const filename = `equipment_${safeCode}${ext}`;
            const fileHandle = await imgDirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();

            const b64 = await window.blobToBase64(blob);
            if (b64) {
              imagesBase64Map[filename] = b64;
              imagesBase64Map[`equipment_${safeCode}.jpg`] = b64;
              if (safeId) imagesBase64Map[`equipment_${safeId}.jpg`] = b64;
              if (eq.code) imagesBase64Map[`equipment_${eq.code.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`] = b64;
              imagesBase64Map[safeCode] = b64;
              clonedEquipment[i].imageBase64 = b64;
              clonedEquipment[i].imageUrl = b64;
            }
            savedImagesCount++;
          }
        } catch (e) {
          console.warn(`Save image failed for ${eq.name}:`, e);
        }
      }
    }

    for (let i = 0; i < (window.employeeList || []).length; i++) {
      const emp = window.employeeList[i];
      const photoSource = emp ? (emp.photoUrl || emp.photoBase64 || emp.imageUrl || emp.imageBase64) : null;
      if (photoSource) {
        const safeCode = (emp.code || emp.id || `emp_${i+1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeId = String(emp.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');

        try {
          const blob = await window.fetchImageAsBlobOrBase64(photoSource, emp.name || 'Employee');
          if (blob && blob.size > 0) {
            const ext = blob.type.includes('png') ? '.png' : (blob.type.includes('webp') ? '.webp' : '.jpg');
            const filename = `employee_${safeCode}${ext}`;
            const fileHandle = await imgDirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();

            const b64 = await window.blobToBase64(blob);
            if (b64) {
              imagesBase64Map[filename] = b64;
              imagesBase64Map[`employee_${safeCode}.jpg`] = b64;
              if (safeId) imagesBase64Map[`employee_${safeId}.jpg`] = b64;
              if (emp.code) imagesBase64Map[`employee_${emp.code.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`] = b64;
              imagesBase64Map[safeCode] = b64;
              clonedEmployees[i].photoBase64 = b64;
              clonedEmployees[i].photoUrl = b64;
            }
            savedImagesCount++;
          }
        } catch (e) {
          console.warn(`Save photo failed for ${emp.name}:`, e);
        }
      }
    }

    const now = new Date();
    let orgTreeBackup = null;
    try {
      if (typeof window.getFloraOrgTree === 'function') orgTreeBackup = window.getFloraOrgTree();
      else if (localStorage.getItem('flora_org_tree_v2')) orgTreeBackup = JSON.parse(localStorage.getItem('flora_org_tree_v2'));
      else if (localStorage.getItem('flora_org_tree_data')) orgTreeBackup = JSON.parse(localStorage.getItem('flora_org_tree_data'));
    } catch(e) {}

    const backupData = {
      version: "2.0",
      appName: "Flora Garden Stock & Employee System",
      backupTimestamp: now.toISOString(),
      backupDateThai: now.toLocaleString('th-TH'),
      equipmentList: clonedEquipment,
      employeeList: clonedEmployees,
      orgStructure: orgTreeBackup,
      deletedEmployees: safeJsonClone(window.deletedEmployees || []),
      transactionHistory: window.transactionHistory || [],
      attendanceLogs: window.attendanceLogs || [],
      auditLogs: window.auditLogs || [],
      categoriesList: window.categoriesList || [],
      departmentsList: getComprehensiveDepartmentsList(),
      positionsList: getComprehensivePositionsList(),
      locationsList: getComprehensiveLocationsList(),
      imagesBase64Map: imagesBase64Map
    };

    const jsonBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const jsonFileHandle = await dirHandle.getFileHandle('flora_garden_backup_data.json', { create: true });
    const jsonWritable = await jsonFileHandle.createWritable();
    await jsonWritable.write(jsonBlob);
    await jsonWritable.close();

    getGlobalToast()(`🎉 บันทึกไฟล์ flora_garden_backup_data.json และรูปภาพ ${savedImagesCount} รูป ลงโฟลเดอร์ "${dirHandle.name}" เรียบร้อยแล้ว!`);
    alert(`🎉 สำเร็จ! ระบบได้บันทึกไฟล์ข้อมูล flora_garden_backup_data.json และสร้างโฟลเดอร์ images/ พร้อมรูปภาพจริงจำนวน ${savedImagesCount} รูป ในโฟลเดอร์ "${dirHandle.name}" เรียบร้อยแล้ว`);
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.warn("Folder picker write notice, fallback to zip:", err);
    getGlobalToast()("สลับไปใช้ดาวน์โหลดแพ็กเกจ ZIP ครบชุดแทน");
    await window.downloadBackupAsZipPackage();
  }
};

// 9. Download ZIP Package
window.getThaiDateTimeFilenameString = function(date = new Date()) {
  try {
    const options = { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
    const formatter = new Intl.DateTimeFormat("en-GB", options);
    const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
    const adYear = parseInt(parts.year, 10);
    const beYear = adYear + 543;
    const day = parts.day;
    const month = parts.month;
    let hour = parts.hour ? parts.hour.padStart(2, "0") : "00";
    if (hour === "24") hour = "00";
    const minute = parts.minute ? parts.minute.padStart(2, "0") : "00";
    const second = parts.second ? parts.second.padStart(2, "0") : "00";
    return `${day}-${month}-${beYear}_${hour}-${minute}-${second}`;
  } catch (e) {
    const now = new Date(date.getTime() + (7 * 60 + date.getTimezoneOffset()) * 60000);
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const beYear = now.getFullYear() + 543;
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${beYear}_${hour}-${minute}-${second}`;
  }
};

window.downloadBackupAsZipPackage = async function() {
  if (typeof window.JSZip !== 'function' && typeof JSZip !== 'function') {
    alert("กำลังโหลดไลบรารี Zip กรุณาลองใหม่อีกครั้งใน 2 วินาที");
    return;
  }
  const zipLib = window.JSZip || JSZip;

  window.updateBackupProgress(10, "กำลังเริ่มสำรองข้อมูล ZIP...", "รวบรวมข้อมูลโครงสร้างระบบ (ไม่รวมรูปภาพ)", true, "bg-success");
  getGlobalToast()("⏳ กำลังเตรียมสร้างไฟล์ ZIP สำรองข้อมูล...");

  const now = new Date();
  const timestampStr = window.getThaiDateTimeFilenameString(now);

  const clonedEquipment = safeJsonClone(window.equipmentList);
  const clonedEmployees = safeJsonClone(window.employeeList);

  clonedEquipment.forEach(eq => {
    delete eq.imageBase64;
    delete eq.photoBase64;
  });
  clonedEmployees.forEach(emp => {
    delete emp.imageBase64;
    delete emp.photoBase64;
  });

  const backupData = {
    version: "2.0",
    appName: "Flora Garden Stock & Employee System",
    backupTimestamp: now.toISOString(),
    backupDateThai: now.toLocaleString('th-TH'),
    equipmentList: clonedEquipment,
    employeeList: clonedEmployees,
    orgStructure: (function(){
      try {
        if (typeof window.getFloraOrgTree === 'function') return window.getFloraOrgTree();
        if (localStorage.getItem('flora_org_tree_v2')) return JSON.parse(localStorage.getItem('flora_org_tree_v2'));
        if (localStorage.getItem('flora_org_tree_data')) return JSON.parse(localStorage.getItem('flora_org_tree_data'));
      } catch(e) {}
      return null;
    })(),
    deletedEmployees: safeJsonClone(window.deletedEmployees || []),
    transactionHistory: window.transactionHistory || [],
    attendanceLogs: window.attendanceLogs || [],
    auditLogs: window.auditLogs || [],
    categoriesList: window.categoriesList || [],
    departmentsList: getComprehensiveDepartmentsList(),
    positionsList: getComprehensivePositionsList(),
    locationsList: getComprehensiveLocationsList(),
    imagesBase64Map: {}
  };

  window.updateBackupProgress(50, "กำลังสร้างไฟล์ ZIP สำรองข้อมูล...", "รวมข้อมูลอุปกรณ์ บุคลากร ประวัติ หมวดหมู่ แผนก", true, "bg-success");

  const dataZip = new zipLib();
  dataZip.file("flora_garden_backup_data.json", JSON.stringify(backupData, null, 2));

  window.updateBackupProgress(85, "กำลังส่งออกไฟล์ .zip...", "เริ่มการดาวน์โหลด", true, "bg-success");

  const dataZipBlob = await dataZip.generateAsync({ type: "blob" });
  const dataUrl = URL.createObjectURL(dataZipBlob);

  const dataLink = document.createElement('a');
  dataLink.href = dataUrl;
  dataLink.download = `flora_garden_backup_data_${timestampStr}.zip`;
  document.body.appendChild(dataLink);
  dataLink.click();
  document.body.removeChild(dataLink);
  URL.revokeObjectURL(dataUrl);

  window.updateBackupProgress(100, "สำรองข้อมูล ZIP สำเร็จ 100%", "ดาวน์โหลดไฟล์ ZIP สำรองข้อมูล (เฉพาะข้อมูล) เรียบร้อยแล้ว", true, "bg-success");
  getGlobalToast()("🟢 ดาวน์โหลดไฟล์ ZIP สำรองข้อมูล (.zip) เรียบร้อยแล้ว!");
};

// 10. Download JSON Database Backup
window.downloadDatabaseBackup = async function() {
  try {
    window.updateBackupProgress(10, "กำลังเริ่มสำรองข้อมูล JSON...", "รวบรวมข้อมูลโครงสร้างระบบ (ไม่รวมรูปภาพ)", true, "bg-primary");
    const now = new Date();
    const timestampStr = window.getThaiDateTimeFilenameString(now);
    const thaiDateStr = now.toLocaleString('th-TH');

    getGlobalToast()("⏳ กำลังรวบรวมข้อมูลเข้าสู่ไฟล์ JSON...");

    const clonedEquipment = safeJsonClone(window.equipmentList);
    const clonedEmployees = safeJsonClone(window.employeeList);

    clonedEquipment.forEach(eq => {
      delete eq.imageBase64;
      delete eq.photoBase64;
    });
    clonedEmployees.forEach(emp => {
      delete emp.imageBase64;
      delete emp.photoBase64;
    });

    window.updateBackupProgress(70, "กำลังสร้างไฟล์ JSON สำรองข้อมูล...", "รวมข้อมูลอุปกรณ์ บุคลากร ประวัติ หมวดหมู่ แผนก", true, "bg-primary");

    const backupData = {
      version: "2.0",
      appName: "Flora Garden Stock & Employee System",
      backupTimestamp: now.toISOString(),
      backupDateThai: thaiDateStr,
      equipmentList: clonedEquipment,
      employeeList: clonedEmployees,
      orgStructure: (function(){
        try {
          if (typeof window.getFloraOrgTree === 'function') return window.getFloraOrgTree();
          if (localStorage.getItem('flora_org_tree_v2')) return JSON.parse(localStorage.getItem('flora_org_tree_v2'));
          if (localStorage.getItem('flora_org_tree_data')) return JSON.parse(localStorage.getItem('flora_org_tree_data'));
        } catch(e) {}
        return null;
      })(),
      deletedEmployees: safeJsonClone(window.deletedEmployees || []),
      transactionHistory: window.transactionHistory || [],
      attendanceLogs: window.attendanceLogs || [],
      auditLogs: window.auditLogs || [],
      categoriesList: window.categoriesList || [],
      departmentsList: getComprehensiveDepartmentsList(),
      positionsList: getComprehensivePositionsList(),
      locationsList: getComprehensiveLocationsList(),
      imagesBase64Map: {}
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    window.updateBackupProgress(90, "กำลังส่งออกไฟล์ .json...", "เริ่มการดาวน์โหลด", true, "bg-primary");

    const link = document.createElement('a');
    link.href = url;
    link.download = `flora_garden_backup_${timestampStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    window.updateBackupProgress(100, "สำรองข้อมูล JSON สำเร็จ 100%", "ดาวน์โหลดไฟล์สำรองข้อมูล JSON (เฉพาะข้อมูล) เรียบร้อยแล้ว", true, "bg-primary");
    getGlobalToast()("🟢 ดาวน์โหลดไฟล์สำรองข้อมูล (.json) เรียบร้อยแล้ว!");
  } catch (err) {
    console.error("Backup download error:", err);
    window.updateBackupProgress(0, "เกิดข้อผิดพลาดในการสำรองข้อมูล", err.message, true, "bg-danger");
    getGlobalToast()(`เกิดข้อผิดพลาดในการสร้างไฟล์สำรอง: ${err.message}`);
  }
};

// 11. Folder UI Display & Selection Helpers
window.updateFolderUIDisplay = function(folderName) {
  const subtextElem = document.getElementById('autoBackupFolderSubtext');
  const folderInput = document.getElementById('selectedFolderInput');

  if (!folderInput) return;

  const nameToUse = folderName || (window.localImageBackupDirectoryHandle ? window.localImageBackupDirectoryHandle.name : '') || window.localBackupFolderName || '';

  if (nameToUse) {
    folderInput.value = nameToUse;
    folderInput.classList.remove('text-muted', 'text-danger');
    folderInput.classList.add('text-success', 'fw-bold');
    if (subtextElem) {
      subtextElem.textContent = `โฟลเดอร์ที่จะบันทึก "${nameToUse}"`;
      subtextElem.className = "text-success fw-bold fs-9";
    }
  } else {
    folderInput.value = "";
    folderInput.classList.remove('text-success');
    if (subtextElem) {
      subtextElem.textContent = "ต้องเลือกโฟลเดอร์ก่อน";
      subtextElem.className = "text-danger fw-bold fs-9";
    }
  }
};

window.onManualFolderInput = function(val) {
  const trimmed = val ? val.trim() : '';
  window.localBackupFolderName = trimmed;
  const subtextElem = document.getElementById('autoBackupFolderSubtext');
  if (subtextElem) {
    if (trimmed) {
      subtextElem.textContent = `ระบุตำแหน่งโฟลเดอร์ "${trimmed}" เรียบร้อยแล้ว`;
      subtextElem.className = "text-success fw-bold fs-9";
    } else {
      subtextElem.textContent = "ต้องเลือกโฟลเดอร์ก่อน";
      subtextElem.className = "text-danger fw-bold fs-9";
    }
  }
};

window.handleFallbackFolderSelected = function(e) {
  const files = e.target.files;
  let folderName = '';

  if (files && files.length > 0) {
    const firstPath = files[0].webkitRelativePath || files[0].name || '';
    folderName = firstPath.split('/')[0] || firstPath.split('\\')[0] || '';
  }

  if (!folderName && e.target && e.target.value) {
    folderName = e.target.value.replace(/^.*[\\\/]/, '');
  }

  if (!folderName) {
    folderName = 'Selected Folder';
  }

  window.localFolderFilesList = files ? Array.from(files) : [];
  window.localBackupFolderName = folderName;

  const folderInput = document.getElementById('selectedFolderInput');
  if (folderInput) {
    folderInput.value = folderName;
    folderInput.classList.remove('text-muted');
    folderInput.classList.add('text-success', 'fw-bold');
  }

  window.updateFolderUIDisplay(folderName);
  getGlobalToast()(`📁 เลือกโฟลเดอร์ "${folderName}" เรียบร้อยแล้ว!`);
};

window.refreshFolderUIDisplay = async function() {
  const name = (window.localImageBackupDirectoryHandle && window.localImageBackupDirectoryHandle.name)
    ? window.localImageBackupDirectoryHandle.name
    : (window.localBackupFolderName || '');
  window.updateFolderUIDisplay(name);
};

window.connectLocalFolderForImageBackup = async function() {
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      if (handle) {
        window.localImageBackupDirectoryHandle = handle;
        window.localBackupFolderName = handle.name;

        const folderInput = document.getElementById('selectedFolderInput');
        if (folderInput) {
          folderInput.value = handle.name;
          folderInput.classList.remove('text-muted');
          folderInput.classList.add('text-success', 'fw-bold');
        }

        window.updateFolderUIDisplay(handle.name);
        getGlobalToast()(`📁 เชื่อมต่อโฟลเดอร์ "${handle.name}" สำหรับสำรองรูปภาพเรียบร้อยแล้ว!`);
        return;
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn("showDirectoryPicker unable to open in current frame:", err);
    }
  }

  const folderInput = document.getElementById('selectedFolderInput');
  const currentVal = window.localBackupFolderName || '';

  const userTypedFolder = prompt(
    "📁 ระบุชื่อ Drive หรือ โฟลเดอร์สำหรับสำรองรูปภาพบนเครื่องของคุณ\n(เช่น D:\\ImageBackup หรือ Photos_Backup):",
    currentVal
  );

  if (userTypedFolder !== null) {
    const trimmed = userTypedFolder.trim();
    if (trimmed) {
      window.localBackupFolderName = trimmed;
      window.updateFolderUIDisplay(trimmed);
      getGlobalToast()(`📁 กำหนดตำแหน่งโฟลเดอร์สำรองข้อมูล "${trimmed}" เรียบร้อยแล้ว!`);
    } else {
      window.localBackupFolderName = '';
      window.updateFolderUIDisplay('');
    }
  } else {
    if (!window.localBackupFolderName && !window.localImageBackupDirectoryHandle) {
      window.updateFolderUIDisplay('');
    }
  }
};

// 12. Auto Image Backup
window.startAutoImageBackup = async function() {
  try {
    let handle = window.localImageBackupDirectoryHandle;
    let folderName = window.localBackupFolderName;

    if (handle) {
      try {
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          perm = await handle.requestPermission({ mode: 'readwrite' });
        }
        if (perm !== 'granted') {
          handle = null;
          window.localImageBackupDirectoryHandle = null;
        }
      } catch (e) {
        handle = null;
        window.localImageBackupDirectoryHandle = null;
      }
    }

    if (!handle && !folderName) {
      alert("⚠️ ยังไม่ได้เลือกโฟลเดอร์บนเครื่อง\n\nกรุณากดปุ่ม 'เลือกโฟลเดอร์บนเครื่อง' ก่อนเริ่มการสำรองรูปภาพอัตโนมัติ");
      window.updateFolderUIDisplay('');
      if (typeof window.connectLocalFolderForImageBackup === 'function') {
        await window.connectLocalFolderForImageBackup();
      }

      handle = window.localImageBackupDirectoryHandle;
      folderName = window.localBackupFolderName;
      if (!handle && !folderName) {
        return;
      }
    }
    window.updateBackupProgress(10, "กำลังเชื่อมต่อกับ Server สำรองข้อมูล...", "เริ่มต้นการตรวจสอบและสำรองรูปภาพอัตโนมัติ...", true, "bg-purple");
    getGlobalToast()("⏳ กำลังสำรองรูปภาพอัตโนมัติ...");

    let prog = 15;
    const progInterval = setInterval(() => {
      if (prog < 80) {
        prog += 10;
        window.updateBackupProgress(prog, "กำลังเปรียบเทียบขนาดไฟล์และวันที่แก้ไข...", "ตรวจสอบไฟล์ใหม่/ไฟล์เดิม...", true, "bg-purple");
      }
    }, 500);

    let resp = null;
    try {
      resp = await fetch('/api/auto-backup-images', { method: 'POST' });
    } finally {
      clearInterval(progInterval);
    }

    if (!resp || !resp.ok) {
      const errJson = await resp.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const serverSummary = data.summary || { total: 0, added: 0, updated: 0, unchanged: 0 };
    let displaySummary = { ...serverSummary };

    if (data.diskWarning || data.stoppedDueToDisk) {
      const freeMB = data.freeDiskMB !== undefined ? `${data.freeDiskMB} MB` : 'น้อยกว่า 500 MB';
      const warnMsg = `⚠️ คำเตือน: พื้นที่ดิสก์ของ Container เหลือน้อย (${freeMB})\nระบบได้ปฏิเสธ/หยุดการดาวน์โหลดสำรองรูปภาพเพิ่มเติมเพื่อป้องกันระบบขัดข้อง`;
      getGlobalToast()(warnMsg);
    }

    if (window.localImageBackupDirectoryHandle) {
      try {
        window.updateBackupProgress(85, "กำลังซิงค์ไฟล์ลงโฟลเดอร์บนเครื่องคอมพิวเตอร์ของคุณ...", "คัดลอกไฟล์ลงโฟลเดอร์ PC...", true, "bg-purple");
        const handle = window.localImageBackupDirectoryHandle;
        if (await handle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
          await handle.requestPermission({ mode: 'readwrite' });
        }

        const indexObj = data.index || {};
        const pcSummary = { total: Object.keys(indexObj).length, added: 0, updated: 0, unchanged: 0 };

        for (const relPath of Object.keys(indexObj)) {
          try {
            const itemInfo = indexObj[relPath] || {};
            const expectedSize = itemInfo.size || 0;

            const parts = relPath.split('/');
            let currentDir = handle;
            for (let i = 0; i < parts.length - 1; i++) {
              currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true });
            }
            const fileName = parts[parts.length - 1];

            let existingSize = -1;
            try {
              const existingHandle = await currentDir.getFileHandle(fileName, { create: false });
              const existingFile = await existingHandle.getFile();
              existingSize = existingFile.size;
            } catch (e) {}

            if (existingSize > 0 && expectedSize > 0 && existingSize === expectedSize) {
              console.log(`[PC Sync] Skip "${relPath}" - file exists with equal size (${existingSize} bytes)`);
              pcSummary.unchanged++;
              continue;
            }

            const fetchUrl = `/api/backup-image-file?path=${encodeURIComponent(relPath)}`;
            const imgResp = await fetch(fetchUrl);
            if (!imgResp.ok) {
              pcSummary.unchanged++;
              continue;
            }

            const blob = await imgResp.blob();
            if (!blob || blob.size === 0) {
              pcSummary.unchanged++;
              continue;
            }

            if (existingSize > 0 && existingSize === blob.size) {
              console.log(`[PC Sync] Skip "${relPath}" - file exists with equal blob size (${existingSize} bytes)`);
              pcSummary.unchanged++;
              continue;
            }

            const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();

            if (existingSize > 0) {
              pcSummary.updated++;
            } else {
              pcSummary.added++;
            }
          } catch (subErr) {
            console.warn(`Local file sync warning (${relPath}):`, subErr);
          }
        }
        displaySummary = pcSummary;
      } catch (pcSyncErr) {
        console.warn("PC Local sync warning:", pcSyncErr);
      }
    }

    window.updateBackupProgress(100, "สำรองรูปภาพอัตโนมัติสำเร็จ 100%", `ประมวลผลรูปภาพทั้งหมด ${displaySummary.total} รายการเรียบร้อยแล้ว`, true, "bg-success");
    getGlobalToast()("🎉 สำรองรูปภาพอัตโนมัติสำเร็จ!");

    const logCard = document.getElementById('autoImageSyncLogCard');
    if (logCard) {
      logCard.classList.remove('d-none');
      logCard.innerHTML = `
        <div class="alert alert-success border-0 shadow-2xs rounded-3 mb-0 p-3 bg-success bg-opacity-10 text-dark">
          <div class="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom border-success border-opacity-25">
            <span class="fw-bold text-success fs-7"><i class="bi bi-check-circle-fill me-1.5"></i> ผลการสำรองรูปภาพอัตโนมัติ</span>
            <span class="badge bg-success rounded-pill px-2.5 py-1 fs-8 fw-bold">เสร็จสมบูรณ์</span>
          </div>
          <div class="row g-2 text-center my-2">
            <div class="col-3">
              <div class="bg-white p-2 rounded-3 border">
                <div class="text-muted fs-9 mb-0.5">รวมทั้งหมด</div>
                <div class="fw-bold text-dark fs-6">${displaySummary.total} รูป</div>
              </div>
            </div>
            <div class="col-3">
              <div class="bg-white p-2 rounded-3 border">
                <div class="text-muted fs-9 mb-0.5">เพิ่มไฟล์ใหม่</div>
                <div class="fw-bold text-success fs-6">+${displaySummary.added}</div>
              </div>
            </div>
            <div class="col-3">
              <div class="bg-white p-2 rounded-3 border">
                <div class="text-muted fs-9 mb-0.5">เขียนทับ/แก้ไข</div>
                <div class="fw-bold text-warning fs-6">✏️ ${displaySummary.updated}</div>
              </div>
            </div>
            <div class="col-3">
              <div class="bg-white p-2 rounded-3 border">
                <div class="text-muted fs-9 mb-0.5">ข้าม (ขนาดเท่ากัน)</div>
                <div class="fw-bold text-secondary fs-6">⚡ ${displaySummary.unchanged}</div>
              </div>
            </div>
          </div>
          <div class="fs-8 text-muted d-flex align-items-center justify-content-between mt-2 pt-1 border-top">
            <span><i class="bi bi-shield-check text-success me-1"></i> เปรียบเทียบขนาดไฟล์: มีไฟล์เดิมและขนาดเท่ากันจะ<b>ข้าม (Skip)</b> ไม่ดาวน์โหลดและไม่เขียนทับ</span>
            <span class="fw-semibold text-dark"><i class="bi bi-clock-history me-1"></i> ${new Date().toLocaleTimeString('th-TH')}</span>
          </div>
        </div>
      `;
    }

    alert(`🎉 สำเร็จ! ระบบได้ทำการสำรองรูปภาพอัตโนมัติเรียบร้อยแล้ว\n\n(เปรียบเทียบขนาดไฟล์: หากมีไฟล์อยู่แล้วและขนาดเท่ากันพอดี ระบบจะข้ามการดาวน์โหลดและไม่เขียนทับไฟล์เดิม)\n\n• จำนวนรูปภาพทั้งหมด: ${displaySummary.total} รูป\n• เพิ่มไฟล์ใหม่: ${displaySummary.added} รูป\n• เขียนทับ/แก้ไข: ${displaySummary.updated} รูป\n• ข้าม (มีไฟล์เดิมและขนาดเท่ากัน): ${displaySummary.unchanged} รูป`);
  } catch (err) {
    console.error("Auto image backup error:", err);
    window.updateBackupProgress(0, "เกิดข้อผิดพลาดในการสำรองรูปภาพ", err.message, true, "bg-danger");
    getGlobalToast()("❌ เกิดข้อผิดพลาดในการสำรองรูปภาพ: " + err.message);
  }
};

// 13. Auto Image Restore
window.startAutoImageRestore = async function() {
  try {
    window.updateBackupProgress(10, "กำลังเชื่อมต่อเพื่อสแกนไฟล์ในโฟลเดอร์สำรองรูปภาพ...", "เริ่มต้นการกู้คืนรูปภาพอัตโนมัติ...", true, "bg-warning");
    getGlobalToast()("⏳ กำลังกู้คืนรูปภาพอัตโนมัติ...");

    let prog = 15;
    const progInterval = setInterval(() => {
      if (prog < 80) {
        prog += 10;
        window.updateBackupProgress(prog, "กำลังตรวจสอบและกู้คืนรูปภาพลงใน Firebase Storage...", "ประมวลผลการกู้คืนไฟล์ภาพ...", true, "bg-warning");
      }
    }, 500);

    let resp = null;
    try {
      resp = await fetch('/api/auto-restore-images', { method: 'POST' });
    } finally {
      clearInterval(progInterval);
    }

    if (!resp || !resp.ok) {
      const errJson = await resp.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const summary = data.summary || { total: 0, restored: 0, skipped: 0, errors: 0 };

    window.updateBackupProgress(100, "กู้คืนรูปภาพอัตโนมัติสำเร็จ 100%", `กู้คืนรูปภาพสำเร็จ ${summary.restored} รูปภาพ`, true, "bg-success");
    getGlobalToast()("🎉 กู้คืนรูปภาพอัตโนมัติสำเร็จ!");

    if (typeof window.loadFirebaseData === 'function') {
      window.loadFirebaseData();
    }

    const logCard = document.getElementById('autoImageSyncLogCard');
    if (logCard) {
      logCard.classList.remove('d-none');
      logCard.innerHTML = `
        <div class="alert alert-warning border-0 shadow-2xs rounded-3 mb-0 p-3 bg-warning bg-opacity-10 text-dark">
          <div class="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom border-warning border-opacity-25">
            <span class="fw-bold text-dark fs-7"><i class="bi bi-arrow-counterclockwise text-warning me-1.5"></i> ผลการกู้คืนรูปภาพอัตโนมัติ</span>
            <span class="badge bg-warning text-dark rounded-pill px-2.5 py-1 fs-8 fw-bold">เสร็จสมบูรณ์</span>
          </div>
          <div class="row g-2 text-center my-2">
            <div class="col-4">
              <div class="bg-white p-2 rounded-3 border">
                <div class="text-muted fs-9 mb-0.5">ไฟล์ในโฟลเดอร์สำรอง</div>
                <div class="fw-bold text-dark fs-6">${summary.total} รูป</div>
              </div>
            </div>
            <div class="col-4">
              <div class="bg-white p-2 rounded-3 border">
                <div class="text-muted fs-9 mb-0.5">กู้คืนเข้า Server</div>
                <div class="fw-bold text-success fs-6">✅ ${summary.restored} รูป</div>
              </div>
            </div>
            <div class="col-4">
              <div class="bg-white p-2 rounded-3 border">
                <div class="text-muted fs-9 mb-0.5">สมบูรณ์อยู่แล้ว (ข้าม)</div>
                <div class="fw-bold text-secondary fs-6">⚡ ${summary.skipped} รูป</div>
              </div>
            </div>
          </div>
          <div class="fs-8 text-muted d-flex align-items-center justify-content-between mt-2 pt-1 border-top">
            <span><i class="bi bi-check-all text-success me-1"></i> รูปภาพทั้งหมดถูกฟื้นฟูกลับเข้าสู่ระบบเรียบร้อยแล้ว</span>
            <span class="fw-semibold text-dark"><i class="bi bi-clock-history me-1"></i> ${new Date().toLocaleTimeString('th-TH')}</span>
          </div>
        </div>
      `;
    }

    alert(`🎉 สำเร็จ! ระบบได้กู้คืนรูปภาพทั้งหมดจากโฟลเดอร์สำรองเรียบร้อยแล้ว\n\n• จำนวนไฟล์ในโฟลเดอร์สำรอง: ${summary.total} รูป\n• กู้คืนเข้า Server สำเร็จ: ${summary.restored} รูป\n• สมบูรณ์อยู่แล้ว (ไม่ต้องอัปโหลดซ้ำ): ${summary.skipped} รูป`);
  } catch (err) {
    console.error("Auto image restore error:", err);
    window.updateBackupProgress(0, "เกิดข้อผิดพลาดในการกู้คืนรูปภาพ", err.message, true, "bg-danger");
    getGlobalToast()("❌ เกิดข้อผิดพลาดในการกู้คืนรูปภาพ: " + err.message);
  }
};

// 14. Handle Restore File Selected
window.handleRestoreFileSelected = async function(event) {
  const file = event.target.files ? event.target.files[0] : null;
  if (!file) return;

  const fileNameElem = document.getElementById('restoreFileName');
  if (fileNameElem) fileNameElem.textContent = file.name;

  if (file.name.toLowerCase().endsWith('.zip')) {
    const zipLib = window.JSZip || JSZip;
    if (typeof zipLib !== 'function') {
      alert("ไลบรารีอ่านไฟล์ ZIP ยังไม่พร้อมใช้งาน");
      return;
    }
    try {
      getGlobalToast()("⏳ กำลังคลี่ไฟล์และอ่านแพ็กเกจสำรอง (.zip)...");
      const zip = await zipLib.loadAsync(file);

      let jsonFile = zip.file("flora_garden_backup_data.json");
      if (!jsonFile) {
        const jsonNames = Object.keys(zip.files).filter(k => k.endsWith('.json'));
        if (jsonNames.length > 0) jsonFile = zip.file(jsonNames[0]);
      }

      if (!jsonFile) {
        alert("⚠️ ไม่พบไฟล์ข้อมูลสำรอง JSON ในไฟล์ ZIP ที่เลือก");
        return;
      }

      const jsonStr = await jsonFile.async("string");
      const parsed = JSON.parse(jsonStr);

      if (!parsed.imagesBase64Map) parsed.imagesBase64Map = {};

      const allKeys = Object.keys(zip.files);
      const imageKeys = allKeys.filter(k => {
        if (zip.files[k].dir) return false;
        const kLower = k.toLowerCase();
        return kLower.endsWith('.jpg') || kLower.endsWith('.jpeg') || kLower.endsWith('.png') || kLower.endsWith('.webp') || kLower.endsWith('.gif') || kLower.endsWith('.bmp');
      });

      if (imageKeys.length > 0) {
        getGlobalToast()(`⏳ กำลังถอดรหัสรูปภาพออกจากแพ็กเกจ ZIP (${imageKeys.length} รูป)...`);
      }

      for (const imgKey of imageKeys) {
        try {
          const fileNameOnly = imgKey.split(/[/\\]/).pop();
          if (!fileNameOnly) continue;

          const imgBlob = await zip.files[imgKey].async("blob");
          const b64 = await window.blobToBase64(imgBlob);
          if (b64) {
            parsed.imagesBase64Map[fileNameOnly] = b64;
            parsed.imagesBase64Map[fileNameOnly.toLowerCase()] = b64;

            const nameNoExt = fileNameOnly.substring(0, fileNameOnly.lastIndexOf('.'));
            if (nameNoExt) {
              parsed.imagesBase64Map[nameNoExt] = b64;
              parsed.imagesBase64Map[nameNoExt.toLowerCase()] = b64;
            }
          }
        } catch (imgErr) {
          console.warn("Notice: Extract image from zip error:", imgKey, imgErr);
        }
      }

      tempParsedRestoreData = parsed;
      window.displayRestoreSummary(parsed, file.name);
    } catch (err) {
      alert("⚠️ เกิดข้อผิดพลาดในการอ่านไฟล์ ZIP: " + err.message);
    }
  } else {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || (typeof parsed !== 'object') || (!parsed.equipmentList && !parsed.employeeList && !parsed.transactionHistory)) {
          alert("⚠️ ไฟล์ที่เลือกไม่ใช่ไฟล์สำรองข้อมูลที่ถูกต้องของระบบ");
          return;
        }
        tempParsedRestoreData = parsed;
        window.displayRestoreSummary(parsed, file.name);
      } catch (err) {
        alert("⚠️ ไม่สามารถอ่านไฟล์สำรองได้ รูปแบบไฟล์ JSON ไม่ถูกต้อง: " + err.message);
      }
    };
    reader.readAsText(file);
  }
};

// 15. Init Backup Drop Zone
window.initBackupDropZone = function() {
  const dropZone = document.getElementById('backupDropZone');
  const fileInput = document.getElementById('restoreFileInput');
  if (!dropZone || !fileInput) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('bg-primary', 'bg-opacity-10', 'border-success');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('bg-primary', 'bg-opacity-10', 'border-success');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt ? dt.files : null;
    if (files && files.length > 0) {
      try {
        fileInput.files = files;
      } catch (fileErr) {}
      window.handleRestoreFileSelected({ target: { files: files } });
    }
  }, false);
};

// 16. Display Restore Summary
window.displayRestoreSummary = function(parsed, fileName) {
  const nameSpan = document.getElementById('restoreFileName');
  if (nameSpan && fileName) {
    nameSpan.textContent = fileName;
  }

  const detailsBox = document.getElementById('restoreSummaryDetails');
  if (detailsBox) {
    const eqC = (parsed.equipmentList || []).length;
    const empC = (parsed.employeeList || []).length;
    const txC = (parsed.transactionHistory || []).length;
    const attC = (parsed.attendanceLogs || []).length;
    const audC = (parsed.auditLogs || []).length;
    const catC = (parsed.categoriesList || []).length;

    // Deduplicate and count unique departments accurately directly from parsed.departmentsList
    const deptSet = new Set();
    const cleanDepts = [];
    const addPreviewDept = (d) => {
      if (!d) return;
      const name = (typeof d === 'object' ? (d.name || d.id || '') : String(d)).trim();
      if (name && !deptSet.has(name.toLowerCase())) {
        deptSet.add(name.toLowerCase());
        cleanDepts.push(name);
      }
    };
    if (Array.isArray(parsed.departmentsList)) {
      parsed.departmentsList.forEach(addPreviewDept);
    } else if (Array.isArray(parsed.employeeList)) {
      parsed.employeeList.forEach(e => {
        if (e && e.department) addPreviewDept(e.department);
      });
    }
    const depC = cleanDepts.length;

    const locSet = new Set();
    const cleanLocs = [];
    const addPreviewLoc = (l) => {
      if (!l) return;
      const name = (typeof l === 'object' ? (l.name || l.id || '') : String(l)).trim();
      if (name && !locSet.has(name.toLowerCase())) {
        locSet.add(name.toLowerCase());
        cleanLocs.push(name);
      }
    };
    if (Array.isArray(parsed.locationsList)) {
      parsed.locationsList.forEach(addPreviewLoc);
    } else if (Array.isArray(parsed.equipmentList)) {
      parsed.equipmentList.forEach(eq => {
        if (eq && eq.location) addPreviewLoc(eq.location);
      });
    }
    const locC = cleanLocs.length;

    const posSet = new Set();
    const cleanPositions = [];
    const addPreviewPos = (p) => {
      if (!p) return;
      const name = (typeof p === 'object' ? (p.name || p.id || '') : String(p)).trim();
      if (name && !posSet.has(name.toLowerCase())) {
        posSet.add(name.toLowerCase());
        cleanPositions.push(name);
      }
    };
    if (Array.isArray(parsed.positionsList)) {
      parsed.positionsList.forEach(addPreviewPos);
    } else if (Array.isArray(parsed.employeeList)) {
      parsed.employeeList.forEach(e => {
        if (e && e.position) addPreviewPos(e.position);
      });
    }
    const posC = cleanPositions.length;

    let imgC = 0;
    if (parsed.imagesBase64Map && Object.keys(parsed.imagesBase64Map).length > 0) {
      imgC = Object.keys(parsed.imagesBase64Map).length;
    } else {
      (parsed.equipmentList || []).forEach(x => { if (x && x.imageUrl) imgC++; });
      (parsed.employeeList || []).forEach(x => { if (x && x.photoUrl) imgC++; });
    }

    detailsBox.innerHTML = `
      <div class="col-6 col-md-4">• อุปกรณ์การเกษตร: <strong class="text-success">${eqC}</strong> รายการ</div>
      <div class="col-6 col-md-4">• รายชื่อบุคลากร: <strong class="text-primary">${empC}</strong> คน</div>
      <div class="col-6 col-md-4">• ประวัติเบิก/ยืม/คืน/รับเข้า: <strong class="text-warning">${txC}</strong> รายการ</div>
      <div class="col-6 col-md-4">• ประวัติเพิ่ม/แก้ไข/ลบ: <strong class="text-purple fw-bold">${audC}</strong> รายการ</div>
      <div class="col-6 col-md-4">• บันทึกเวลาเข้า-ออก: <strong class="text-info">${attC}</strong> รายการ</div>
      <div class="col-6 col-md-4">• หมวดหมู่อุปกรณ์: <strong class="text-secondary">${catC}</strong> หมวด</div>
      <div class="col-6 col-md-4">• แผนก / สวน: <strong class="text-dark">${depC}</strong> แผนก</div>
      <div class="col-6 col-md-4">• ตำแหน่งงาน: <strong class="text-success fw-bold">${posC}</strong> ตำแหน่ง</div>
      <div class="col-6 col-md-4">• สถานที่จัดเก็บ: <strong class="text-secondary">${locC}</strong> แห่ง</div>
      <div class="col-12 text-success fw-semibold mt-1"><i class="bi bi-check-circle-fill me-1"></i> ระบบจะกู้คืนข้อมูลพร้อมตรวจสอบความถูกต้องของแผนกและตำแหน่งอัตโนมัติ</div>
    `;
  }

  const previewCard = document.getElementById('restorePreviewCard');
  if (previewCard) {
    previewCard.classList.remove('d-none', 'bg-success', 'border-success');
    previewCard.classList.add('bg-warning', 'bg-opacity-10', 'border-warning');
  }

  const fileStatus = document.getElementById('restoreFileStatus');
  if (fileStatus) {
    fileStatus.className = "badge bg-info text-dark px-3 py-1 fs-7 fw-bold";
    fileStatus.innerHTML = '<i class="bi bi-file-earmark-check me-1"></i>พร้อมกู้คืนข้อมูล';
  }

  const btnRestore = document.getElementById('btnExecuteRestore');
  if (btnRestore) {
    btnRestore.classList.remove('d-none');
    btnRestore.disabled = false;
    btnRestore.className = "btn btn-danger btn-lg rounded-pill px-4 py-2.5 fw-bold shadow-sm";
    btnRestore.innerHTML = '<i class="bi bi-arrow-counterclockwise me-1.5"></i> เริ่มต้นกู้คืนข้อมูล (Restore Database)';
  }
};

// 17. Execute Restore Database
window.executeRestoreDatabase = async function() {
  if (!tempParsedRestoreData) {
    alert("กรุณาเลือกไฟล์สำรองข้อมูลก่อน");
    return;
  }

  const modeElem = document.querySelector('input[name="restoreMode"]:checked');
  const mode = modeElem ? modeElem.value : 'REPLACE';

  try {
    const progressElem = document.getElementById('backupProgressContainer');
    if (progressElem) {
      progressElem.classList.remove('d-none');
      progressElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    window.updateBackupProgress(10, "กำลังเริ่มฟื้นฟูข้อมูล...", "อ่านและปรับแต่งโครงสร้างข้อมูลพร้อมตรวจสอบความถูกต้องของแผนก", true, "bg-warning");

    let equipmentList = window.equipmentList || [];
    let employeeList = window.employeeList || [];
    let deletedEmployees = window.deletedEmployees || [];
    let transactionHistory = window.transactionHistory || [];
    let attendanceLogs = window.attendanceLogs || [];
    let auditLogs = window.auditLogs || [];
    let categoriesList = window.categoriesList || [];
    let departmentsList = window.departmentsList || [];
    let positionsList = window.positionsList || [];
    let locationsList = window.locationsList || [];

    // Extract strictly unique departments from backup file (must equal departmentsList in .json)
    const seenRestoredDept = new Set();
    const restoredDepts = [];
    const addRestoredDept = (d) => {
      if (!d) return;
      const name = (typeof d === 'object' ? (d.name || d.id || '') : String(d)).trim();
      if (name && !seenRestoredDept.has(name.toLowerCase())) {
        seenRestoredDept.add(name.toLowerCase());
        restoredDepts.push(name);
      }
    };
    if (Array.isArray(tempParsedRestoreData.departmentsList)) {
      tempParsedRestoreData.departmentsList.forEach(addRestoredDept);
    } else if (Array.isArray(tempParsedRestoreData.employeeList)) {
      tempParsedRestoreData.employeeList.forEach(emp => {
        if (emp && emp.department) addRestoredDept(emp.department);
      });
    }

    const seenRestoredPos = new Set();
    const restoredPositions = [];
    const addRestoredPos = (p) => {
      if (!p) return;
      const name = (typeof p === 'object' ? (p.name || p.id || '') : String(p)).trim();
      if (name && !seenRestoredPos.has(name.toLowerCase())) {
        seenRestoredPos.add(name.toLowerCase());
        if (typeof p === 'object' && p.name) {
          restoredPositions.push(p);
        } else {
          restoredPositions.push({ id: `POS-${String(restoredPositions.length + 1).padStart(3, '0')}`, code: `POS-${String(restoredPositions.length + 1).padStart(3, '0')}`, name: name, group: 'ตำแหน่งทั่วไป' });
        }
      }
    };
    if (Array.isArray(tempParsedRestoreData.positionsList)) {
      tempParsedRestoreData.positionsList.forEach(addRestoredPos);
    } else if (Array.isArray(tempParsedRestoreData.employeeList)) {
      tempParsedRestoreData.employeeList.forEach(emp => {
        if (emp && emp.position) addRestoredPos(emp.position);
      });
    }

    const seenRestoredLoc = new Set();
    const restoredLocs = [];
    const addRestoredLoc = (l) => {
      if (!l) return;
      const name = (typeof l === 'object' ? (l.name || l.id || '') : String(l)).trim();
      if (name && !seenRestoredLoc.has(name.toLowerCase())) {
        seenRestoredLoc.add(name.toLowerCase());
        restoredLocs.push(name);
      }
    };
    if (Array.isArray(tempParsedRestoreData.locationsList)) {
      tempParsedRestoreData.locationsList.forEach(addRestoredLoc);
    } else if (Array.isArray(tempParsedRestoreData.equipmentList)) {
      tempParsedRestoreData.equipmentList.forEach(eq => {
        if (eq && eq.location) addRestoredLoc(eq.location);
      });
    }

    if (mode === 'REPLACE') {
      equipmentList = (tempParsedRestoreData.equipmentList || []).map(item => ({ ...item }));
      employeeList = (tempParsedRestoreData.employeeList || []).map(emp => ({ ...emp }));
      deletedEmployees = (tempParsedRestoreData.deletedEmployees || []).map(emp => ({ ...emp }));
      transactionHistory = tempParsedRestoreData.transactionHistory || [];
      attendanceLogs = tempParsedRestoreData.attendanceLogs || [];
      auditLogs = tempParsedRestoreData.auditLogs || [];
      if (tempParsedRestoreData.categoriesList) categoriesList = tempParsedRestoreData.categoriesList;
      departmentsList = restoredDepts;
      positionsList = restoredPositions;
      locationsList = restoredLocs;
    } else {
      const newEquip = tempParsedRestoreData.equipmentList || [];
      newEquip.forEach(item => {
        const idx = equipmentList.findIndex(e => e.id === item.id || e.code === item.code);
        if (idx >= 0) {
          const merged = { ...equipmentList[idx], ...item };
          if (!item.imageUrl && equipmentList[idx].imageUrl) merged.imageUrl = equipmentList[idx].imageUrl;
          equipmentList[idx] = merged;
        } else {
          equipmentList.push({ ...item });
        }
      });

      const newEmp = tempParsedRestoreData.employeeList || [];
      newEmp.forEach(emp => {
        const idx = employeeList.findIndex(e => e.id === emp.id || e.code === emp.code);
        if (idx >= 0) {
          const merged = { ...employeeList[idx], ...emp };
          if (!emp.photoUrl && employeeList[idx].photoUrl) merged.photoUrl = employeeList[idx].photoUrl;
          employeeList[idx] = merged;
        } else {
          employeeList.push({ ...emp });
        }
      });
      const newDeleted = tempParsedRestoreData.deletedEmployees || [];
      newDeleted.forEach(emp => {
        const idx = deletedEmployees.findIndex(e => (e.originalId || e.id || e.code) === (emp.originalId || emp.id || emp.code));
        if (idx >= 0) deletedEmployees[idx] = { ...deletedEmployees[idx], ...emp };
        else deletedEmployees.push({ ...emp });
      });

      const newTxs = tempParsedRestoreData.transactionHistory || [];
      newTxs.forEach(tx => {
        if (!transactionHistory.some(x => x.id === tx.id)) {
          transactionHistory.push(tx);
        }
      });

      const newAtt = tempParsedRestoreData.attendanceLogs || [];
      newAtt.forEach(att => {
        if (!attendanceLogs.some(x => x.id === att.id)) {
          attendanceLogs.push(att);
        }
      });

      const newAud = tempParsedRestoreData.auditLogs || [];
      newAud.forEach(log => {
        if (!auditLogs.some(x => x.id === log.id)) {
          auditLogs.push(log);
        }
      });

      if (Array.isArray(tempParsedRestoreData.categoriesList)) {
        tempParsedRestoreData.categoriesList.forEach(c => {
          if (!categoriesList.some(x => x.name === c.name || x.id === c.id)) {
            categoriesList.push(c);
          }
        });
      }

      // Merge departments preventing duplicates
      const mergeDeptMap = new Map();
      const addMergeDept = (item) => {
        if (!item) return;
        const name = (typeof item === 'object' ? (item.name || item.id || '') : String(item)).trim();
        if (name && !mergeDeptMap.has(name.toLowerCase())) {
          mergeDeptMap.set(name.toLowerCase(), name);
        }
      };
      departmentsList.forEach(addMergeDept);
      restoredDepts.forEach(addMergeDept);
      departmentsList = Array.from(mergeDeptMap.values());

      const mergeLocMap = new Map();
      const addMergeLoc = (item) => {
        if (!item) return;
        const name = (typeof item === 'object' ? (item.name || item.id || '') : String(item)).trim();
        if (name && !mergeLocMap.has(name.toLowerCase())) {
          mergeLocMap.set(name.toLowerCase(), name);
        }
      };
      locationsList.forEach(addMergeLoc);
      restoredLocs.forEach(addMergeLoc);
      locationsList = Array.from(mergeLocMap.values());

      const mergePosMap = new Map();
      const addMergePos = (item) => {
        if (!item) return;
        const name = (typeof item === 'object' ? (item.name || item.id || '') : String(item)).trim();
        if (name && !mergePosMap.has(name.toLowerCase())) {
          if (typeof item === 'object' && item.name) {
            mergePosMap.set(name.toLowerCase(), item);
          } else {
            mergePosMap.set(name.toLowerCase(), { id: `POS-${String(mergePosMap.size + 1).padStart(3, '0')}`, code: `POS-${String(mergePosMap.size + 1).padStart(3, '0')}`, name: name, group: 'ตำแหน่งทั่วไป' });
          }
        }
      };
      positionsList.forEach(addMergePos);
      restoredPositions.forEach(addMergePos);
      positionsList = Array.from(mergePosMap.values());
    }

    equipmentList.forEach(item => {
      if (item && (item.minQuantity === undefined || item.minQuantity === null)) {
        item.minQuantity = 3;
      }
    });

    // Final deduplication pass for departments
    const finalDeptSet = new Set();
    const finalDepartmentsList = [];
    departmentsList.forEach(d => {
      const name = (typeof d === 'object' ? (d.name || d.id || '') : String(d)).trim();
      if (name && !finalDeptSet.has(name.toLowerCase())) {
        finalDeptSet.add(name.toLowerCase());
        finalDepartmentsList.push(name);
      }
    });
    departmentsList = finalDepartmentsList;

    window.equipmentList = equipmentList;
    window.employeeList = employeeList;
    window.deletedEmployees = deletedEmployees;
    window.transactionHistory = transactionHistory;
    window.attendanceLogs = attendanceLogs;
    window.auditLogs = auditLogs;
    window.categoriesList = categoriesList;
    window.departmentsList = departmentsList;
    window.positionsList = positionsList;
    window.locationsList = locationsList;

    window.updateBackupProgress(70, "กำลังบันทึกข้อมูลลงเครื่อง...", "บันทึกใน LocalStorage", true, "bg-warning");
    if (typeof window.saveToLocalStorage === 'function') {
      window.saveToLocalStorage();
    }
    try {
      localStorage.setItem('flora_departments', JSON.stringify(departmentsList));
      localStorage.setItem('flora_positions', JSON.stringify(positionsList));
      localStorage.setItem('flora_locations', JSON.stringify(locationsList));
    } catch(e) {}

    if (window.db && window.isFirebaseReady) {
      window.updateBackupProgress(90, "กำลังซิงค์ข้อมูลไปยัง Firebase Firestore...", "อัปเดต collections ทั้งหมดรวมถึงแผนกและสถานที่จัดเก็บ", true, "bg-warning");
      try {
        const eqDocs = (equipmentList || []).map((eq, i) => {
          const code = (eq.code || (eq.id && !eq.id.startsWith('eq-') ? eq.id : `EQ-${String(i + 1).padStart(3, '0')}`)).trim();
          return { ...eq, id: code, code: code };
        });
        const deptDocs = departmentsList.map((dName, i) => {
          const code = `DEP-${String(i + 1).padStart(3, '0')}`;
          return { id: code, code: code, name: dName };
        });
        const locDocs = locationsList.map((l, i) => {
          const lName = typeof l === 'object' ? (l.name || l.id) : String(l).trim();
          const code = `LOC-${String(i + 1).padStart(3, '0')}`;
          return { id: code, code: code, name: lName };
        });
        const posDocs = (positionsList || []).map((p, i) => {
          const pName = typeof p === 'object' ? (p.name || p.id) : String(p).trim();
          const code = p.code || (p.id && p.id.startsWith('POS-') ? p.id : `POS-${String(i + 1).padStart(3, '0')}`);
          return { ...p, id: code, code: code, name: pName };
        });
        const catDocs = (categoriesList || []).map((c, i) => {
          const code = c.code || (c.id && c.id.startsWith('CAT-') ? c.id : `CAT-${String(i + 1).padStart(3, '0')}`);
          return { ...c, id: code, code: code };
        });

        if (mode === 'REPLACE') {
          await replaceCollectionInFirestore("equipment", eqDocs);
          await replaceCollectionInFirestore("employees", employeeList);
          await replaceCollectionInFirestore("deleted_employees", deletedEmployees.map(emp => ({ ...emp, id: emp.originalId || emp.id || emp.code })));
          await replaceCollectionInFirestore("transactions", transactionHistory);
          await replaceCollectionInFirestore("attendance", attendanceLogs);
          await replaceCollectionInFirestore("categories", catDocs);
          await replaceCollectionInFirestore("audit_logs", auditLogs);
          await replaceCollectionInFirestore("departments", deptDocs);
          await replaceCollectionInFirestore("positions", posDocs);
          await replaceCollectionInFirestore("locations", locDocs);
        } else {
          for (const eq of eqDocs) {
            if (eq && eq.id) await setDoc(doc(window.db, "equipment", eq.id), eq);
          }
          for (const emp of employeeList) {
            if (emp && emp.id) await setDoc(doc(window.db, "employees", emp.id), emp);
          }
          for (const emp of deletedEmployees) {
            const deletedId = emp && (emp.originalId || emp.id || emp.code);
            if (deletedId) await setDoc(doc(window.db, "deleted_employees", deletedId), emp);
          }
          for (const tx of transactionHistory) {
            if (tx && tx.id) await setDoc(doc(window.db, "transactions", tx.id), tx);
          }
          for (const att of attendanceLogs) {
            if (att && att.id) await setDoc(doc(window.db, "attendance", att.id), att);
          }
          for (const cat of catDocs) {
            if (cat && cat.id) await setDoc(doc(window.db, "categories", cat.id), cat);
          }
          for (const dept of deptDocs) {
            if (dept && dept.id) await setDoc(doc(window.db, "departments", dept.id), dept);
          }
          for (const pos of posDocs) {
            if (pos && pos.id) await setDoc(doc(window.db, "positions", pos.id), pos);
          }
          for (const loc of locDocs) {
            if (loc && loc.id) await setDoc(doc(window.db, "locations", loc.id), loc);
          }
          for (const aud of (auditLogs || [])) {
            if (aud && aud.id) await setDoc(doc(window.db, "audit_logs", aud.id), aud);
          }
        }

        // Restore Org Structure Tree if present
        const restoredTree = tempParsedRestoreData.orgStructure || tempParsedRestoreData.org_structure || tempParsedRestoreData.tree;
        if (restoredTree) {
          try {
            await setDoc(doc(window.db, "org_structure", "main"), {
              format: "FLORA_ORG_TREE",
              version: 2,
              tree: restoredTree,
              updatedAt: new Date().toISOString()
            }, { merge: true });
            localStorage.setItem('flora_org_tree_v2', JSON.stringify(restoredTree));
            localStorage.setItem('flora_org_tree_data', JSON.stringify(restoredTree));
          } catch (treeErr) {
            console.warn("Restore org_structure notice:", treeErr);
          }
        }
      } catch (fsErr) {
        console.warn("Firestore sync during restore notice:", fsErr);
      }
    }

    const fileNameElem = document.getElementById('restoreFileName');
    const fileNameStr = fileNameElem ? fileNameElem.textContent : '';
    const isDriveRestore = (tempParsedRestoreData && tempParsedRestoreData.storageType === 'GOOGLE_DRIVE_UNCOMPRESSED') ||
                           fileNameStr.includes('Google Drive');
    const sourceLabel = isDriveRestore ? "กู้คืนข้อมูลจาก Google Drive" : "กู้คืนข้อมูลระบบ";

    const finalDurationMs = backupTimerElapsedMs || (backupTimerStartTime ? (Date.now() - backupTimerStartTime) : 0);
    const formattedTimer = window.formatBackupTimerDisplay(finalDurationMs);
    const totalSeconds = Math.max(0, Math.floor(finalDurationMs / 1000));
    const timeDetailStr = `ใช้เวลาประมวลผล: ${formattedTimer} (${totalSeconds} วินาที)`;

    // Explicitly freeze timer and mark complete
    window.stopBackupTimer(true);

    window.updateBackupProgress(
      100, 
      `${sourceLabel} สำเร็จ 100%`, 
      `ฟื้นฟูข้อมูลและลิงก์รูปภาพสมบูรณ์เรียบร้อยแล้ว (${timeDetailStr})`, 
      true, 
      "bg-success"
    );

    // Refresh application views & tables
    if (typeof window.renderCategoryDropdowns === 'function') window.renderCategoryDropdowns();
    if (typeof window.populateDepartmentDropdowns === 'function') window.populateDepartmentDropdowns();
    if (typeof window.populatePositionDropdowns === 'function') window.populatePositionDropdowns();
    if (typeof window.renderPositionsListModal === 'function') window.renderPositionsListModal();
    if (typeof window.populateEmployeeDropdowns === 'function') window.populateEmployeeDropdowns();
    if (typeof window.populateEquipmentDropdown === 'function') window.populateEquipmentDropdown();
    if (typeof window.populateQuickScanDropdown === 'function') window.populateQuickScanDropdown();

    if (typeof window.renderCatalogGrid === 'function') window.renderCatalogGrid();
    if (typeof window.renderStaffTable === 'function') window.renderStaffTable();
    if (typeof window.renderHistoryTable === 'function') window.renderHistoryTable();
    if (typeof window.renderEmployeeDirectory === 'function') window.renderEmployeeDirectory();
    if (typeof window.renderAttendanceTable === 'function') window.renderAttendanceTable();
    if (typeof window.updateStats === 'function') window.updateStats();

    // Refresh live stats cards inside the active Backup/Restore modal
    if (typeof window.refreshBackupModalLiveStats === 'function') {
      window.refreshBackupModalLiveStats();
    }

    // Update preview card to reflect completed status and processing duration
    const previewCard = document.getElementById('restorePreviewCard');
    if (previewCard) {
      previewCard.classList.remove('bg-warning', 'border-warning');
      previewCard.classList.add('bg-success', 'bg-opacity-10', 'border-success');
      const fileStatus = document.getElementById('restoreFileStatus');
      if (fileStatus) {
        fileStatus.className = "badge bg-success px-3 py-1.5 fs-7 fw-bold shadow-2xs";
        fileStatus.innerHTML = `<i class="bi bi-check2-circle me-1"></i>กู้คืนสำเร็จ 100%`;
      }
      const btnRestore = document.getElementById('btnExecuteRestore');
      if (btnRestore) {
        btnRestore.className = "btn btn-success btn-lg rounded-pill px-4 py-2.5 fw-bold shadow-sm";
        btnRestore.disabled = true;
        btnRestore.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i> ${sourceLabel} สำเร็จเรียบร้อย (${timeDetailStr})`;
      }
    }

    // Ensure progress container stays centered and visible
    if (progressElem) {
      progressElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    getGlobalToast()(`🎉 ${sourceLabel} สำเร็จเรียบร้อย! (${timeDetailStr})`);

    if (typeof window.showFeedbackPopup === 'function') {
      window.showFeedbackPopup(`${sourceLabel} สำเร็จ`, `ระบบได้ฟื้นฟูข้อมูลและรูปภาพทั้งหมดเรียบร้อยแล้ว\n⏱️ ${timeDetailStr}`);
    }
  } catch (err) {
    console.error("Restore execution error:", err);
    window.updateBackupProgress(0, "เกิดข้อผิดพลาดในการกู้คืนข้อมูล", err.message, true, "bg-danger");
    alert("เกิดข้อผิดพลาดขณะฟื้นฟูข้อมูล: " + err.message);
  }
};

// 18. Firebase Storage Image Upload Sync
window.uploadBase64OrUrlToFirebaseStorage = async function(imageUrl, folderName = "equipment_images", defaultName = "item.jpeg", forceReupload = false) {
  if (!imageUrl) return imageUrl;

  const currentBucket = (typeof window.firebaseConfig !== 'undefined' && window.firebaseConfig.storageBucket) ? window.firebaseConfig.storageBucket : "flora-gaden.firebasestorage.app";
  
  if (!forceReupload && typeof imageUrl === 'string' && imageUrl.includes(currentBucket) && !imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  if (window.isFirebaseReady && window.storage) {
    try {
      let rawBlob = null;
      if (typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
        const res = await fetch(imageUrl);
        rawBlob = await res.blob();
      } else {
        rawBlob = await window.fetchImageAsBlobOrBase64(imageUrl);
      }

      if (rawBlob) {
        const presetType = (folderName === 'employee_photos') ? 'EMPLOYEE' : 'EQUIPMENT';
        let targetBlob = rawBlob;
        let ext = 'webp';

        if (typeof window.autoOptimizeAndResizeImage === 'function') {
          const optRes = await window.autoOptimizeAndResizeImage(rawBlob, { presetType });
          if (optRes && optRes.blob) {
            targetBlob = optRes.blob;
            ext = optRes.extension || 'webp';
          }
        }

        const cleanName = defaultName ? defaultName.replace(/[^a-zA-Z0-9._-]/g, '_') : 'item';
        const baseName = cleanName.replace(/\.(jpeg|jpg|png|webp)$/i, '');
        const fileName = `${baseName}.${ext}`;

        const storageRef = ref(window.storage, `${folderName}/${fileName}`);
        const snapshot = await uploadBytes(storageRef, targetBlob);
        const downloadUrl = await getDownloadURL(snapshot.ref);
        console.log(`Uploaded optimized image to current Firebase Storage (${folderName}/${fileName}):`, downloadUrl);
        return downloadUrl;
      }
    } catch (err) {
      console.warn("Upload image to current Firebase Storage notice:", err);
    }
  }

  return imageUrl;
};

window.syncAllImagesToFirebaseStorage = async function() {
  if (!window.isFirebaseReady || !window.storage) {
    if (typeof getGlobalToast === 'function') getGlobalToast()("⚠️ Firebase Storage ยังไม่พร้อมใช้งาน");
    else alert("⚠️ Firebase Storage ยังไม่พร้อมใช้งาน");
    return;
  }

  const ok = typeof window.showConfirmDialog === 'function'
    ? await window.showConfirmDialog({
        title: "ซิงก์รูปภาพสู่ Storage",
        message: "ต้องการซิงก์และอัปโหลดรูปภาพทั้งหมด (อุปกรณ์และพนักงาน) สู่ Firebase Storage หรือไม่?",
        type: "primary",
        icon: "bi-cloud-arrow-up-fill",
        confirmText: "เริ่มซิงก์รูปภาพ"
      })
    : confirm("ต้องการซิงก์รูปภาพทั้งหมดหรือไม่?");

  if (!ok) {
    return;
  }

  getGlobalToast()("⏳ กำลังเริ่มประมวลผลและอัปโหลดรูปภาพทั้งหมดไปยัง Firebase Storage...");
  let equipUploaded = 0;
  let empUploaded = 0;

  try {
    const equipmentList = window.equipmentList || [];
    const employeeList = window.employeeList || [];

    for (let i = 0; i < equipmentList.length; i++) {
      const eq = equipmentList[i];
      if (eq && eq.imageUrl && !eq.imageUrl.includes('firebasestorage.googleapis.com')) {
        const safeCode = (eq.code || eq.id || `eq_${i}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const newUrl = await window.uploadBase64OrUrlToFirebaseStorage(eq.imageUrl, "equipment_images", `${safeCode}.jpeg`);
        if (newUrl && newUrl !== eq.imageUrl) {
          eq.imageUrl = newUrl;
          equipUploaded++;
          if (window.isFirebaseReady && window.db && eq.id) {
            try { await setDoc(doc(window.db, "equipment", eq.id), eq, { merge: true }); } catch (e) {}
          }
        }
      }
    }

    for (let i = 0; i < employeeList.length; i++) {
      const emp = employeeList[i];
      if (emp && emp.photoUrl && !emp.photoUrl.includes('firebasestorage.googleapis.com')) {
        const safeCode = (emp.code || emp.id || `emp_${i}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const newUrl = await window.uploadBase64OrUrlToFirebaseStorage(emp.photoUrl, "employee_photos", `${safeCode}.jpeg`);
        if (newUrl && newUrl !== emp.photoUrl) {
          emp.photoUrl = newUrl;
          empUploaded++;
          if (window.isFirebaseReady && window.db && emp.id) {
            try { await setDoc(doc(window.db, "employees", emp.id), emp, { merge: true }); } catch (e) {}
          }
        }
      }
    }

    if (typeof window.saveToLocalStorage === 'function') window.saveToLocalStorage();
    if (typeof window.renderCatalogGrid === 'function') window.renderCatalogGrid();
    if (typeof window.renderStaffTable === 'function') window.renderStaffTable();
    if (typeof window.renderEmployeeDirectory === 'function') window.renderEmployeeDirectory();

    const successMsg = `🎉 ซิงก์รูปภาพเข้า Firebase Storage เรียบร้อยแล้ว!\n\n• อัปโหลดรูปอุปกรณ์สำเร็จ: ${equipUploaded} รายการ\n• อัปโหลดรูปถ่ายพนักงานสำเร็จ: ${empUploaded} รายการ\n\nรูปภาพทั้งหมดเปลี่ยนไปใช้ URL จาก Firebase Storage ของโปรเจกต์ใหม่แล้วครับ`;
    alert(successMsg);
    getGlobalToast()("🎉 ซิงก์รูปภาพทั้งหมดเข้า Firebase Storage สำเร็จแล้ว!");
  } catch (err) {
    console.error("Sync images to Storage error:", err);
    alert("เกิดข้อผิดพลาดขณะอัปโหลดรูปภาพ: " + err.message);
  }
};

// ==================== 20. GOOGLE DRIVE BACKUP & RESTORE INTEGRATION ====================

// Safe fetch with auto token refresh on 401 Unauthorized
let isRefreshingDriveToken = false;

async function fetchWithDriveAuth(url, options = {}, retried = false) {
  let token = window.googleDriveAccessToken || localStorage.getItem('google_drive_access_token') || sessionStorage.getItem('google_drive_access_token') || options.accessToken;
  if (!token && typeof window.getGoogleDriveAccessToken === 'function') {
    token = await window.getGoogleDriveAccessToken(true);
  }
  if (!token) throw new Error("ไม่พบสิทธิ์เข้าถึง Google Drive");

  const headers = {
    ...(options.headers || {}),
    'Authorization': `Bearer ${token}`
  };

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && !retried && !isRefreshingDriveToken && typeof window.getGoogleDriveAccessToken === 'function') {
    console.warn("Google Drive Token expired (401), refreshing token...");
    isRefreshingDriveToken = true;
    try {
      const freshToken = await window.getGoogleDriveAccessToken(true, true);
      if (freshToken) {
        return await fetchWithDriveAuth(url, { ...options, accessToken: freshToken }, true);
      }
    } finally {
      isRefreshingDriveToken = false;
    }
  }
  return res;
}

// Find or create a folder in Google Drive
async function findOrCreateDriveFolder(accessToken, folderName, parentFolderId = null) {
  let query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`;
  const searchRes = await fetchWithDriveAuth(searchUrl, { accessToken });
  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder if not found
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentFolderId ? { parents: [parentFolderId] } : {})
  };

  const createRes = await fetchWithDriveAuth('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    accessToken,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });

  if (!createRes.ok) {
    const errJson = await createRes.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `สร้างโฟลเดอร์ "${folderName}" ใน Google Drive ไม่สำเร็จ (${createRes.status})`);
  }

  const created = await createRes.json();
  return created.id;
}

// List all files in a Google Drive folder and auto-clean any redundant duplicate files
async function listFilesInDriveFolder(accessToken, folderId) {
  const filesMap = new Map();
  const duplicateFilesToDelete = [];
  let pageToken = '';
  do {
    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,size,mimeType,createdTime,modifiedTime,webViewLink)&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetchWithDriveAuth(url, { accessToken });
    if (!res.ok) break;
    const data = await res.json();
    if (data.files && Array.isArray(data.files)) {
      data.files.forEach(f => {
        if (!f || !f.name) return;
        const key = f.name.toLowerCase().trim();
        if (!filesMap.has(key)) {
          filesMap.set(key, f);
        } else {
          // A duplicate file with the exact same name already exists in this Google Drive folder!
          const existing = filesMap.get(key);
          const fTime = new Date(f.modifiedTime || f.createdTime || 0).getTime();
          const exTime = new Date(existing.modifiedTime || existing.createdTime || 0).getTime();
          const fSize = parseInt(f.size || '0', 10);
          const exSize = parseInt(existing.size || '0', 10);

          // Keep the newest/largest file, mark older redundant file for immediate deletion
          if (fSize > 0 && exSize === 0) {
            duplicateFilesToDelete.push(existing.id);
            filesMap.set(key, f);
          } else if (fTime > exTime) {
            duplicateFilesToDelete.push(existing.id);
            filesMap.set(key, f);
          } else {
            duplicateFilesToDelete.push(f.id);
          }
        }
      });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  // Auto-purge redundant duplicate files found in this Google Drive folder
  if (duplicateFilesToDelete.length > 0) {
    for (const dupId of duplicateFilesToDelete) {
      deleteFileFromDrive(accessToken, dupId).catch(() => {});
    }
  }

  // Create combined map supporting both exact name and lowercase name lookups
  const finalMap = new Map();
  for (const [, f] of filesMap.entries()) {
    finalMap.set(f.name, f);
    finalMap.set(f.name.toLowerCase(), f);
  }
  return finalMap;
}

// Upload a single file (image or json) directly to Google Drive without zip
async function uploadFileToDrive(accessToken, { name, mimeType, blob, parentFolderId, existingFileId = null }) {
  const metadata = {
    name: name,
    mimeType: mimeType || blob.type || 'application/octet-stream',
    ...(!existingFileId && parentFolderId ? { parents: [parentFolderId] } : {})
  };

  const boundary = '-------FloraDriveUploadBoundary314159265';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelimiter = "\r\n--" + boundary + "--";

  const metaBlob = new Blob([delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n' + delimiter + `Content-Type: ${mimeType || blob.type || 'application/octet-stream'}\r\n\r\n`], { type: 'text/plain' });
  const endBlob = new Blob([closeDelimiter], { type: 'text/plain' });
  const multipartBlob = new Blob([metaBlob, blob, endBlob], { type: `multipart/related; boundary=${boundary}` });

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,size,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webViewLink`;

  const res = await fetchWithDriveAuth(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    accessToken,
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBlob
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let errMsg = `อัปโหลดไฟล์ "${name}" ขึ้น Google Drive ไม่สำเร็จ (${res.status})`;
    try {
      const errObj = JSON.parse(errText);
      if (errObj.error && errObj.error.message) errMsg = errObj.error.message;
    } catch(e) {}
    throw new Error(errMsg);
  }

  return await res.json();
}

// Download file contents from Google Drive
async function downloadFileFromDrive(accessToken, fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetchWithDriveAuth(url, { accessToken });
  if (!res.ok) {
    throw new Error(`ดาวน์โหลดไฟล์จาก Google Drive ไม่สำเร็จ (${res.status})`);
  }
  return await res.text();
}

// Helper: Delete a file from Google Drive (used to clean up obsolete duplicate extensions or duplicate files)
async function deleteFileFromDrive(accessToken, fileId) {
  try {
    await fetchWithDriveAuth(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      accessToken
    });
  } catch (e) {
    console.warn("Delete obsolete Drive file notice:", e);
  }
}

// Helper: Get Deduplicated Canonical Image List for Backup & Drive Sync
async function getCanonicalImageSyncList() {
  let rawStorageFiles = [];
  try {
    const listResp = await fetch('/api/list-storage-files');
    if (listResp.ok) {
      const listData = await listResp.json();
      if (listData.items && Array.isArray(listData.items)) {
        rawStorageFiles = listData.items;
      } else if (listData.files && Array.isArray(listData.files)) {
        rawStorageFiles = listData.files;
      }
    }
  } catch (e) {
    console.warn("Storage list fetch notice:", e);
  }

  const eqList = window.equipmentList || [];
  const empList = window.employeeList || [];
  const finalImageMap = new Map(); // key: 'equipment/eq-001' -> canonical item

  function extractStoragePathFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    if (url.includes('/o/')) {
      const match = url.match(/\/o\/([^?]+)/);
      if (match && match[1]) {
        try {
          return decodeURIComponent(match[1]);
        } catch (e) {
          return match[1];
        }
      }
    }
    return null;
  }

  const storageByExactName = new Map();
  const storageByBaseCode = new Map();

  rawStorageFiles.forEach(item => {
    if (!item || !item.name) return;
    storageByExactName.set(item.name, item);

    const parts = item.name.split('/');
    let rawFolder = (parts[0] || '').toLowerCase();
    // Normalize folder names
    let folder = 'equipment';
    if (rawFolder.includes('emp') || rawFolder.includes('staff')) {
      folder = 'employees';
    }

    const rawFileName = parts.slice(1).join('/') || parts[0];
    const dotIdx = rawFileName.lastIndexOf('.');
    let baseCode = dotIdx > 0 ? rawFileName.substring(0, dotIdx) : rawFileName;
    // Strip timestamp prefix if formatted as timestamp_code
    if (/^\d{9,13}_/.test(baseCode)) {
      baseCode = baseCode.replace(/^\d{9,13}_/, '');
    }
    const cleanKey = `${folder}/${baseCode}`.toLowerCase();

    if (!storageByBaseCode.has(cleanKey)) {
      storageByBaseCode.set(cleanKey, []);
    }
    storageByBaseCode.get(cleanKey).push(item);
  });

  // A. Deduplicate Equipment Images (Strictly 1 canonical image per equipment)
  eqList.forEach((eq, idx) => {
    const code = (eq.code || eq.id || `eq_${idx + 1}`).trim();
    const safeCode = code.replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = `equipment/${safeCode}`.toLowerCase();
    const url = eq.imageUrl || eq.photoUrl || eq.image || eq.photo || eq.imageBase64 || eq.photoBase64;
    if (!url) return;

    // Check exact storage match from URL
    const storagePath = extractStoragePathFromUrl(url);
    if (storagePath && storageByExactName.has(storagePath)) {
      const matched = storageByExactName.get(storagePath);
      finalImageMap.set(key, {
        ...matched,
        canonicalFileName: `${safeCode}.${(matched.name.split('.').pop() || 'jpg').toLowerCase()}`
      });
      return;
    }

    // Check base code match in storage (prefer webp > png > jpg, or newest)
    const matches = storageByBaseCode.get(key) || [];
    if (matches.length > 0) {
      matches.sort((a, b) => {
        const extA = (a.name.split('.').pop() || '').toLowerCase();
        const extB = (b.name.split('.').pop() || '').toLowerCase();
        if (extA === 'webp' && extB !== 'webp') return -1;
        if (extB === 'webp' && extA !== 'webp') return 1;
        return (new Date(b.updated || 0).getTime()) - (new Date(a.updated || 0).getTime());
      });
      const chosen = matches[0];
      finalImageMap.set(key, {
        ...chosen,
        canonicalFileName: `${safeCode}.${(chosen.name.split('.').pop() || 'jpg').toLowerCase()}`
      });
      return;
    }

    // Fallback: Use image url with matching extension (no duplicates)
    let ext = 'jpg';
    if (url.startsWith('data:image/webp') || url.includes('.webp')) ext = 'webp';
    else if (url.startsWith('data:image/png') || url.includes('.png')) ext = 'png';
    else if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg') || url.includes('.jpg') || url.includes('.jpeg')) ext = 'jpg';

    finalImageMap.set(key, {
      name: `equipment/${safeCode}.${ext}`,
      canonicalFileName: `${safeCode}.${ext}`,
      downloadUrl: url,
      size: 0,
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`
    });
  });

  // B. Deduplicate Employee Images (Strictly 1 canonical image per employee)
  empList.forEach((emp, idx) => {
    const code = (emp.code || emp.id || `emp_${idx + 1}`).trim();
    const safeCode = code.replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = `employees/${safeCode}`.toLowerCase();
    const url = emp.photoURL || emp.photoUrl || emp.photo || emp.image || emp.imageUrl || emp.photoBase64 || emp.imageBase64;
    if (!url) return;

    const storagePath = extractStoragePathFromUrl(url);
    if (storagePath && storageByExactName.has(storagePath)) {
      const matched = storageByExactName.get(storagePath);
      finalImageMap.set(key, {
        ...matched,
        canonicalFileName: `${safeCode}.${(matched.name.split('.').pop() || 'jpg').toLowerCase()}`
      });
      return;
    }

    const matches = storageByBaseCode.get(key) || [];
    if (matches.length > 0) {
      matches.sort((a, b) => {
        const extA = (a.name.split('.').pop() || '').toLowerCase();
        const extB = (b.name.split('.').pop() || '').toLowerCase();
        if (extA === 'webp' && extB !== 'webp') return -1;
        if (extB === 'webp' && extA !== 'webp') return 1;
        return (new Date(b.updated || 0).getTime()) - (new Date(a.updated || 0).getTime());
      });
      const chosen = matches[0];
      finalImageMap.set(key, {
        ...chosen,
        canonicalFileName: `${safeCode}.${(chosen.name.split('.').pop() || 'jpg').toLowerCase()}`
      });
      return;
    }

    let ext = 'jpg';
    if (url.startsWith('data:image/webp') || url.includes('.webp')) ext = 'webp';
    else if (url.startsWith('data:image/png') || url.includes('.png')) ext = 'png';
    else if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg') || url.includes('.jpg') || url.includes('.jpeg')) ext = 'jpg';

    finalImageMap.set(key, {
      name: `employees/${safeCode}.${ext}`,
      canonicalFileName: `${safeCode}.${ext}`,
      downloadUrl: url,
      size: 0,
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`
    });
  });

  // C. Guarantee strictly one unique output file per destination path
  const deduplicatedItems = [];
  const seenDestinationKeys = new Set();

  for (const item of finalImageMap.values()) {
    const parts = item.name.split('/');
    let targetFolder = 'equipment';
    if (parts[0].toLowerCase().includes('emp') || parts[0].toLowerCase().includes('staff')) {
      targetFolder = 'employees';
    }
    const finalName = item.canonicalFileName || parts.slice(1).join('_') || parts[0];
    const safeDestKey = `${targetFolder}/${finalName.toLowerCase()}`;

    if (!seenDestinationKeys.has(safeDestKey)) {
      seenDestinationKeys.add(safeDestKey);
      deduplicatedItems.push(item);
    }
  }

  return deduplicatedItems;
}

// Helper to fetch actual image binary as Blob (using local backup endpoint or server proxy)
async function fetchDriveImageBlob(item) {
  // Try 0: Base64 data URI directly
  if (item.downloadUrl && typeof item.downloadUrl === 'string' && item.downloadUrl.startsWith('data:image/')) {
    try {
      const parts = item.downloadUrl.split(';base64,');
      const contentType = parts[0].split(':')[1] || 'image/jpeg';
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }
      return new Blob([uInt8Array], { type: contentType });
    } catch (e) {
      console.warn("Base64 decode error for image:", e);
    }
  }

  // Try 1: Local server backup file (fastest & high reliability)
  try {
    const localUrl = `/api/backup-image-file?path=${encodeURIComponent(item.name)}`;
    const resp = await fetch(localUrl);
    if (resp.ok) {
      const blob = await resp.blob();
      if (blob && blob.size > 0) return blob;
    }
  } catch (e) {}

  // Try 2: Proxy via Server endpoint (bypasses CORS and auto-attaches download tokens)
  if (item.downloadUrl) {
    try {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(item.downloadUrl)}`;
      const resp = await fetch(proxyUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob && blob.size > 0) return blob;
      }
    } catch (e) {}

    // Try 3: Direct fetch download URL
    try {
      const resp = await fetch(item.downloadUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob && blob.size > 0) return blob;
      }
    } catch (e) {}
  }

  return null;
}

// Execute Google Drive Backup (Uncompressed original images in matching folders + JSON)
window.startGoogleDriveBackup = async function() {
  const confirmed = typeof window.showConfirmDialog === 'function'
    ? await window.showConfirmDialog({
        title: "สำรองข้อมูลสู่ Google Drive (5TB)",
        message: "ระบบจะสำรองข้อมูลทั้งหมดและรูปภาพจริงต้นฉบับจาก Firebase Storage ลงโฟลเดอร์ Google AI Studio/FloraGarden_Backups บน Google Drive ของคุณโดยตรง (ไม่บีบอัด .zip) พร้อมระบบ Smart Diff ข้ามไฟล์เดิมอัตโนมัติ ต้องการดำเนินการหรือไม่?",
        type: "primary",
        icon: "bi-google",
        confirmText: "เริ่มสำรองข้อมูล Google Drive"
      })
    : confirm("ต้องการสำรองข้อมูลและรูปภาพทั้งหมดไปยัง Google AI Studio/FloraGarden_Backups บน Google Drive หรือไม่?");

  if (!confirmed) return;

  try {
    window.updateBackupProgress(5, "กำลังเชื่อมต่อกับ Google Drive...", "ขอสิทธิ์และตรวจสอบบัญชี Google...", true, "bg-success");
    getGlobalToast()("⏳ กำลังเชื่อมต่อกับ Google Drive...");

    let accessToken = null;
    try {
      accessToken = typeof window.getGoogleDriveAccessToken === 'function'
        ? await window.getGoogleDriveAccessToken(true)
        : window.googleDriveAccessToken;
    } catch (authErr) {
      console.warn("Auth token request error:", authErr);
      throw new Error(authErr.message || "ไม่สามารถเชื่อมต่อ Google Drive ได้ กรุณาเข้าสู่ระบบ Google Account ก่อน");
    }

    if (!accessToken) {
      throw new Error("ไม่พบ Token สำหรับการเข้าถึง Google Drive");
    }

    // Step 1: Ensure Server Cache is up-to-date & triggers auto backup on server
    window.updateBackupProgress(10, "กำลังดึงรายการรูปภาพจริงจากระบบ...", "สแกนไฟล์ภาพจริงจาก Storage & Database...", true, "bg-success");
    
    // Trigger server image backup in background to populate disk cache
    fetch('/api/auto-backup-images', { method: 'POST' }).catch(() => {});

    // Step 2: Get deduplicated canonical list of actual images from Firebase Storage & Database
    const storageFiles = await getCanonicalImageSyncList();

    window.updateBackupProgress(18, "กำลังเตรียมโครงสร้างโฟลเดอร์บน Google Drive...", "สร้าง/ค้นหาโฟลเดอร์ Google AI Studio > FloraGarden_Backups...", true, "bg-success");

    // 1. Find or create "Google AI Studio" parent folder
    const aiStudioFolderId = await findOrCreateDriveFolder(accessToken, 'Google AI Studio');

    // 2. Find or create "FloraGarden_Backups" root inside "Google AI Studio"
    const rootFolderId = await findOrCreateDriveFolder(accessToken, 'FloraGarden_Backups', aiStudioFolderId);

    // 3. Find or create subfolders
    const equipFolderId = await findOrCreateDriveFolder(accessToken, 'equipment', rootFolderId);
    const empFolderId = await findOrCreateDriveFolder(accessToken, 'employees', rootFolderId);
    const dbFolderId = await findOrCreateDriveFolder(accessToken, 'database', rootFolderId);

    window.updateBackupProgress(25, "กำลังสแกนไฟล์เดิมบน Google Drive (Smart Diff)...", "ตรวจสอบขนาดไฟล์เดิมและตัดไฟล์นามสกุลซ้ำซ้อน...", true, "bg-success");

    // 4. Scan existing files in Drive subfolders
    const existingEquipFiles = await listFilesInDriveFolder(accessToken, equipFolderId);
    const existingEmpFiles = await listFilesInDriveFolder(accessToken, empFolderId);

    let driveSummary = {
      totalImages: storageFiles.length,
      imagesAdded: 0,
      imagesUpdated: 0,
      imagesSkipped: 0,
      imagesFailed: 0,
      dbBackupName: ''
    };

    // 5. Upload All Genuine Deduplicated Image Files to Google Drive
    const totalFiles = storageFiles.length;
    const processedDriveFileNames = new Set();

    for (let i = 0; i < totalFiles; i++) {
      const item = storageFiles[i];
      const parts = item.name.split('/');
      const isEmployee = parts[0].toLowerCase().includes('emp') || parts[0].toLowerCase().includes('staff');
      const targetFolderId = isEmployee ? empFolderId : equipFolderId;
      const existingMap = isEmployee ? existingEmpFiles : existingEquipFiles;

      const fileName = item.canonicalFileName || parts.slice(1).join('_') || parts[0];
      const safeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const destKey = `${isEmployee ? 'emp' : 'eq'}_${safeFileName.toLowerCase()}`;

      // Skip if already processed in this batch
      if (processedDriveFileNames.has(destKey)) {
        continue;
      }
      processedDriveFileNames.add(destKey);

      const existingFile = existingMap.get(safeFileName) || existingMap.get(safeFileName.toLowerCase());

      // Clean up obsolete duplicate extensions on Google Drive for this code (e.g. remove old EQ-001.jpg if active is EQ-001.webp)
      const dotIdx = safeFileName.lastIndexOf('.');
      const baseCode = dotIdx > 0 ? safeFileName.substring(0, dotIdx) : safeFileName;
      for (const [dName, dFile] of existingMap.entries()) {
        const dDot = dName.lastIndexOf('.');
        const dBase = dDot > 0 ? dName.substring(0, dDot) : dName;
        if (dBase.toLowerCase() === baseCode.toLowerCase() && dName.toLowerCase() !== safeFileName.toLowerCase()) {
          await deleteFileFromDrive(accessToken, dFile.id);
          existingMap.delete(dName);
          existingMap.delete(dName.toLowerCase());
        }
      }

      // Smart Diff Check: If size exists on Drive and matches remoteSize > 0
      if (existingFile && item.size > 0 && parseInt(existingFile.size, 10) === item.size) {
        driveSummary.imagesSkipped++;
      } else {
        try {
          const blob = await fetchDriveImageBlob(item);
          if (blob && blob.size > 0) {
            if (existingFile && parseInt(existingFile.size, 10) === blob.size) {
              driveSummary.imagesSkipped++;
            } else {
              await uploadFileToDrive(accessToken, {
                name: safeFileName,
                mimeType: blob.type || item.contentType || 'image/jpeg',
                blob: blob,
                parentFolderId: targetFolderId,
                existingFileId: existingFile ? existingFile.id : null
              });
              if (existingFile) driveSummary.imagesUpdated++;
              else driveSummary.imagesAdded++;
            }
          } else {
            console.warn(`Could not get image blob for ${item.name}`);
            driveSummary.imagesFailed++;
          }
        } catch (uploadErr) {
          console.warn(`Error uploading ${item.name} to Google Drive:`, uploadErr);
          driveSummary.imagesFailed++;
        }
      }

      // Progress 25% -> 80%
      const currentPercent = 25 + Math.round(((i + 1) / (totalFiles || 1)) * 55);
      window.updateBackupProgress(
        currentPercent,
        `กำลังสำรองรูปภาพจริงสู่ Google Drive (${i + 1}/${totalFiles})...`,
        `ไฟล์: ${item.name} (${safeFileName})`,
        true,
        "bg-success"
      );
    }

    // 6. Upload Full Database JSON
    window.updateBackupProgress(85, "กำลังสร้างและอัปโหลดไฟล์ฐานข้อมูล (.json) สู่ Google Drive...", "รวบรวมข้อมูลทุก Collection ของระบบ...", true, "bg-success");

    const now = new Date();
    const timestampStr = typeof window.getThaiDateTimeFilenameString === 'function'
      ? window.getThaiDateTimeFilenameString(now)
      : now.toISOString().replace(/[:.]/g, '-');
    const thaiDateStr = now.toLocaleString('th-TH');

    const clonedEquipment = safeJsonClone(window.equipmentList);
    const clonedEmployees = safeJsonClone(window.employeeList);

    clonedEquipment.forEach(eq => {
      delete eq.imageBase64;
      delete eq.photoBase64;
    });
    clonedEmployees.forEach(emp => {
      delete emp.imageBase64;
      delete emp.photoBase64;
    });

    const backupData = {
      version: "2.0",
      appName: "Flora Garden Stock & Employee System",
      backupTimestamp: now.toISOString(),
      backupDateThai: thaiDateStr,
      storageType: "GOOGLE_DRIVE_UNCOMPRESSED",
      equipmentList: clonedEquipment,
      employeeList: clonedEmployees,
      deletedEmployees: safeJsonClone(window.deletedEmployees || []),
      transactionHistory: window.transactionHistory || [],
      attendanceLogs: window.attendanceLogs || [],
      auditLogs: window.auditLogs || [],
      categoriesList: window.categoriesList || [],
      departmentsList: getComprehensiveDepartmentsList(),
      locationsList: getComprehensiveLocationsList(),
      imagesBase64Map: {}
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const jsonBlob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const jsonFileName = `flora_garden_backup_${timestampStr}.json`;
    driveSummary.dbBackupName = jsonFileName;

    // Upload timestamped JSON
    await uploadFileToDrive(accessToken, {
      name: jsonFileName,
      mimeType: 'application/json',
      blob: jsonBlob,
      parentFolderId: dbFolderId
    });

    // Check if flora_garden_backup_latest.json exists, update or create
    const existingDbFiles = await listFilesInDriveFolder(accessToken, dbFolderId);
    const latestFile = existingDbFiles.get('flora_garden_backup_latest.json');
    await uploadFileToDrive(accessToken, {
      name: 'flora_garden_backup_latest.json',
      mimeType: 'application/json',
      blob: jsonBlob,
      parentFolderId: dbFolderId,
      existingFileId: latestFile ? latestFile.id : null
    });

    window.updateBackupProgress(100, "สำรองข้อมูลสู่ Google Drive สำเร็จ 100%", `บันทึกไฟล์ภาพจริงและฐานข้อมูลใน Google Drive โฟลเดอร์ Google AI Studio > FloraGarden_Backups เรียบร้อยแล้ว`, true, "bg-success");
    getGlobalToast()("🎉 สำรองข้อมูลและรูปภาพจริงสู่ Google Drive สำเร็จ 100%!");

    // Render Log Card
    const logCard = document.getElementById('googleDriveSyncLogCard');
    const driveFolderUrl = `https://drive.google.com/drive/folders/${rootFolderId}`;
    if (logCard) {
      logCard.classList.remove('d-none');
      logCard.innerHTML = `
        <div class="alert alert-success border-0 shadow-2xs rounded-3 mb-0 p-3 bg-success bg-opacity-10 text-dark">
          <div class="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-2 pb-2 border-bottom border-success border-opacity-25">
            <span class="fw-bold text-success fs-7"><i class="bi bi-google me-1.5"></i> ผลการสำรองข้อมูลสู่ Google Drive (Google AI Studio)</span>
            <a href="${driveFolderUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-success rounded-pill px-3 py-1 fs-8 fw-bold text-nowrap align-self-start align-self-sm-auto">
              <i class="bi bi-box-arrow-up-right me-1"></i> เปิดโฟลเดอร์ Google Drive
            </a>
          </div>
          <div class="row g-2 text-center my-2">
            <div class="col-3">
              <div class="bg-white p-2 rounded-3 border">
                <div class="text-muted fs-9 mb-0.5">รวมรูปภาพจริง</div>
                <div class="fw-bold text-dark fs-6">${driveSummary.totalImages} รูป</div>
              </div>
            </div>
            <div class="col-3">
              <div class="bg-white p-2 rounded-3 border">
                <div class="text-muted fs-9 mb-0.5">เพิ่มไฟล์ใหม่</div>
                <div class="fw-bold text-success fs-6">+${driveSummary.imagesAdded}</div>
              </div>
            </div>
            <div class="col-3">
              <div class="bg-white p-2 rounded-3 border">
                <div class="text-muted fs-9 mb-0.5">เขียนทับ/อัปเดต</div>
                <div class="fw-bold text-warning fs-6">✏️ ${driveSummary.imagesUpdated}</div>
              </div>
            </div>
            <div class="col-3">
              <div class="bg-white p-2 rounded-3 border">
                <div class="text-muted fs-9 mb-0.5">ข้าม (ไฟล์เดิม)</div>
                <div class="fw-bold text-secondary fs-6">⚡ ${driveSummary.imagesSkipped}</div>
              </div>
            </div>
          </div>
          <div class="fs-8 text-muted d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-1 mt-2 pt-1 border-top">
            <span><i class="bi bi-file-earmark-check text-success me-1"></i> ฐานข้อมูล: <b>${jsonFileName}</b> (และ flora_garden_backup_latest.json)</span>
            <span class="fw-semibold text-dark"><i class="bi bi-clock-history me-1"></i> ${new Date().toLocaleTimeString('th-TH')}</span>
          </div>
        </div>
      `;
    }

    if (typeof window.showFeedbackPopup === 'function') {
      window.showFeedbackPopup("สำรอง Google Drive สำเร็จ", "บันทึกไฟล์ภาพจริงและฐานข้อมูลครบถ้วนแล้ว");
    }

    alert(`🎉 สำเร็จ! ระบบได้ทำการสำรองข้อมูลและรูปภาพจริงทั้งหมดสู่ Google Drive เรียบร้อยแล้ว\n\n📁 ตำแหน่ง: Google Drive > Google AI Studio > FloraGarden_Backups/\n  ├── equipment/ (รูปภาพอุปกรณ์ต้นฉบับ)\n  ├── employees/ (รูปถ่ายบุคลากรต้นฉบับ)\n  └── database/ (${jsonFileName})\n\n• รวมรูปภาพทั้งหมด: ${driveSummary.totalImages} รูป\n• เพิ่มไฟล์ใหม่: +${driveSummary.imagesAdded} รูป\n• เขียนทับ/แก้ไข: ${driveSummary.imagesUpdated} รูป\n• ข้าม (มีไฟล์เดิมและขนาดตรงกัน): ${driveSummary.imagesSkipped} รูป`);
  } catch (err) {
    console.error("Google Drive backup error:", err);
    window.updateBackupProgress(0, "เกิดข้อผิดพลาดในการสำรองข้อมูล Google Drive", err.message, true, "bg-danger");
    getGlobalToast()("❌ Google Drive Backup ล้มเหลว: " + err.message);
    alert("เกิดข้อผิดพลาดในการสำรองข้อมูลขึ้น Google Drive:\n" + err.message);
  }
};

// Execute Google Drive Restore (Fetch & Preview from Google Drive, Progress Bar runs upon confirmation)
window.startGoogleDriveRestore = async function() {
  try {
    // Hide previous progress bar until user confirms actual restore
    window.updateBackupProgress(0, "", "", false);
    getGlobalToast()("⏳ กำลังเชื่อมต่อและค้นหาไฟล์สำรองข้อมูลบน Google Drive...");

    let accessToken = null;
    try {
      accessToken = typeof window.getGoogleDriveAccessToken === 'function'
        ? await window.getGoogleDriveAccessToken(true)
        : window.googleDriveAccessToken;
    } catch (authErr) {
      throw new Error(authErr.message || "ไม่สามารถเชื่อมต่อ Google Drive ได้ กรุณาเข้าสู่ระบบ Google Account ก่อน");
    }

    if (!accessToken) {
      throw new Error("ไม่พบ Token สำหรับการเข้าถึง Google Drive");
    }

    // Find "Google AI Studio" -> "FloraGarden_Backups" root
    const aiStudioFolderId = await findOrCreateDriveFolder(accessToken, 'Google AI Studio');
    const rootFolderId = await findOrCreateDriveFolder(accessToken, 'FloraGarden_Backups', aiStudioFolderId);
    const dbFolderId = await findOrCreateDriveFolder(accessToken, 'database', rootFolderId);

    getGlobalToast()("🔍 กำลังสแกนรายการไฟล์สำรอง (.json) ใน Google Drive...");

    const filesMap = await listFilesInDriveFolder(accessToken, dbFolderId);
    const jsonFiles = Array.from(filesMap.values()).filter(f => f.name.endsWith('.json'));

    if (jsonFiles.length === 0) {
      alert("⚠️ ไม่พบไฟล์สำรองข้อมูล (.json) ในโฟลเดอร์ Google AI Studio/FloraGarden_Backups/database บน Google Drive ของคุณ\n\nกรุณากดปุ่ม 'สำรองข้อมูลสู่ Google Drive' ก่อนเพื่อสร้างไฟล์สำรองครับ");
      return;
    }

    // Sort files: latest first
    jsonFiles.sort((a, b) => new Date(b.createdTime || b.modifiedTime || 0) - new Date(a.createdTime || a.modifiedTime || 0));

    // Choose file: if latest exists or user picks
    let selectedFile = jsonFiles[0];
    if (jsonFiles.length > 1) {
      const fileOptions = jsonFiles.slice(0, 10).map((f, idx) => `${idx + 1}. ${f.name} (${f.createdTime ? new Date(f.createdTime).toLocaleString('th-TH') : ''})`).join('\n');
      const pick = prompt(`📁 พบไฟล์สำรองบน Google Drive ${jsonFiles.length} รายการ\nระบุหมายเลขไฟล์ที่ต้องการกู้คืน (1-${Math.min(jsonFiles.length, 10)}) หรือกด OK เพื่อเลือกไฟล์ล่าสุด:\n\n${fileOptions}`, "1");
      if (pick === null) return;
      const num = parseInt(pick.trim(), 10);
      if (!isNaN(num) && num >= 1 && num <= jsonFiles.length) {
        selectedFile = jsonFiles[num - 1];
      }
    }

    getGlobalToast()(`📥 กำลังดาวน์โหลดไฟล์ "${selectedFile.name}" จาก Google Drive...`);

    const jsonText = await downloadFileFromDrive(accessToken, selectedFile.id);
    const parsed = JSON.parse(jsonText);

    if (!parsed || typeof parsed !== 'object' || (!parsed.equipmentList && !parsed.employeeList && !parsed.transactionHistory)) {
      throw new Error("โครงสร้างไฟล์สำรองจาก Google Drive ไม่ถูกต้อง");
    }

    tempParsedRestoreData = parsed;
    window.displayRestoreSummary(parsed, `Google Drive: ${selectedFile.name}`);

    getGlobalToast()(`🟢 โหลดไฟล์ "${selectedFile.name}" สำเร็จ กรุณากดยืนยันการฟื้นฟูข้อมูลด้านล่าง`);

    const previewCard = document.getElementById('restorePreviewCard');
    if (previewCard) {
      previewCard.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    console.error("Google Drive restore fetch error:", err);
    getGlobalToast()("❌ ไม่สามารถอ่านไฟล์จาก Google Drive: " + err.message);
    alert("เกิดข้อผิดพลาดขณะอ่านข้อมูลจาก Google Drive: " + err.message);
  }
};

// =========================================================================
// 20. HYBRID DUAL BACKUP SYSTEM (Automatic Once-Per-Day for Admin)
// =========================================================================
// Dual Backup Targets:
// 1) Google Drive: Rotating Folders (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)
// 2) Local Machine: Direct JSON download to user's computer / mobile device
// Timezone: Thailand (UTC+7, Asia/Bangkok)
// =========================================================================

window.getRotationDayInfo = function(inputDate = new Date()) {
  try {
    const d = inputDate instanceof Date ? inputDate : new Date(inputDate);
    
    // Explicitly compute day-of-week and date strings in Thailand Timezone (Asia/Bangkok)
    const thaiFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = thaiFmt.formatToParts(d);
    const partMap = {};
    parts.forEach(p => { partMap[p.type] = p.value; });

    const dayOfWeekEn = partMap.weekday || 'Monday';
    const year = partMap.year || String(d.getFullYear());
    const month = partMap.month || String(d.getMonth() + 1).padStart(2, '0');
    const day = partMap.day || String(d.getDate()).padStart(2, '0');
    const hour = partMap.hour || '00';
    const minute = partMap.minute || '00';
    const second = partMap.second || '00';

    const daysOfWeekEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysOfWeekTh = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    const dayIndex = daysOfWeekEn.indexOf(dayOfWeekEn) !== -1 ? daysOfWeekEn.indexOf(dayOfWeekEn) : d.getDay();
    const dayOfWeekTh = daysOfWeekTh[dayIndex] || 'วันจันทร์';

    const dateIso = `${year}-${month}-${day}`;
    const thaiDateStr = d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

    return {
      dayIndex,
      dayOfWeekEn,
      dayOfWeekTh,
      dateIso,
      thaiDateStr,
      thaiTimeStr: `${hour}:${minute}:${second}`,
      timestamp: d.toISOString()
    };
  } catch (e) {
    const d = inputDate instanceof Date ? inputDate : new Date(inputDate);
    const daysOfWeekEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysOfWeekTh = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    const dayIndex = d.getDay();
    return {
      dayIndex,
      dayOfWeekEn: daysOfWeekEn[dayIndex],
      dayOfWeekTh: daysOfWeekTh[dayIndex],
      dateIso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      thaiDateStr: d.toLocaleString('th-TH'),
      thaiTimeStr: '00:00:00',
      timestamp: d.toISOString()
    };
  }
};

window.executeLocalHybridBackup = function(dayInfo = window.getRotationDayInfo()) {
  try {
    const now = new Date();
    const clonedEquipment = safeJsonClone(window.equipmentList || []);
    const clonedEmployees = safeJsonClone(window.employeeList || []);
    
    clonedEquipment.forEach(eq => {
      delete eq.imageBase64;
      delete eq.photoBase64;
    });
    clonedEmployees.forEach(emp => {
      delete emp.imageBase64;
      delete emp.photoBase64;
    });

    const backupData = {
      version: "2.0",
      appName: "Flora Garden Stock & Employee System",
      backupTimestamp: now.toISOString(),
      backupTimezone: "Asia/Bangkok (UTC+7)",
      backupDateThai: dayInfo.thaiDateStr,
      rotationDay: dayInfo.dayOfWeekEn,
      rotationDayThai: dayInfo.dayOfWeekTh,
      storageType: "HYBRID_LOCAL_AUTO_BACKUP",
      adminTarget: "jaru072@gmail.com",
      equipmentList: clonedEquipment,
      employeeList: clonedEmployees,
      deletedEmployees: safeJsonClone(window.deletedEmployees || []),
      transactionHistory: window.transactionHistory || [],
      attendanceLogs: window.attendanceLogs || [],
      auditLogs: window.auditLogs || [],
      categoriesList: window.categoriesList || [],
      departmentsList: getComprehensiveDepartmentsList(),
      locationsList: getComprehensiveLocationsList(),
      imagesBase64Map: {}
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const fileName = `FloraGarden_Backup_${dayInfo.dayOfWeekEn}_${dayInfo.dateIso}.json`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    console.log(`[HybridBackup] Local backup downloaded successfully: ${fileName} (${blob.size} bytes)`);
    return { success: true, fileName, size: blob.size };
  } catch (err) {
    console.error("[HybridBackup] Local file generation error:", err);
    return { success: false, reason: err.message };
  }
};

window.executeGoogleDriveRotationBackup = async function(dayInfo = window.getRotationDayInfo(), isSilent = true) {
  try {
    let accessToken = null;
    try {
      if (typeof window.getGoogleDriveAccessToken === 'function') {
        accessToken = await window.getGoogleDriveAccessToken(!isSilent);
      } else {
        accessToken = window.googleDriveAccessToken || localStorage.getItem('google_drive_access_token') || sessionStorage.getItem('google_drive_access_token');
      }
    } catch (authErr) {
      if (!isSilent) throw authErr;
      console.warn("[HybridDriveBackup] Google Drive silent OAuth check:", authErr.message || authErr);
      return { success: false, reason: "Google Drive OAuth token not active" };
    }

    if (!accessToken) {
      console.warn("[HybridDriveBackup] No active Google Drive access token found in session.");
      return { success: false, reason: "No active Google Drive token" };
    }

    // 1. Find or create folder structure:
    // Google AI Studio > FloraGarden_Backups > Daily_Rotation > [Monday / Tuesday / ...]
    const aiStudioFolderId = await findOrCreateDriveFolder(accessToken, 'Google AI Studio');
    const rootFolderId = await findOrCreateDriveFolder(accessToken, 'FloraGarden_Backups', aiStudioFolderId);
    const rotationRootId = await findOrCreateDriveFolder(accessToken, 'Daily_Rotation', rootFolderId);
    const dayFolderId = await findOrCreateDriveFolder(accessToken, dayInfo.dayOfWeekEn, rotationRootId);

    // 2. Subfolders inside day folder
    const equipFolderId = await findOrCreateDriveFolder(accessToken, 'equipment', dayFolderId);
    const empFolderId = await findOrCreateDriveFolder(accessToken, 'employees', dayFolderId);
    const dbFolderId = await findOrCreateDriveFolder(accessToken, 'database', dayFolderId);

    // 3. Scan & Upload Image Files to Day Folder (Deduplicated Canonical Images + Smart Diff)
    const storageFiles = await getCanonicalImageSyncList();
    const existingEquipFiles = await listFilesInDriveFolder(accessToken, equipFolderId);
    const existingEmpFiles = await listFilesInDriveFolder(accessToken, empFolderId);

    let imagesUploaded = 0;
    const processedRotationFileNames = new Set();

    for (const item of storageFiles) {
      const parts = item.name.split('/');
      const isEmployee = parts[0].toLowerCase().includes('emp') || parts[0].toLowerCase().includes('staff');
      const targetFolderId = isEmployee ? empFolderId : equipFolderId;
      const existingMap = isEmployee ? existingEmpFiles : existingEquipFiles;

      const fileName = item.canonicalFileName || parts.slice(1).join('_') || parts[0];
      const safeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const destKey = `${isEmployee ? 'emp' : 'eq'}_${safeFileName.toLowerCase()}`;

      // Skip if already processed in this batch
      if (processedRotationFileNames.has(destKey)) {
        continue;
      }
      processedRotationFileNames.add(destKey);

      const existingFile = existingMap.get(safeFileName) || existingMap.get(safeFileName.toLowerCase());

      // Clean up obsolete duplicate extensions on Google Drive for this code (e.g. remove old EQ-001.jpg if active is EQ-001.webp)
      const dotIdx = safeFileName.lastIndexOf('.');
      const baseCode = dotIdx > 0 ? safeFileName.substring(0, dotIdx) : safeFileName;
      for (const [dName, dFile] of existingMap.entries()) {
        const dDot = dName.lastIndexOf('.');
        const dBase = dDot > 0 ? dName.substring(0, dDot) : dName;
        if (dBase.toLowerCase() === baseCode.toLowerCase() && dName.toLowerCase() !== safeFileName.toLowerCase()) {
          await deleteFileFromDrive(accessToken, dFile.id);
          existingMap.delete(dName);
          existingMap.delete(dName.toLowerCase());
        }
      }

      if (existingFile && item.size > 0 && parseInt(existingFile.size, 10) === item.size) {
        continue; // Identical, skip
      }

      try {
        const blob = await fetchDriveImageBlob(item);
        if (blob && blob.size > 0) {
          if (existingFile && parseInt(existingFile.size, 10) === blob.size) {
            continue; // Identical, skip
          }
          await uploadFileToDrive(accessToken, {
            name: safeFileName,
            mimeType: blob.type || item.contentType || 'image/jpeg',
            blob: blob,
            parentFolderId: targetFolderId,
            existingFileId: existingFile ? existingFile.id : null
          });
          imagesUploaded++;
        }
      } catch (uploadErr) {
        console.warn(`[HybridDriveBackup] Image upload notice for ${item.name}:`, uploadErr);
      }
    }

    // 4. Upload Day-stamped Database JSON
    const now = new Date();
    const clonedEquipment = safeJsonClone(window.equipmentList || []);
    const clonedEmployees = safeJsonClone(window.employeeList || []);
    clonedEquipment.forEach(eq => { delete eq.imageBase64; delete eq.photoBase64; });
    clonedEmployees.forEach(emp => { delete emp.imageBase64; delete emp.photoBase64; });

    const backupData = {
      version: "2.0",
      appName: "Flora Garden Stock & Employee System",
      backupTimestamp: now.toISOString(),
      backupTimezone: "Asia/Bangkok (UTC+7)",
      backupDateThai: dayInfo.thaiDateStr,
      rotationDay: dayInfo.dayOfWeekEn,
      rotationDayThai: dayInfo.dayOfWeekTh,
      storageType: "GOOGLE_DRIVE_ROTATION_UNCOMPRESSED",
      equipmentList: clonedEquipment,
      employeeList: clonedEmployees,
      deletedEmployees: safeJsonClone(window.deletedEmployees || []),
      transactionHistory: window.transactionHistory || [],
      attendanceLogs: window.attendanceLogs || [],
      auditLogs: window.auditLogs || [],
      categoriesList: window.categoriesList || [],
      departmentsList: getComprehensiveDepartmentsList(),
      locationsList: getComprehensiveLocationsList(),
      imagesBase64Map: {}
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const jsonBlob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const jsonFileName = `flora_garden_backup_${dayInfo.dayOfWeekEn}_${dayInfo.dateIso}.json`;

    await uploadFileToDrive(accessToken, {
      name: jsonFileName,
      mimeType: 'application/json',
      blob: jsonBlob,
      parentFolderId: dbFolderId
    });

    const existingDbFiles = await listFilesInDriveFolder(accessToken, dbFolderId);
    const latestFile = existingDbFiles.get(`flora_garden_backup_${dayInfo.dayOfWeekEn}_latest.json`);
    await uploadFileToDrive(accessToken, {
      name: `flora_garden_backup_${dayInfo.dayOfWeekEn}_latest.json`,
      mimeType: 'application/json',
      blob: jsonBlob,
      parentFolderId: dbFolderId,
      existingFileId: latestFile ? latestFile.id : null
    });

    console.log(`[HybridDriveBackup] Google Drive rotation backup completed for ${dayInfo.dayOfWeekEn}`);
    return {
      success: true,
      dayFolder: dayInfo.dayOfWeekEn,
      dayFolderId,
      imagesUploaded,
      jsonFileName
    };
  } catch (err) {
    console.warn("[HybridDriveBackup] Google Drive backup error:", err);
    return { success: false, reason: err.message };
  }
};

window._isHybridBackupRunning = false;
window._lastHybridBackupAttemptTimestamp = 0;
window._cloudBackupStatus = null;
let _hasSubscribedBackupStatus = false;

// 1. Cloud Firestore Real-time Backup Status Synchronization
window.subscribeToCloudBackupStatus = function() {
  if (_hasSubscribedBackupStatus) return;
  if (!window.db) return;
  try {
    const statusDocRef = doc(window.db, "system_settings", "backup_status");
    _hasSubscribedBackupStatus = true;
    onSnapshot(statusDocRef, (snap) => {
      if (snap.exists()) {
        window._cloudBackupStatus = snap.data();
      } else {
        window._cloudBackupStatus = null;
      }
      if (typeof window.updateHybridBackupStatusUI === 'function') {
        window.updateHybridBackupStatusUI();
      }
    }, (err) => {
      console.warn("[CloudBackupStatus] Snapshot listener notice:", err);
    });
  } catch (e) {
    console.warn("[CloudBackupStatus] Subscribe notice:", e);
  }
};

window.getBackupStatusFromFirestore = async function() {
  if (window._cloudBackupStatus) {
    return window._cloudBackupStatus;
  }
  if (window.db) {
    try {
      const statusDocRef = doc(window.db, "system_settings", "backup_status");
      const snap = await getDoc(statusDocRef);
      if (snap.exists()) {
        window._cloudBackupStatus = snap.data();
        return snap.data();
      }
    } catch (e) {
      console.warn("[CloudBackupStatus] getDoc notice:", e);
    }
  }
  return window._cloudBackupStatus || null;
};

window.setBackupStatusToFirestore = async function(statusData) {
  if (!window.db) return;
  try {
    const statusDocRef = doc(window.db, "system_settings", "backup_status");
    const payload = {
      ...statusData,
      updatedAt: new Date().toISOString()
    };
    await setDoc(statusDocRef, payload, { merge: true });
    window._cloudBackupStatus = { ...(window._cloudBackupStatus || {}), ...payload };
    if (typeof window.updateHybridBackupStatusUI === 'function') {
      window.updateHybridBackupStatusUI();
    }
  } catch (err) {
    console.error("[CloudBackupStatus] Error saving status to Firestore:", err);
  }
};

// 2. Admin Check Helper
function isCurrentUserAdmin() {
  const currentEmail = (window.currentAuthUser && window.currentAuthUser.email) ||
                       (window.currentUserProfile && window.currentUserProfile.email) ||
                       (window.currentUser && window.currentUser.email) ||
                       '';
  const currentRole = window.currentRole || '';
  const isEmailAdmin = currentEmail.toLowerCase() === 'jaru072@gmail.com';
  const isRoleAdmin = currentRole === 'ADMIN';
  const isSuperAdminStrict = typeof window.isThammaSrithongAdminStrict === 'function' && window.isThammaSrithongAdminStrict();
  const isDbEditor = typeof window.canAccessDatabaseEditor === 'function' && window.canAccessDatabaseEditor();
  return isEmailAdmin || isRoleAdmin || isSuperAdminStrict || isDbEditor;
}

// 3. Main Hybrid Daily Backup Process
window.runHybridDailyBackup = async function(isManual = false) {
  const dayInfo = window.getRotationDayInfo();
  const todayStr = dayInfo.dateIso; // YYYY-MM-DD in Asia/Bangkok

  // 3.1 Admin Permission Check (Admin Only)
  const isAdmin = isCurrentUserAdmin();
  if (!isAdmin) {
    if (isManual) {
      alert("⚠️ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถสั่งสำรองข้อมูลได้");
      const toast = typeof getGlobalToast === 'function' ? getGlobalToast() : (typeof showToast === 'function' ? showToast : console.log);
      toast("⚠️ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถสั่งสำรองข้อมูลได้");
    } else {
      console.log("[HybridBackup] Active user is not Admin. Auto daily backup skipped.");
    }
    return { skipped: true, reason: "Not Admin user" };
  }

  // 3.2 Concurrency Mutex Lock: prevent multiple callers from running simultaneously
  if (window._isHybridBackupRunning) {
    console.log(`[HybridBackup] Backup process is currently running. Skipping concurrent trigger.`);
    return { skipped: true, reason: "Backup already running" };
  }

  // 3.3 Debounce Lock: ignore repeated auto-triggers within 15 seconds
  const nowMs = Date.now();
  if (!isManual && (nowMs - (window._lastHybridBackupAttemptTimestamp || 0)) < 15000) {
    console.log(`[HybridBackup] Debounced: auto-backup triggered too quickly.`);
    return { skipped: true, reason: "Debounced" };
  }
  window._lastHybridBackupAttemptTimestamp = nowMs;

  // 3.4 Check Cloud Firestore Backup Status (Real-time tracking)
  const cloudStatus = await window.getBackupStatusFromFirestore();
  const isDoneTodayInCloud = cloudStatus && cloudStatus.lastBackupDate === todayStr && (cloudStatus.localBackupOk || cloudStatus.driveBackupOk);

  // 3.5 Prevent Duplicate Daily Auto-Backup
  if (!isManual && isDoneTodayInCloud) {
    console.log(`[HybridBackup] Daily backup for ${dayInfo.dayOfWeekEn} (${todayStr}) in Thailand timezone has already been completed today in Cloud Firestore. Skipping auto backup.`);
    window.updateHybridBackupStatusUI();
    return { skipped: true, reason: "Already completed today in Cloud Firestore" };
  }

  // 3.6 Manual Confirmation Dialog if already backed up today
  if (isManual && isDoneTodayInCloud) {
    let timeFormatted = '';
    if (cloudStatus.lastBackupTime) {
      try {
        timeFormatted = new Date(cloudStatus.lastBackupTime).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        timeFormatted = '';
      }
    }
    const confirmMessage = `ℹ️ ระบบตรวจพบว่าในวันนี้ (${dayInfo.dayOfWeekTh} ที่ ${dayInfo.dateIso}) ได้มีการสำรองข้อมูลไปแล้ว${timeFormatted ? ` เมื่อเวลา ${timeFormatted} น.` : ''}\n\nคุณต้องการสำรองข้อมูลซ้ำอีกครั้งหรือไม่?`;
    const confirmed = confirm(confirmMessage);
    if (!confirmed) {
      const toast = typeof getGlobalToast === 'function' ? getGlobalToast() : (typeof showToast === 'function' ? showToast : console.log);
      toast("ℹ️ ยกเลิกการสำรองข้อมูลซ้ำ");
      return { cancelled: true, reason: "User cancelled manual duplicate backup" };
    }
  }

  // 3.7 Acquire Mutex Lock
  window._isHybridBackupRunning = true;

  try {
    // Wait briefly if initial data lists are still loading
    if ((!window.equipmentList || window.equipmentList.length === 0) && (!window.employeeList || window.employeeList.length === 0)) {
      await new Promise(r => setTimeout(r, 1500));
    }

    console.log(`[HybridBackup] Executing Hybrid Dual Backup check for ${dayInfo.dayOfWeekEn} (${dayInfo.dayOfWeekTh}) [Asia/Bangkok]...`);

    // -------------------------------------------------------------
    // Part 1: Local Download to User Machine
    // -------------------------------------------------------------
    let localRes = null;
    try {
      localRes = window.executeLocalHybridBackup(dayInfo);
    } catch (lErr) {
      console.error("[HybridBackup] Local backup error:", lErr);
      localRes = { success: false, reason: lErr.message };
    }

    // -------------------------------------------------------------
    // Part 2: Google Drive Day Rotation Backup (Monday-Sunday)
    // -------------------------------------------------------------
    let driveRes = null;
    try {
      driveRes = await window.executeGoogleDriveRotationBackup(dayInfo, !isManual);
    } catch (dErr) {
      console.warn("[HybridBackup] Drive backup warning:", dErr);
      driveRes = { success: false, reason: dErr.message };
    }

    // -------------------------------------------------------------
    // Part 3: Record Status Directly in Cloud Firestore (No LocalStorage)
    // -------------------------------------------------------------
    const currentEmail = (window.currentAuthUser && window.currentAuthUser.email) ||
                         (window.currentUserProfile && window.currentUserProfile.email) ||
                         'jaru072@gmail.com';
    const currentName = (window.currentAuthUser && window.currentAuthUser.displayName) ||
                        (window.currentUserProfile && window.currentUserProfile.displayName) ||
                        'Thamma Srithong';

    await window.setBackupStatusToFirestore({
      lastBackupDate: todayStr,
      lastBackupTime: new Date().toISOString(),
      lastBackupDayEn: dayInfo.dayOfWeekEn,
      lastBackupDayTh: dayInfo.dayOfWeekTh,
      localBackupOk: Boolean(localRes && localRes.success),
      driveBackupOk: Boolean(driveRes && driveRes.success),
      lastLocalFileName: localRes?.fileName || `FloraGarden_Backup_${dayInfo.dayOfWeekEn}_${todayStr}.json`,
      lastDriveFileName: driveRes?.jsonFileName || `flora_garden_backup_${dayInfo.dayOfWeekEn}_${todayStr}.json`,
      lastDriveFolder: dayInfo.dayOfWeekEn,
      performedBy: currentEmail,
      performedByName: currentName,
      isManualTrigger: isManual
    });

    window.updateHybridBackupStatusUI();

    // Toast Notification (only notify if work was performed)
    const toast = typeof getGlobalToast === 'function' ? getGlobalToast() : (typeof showToast === 'function' ? showToast : console.log);

    const didLocalWork = localRes && localRes.success;
    const didDriveWork = driveRes && driveRes.success;

    if (didDriveWork && didLocalWork) {
      toast(`☁️ สำรองข้อมูลอัตโนมัติประจำ${dayInfo.dayOfWeekTh} (${dayInfo.dayOfWeekEn}) ครบทั้ง 2 ระบบ (Google Drive & ดาวน์โหลดลงเครื่อง) เรียบร้อยแล้ว!`);
    } else if (didDriveWork) {
      toast(`☁️ สำรองข้อมูลขึ้น Google Drive ประจำ${dayInfo.dayOfWeekTh} เรียบร้อยแล้ว`);
    } else if (didLocalWork) {
      toast(`💾 สำรองข้อมูลอัตโนมัติประจำ${dayInfo.dayOfWeekTh} (${dayInfo.dayOfWeekEn}) ดาวน์โหลดลงเครื่องเรียบร้อยแล้ว`);
    }

    return { success: true, local: localRes, drive: driveRes };
  } finally {
    // Always release Mutex Lock
    window._isHybridBackupRunning = false;
  }
};

window.updateHybridBackupStatusUI = function() {
  const dayInfo = window.getRotationDayInfo();
  const folderTextElem = document.getElementById('hybridTodayFolderText');
  const badgeElem = document.getElementById('hybridLastBackupBadge');

  if (folderTextElem) {
    folderTextElem.textContent = `${dayInfo.dayOfWeekEn} (${dayInfo.dayOfWeekTh})`;
  }

  if (badgeElem) {
    const todayStr = dayInfo.dateIso;
    const cloud = window._cloudBackupStatus;

    if (cloud && cloud.lastBackupDate === todayStr && cloud.lastBackupTime) {
      let timeStr = '';
      try {
        timeStr = new Date(cloud.lastBackupTime).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        timeStr = '';
      }
      if (cloud.driveBackupOk && cloud.localBackupOk) {
        badgeElem.className = 'badge bg-success text-white px-2.5 py-1';
        badgeElem.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> สำรองวันนี้แล้ว (${timeStr} น. - Google Drive & เครื่อง)`;
      } else if (cloud.driveBackupOk) {
        badgeElem.className = 'badge bg-success text-white px-2.5 py-1';
        badgeElem.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> สำรองขึ้น Google Drive วันนี้แล้ว (${timeStr} น.)`;
      } else if (cloud.localBackupOk) {
        badgeElem.className = 'badge bg-warning bg-opacity-25 text-dark border border-warning px-2.5 py-1';
        badgeElem.style.cursor = 'pointer';
        badgeElem.title = 'คลิกเพื่อสำรองขึ้น Google Drive';
        badgeElem.onclick = () => window.runHybridDailyBackup(true);
        badgeElem.innerHTML = `<i class="bi bi-exclamation-circle me-1"></i> สำรองลงเครื่องแล้ว (${timeStr} น.) [คลิกเชื่อม Google Drive]`;
      } else {
        badgeElem.className = 'badge bg-success text-white px-2.5 py-1';
        badgeElem.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> สำรองวันนี้แล้ว (${timeStr} น.)`;
      }
    } else if (cloud && cloud.lastBackupDate && cloud.lastBackupTime) {
      let dateFormatted = '';
      try {
        dateFormatted = new Date(cloud.lastBackupTime).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
      } catch (e) {
        dateFormatted = cloud.lastBackupDate;
      }
      badgeElem.className = 'badge bg-warning bg-opacity-25 text-dark border border-warning px-2.5 py-1';
      badgeElem.innerHTML = `สำรองล่าสุดเมื่อ ${dateFormatted} (${cloud.lastBackupDayTh || cloud.lastBackupDayEn || ''})`;
    } else {
      badgeElem.className = 'badge bg-light text-dark border px-2.5 py-1';
      badgeElem.innerHTML = `พร้อมสำรองอัตโนมัติวันนี้ (${dayInfo.dayOfWeekTh})`;
    }
  }
};

// 4. Listeners for folder UI refresh & Auto-sync on startup
function initBackupRestore() {
  if (typeof window.subscribeToCloudBackupStatus === 'function') {
    window.subscribeToCloudBackupStatus();
  }
  if (typeof window.refreshFolderUIDisplay === 'function') {
    window.refreshFolderUIDisplay();
  }
  if (typeof window.updateHybridBackupStatusUI === 'function') {
    window.updateHybridBackupStatusUI();
  }

  // Listen to flora-firebase-ready to subscribe if not yet connected
  window.addEventListener('flora-firebase-ready', () => {
    if (typeof window.subscribeToCloudBackupStatus === 'function') {
      window.subscribeToCloudBackupStatus();
    }
  });

  // Automatic Hybrid Daily Backup check after startup
  setTimeout(() => {
    if (typeof window.runHybridDailyBackup === 'function') {
      window.runHybridDailyBackup(false).catch(e => console.warn("[HybridBackup] Startup auto-check notice:", e));
    }
  }, 3500);

  const modalElem = document.getElementById('backupRestoreModal');
  if (modalElem) {
    modalElem.addEventListener('show.bs.modal', () => {
      if (typeof window.refreshFolderUIDisplay === 'function') {
        window.refreshFolderUIDisplay();
      }
      if (typeof window.updateHybridBackupStatusUI === 'function') {
        window.updateHybridBackupStatusUI();
      }
    });
    modalElem.addEventListener('shown.bs.modal', () => {
      if (typeof window.refreshFolderUIDisplay === 'function') {
        window.refreshFolderUIDisplay();
      }
      if (typeof window.updateHybridBackupStatusUI === 'function') {
        window.updateHybridBackupStatusUI();
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBackupRestore);
} else {
  initBackupRestore();
}
