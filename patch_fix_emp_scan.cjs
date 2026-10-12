const fs = require('fs');

let script = fs.readFileSync('script.js', 'utf8');

const targetBlock = `        // Continuous scanning mode for employee badge
        if (window.isContinuousCartScanning || isTransModalActive || isScannerModalOpen) {
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
          if (typeof window.isStaffOrAdminEmp === 'function' && window.isStaffOrAdminEmp(emp)) {
            window.authorizedStaffOperator = emp;
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
            const isStaffEmp = (typeof window.isStaffOrAdminEmp === 'function') && window.isStaffOrAdminEmp(emp);
            if (isStaffEmp) {
              showToast(\`🔓 ยืนยันสิทธิ์สำเร็จ! "\${typeof formatEmpName === 'function' ? formatEmpName(emp) : emp.name}" [เจ้าหน้าที่/ผู้ดูแล] ปลดล็อกปุ่มบันทึกแล้ว (มียืมค้าง \${unreturnedList.length} รายการ)\`);
            } else {
              showToast(\`📋 พนักงาน "\${typeof formatEmpName === 'function' ? formatEmpName(emp) : emp.name}" มียืมอุปกรณ์ค้างส่งคืน \${unreturnedList.length} รายการ (กรุณาสแกนบัตรเจ้าหน้าที่เพื่อปลดล็อกบันทึก)\`);
            }
          } else {
            window.scannerReturnMode = false;
            window.scannerActiveReturnItems = [];
            if (typeof window.updateScannerEquipmentListUI === 'function') {
              window.updateScannerEquipmentListUI();
            }
            const isStaffEmp2 = (typeof window.isStaffOrAdminEmp === 'function') && window.isStaffOrAdminEmp(emp);
            if (isStaffEmp2) {
              showToast(\`🔓 ยืนยันสิทธิ์สำเร็จ! "\${typeof formatEmpName === 'function' ? formatEmpName(emp) : emp.name}" [เจ้าหน้าที่/ผู้ดูแล] ปลดล็อกปุ่มบันทึกเรียบร้อยแล้ว\`);
            } else {
              showToast(\`👤 สแกนพบผู้ทำรายการ: "\${typeof formatEmpName === 'function' ? formatEmpName(emp) : emp.name}" [\${emp.id}] (กรุณาสแกนบัตรเจ้าหน้าที่เพื่อปลดล็อกบันทึก)\`);
            }
          }
          return;
        }`;

const replacementBlock = `        // Continuous scanning mode for employee badge
        if (window.isContinuousCartScanning || isTransModalActive || isScannerModalOpen) {
          const isStaffOrAdmin = (typeof window.isStaffOrAdminEmp === 'function') && window.isStaffOrAdminEmp(emp);
          const currentEmpSelect = document.getElementById('empSelect');
          const existingEmpId = currentEmpSelect ? currentEmpSelect.value : (activeScannerDetectedEmpId || null);
          const existingEmp = (existingEmpId && typeof employeeList !== 'undefined' && Array.isArray(employeeList)) 
            ? employeeList.find(e => e && e.id === existingEmpId) 
            : null;
          const hasExistingWorker = existingEmp && !(typeof window.isStaffOrAdminEmp === 'function' && window.isStaffOrAdminEmp(existingEmp));
          const hasItems = (typeof selectedTransItems !== 'undefined' && Array.isArray(selectedTransItems) && selectedTransItems.length > 0) ||
                           (window.scannerReturnMode && window.scannerActiveReturnItems && window.scannerActiveReturnItems.length > 0);

          // กรณีที่ 1: พนักงานทั่วไปสแกนของและบัตรตัวเองไว้แล้ว และมีเจ้าหน้าที่/แอดมินมาสแกนบัตรเพื่ออนุมัติ
          // สำคัญมาก: ห้ามเขียนทับชื่อพนักงานที่เป็นผู้ทำรายการ แต่ให้เก็บเจ้าหน้าที่เป็นผู้อนุมัติ (authorizedStaffOperator) และบันทึกทันที!
          if (isStaffOrAdmin && hasExistingWorker && hasItems) {
            window.authorizedStaffOperator = emp;
            const staffDisplayName = typeof formatEmpName === 'function' ? formatEmpName(emp) : emp.name;
            const workerDisplayName = typeof formatEmpName === 'function' ? formatEmpName(existingEmp) : existingEmp.name;
            showToast(\`⚡ เจ้าหน้าที่ "\${staffDisplayName}" อนุมัติการทำรายการให้คุณ "\${workerDisplayName}" เรียบร้อยแล้ว! กำลังบันทึกข้อมูล...\`);
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
              showToast(\`👤 เจ้าหน้าที่/แอดมิน "\${typeof formatEmpName === 'function' ? formatEmpName(emp) : emp.name}" มียืมค้าง \${unreturnedList.length} รายการ (กดปุ่มคืนทั้งหมดหรือยืมเพิ่มได้ทันที)\`);
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
        }`;

if (!script.includes(targetBlock)) {
  console.error("targetBlock not found");
  process.exit(1);
}

script = script.replace(targetBlock, replacementBlock);
fs.writeFileSync('script.js', script, 'utf8');
console.log("Successfully patched continuous employee scanning block!");
