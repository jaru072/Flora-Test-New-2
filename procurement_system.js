/**
 * Procurement Management System Engine (ระบบจัดซื้อ-จัดจ้างมาตรฐาน)
 * โครงการรัตนบุปผา และผลิตดอกไม้ธรรมยาตรา
 */
(function() {
  'use strict';

  const state = {
    requisitions: [],
    purchaseOrders: [],
    goodsReceipts: [],
    vendors: [],
    searchQuery: '',
    selectedPR: null,
    selectedPO: null
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const fmtNum = (n) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtCurrency = (n) => `฿${fmtNum(n)}`;

  const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  // Helper to format Thai date (พ.ศ.) and 24-hour time
  function getThaiDateString(dateObj = new Date()) {
    const d = dateObj.getDate();
    const m = THAI_MONTHS[dateObj.getMonth()];
    const y = dateObj.getFullYear() + 543;
    return `${d} ${m} พ.ศ. ${y}`;
  }

  function get24HourTimeString(dateObj = new Date()) {
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    return `${hh}:${mm} น.`;
  }

  // Get project title dynamically from Org Tree / Global Settings
  function getActiveProjectTitle() {
    if (typeof window.getFloraProjectTitle === 'function') {
      try {
        const t = window.getFloraProjectTitle();
        if (t && String(t).trim()) return String(t).trim();
      } catch (e) {}
    }
    if (typeof window.getFloraOrgTree === 'function') {
      try {
        const tree = window.getFloraOrgTree();
        if (tree && tree.name) return String(tree.name).trim();
      } catch (e) {}
    }
    try {
      const storedTree = localStorage.getItem("flora_org_tree_v2");
      if (storedTree) {
        const parsed = JSON.parse(storedTree);
        const root = parsed.tree || parsed;
        if (root && root.name && String(root.name).trim()) return String(root.name).trim();
      }
      const stored = localStorage.getItem("flora_global_project_title");
      if (stored && stored.trim()) return stored.trim();
    } catch (e) {}
    return "โครงการรัตนบุปผา และผลิตดอกไม้ธรรมยาตรา";
  }

  function showToast(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
    } else {
      console.log('แจ้งเตือน:', msg);
    }
  }

  // Error logging with Firestore format
  function logFirestoreError(err, op, path) {
    const info = {
      error: err instanceof Error ? err.message : String(err),
      operationType: op,
      path: path,
      authInfo: {
        userId: window.auth?.currentUser?.uid,
        email: window.auth?.currentUser?.email
      }
    };
    console.error('Firestore Error:', JSON.stringify(info));
  }

  // Generate Unique Sequential IDs
  function generatePRNumber() {
    const y = (new Date().getFullYear() + 543).toString().slice(-2);
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `PR-${y}${rnd}`;
  }

  function generatePONumber() {
    const y = (new Date().getFullYear() + 543).toString().slice(-2);
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `PO-${y}${rnd}`;
  }

  function generateGRNumber() {
    const y = (new Date().getFullYear() + 543).toString().slice(-2);
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `GR-${y}${rnd}`;
  }

  function generateVendorCode() {
    const rnd = Math.floor(100 + Math.random() * 900);
    return `VEN-${rnd}`;
  }

  let isInitialized = false;

  // --- Real-time Firestore Listeners ---
  function init() {
    if (isInitialized) return;
    if (!window.db || !window.floraFirebaseBridge) return;
    isInitialized = true;

    // 1. Vendors
    try {
      window.floraFirebaseBridge.onSnapshot(
        window.floraFirebaseBridge.collection(window.db, 'vendors'),
        (snapshot) => {
          state.vendors = [];
          snapshot.forEach((doc) => {
            state.vendors.push({ id: doc.id, ...doc.data() });
          });
          if (state.vendors.length === 0) {
            seedDefaultVendors();
          } else {
            renderVendors();
            updateVendorDropdowns();
          }
        },
        (err) => logFirestoreError(err, 'get', 'vendors')
      );
    } catch (e) {
      logFirestoreError(e, 'get', 'vendors');
    }

    // 2. Purchase Requisitions (PR)
    try {
      window.floraFirebaseBridge.onSnapshot(
        window.floraFirebaseBridge.collection(window.db, 'purchase_requisitions'),
        (snapshot) => {
          state.requisitions = [];
          snapshot.forEach((doc) => {
            state.requisitions.push({ id: doc.id, ...doc.data() });
          });
          // Sort latest first
          state.requisitions.sort((a, b) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0));
          renderPRTable();
          updateSummaryMetrics();
        },
        (err) => logFirestoreError(err, 'get', 'purchase_requisitions')
      );
    } catch (e) {
      logFirestoreError(e, 'get', 'purchase_requisitions');
    }

    // 3. Purchase Orders (PO)
    try {
      window.floraFirebaseBridge.onSnapshot(
        window.floraFirebaseBridge.collection(window.db, 'purchase_orders'),
        (snapshot) => {
          state.purchaseOrders = [];
          snapshot.forEach((doc) => {
            state.purchaseOrders.push({ id: doc.id, ...doc.data() });
          });
          state.purchaseOrders.sort((a, b) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0));
          renderPOTable();
          updatePODropdownForGR();
          updateSummaryMetrics();
        },
        (err) => logFirestoreError(err, 'get', 'purchase_orders')
      );
    } catch (e) {
      logFirestoreError(e, 'get', 'purchase_orders');
    }

    // 4. Goods Receipts (GR)
    try {
      window.floraFirebaseBridge.onSnapshot(
        window.floraFirebaseBridge.collection(window.db, 'goods_receipts'),
        (snapshot) => {
          state.goodsReceipts = [];
          snapshot.forEach((doc) => {
            state.goodsReceipts.push({ id: doc.id, ...doc.data() });
          });
          state.goodsReceipts.sort((a, b) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0));
          renderGRTable();
          updateSummaryMetrics();
        },
        (err) => logFirestoreError(err, 'get', 'goods_receipts')
      );
    } catch (e) {
      logFirestoreError(e, 'get', 'goods_receipts');
    }
  }

  // Seed standard vendors if empty
  async function seedDefaultVendors() {
    const defaultVendors = [
      {
        code: 'VEN-001',
        name: 'บริษัท ปุ๋ยอินทรีย์รัตนเกษตร จำกัด',
        category: 'ปุ๋ยและธาตุอาหารพืช',
        taxId: '0105558012345',
        phone: '02-888-9999',
        email: 'sales@rattanapert.co.th',
        address: '108 หมู่ 4 ตำบลคลองสาม อำเภอคลองหลวง จังหวัดปทุมธานี',
        rating: 5,
        status: 'active',
        createdAt: getThaiDateString()
      },
      {
        code: 'VEN-002',
        name: 'ห้างหุ้นส่วนจำกัด เครื่องจักรกลสวนดอกไม้',
        category: 'ระบบรดน้ำและเครื่องมืองานเกษตร',
        taxId: '0103559098765',
        phone: '081-456-7890',
        email: 'contact@floramachinery.com',
        address: '25/9 ถนนพหลโยธิน อำเภอคลองหลวง จังหวัดปทุมธานี',
        rating: 4.8,
        status: 'active',
        createdAt: getThaiDateString()
      },
      {
        code: 'VEN-003',
        name: 'บริษัท เมล็ดพันธุ์และอุปกรณ์การจัดสวน สยาม จำกัด',
        category: 'เมล็ดพันธุ์ดอกไม้และวัสดุเพาะชำ',
        taxId: '0105562033441',
        phone: '02-555-1234',
        email: 'order@siamgardenseed.com',
        address: '88 ถนนวิภาวดีรังสิต แขวงลาดยาว เขตจตุจักร กรุงเทพมหานคร',
        rating: 4.9,
        status: 'active',
        createdAt: getThaiDateString()
      }
    ];

    try {
      for (const v of defaultVendors) {
        await window.floraFirebaseBridge.addDoc(
          window.floraFirebaseBridge.collection(window.db, 'vendors'),
          v
        );
      }
    } catch (err) {
      logFirestoreError(err, 'write', 'vendors');
    }
  }

  // --- Metrics Summary ---
  function updateSummaryMetrics() {
    const pendingPR = state.requisitions.filter(r => r.status === 'pending' || r.status === 'draft').length;
    const activePO = state.purchaseOrders.filter(p => p.status === 'issued' || p.status === 'receiving').length;
    const completedGR = state.goodsReceipts.filter(g => g.inspectionStatus === 'pass').length;
    const totalSpend = state.purchaseOrders.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);

    const elPendingPR = $('statPendingPR');
    if (elPendingPR) elPendingPR.textContent = pendingPR;

    const elActivePO = $('statActivePO');
    if (elActivePO) elActivePO.textContent = activePO;

    const elCompletedGR = $('statCompletedGR');
    if (elCompletedGR) elCompletedGR.textContent = completedGR;

    const elTotalSpend = $('statTotalSpend');
    if (elTotalSpend) elTotalSpend.textContent = fmtCurrency(totalSpend);
  }

  // --- TAB 1: Render PR Table ---
  function renderPRTable() {
    const tbody = $('prTableBody');
    if (!tbody) return;

    const q = state.searchQuery.toLowerCase().trim();
    const list = state.requisitions.filter(r => {
      if (!q) return true;
      return (r.prNumber && r.prNumber.toLowerCase().includes(q)) ||
             (r.department && r.department.toLowerCase().includes(q)) ||
             (r.requesterName && r.requesterName.toLowerCase().includes(q)) ||
             (r.objective && r.objective.toLowerCase().includes(q));
    });

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-5 text-muted">
            <i class="bi bi-file-earmark-x display-6 d-block mb-2 text-muted opacity-50"></i>
            ยังไม่มีรายการใบขอซื้อ/ขอจ้าง (PR) ในระบบ
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(item => {
      // Priority Badge
      let pBadge = '<span class="badge bg-secondary">ปกติ</span>';
      if (item.priority === 'urgent') {
        pBadge = '<span class="badge bg-warning text-dark"><i class="bi bi-lightning-charge-fill me-1"></i>เร่งด่วน</span>';
      } else if (item.priority === 'critical') {
        pBadge = '<span class="badge bg-danger"><i class="bi bi-exclamation-octagon-fill me-1"></i>ฉุกเฉิน</span>';
      }

      // Status Badge
      let sBadge = '<span class="status-badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25"><i class="bi bi-hourglass-split"></i>รออนุมัติ</span>';
      if (item.status === 'approved') {
        sBadge = '<span class="status-badge bg-success bg-opacity-10 text-success border border-success border-opacity-25"><i class="bi bi-check-circle-fill"></i>อนุมัติแล้ว</span>';
      } else if (item.status === 'po_created') {
        sBadge = '<span class="status-badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25"><i class="bi bi-cart-check-fill"></i>ออก PO แล้ว</span>';
      } else if (item.status === 'rejected') {
        sBadge = '<span class="status-badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25"><i class="bi bi-x-circle-fill"></i>ไม่อนุมัติ</span>';
      }

      // Action Button
      let actionBtn = '';
      if (item.status === 'pending' || item.status === 'draft') {
        actionBtn = `
          <button type="button" class="btn btn-sm btn-outline-success rounded-pill px-2.5 py-1 fw-semibold me-1" onclick="window.procurementModule.approvePR('${item.id}')" title="อนุมัติใบขอซื้อ">
            <i class="bi bi-check-lg me-1"></i>อนุมัติ
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-2 py-1" onclick="window.procurementModule.rejectPR('${item.id}')" title="ส่งกลับแก้ไข/ไม่อนุมัติ">
            <i class="bi bi-x-lg"></i>
          </button>
        `;
      } else if (item.status === 'approved') {
        actionBtn = `
          <button type="button" class="btn btn-sm btn-primary rounded-pill px-3 py-1 fw-bold" onclick="window.procurementModule.openCreatePOFromPR('${item.id}')">
            <i class="bi bi-receipt me-1"></i>ออก PO
          </button>
        `;
      } else if (item.status === 'po_created') {
        actionBtn = `
          <span class="badge bg-light text-muted border py-1.5 px-2">สร้าง PO เสร็จสิ้น</span>
        `;
      }

      const itemCount = (item.items && Array.isArray(item.items)) ? item.items.length : 0;

      return `
        <tr>
          <td class="fw-bold text-teal font-monospace" style="color: #0f766e;">${esc(item.prNumber)}</td>
          <td>
            <div class="fw-semibold text-dark">${esc(item.createdDate || '-')}</div>
            <small class="text-muted fs-9">${esc(item.createdTime || '-')}</small>
          </td>
          <td>
            <div class="fw-bold text-dark">${esc(item.department)}</div>
            <small class="text-muted"><i class="bi bi-person me-1"></i>${esc(item.requesterName)}</small>
          </td>
          <td style="max-width: 220px;" class="text-truncate" title="${esc(item.objective)}">${esc(item.objective)}</td>
          <td><span class="badge bg-light text-dark border">${itemCount} รายการ</span></td>
          <td class="text-end fw-bold text-dark">${fmtCurrency(item.totalAmount)}</td>
          <td class="text-center">${pBadge}</td>
          <td class="text-center">${sBadge}</td>
          <td class="text-end">${actionBtn}</td>
        </tr>
      `;
    }).join('');
  }

  // --- TAB 2: Render PO Table ---
  function renderPOTable() {
    const tbody = $('poTableBody');
    if (!tbody) return;

    const q = state.searchQuery.toLowerCase().trim();
    const list = state.purchaseOrders.filter(p => {
      if (!q) return true;
      return (p.poNumber && p.poNumber.toLowerCase().includes(q)) ||
             (p.vendorName && p.vendorName.toLowerCase().includes(q)) ||
             (p.prNumber && p.prNumber.toLowerCase().includes(q));
    });

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-5 text-muted">
            <i class="bi bi-receipt display-6 d-block mb-2 text-muted opacity-50"></i>
            ยังไม่มีรายการใบสั่งซื้อ/สั่งจ้าง (PO) ในระบบ
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(item => {
      let sBadge = '<span class="status-badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25"><i class="bi bi-send-fill"></i>ส่งใบสั่งซื้อแล้ว</span>';
      if (item.status === 'receiving') {
        sBadge = '<span class="status-badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25"><i class="bi bi-box-seam"></i>กำลังรอตรวจรับ</span>';
      } else if (item.status === 'completed') {
        sBadge = '<span class="status-badge bg-success bg-opacity-10 text-success border border-success border-opacity-25"><i class="bi bi-check2-all"></i>ตรวจรับเรียบร้อย</span>';
      } else if (item.status === 'cancelled') {
        sBadge = '<span class="status-badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25"><i class="bi bi-x-circle"></i>ยกเลิกแล้ว</span>';
      }

      return `
        <tr>
          <td class="fw-bold text-primary font-monospace">${esc(item.poNumber)}</td>
          <td><span class="badge bg-light text-teal border font-monospace" style="color: #0f766e;">${esc(item.prNumber)}</span></td>
          <td>
            <div class="fw-semibold text-dark">${esc(item.createdDate || '-')}</div>
            <small class="text-muted fs-9">${esc(item.createdTime || '-')}</small>
          </td>
          <td>
            <div class="fw-bold text-dark">${esc(item.vendorName)}</div>
            <small class="text-muted"><i class="bi bi-telephone me-1"></i>${esc(item.vendorPhone || '-')}</small>
          </td>
          <td><i class="bi bi-calendar-event me-1 text-muted"></i>${esc(item.expectedDeliveryDate || '-')}</td>
          <td class="text-end fw-bold text-dark fs-7">${fmtCurrency(item.totalAmount)}</td>
          <td class="text-center">${sBadge}</td>
          <td class="text-end">
            <button type="button" class="btn btn-sm btn-outline-dark rounded-pill px-2.5 py-1" onclick="window.procurementModule.printPODocument('${item.id}')" title="พิมพ์ใบสั่งซื้อ">
              <i class="bi bi-printer-fill me-1"></i>พิมพ์ PO
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- TAB 3: Render Goods Receipts Table ---
  function renderGRTable() {
    const tbody = $('grTableBody');
    if (!tbody) return;

    const q = state.searchQuery.toLowerCase().trim();
    const list = state.goodsReceipts.filter(g => {
      if (!q) return true;
      return (g.grNumber && g.grNumber.toLowerCase().includes(q)) ||
             (g.poNumber && g.poNumber.toLowerCase().includes(q)) ||
             (g.invoiceNumber && g.invoiceNumber.toLowerCase().includes(q)) ||
             (g.receiverName && g.receiverName.toLowerCase().includes(q));
    });

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-5 text-muted">
            <i class="bi bi-clipboard2-x display-6 d-block mb-2 text-muted opacity-50"></i>
            ยังไม่มีรายการบันทึกการตรวจรับพัสดุ (GR) ในระบบ
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(item => {
      let rBadge = '<span class="status-badge bg-success bg-opacity-10 text-success border border-success border-opacity-25"><i class="bi bi-check-circle-fill"></i>ถูกต้อง 100%</span>';
      if (item.inspectionStatus === 'partial') {
        rBadge = '<span class="status-badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25"><i class="bi bi-exclamation-circle-fill"></i>รับบางส่วน</span>';
      } else if (item.inspectionStatus === 'rejected') {
        rBadge = '<span class="status-badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25"><i class="bi bi-x-circle-fill"></i>ปฏิเสธการรับ</span>';
      }

      return `
        <tr>
          <td class="fw-bold text-success font-monospace">${esc(item.grNumber)}</td>
          <td><span class="badge bg-light text-primary border font-monospace">${esc(item.poNumber)}</span></td>
          <td>
            <div class="fw-semibold text-dark">${esc(item.receiptDate || '-')}</div>
            <small class="text-muted fs-9">${esc(item.receiptTime || '-')}</small>
          </td>
          <td><i class="bi bi-person-check-fill text-success me-1"></i>${esc(item.receiverName)}</td>
          <td class="font-monospace fw-semibold">${esc(item.invoiceNumber)}</td>
          <td class="text-center">${rBadge}</td>
          <td class="text-center"><span class="badge bg-light text-dark border"><i class="bi bi-shield-check text-success me-1"></i>ผ่านการตรวจ 3 ด้าน</span></td>
          <td class="text-end">
            <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1" onclick="window.procurementModule.viewGRDetails('${item.id}')">
              <i class="bi bi-eye me-1"></i>ดูรายงาน
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- TAB 4: Render Vendors Table ---
  function renderVendors() {
    const tbody = $('vendorTableBody');
    if (!tbody) return;

    const list = state.vendors;
    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-5 text-muted">กำลังโหลดรายชื่อคู่ค้า...</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(v => {
      return `
        <tr>
          <td class="fw-bold text-dark font-monospace">${esc(v.code || '-')}</td>
          <td class="fw-bold text-dark">${esc(v.name)}</td>
          <td><span class="badge bg-light text-dark border">${esc(v.category || '-')}</span></td>
          <td>${esc(v.phone || '-')}</td>
          <td>${esc(v.email || '-')}</td>
          <td class="font-monospace">${esc(v.taxId || '-')}</td>
          <td class="text-center"><span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">รับรองแล้ว</span></td>
          <td class="text-end">
            <button type="button" class="btn btn-sm btn-outline-danger p-1 rounded-circle" onclick="window.procurementModule.deleteVendor('${v.id}')" title="ลบคู่ค้า">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function updateVendorDropdowns() {
    const sel = $('poVendorSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- เลือกคู่ค้าที่ผ่านการรับรอง --</option>' +
      state.vendors.map(v => `<option value="${v.id}">${esc(v.name)} (${esc(v.category || 'ทั่วไป')})</option>`).join('');
  }

  function updatePODropdownForGR() {
    const sel = $('grPOSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- เลือกใบสั่งซื้อ (PO) --</option>' +
      state.purchaseOrders.map(p => `<option value="${p.id}">${esc(p.poNumber)} - ${esc(p.vendorName)} (${fmtCurrency(p.totalAmount)})</option>`).join('');
  }

  // --- PR Item Row Dynamic Management ---
  function addPRItemRow() {
    const tbody = $('prItemsTableBody');
    if (!tbody) return;
    const rowCount = tbody.querySelectorAll('tr').length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center fw-bold">${rowCount}</td>
      <td><input type="text" class="form-control form-control-sm pr-item-name" required placeholder="ชื่อรายการ"></td>
      <td><input type="number" class="form-control form-control-sm pr-item-qty" min="1" value="1" required oninput="window.procurementModule.calcPRTotals()"></td>
      <td><input type="text" class="form-control form-control-sm pr-item-unit" value="ชิ้น" required></td>
      <td><input type="number" class="form-control form-control-sm pr-item-price" min="0" step="0.01" value="0" required oninput="window.procurementModule.calcPRTotals()"></td>
      <td class="text-end fw-bold pr-item-total">฿0.00</td>
      <td class="text-center"><button type="button" class="btn btn-sm text-danger p-0" onclick="window.procurementModule.removePRItemRow(this)"><i class="bi bi-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
    calcPRTotals();
  }

  function removePRItemRow(btn) {
    const tbody = $('prItemsTableBody');
    if (!tbody) return;
    if (tbody.querySelectorAll('tr').length <= 1) {
      alert('ต้องมีรายการขอซื้ออย่างน้อย 1 รายการ');
      return;
    }
    btn.closest('tr').remove();
    // Re-index
    tbody.querySelectorAll('tr').forEach((r, idx) => {
      r.children[0].textContent = idx + 1;
    });
    calcPRTotals();
  }

  function calcPRTotals() {
    const tbody = $('prItemsTableBody');
    if (!tbody) return;
    let grandTotal = 0;
    tbody.querySelectorAll('tr').forEach(row => {
      const qty = parseFloat(row.querySelector('.pr-item-qty')?.value) || 0;
      const price = parseFloat(row.querySelector('.pr-item-price')?.value) || 0;
      const total = qty * price;
      grandTotal += total;
      const totalCell = row.querySelector('.pr-item-total');
      if (totalCell) totalCell.textContent = fmtCurrency(total);
    });
    const grandDisplay = $('prGrandTotalDisplay');
    if (grandDisplay) grandDisplay.textContent = fmtCurrency(grandTotal);
  }

  // --- Modal Openers & Actions ---
  function openNewRequisitionModal() {
    const modalEl = $('newPRModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  function openNewGoodsReceiptModal() {
    const modalEl = $('newGRModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  function openNewVendorModal() {
    const modalEl = $('newVendorModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  // Save New PR
  async function saveNewRequisition(e) {
    e.preventDefault();
    const department = $('prDepartment').value;
    const requesterName = $('prRequesterName').value.trim();
    const objective = $('prObjective').value.trim();
    const priority = $('prPriority').value;

    const tbody = $('prItemsTableBody');
    const items = [];
    let totalAmount = 0;

    tbody.querySelectorAll('tr').forEach(row => {
      const name = row.querySelector('.pr-item-name')?.value.trim();
      const qty = parseFloat(row.querySelector('.pr-item-qty')?.value) || 0;
      const unit = row.querySelector('.pr-item-unit')?.value.trim() || 'ชิ้น';
      const price = parseFloat(row.querySelector('.pr-item-price')?.value) || 0;
      const itemTotal = qty * price;
      if (name) {
        items.push({ name, qty, unit, price, itemTotal });
        totalAmount += itemTotal;
      }
    });

    if (items.length === 0) {
      alert('กรุณาระบุรายการขอซื้ออย่างน้อย 1 รายการ');
      return;
    }

    const now = new Date();
    const prNumber = generatePRNumber();

    const prPayload = {
      prNumber,
      department,
      requesterName,
      requesterEmail: window.auth?.currentUser?.email || '',
      objective,
      priority,
      items,
      totalAmount,
      status: 'pending', // Pending approval
      createdDate: getThaiDateString(now),
      createdTime: get24HourTimeString(now),
      createdTimestamp: now.getTime(),
      updatedAt: now.toISOString()
    };

    try {
      await window.floraFirebaseBridge.addDoc(
        window.floraFirebaseBridge.collection(window.db, 'purchase_requisitions'),
        prPayload
      );

      showToast(`สร้างใบขอซื้อเลขที่ ${prNumber} เรียบร้อยแล้ว`);
      bootstrap.Modal.getInstance($('newPRModal'))?.hide();
      $('newPRForm').reset();
    } catch (err) {
      logFirestoreError(err, 'write', 'purchase_requisitions');
      alert('เกิดข้อผิดพลาดในการบันทึกใบขอซื้อ');
    }
  }

  // Approve PR
  async function approvePR(prId) {
    if (!confirm('ยืนยันการอนุมัติใบขอซื้อนี้เพื่อส่งต่อให้ฝ่ายจัดซื้อออกใบสั่งซื้อ?')) return;
    const now = new Date();
    try {
      await window.floraFirebaseBridge.updateDoc(
        window.floraFirebaseBridge.doc(window.db, 'purchase_requisitions', prId),
        {
          status: 'approved',
          approvedBy: window.auth?.currentUser?.displayName || window.auth?.currentUser?.email || 'ผู้อนุมัติ',
          approvedDate: getThaiDateString(now),
          approvedTime: get24HourTimeString(now),
          updatedAt: now.toISOString()
        }
      );
      showToast('อนุมัติใบขอซื้อเรียบร้อยแล้ว');
    } catch (err) {
      logFirestoreError(err, 'update', `purchase_requisitions/${prId}`);
    }
  }

  // Reject PR
  async function rejectPR(prId) {
    const reason = prompt('ระบุเหตุผลในการไม่อนุมัติหรือส่งกลับแก้ไข:');
    if (reason === null) return;
    const now = new Date();
    try {
      await window.floraFirebaseBridge.updateDoc(
        window.floraFirebaseBridge.doc(window.db, 'purchase_requisitions', prId),
        {
          status: 'rejected',
          rejectionReason: reason || 'ไม่ผ่านเกณฑ์การพิจารณา',
          updatedAt: now.toISOString()
        }
      );
      showToast('ส่งกลับแก้ไข/ไม่อนุมัติใบขอซื้อเรียบร้อย');
    } catch (err) {
      logFirestoreError(err, 'update', `purchase_requisitions/${prId}`);
    }
  }

  // Open Create PO From Approved PR
  function openCreatePOFromPR(prId) {
    const pr = state.requisitions.find(r => r.id === prId);
    if (!pr) return;
    state.selectedPR = pr;

    $('poRefPRId').value = pr.id;
    $('poDisplayPRNumber').textContent = pr.prNumber;
    $('poDisplayPRDept').textContent = pr.department;

    // Set default expected date (7 days later)
    const d = new Date();
    d.setDate(d.getDate() + 7);
    $('poDeliveryDate').value = d.toISOString().split('T')[0];

    // Populate items review
    const tbody = $('poItemsReviewBody');
    tbody.innerHTML = (pr.items || []).map(item => `
      <tr>
        <td class="fw-semibold">${esc(item.name)}</td>
        <td>${item.qty}</td>
        <td>${esc(item.unit)}</td>
        <td>${fmtCurrency(item.price)}</td>
        <td class="text-end fw-bold">${fmtCurrency(item.itemTotal)}</td>
      </tr>
    `).join('');

    recalcPOTotals();

    const modal = new bootstrap.Modal($('createPOModal'));
    modal.show();
  }

  function recalcPOTotals() {
    if (!state.selectedPR) return;
    const subtotal = (state.selectedPR.items || []).reduce((s, i) => s + (i.itemTotal || 0), 0);
    const vatType = $('poVatType').value;
    let vat = 0;
    let grand = subtotal;

    if (vatType === 'include') {
      vat = subtotal * 0.07;
      grand = subtotal + vat;
    }

    $('poSubtotalDisplay').textContent = fmtCurrency(subtotal);
    $('poVatDisplay').textContent = fmtCurrency(vat);
    $('poGrandTotalDisplay').textContent = fmtCurrency(grand);
  }

  // Save New PO
  async function saveNewPO(e) {
    e.preventDefault();
    if (!state.selectedPR) return;

    const vendorId = $('poVendorSelect').value;
    const vendor = state.vendors.find(v => v.id === vendorId);
    if (!vendor) {
      alert('กรุณาเลือกคู่ค้า');
      return;
    }

    const deliveryDate = $('poDeliveryDate').value;
    const paymentTerms = $('poPaymentTerms').value;
    const vatType = $('poVatType').value;

    const subtotal = (state.selectedPR.items || []).reduce((s, i) => s + (i.itemTotal || 0), 0);
    let vatAmount = 0;
    let totalAmount = subtotal;
    if (vatType === 'include') {
      vatAmount = subtotal * 0.07;
      totalAmount = subtotal + vatAmount;
    }

    const now = new Date();
    const poNumber = generatePONumber();

    const poPayload = {
      poNumber,
      prId: state.selectedPR.id,
      prNumber: state.selectedPR.prNumber,
      vendorId: vendor.id,
      vendorName: vendor.name,
      vendorTaxId: vendor.taxId || '',
      vendorPhone: vendor.phone || '',
      vendorAddress: vendor.address || '',
      department: state.selectedPR.department,
      expectedDeliveryDate: deliveryDate,
      paymentTerms,
      vatType,
      items: state.selectedPR.items || [],
      subtotal,
      vatAmount,
      totalAmount,
      status: 'issued',
      createdDate: getThaiDateString(now),
      createdTime: get24HourTimeString(now),
      createdTimestamp: now.getTime(),
      updatedAt: now.toISOString()
    };

    try {
      // 1. Add PO document
      await window.floraFirebaseBridge.addDoc(
        window.floraFirebaseBridge.collection(window.db, 'purchase_orders'),
        poPayload
      );

      // 2. Mark PR as po_created
      await window.floraFirebaseBridge.updateDoc(
        window.floraFirebaseBridge.doc(window.db, 'purchase_requisitions', state.selectedPR.id),
        {
          status: 'po_created',
          poNumber: poNumber,
          updatedAt: now.toISOString()
        }
      );

      showToast(`ออกใบสั่งซื้อเลขที่ ${poNumber} สำเร็จ`);
      bootstrap.Modal.getInstance($('createPOModal'))?.hide();

      // Auto switch to PO Tab
      const poTabBtn = $('tab-po-btn');
      if (poTabBtn) bootstrap.Tab.getOrCreateInstance(poTabBtn).show();
    } catch (err) {
      logFirestoreError(err, 'write', 'purchase_orders');
      alert('เกิดข้อผิดพลาดในการออกใบสั่งซื้อ');
    }
  }

  // Print PO Document (Standard Procurement Template)
  function printPODocument(poId) {
    const po = state.purchaseOrders.find(p => p.id === poId);
    if (!po) return;

    const area = $('printDocumentArea');
    if (!area) return;

    const itemsRows = (po.items || []).map((item, idx) => `
      <tr>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${esc(item.name)}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${item.qty}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${esc(item.unit)}</td>
        <td style="text-align: right; border: 1px solid #cbd5e1; padding: 8px;">${fmtCurrency(item.price)}</td>
        <td style="text-align: right; border: 1px solid #cbd5e1; padding: 8px;">${fmtCurrency(item.itemTotal)}</td>
      </tr>
    `).join('');

    const activeProjTitle = getActiveProjectTitle();

    area.innerHTML = `
      <div style="font-family: 'Sarabun', sans-serif; color: #000; padding: 20px; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-weight: bold; color: #0d2258;">${esc(activeProjTitle)}</h2>
          <h3 style="margin: 5px 0 0 0; font-weight: bold; color: #0f766e;">ใบสั่งซื้อ / สั่งจ้าง (PURCHASE ORDER)</h3>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px;">
          <div>
            <strong>ผู้ขาย / คู่ค้า:</strong> ${esc(po.vendorName)}<br>
            <strong>ที่อยู่:</strong> ${esc(po.vendorAddress || '-')}<br>
            <strong>เบอร์โทรศัพท์:</strong> ${esc(po.vendorPhone || '-')}<br>
            <strong>เลขประจำตัวผู้เสียภาษี:</strong> ${esc(po.vendorTaxId || '-')}
          </div>
          <div style="text-align: right;">
            <strong>เลขที่ใบสั่งซื้อ:</strong> <span style="font-weight: bold; font-family: monospace; font-size: 16px;">${esc(po.poNumber)}</span><br>
            <strong>อ้างอิงใบขอซื้อ:</strong> ${esc(po.prNumber)}<br>
            <strong>วันที่ออกเอกสาร:</strong> ${esc(po.createdDate)}<br>
            <strong>กำหนดส่งมอบ:</strong> ${esc(po.expectedDeliveryDate || '-')}<br>
            <strong>เงื่อนไขชำระเงิน:</strong> ${esc(po.paymentTerms || '-')}
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 40px; text-align: center;">ลำดับ</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">รายการสิ่งของ / งานจ้าง</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 70px; text-align: center;">จำนวน</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 70px; text-align: center;">หน่วย</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 110px; text-align: right;">ราคา/หน่วย</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 120px; text-align: right;">รวมเงิน</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" style="text-align: right; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">ยอดเงินก่อนภาษี:</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${fmtCurrency(po.subtotal)}</td>
            </tr>
            <tr>
              <td colspan="5" style="text-align: right; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">ภาษีมูลค่าเพิ่ม 7%:</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${fmtCurrency(po.vatAmount)}</td>
            </tr>
            <tr style="background-color: #f8fafc;">
              <td colspan="5" style="text-align: right; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; font-size: 16px;">ยอดเงินสุทธิทั้งสิ้น:</td>
              <td style="text-align: right; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; font-size: 16px; color: #0d2258;">${fmtCurrency(po.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>

        <div style="display: flex; justify-content: space-between; margin-top: 50px; font-size: 13px; text-align: center;">
          <div style="width: 200px;">
            ___________________________<br>
            ( ผู้จัดทำเอกสาร )<br>
            เจ้าหน้าที่จัดซื้อ
          </div>
          <div style="width: 200px;">
            ___________________________<br>
            ( ผู้มีอำนาจอนุมัติ )<br>
            หัวหน้าฝ่ายบริหารและบัญชี
          </div>
          <div style="width: 200px;">
            ___________________________<br>
            ( ผู้รับใบสั่งซื้อ )<br>
            ตัวแทนผู้ขาย / คู่ค้า
          </div>
        </div>
      </div>
    `;

    window.print();
  }

  // Setup GR when PO selected
  function onPOSelectForGR(poId) {
    const po = state.purchaseOrders.find(p => p.id === poId);
    const tbody = $('grItemsCheckBody');
    if (!po || !tbody) return;

    state.selectedPO = po;

    tbody.innerHTML = (po.items || []).map((item, idx) => `
      <tr>
        <td class="fw-semibold">${esc(item.name)}</td>
        <td class="text-center font-monospace">${item.qty}</td>
        <td class="text-center">
          <input type="number" class="form-control form-control-sm text-center font-monospace gr-item-received-qty" min="0" max="${item.qty * 2}" value="${item.qty}" required>
        </td>
        <td>${esc(item.unit)}</td>
        <td>
          <input type="text" class="form-control form-control-sm gr-item-condition" value="สภาพสมบูรณ์ดี">
        </td>
      </tr>
    `).join('');
  }

  // Save Goods Receipt (GR)
  async function saveGoodsReceipt(e) {
    e.preventDefault();
    if (!state.selectedPO) {
      alert('กรุณาเลือกใบสั่งซื้อ');
      return;
    }

    const receiverName = $('grReceiverName').value.trim();
    const invoiceNumber = $('grInvoiceNumber').value.trim();
    const inspectionStatus = $('grInspectionStatus').value;
    const inspectionNotes = $('grNotes').value.trim();

    const tbody = $('grItemsCheckBody');
    const itemsReceived = [];

    tbody.querySelectorAll('tr').forEach((row, idx) => {
      const originalItem = state.selectedPO.items[idx];
      const receivedQty = parseFloat(row.querySelector('.gr-item-received-qty')?.value) || 0;
      const condition = row.querySelector('.gr-item-condition')?.value.trim() || '';

      itemsReceived.push({
        name: originalItem.name,
        orderedQty: originalItem.qty,
        receivedQty,
        unit: originalItem.unit,
        condition
      });
    });

    const now = new Date();
    const grNumber = generateGRNumber();

    const grPayload = {
      grNumber,
      poId: state.selectedPO.id,
      poNumber: state.selectedPO.poNumber,
      receiverName,
      receiverEmail: window.auth?.currentUser?.email || '',
      invoiceNumber,
      inspectionStatus,
      inspectionNotes,
      itemsReceived,
      receiptDate: getThaiDateString(now),
      receiptTime: get24HourTimeString(now),
      createdTimestamp: now.getTime(),
      updatedAt: now.toISOString()
    };

    try {
      // 1. Add GR
      await window.floraFirebaseBridge.addDoc(
        window.floraFirebaseBridge.collection(window.db, 'goods_receipts'),
        grPayload
      );

      // 2. Update PO status to completed
      await window.floraFirebaseBridge.updateDoc(
        window.floraFirebaseBridge.doc(window.db, 'purchase_orders', state.selectedPO.id),
        {
          status: 'completed',
          grNumber: grNumber,
          updatedAt: now.toISOString()
        }
      );

      showToast(`บันทึกการตรวจรับพัสดุเลขที่ ${grNumber} เรียบร้อยแล้ว`);
      bootstrap.Modal.getInstance($('newGRModal'))?.hide();
      $('newGRForm').reset();
    } catch (err) {
      logFirestoreError(err, 'write', 'goods_receipts');
      alert('เกิดข้อผิดพลาดในการบันทึกการตรวจรับ');
    }
  }

  // Save New Vendor
  async function saveNewVendor(e) {
    e.preventDefault();
    const name = $('vendorName').value.trim();
    const category = $('vendorCategory').value.trim();
    const phone = $('vendorPhone').value.trim();
    const email = $('vendorEmail').value.trim();
    const taxId = $('vendorTaxId').value.trim();
    const address = $('vendorAddress').value.trim();

    const code = generateVendorCode();
    const now = new Date();

    const vPayload = {
      code,
      name,
      category,
      phone,
      email,
      taxId,
      address,
      rating: 5,
      status: 'active',
      createdAt: getThaiDateString(now)
    };

    try {
      await window.floraFirebaseBridge.addDoc(
        window.floraFirebaseBridge.collection(window.db, 'vendors'),
        vPayload
      );
      showToast(`เพิ่มคู่ค้า ${name} เรียบร้อยแล้ว`);
      bootstrap.Modal.getInstance($('newVendorModal'))?.hide();
      $('newVendorForm').reset();
    } catch (err) {
      logFirestoreError(err, 'write', 'vendors');
      alert('เกิดข้อผิดพลาดในการบันทึกคู่ค้า');
    }
  }

  async function deleteVendor(vendorId) {
    if (!confirm('ต้องการลบคู่ค้านี้ออกจากระบบหรือไม่?')) return;
    try {
      await window.floraFirebaseBridge.deleteDoc(
        window.floraFirebaseBridge.doc(window.db, 'vendors', vendorId)
      );
      showToast('ลบคู่ค้าเรียบร้อยแล้ว');
    } catch (err) {
      logFirestoreError(err, 'delete', `vendors/${vendorId}`);
    }
  }

  function viewGRDetails(grId) {
    const gr = state.goodsReceipts.find(g => g.id === grId);
    if (!gr) return;
    let itemsText = (gr.itemsReceived || []).map(i => `- ${i.name}: สั่ง ${i.orderedQty} รับจริง ${i.receivedQty} ${i.unit} (${i.condition})`).join('\n');
    alert(`[รายงานผลการตรวจรับพัสดุ ${gr.grNumber}]\nอ้างอิงใบสั่งซื้อ: ${gr.poNumber}\nผู้ตรวจรับ: ${gr.receiverName}\nวันที่/เวลา: ${gr.receiptDate} ${gr.receiptTime}\nเลขที่ใบกำกับภาษี/ใบส่งของ: ${gr.invoiceNumber}\nผลการตรวจ: ${gr.inspectionStatus === 'pass' ? 'ถูกต้องสมบูรณ์ 100%' : gr.inspectionStatus}\n\nรายการสิ่งของ:\n${itemsText}\n\nบันทึกเพิ่มเติม: ${gr.inspectionNotes || 'ไม่มี'}`);
  }

  function onSearchChange(val) {
    state.searchQuery = val;
    renderPRTable();
    renderPOTable();
    renderGRTable();
  }

  function refreshData() {
    renderPRTable();
    renderPOTable();
    renderGRTable();
    renderVendors();
    showToast('รีเฟรชข้อมูลล่าสุดเรียบร้อย');
  }

  // Export module API to global
  window.procurementModule = {
    init,
    openNewRequisitionModal,
    openNewGoodsReceiptModal,
    openNewVendorModal,
    addPRItemRow,
    removePRItemRow,
    calcPRTotals,
    saveNewRequisition,
    approvePR,
    rejectPR,
    openCreatePOFromPR,
    recalcPOTotals,
    saveNewPO,
    printPODocument,
    onPOSelectForGR,
    saveGoodsReceipt,
    saveNewVendor,
    deleteVendor,
    viewGRDetails,
    onSearchChange,
    refreshData
  };

  // Listen for project title / org tree changes
  window.addEventListener('flora-project-title-changed', (e) => {
    const newTitle = e.detail?.title || getActiveProjectTitle();
    if (newTitle) {
      const navBrandTitle = $('navbarMasterBrandTitle');
      if (navBrandTitle) navBrandTitle.textContent = newTitle;
      const modalHeaderTitle = $('poPrintProjectTitle');
      if (modalHeaderTitle) modalHeaderTitle.textContent = newTitle;
    }
  });

  window.addEventListener('flora-org-tree-changed', (e) => {
    const tree = e.detail?.tree;
    if (tree && tree.name) {
      const navBrandTitle = $('navbarMasterBrandTitle');
      if (navBrandTitle) navBrandTitle.textContent = tree.name;
    }
  });

  window.addEventListener('flora-firebase-ready', () => {
    if (typeof window.updateAllFloraTitles === 'function') {
      window.updateAllFloraTitles();
    }
  });

})();
