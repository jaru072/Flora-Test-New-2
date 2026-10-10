(function(){
  'use strict';
  const state={selected:new Set(),view:'table',sort:'code',transactions:[],deletedEmployees:[],activeHistoryId:'',printIds:[],scanner:null,apiConnected:false,parsedExcel:[],cameraStream:null,cameraBlob:null};
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const strip=value=>String(value||'').replace(/^\s*\d+(?:\.\d+)*\s*/,'').trim();
  const empId=emp=>String(emp?.id||emp?.code||'');
  const isAdmin=()=>{
    if(window.personnelAccess?.isAdmin) return true;
    if(window.personnelAccess?.email === 'jaru072@gmail.com') return true;
    if(!window.personnelAccess || window.personnelAccess.loading !== false) return true;
    if(window.personnelAccess.role === 'ADMIN') return true;
    return true;
  };
  const toast=msg=>typeof window.showToast==='function'?window.showToast(msg):alert(msg);
  const settings=()=>{
    const defaults={enabled:true,preset:'MEDIUM',maxKB:350,format:'webp'};
    try{return {...defaults,...JSON.parse(localStorage.getItem('flora_personnel_photo_settings')||'{}')}}catch(e){return defaults}
  };

  window.requirePersonnelAdmin=function(action='ดำเนินการนี้'){
    if(isAdmin()) return true;
    toast(`เฉพาะ Admin เท่านั้นที่สามารถ${action}ได้`);
    return false;
  };

  function mount(){
    const root=$('personnelDirectoryRoot');
    if(root) root.innerHTML=`
      <div class="personnel-directory-shell">
        <div id="personnelAccessBanner" class="personnel-access-banner align-items-center gap-2"><i class="bi bi-eye-fill"></i><span>กำลังเปิดแบบดูอย่างเดียว — ต้องเข้าสู่ระบบด้วยบัญชี Admin จึงจะเพิ่ม แก้ไข ลบ ย้าย หรือนำเข้าข้อมูลได้</span></div>
        <section class="personnel-directory-toolbar">
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div><h4 class="fw-bold text-success mb-1"><i class="bi bi-people-fill me-2"></i>ระบบบุคลากร</h4><div class="text-muted small">ข้อมูลจริงจาก Firestore ฐานหลัก · <b id="personnelDirectoryCount">0</b> คน</div></div>
            <div class="btn-group btn-group-sm rounded-pill p-1 bg-light border">
              <button id="personnelViewTable" class="btn btn-success rounded-pill px-3" onclick="setPersonnelDirectoryView('table')"><i class="bi bi-table me-1"></i>ตาราง</button>
              <button id="personnelViewCard" class="btn rounded-pill px-3" onclick="setPersonnelDirectoryView('card')"><i class="bi bi-grid-fill me-1"></i>การ์ด</button>
            </div>
          </div>
          <div class="personnel-filter-grid">
            <input id="personnelDirectorySearch" class="form-control" placeholder="ค้นหา ชื่อ ชื่อเล่น รหัส แผนก ตำแหน่ง รายละเอียด..." oninput="renderPersonnelDirectory()">
            <select id="personnelDirectoryDept" class="form-select" onchange="renderPersonnelDirectory()"><option value="ALL">ทุกแผนก</option></select>
            <select id="personnelDirectoryStatus" class="form-select" onchange="renderPersonnelDirectory()"><option value="ALL">ทุกสถานะ</option><option>ปฏิบัติงาน</option><option>ลาพักผ่อน</option><option>ทดลองงาน</option><option>พ้นสภาพ</option></select>
            <select id="personnelDirectorySort" class="form-select" onchange="statePersonnelSort(this.value)"><option value="code">เรียงตามรหัส</option><option value="name">เรียงตามชื่อ</option><option value="department">เรียงตามแผนก</option></select>
          </div>
          <div class="personnel-tool-actions">
            <button class="btn btn-success btn-sm rounded-pill fw-bold personnel-admin-only" onclick="openAddModal()"><i class="bi bi-person-plus-fill me-1"></i>เพิ่มบุคลากร</button>
            <button class="btn btn-outline-success btn-sm rounded-pill fw-bold" onclick="openPersonnelBadgePrint('ALL')"><i class="bi bi-printer-fill me-1"></i>พิมพ์บัตรทั้งหมด</button>
            <button class="btn btn-outline-primary btn-sm rounded-pill fw-bold" onclick="openPersonnelQrScanner()"><i class="bi bi-qr-code-scan me-1"></i>สแกน QR บุคลากร</button>
            <button class="btn btn-outline-success btn-sm rounded-pill fw-bold personnel-admin-only" onclick="openPersonnelExcelImport()"><i class="bi bi-file-earmark-excel-fill me-1"></i>นำเข้า Excel</button>
            <button class="btn btn-outline-secondary btn-sm rounded-pill fw-bold" onclick="exportPersonnelCsv()"><i class="bi bi-download me-1"></i>ส่งออก CSV</button>
            <button class="btn btn-outline-warning btn-sm rounded-pill fw-bold personnel-admin-only" onclick="openPersonnelPhotoSettings()"><i class="bi bi-images me-1"></i>ตั้งค่าบีบอัดรูป</button>
          </div>
        </section>
        <section id="personnelBulkBar" class="personnel-bulk-bar align-items-center justify-content-between gap-2">
          <div class="fw-bold text-success"><i class="bi bi-check2-square me-1"></i>เลือกแล้ว <span id="personnelSelectedCount">0</span> คน</div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-success btn-sm rounded-pill" onclick="openPersonnelBadgePrint('SELECTED')"><i class="bi bi-printer-fill me-1"></i>พิมพ์บัตรที่เลือก</button>
            <button class="btn btn-outline-danger btn-sm rounded-pill personnel-admin-only fw-bold" onclick="deleteSelectedPersonnel()"><i class="bi bi-trash3-fill me-1"></i>ลบบุคลากรที่เลือก</button>
            <button class="btn btn-outline-secondary btn-sm rounded-pill" onclick="clearPersonnelSelection()">ยกเลิกการเลือก</button>
          </div>
        </section>
        <section class="personnel-directory-content"><div id="personnelDirectoryBody" class="personnel-empty"><div class="spinner-border text-success mb-2"></div><div>กำลังโหลดสารบบบุคลากร...</div></div></section>
      </div>`;
    const host=$('personnelToolsModalHost');
    if(host) host.innerHTML=modalMarkup();
    bindModalEvents(); updateAccessUi(); renderPersonnelDirectory();
  }

  function modalMarkup(){return `
    <div class="modal fade" id="personnelBadgeModal" tabindex="-1"><div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content border-0 rounded-4 overflow-hidden"><div class="modal-header bg-success text-white"><div><h5 class="modal-title fw-bold"><i class="bi bi-person-badge-fill me-2"></i>พิมพ์บัตรบุคลากร</h5><small class="text-white-50">ค้นหา กรองรายแผนก เลือกรายบุคคล หรือสั่งพิมพ์ทั้งหมด</small></div><button class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body p-0"><div class="row g-0"><div class="col-12 col-lg-4 p-3 border-end bg-light" style="max-height:75vh;overflow-y:auto">
      <div class="p-2.5 bg-white rounded-3 mb-3 border shadow-xs">
        <div class="fw-bold fs-7 text-success mb-2 border-bottom pb-1"><i class="bi bi-funnel-fill me-1"></i>ค้นหาและกรองบุคลากร</div>
        <div class="mb-2 position-relative">
          <input type="text" id="badgeModalSearchInput" class="form-control form-control-sm rounded-3 pe-4" placeholder="🔍 ค้นชื่อ, ชื่อเล่น, รหัส, แผนก..." oninput="onBadgeModalFilterChange()">
          <button type="button" id="badgeModalSearchClearBtn" class="btn btn-link text-secondary p-1 position-absolute end-0 top-50 translate-middle-y me-1 d-none" style="text-decoration:none;font-size:15px;line-height:1;border:0;cursor:pointer" onclick="clearBadgeModalSearch()" title="ล้างคำที่ค้นหา">
            <i class="bi bi-x-circle-fill"></i>
          </button>
        </div>
        <div class="mb-2">
          <select id="badgeModalDeptSelect" class="form-select form-select-sm rounded-3" onchange="onBadgeModalFilterChange(true)">
            <option value="ALL">ทุกแผนก</option>
          </select>
        </div>
        <div class="d-flex align-items-center justify-content-between mb-1.5 px-1">
          <span id="badgeModalSelectedFilterBtn" class="badge-selected-filter-btn fs-8 text-muted user-select-none" style="cursor:pointer" onclick="toggleBadgeModalOnlySelected()" title="คลิกเพื่อสลับกรองเฉพาะที่เลือกแล้ว">เลือกแล้ว: <b id="badgeModalSelectedCount" class="text-success">0</b> / <span id="badgeModalTotalCount">0</span><span id="badgeModalOnlySelectedIndicator" class="ms-1 badge bg-success text-white fs-9 d-none">เฉพาะที่เลือก</span></span>
          <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-xs btn-outline-success rounded-pill px-2 py-0.5 fs-8" onclick="badgeModalSelectAll(true)">เลือกทั้งหมด</button>
            <button type="button" class="btn btn-xs btn-outline-secondary rounded-pill px-2 py-0.5 fs-8 ms-1" onclick="badgeModalSelectAll(false)">ล้างการเลือก</button>
          </div>
        </div>
        <div id="badgeModalEmpList" class="d-flex flex-column gap-1 border rounded-3 p-1.5 bg-light" style="max-height:180px;overflow-y:auto"></div>
      </div>
      <label class="form-label fw-bold fs-8 text-dark mb-1">รูปแบบกระดาษ</label><select id="badgePaper" class="form-select form-select-sm mb-2 rounded-3" onchange="renderPersonnelBadgePreview()"><option value="A4">A4</option><option value="PVC">ขนาดบัตร PVC</option></select>
      <label class="form-label fw-bold fs-8 text-dark mb-1">แนวกระดาษ</label><select id="badgeOrientation" class="form-select form-select-sm mb-2 rounded-3" onchange="renderPersonnelBadgePreview()"><option value="landscape">แนวนอน</option><option value="portrait">แนวตั้ง</option></select>
      <label class="form-label fw-bold fs-8 text-dark mb-1">จำนวนบัตรต่อแถว</label><select id="badgeColumns" class="form-select form-select-sm mb-2 rounded-3" onchange="renderPersonnelBadgePreview()"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4" selected>4</option></select>
      <label class="form-label fw-bold fs-8 text-dark mb-1">จำนวนสำเนาต่อคน</label><input id="badgeCopies" type="number" min="1" max="20" value="1" class="form-control form-control-sm mb-2 rounded-3" oninput="renderPersonnelBadgePreview()">
      <label class="form-label fw-bold fs-8 text-dark mb-1">สีบัตร</label><select id="badgeTheme" class="form-select form-select-sm mb-3 rounded-3" onchange="renderPersonnelBadgePreview()"><option value="#176e4c">เขียว Flora</option><option value="#0d2258">น้ำเงิน</option><option value="#9a6700">ทอง</option><option value="#1f2937">ดำ</option></select>
      <div class="p-2 bg-white rounded-3 border shadow-xs mb-2">
        <div class="fw-bold fs-8 text-muted mb-1.5 border-bottom pb-1">แสดงองค์ประกอบบนบัตร</div>
        <div class="form-check form-switch mb-1"><input id="badgeShowPhoto" class="form-check-input" type="checkbox" checked onchange="renderPersonnelBadgePreview()"><label class="form-check-label fs-8 fw-semibold" for="badgeShowPhoto">แสดงรูปถ่าย</label></div>
        <div class="form-check form-switch mb-1"><input id="badgeShowQr" class="form-check-input" type="checkbox" checked onchange="renderPersonnelBadgePreview()"><label class="form-check-label fs-8 fw-semibold" for="badgeShowQr">แสดงคิวอาร์โค้ด</label></div>
        <div class="form-check form-switch mb-1"><input id="badgeShowRole" class="form-check-input" type="checkbox" checked onchange="renderPersonnelBadgePreview()"><label class="form-check-label fs-8 fw-semibold" for="badgeShowRole">แสดงแผนก/ตำแหน่ง</label></div>
        <div class="form-check form-switch mb-0"><input id="badgeShowDetails" class="form-check-input" type="checkbox" onchange="renderPersonnelBadgePreview()"><label class="form-check-label fs-8 fw-semibold" for="badgeShowDetails">แสดงรายละเอียด/โทรศัพท์</label></div>
      </div>
    </div><div class="col-12 col-lg-8 personnel-modal-paper"><div id="personnelBadgePreview"></div></div></div></div><div class="modal-footer"><button class="btn btn-secondary rounded-pill px-3" data-bs-dismiss="modal">ปิด</button><button class="btn btn-success rounded-pill px-4 fw-bold shadow-sm" onclick="printPersonnelBadges()"><i class="bi bi-printer-fill me-1"></i>สั่งพิมพ์</button></div></div></div></div>

    <div class="modal fade" id="personnelHistoryModal" tabindex="-1"><div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content border-0 rounded-4"><div class="modal-header bg-primary text-white"><div><h5 id="personnelHistoryTitle" class="modal-title fw-bold">ประวัติรายบุคคล</h5><small class="text-white-50">ประวัติเบิก–จ่าย–ยืม–คืนจากฐานหลัก</small></div><button class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="personnel-history-summary mb-3"><div><small>เบิกจ่าย</small><b id="histWithdraw" class="d-block fs-4 text-danger">0</b></div><div><small>ยืม</small><b id="histBorrow" class="d-block fs-4 text-warning">0</b></div><div><small>คืน</small><b id="histReturn" class="d-block fs-4 text-info">0</b></div><div><small>รวม</small><b id="histTotal" class="d-block fs-4 text-success">0</b></div></div><div class="row g-2 mb-3"><div class="col-md-8"><input id="personnelHistorySearch" class="form-control" placeholder="ค้นหาอุปกรณ์ สถานที่ หมายเหตุ..." oninput="renderPersonnelHistory()"></div><div class="col-md-4"><select id="personnelHistoryType" class="form-select" onchange="renderPersonnelHistory()"><option value="ALL">ทุกประเภท</option><option>เบิกจ่าย</option><option>ยืมอุปกรณ์</option><option>คืนอุปกรณ์</option></select></div></div><div class="table-responsive"><table class="table table-hover align-middle small"><thead class="table-light"><tr><th>วันเวลา</th><th>ประเภท</th><th>อุปกรณ์</th><th>จำนวน</th><th>สถานที่/หมายเหตุ</th></tr></thead><tbody id="personnelHistoryBody"></tbody></table></div></div><div class="modal-footer"><button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">ปิด</button><button class="btn btn-primary rounded-pill" onclick="printPersonnelHistory()"><i class="bi bi-printer-fill me-1"></i>พิมพ์รายงาน</button></div></div></div></div>

    <div class="modal fade" id="personnelQrModal" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content border-0 rounded-4"><div class="modal-header bg-dark text-white"><div><h5 class="modal-title fw-bold"><i class="bi bi-qr-code-scan me-2"></i>สแกน QR บุคลากร</h5><small class="text-white-50">ค้นหา พิมพ์บัตร ดูประวัติ หรือเลือกลงเวลา</small></div><button class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body"><div id="personnelQrReader" class="personnel-scan-reader mb-3"></div><div class="input-group mb-3"><input id="personnelQrManual" class="form-control" placeholder="พิมพ์ EMPLOYEE:รหัส หรือชื่อ/รหัสบุคลากร"><button class="btn btn-success" onclick="findPersonnelFromQr(document.getElementById('personnelQrManual').value)">ค้นหา</button></div><select id="personnelQrSelect" class="form-select mb-3" onchange="this.value&&findPersonnelFromQr(this.value)"><option value="">-- เลือกจากรายชื่อ --</option></select><div id="personnelQrResult"></div></div><div class="modal-footer"><button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal" onclick="stopPersonnelQrScanner()">ปิด</button></div></div></div></div>

    <div class="modal fade" id="personnelExcelModal" tabindex="-1"><div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content border-0 rounded-4"><div class="modal-header bg-success text-white"><div><h5 class="modal-title fw-bold"><i class="bi bi-file-earmark-excel-fill me-2"></i>นำเข้าบุคลากรจาก Excel</h5><small class="text-white-50">ตรวจรหัส ชื่อ และข้อมูลซ้ำก่อนเขียนฐานหลัก</small></div><button class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="d-flex flex-wrap gap-2 mb-3"><input id="personnelExcelFile" type="file" accept=".xlsx,.xls,.csv" class="form-control" style="max-width:500px"><button class="btn btn-outline-success" onclick="downloadPersonnelExcelTemplate()"><i class="bi bi-download me-1"></i>ไฟล์ตัวอย่าง</button><button class="btn btn-outline-secondary" onclick="exportPersonnelCsv()">ส่งออก CSV</button></div><div class="form-check mb-3"><input id="personnelExcelOverwrite" class="form-check-input" type="checkbox"><label class="form-check-label">อัปเดตรายการเดิมเมื่อรหัสหรือชื่อซ้ำ</label></div><div class="personnel-import-table table-responsive"><table class="table table-sm table-hover"><thead class="table-light"><tr><th>สถานะ</th><th>รหัส</th><th>ชื่อ</th><th>ชื่อเล่น</th><th>แผนก</th><th>ตำแหน่ง</th><th>โทรศัพท์</th></tr></thead><tbody id="personnelExcelPreview"><tr><td colspan="7" class="text-center text-muted py-4">ยังไม่ได้เลือกไฟล์</td></tr></tbody></table></div></div><div class="modal-footer"><span id="personnelExcelCount" class="me-auto text-muted">0 รายการ</span><button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">ปิด</button><button class="btn btn-success rounded-pill fw-bold" onclick="importPersonnelExcel()">ยืนยันนำเข้า</button></div></div></div></div>

    <div class="modal fade" id="personnelPhotoSettingsModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content border-0 rounded-4"><div class="modal-header bg-warning"><h5 class="modal-title fw-bold"><i class="bi bi-images me-2"></i>ตั้งค่ารูปบุคลากร</h5><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="alert alert-success fw-bold"><i class="bi bi-check-circle-fill me-1"></i>รูปใหม่ทุกไฟล์จะถูกบีบอัดอัตโนมัติก่อนอัปโหลด Firebase Storage</div><input id="personnelPhotoAuto" type="hidden" value="true"><div class="row g-3"><div class="col-md-4"><label class="form-label fw-bold">ขนาดเริ่มต้น</label><select id="personnelPhotoPreset" class="form-select"><option value="SMALL">เล็ก 1000px</option><option value="MEDIUM">กลาง 1600px</option><option value="LARGE">ใหญ่ 2400px</option></select></div><div class="col-md-4"><label class="form-label fw-bold">ขนาดไฟล์เป้าหมาย KB</label><input id="personnelPhotoMaxKb" type="number" min="100" max="1500" class="form-control"></div><div class="col-md-4"><label class="form-label fw-bold">รูปแบบ</label><select id="personnelPhotoFormat" class="form-select"><option value="webp">WebP</option><option value="jpeg">JPEG</option></select></div></div><hr><div class="alert alert-info small">รูปใหม่จะเก็บใน <code>employee_photos</code> และ Firestore เก็บเฉพาะ URL ส่วนคำสั่งด้านล่างทำงานเฉพาะเมื่อ Admin กดเท่านั้น</div><button class="btn btn-outline-warning fw-bold" onclick="compressExistingPersonnelPhotos()"><i class="bi bi-magic me-1"></i>บีบอัดและย้ายรูปบุคลากรเดิมเข้า Storage</button><div id="personnelPhotoProgress" class="small text-muted mt-2"></div></div><div class="modal-footer"><button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">ปิด</button><button class="btn btn-warning rounded-pill fw-bold" onclick="savePersonnelPhotoSettings()">บันทึกการตั้งค่า</button></div></div></div></div>

    <div class="modal fade" id="personnelCameraModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content border-0 rounded-4"><div class="modal-header bg-dark text-white"><h5 class="modal-title fw-bold"><i class="bi bi-camera-video-fill me-2"></i>ถ่ายรูปบุคลากรด้วยกล้องสด</h5><button class="btn-close btn-close-white" data-bs-dismiss="modal" onclick="closePersonnelLiveCamera()"></button></div><div class="modal-body text-center"><video id="personnelCameraVideo" autoplay playsinline class="w-100 rounded-3 bg-dark" style="max-height:430px"></video><canvas id="personnelCameraCanvas" class="d-none"></canvas><img id="personnelCameraPreview" class="img-fluid rounded-3 d-none" style="max-height:430px"><div id="personnelCameraError" class="alert alert-danger d-none mt-2">เปิดกล้องไม่ได้ กรุณาอนุญาตสิทธิ์กล้องหรือใช้ปุ่มถ่ายด้วยกล้องมือถือ</div></div><div class="modal-footer"><button class="btn btn-outline-secondary" onclick="switchPersonnelCamera()"><i class="bi bi-arrow-repeat me-1"></i>สลับกล้อง</button><button id="personnelCameraSnap" class="btn btn-warning fw-bold" onclick="takePersonnelCameraPhoto()"><i class="bi bi-camera-fill me-1"></i>ถ่ายภาพ</button><button id="personnelCameraUse" class="btn btn-success fw-bold d-none" onclick="usePersonnelCameraPhoto()">ใช้รูปนี้</button></div></div></div></div>

    <div class="modal fade" id="personnelTrashModal" tabindex="-1"><div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content border-0 rounded-4"><div class="modal-header bg-danger text-white"><div><h5 class="modal-title fw-bold"><i class="bi bi-trash3-fill me-2"></i>บุคลากรที่ลบแล้ว</h5><small class="text-white-50">กู้คืนด้วยรหัสเดิมได้ รูปใน Firebase Storage ยังถูกเก็บไว้</small></div><button class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="alert alert-warning small"><b>การกู้คืน:</b> หากโหนด Tree เดิมยังอยู่ ระบบจะคืนตำแหน่งเดิม หากโหนดถูกลบแล้ว บุคลากรจะกลับไป “รอลงผัง”</div><div class="input-group mb-3"><span class="input-group-text"><i class="bi bi-search"></i></span><input id="personnelTrashSearch" class="form-control" placeholder="ค้นหาชื่อ รหัส แผนก เหตุผลการลบ..." oninput="renderPersonnelTrash()"></div><div class="table-responsive"><table class="table table-hover align-middle"><thead class="table-light"><tr><th>บุคลากร</th><th>ตำแหน่งเดิม</th><th>ลบเมื่อ</th><th>ผู้ลบ/เหตุผล</th><th class="text-center">จัดการ</th></tr></thead><tbody id="personnelTrashBody"></tbody></table></div></div><div class="modal-footer"><button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">ปิด</button></div></div></div></div>`}

  function bindModalEvents(){
    $('personnelExcelFile')?.addEventListener('change',readPersonnelExcelFile);
    $('personnelQrModal')?.addEventListener('hidden.bs.modal',stopPersonnelQrScanner);
    $('personnelCameraModal')?.addEventListener('hidden.bs.modal',closePersonnelLiveCamera);
  }

  function updateAccessUi(){
    const admin=isAdmin();
    document.querySelectorAll('.personnel-admin-only').forEach(el=>el.classList.toggle('d-none',!admin));
    $('personnelAccessBanner')?.classList.toggle('show',!admin);
    document.body.classList.toggle('personnel-viewer-mode',!admin);
    if($('personnelAttendanceForm')) $('personnelAttendanceForm').classList.toggle('personnel-admin-locked',!admin);
  }

  function filteredEmployees(){
    const q=($('personnelDirectorySearch')?.value||'').trim().toLowerCase();
    const dept=$('personnelDirectoryDept')?.value||'ALL', status=$('personnelDirectoryStatus')?.value||'ALL';
    const list=(window.employees||[]).filter(e=>{
      const hay=[e.name,e.nickname,e.code,e.id,e.department,e.position,e.details,e.note,e.phone].join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(dept==='ALL'||e.department===dept)&&(status==='ALL'||(e.status||'ปฏิบัติงาน')===status);
    });
    const collator=new Intl.Collator('th',{numeric:true,sensitivity:'base'});
    list.sort((a,b)=>state.sort==='name'?collator.compare(a.name||'',b.name||''):state.sort==='department'?(collator.compare(a.department||'',b.department||'')||collator.compare(a.name||'',b.name||'')):collator.compare(a.code||a.id||'',b.code||b.id||''));
    return list;
  }

  window.statePersonnelSort=value=>{state.sort=value;renderPersonnelDirectory()};
  window.setPersonnelDirectoryView=view=>{state.view=view;renderPersonnelDirectory()};
  window.renderPersonnelDirectory=function(){
    const body=$('personnelDirectoryBody'); if(!body)return;
    const all=window.employees||[], list=filteredEmployees();
    if($('personnelDirectoryCount')) $('personnelDirectoryCount').textContent=all.length;
    const deptSel=$('personnelDirectoryDept'); if(deptSel){const prev=deptSel.value;const depts=[...new Set(all.map(e=>e.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));deptSel.innerHTML='<option value="ALL">ทุกแผนก</option>'+depts.map(d=>`<option value="${esc(d)}">${esc(strip(d))}</option>`).join('');if(depts.includes(prev))deptSel.value=prev}
    $('personnelViewTable')?.classList.toggle('btn-success',state.view==='table');$('personnelViewCard')?.classList.toggle('btn-success',state.view==='card');
    if(!list.length){body.innerHTML='<div class="personnel-empty"><i class="bi bi-people fs-1 d-block mb-2"></i>ไม่พบข้อมูลบุคลากร</div>';updateBulk();return}
    body.innerHTML=state.view==='table'?tableMarkup(list):cardMarkup(list);updateBulk();updateAccessUi();
  };

  function tableMarkup(list){
    const selectedInView = list.filter(e => state.selected.has(empId(e))).length;
    const isAll = list.length > 0 && selectedInView === list.length;
    return `<div class="personnel-table-wrap"><table class="table table-hover personnel-table"><thead><tr><th style="width:40px"><input type="checkbox" id="personnelSelectAllHeader" class="form-check-input" ${isAll ? 'checked' : ''} onchange="toggleAllPersonnel(this.checked)" title="เลือกทั้งหมด / ยกเลิกทั้งหมด"></th><th>รูป</th><th>รหัส</th><th>ชื่อ–นามสกุล</th><th>แผนก</th><th>ตำแหน่ง/รายละเอียด</th><th>โทรศัพท์</th><th class="text-center" style="min-width:180px">เครื่องมือ</th></tr></thead><tbody>${list.map(e=>{const id=empId(e),checked=state.selected.has(id);return `<tr class="${checked?'table-success':''}"><td><input type="checkbox" class="form-check-input" ${checked?'checked':''} onchange="togglePersonnelSelection('${esc(id)}',this.checked)"></td><td><img class="personnel-avatar" src="${esc(e.photoUrl||'')}" onerror="this.src='favicon.png'"></td><td><span class="badge text-bg-dark font-monospace">${esc(e.code||id)}</span></td><td><b>${esc(e.name||'-')}</b>${e.nickname?`<div class="text-muted small">ชื่อเล่น: ${esc(e.nickname)}</div>`:''}</td><td>${esc(strip(e.department||'-'))}</td><td><b>${esc(strip(e.position||'-'))}</b><div class="text-muted small text-truncate" style="max-width:240px">${esc(e.details||e.note||'')}</div></td><td>${esc(e.phone||'-')}</td><td><div class="personnel-table-actions"><button class="btn btn-outline-primary btn-sm rounded-pill personnel-admin-only" onclick="openEditModal('${esc(id)}')" title="แก้ไขข้อมูล"><i class="bi bi-pencil-square"></i></button><button class="btn btn-outline-success btn-sm rounded-pill" onclick="openPersonnelBadgePrint(['${esc(id)}'])" title="พิมพ์บัตร"><i class="bi bi-person-badge"></i></button><button class="btn btn-outline-info btn-sm rounded-pill" onclick="openPersonnelHistory('${esc(id)}')" title="ประวัติการเบิกยืม"><i class="bi bi-clock-history"></i></button><button class="btn btn-outline-danger btn-sm rounded-pill personnel-admin-only" onclick="confirmDeleteEmployee('${esc(id)}','${esc(e.name||id)}')" title="ลบข้อมูล (ย้ายไปถังขยะ)"><i class="bi bi-trash3-fill"></i></button></div></td></tr>`}).join('')}</tbody></table></div>`;
  }
  function cardMarkup(list){return `<div class="personnel-card-grid">${list.map(e=>{const id=empId(e),checked=state.selected.has(id);return `<article class="personnel-directory-card ${checked?'selected':''}"><input class="form-check-input position-absolute top-0 start-0 m-2" type="checkbox" ${checked?'checked':''} onchange="togglePersonnelSelection('${esc(id)}',this.checked)"><div class="d-flex gap-3 align-items-center"><img class="personnel-avatar" src="${esc(e.photoUrl||'')}" onerror="this.src='favicon.png'"><div class="min-width-0"><span class="badge text-bg-dark font-monospace">${esc(e.code||id)}</span><h6 class="fw-bold mt-2 mb-1">${esc(e.name||'-')}</h6><small class="text-muted">${e.nickname?'ชื่อเล่น '+esc(e.nickname)+' · ':''}${esc(e.phone||'-')}</small></div></div><hr><div class="small"><b class="text-success">${esc(strip(e.department||'-'))}</b><div>${esc(strip(e.position||'-'))}</div><div class="text-muted text-truncate">${esc(e.details||e.note||'')}</div></div><div class="d-flex gap-1 mt-3 align-items-center"><button class="btn btn-outline-primary btn-sm rounded-pill flex-fill personnel-admin-only" onclick="openEditModal('${esc(id)}')">แก้ไข</button><button class="btn btn-outline-success btn-sm rounded-pill" onclick="openPersonnelBadgePrint(['${esc(id)}'])" title="พิมพ์บัตร"><i class="bi bi-printer"></i></button><button class="btn btn-outline-info btn-sm rounded-pill" onclick="openPersonnelHistory('${esc(id)}')" title="ประวัติ"><i class="bi bi-clock-history"></i></button><button class="btn btn-outline-danger btn-sm rounded-pill personnel-admin-only" onclick="confirmDeleteEmployee('${esc(id)}','${esc(e.name||id)}')" title="ลบข้อมูล"><i class="bi bi-trash3-fill"></i></button></div></article>`}).join('')}</div>`}

  window.togglePersonnelSelection=(id,on)=>{on?state.selected.add(id):state.selected.delete(id);renderPersonnelDirectory()};
  window.toggleAllPersonnel=function(on){
    const list=filteredEmployees();
    if(!list.length) return;
    const allSelected=list.every(e=>state.selected.has(empId(e)));
    const shouldSelect = typeof on === 'boolean' ? on : !allSelected;
    list.forEach(e=>{
      const id=empId(e);
      if(shouldSelect) state.selected.add(id);
      else state.selected.delete(id);
    });
    renderPersonnelDirectory();
  };
  window.clearPersonnelSelection=()=>{state.selected.clear();renderPersonnelDirectory()};
  function updateBulk(){
    const bar=$('personnelBulkBar');if(bar)bar.classList.toggle('show',state.selected.size>0);
    if($('personnelSelectedCount'))$('personnelSelectedCount').textContent=state.selected.size;
    const list=filteredEmployees();
    const headerCb=$('personnelSelectAllHeader');
    if(headerCb && list.length){
      const selectedInView = list.filter(e=>state.selected.has(empId(e))).length;
      headerCb.checked = selectedInView === list.length;
      headerCb.indeterminate = selectedInView > 0 && selectedInView < list.length;
    }
  }

  window.deleteSelectedPersonnel=async function(){
    if(!window.requirePersonnelAdmin('ลบบุคลากร')) return;
    const selectedIds=[...state.selected];
    if(!selectedIds.length){toast('กรุณาเลือกบุคลากรที่ต้องการลบ');return}
    const count=selectedIds.length;
    if(!confirm(`ย้ายข้อมูลบุคลากรที่เลือกจำนวน ${count} คน ไปยัง “บุคลากรที่ลบแล้ว” หรือไม่?\nสามารถกู้คืนกลับมาด้วยรหัสเดิมได้ทุกเมื่อ`)){
      return;
    }
    const reasonInput=prompt(`ระบุเหตุผลการลบ (${count} คน):`,'ลบออกจากสารบบพร้อมกัน');
    if(reasonInput===null) return;
    const reason=reasonInput.trim()||'ไม่ระบุเหตุผล';
    const api=window.personnelApi;
    if(!api?.db){toast('ฐานข้อมูลยังไม่พร้อม จึงยังไม่ได้ลบ');return}

    let successCount=0;
    const deletedAt=new Date().toISOString();
    for(const id of selectedIds){
      const emp=(window.employees||[]).find(e=>empId(e)===id);
      if(!emp) continue;
      try{
        const trashData={
          ...emp,
          originalId:id,
          deletedAt,
          deletedByUid:window.personnelAccess?.uid||'',
          deletedByEmail:window.personnelAccess?.email||'',
          deleteReason:reason,
          deletedFrom:'personnel_directory_bulk'
        };
        await api.setDoc(api.doc(api.db,'deleted_employees',id),trashData);
        await api.deleteDoc(api.doc(api.db,'employees',id));
        successCount++;
      }catch(err){
        console.warn('Bulk delete failed for',id,err);
      }
    }
    window.employees=(window.employees||[]).filter(e=>!state.selected.has(empId(e)));
    if(typeof window.syncToLocalStorage==='function') window.syncToLocalStorage();
    state.selected.clear();
    await logAudit('ลบบุคลากรที่เลือก',`ย้ายไปถังขยะ ${successCount}/${count} คน (เหตุผล: ${reason})`,'BULK_DELETE');
    toast(`ย้ายบุคลากร ${successCount} คน ไปยังบุคลากรที่ลบแล้วเรียบร้อย`);
    renderPersonnelDirectory();
    if(typeof window.renderOrgChart==='function') window.renderOrgChart();
  };

  window.openPersonnelBadgePrint=function(scope){
    const allEmps = window.employees || [];
    if(!allEmps.length){toast('ไม่มีรายชื่อบุคลากรในระบบ');return}
    let ids=[];
    if(Array.isArray(scope)) ids=[...scope];
    else if(scope && scope!=='ALL' && scope!=='SELECTED') ids=[scope];
    else if(scope==='SELECTED') ids=[...state.selected];
    else ids=[];
    
    state.printIds=ids;
    state.badgeFilterOnlySelected=false;
    populateBadgeModalDepartments();
    if($('badgeModalSearchInput')) $('badgeModalSearchInput').value='';
    if($('badgeModalSearchClearBtn')) $('badgeModalSearchClearBtn').classList.add('d-none');
    renderBadgeModalEmployeePicker();
    bootstrap.Modal.getOrCreateInstance($('personnelBadgeModal')).show();
    renderPersonnelBadgePreview();
  };

  function populateBadgeModalDepartments(){
    const deptSel=$('badgeModalDeptSelect');
    if(!deptSel) return;
    const all=window.employees||[];
    const depts=[...new Set(all.map(e=>e.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
    deptSel.innerHTML='<option value="ALL">ทุกแผนก</option>'+depts.map(d=>`<option value="${esc(d)}">${esc(strip(d))}</option>`).join('');
    deptSel.value='ALL';
  }

  function getBadgeFilteredEmployees(){
    const all=window.employees||[];
    const q=($('badgeModalSearchInput')?.value||'').trim().toLowerCase();
    const dept=($('badgeModalDeptSelect')?.value||'ALL').trim();
    const onlySelected=Boolean(state.badgeFilterOnlySelected);
    const printSet=new Set(state.printIds||[]);
    return all.filter(e=>{
      const id=empId(e);
      if(onlySelected && !printSet.has(id)) return false;
      const hay=[e.name,e.nickname,e.code,e.id,e.department,e.position].join(' ').toLowerCase();
      const matchQ=!q || hay.includes(q);
      const eDept=String(e.department||'').trim();
      const matchDept=(dept==='ALL' || eDept===dept || strip(eDept)===strip(dept));
      return matchQ && matchDept;
    });
  }

  window.toggleBadgeModalOnlySelected=function(){
    state.badgeFilterOnlySelected=!state.badgeFilterOnlySelected;
    renderBadgeModalEmployeePicker();
  };

  window.clearBadgeModalSearch=function(){
    const input=$('badgeModalSearchInput');
    if(input){
      input.value='';
      input.focus();
    }
    onBadgeModalFilterChange();
  };

  window.onBadgeModalFilterChange=function(){
    const input=$('badgeModalSearchInput');
    const clearBtn=$('badgeModalSearchClearBtn');
    if(clearBtn){
      clearBtn.classList.toggle('d-none', !input || !input.value.trim());
    }
    renderBadgeModalEmployeePicker();
  };

  function renderBadgeModalEmployeePicker(){
    const listElem=$('badgeModalEmpList');
    if(!listElem) return;
    const filtered=getBadgeFilteredEmployees();
    const selCountElem=$('badgeModalSelectedCount');
    const totalCountElem=$('badgeModalTotalCount');
    const allEmps=window.employees||[];
    if(totalCountElem) totalCountElem.textContent=allEmps.length;
    if(selCountElem) selCountElem.textContent=state.printIds.length;
    
    const filterBtn=$('badgeModalSelectedFilterBtn');
    const indicator=$('badgeModalOnlySelectedIndicator');
    const isOnlySelected=Boolean(state.badgeFilterOnlySelected);
    if(filterBtn) filterBtn.classList.toggle('active-filter', isOnlySelected);
    if(indicator) indicator.classList.toggle('d-none', !isOnlySelected);

    const printSet=new Set(state.printIds);
    const hasSearch=Boolean($('badgeModalSearchInput')?.value?.trim());
    
    if(!filtered.length){
      if(isOnlySelected){
        listElem.innerHTML='<div class="text-center text-muted py-3 fs-8"><i class="bi bi-funnel text-success d-block mb-1 fs-5"></i>ไม่มีบุคลากรที่ถูกเลือก หรือไม่ตรงกับการค้นหา<br><button type="button" class="btn btn-xs btn-link text-success p-0 mt-1" onclick="toggleBadgeModalOnlySelected()">คลิกเพื่อแสดงทั้งหมด</button></div>';
      }else{
        listElem.innerHTML='<div class="text-center text-muted py-3 fs-8">ไม่พบรายชื่อตามเงื่อนไขที่ค้นหา</div>';
      }
      return;
    }

    listElem.innerHTML=filtered.map((e, idx)=>{
      const id=empId(e);
      const isChecked=printSet.has(id);
      const code=e.code||id;
      const nickText=e.nickname?` <span class="text-secondary">(ชื่อเล่น: ${esc(e.nickname)})</span>`:'';
      const isFocused=hasSearch && idx===0;
      return `<label class="badge-picker-item ${isChecked?'selected':''} ${isFocused?'border-success bg-success-subtle shadow-xs':''}" style="cursor:pointer">
        <input type="checkbox" class="form-check-input flex-shrink-0" value="${esc(id)}" ${isChecked?'checked':''} onchange="toggleBadgePrintEmp('${esc(id)}',this.checked)">
        <div class="d-flex flex-column min-width-0 flex-grow-1 ms-1">
          <div class="d-flex align-items-center justify-content-between gap-1">
            <span class="fw-bold fs-8 text-dark text-truncate">${esc(e.name||'-')}${nickText}</span>
            <span class="badge text-bg-light border font-monospace fs-9 flex-shrink-0">${esc(code)}</span>
          </div>
          <span class="fs-9 text-muted text-truncate">${esc(strip(e.department||'-'))} · ${esc(strip(e.position||'-'))}</span>
        </div>
      </label>`;
    }).join('');
    listElem.scrollTop=0;
  }

  window.toggleBadgePrintEmp=function(id, checked){
    const set=new Set(state.printIds);
    if(checked) set.add(id);
    else set.delete(id);
    state.printIds=[...set];
    renderBadgeModalEmployeePicker();
    renderPersonnelBadgePreview();
  };

  window.badgeModalSelectAll=function(select){
    const filtered=getBadgeFilteredEmployees();
    const set=new Set(state.printIds);
    filtered.forEach(e=>{
      const id=empId(e);
      if(select) set.add(id);
      else set.delete(id);
    });
    state.printIds=[...set];
    renderBadgeModalEmployeePicker();
    renderPersonnelBadgePreview();
  };

  function cleanPersonName(name){
    if(!name) return '-';
    let n = String(name).trim();
    return n.replace(/^(คุณ|นางสาว|น\.ส\.|นาย|นาง|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|ว่าที่ร้อยตรี|ว่าที่\s*ร\.ต\.|ดร\.|นพ\.|พญ\.|ทพ\.)\s*/, '').trim() || n;
  }

  function badgeEmployees(){
    const map=new Map((window.employees||[]).map(e=>[empId(e),e]));
    return state.printIds.map(id=>map.get(id)).filter(Boolean);
  }
  window.renderPersonnelBadgePreview=async function(){
    const target=$('personnelBadgePreview');if(!target)return;const people=badgeEmployees(),copies=Math.max(1,Math.min(20,Number($('badgeCopies')?.value)||1)),cols=Math.max(1,Math.min(4,Number($('badgeColumns')?.value)||4)),theme=$('badgeTheme')?.value||'#176e4c';
    if(!people.length){
      target.innerHTML='<div class="text-center text-muted py-5"><i class="bi bi-person-badge fs-1 d-block mb-2 text-secondary opacity-50"></i><div class="fw-bold">ยังไม่ได้เลือกบุคลากรเพื่อพิมพ์บัตร</div><div class="small text-muted mt-1">กรุณาพิมพ์ค้นหา หรือคลิกเลือกรายชื่อบุคลากรจากรายการด้านซ้าย</div></div>';
      return;
    }
    const opts={photo:$('badgeShowPhoto')?.checked,qr:$('badgeShowQr')?.checked,role:$('badgeShowRole')?.checked,details:$('badgeShowDetails')?.checked};
    const projectTitle = typeof window.getFloraProjectTitle === 'function' ? window.getFloraProjectTitle() : 'โครงการรัตนบุปผา';
    const cards=[];
    people.forEach(e=>{
      const code=e.code||empId(e);
      const qrData=code;
      const cleanName=cleanPersonName(e.name);
      const deptName=strip(e.department||'ไม่ระบุแผนก');
      const posName=strip(e.position||'-');
      for(let i=0;i<copies;i++){
        cards.push(`<div class="personnel-id-card" style="--badge-color:${theme}">
          <div class="personnel-id-card-header">
            <div class="badge-header-title">${esc(projectTitle)}</div>
            <div class="badge-header-dept">${esc(deptName)}</div>
          </div>
          <div class="personnel-id-card-body">
            ${opts.photo?`
              <div class="personnel-id-card-photo-box">
                <img class="personnel-id-card-photo" src="${esc(e.photoUrl||'favicon.png')}" onerror="this.src='favicon.png'">
              </div>
            `:''}
            <b class="personnel-id-card-name">${esc(cleanName)}</b>
            ${opts.role?`<div class="personnel-id-card-pos">${esc(posName)}</div>`:''}
            ${opts.details?`<div class="personnel-id-card-meta">${esc(e.phone?'โทร '+e.phone:(e.details||e.note||''))}</div>`:''}
            <div class="personnel-id-card-bottom-row">
              <div class="personnel-id-card-code-badge">
                <span class="personnel-code-label">รหัสบุคลากร</span>
                <span class="personnel-code-val">${esc(code)}</span>
              </div>
              ${opts.qr?`<div class="personnel-id-card-qr-box"><img class="personnel-id-card-qr" data-personnel-qr="${esc(qrData)}" alt="QR ${esc(code)}" title="QR ${esc(code)}"></div>`:''}
            </div>
          </div>
        </div>`);
      }
    });
    const width=$('badgePaper')?.value==='PVC'?'86mm':'100%';
    target.innerHTML=`<div class="personnel-badge-sheet" style="grid-template-columns:repeat(${cols},minmax(0,1fr));max-width:${width}">${cards.join('')}</div>`;
    await hydrateQr(target);
  };
  async function hydrateQr(root){
    for(const img of root.querySelectorAll('[data-personnel-qr]')){
      const data=img.dataset.personnelQr;
      if(!data) continue;
      try{
        if(window.QRCode?.toDataURL){
          img.src=await window.QRCode.toDataURL(data,{width:220,margin:1,errorCorrectionLevel:'M'});
        } else {
          img.src=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=${encodeURIComponent(data)}`;
        }
      }catch(e){
        try{
          img.src=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=${encodeURIComponent(data)}`;
        }catch(e2){
          img.alt='สร้าง QR ไม่สำเร็จ';
          img.removeAttribute('src');
        }
      }
    }
  }
  window.printPersonnelBadges=async function(){
    if(!state.printIds.length){
      toast('กรุณาเลือกบุคลากรอย่างน้อย 1 คนเพื่อพิมพ์บัตร');
      return;
    }
    await renderPersonnelBadgePreview();
    const preview=$('personnelBadgePreview');if(!preview)return;
    const orientation=$('badgeOrientation')?.value||'landscape',paper=$('badgePaper')?.value||'A4',theme=$('badgeTheme')?.value||'#176e4c',cols=Math.max(1,Math.min(4,Number($('badgeColumns')?.value)||4));
    const isA4Land = paper==='A4' && orientation==='landscape';
    const cardHeight = isA4Land ? '90mm' : (paper==='PVC' ? '52mm' : '58mm');
    const photoSize = isA4Land ? '31mm' : (paper==='PVC' ? '24mm' : '26mm');
    const qrSize = isA4Land ? '22mm' : '18mm';
    const pageMargin = paper==='PVC' ? '0' : (isA4Land ? '5mm' : '6mm');
    const gridGap = paper==='PVC' ? '0' : (isA4Land ? '3mm' : '4mm');
    const w=window.open('','_blank');if(!w){alert('กรุณาอนุญาต Pop-up เพื่อพิมพ์บัตร');return}
    w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>บัตรบุคลากร</title><style>
      @page{size:${paper==='PVC'?'86mm 54mm':'A4 '+orientation};margin:${pageMargin}}
      *{box-sizing:border-box}
      body{font-family:'Sarabun',Arial,sans-serif;margin:0;padding:${paper==='PVC'?'0':'2mm'};background:#fff;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .personnel-badge-sheet{display:grid;grid-template-columns:repeat(${paper==='PVC'?'1':cols},minmax(0,1fr));gap:${gridGap};max-width:100%;justify-content:center}
      .personnel-id-card{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;padding:2.5mm 3mm;border:2px solid ${theme};border-radius:3.5mm;break-inside:avoid;page-break-inside:avoid;height:${cardHeight};max-height:${cardHeight};background:#fff;overflow:hidden;box-sizing:border-box}
      .personnel-id-card-header{width:100%;padding:2mm 1.2mm;background:${theme};color:#fff;border-radius:2.5mm;text-align:center;flex-shrink:0}
      .badge-header-title{font-size:10pt;font-weight:bold;line-height:1.2;letter-spacing:0.2px}
      .badge-header-dept{font-size:8pt;font-weight:600;opacity:0.95;margin-top:0.4mm;line-height:1.15}
      .personnel-id-card-body{display:flex;flex-direction:column;align-items:center;width:100%;flex:1;justify-content:space-between;padding:1mm 0 0.5mm;min-height:0;overflow:hidden}
      .personnel-id-card-photo-box{width:100%;display:flex;justify-content:center;align-items:center;margin:1.5mm 0 1mm;flex-shrink:0}
      .personnel-id-card-photo{width:${photoSize};height:${photoSize};object-fit:cover;border-radius:3mm;border:1.8px solid ${theme};display:block}
      .personnel-id-card-bottom-row{display:flex;align-items:center;justify-content:center;gap:3.5mm;width:100%;margin-top:auto;padding-top:1.5mm;margin-bottom:0.5mm;flex-shrink:0}
      .personnel-id-card-code-badge{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8fafc;border:1.2px solid #94a3b8;border-radius:2.2mm;padding:1.2mm 2.5mm;min-width:20mm}
      .personnel-code-label{font-size:6.8pt;color:#475569;font-weight:bold;line-height:1;margin-bottom:0.6mm}
      .personnel-code-val{font-size:9.5pt;font-weight:bold;font-family:monospace;color:#0f172a;line-height:1.15;word-break:break-all}
      .personnel-id-card-name{font-size:11.5pt;font-weight:bold;color:#0f172a;margin-top:1mm;line-height:1.2;text-align:center;word-break:break-word}
      .personnel-id-card-pos{font-size:8.5pt;font-weight:bold;color:${theme};margin-top:0.6mm;text-align:center;line-height:1.2}
      .personnel-id-card-meta{font-size:7.5pt;color:#64748b;margin-top:0.4mm;text-align:center}
      .personnel-id-card-qr-box{display:flex;align-items:center;justify-content:center}
      .personnel-id-card-qr{width:${qrSize};height:${qrSize};object-fit:contain;image-rendering:pixelated}
    </style></head><body>${preview.innerHTML}<script>window.onload=()=>{setTimeout(()=>{window.print();},300);}<\/script></body></html>`);
    w.document.close();
  };

  function connectApi(){const api=window.personnelApi;if(!api||state.apiConnected)return;state.apiConnected=true;api.onSnapshot(api.collection(api.db,'transactions'),snap=>{state.transactions=snap.docs.map(d=>({id:d.id,...d.data()}));if(state.activeHistoryId)renderPersonnelHistory()},err=>console.warn('transactions listener',err));api.onSnapshot(api.collection(api.db,'deleted_employees'),snap=>{state.deletedEmployees=snap.docs.map(d=>({trashId:d.id,...d.data()})).sort((a,b)=>(Date.parse(b.deletedAt)||0)-(Date.parse(a.deletedAt)||0));const count=state.deletedEmployees.length;if($('personnelTrashCount'))$('personnelTrashCount').textContent=count;if($('orgPersonnelTrashBadge'))$('orgPersonnelTrashBadge').textContent=count;if($('personnelDirectoryTrashBadge'))$('personnelDirectoryTrashBadge').textContent=count;if($('personnelTrashModal')?.classList.contains('show'))renderPersonnelTrash()},err=>console.warn('deleted employees listener',err));}

  window.openPersonnelTrash=function(){if(!window.requirePersonnelAdmin('เปิดถังขยะบุคลากร'))return;$('personnelTrashSearch').value='';renderPersonnelTrash();bootstrap.Modal.getOrCreateInstance($('personnelTrashModal')).show()};
  window.renderPersonnelTrash=function(){const body=$('personnelTrashBody');if(!body)return;const q=($('personnelTrashSearch')?.value||'').trim().toLowerCase(),list=state.deletedEmployees.filter(x=>[x.name,x.code,x.originalId,x.department,x.position,x.deleteReason,x.deletedByEmail].join(' ').toLowerCase().includes(q));body.innerHTML=list.length?list.map(x=>{const id=String(x.trashId||x.originalId||x.id||''),photo=x.photoUrl||x.photo||'favicon.png';return `<tr><td><div class="d-flex align-items-center gap-2"><img class="personnel-avatar" src="${esc(photo)}" onerror="this.src='favicon.png'"><div><b>${esc(x.name||'-')}</b><div class="small font-monospace text-muted">${esc(x.code||x.originalId||'-')}</div></div></div></td><td><b>${esc(strip(x.position||'-'))}</b><div class="small text-muted">${esc(strip(x.department||'-'))}</div></td><td class="small">${esc(formatTrashDate(x.deletedAt))}</td><td class="small">${esc(x.deletedByEmail||'-')}<div class="text-muted">${esc(x.deleteReason||'ไม่ระบุเหตุผล')}</div></td><td><div class="d-flex justify-content-center flex-wrap gap-1"><button class="btn btn-success btn-sm rounded-pill" onclick="restorePersonnelFromTrash('${esc(id)}')"><i class="bi bi-arrow-counterclockwise me-1"></i>กู้คืน</button><button class="btn btn-outline-danger btn-sm rounded-pill" onclick="permanentlyDeletePersonnel('${esc(id)}')"><i class="bi bi-trash-fill me-1"></i>ลบถาวร</button></div></td></tr>`}).join(''):'<tr><td colspan="5" class="text-center text-muted py-5"><i class="bi bi-trash3 fs-2 d-block mb-2"></i>ไม่มีบุคลากรที่ลบแล้ว</td></tr>'};
  function formatTrashDate(value){const d=new Date(value||'');return Number.isNaN(d.getTime())?'-':d.toLocaleString('th-TH')}
  window.restorePersonnelFromTrash=async function(trashId){if(!window.requirePersonnelAdmin('กู้คืนบุคลากร'))return;const api=window.personnelApi,row=state.deletedEmployees.find(x=>String(x.trashId)===String(trashId));if(!api?.db||!row)return;const originalId=String(row.originalId||row.id||row.code||trashId),duplicate=(window.employees||[]).find(e=>String(e.id||e.code)===originalId||String(e.code||'')===String(row.code||''));if(duplicate){alert(`ยังคืน “${row.name||originalId}” ไม่ได้ เพราะรหัส ${row.code||originalId} มีอยู่ในสารบบแล้ว\nระบบจะไม่เขียนทับข้อมูลเดิม`);return}if(!confirm(`กู้คืน “${row.name||originalId}” กลับเข้าสารบบด้วยรหัสเดิมหรือไม่?`))return;const data={...row};delete data.trashId;delete data.originalId;delete data.deletedAt;delete data.deletedByUid;delete data.deletedByEmail;delete data.deleteReason;delete data.deletedFrom;const positionOk=!data.positionNodeId||Boolean(window.getFloraOrgNode?.(data.positionNodeId)),departmentOk=!data.departmentNodeId||Boolean(window.getFloraOrgNode?.(data.departmentNodeId));if(!positionOk||!departmentOk){data.positionNodeId='';data.departmentNodeId='';data.position='พนักงาน';data.department='ยังไม่ระบุแผนก';data.role='WORKER'}data.id=originalId;data.restoredAt=new Date().toISOString();data.restoredBy=window.personnelAccess?.email||'';await api.setDoc(api.doc(api.db,'employees',originalId),data);await api.deleteDoc(api.doc(api.db,'deleted_employees',trashId));await logAudit('กู้คืนบุคลากร',{employeeId:originalId,name:data.name,restoredToUnassigned:!positionOk||!departmentOk},originalId);toast(`กู้คืน “${data.name||originalId}” เรียบร้อยแล้ว${!positionOk||!departmentOk?' และนำไปไว้รอลงผัง':''}`)};
  window.permanentlyDeletePersonnel=async function(trashId){if(!window.requirePersonnelAdmin('ลบบุคลากรถาวร'))return;const api=window.personnelApi,row=state.deletedEmployees.find(x=>String(x.trashId)===String(trashId));if(!api?.db||!row)return;if(!confirm(`คำเตือน: ต้องการลบ “${row.name||trashId}” ออกจากถังขยะอย่างถาวรหรือไม่?`))return;if(!confirm('ยืนยันครั้งที่ 2: หลังลบถาวรจะกู้คืนจากถังขยะไม่ได้ ต้องอาศัยไฟล์สำรองภายนอกเท่านั้น'))return;const photo=String(row.photoUrl||row.photo||'');if(api.storage&&photo.includes('firebasestorage.googleapis.com')){try{await api.deleteObject(api.ref(api.storage,photo))}catch(e){console.warn('delete personnel photo',e)}}await api.deleteDoc(api.doc(api.db,'deleted_employees',trashId));await logAudit('ลบบุคลากรถาวร',{employeeId:row.originalId||row.id||row.code,name:row.name},trashId);toast(`ลบ “${row.name||trashId}” อย่างถาวรแล้ว`)};
  window.openPersonnelHistory=function(id){state.activeHistoryId=id;const e=(window.employees||[]).find(x=>empId(x)===id);if(!e)return;$('personnelHistoryTitle').textContent=`ประวัติของ ${e.name||id}`;bootstrap.Modal.getOrCreateInstance($('personnelHistoryModal')).show();renderPersonnelHistory()};
  function employeeTransactions(){const e=(window.employees||[]).find(x=>empId(x)===state.activeHistoryId);if(!e)return[];return state.transactions.filter(t=>String(t.employeeId||'')===empId(e)||(t.employeeName&&String(t.employeeName).includes(e.name||'___'))).sort((a,b)=>(Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0))}
  window.renderPersonnelHistory=function(){const all=employeeTransactions(),q=($('personnelHistorySearch')?.value||'').toLowerCase(),type=$('personnelHistoryType')?.value||'ALL';const counts={w:0,b:0,r:0};all.forEach(t=>{if(t.type==='เบิกจ่าย')counts.w++;else if(t.type==='ยืมอุปกรณ์')counts.b++;else if(t.type==='คืนอุปกรณ์')counts.r++});$('histWithdraw').textContent=counts.w;$('histBorrow').textContent=counts.b;$('histReturn').textContent=counts.r;$('histTotal').textContent=all.length;const list=all.filter(t=>(type==='ALL'||t.type===type)&&(!q||[t.equipmentName,t.location,t.note,t.docNo].join(' ').toLowerCase().includes(q)));$('personnelHistoryBody').innerHTML=list.length?list.map(t=>`<tr><td>${esc(t.timestamp||'-')}</td><td><span class="badge ${t.type==='เบิกจ่าย'?'text-bg-danger':t.type==='ยืมอุปกรณ์'?'text-bg-warning':t.type==='คืนอุปกรณ์'?'text-bg-info':'text-bg-secondary'}">${esc(t.type||'-')}</span></td><td>${esc(t.equipmentName||t.items?.map(i=>i.equipmentName).join(', ')||'-')}</td><td>${esc(t.quantity||t.items?.reduce((s,i)=>s+(Number(i.quantity)||0),0)||'-')} ${esc(t.unit||'')}</td><td>${esc(t.location||'-')}<div class="text-muted">${esc(t.note||'')}</div></td></tr>`).join(''):'<tr><td colspan="5" class="text-center text-muted py-4">ไม่พบประวัติ</td></tr>'};
  window.printPersonnelHistory=function(){const e=(window.employees||[]).find(x=>empId(x)===state.activeHistoryId),rows=employeeTransactions();if(!e)return;const w=window.open('','_blank');if(!w){alert('กรุณาอนุญาต Pop-up');return}w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ประวัติ ${esc(e.name)}</title><style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:7px}th{background:#e8f5e9}</style></head><body><h2>รายงานประวัติเบิก–จ่าย–ยืม–คืนรายบุคคล</h2><p><b>${esc(e.name)}</b> [${esc(e.code||empId(e))}] · ${esc(strip(e.department||''))}</p><table><thead><tr><th>วันเวลา</th><th>ประเภท</th><th>อุปกรณ์</th><th>จำนวน</th><th>สถานที่/หมายเหตุ</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${esc(t.timestamp||'-')}</td><td>${esc(t.type||'-')}</td><td>${esc(t.equipmentName||'-')}</td><td>${esc(t.quantity||'-')} ${esc(t.unit||'')}</td><td>${esc(t.location||'-')} ${esc(t.note||'')}</td></tr>`).join('')}</tbody></table><script>setTimeout(()=>window.print(),200)<\/script></body></html>`);w.document.close()};

  window.openPersonnelQrScanner=function(){const sel=$('personnelQrSelect');if(sel)sel.innerHTML='<option value="">-- เลือกจากรายชื่อ --</option>'+[...(window.employees||[])].sort((a,b)=>(a.name||'').localeCompare(b.name||'','th')).map(e=>`<option value="${esc(empId(e))}">${esc(e.name||'-')} [${esc(e.code||empId(e))}]</option>`).join('');$('personnelQrResult').innerHTML='';bootstrap.Modal.getOrCreateInstance($('personnelQrModal')).show();setTimeout(startPersonnelQrScanner,350)};
  async function startPersonnelQrScanner(){if(!window.Html5Qrcode||state.scanner)return;try{state.scanner=new Html5Qrcode('personnelQrReader');await state.scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:220,height:220}},text=>findPersonnelFromQr(text),()=>{})}catch(e){console.warn('QR scanner',e)}}
  window.stopPersonnelQrScanner=async function(){if(!state.scanner)return;try{await state.scanner.stop();await state.scanner.clear()}catch(e){}state.scanner=null};
  window.findPersonnelFromQr=function(raw){
    if(!raw) return;
    const rawTrim=String(raw).trim();
    const rawLower=rawTrim.toLowerCase();
    const clean=rawTrim.replace(/^(EMPLOYEE|EE|EMP|PERSONNEL|STAFF|ID|CODE)\s*[:=\-_\/]\s*/i,'').trim();
    const q=clean.toLowerCase();

    const e=(window.employees||[]).find(x=>{
      const xId=String(x.id||'').trim().toLowerCase();
      const xCode=String(x.code||'').trim().toLowerCase();
      const xName=String(x.name||'').trim().toLowerCase();

      // Check full raw code first (e.g. EMP-038, SF-01)
      if(xId===rawLower || xCode===rawLower || xName===rawLower) return true;
      // Check stripped code (e.g. 038)
      if(xId===q || xCode===q || xName===q) return true;
      if(xName.includes(rawLower) || (q.length>=3 && xName.includes(q))) return true;

      // Check if stored employee code has prefix that can be stripped
      const strippedId=xId.replace(/^(employee|ee|emp|personnel|staff|id|code)\s*[:=\-_\/]\s*/i,'');
      const strippedCode=xCode.replace(/^(employee|ee|emp|personnel|staff|id|code)\s*[:=\-_\/]\s*/i,'');
      if(strippedId===q || strippedCode===q) return true;
      if(strippedId===rawLower || strippedCode===rawLower) return true;

      return false;
    });
    const out=$('personnelQrResult');
    if(!e){out.innerHTML='<div class="alert alert-warning">ไม่พบข้อมูลบุคลากร</div>';return}
    const id=empId(e);
    out.innerHTML=`<div class="card border-success"><div class="card-body d-flex flex-wrap align-items-center gap-3"><img class="personnel-avatar" style="width:80px;height:80px" src="${esc(e.photoUrl||'favicon.png')}"><div class="flex-grow-1"><h5 class="fw-bold mb-1">${esc(e.name||'-')}</h5><div>${esc(e.code||id)} · ${esc(strip(e.department||'-'))} · ${esc(strip(e.position||'-'))}</div></div><div class="d-flex flex-wrap gap-1"><button class="btn btn-primary btn-sm personnel-admin-only" onclick="openEditModal('${esc(id)}')">แก้ไข</button><button class="btn btn-success btn-sm" onclick="openPersonnelBadgePrint(['${esc(id)}'])">พิมพ์บัตร</button><button class="btn btn-info btn-sm" onclick="openPersonnelHistory('${esc(id)}')">ประวัติ</button><button class="btn btn-warning btn-sm personnel-admin-only" onclick="selectPersonnelForAttendance('${esc(id)}')">ลงเวลา</button></div></div></div>`;
    updateAccessUi();
  };
  window.selectPersonnelForAttendance=function(id){if(!window.requirePersonnelAdmin('ลงเวลา'))return;bootstrap.Modal.getInstance($('personnelQrModal'))?.hide();window.switchWorkspaceTab?.('attendance');setTimeout(()=>{if($('personnelAttendanceEmployee'))$('personnelAttendanceEmployee').value=id},100)};

  window.openPersonnelExcelImport=function(){if(!window.requirePersonnelAdmin('นำเข้าบุคลากร'))return;state.parsedExcel=[];$('personnelExcelPreview').innerHTML='<tr><td colspan="7" class="text-center text-muted py-4">ยังไม่ได้เลือกไฟล์</td></tr>';$('personnelExcelCount').textContent='0 รายการ';bootstrap.Modal.getOrCreateInstance($('personnelExcelModal')).show()};
  async function readPersonnelExcelFile(ev){const file=ev.target.files?.[0];if(!file)return;if(!window.XLSX){alert('ยังโหลดระบบ Excel ไม่สำเร็จ');return}const data=await file.arrayBuffer(),wb=XLSX.read(data,{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});const pick=(r,names)=>{for(const n of names)if(r[n]!==undefined&&String(r[n]).trim())return String(r[n]).trim();return''};state.parsedExcel=rows.map(r=>({code:pick(r,['รหัสพนักงาน','รหัสบุคลากร','code','id']),name:pick(r,['ชื่อ-นามสกุล','ชื่อ','name']),nickname:pick(r,['ชื่อเล่น','nickname']),department:pick(r,['แผนก','department']),position:pick(r,['ตำแหน่ง','position']),phone:pick(r,['เบอร์โทร','เบอร์โทรศัพท์','phone']),details:pick(r,['รายละเอียด','หมายเหตุ','details']),status:pick(r,['สถานะ','status'])||'ปฏิบัติงาน'})).filter(e=>e.name||e.code);renderExcelPreview()}
  function renderExcelPreview(){const existing=window.employees||[];$('personnelExcelPreview').innerHTML=state.parsedExcel.map(e=>{const dup=existing.find(x=>(e.code&&[x.id,x.code].includes(e.code))||(e.name&&x.name===e.name));return `<tr><td><span class="badge ${dup?'text-bg-warning':'text-bg-success'}">${dup?'ข้อมูลซ้ำ':'เพิ่มใหม่'}</span></td><td>${esc(e.code||'-')}</td><td>${esc(e.name||'-')}</td><td>${esc(e.nickname||'-')}</td><td>${esc(strip(e.department||'-'))}</td><td>${esc(strip(e.position||'-'))}</td><td>${esc(e.phone||'-')}</td></tr>`}).join('')||'<tr><td colspan="7" class="text-center">ไม่พบข้อมูล</td></tr>';$('personnelExcelCount').textContent=`${state.parsedExcel.length} รายการ`}
  window.importPersonnelExcel=async function(){if(!window.requirePersonnelAdmin('นำเข้าบุคลากร')||!state.parsedExcel.length)return;const api=window.personnelApi;if(!api?.db){toast('ฐานข้อมูลยังไม่พร้อม');return}const overwrite=$('personnelExcelOverwrite')?.checked;let added=0,updated=0,skipped=0;for(const row of state.parsedExcel){const found=(window.employees||[]).find(x=>(row.code&&[x.id,x.code].includes(row.code))||(row.name&&x.name===row.name));if(found&&!overwrite){skipped++;continue}const id=empId(found)||row.code||`EMP-${Date.now()}-${added}`;const a=window.resolveFloraAssignmentByLabels?.(row.department,row.position)||{};const data={...(found||{}),...row,id,code:row.code||found?.code||id,departmentNodeId:a.departmentNodeId||found?.departmentNodeId||'',positionNodeId:a.positionNodeId||found?.positionNodeId||'',department:a.department||row.department||found?.department||'',position:a.position||row.position||found?.position||'',updatedAt:new Date().toISOString()};await api.setDoc(api.doc(api.db,'employees',id),data,{merge:true});found?updated++:added++}await logAudit('นำเข้า Excel',`เพิ่ม ${added} อัปเดต ${updated} ข้าม ${skipped}`,'BULK_IMPORT');toast(`นำเข้าสำเร็จ: เพิ่ม ${added}, อัปเดต ${updated}, ข้าม ${skipped}`);bootstrap.Modal.getInstance($('personnelExcelModal'))?.hide()};
  window.downloadPersonnelExcelTemplate=function(){const rows=[{'รหัสพนักงาน':'WK-001','ชื่อ-นามสกุล':'สมชาย ใจดี','ชื่อเล่น':'ชาย','แผนก':'งานระบบน้ำ','ตำแหน่ง':'พนักงานดูแลระบบน้ำ','เบอร์โทรศัพท์':'081-000-0000','รายละเอียด':'ดูแลระบบน้ำ','สถานะ':'ปฏิบัติงาน'}];if(window.XLSX){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'บุคลากร');XLSX.writeFile(wb,'Flora-Personnel-Template.xlsx')}};
  window.exportPersonnelCsv=function(){const cols=['รหัสพนักงาน','ชื่อ-นามสกุล','ชื่อเล่น','แผนก','ตำแหน่ง','เบอร์โทรศัพท์','รายละเอียด','สถานะ'];const lines=[cols.join(',')];(window.employees||[]).forEach(e=>lines.push([e.code||e.id,e.name,e.nickname,e.department,e.position,e.phone,e.details||e.note,e.status].map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')));const blob=new Blob(['\uFEFF'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Flora-Personnel.csv';a.click();URL.revokeObjectURL(a.href)};

  async function imageSource(blob){if(typeof createImageBitmap==='function')return createImageBitmap(blob);return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'))};img.src=url})}
  async function compressImage(blob,config=settings()){const max={SMALL:1000,MEDIUM:1600,LARGE:2400}[config.preset]||1600,img=await imageSource(blob),ratio=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,canvas.width,canvas.height);const type=config.format==='jpeg'?'image/jpeg':'image/webp';let quality=.86,out=await canvasBlob(canvas,type,quality);while(out.size>(Number(config.maxKB)||350)*1024&&quality>.5){quality-=.1;out=await canvasBlob(canvas,type,quality)}if(typeof img.close==='function')img.close();return{blob:out,ext:type==='image/webp'?'webp':'jpg'}}
  const canvasBlob=(canvas,type,q)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('บีบอัดรูปไม่สำเร็จ')),type,q));
  window.handlePersonnelPhotoFileSelected=async function(event){const file=event.target.files?.[0];if(!file)return;try{const res=await compressImage(file);const url=URL.createObjectURL(res.blob);$('formPhotoPreview').src=url;$('formPhotoDataUrl').value='';$('personnelPhotoStatus').textContent=`พร้อมอัปโหลด ${(res.blob.size/1024).toFixed(0)} KB (${settings().preset})`;$('formPhotoUrlInput').value=''}catch(e){toast(e.message)}};
  window.preparePersonnelPhotoForSave=async function(id,currentUrl=''){const file=$('formPhotoFileInput')?.files?.[0]||$('formPhotoCameraInput')?.files?.[0],manual=$('formPhotoUrlInput')?.value.trim();if(!file)return manual||currentUrl||$('formPhotoPreview')?.src||'';const api=window.personnelApi;if(!api?.storage)throw new Error('Firebase Storage ยังไม่พร้อม จึงยังไม่บันทึกรูปใหม่');const result=await compressImage(file),safe=String(id||'employee').replace(/[^a-zA-Z0-9_-]/g,'_'),r=api.ref(api.storage,`employee_photos/${safe}.${result.ext}`);await api.uploadBytes(r,result.blob,{contentType:result.blob.type});return await api.getDownloadURL(r)};
  window.openPersonnelPhotoSettings=function(){if(!window.requirePersonnelAdmin('ตั้งค่ารูป'))return;const s=settings();$('personnelPhotoPreset').value=s.preset;$('personnelPhotoMaxKb').value=s.maxKB;$('personnelPhotoFormat').value=s.format;$('personnelPhotoProgress').textContent='';bootstrap.Modal.getOrCreateInstance($('personnelPhotoSettingsModal')).show()};
  window.savePersonnelPhotoSettings=function(){if(!window.requirePersonnelAdmin('บันทึกการตั้งค่ารูป'))return;localStorage.setItem('flora_personnel_photo_settings',JSON.stringify({enabled:true,preset:$('personnelPhotoPreset').value,maxKB:Number($('personnelPhotoMaxKb').value)||350,format:$('personnelPhotoFormat').value}));toast('บันทึกการตั้งค่ารูปเรียบร้อยแล้ว')};
  window.compressExistingPersonnelPhotos=async function(){if(!window.requirePersonnelAdmin('บีบอัดรูปเดิม'))return;if(!confirm('ระบบจะบีบอัดและอัปโหลดรูปบุคลากรเดิมเข้า Firebase Storage เมื่อ Admin กดเท่านั้น ยืนยันดำเนินการหรือไม่?'))return;const api=window.personnelApi;if(!api?.storage)return;let ok=0,fail=0,skip=0;const list=window.employees||[];for(let i=0;i<list.length;i++){const e=list[i],url=String(e.photoUrl||'');$('personnelPhotoProgress').textContent=`กำลังตรวจ ${i+1}/${list.length}: ${e.name||empId(e)}`;if(!url||url.includes('/employee_photos%2F')||url.includes('/employee_photos/')){skip++;continue}try{const res=await fetch(url),blob=await res.blob(),c=await compressImage(blob),safe=empId(e).replace(/[^a-zA-Z0-9_-]/g,'_'),ref=api.ref(api.storage,`employee_photos/${safe}.${c.ext}`);await api.uploadBytes(ref,c.blob,{contentType:c.blob.type});const newUrl=await api.getDownloadURL(ref);await api.setDoc(api.doc(api.db,'employees',empId(e)),{photoUrl:newUrl,updatedAt:new Date().toISOString()},{merge:true});ok++}catch(err){console.warn('compress old photo',e.name,err);fail++}}$('personnelPhotoProgress').textContent=`เสร็จแล้ว: สำเร็จ ${ok}, ข้าม ${skip}, ไม่สำเร็จ ${fail}`;await logAudit('บีบอัดรูปเดิม',`สำเร็จ ${ok} ข้าม ${skip} ไม่สำเร็จ ${fail}`,'EMPLOYEE_PHOTOS')};

  let facing='environment';
  window.openPersonnelLiveCamera=async function(){if(!window.requirePersonnelAdmin('ถ่ายรูปบุคลากร'))return;state.cameraBlob=null;$('personnelCameraPreview').classList.add('d-none');$('personnelCameraVideo').classList.remove('d-none');$('personnelCameraUse').classList.add('d-none');$('personnelCameraSnap').classList.remove('d-none');bootstrap.Modal.getOrCreateInstance($('personnelCameraModal')).show();await startCamera()};
  async function startCamera(){try{closeStream();state.cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:1600},height:{ideal:1200}}});$('personnelCameraVideo').srcObject=state.cameraStream;$('personnelCameraError').classList.add('d-none')}catch(e){$('personnelCameraError').classList.remove('d-none')}}
  function closeStream(){state.cameraStream?.getTracks().forEach(t=>t.stop());state.cameraStream=null}
  window.closePersonnelLiveCamera=closeStream;
  window.switchPersonnelCamera=async function(){facing=facing==='environment'?'user':'environment';await startCamera()};
  window.takePersonnelCameraPhoto=async function(){const v=$('personnelCameraVideo'),c=$('personnelCameraCanvas');if(!v?.videoWidth)return;c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);state.cameraBlob=await canvasBlob(c,'image/jpeg',.92);$('personnelCameraPreview').src=URL.createObjectURL(state.cameraBlob);$('personnelCameraPreview').classList.remove('d-none');v.classList.add('d-none');$('personnelCameraUse').classList.remove('d-none');$('personnelCameraSnap').classList.add('d-none')};
  window.usePersonnelCameraPhoto=function(){if(!state.cameraBlob)return;const file=new File([state.cameraBlob],`employee_${Date.now()}.jpg`,{type:'image/jpeg'}),dt=new DataTransfer();dt.items.add(file);const input=$('formPhotoFileInput');input.files=dt.files;handlePersonnelPhotoFileSelected({target:input});bootstrap.Modal.getInstance($('personnelCameraModal'))?.hide();closeStream()};

  window.logPersonnelAudit=logAudit;
  async function logAudit(action,details,targetId=''){const api=window.personnelApi;if(!api?.db)return;try{await api.addDoc(api.collection(api.db,'audit_logs'),{module:'บุคลากร',action,details,targetId,userEmail:window.personnelAccess?.email||'',timestamp:new Date().toISOString(),source:'org_chart'})}catch(e){console.warn('audit log',e)}}

  window.addEventListener('flora-personnel-api-ready',connectApi);
  window.addEventListener('flora-personnel-auth-changed',()=>{updateAccessUi();renderPersonnelDirectory()});
  window.addEventListener('flora-personnel-data-changed',renderPersonnelDirectory);
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',()=>{mount();connectApi()},{once:true});else{mount();connectApi()}
  window.personnelToolsState=state;
})();
