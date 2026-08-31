// ==================== EQUIPMENT BACKUP & RESTORE MODULE (equipment_backup_restore.js) ====================
import { doc, setDoc, getDocs, collection, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject, 
  getBlob, 
  getBytes 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

let tempParsedEquipmentRestoreData = null;
let equipmentBackupTimerInterval = null;
let equipmentBackupTimerStartTime = null;

function getGlobalToast() {
  return typeof window.showToast === 'function' ? window.showToast : (msg) => console.log("Toast:", msg);
}

function safeJsonClone(obj) {
  try {
    if (typeof window.safeJsonStringify === 'function') {
      return JSON.parse(window.safeJsonStringify(obj || []));
    }
    return JSON.parse(JSON.stringify(obj || []));
  } catch (e) {
    return Array.isArray(obj) ? [...obj] : { ...obj };
  }
}

// 1. Refresh Live Stats in Modal
window.refreshEquipmentBackupModalStats = function() {
  const equipments = window.equipmentList || [];
  const transactions = window.transactionLogs || window.transactions || [];
  const categories = window.categoriesList || [];
  const locations = window.locationsList || [];
  
  let imageCount = 0;
  equipments.forEach(item => {
    if (item && item.imageUrl) imageCount++;
  });

  const elEquip = document.getElementById('equipBackupStatCountEquip');
  const elTx = document.getElementById('equipBackupStatCountTx');
  const elCat = document.getElementById('equipBackupStatCountCat');
  const elLoc = document.getElementById('equipBackupStatCountLoc');
  const elImg = document.getElementById('equipBackupStatCountImg');

  if (elEquip) elEquip.textContent = `${equipments.length} รายการ`;
  if (elTx) elTx.textContent = `${transactions.length} รายการ`;
  if (elCat) elCat.textContent = `${categories.length} หมวดหมู่`;
  if (elLoc) elLoc.textContent = `${locations.length} สถานที่`;
  if (elImg) elImg.textContent = `${imageCount} รูปภาพ`;
};

// 2. Open Equipment Backup & Restore Modal (For All Admins)
window.openEquipmentBackupRestoreModal = function() {
  // Check if current user is ADMIN or Super Admin
  const role = window.currentRole || 'WORKER';
  const isSuperAdmin = typeof window.canAccessDatabaseEditor === 'function' ? window.canAccessDatabaseEditor() : false;
  
  if (role !== 'ADMIN' && !isSuperAdmin) {
    getGlobalToast()("⚠️ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเข้าถึงระบบสำรองและกู้คืนข้อมูลพัสดุ-อุปกรณ์");
    return;
  }

  try {
    window.refreshEquipmentBackupModalStats();
    tempParsedEquipmentRestoreData = null;

    if (typeof window.updateEquipmentBackupProgress === 'function') {
      window.updateEquipmentBackupProgress(0, '', '', false);
    }

    const restoreInput = document.getElementById('equipmentRestoreFileInput');
    if (restoreInput) restoreInput.value = '';

    const previewCard = document.getElementById('equipmentRestorePreviewCard');
    if (previewCard) previewCard.classList.add('d-none');

    const btnRestore = document.getElementById('btnExecuteEquipmentRestore');
    if (btnRestore) btnRestore.classList.add('d-none');

    const modalElem = document.getElementById('equipmentBackupRestoreModal');
    if (modalElem && typeof bootstrap !== 'undefined') {
      const modalInst = bootstrap.Modal.getOrCreateInstance(modalElem);
      modalInst.show();
    } else {
      alert("ไม่พบส่วนประกอบ Modal สำรองข้อมูลพัสดุ-อุปกรณ์");
    }
  } catch (err) {
    console.error("Error opening equipment backup modal:", err);
    alert("เกิดข้อผิดพลาดในการเปิดหน้าต่าง: " + err.message);
  }
};

// 3. Timer & Progress Bar Controller
window.startEquipmentBackupTimer = function() {
  if (equipmentBackupTimerInterval) {
    clearInterval(equipmentBackupTimerInterval);
    equipmentBackupTimerInterval = null;
  }
  equipmentBackupTimerStartTime = Date.now();

  const timerElem = document.getElementById('equipmentBackupProgressTimer');
  if (timerElem) timerElem.textContent = '00:00';

  equipmentBackupTimerInterval = setInterval(() => {
    const elapsed = Date.now() - equipmentBackupTimerStartTime;
    const totalSec = Math.max(0, Math.floor(elapsed / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (timerElem) timerElem.textContent = formatted;
  }, 500);
};

window.stopEquipmentBackupTimer = function() {
  if (equipmentBackupTimerInterval) {
    clearInterval(equipmentBackupTimerInterval);
    equipmentBackupTimerInterval = null;
  }
};

window.updateEquipmentBackupProgress = function(percent, title, subText, isRunning = true, colorClass = "bg-success") {
  const container = document.getElementById('equipmentBackupProgressContainer');
  const bar = document.getElementById('equipmentBackupProgressBar');
  const titleEl = document.getElementById('equipmentBackupProgressTitle');
  const textEl = document.getElementById('equipmentBackupProgressText');
  const subEl = document.getElementById('equipmentBackupProgressSubStatus');
  const percentEl = document.getElementById('equipmentBackupProgressPercent');
  const spinner = document.getElementById('equipmentBackupProgressSpinner');

  if (!container || !bar) return;

  if (isRunning) {
    container.classList.remove('d-none');
    if (percent <= 5) {
      window.startEquipmentBackupTimer();
    }
    if (spinner) spinner.classList.remove('d-none');
  } else {
    window.stopEquipmentBackupTimer();
    if (spinner) spinner.classList.add('d-none');
    if (percent === 0) {
      container.classList.add('d-none');
      return;
    }
  }

  const p = Math.min(100, Math.max(0, Math.round(percent)));
  bar.style.width = `${p}%`;
  bar.textContent = `${p}%`;
  bar.className = `progress-bar progress-bar-striped progress-bar-animated ${colorClass} fw-bold fs-8`;

  if (percentEl) percentEl.textContent = `${p}%`;
  if (titleEl && title) titleEl.textContent = title;
  if (textEl && subText) textEl.textContent = subText;
  if (subEl) {
    if (p >= 100) {
      subEl.innerHTML = '<i class="bi bi-check-circle-fill text-success me-1"></i>ดำเนินการเสร็จสมบูรณ์ 100%';
    } else {
      subEl.innerHTML = '<i class="bi bi-arrow-repeat text-primary me-1"></i>กำลังประมวลผลข้อมูล...';
    }
  }
};

// 4. Download Equipment Backup JSON
window.downloadEquipmentBackupJSON = async function() {
  try {
    window.updateEquipmentBackupProgress(15, "กำลังรวบรวมข้อมูลระบบพัสดุ-อุปกรณ์...", "ดึงข้อมูลจากหน่วยความจำและระบบ Firestore", true, "bg-success");
    
    // Ensure latest data from Firestore if available
    let equipments = window.equipmentList || [];
    let transactions = window.transactionLogs || window.transactions || [];
    let categories = window.categoriesList || [];
    let locations = window.locationsList || [];

    if (window.db && window.isFirebaseReady) {
      window.updateEquipmentBackupProgress(35, "กำลังตรวจสอบข้อมูลล่าสุดบนคลาวด์...", "เชื่อมต่อ Firestore คอลเลกชัน equipments, transactions, categories, locations", true, "bg-success");
      try {
        const [eqSnap, txSnap, catSnap, locSnap] = await Promise.all([
          getDocs(collection(window.db, 'equipments')),
          getDocs(collection(window.db, 'transactions')),
          getDocs(collection(window.db, 'categories')),
          getDocs(collection(window.db, 'locations'))
        ]);
        if (!eqSnap.empty) equipments = eqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!txSnap.empty) transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!catSnap.empty) categories = catSnap.docs.map(d => d.data().name || d.id);
        if (!locSnap.empty) locations = locSnap.docs.map(d => d.data().name || d.id);
      } catch (err) {
        console.warn("Firestore pull fallback to memory:", err);
      }
    }

    window.updateEquipmentBackupProgress(75, "กำลังจัดโครงสร้างไฟล์สำรอง...", "สร้างไฟล์ JSON มาตรฐานความปลอดภัย", true, "bg-success");

    const exportPayload = {
      system: "FloraGarden_Equipment_System",
      version: "3.0",
      type: "EQUIPMENT_MODULE_BACKUP",
      createdAt: new Date().toISOString(),
      createdBy: window.currentAuthUser?.email || window.currentUserProfile?.email || 'admin',
      data: {
        equipments: safeJsonClone(equipments),
        transactions: safeJsonClone(transactions),
        categories: safeJsonClone(categories),
        locations: safeJsonClone(locations)
      },
      stats: {
        equipmentCount: equipments.length,
        transactionCount: transactions.length,
        categoryCount: categories.length,
        locationCount: locations.length
      }
    };

    const dateStr = typeof window.getThaiDateTimeFilenameString === 'function' ? window.getThaiDateTimeFilenameString() : new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `Flora_Equipment_Backup_${dateStr}.json`;
    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    window.updateEquipmentBackupProgress(100, "สำรองข้อมูลพัสดุ-อุปกรณ์สำเร็จ!", `บันทึกไฟล์ ${filename} เรียบร้อยแล้ว`, false, "bg-success");
    getGlobalToast()(`✅ ส่งออกไฟล์สำรองพัสดุ-อุปกรณ์เรียบร้อยแล้ว (${equipments.length} อุปกรณ์, ${transactions.length} รายการ)`);
  } catch (err) {
    console.error("Error exporting equipment backup:", err);
    window.updateEquipmentBackupProgress(100, "เกิดข้อผิดพลาดในการสำรองข้อมูล", err.message, false, "bg-danger");
    alert("เกิดข้อผิดพลาด: " + err.message);
  }
};

// 5. Select Restore File & Parse
window.handleEquipmentRestoreFileSelected = function(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const content = e.target.result;
      const parsed = JSON.parse(content);

      if (!parsed || (!parsed.data && !parsed.equipments && !parsed.equipmentList)) {
        throw new Error("ไฟล์ JSON นี้ไม่มีรูปแบบข้อมูลของระบบพัสดุ-อุปกรณ์");
      }

      // Normalize data
      const dataObj = parsed.data || parsed;
      const equipments = Array.isArray(dataObj.equipments) ? dataObj.equipments : (Array.isArray(dataObj.equipmentList) ? dataObj.equipmentList : []);
      const transactions = Array.isArray(dataObj.transactions) ? dataObj.transactions : (Array.isArray(dataObj.transactionLogs) ? dataObj.transactionLogs : []);
      const categories = Array.isArray(dataObj.categories) ? dataObj.categories : (Array.isArray(dataObj.categoriesList) ? dataObj.categoriesList : []);
      const locations = Array.isArray(dataObj.locations) ? dataObj.locations : (Array.isArray(dataObj.locationsList) ? dataObj.locationsList : []);

      tempParsedEquipmentRestoreData = {
        raw: parsed,
        equipments,
        transactions,
        categories,
        locations
      };

      // Show preview card
      const previewCard = document.getElementById('equipmentRestorePreviewCard');
      const btnRestore = document.getElementById('btnExecuteEquipmentRestore');
      
      const pEquip = document.getElementById('previewEquipCount');
      const pTx = document.getElementById('previewTxCount');
      const pCat = document.getElementById('previewCatCount');
      const pLoc = document.getElementById('previewLocCount');
      const pDate = document.getElementById('previewFileDate');

      if (pEquip) pEquip.textContent = `${equipments.length} รายการ`;
      if (pTx) pTx.textContent = `${transactions.length} รายการ`;
      if (pCat) pCat.textContent = `${categories.length} หมวดหมู่`;
      if (pLoc) pLoc.textContent = `${locations.length} สถานที่`;
      if (pDate) pDate.textContent = parsed.createdAt ? new Date(parsed.createdAt).toLocaleString('th-TH') : 'ไม่ระบุ';

      if (previewCard) previewCard.classList.remove('d-none');
      if (btnRestore) btnRestore.classList.remove('d-none');

      getGlobalToast()(`📂 อ่านไฟล์สำเร็จ: พบข้อมูลพัสดุ ${equipments.length} รายการ พร้อมสำหรับกู้คืน`);
    } catch (err) {
      console.error("Error parsing restore JSON:", err);
      alert("ไฟล์ไม่ถูกต้อง: " + err.message);
    }
  };
  reader.readAsText(file);
};

// 6. Execute Restore to Firestore & Memory
window.executeEquipmentRestore = async function() {
  if (!tempParsedEquipmentRestoreData) {
    alert("กรุณาเลือกไฟล์สำรองก่อนดำเนินการ");
    return;
  }

  const { equipments, transactions, categories, locations } = tempParsedEquipmentRestoreData;
  const isAppend = document.getElementById('equipRestoreModeAppend')?.checked || false;

  const modeText = isAppend ? "กู้คืนแบบ 'เพิ่มต่อท้าย' (รักษาข้อมูลเดิมไว้)" : "กู้คืนแบบ 'แทนที่ทั้งหมด' (ล้างข้อมูลเก่าและแทนที่ด้วยชุดใหม่)";
  if (!confirm(`⚠️ ยืนยันการกู้คืนข้อมูลพัสดุ-อุปกรณ์?\n\nรูปแบบ: ${modeText}\n- พัสดุ: ${equipments.length} รายการ\n- ประวัติ: ${transactions.length} รายการ\n\nต้องการดำเนินการต่อหรือไม่?`)) {
    return;
  }

  try {
    window.updateEquipmentBackupProgress(10, "เริ่มต้นกระบวนการกู้คืนข้อมูล...", "กำลังเตรียมการเขียนข้อมูลลงฐานข้อมูล", true, "bg-warning");

    if (window.db && window.isFirebaseReady) {
      // 1. Handle Equipments
      window.updateEquipmentBackupProgress(25, "กำลังบันทึกข้อมูลพัสดุและอุปกรณ์...", `ประมวลผล ${equipments.length} รายการ`, true, "bg-warning");
      
      if (!isAppend) {
        // Clear existing equipments in Firestore
        const oldEqSnap = await getDocs(collection(window.db, 'equipments'));
        const newIds = new Set(equipments.map(e => e.id || e.code).filter(Boolean));
        for (const docSnap of oldEqSnap.docs) {
          if (!newIds.has(docSnap.id)) {
            await deleteDoc(doc(window.db, 'equipments', docSnap.id));
          }
        }
      }

      for (let i = 0; i < equipments.length; i++) {
        const item = equipments[i];
        const docId = String(item.id || item.code || `eq_${i + 1}`);
        await setDoc(doc(window.db, 'equipments', docId), item, { merge: true });
        
        if (i % 5 === 0 || i === equipments.length - 1) {
          const progress = 25 + Math.round((i / equipments.length) * 35);
          window.updateEquipmentBackupProgress(progress, "กำลังบันทึกข้อมูลพัสดุและอุปกรณ์...", `บันทึกแล้ว ${i + 1}/${equipments.length} รายการ`, true, "bg-warning");
        }
      }

      // 2. Handle Transactions
      window.updateEquipmentBackupProgress(65, "กำลังบันทึกประวัติเบิก-จ่าย-ยืม-คืน...", `ประมวลผล ${transactions.length} รายการ`, true, "bg-warning");
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        const txId = String(tx.id || `tx_${i + 1}`);
        await setDoc(doc(window.db, 'transactions', txId), tx, { merge: true });
      }

      // 3. Handle Categories & Locations
      window.updateEquipmentBackupProgress(85, "กำลังจัดระเบียบหมวดหมู่และสถานที่...", "อัปเดตข้อมูลโครงสร้างคลัง", true, "bg-warning");
      for (const cat of categories) {
        const name = typeof cat === 'object' ? (cat.name || cat.id) : String(cat);
        if (name) await setDoc(doc(window.db, 'categories', name), { name, updatedAt: new Date().toISOString() }, { merge: true });
      }
      for (const loc of locations) {
        const name = typeof loc === 'object' ? (loc.name || loc.id) : String(loc);
        if (name) await setDoc(doc(window.db, 'locations', name), { name, updatedAt: new Date().toISOString() }, { merge: true });
      }
    }

    // Update in-memory state
    if (isAppend) {
      const existingEquipIds = new Set((window.equipmentList || []).map(e => String(e.id || e.code)));
      const filteredNew = equipments.filter(e => !existingEquipIds.has(String(e.id || e.code)));
      window.equipmentList = [...(window.equipmentList || []), ...filteredNew];
    } else {
      window.equipmentList = [...equipments];
      if (transactions.length > 0) window.transactionLogs = [...transactions];
    }

    if (typeof window.syncToLocalStorage === 'function') {
      window.syncToLocalStorage();
    }
    if (typeof window.renderEquipmentTable === 'function') {
      window.renderEquipmentTable();
    }
    if (typeof window.updateAllStats === 'function') {
      window.updateAllStats();
    }
    window.refreshEquipmentBackupModalStats();

    window.updateEquipmentBackupProgress(100, "กู้คืนข้อมูลพัสดุ-อุปกรณ์สำเร็จ!", "ข้อมูลทั้งหมดถูกบันทึกและพร้อมใช้งานทันที", false, "bg-success");
    getGlobalToast()("🎉 กู้คืนข้อมูลพัสดุและอุปกรณ์เรียบร้อยสมบูรณ์!");
  } catch (err) {
    console.error("Error executing equipment restore:", err);
    window.updateEquipmentBackupProgress(100, "เกิดข้อผิดพลาดในการกู้คืนข้อมูล", err.message, false, "bg-danger");
    alert("เกิดข้อผิดพลาด: " + err.message);
  }
};
