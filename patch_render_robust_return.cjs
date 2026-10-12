const fs = require('fs');

let script = fs.readFileSync('script.js', 'utf8');

const targetRender = `        if (!listContainer) return;
        if (noItemsBox) noItemsBox.classList.add('d-none');
        listContainer.innerHTML = returnItems.map(it => {
          const isAtMax = (it.returnQty || 1) >= it.borrowedQty;
          const isAtMin = (it.returnQty || 1) <= 1;
          return \`
          <div class="d-flex align-items-center justify-content-between py-1.5 ps-1 pe-1 bg-white rounded-3 border border-light shadow-2xs gap-2">
            <div class="d-flex align-items-center gap-1.5 flex-grow-1 min-w-0 overflow-hidden ps-0 ms-0" style="min-width: 0;">
              <span class="fw-bold font-monospace fs-7 flex-shrink-0 ps-0 ms-0" style="color: #0d47a1;">\${escapeHtml(it.equipmentCode || it.equipmentId || '')}</span>
              <span class="fw-semibold text-dark text-truncate fs-7 flex-grow-1" style="min-width: 0;" title="\${escapeHtml(it.equipmentName || '-')}">\${escapeHtml(it.equipmentName || '-')}</span>
              <span class="text-muted fs-8 text-nowrap ms-1 flex-shrink-0 d-none d-sm-inline">(ยืม \${it.borrowedQty})</span>
            </div>
            <div class="d-flex align-items-center gap-1 flex-shrink-0 pe-0 me-0">
              <div class="input-group input-group-sm align-items-center bg-light rounded-pill border px-1" style="height: 28px;">
                <button type="button" class="btn btn-sm btn-link text-dark p-0 px-1.5 border-0 text-decoration-none lh-1" onclick="updateScannerReturnItemQty('\${it.equipmentId}', -1)" \${isAtMin ? 'disabled style="opacity:0.35;"' : ''} title="ลดจำนวนที่จะคืน">
                  <i class="bi bi-dash fw-bold fs-6"></i>
                </button>
                <span class="fw-bold text-dark px-1 fs-7 text-center" style="min-width: 20px;">\${it.returnQty || 1}</span>
                <button type="button" class="btn btn-sm btn-link text-dark p-0 px-1.5 border-0 text-decoration-none lh-1" onclick="updateScannerReturnItemQty('\${it.equipmentId}', 1)" \${isAtMax ? 'disabled style="opacity:0.35;"' : ''} title="เพิ่มจำนวนที่จะคืน (ไม่เกินจำนวนที่ยืม \${it.borrowedQty})">
                  <i class="bi bi-plus fw-bold fs-6"></i>
                </button>
              </div>
              <button type="button" class="btn btn-sm \${isAuthorizedReturn ? 'btn-info text-dark shadow-xs' : 'btn-outline-secondary opacity-75'} fw-bold rounded-pill px-2.5 py-0.5 border-0 lh-1 text-nowrap fs-8 me-0" onclick="confirmSingleReturnFromScanner('\${it.equipmentId}')" title="\${isAuthorizedReturn ? 'คืนอุปกรณ์รายการนี้' : 'สแกนบัตรเจ้าหน้าที่เพื่อปลดล็อกการคืน'}">
                \${isAuthorizedReturn ? '<i class=\"bi bi-box-arrow-in-down me-1\"></i>คืน' : '<i class=\"bi bi-shield-lock me-1\"></i>คืน'}
              </button>
            </div>
          </div>
        \`;
        }).join('');
        return;`;

const replacementRender = `        if (!listContainer) return;
        if (noItemsBox) noItemsBox.classList.add('d-none');
        listContainer.classList.remove('d-none');

        // ตรวจสอบและแสดงรายการอุปกรณ์ที่ยืมค้างส่งคืนทั้งหมดอย่างชัดเจน
        listContainer.innerHTML = returnItems.map((it, idx) => {
          const isAtMax = (it.returnQty || 1) >= it.borrowedQty;
          const isAtMin = (it.returnQty || 1) <= 1;
          const equipCode = it.equipmentCode || it.equipmentId || '';
          const equipName = it.equipmentName || 'อุปกรณ์การเกษตร';
          const borrowedNum = it.borrowedQty || 1;
          const returnNum = it.returnQty || borrowedNum;

          return \`
          <div class="d-flex align-items-center justify-content-between p-2 mb-1 bg-white rounded-3 border border-secondary border-opacity-25 shadow-2xs gap-2">
            <div class="d-flex flex-column min-w-0 overflow-hidden flex-grow-1" style="min-width: 0;">
              <div class="d-flex align-items-center gap-1.5">
                <span class="badge bg-primary bg-opacity-10 text-primary font-monospace fs-8 fw-bold">\${escapeHtml(equipCode)}</span>
                <span class="fw-bold text-dark text-truncate fs-7" title="\${escapeHtml(equipName)}">\${escapeHtml(equipName)}</span>
              </div>
              <div class="text-muted fs-8 mt-0.5">
                ยืมไปทั้งหมด: <strong class="text-danger">\${borrowedNum}</strong> \${it.unit || 'ชิ้น'} | ส่งคืนรอบนี้: <strong class="text-success">\${returnNum}</strong> \${it.unit || 'ชิ้น'}
              </div>
            </div>
            <div class="d-flex align-items-center gap-1 flex-shrink-0">
              <div class="input-group input-group-sm align-items-center bg-light rounded-pill border px-1" style="height: 30px;">
                <button type="button" class="btn btn-sm btn-link text-dark p-0 px-1.5 border-0 text-decoration-none lh-1" onclick="updateScannerReturnItemQty('\${it.equipmentId}', -1)" \${isAtMin ? 'disabled style="opacity:0.35;"' : ''} title="ลดจำนวนที่จะคืน">
                  <i class="bi bi-dash fw-bold fs-6"></i>
                </button>
                <span class="fw-bold text-dark px-1.5 fs-7 text-center" style="min-width: 24px;">\${returnNum}</span>
                <button type="button" class="btn btn-sm btn-link text-dark p-0 px-1.5 border-0 text-decoration-none lh-1" onclick="updateScannerReturnItemQty('\${it.equipmentId}', 1)" \${isAtMax ? 'disabled style="opacity:0.35;"' : ''} title="เพิ่มจำนวนที่จะคืน (ไม่เกินจำนวนที่ยืม \${borrowedNum})">
                  <i class="bi bi-plus fw-bold fs-6"></i>
                </button>
              </div>
              <button type="button" class="btn btn-sm \${isAuthorizedReturn ? 'btn-info text-dark shadow-xs' : 'btn-outline-secondary opacity-75'} fw-bold rounded-pill px-2.5 py-1 border-0 lh-1 text-nowrap fs-8" onclick="confirmSingleReturnFromScanner('\${it.equipmentId}')" title="\${isAuthorizedReturn ? 'คืนอุปกรณ์รายการนี้' : 'สแกนบัตรเจ้าหน้าที่เพื่อปลดล็อกการคืน'}">
                \${isAuthorizedReturn ? '<i class=\"bi bi-box-arrow-in-down me-1\"></i>คืน' : '<i class=\"bi bi-shield-lock me-1\"></i>คืน'}
              </button>
            </div>
          </div>
        \`;
        }).join('');
        return;`;

if (!script.includes(targetRender)) {
  console.error("targetRender not found");
  process.exit(1);
}
script = script.replace(targetRender, replacementRender);

fs.writeFileSync('script.js', script, 'utf8');
console.log("Successfully replaced with robust clear return items rendering!");
