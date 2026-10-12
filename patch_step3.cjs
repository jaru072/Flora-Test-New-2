const fs = require('fs');
let script = fs.readFileSync('script.js', 'utf8');

// 1. In confirmSingleReturnFromScanner: Add authorization check
const oldSingleReturn = `    // บันทึกคืนอุปกรณ์ชิ้นเดียวจากปุ่ม "คืน" ในแถว
    window.confirmSingleReturnFromScanner = async function(equipId) {
      if (!window.scannerActiveReturnItems) return;
      const item = window.scannerActiveReturnItems.find(x => x.equipmentId === equipId);
      if (!item) return;`;

const newSingleReturn = `    // บันทึกคืนอุปกรณ์ชิ้นเดียวจากปุ่ม "คืน" ในแถว
    window.confirmSingleReturnFromScanner = async function(equipId) {
      if (!window.scannerActiveReturnItems) return;
      const item = window.scannerActiveReturnItems.find(x => x.equipmentId === equipId);
      if (!item) return;

      // ตรวจสอบสิทธิ์เจ้าหน้าที่หรือผู้ดูแลระบบ
      const isAuthorized = (typeof window.hasStaffOrAdminAuthorization === 'function') && window.hasStaffOrAdminAuthorization();
      if (!isAuthorized) {
        alert("🔒 พนักงานไม่มีสิทธิ์บันทึกคืนอุปกรณ์\\n\\nกรุณาแตะบัตรเจ้าหน้าที่ (Staff) หรือ ผู้ดูแลระบบ (Admin) เพื่อปลดล็อกก่อนทำรายการ");
        return;
      }`;

if (!script.includes(oldSingleReturn)) {
  console.error('oldSingleReturn not found');
  process.exit(1);
}
script = script.replace(oldSingleReturn, newSingleReturn);
console.log('1. Updated confirmSingleReturnFromScanner');

// 2. In confirmAllReturnsFromScanner: Add authorization check
const oldAllReturn = `    // บันทึกคืนอุปกรณ์ทั้งหมดในคราวเดียว
    window.confirmAllReturnsFromScanner = async function() {
      if (!window.scannerActiveReturnItems || window.scannerActiveReturnItems.length === 0) return;`;

const newAllReturn = `    // บันทึกคืนอุปกรณ์ทั้งหมดในคราวเดียว
    window.confirmAllReturnsFromScanner = async function() {
      if (!window.scannerActiveReturnItems || window.scannerActiveReturnItems.length === 0) return;

      // ตรวจสอบสิทธิ์เจ้าหน้าที่หรือผู้ดูแลระบบ
      const isAuthorized = (typeof window.hasStaffOrAdminAuthorization === 'function') && window.hasStaffOrAdminAuthorization();
      if (!isAuthorized) {
        alert("🔒 พนักงานไม่มีสิทธิ์บันทึกคืนอุปกรณ์\\n\\nกรุณาแตะบัตรเจ้าหน้าที่ (Staff) หรือ ผู้ดูแลระบบ (Admin) เพื่อปลดล็อกก่อนทำรายการ");
        return;
      }`;

if (!script.includes(oldAllReturn)) {
  console.error('oldAllReturn not found');
  process.exit(1);
}
script = script.replace(oldAllReturn, newAllReturn);
console.log('2. Updated confirmAllReturnsFromScanner');

// 3. In saveTransactionDirectlyFromScanner: Add authorization check
const oldDirectSave = `    window.saveTransactionDirectlyFromScanner = async function() {
      const items = (typeof selectedTransItems !== 'undefined' && Array.isArray(selectedTransItems)) ? selectedTransItems : [];
      if (items.length === 0) {
        alert("⚠️ กรุณาสแกนอุปกรณ์อย่างน้อย 1 รายการก่อนบันทึก");
        return;
      }`;

const newDirectSave = `    window.saveTransactionDirectlyFromScanner = async function() {
      const items = (typeof selectedTransItems !== 'undefined' && Array.isArray(selectedTransItems)) ? selectedTransItems : [];
      if (items.length === 0) {
        alert("⚠️ กรุณาสแกนอุปกรณ์อย่างน้อย 1 รายการก่อนบันทึก");
        return;
      }

      // ตรวจสอบสิทธิ์เจ้าหน้าที่หรือผู้ดูแลระบบ
      const isAuthorized = (typeof window.hasStaffOrAdminAuthorization === 'function') && window.hasStaffOrAdminAuthorization();
      if (!isAuthorized) {
        alert("🔒 พนักงานไม่มีสิทธิ์บันทึกข้อมูล\\n\\nต้องสแกนบัตรของเจ้าหน้าที่ หรือ ผู้ดูแลระบบ (Admin) เท่านั้น ปุ่มบันทึกจึงจะสามารถทำงานได้");
        return;
      }`;

if (!script.includes(oldDirectSave)) {
  console.error('oldDirectSave not found');
  process.exit(1);
}
script = script.replace(oldDirectSave, newDirectSave);
console.log('3. Updated saveTransactionDirectlyFromScanner');

// 4. In handleTransactionSubmit: Add authorization check
const oldHandleSubmit = `    // Transaction Submit (Supports Multi-Item Documents & Firestore Sync Verification)
    async function handleTransactionSubmit(e) {
      e.preventDefault();
      const type = document.querySelector('input[name="transType"]:checked').value;`;

const newHandleSubmit = `    // Transaction Submit (Supports Multi-Item Documents & Firestore Sync Verification)
    async function handleTransactionSubmit(e) {
      e.preventDefault();

      // ตรวจสอบสิทธิ์เจ้าหน้าที่หรือผู้ดูแลระบบ
      const isAuthorized = (typeof window.hasStaffOrAdminAuthorization === 'function') && window.hasStaffOrAdminAuthorization();
      if (!isAuthorized) {
        alert("🔒 พนักงานไม่มีสิทธิ์บันทึกข้อมูล (เบิก-รับเข้า-ยืม-คืน)\\n\\nต้องสแกนบัตรของเจ้าหน้าที่ หรือ ผู้ดูแลระบบ (Admin) เท่านั้น เพื่อยืนยันสิทธิ์ก่อนบันทึก");
        return;
      }

      const type = document.querySelector('input[name="transType"]:checked').value;`;

if (!script.includes(oldHandleSubmit)) {
  console.error('oldHandleSubmit not found');
  process.exit(1);
}
script = script.replace(oldHandleSubmit, newHandleSubmit);
console.log('4. Updated handleTransactionSubmit');

fs.writeFileSync('script.js', script, 'utf8');
