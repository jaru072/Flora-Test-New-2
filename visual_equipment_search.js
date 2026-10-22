/**
 * Flora Garden - AI Visual Equipment Search Module (ระบบถ่ายรูปค้นหาอุปกรณ์ด้วยปัญญาประดิษฐ์)
 */

(function () {
  let visualSearchStream = null;
  let visualSearchFacingMode = 'environment'; // Default to rear camera
  let currentVisualSearchSource = 'catalog'; // 'catalog', 'transaction', 'staff'
  let capturedBase64Data = null;

  // Global open function
  window.openVisualEquipmentSearchModal = function (source = 'catalog') {
    currentVisualSearchSource = source;
    capturedBase64Data = null;

    const modalEl = document.getElementById('visualEquipmentSearchModal');
    if (!modalEl) return;

    // Reset UI state
    resetVisualSearchUI();

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();

    // Start camera
    startVisualSearchCamera();
  };

  // Start Camera
  window.startVisualSearchCamera = async function () {
    const video = document.getElementById('visualSearchVideo');
    const cameraErrorBox = document.getElementById('visualSearchCameraError');
    if (!video) return;

    if (cameraErrorBox) cameraErrorBox.classList.add('d-none');
    video.classList.remove('d-none');

    // Stop any existing stream
    stopVisualSearchCamera();

    try {
      const constraints = {
        video: {
          facingMode: { ideal: visualSearchFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      visualSearchStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = visualSearchStream;
      await video.play();

      document.getElementById('btnCaptureVisualSearch')?.removeAttribute('disabled');
      document.getElementById('visualSearchCamControls')?.classList.remove('d-none');
    } catch (err) {
      console.warn("Camera access failed with ideal constraints, trying basic constraints:", err);
      try {
        visualSearchStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = visualSearchStream;
        await video.play();
        document.getElementById('btnCaptureVisualSearch')?.removeAttribute('disabled');
        document.getElementById('visualSearchCamControls')?.classList.remove('d-none');
      } catch (fallbackErr) {
        console.error("Camera access error:", fallbackErr);
        if (cameraErrorBox) cameraErrorBox.classList.remove('d-none');
        video.classList.add('d-none');
        document.getElementById('btnCaptureVisualSearch')?.setAttribute('disabled', 'true');
      }
    }
  };

  // Stop Camera
  window.stopVisualSearchCamera = function () {
    if (visualSearchStream) {
      visualSearchStream.getTracks().forEach(track => track.stop());
      visualSearchStream = null;
    }
    const video = document.getElementById('visualSearchVideo');
    if (video) video.srcObject = null;
  };

  // Switch Camera
  window.switchVisualSearchCamera = function () {
    visualSearchFacingMode = (visualSearchFacingMode === 'environment') ? 'user' : 'environment';
    startVisualSearchCamera();
  };

  // Capture Photo from Camera
  window.captureVisualSearchPhoto = function () {
    const video = document.getElementById('visualSearchVideo');
    const canvas = document.getElementById('visualSearchCanvas');
    const previewImg = document.getElementById('visualSearchCapturedImg');
    if (!video || !canvas || !previewImg) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    // Resize to max 1024 while maintaining aspect ratio
    const maxDim = 1024;
    let targetW = w;
    let targetH = h;
    if (targetW > maxDim || targetH > maxDim) {
      if (targetW > targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    }

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, targetW, targetH);

    const base64Jpeg = canvas.toDataURL('image/jpeg', 0.85);
    capturedBase64Data = base64Jpeg;

    // Show preview and switch controls
    previewImg.src = base64Jpeg;
    previewImg.classList.remove('d-none');
    video.classList.add('d-none');

    // Stop camera while analyzing
    stopVisualSearchCamera();

    document.getElementById('visualSearchCamControls')?.classList.add('d-none');
    document.getElementById('visualSearchRetakeControls')?.classList.remove('d-none');

    // Run AI analysis
    runVisualSearchAI(base64Jpeg);
  };

  // Handle File Input Selection
  window.handleVisualSearchFileSelect = function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.getElementById('visualSearchCanvas');
        const previewImg = document.getElementById('visualSearchCapturedImg');
        const video = document.getElementById('visualSearchVideo');

        const maxDim = 1024;
        let targetW = img.width;
        let targetH = img.height;
        if (targetW > maxDim || targetH > maxDim) {
          if (targetW > targetH) {
            targetH = Math.round((targetH * maxDim) / targetW);
            targetW = maxDim;
          } else {
            targetW = Math.round((targetW * maxDim) / targetH);
            targetH = maxDim;
          }
        }

        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const base64Jpeg = canvas.toDataURL('image/jpeg', 0.85);
        capturedBase64Data = base64Jpeg;

        previewImg.src = base64Jpeg;
        previewImg.classList.remove('d-none');
        if (video) video.classList.add('d-none');

        stopVisualSearchCamera();

        document.getElementById('visualSearchCamControls')?.classList.add('d-none');
        document.getElementById('visualSearchRetakeControls')?.classList.remove('d-none');

        // Run AI analysis
        runVisualSearchAI(base64Jpeg);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Reset file input value so same file can be selected again
    event.target.value = '';
  };

  // Retake Photo
  window.retakeVisualSearchPhoto = function () {
    resetVisualSearchUI();
    startVisualSearchCamera();
  };

  // Reset UI State
  function resetVisualSearchUI() {
    const video = document.getElementById('visualSearchVideo');
    const previewImg = document.getElementById('visualSearchCapturedImg');
    const loadingBox = document.getElementById('visualSearchLoading');
    const resultsContainer = document.getElementById('visualSearchResultsContainer');
    const emptyBox = document.getElementById('visualSearchEmptyResult');
    const cameraErrorBox = document.getElementById('visualSearchCameraError');

    if (video) video.classList.remove('d-none');
    if (previewImg) previewImg.classList.add('d-none');
    if (loadingBox) loadingBox.classList.add('d-none');
    if (resultsContainer) {
      resultsContainer.classList.add('d-none');
      resultsContainer.innerHTML = '';
    }
    if (emptyBox) emptyBox.classList.add('d-none');
    if (cameraErrorBox) cameraErrorBox.classList.add('d-none');

    document.getElementById('visualSearchCamControls')?.classList.remove('d-none');
    document.getElementById('visualSearchRetakeControls')?.classList.add('d-none');
  }

  // Call AI Backend API
  async function runVisualSearchAI(imageBase64) {
    const loadingBox = document.getElementById('visualSearchLoading');
    const resultsContainer = document.getElementById('visualSearchResultsContainer');
    const emptyBox = document.getElementById('visualSearchEmptyResult');

    if (loadingBox) loadingBox.classList.remove('d-none');
    if (resultsContainer) resultsContainer.classList.add('d-none');
    if (emptyBox) emptyBox.classList.add('d-none');

    try {
      // Prepare active inventory items list
      const invList = (Array.isArray(window.equipmentList) ? window.equipmentList : []).map(e => ({
        id: e.id,
        name: e.name,
        code: e.code,
        category: e.category,
        location: e.location
      }));

      const res = await fetch('/api/identify-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageBase64,
          mimeType: 'image/jpeg',
          inventoryItems: invList
        })
      });

      const data = await res.json();
      if (loadingBox) loadingBox.classList.add('d-none');

      if (!res.ok || !data.success || !data.result) {
        throw new Error(data.error || 'ไม่สามารถวิเคราะห์ภาพได้');
      }

      renderVisualSearchResults(data.result);
    } catch (err) {
      if (loadingBox) loadingBox.classList.add('d-none');
      console.error("AI identification error:", err);
      if (emptyBox) {
        emptyBox.classList.remove('d-none');
        document.getElementById('visualSearchEmptyMsg').textContent = err.message || 'เกิดข้อผิดพลาดในการวิเคราะห์ภาพ กรุณาลองใหม่อีกครั้ง';
      }
    }
  }

  // Render Matched Equipment Results
  function renderVisualSearchResults(aiResult) {
    const container = document.getElementById('visualSearchResultsContainer');
    if (!container) return;

    container.innerHTML = '';
    container.classList.remove('d-none');

    const identifiedName = aiResult.identifiedName || 'อุปกรณ์การเกษตร';
    const category = aiResult.category || 'ทั่วไป';
    const description = aiResult.description || '';
    const keywords = Array.isArray(aiResult.keywords) ? aiResult.keywords : [];
    const matchedIds = Array.isArray(aiResult.matchedItemIds) ? aiResult.matchedItemIds : [];

    // Find actual equipment objects from equipmentList
    const allEquip = Array.isArray(window.equipmentList) ? window.equipmentList : [];
    let matchedEquips = [];

    // 1. Matched by IDs from AI
    matchedIds.forEach(id => {
      const found = allEquip.find(e => String(e.id) === String(id) || String(e.code) === String(id));
      if (found && !matchedEquips.some(m => m.id === found.id)) {
        matchedEquips.push({ item: found, matchType: 'DIRECT' });
      }
    });

    // 2. Fallback fuzzy search by identified name & keywords if fewer than 3 items
    if (matchedEquips.length < 3) {
      const searchTerms = [identifiedName, ...keywords].filter(Boolean);
      allEquip.forEach(item => {
        if (matchedEquips.some(m => m.item.id === item.id)) return;
        const nameLower = String(item.name || '').toLowerCase();
        const catLower = String(item.category || '').toLowerCase();

        const isMatch = searchTerms.some(term => {
          const t = term.toLowerCase();
          return nameLower.includes(t) || catLower.includes(t);
        });

        if (isMatch) {
          matchedEquips.push({ item: item, matchType: 'KEYWORD' });
        }
      });
    }

    // Build Header Card with AI Detection Info
    let html = `
      <div class="card border-0 bg-success bg-opacity-10 rounded-4 p-3 mb-3 border-start border-4 border-success">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-success rounded-pill px-2.5 py-1 fs-8"><i class="bi bi-robot me-1"></i>ผลการวิเคราะห์ภาพ</span>
            <span class="badge bg-light text-success border border-success border-opacity-25 rounded-pill px-2.5 py-1 fs-8">${escapeHtml(category)}</span>
          </div>
          <span class="fs-9 text-muted font-monospace"><i class="bi bi-check2-circle text-success me-1"></i>พบในคลัง ${matchedEquips.length} รายการ</span>
        </div>
        <h5 class="fw-bold text-dark mb-1">${escapeHtml(identifiedName)}</h5>
        ${description ? `<p class="fs-8 text-secondary mb-0">${escapeHtml(description)}</p>` : ''}
      </div>
    `;

    if (matchedEquips.length === 0) {
      html += `
        <div class="card border-0 bg-light rounded-4 p-4 text-center my-3">
          <i class="bi bi-search text-muted display-6"></i>
          <h6 class="fw-bold text-secondary mt-2 mb-1">ยังไม่มีอุปกรณ์ชื่อ "${escapeHtml(identifiedName)}" ในคลังพัสดุ</h6>
          <p class="text-muted fs-8 mb-3">ท่านสามารถค้นหาด้วยชื่อนี้ในแค็ตตาล็อก หรือเพิ่มเป็นอุปกรณ์ใหม่เข้าสู่ระบบได้</p>
          <div class="d-flex justify-content-center gap-2">
            <button class="btn btn-outline-primary btn-sm rounded-pill px-3" onclick="applyVisualSearchToCatalog('${escapeHtml(identifiedName)}')">
              <i class="bi bi-search me-1"></i>ค้นหาชื่อนี้ในคลัง
            </button>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="mb-2 d-flex align-items-center justify-content-between">
          <span class="fw-bold text-secondary fs-8">รายการอุปกรณ์ที่ตรงกันในคลัง:</span>
        </div>
        <div class="d-flex flex-column gap-2 mb-3">
      `;

      matchedEquips.forEach(({ item, matchType }, idx) => {
        const qty = item.quantity || 0;
        const borrowed = item.borrowedCount || 0;
        const available = Math.max(0, qty - borrowed);
        const img = item.imageUrl || 'https://images.unsplash.com/photo-1589923188900-85dae523342b?w=200&auto=format&fit=crop&q=80';
        const isTopMatch = idx === 0;

        html += `
          <div class="card border rounded-4 p-2.5 shadow-xs hover-shadow transition-all ${isTopMatch ? 'border-success bg-white border-2' : 'border-light-subtle bg-white'}">
            <div class="d-flex align-items-center gap-2.5">
              <img src="${img}" class="rounded-3 border object-fit-cover shadow-2xs" style="width: 58px; height: 58px; flex-shrink: 0;" onerror="this.src='https://images.unsplash.com/photo-1589923188900-85dae523342b?w=200&auto=format&fit=crop&q=80'" />
              <div class="flex-grow-1 min-w-0">
                <div class="d-flex align-items-center gap-1.5 flex-wrap">
                  <h6 class="fw-bold text-dark mb-0 fs-7 text-truncate">${escapeHtml(item.name || '')}</h6>
                  ${isTopMatch ? '<span class="badge bg-success rounded-pill fs-9 py-0.5">ตรงกันมากที่สุด</span>' : ''}
                </div>
                <div class="d-flex align-items-center gap-2 fs-9 text-muted mt-0.5 flex-wrap">
                  <span>รหัส: <strong class="text-secondary font-monospace">${escapeHtml(item.code || item.id || '-')}</strong></span>
                  <span>|</span>
                  <span>หมวด: ${escapeHtml(item.category || 'ทั่วไป')}</span>
                  <span>|</span>
                  <span>ที่เก็บ: ${escapeHtml(item.location || 'คลังกลาง')}</span>
                </div>
                <div class="mt-1 d-flex align-items-center gap-2">
                  <span class="badge ${available > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill fs-9 py-0.5">
                    พร้อมใช้: ${available} ${item.unit || 'ชิ้น'}
                  </span>
                  ${borrowed > 0 ? `<span class="badge bg-warning-subtle text-warning rounded-pill fs-9 py-0.5">ถูกยืม: ${borrowed}</span>` : ''}
                </div>
              </div>
              <div class="flex-shrink-0 d-flex flex-column gap-1.5">
                <button type="button" class="btn btn-success btn-sm rounded-pill fw-bold px-3 py-1 fs-8 shadow-xs" onclick="selectEquipmentFromVisualSearch('${item.id}')">
                  <i class="bi bi-check2-circle me-1"></i>เลือก
                </button>
              </div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
    }

    container.innerHTML = html;
  }

  // Action: Select item from visual search
  window.selectEquipmentFromVisualSearch = function (equipId) {
    const modalEl = document.getElementById('visualEquipmentSearchModal');
    if (modalEl) {
      const bsModal = bootstrap.Modal.getInstance(modalEl);
      if (bsModal) bsModal.hide();
    }
    stopVisualSearchCamera();

    const item = (Array.isArray(window.equipmentList) ? window.equipmentList : []).find(e => String(e.id) === String(equipId));
    if (!item) return;

    if (currentVisualSearchSource === 'transaction') {
      // Transaction Modal Flow
      const select = document.getElementById('equipSelect');
      if (select) {
        select.value = item.id;
        if (typeof window.updateEquipSelectPreview === 'function') {
          window.updateEquipSelectPreview();
        }
      }
      const searchBox = document.getElementById('equipSearchInput');
      if (searchBox) searchBox.value = item.name;

      // Close instant dropdown if open
      const resultsBox = document.getElementById('transEquipSearchResultsBox');
      if (resultsBox) resultsBox.classList.add('d-none');
    } else if (currentVisualSearchSource === 'staff') {
      // Staff Table Flow
      const staffInput = document.getElementById('staffSearchInput');
      if (staffInput) {
        staffInput.value = item.name;
        if (typeof window.renderStaffTable === 'function') {
          window.renderStaffTable();
        }
      }
    } else {
      // Catalog Grid Flow (Default)
      const catalogInput = document.getElementById('catalogSearchInput');
      if (catalogInput) {
        catalogInput.value = item.name;
        if (typeof window.renderCatalogGrid === 'function') {
          window.renderCatalogGrid();
        }
      }
      // Focus or scroll to card
      setTimeout(() => {
        const card = document.querySelector(`[data-equipment-id="${item.id}"]`) || document.getElementById(`equip-card-${item.id}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('border-primary', 'shadow-lg');
          setTimeout(() => card.classList.remove('border-primary', 'shadow-lg'), 3000);
        }
      }, 300);
    }
  };

  // Apply fallback search string to catalog
  window.applyVisualSearchToCatalog = function (searchTerm) {
    const modalEl = document.getElementById('visualEquipmentSearchModal');
    if (modalEl) {
      const bsModal = bootstrap.Modal.getInstance(modalEl);
      if (bsModal) bsModal.hide();
    }
    stopVisualSearchCamera();

    const catalogInput = document.getElementById('catalogSearchInput');
    if (catalogInput) {
      catalogInput.value = searchTerm;
      if (typeof window.renderCatalogGrid === 'function') {
        window.renderCatalogGrid();
      }
    }
  };

  // Helper escape HTML
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Cleanup on modal close
  document.addEventListener('DOMContentLoaded', () => {
    const modalEl = document.getElementById('visualEquipmentSearchModal');
    if (modalEl) {
      modalEl.addEventListener('hidden.bs.modal', () => {
        stopVisualSearchCamera();
      });
    }

    const addModal = document.getElementById('addEquipmentModal');
    if (addModal) {
      addModal.addEventListener('hidden.bs.modal', () => {
        const matchBox = document.getElementById('equipAiMatchAlertBox');
        const loadingBox = document.getElementById('equipAiAnalyzeLoading');
        const successNotice = document.getElementById('equipAiAutoFilledNotice');
        if (matchBox) matchBox.classList.add('d-none');
        if (loadingBox) loadingBox.classList.add('d-none');
        if (successNotice) successNotice.classList.add('d-none');
        currentAiAnalyzedAddResult = null;
      });
    }
  });

  // ========================================================
  // AI Equipment Analysis for Add Equipment Modal (หน้าเพิ่มรายการใหม่)
  // ========================================================
  let currentAiAnalyzedAddResult = null;

  window.analyzeEquipmentImageForAddModal = async function (imageBase64) {
    const checkEl = document.getElementById('equipAiAutoAnalyzeCheck');
    if (!checkEl || !checkEl.checked) return;

    const loadingBox = document.getElementById('equipAiAnalyzeLoading');
    const matchBox = document.getElementById('equipAiMatchAlertBox');
    const successNotice = document.getElementById('equipAiAutoFilledNotice');

    if (loadingBox) loadingBox.classList.remove('d-none');
    if (matchBox) matchBox.classList.add('d-none');
    if (successNotice) successNotice.classList.add('d-none');

    try {
      const invList = (Array.isArray(window.equipmentList) ? window.equipmentList : []).map(e => ({
        id: e.id,
        name: e.name,
        code: e.code,
        category: e.category,
        location: e.location
      }));

      const res = await fetch('/api/identify-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageBase64,
          mimeType: 'image/jpeg',
          inventoryItems: invList
        })
      });

      const data = await res.json();
      if (loadingBox) loadingBox.classList.add('d-none');

      if (!res.ok || !data.success || !data.result) {
        throw new Error(data.error || 'วิเคราะห์ภาพไม่สำเร็จ');
      }

      currentAiAnalyzedAddResult = data.result;
      handleAiAnalyzedResultInAddModal(data.result);
    } catch (err) {
      if (loadingBox) loadingBox.classList.add('d-none');
      console.warn("AI analysis for add modal error:", err);
    }
  };

  function handleAiAnalyzedResultInAddModal(result) {
    const matchBox = document.getElementById('equipAiMatchAlertBox');
    const matchItemsList = document.getElementById('equipAiMatchItemsList');
    const successNotice = document.getElementById('equipAiAutoFilledNotice');
    const nameInput = document.getElementById('equipNameThai');
    const catSelect = document.getElementById('equipCategorySelect');
    const descInput = document.getElementById('equipDescInput');

    const identifiedName = (result.identifiedName || '').trim();
    const category = (result.category || '').trim();
    const matchedIds = Array.isArray(result.matchedItemIds) ? result.matchedItemIds : [];

    const allEquip = Array.isArray(window.equipmentList) ? window.equipmentList : [];
    let matchedEquips = [];

    matchedIds.forEach(id => {
      const found = allEquip.find(e => String(e.id) === String(id) || String(e.code) === String(id));
      if (found && !matchedEquips.some(m => m.id === found.id)) {
        matchedEquips.push(found);
      }
    });

    if (matchedEquips.length === 0 && identifiedName) {
      const foundByName = allEquip.filter(e => String(e.name || '').toLowerCase().includes(identifiedName.toLowerCase()));
      matchedEquips.push(...foundByName);
    }

    if (matchedEquips.length > 0) {
      // CASE 1: Found matching equipment in inventory -> Show match alert box with items and 2 buttons
      if (matchItemsList) {
        let html = '';
        matchedEquips.forEach(item => {
          const qty = item.quantity || 0;
          const borrowed = item.borrowedCount || 0;
          const available = Math.max(0, qty - borrowed);
          const img = item.imageUrl || 'https://images.unsplash.com/photo-1589923188900-85dae523342b?w=200&auto=format&fit=crop&q=80';

          html += `
            <div class="card border rounded-3 p-2 bg-white shadow-xs">
              <div class="d-flex align-items-center gap-2">
                <img src="${img}" class="rounded-2 border object-fit-cover shadow-2xs" style="width: 48px; height: 48px; flex-shrink: 0;" onerror="this.src='https://images.unsplash.com/photo-1589923188900-85dae523342b?w=200&auto=format&fit=crop&q=80'" />
                <div class="flex-grow-1 min-w-0">
                  <div class="fw-bold text-dark fs-8 text-truncate">${escapeHtml(item.name || '')}</div>
                  <div class="d-flex align-items-center gap-1.5 fs-9 text-muted flex-wrap">
                    <span>รหัส: <strong class="text-secondary font-monospace">${escapeHtml(item.code || item.id || '-')}</strong></span>
                    <span>|</span>
                    <span>คงเหลือ: <strong class="${available > 0 ? 'text-success' : 'text-danger'}">${available}</strong> ${item.unit || 'ชิ้น'}</span>
                    <span>|</span>
                    <span>ที่เก็บ: ${escapeHtml(item.location || 'คลังกลาง')}</span>
                  </div>
                </div>
              </div>
            </div>
          `;
        });
        matchItemsList.innerHTML = html;
      }
      if (matchBox) matchBox.classList.remove('d-none');
      if (successNotice) successNotice.classList.add('d-none');
    } else {
      // CASE 2: Not found in inventory -> Automatically fill name and category!
      if (matchBox) matchBox.classList.add('d-none');

      if (identifiedName && nameInput) {
        nameInput.value = identifiedName;
        nameInput.classList.add('border-success', 'shadow-sm');
        setTimeout(() => nameInput.classList.remove('shadow-sm'), 3000);
      }

      if (category && catSelect) {
        for (let i = 0; i < catSelect.options.length; i++) {
          const opt = catSelect.options[i];
          if (opt.value && (category.includes(opt.value) || opt.value.includes(category))) {
            catSelect.value = opt.value;
            break;
          }
        }
        if (typeof window.updateEquipmentCodeForCategory === 'function') {
          window.updateEquipmentCodeForCategory();
        }
      }

      if (result.description && descInput && !descInput.value.trim()) {
        descInput.value = result.description;
      }

      if (successNotice) {
        successNotice.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> AI ช่วยใส่ชื่อ "<strong>${escapeHtml(identifiedName)}</strong>" และหมวดหมู่ให้อัตโนมัติแล้ว`;
        successNotice.classList.remove('d-none');
      }
    }
  }

  // Button 1: Proceed as new item
  window.proceedAsNewEquipmentFromAi = function () {
    const matchBox = document.getElementById('equipAiMatchAlertBox');
    const successNotice = document.getElementById('equipAiAutoFilledNotice');
    const nameInput = document.getElementById('equipNameThai');
    const catSelect = document.getElementById('equipCategorySelect');
    const descInput = document.getElementById('equipDescInput');

    if (matchBox) matchBox.classList.add('d-none');

    if (currentAiAnalyzedAddResult) {
      const identifiedName = (currentAiAnalyzedAddResult.identifiedName || '').trim();
      const category = (currentAiAnalyzedAddResult.category || '').trim();

      if (identifiedName && nameInput) {
        nameInput.value = identifiedName;
        nameInput.classList.add('border-success', 'shadow-sm');
        setTimeout(() => nameInput.classList.remove('shadow-sm'), 3000);
      }

      if (category && catSelect) {
        for (let i = 0; i < catSelect.options.length; i++) {
          const opt = catSelect.options[i];
          if (opt.value && (category.includes(opt.value) || opt.value.includes(category))) {
            catSelect.value = opt.value;
            break;
          }
        }
        if (typeof window.updateEquipmentCodeForCategory === 'function') {
          window.updateEquipmentCodeForCategory();
        }
      }

      if (currentAiAnalyzedAddResult.description && descInput && !descInput.value.trim()) {
        descInput.value = currentAiAnalyzedAddResult.description;
      }

      if (successNotice) {
        successNotice.innerHTML = `<i class="bi bi-plus-circle-fill me-1"></i> พร้อมเพิ่ม "<strong>${escapeHtml(identifiedName)}</strong>" เป็นรายการใหม่เรียบร้อยแล้ว`;
        successNotice.classList.remove('d-none');
      }

      const qtyInput = document.getElementById('equipQtyInput');
      if (qtyInput) qtyInput.focus();
    }
  };

  // Button 2: Cancel matching
  window.cancelEquipmentAiMatch = function () {
    const matchBox = document.getElementById('equipAiMatchAlertBox');
    const successNotice = document.getElementById('equipAiAutoFilledNotice');
    const previewBox = document.getElementById('equipImgPreviewBox');
    const previewImg = document.getElementById('equipImgPreview');
    const fileInput = document.getElementById('equipImageFileInput');
    const cameraInput = document.getElementById('equipImageCameraInput');

    if (matchBox) matchBox.classList.add('d-none');
    if (successNotice) successNotice.classList.add('d-none');
    if (previewBox) previewBox.classList.add('d-none');
    if (previewImg) previewImg.src = '';
    if (fileInput) fileInput.value = '';
    if (cameraInput) cameraInput.value = '';

    currentAiAnalyzedAddResult = null;
    if (typeof window.showToast === 'function') {
      window.showToast("ยกเลิกการเลือกภาพถ่ายเรียบร้อยแล้ว");
    }
  };
})();
