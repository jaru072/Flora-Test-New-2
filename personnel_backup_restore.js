// ==================== PERSONNEL BACKUP & RESTORE MODULE (personnel_backup_restore.js) ====================
import { 
  doc, 
  setDoc, 
  getDocs, 
  collection, 
  deleteDoc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let tempParsedPersonnelRestoreData = null;

// Progress & Timer variables
let personnelBackupTimerInterval = null;
let personnelBackupTimerStartTime = null;
let personnelBackupTimerElapsedMs = 0;
let isPersonnelBackupTimerLocked = false;

// Helper to format Thai date time for backup filename
window.getThaiPersonnelBackupFilename = function(prefix = 'flora_personnel_backup', ext = 'json') {
  try {
    const d = new Date();
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
    return `${prefix}_${partMap.year}-${partMap.month}-${partMap.day}_${partMap.hour}-${partMap.minute}-${partMap.second}.${ext}`;
  } catch (e) {
    const d = new Date();
    return `${prefix}_${d.toISOString().slice(0,10)}_${d.toTimeString().slice(0,8).replace(/:/g, '-')}.${ext}`;
  }
};

// Safe JSON deep clone
function safePersonnelClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj || []));
  } catch (e) {
    return Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  }
}

// Timer Functions
window.startPersonnelBackupTimer = function() {
  if (personnelBackupTimerInterval) {
    clearInterval(personnelBackupTimerInterval);
    personnelBackupTimerInterval = null;
  }
  isPersonnelBackupTimerLocked = false;
  personnelBackupTimerStartTime = Date.now();
  personnelBackupTimerElapsedMs = 0;

  const timerElem = document.getElementById('personnelBackupProgressTimer');
  if (timerElem) {
    timerElem.textContent = '00:00';
    timerElem.className = 'font-monospace text-white fw-bolder';
  }
  const badge = document.getElementById('personnelBackupProgressTimerBadge');
  if (badge) {
    badge.className = 'badge bg-danger text-white rounded-pill px-3 py-1 fs-7 fw-bold d-flex align-items-center gap-1.5 shadow-2xs';
  }
  const icon = document.getElementById('personnelBackupProgressTimerIcon');
  if (icon) icon.className = 'bi bi-stopwatch text-white';

  personnelBackupTimerInterval = setInterval(() => {
    if (!personnelBackupTimerStartTime || isPersonnelBackupTimerLocked) return;
    personnelBackupTimerElapsedMs = Date.now() - personnelBackupTimerStartTime;
    const totalSec = Math.max(0, Math.floor(personnelBackupTimerElapsedMs / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const el = document.getElementById('personnelBackupProgressTimer');
    if (el) el.textContent = formatted;
  }, 200);
};

window.stopPersonnelBackupTimer = function(markComplete = false) {
  if (personnelBackupTimerInterval) {
    clearInterval(personnelBackupTimerInterval);
    personnelBackupTimerInterval = null;
  }
  if (personnelBackupTimerStartTime && !isPersonnelBackupTimerLocked) {
    personnelBackupTimerElapsedMs = Date.now() - personnelBackupTimerStartTime;
  }
  isPersonnelBackupTimerLocked = true;

  const totalSec = Math.max(0, Math.floor((personnelBackupTimerElapsedMs || 0) / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const el = document.getElementById('personnelBackupProgressTimer');
  if (el) el.textContent = formatted;

  if (markComplete) {
    const badge = document.getElementById('personnelBackupProgressTimerBadge');
    if (badge) badge.className = 'badge bg-success text-white rounded-pill px-3.5 py-1.5 fs-7 fw-bold d-flex align-items-center gap-1.5 shadow-sm';
    const icon = document.getElementById('personnelBackupProgressTimerIcon');
    if (icon) icon.className = 'bi bi-check-circle-fill text-white fs-6';
    const subStatus = document.getElementById('personnelBackupProgressSubStatus');
    if (subStatus) {
      subStatus.innerHTML = `<span class="badge bg-danger text-white px-2.5 py-1 rounded-pill fw-bold shadow-2xs me-1"><i class="bi bi-stopwatch-fill me-1"></i>ใช้เวลา: ${formatted} (${totalSec} วินาที)</span> <i class="bi bi-check-circle-fill text-success ms-1"></i> สำเร็จ 100%`;
    }
  }
};

window.resetPersonnelBackupTimer = function() {
  if (personnelBackupTimerInterval) {
    clearInterval(personnelBackupTimerInterval);
    personnelBackupTimerInterval = null;
  }
  isPersonnelBackupTimerLocked = false;
  personnelBackupTimerStartTime = null;
  personnelBackupTimerElapsedMs = 0;
  const el = document.getElementById('personnelBackupProgressTimer');
  if (el) el.textContent = '00:00';
};

// Update Progress UI
window.updatePersonnelBackupProgress = function(percent, title, text = '', show = true, colorClass = 'bg-primary') {
  const container = document.getElementById('personnelBackupProgressContainer');
  if (!container) return;

  const s = Math.min(100, Math.max(0, Math.round(percent)));
  if (!show) {
    container.classList.add('d-none');
    window.resetPersonnelBackupTimer();
    return;
  }

  container.classList.remove('d-none');

  if (colorClass.includes('danger')) {
    window.stopPersonnelBackupTimer(false);
  } else if (s >= 100) {
    window.stopPersonnelBackupTimer(true);
  } else if (s > 0 && !personnelBackupTimerInterval && !personnelBackupTimerStartTime) {
    window.startPersonnelBackupTimer();
  }

  const bar = document.getElementById('personnelBackupProgressBar');
  const pctBadge = document.getElementById('personnelBackupProgressPercent');
  const titleEl = document.getElementById('personnelBackupProgressTitle');
  const textEl = document.getElementById('personnelBackupProgressText');
  const spinner = document.getElementById('personnelBackupProgressSpinner');

  if (bar) {
    bar.style.width = `${s}%`;
    bar.textContent = `${s}%`;
    bar.className = `progress-bar progress-bar-striped progress-bar-animated ${colorClass} fw-bold fs-8`;
  }
  if (pctBadge) {
    pctBadge.textContent = `${s}%`;
    pctBadge.className = `badge rounded-pill px-3 py-1 fs-7 fw-bold ${colorClass}`;
  }
  if (titleEl && title) titleEl.textContent = title;
  if (textEl) textEl.textContent = text || title;
  if (spinner) {
    if (s >= 100) spinner.classList.add('d-none');
    else spinner.classList.remove('d-none');
  }

  if (show && (s <= 15 || s === 70 || s === 90 || s >= 100)) {
    try { container.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch(e){}
  }
};

// Refresh Statistics in Personnel Backup Modal
window.refreshPersonnelBackupModalStats = async function() {
  const employees = window.employees || [];
  const empCount = employees.length;

  let deptsCount = (window.departmentsList || []).length;
  let posCount = (window.positionsList || []).length;

  // Calculate distinct departments & positions if list is small
  if (deptsCount === 0) {
    const dSet = new Set();
    employees.forEach(e => { if (e && e.department) dSet.add(e.department); });
    deptsCount = dSet.size;
  }
  if (posCount === 0) {
    const pSet = new Set();
    employees.forEach(e => { if (e && e.position) pSet.add(e.position); });
    posCount = pSet.size;
  }

  // Count Tree Nodes
  let treeNodeCount = 0;
  try {
    if (typeof window.getFloraOrgTree === 'function') {
      const tree = window.getFloraOrgTree();
      const countNodes = (n) => {
        if (!n) return 0;
        let c = 1;
        if (Array.isArray(n.children)) {
          n.children.forEach(ch => { c += countNodes(ch); });
        }
        return c;
      };
      treeNodeCount = countNodes(tree);
    }
  } catch(e) {}

  // Count attendance logs
  const attLogs = window.attendanceLogs || window.attendance || [];
  const attCount = attLogs.length;

  // Count deleted employees (trash)
  let trashCount = 0;
  if (Array.isArray(window.deletedEmployees)) {
    trashCount = window.deletedEmployees.length;
  }

  // Count photos
  let photoCount = 0;
  employees.forEach(e => { if (e && (e.photoUrl || e.photoBase64 || e.imageUrl)) photoCount++; });

  const elEmp = document.getElementById('personnelStatCountEmp');
  const elDept = document.getElementById('personnelStatCountDept');
  const elPos = document.getElementById('personnelStatCountPos');
  const elTree = document.getElementById('personnelStatCountTree');
  const elAtt = document.getElementById('personnelStatCountAtt');
  const elTrash = document.getElementById('personnelStatCountTrash');
  const elPhoto = document.getElementById('personnelStatCountPhoto');

  if (elEmp) elEmp.textContent = `${empCount} คน`;
  if (elDept) elDept.textContent = `${deptsCount} แผนก`;
  if (elPos) elPos.textContent = `${posCount} ตำแหน่ง`;
  if (elTree) elTree.textContent = `${treeNodeCount} โหนด`;
  if (elAtt) elAtt.textContent = `${attCount} รายการ`;
  if (elTrash) elTrash.textContent = `${trashCount} คน`;
  if (elPhoto) elPhoto.textContent = `${photoCount} รูป`;
};

// 1. Open Personnel Backup/Restore Modal
window.openPersonnelBackupRestoreModal = function() {
  try {
    if (typeof window.refreshPersonnelBackupModalStats === 'function') {
      window.refreshPersonnelBackupModalStats();
    }
    tempParsedPersonnelRestoreData = null;
    window.updatePersonnelBackupProgress(0, '', '', false);

    const restoreInput = document.getElementById('personnelRestoreFileInput');
    if (restoreInput) restoreInput.value = '';

    const previewCard = document.getElementById('personnelRestorePreviewCard');
    if (previewCard) previewCard.classList.add('d-none');

    const btnRestore = document.getElementById('btnExecutePersonnelRestore');
    if (btnRestore) btnRestore.classList.add('d-none');

    const modalElem = document.getElementById('personnelBackupRestoreModal');
    if (modalElem) {
      const modalInst = bootstrap.Modal.getOrCreateInstance(modalElem);
      modalInst.show();
    } else {
      if (typeof window.showToast === 'function') window.showToast("⚠️ ไม่พบหน้าต่างสำรอง/กู้คืนข้อมูล");
      else alert("ไม่พบหน้าต่างสำรอง/กู้คืนข้อมูล");
    }
  } catch (err) {
    console.error("Error opening Personnel Backup/Restore modal:", err);
  }
};
window.openBackupRestoreModal = window.openPersonnelBackupRestoreModal;

// 2. Export Personnel Data as JSON (All-In-One)
window.downloadPersonnelBackupJSON = async function() {
  try {
    window.updatePersonnelBackupProgress(10, "กำลังรวบรวมข้อมูลระบบงานบุคคล...", "ดึงข้อมูลบุคลากร โครงสร้างผัง แผนก ตำแหน่ง และเวลา", true, "bg-primary");
    if (typeof window.showToast === 'function') window.showToast("⏳ กำลังจัดเตรียมไฟล์สำรองระบบงานบุคคลทั้งหมด...");

    // Fetch latest Firestore docs if db is connected
    let employees = safePersonnelClone(window.employees || []);
    let orgTree = null;
    let departments = safePersonnelClone(window.departmentsList || []);
    let positions = safePersonnelClone(window.positionsList || []);
    let attendance = safePersonnelClone(window.attendanceLogs || window.attendance || []);
    let deletedEmployees = safePersonnelClone(window.deletedEmployees || []);
    let globalLogo = null;

    if (typeof window.getFloraOrgTree === 'function') {
      orgTree = window.getFloraOrgTree();
    }

    if (window.db) {
      window.updatePersonnelBackupProgress(30, "กำลังตรวจสอบข้อมูลล่าสุดจาก Firestore...", "ดึงข้อมูล collection employees, org_structure, attendance", true, "bg-primary");
      try {
        const empSnap = await getDocs(collection(window.db, "employees"));
        if (!empSnap.empty) {
          employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (e) { console.warn("Notice: Firestore employees fetch:", e); }

      try {
        const treeDoc = await getDoc(doc(window.db, "org_structure", "main"));
        if (treeDoc.exists() && treeDoc.data()?.tree) {
          orgTree = treeDoc.data().tree;
        }
      } catch (e) { console.warn("Notice: Firestore org_structure fetch:", e); }

      try {
        const deptSnap = await getDocs(collection(window.db, "departments"));
        if (!deptSnap.empty) {
          departments = deptSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (e) {}

      try {
        const posSnap = await getDocs(collection(window.db, "positions"));
        if (!posSnap.empty) {
          positions = posSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (e) {}

      try {
        const attSnap = await getDocs(collection(window.db, "attendance"));
        if (!attSnap.empty) {
          attendance = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (e) {}

      try {
        const delSnap = await getDocs(collection(window.db, "deleted_employees"));
        if (!delSnap.empty) {
          deletedEmployees = delSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (e) {}

      try {
        const logoDoc = await getDoc(doc(window.db, "system_settings", "global_logo"));
        if (logoDoc.exists()) {
          globalLogo = logoDoc.data();
        }
      } catch (e) {}
    }

    window.updatePersonnelBackupProgress(75, "กำลังสร้างไฟล์ JSON สำรองข้อมูล...", "รวบรวมทุกโครงสร้างและบันทึกเวลา", true, "bg-primary");

    const now = new Date();
    const backupPayload = {
      version: "2.5",
      systemType: "Flora Garden Personnel & Org Chart System",
      backupTimestamp: now.toISOString(),
      backupDateThai: now.toLocaleString('th-TH'),
      totalEmployees: employees.length,
      employees: employees,
      orgStructure: orgTree,
      departments: departments,
      positions: positions,
      attendance: attendance,
      deletedEmployees: deletedEmployees,
      globalLogo: globalLogo,
      systemSettings: {
        lastBackupBy: window.personnelAccess?.email || 'admin',
        orgName: window.getFloraProjectTitle ? window.getFloraProjectTitle() : 'โครงการรัตนบุปผา'
      }
    };

    const jsonStr = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const filename = window.getThaiPersonnelBackupFilename('flora_personnel_backup', 'json');

    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadLink.href);

    window.updatePersonnelBackupProgress(100, "สำรองข้อมูล JSON สำเร็จ 100%", `บันทึกไฟล์ "${filename}" เรียบร้อยแล้ว`, true, "bg-primary");
    if (typeof window.showToast === 'function') window.showToast("🟢 ดาวน์โหลดไฟล์สำรองระบบงานบุคคล (.json) เรียบร้อยแล้ว!");
  } catch (err) {
    console.error("Personnel JSON backup error:", err);
    window.updatePersonnelBackupProgress(0, "เกิดข้อผิดพลาดในการสำรองข้อมูล", err.message, true, "bg-danger");
    if (typeof window.showToast === 'function') window.showToast(`⚠️ เกิดข้อผิดพลาด: ${err.message}`);
  }
};

// 3. Export Personnel Data as ZIP Package
window.downloadPersonnelBackupZIP = async function() {
  try {
    const JSZipLib = window.JSZip || (typeof JSZip !== 'undefined' ? JSZip : null);
    if (!JSZipLib) {
      alert("กำลังเตรียมไลบรารี Zip กรุณาลองใหม่อีกครั้งใน 2 วินาที");
      return;
    }

    window.updatePersonnelBackupProgress(15, "กำลังเตรียมโครงสร้างแพ็กเกจ ZIP...", "รวบรวมข้อมูลสารบบและผังองค์กร", true, "bg-success");
    if (typeof window.showToast === 'function') window.showToast("⏳ กำลังสร้างไฟล์ ZIP สำรองระบบงานบุคคล...");

    let employees = safePersonnelClone(window.employees || []);
    let orgTree = typeof window.getFloraOrgTree === 'function' ? window.getFloraOrgTree() : null;
    let departments = safePersonnelClone(window.departmentsList || []);
    let positions = safePersonnelClone(window.positionsList || []);
    let attendance = safePersonnelClone(window.attendanceLogs || window.attendance || []);
    let deletedEmployees = safePersonnelClone(window.deletedEmployees || []);

    const now = new Date();
    const backupPayload = {
      version: "2.5",
      systemType: "Flora Garden Personnel & Org Chart System",
      backupTimestamp: now.toISOString(),
      backupDateThai: now.toLocaleString('th-TH'),
      totalEmployees: employees.length,
      employees: employees,
      orgStructure: orgTree,
      departments: departments,
      positions: positions,
      attendance: attendance,
      deletedEmployees: deletedEmployees
    };

    const zip = new JSZipLib();
    zip.file("personnel_data.json", JSON.stringify(backupPayload, null, 2));

    window.updatePersonnelBackupProgress(60, "กำลังบีบอัดไฟล์และสร้าง ZIP...", "สร้างไฟล์ flora_personnel_backup.zip", true, "bg-success");

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const filename = window.getThaiPersonnelBackupFilename('flora_personnel_backup', 'zip');

    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(zipBlob);
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadLink.href);

    window.updatePersonnelBackupProgress(100, "สำรองข้อมูล ZIP สำเร็จ 100%", `ดาวน์โหลดไฟล์ "${filename}" สำเร็จ`, true, "bg-success");
    if (typeof window.showToast === 'function') window.showToast("🟢 ดาวน์โหลดไฟล์ ZIP สำรองระบบบุคคลเรียบร้อยแล้ว!");
  } catch (err) {
    console.error("Personnel ZIP backup error:", err);
    window.updatePersonnelBackupProgress(0, "เกิดข้อผิดพลาดในการสร้างไฟล์ ZIP", err.message, true, "bg-danger");
  }
};

// 4. Force Sync from Cloud Firestore
window.syncPersonnelFromCloudFirestore = async function() {
  if (!window.db) {
    alert("ระบบยังไม่ได้เชื่อมต่อ Cloud Firestore หรืออยู่ในโหมดออฟไลน์");
    return;
  }

  try {
    window.updatePersonnelBackupProgress(20, "กำลังซิงค์ข้อมูลจาก Cloud Firestore...", "ดึงข้อมูลบุคลากร ผังองค์กร และเวลาเข้า-ออก", true, "bg-info");
    if (typeof window.showToast === 'function') window.showToast("🔄 กำลังซิงค์ข้อมูลบุคลากรจาก Firestore...");

    if (typeof window.reloadEmployeeData === 'function') {
      await window.reloadEmployeeData();
    } else {
      const snap = await getDocs(collection(window.db, "employees"));
      if (!snap.empty) {
        window.employees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (typeof window.syncToLocalStorage === 'function') window.syncToLocalStorage();
        if (typeof window.renderOrgChart === 'function') window.renderOrgChart(true);
        if (typeof window.renderPersonnelDirectory === 'function') window.renderPersonnelDirectory();
      }
    }

    await window.refreshPersonnelBackupModalStats();
    window.updatePersonnelBackupProgress(100, "ซิงค์ข้อมูลจาก Cloud Firestore สำเร็จ 100%", "ข้อมูลทั้งหมดเป็นปัจจุบันแล้ว", true, "bg-success");
    if (typeof window.showToast === 'function') window.showToast("✅ ซิงค์ข้อมูลระบบงานบุคคลทั้งหมดจาก Firestore เรียบร้อยแล้ว!");
  } catch (err) {
    console.error("Sync error:", err);
    window.updatePersonnelBackupProgress(0, "เกิดข้อผิดพลาดในการซิงค์", err.message, true, "bg-danger");
  }
};

// 5. Handle Restore File Selected
window.handlePersonnelRestoreFileSelected = async function(event) {
  const file = event.target.files ? event.target.files[0] : null;
  if (!file) return;

  const isZip = file.name.endsWith('.zip') || file.type.includes('zip');
  if (isZip) {
    const JSZipLib = window.JSZip || (typeof JSZip !== 'undefined' ? JSZip : null);
    if (!JSZipLib) {
      alert("กำลังเตรียมไลบรารี Zip กรุณารอสักครู่");
      return;
    }
    try {
      const zip = await JSZipLib.loadAsync(file);
      let jsonFile = zip.file("personnel_data.json") || zip.file("flora_garden_backup_data.json") || zip.file(/^.*\.json$/i)[0];
      if (!jsonFile) {
        alert("⚠️ ไม่พบไฟล์ข้อมูล .json ในไฟล์ ZIP สำรองนี้");
        return;
      }
      const jsonContent = await jsonFile.async("string");
      const parsed = JSON.parse(jsonContent);
      tempParsedPersonnelRestoreData = parsed;
      window.displayPersonnelRestoreSummary(parsed, file.name);
    } catch (err) {
      alert("⚠️ ไม่สามารถอ่านไฟล์ ZIP ได้: " + err.message);
    }
  } else {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || typeof parsed !== 'object' || (!parsed.employees && !parsed.employeeList && !parsed.orgStructure)) {
          alert("⚠️ ไฟล์ที่เลือกไม่ใช่ไฟล์สำรองระบบงานบุคคลหรือผังองค์กรที่ถูกต้อง");
          return;
        }
        tempParsedPersonnelRestoreData = parsed;
        window.displayPersonnelRestoreSummary(parsed, file.name);
      } catch (err) {
        alert("⚠️ ไม่สามารถอ่านไฟล์สำรองได้ รูปแบบไฟล์ JSON ไม่ถูกต้อง: " + err.message);
      }
    };
    reader.readAsText(file);
  }
};

// 6. Display Restore Summary
window.displayPersonnelRestoreSummary = function(parsed, fileName) {
  const nameSpan = document.getElementById('personnelRestoreFileName');
  if (nameSpan && fileName) nameSpan.textContent = fileName;

  const detailsBox = document.getElementById('personnelRestoreSummaryDetails');
  if (detailsBox) {
    const empList = parsed.employees || parsed.employeeList || [];
    const empC = empList.length;
    const attList = parsed.attendance || parsed.attendanceLogs || [];
    const attC = attList.length;
    const delList = parsed.deletedEmployees || [];
    const delC = delList.length;
    const hasTree = Boolean(parsed.orgStructure || parsed.tree);

    let depC = (parsed.departments || parsed.departmentsList || []).length;
    let posC = (parsed.positions || parsed.positionsList || []).length;
    if (depC === 0) {
      const s = new Set();
      empList.forEach(e => { if (e && e.department) s.add(e.department); });
      depC = s.size;
    }
    if (posC === 0) {
      const s = new Set();
      empList.forEach(e => { if (e && e.position) s.add(e.position); });
      posC = s.size;
    }

    detailsBox.innerHTML = `
      <div class="col-6 col-md-4">• รายชื่อบุคลากร: <strong class="text-success">${empC}</strong> คน</div>
      <div class="col-6 col-md-4">• โครงสร้างผังองค์กร: <strong class="text-primary">${hasTree ? 'มีโครงสร้างพร้อมใช้งาน' : 'ไม่มี'}</strong></div>
      <div class="col-6 col-md-4">• บันทึกเวลาเข้า-ออก/การลา: <strong class="text-info">${attC}</strong> รายการ</div>
      <div class="col-6 col-md-4">• แผนก / สายงาน: <strong class="text-dark">${depC}</strong> แผนก</div>
      <div class="col-6 col-md-4">• ตำแหน่งงาน: <strong class="text-secondary">${posC}</strong> ตำแหน่ง</div>
      <div class="col-6 col-md-4">• บุคลากรในถังขยะ: <strong class="text-danger">${delC}</strong> คน</div>
      <div class="col-12 text-success fw-semibold mt-1"><i class="bi bi-check-circle-fill me-1"></i> ไฟล์สำรองนี้สมบูรณ์ พร้อมกู้คืนเข้าสู่ระบบและ Cloud Firestore</div>
    `;
  }

  const previewCard = document.getElementById('personnelRestorePreviewCard');
  if (previewCard) previewCard.classList.remove('d-none');

  const btnRestore = document.getElementById('btnExecutePersonnelRestore');
  if (btnRestore) btnRestore.classList.remove('d-none');
};

// 7. Execute Restore Personnel Database
window.executePersonnelRestoreDatabase = async function() {
  if (!tempParsedPersonnelRestoreData) {
    alert("กรุณาเลือกไฟล์สำรองข้อมูลก่อน");
    return;
  }

  const modeElem = document.querySelector('input[name="personnelRestoreMode"]:checked');
  const mode = modeElem ? modeElem.value : 'REPLACE';

  const ok = confirm(`ยืนยันการกู้คืนข้อมูลระบบงานบุคคล (${mode === 'REPLACE' ? 'เขียนทับข้อมูลเดิมทั้งหมด' : 'รวมข้อมูลเข้าด้วยกัน'}) หรือไม่?`);
  if (!ok) return;

  try {
    window.updatePersonnelBackupProgress(10, "กำลังเริ่มต้นกู้คืนระบบงานบุคคล...", "อ่านข้อมูลจากไฟล์สำรอง", true, "bg-warning");
    if (typeof window.showToast === 'function') window.showToast("⏳ กำลังเริ่มกู้คืนข้อมูลระบบงานบุคคล...");

    const rawEmps = tempParsedPersonnelRestoreData.employees || tempParsedPersonnelRestoreData.employeeList || [];
    const rawTree = tempParsedPersonnelRestoreData.orgStructure || tempParsedPersonnelRestoreData.tree || null;
    const rawDepts = tempParsedPersonnelRestoreData.departments || tempParsedPersonnelRestoreData.departmentsList || [];
    const rawPositions = tempParsedPersonnelRestoreData.positions || tempParsedPersonnelRestoreData.positionsList || [];
    const rawAttendance = tempParsedPersonnelRestoreData.attendance || tempParsedPersonnelRestoreData.attendanceLogs || [];
    const rawDeleted = tempParsedPersonnelRestoreData.deletedEmployees || [];
    const rawLogo = tempParsedPersonnelRestoreData.globalLogo || null;

    let targetEmps = [];
    if (mode === 'REPLACE') {
      targetEmps = rawEmps.map(e => ({ ...e }));
    } else {
      const existing = window.employees || [];
      const empMap = new Map();
      existing.forEach(e => { empMap.set(e.id || e.code, { ...e }); });
      rawEmps.forEach(e => {
        const key = e.id || e.code;
        if (empMap.has(key)) {
          empMap.set(key, { ...empMap.get(key), ...e });
        } else {
          empMap.set(key, { ...e });
        }
      });
      targetEmps = Array.from(empMap.values());
    }

    window.updatePersonnelBackupProgress(40, "กำลังบันทึกรายชื่อบุคลากรและโครงสร้างผัง...", "อัปเดต Local State และ Memory", true, "bg-warning");

    window.employees = targetEmps;
    if (typeof window.syncToLocalStorage === 'function') window.syncToLocalStorage();

    // Restore Org Tree
    if (rawTree) {
      try {
        localStorage.setItem('flora_org_tree_v2', JSON.stringify(rawTree));
        localStorage.setItem('flora_org_tree_data', JSON.stringify(rawTree));
        if (typeof window.applyImportedOrgTree === 'function') {
          window.applyImportedOrgTree(rawTree);
        }
      } catch(e) {}
    }

    // Sync to Firestore
    if (window.db) {
      window.updatePersonnelBackupProgress(70, "กำลังบันทึกลง Cloud Firestore...", "เขียนเอกสาร collection employees และ org_structure", true, "bg-warning");

      if (mode === 'REPLACE') {
        try {
          const oldSnap = await getDocs(collection(window.db, "employees"));
          const newIds = new Set(targetEmps.map(e => e.id || e.code));
          for (const docSnap of oldSnap.docs) {
            if (!newIds.has(docSnap.id)) {
              await deleteDoc(doc(window.db, "employees", docSnap.id));
            }
          }
        } catch(e) {}
      }

      for (const emp of targetEmps) {
        const docId = emp.id || emp.code;
        if (docId) {
          await setDoc(doc(window.db, "employees", docId), emp, { merge: true });
        }
      }

      if (rawTree) {
        try {
          await setDoc(doc(window.db, "org_structure", "main"), {
            format: "FLORA_ORG_TREE",
            version: 2,
            tree: rawTree,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch(e) {}
      }

      if (Array.isArray(rawAttendance) && rawAttendance.length > 0) {
        for (const att of rawAttendance) {
          if (att && att.id) {
            await setDoc(doc(window.db, "attendance", att.id), att, { merge: true });
          }
        }
      }

      if (Array.isArray(rawDeleted) && rawDeleted.length > 0) {
        for (const del of rawDeleted) {
          const delId = del.id || del.code || del.originalId;
          if (delId) {
            await setDoc(doc(window.db, "deleted_employees", delId), del, { merge: true });
          }
        }
      }

      if (rawLogo) {
        try {
          await setDoc(doc(window.db, "system_settings", "global_logo"), rawLogo, { merge: true });
        } catch(e) {}
      }
    }

    window.updatePersonnelBackupProgress(90, "กำลังรีเฟรชหน้าจอผังองค์กรและสารบรรณ...", "คำนวณและวาดแผนผังใหม่", true, "bg-warning");

    if (typeof window.syncFloraEmployeesToTree === 'function') window.syncFloraEmployeesToTree(true);
    if (typeof window.renderOrgChart === 'function') window.renderOrgChart(true);
    if (typeof window.renderPersonnelDirectory === 'function') window.renderPersonnelDirectory();
    if (typeof window.renderTreeManager === 'function') window.renderTreeManager();
    if (typeof window.renderPersonnelAttendanceControls === 'function') window.renderPersonnelAttendanceControls();

    await window.refreshPersonnelBackupModalStats();

    window.updatePersonnelBackupProgress(100, "กู้คืนระบบงานบุคคลสำเร็จ 100%", "ข้อมูลทั้งหมดถูกกู้คืนและซิงค์เรียบร้อยแล้ว", true, "bg-success");
    if (typeof window.showToast === 'function') window.showToast("🎉 กู้คืนข้อมูลระบบงานบุคคลทั้งหมดเรียบร้อยแล้ว!");
    alert("🎉 กู้คืนข้อมูลระบบงานบุคคลทั้งหมดสำเร็จเรียบร้อยแล้ว!");
  } catch (err) {
    console.error("Execute restore error:", err);
    window.updatePersonnelBackupProgress(0, "เกิดข้อผิดพลาดในการกู้คืน", err.message, true, "bg-danger");
    alert("เกิดข้อผิดพลาดในการกู้คืน: " + err.message);
  }
};
