const fs = require('fs');

let script = fs.readFileSync('script.js', 'utf8');

// 1. Find indices for continuous emp block
const startMarker = "// Continuous scanning mode for employee badge";
const endMarker = "        activeScannerDetectedEmpId = emp.id;\n        activeScannedItemId = null;";

const pStart = script.indexOf(startMarker);
const pEnd = script.indexOf(endMarker, pStart);

if (pStart === -1 || pEnd === -1) {
  console.error("Markers not found:", pStart, pEnd);
  process.exit(1);
}

const replacementContinuous = `// Continuous scanning mode for employee badge
        if (window.isContinuousCartScanning || isTransModalActive || isScannerModalOpen) {
          const isStaffOrAdmin = (typeof window.isStaffOrAdminEmp === 'function') && window.isStaffOrAdminEmp(emp);
          const currentEmpSelect = document.getElementById('empSelect');
          const existingEmpId = currentEmpSelect ? currentEmpSelect.value : (window.activeScannerDetectedEmpId || null);
          const existingEmp = (existingEmpId && typeof employeeList !== 'undefined' && Array.isArray(employeeList)) 
            ? employeeList.find(e => e && e.id === existingEmpId) 
            : null;
          const hasExistingWorker = existingEmp && !(typeof window.isStaffOrAdminEmp === 'function' && window.isStaffOrAdminEmp(existingEmp));
          const hasItems = (typeof selectedTransItems !== 'undefined' && Array.isArray(selectedTransItems) && selectedTransItems.length > 0) ||
                           (window.scannerReturnMode && window.scannerActiveReturnItems && window.scannerActiveReturnItems.length > 0);

          // กรณีที่ 1: พนักงานทั่วไปสแกนของและบัตรตัวเองไว้แล้ว และมีเจ้าหน้าที่/แอดมินมาสแกนบัตรเพื่ออนุมัติ
          if (isStaffOrAdmin && hasExistingWorker && hasItems) {
            window.authorizedStaffOperator = emp;
            showToast(\`⚡ เจ้าหน้าที่ "\${typeof formatEmpName === 'function' ? formatEmpName(emp) : emp.name}" อนุมัติสำเร็จ! กำลังบันทึกข้อมูลทันที...\`);
            setTimeout(() => {
              if (window.scannerReturnMode && window.scannerActiveReturnItems && window.scannerActiveReturnItems.length > 0) {
                if (typeof window.confirmAllReturnsFromScanner === 'function') {
                  window.confirmAllReturnsFromScanner();
                }
              } else {
                if (typeof window.saveTransactionDirectlyFromScanner === 'function') {
                  window.saveTransactionDirectlyFromScanner();
                }
              }
            }, 300);
            return;
          }

          // กรณีที่ 2: ตั้งค่าผู้ทำรายการตามปกติ (หรือกรณีเจ้าหน้าที่/แอดมินมาทำรายการเบิกด้วยตนเอง)
          if (typeof selectEmployeeToFormDirectly === 'function') {
            selectEmployeeToFormDirectly(emp);
          } else if (typeof selectEmployeeForTransaction === 'function') {
            selectEmployeeForTransaction(emp.id);
          } else {
            const searchInput = document.getElementById('transEmpSearchInput');
            if (searchInput) {
              searchInput.value = emp.name;
            }
            const select = document.getElementById('empSelect');
            if (select) select.value = emp.id;
          }
          const empBox = document.getElementById('transEmpSearchResultsBox');
          if (empBox) {
            empBox.classList.add('d-none');
            empBox.innerHTML = '';
          }
          activeScannerDetectedEmpId = emp.id;
          window.scannerActiveReturnEmployee = emp;
          if (isStaffOrAdmin) {
            window.authorizedStaffOperator = emp;
          } else {
            window.authorizedStaffOperator = null;
          }
          if (typeof window.updateScannerOperatorUI === 'function') {
            window.updateScannerOperatorUI(emp);
          }
          const lastItemText = document.getElementById('continuousScanLastItemText');
          if (lastItemText) {
            lastItemText.innerHTML = '';
          }
          const contBanner = document.getElementById('continuousScanBanner');
          if (contBanner) contBanner.classList.add('d-none');
          if (empCard) empCard.classList.add('d-none');

          // ตรวจสอบว่าพนักงานท่านนี้มีอุปกรณ์ที่ยืมค้างส่งคืนหรือไม่
          const unreturnedList = (typeof window.getEmployeeActiveUnreturnedList === 'function')
            ? window.getEmployeeActiveUnreturnedList(emp.id, emp.name)
            : [];
          if (unreturnedList && unreturnedList.length > 0) {
            window.scannerReturnMode = true;
            window.scannerActiveReturnItems = unreturnedList;
            if (typeof window.updateScannerEquipmentListUI === 'function') {
              window.updateScannerEquipmentListUI();
            }
            if (isStaffOrAdmin) {
              showToast(\`👤 เจ้าหน้าที่/แอดมิน "\${typeof formatEmpName === 'function' ? formatEmpName(emp) : emp.name}" มียืมค้าง \${unreturnedList.length} รายการ (สามารถกดคืนหรือยืมเพิ่มได้ทันที)\`);
            } else {
              showToast(\`📋 พนักงาน "\${typeof formatEmpName === 'function' ? formatEmpName(emp) : emp.name}" มียืมอุปกรณ์ค้างส่งคืน \${unreturnedList.length} รายการ (สแกนบัตรเจ้าหน้าที่เพื่อบันทึก)\`);
            }
          } else {
            window.scannerReturnMode = false;
            window.scannerActiveReturnItems = [];
            if (typeof window.updateScannerEquipmentListUI === 'function') {
              window.updateScannerEquipmentListUI();
            }
            if (isStaffOrAdmin) {
              showToast(\`👤 เจ้าหน้าที่/แอดมิน "\${typeof formatEmpName === 'function' ? formatEmpName(emp) : emp.name}" พร้อมทำรายการ (กดปุ่มบันทึกได้ทันที)\`);
            } else {
              showToast(\`👤 สแกนพบผู้ทำรายการ: "\${typeof formatEmpName === 'function' ? formatEmpName(emp) : emp.name}" [\${emp.id}] (สแกนบัตรเจ้าหน้าที่เพื่อบันทึก)\`);
            }
          }
          return;
        }

`;

script = script.substring(0, pStart) + replacementContinuous + script.substring(pEnd);
console.log("1. Continuous block replaced cleanly");

// 2. Add approvedBy to handleTransactionSubmit
const oldNewTxBlock = `      const docNo = 'DOC-' + String(Date.now()).slice(-6);
      const newTx = {
        id: 'tx-' + String(Date.now()).slice(-6),
        docNo: docNo,
        type: type,
        employeeId: emp.id,
        employeeName: \`\${emp.name} (\${emp.department || 'แผนกทั่วไป'})\`,
        employeeCode: emp.code || emp.id,
        employeeDepartment: emp.department || 'แผนกทั่วไป',`;

const newNewTxBlock = `      const docNo = 'DOC-' + String(Date.now()).slice(-6);
      let approverEmp = window.authorizedStaffOperator || null;
      if (!approverEmp && (typeof window.isStaffOrAdminEmp === 'function') && window.isStaffOrAdminEmp(emp)) {
        approverEmp = emp;
      }
      const approverName = approverEmp 
        ? (typeof formatEmpName === 'function' ? formatEmpName(approverEmp) : approverEmp.name)
        : ((typeof currentRole !== 'undefined' && currentRole !== 'WORKER') ? \`ผู้ดูแลระบบ (\${currentRole})\` : 'เจ้าหน้าที่');
      const newTx = {
        id: 'tx-' + String(Date.now()).slice(-6),
        docNo: docNo,
        type: type,
        employeeId: emp.id,
        employeeName: \`\${emp.name} (\${emp.department || 'แผนกทั่วไป'})\`,
        employeeCode: emp.code || emp.id,
        employeeDepartment: emp.department || 'แผนกทั่วไป',
        approvedById: approverEmp?.id || '',
        approvedByName: approverName,`;

if (!script.includes(oldNewTxBlock)) {
  console.error("oldNewTxBlock not found");
  process.exit(1);
}
script = script.replace(oldNewTxBlock, newNewTxBlock);
console.log("2. Added approvedBy to handleTransactionSubmit");

// 3. Add approvedBy to confirmSingleReturnFromScanner
const oldSingleTxBlock = `      const docNo = 'DOC-' + String(Date.now()).slice(-6);
      const newTx = {
        id: 'tx-' + String(Date.now()).slice(-6),
        docNo: docNo,
        type: 'คืนอุปกรณ์',
        employeeId: emp ? emp.id : 'UNKNOWN',
        employeeName: empName,
        employeeCode: emp ? (emp.code || emp.id) : '',
        employeeDepartment: emp ? (emp.department || 'ทั่วไป') : 'ทั่วไป',`;

const newSingleTxBlock = `      const docNo = 'DOC-' + String(Date.now()).slice(-6);
      let approverEmp = window.authorizedStaffOperator || null;
      if (!approverEmp && emp && (typeof window.isStaffOrAdminEmp === 'function') && window.isStaffOrAdminEmp(emp)) {
        approverEmp = emp;
      }
      const approverName = approverEmp 
        ? (typeof formatEmpName === 'function' ? formatEmpName(approverEmp) : approverEmp.name)
        : ((typeof currentRole !== 'undefined' && currentRole !== 'WORKER') ? \`ผู้ดูแลระบบ (\${currentRole})\` : 'เจ้าหน้าที่');
      const newTx = {
        id: 'tx-' + String(Date.now()).slice(-6),
        docNo: docNo,
        type: 'คืนอุปกรณ์',
        employeeId: emp ? emp.id : 'UNKNOWN',
        employeeName: empName,
        employeeCode: emp ? (emp.code || emp.id) : '',
        employeeDepartment: emp ? (emp.department || 'ทั่วไป') : 'ทั่วไป',
        approvedById: approverEmp?.id || '',
        approvedByName: approverName,`;

if (!script.includes(oldSingleTxBlock)) {
  console.error("oldSingleTxBlock not found");
  process.exit(1);
}
script = script.replace(oldSingleTxBlock, newSingleTxBlock);
console.log("3. Added approvedBy to confirmSingleReturnFromScanner");

// 4. Add approvedBy to confirmAllReturnsFromScanner
const oldAllTxBlock = `      // 2. สร้างเอกสารคืนอุปกรณ์รวม
      const now = new Date();
      const thaiDate = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
      const thaiTime = now.toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute: '2-digit' });
      const docNo = 'DOC-' + String(Date.now()).slice(-6);
      const newTx = {
        id: 'tx-' + String(Date.now()).slice(-6),
        docNo: docNo,
        type: 'คืนอุปกรณ์',
        employeeId: emp ? emp.id : 'UNKNOWN',
        employeeName: empName,
        employeeCode: emp ? (emp.code || emp.id) : '',
        employeeDepartment: emp ? (emp.department || 'ทั่วไป') : 'ทั่วไป',`;

const newAllTxBlock = `      // 2. สร้างเอกสารคืนอุปกรณ์รวม
      const now = new Date();
      const thaiDate = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
      const thaiTime = now.toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute: '2-digit' });
      const docNo = 'DOC-' + String(Date.now()).slice(-6);
      let approverEmp = window.authorizedStaffOperator || null;
      if (!approverEmp && emp && (typeof window.isStaffOrAdminEmp === 'function') && window.isStaffOrAdminEmp(emp)) {
        approverEmp = emp;
      }
      const approverName = approverEmp 
        ? (typeof formatEmpName === 'function' ? formatEmpName(approverEmp) : approverEmp.name)
        : ((typeof currentRole !== 'undefined' && currentRole !== 'WORKER') ? \`ผู้ดูแลระบบ (\${currentRole})\` : 'เจ้าหน้าที่');
      const newTx = {
        id: 'tx-' + String(Date.now()).slice(-6),
        docNo: docNo,
        type: 'คืนอุปกรณ์',
        employeeId: emp ? emp.id : 'UNKNOWN',
        employeeName: empName,
        employeeCode: emp ? (emp.code || emp.id) : '',
        employeeDepartment: emp ? (emp.department || 'ทั่วไป') : 'ทั่วไป',
        approvedById: approverEmp?.id || '',
        approvedByName: approverName,`;

if (!script.includes(oldAllTxBlock)) {
  console.error("oldAllTxBlock not found");
  process.exit(1);
}
script = script.replace(oldAllTxBlock, newAllTxBlock);
console.log("4. Added approvedBy to confirmAllReturnsFromScanner");

fs.writeFileSync('script.js', script, 'utf8');
console.log("All updates executed successfully!");
