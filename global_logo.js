/* Global Logo Manager for Flora Garden
 * Centralized Logo System: Default Sunflower Vector & Cloud-Synced Custom Logo
 */
(function() {
  "use strict";

  function getScopedKey(baseKey) {
    let dbId = window.firebaseConfig?.firestoreDatabaseId || window.floraFirebaseConfig?.firestoreDatabaseId || "";
    if (!dbId) {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'firebase-applet-config.json', false);
        xhr.send(null);
        if (xhr.status === 200 || xhr.status === 304) {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed && (parsed.firestoreDatabaseId || parsed.projectId)) {
            window.firebaseConfig = { ...window.firebaseConfig, ...parsed };
            window.floraFirebaseConfig = window.firebaseConfig;
            dbId = parsed.firestoreDatabaseId || "";
          }
        }
      } catch (e) {}
    }
    if (dbId && dbId !== "(default)") {
      const cleanDbId = String(dbId).replace(/[^a-zA-Z0-9_-]/g, "_");
      return `${baseKey}_${cleanDbId}`;
    }
    return baseKey;
  }

  const BASE_STORAGE_KEY = "flora_global_logo";
  const LOGO_CHANGED_EVENT = "flora-global-logo-changed";
  
  let memoryLogoUrl = "";
  let isCustomLogoActive = false;
  let firestoreBridge = null;
  let isFirestoreListenerAttached = false;
  let pendingLogoDataUrl = null;

  // 1. High-Contrast Sunflower Vector SVG Generator
  function getSunflowerSvg(size = 48, className = "") {
    const s = Math.max(20, Number(size) || 48);
    
    // Generate 12 background petals (offset by 15 deg) & 12 foreground petals (offset by 0 deg)
    let bgPetals = "";
    let fgPetals = "";
    for (let i = 0; i < 12; i++) {
      const bgDeg = 15 + i * 30;
      const fgDeg = i * 30;
      bgPetals += `<g transform="rotate(${bgDeg} 50 50)"><path d="M50 10 C46 22 43 32 50 41 C57 32 54 22 50 10 Z" fill="url(#sfPetalGrad2_${s})"/></g>`;
      fgPetals += `<g transform="rotate(${fgDeg} 50 50)"><path d="M50 8 C45 21 42 32 50 42 C58 32 55 21 50 8 Z" fill="url(#sfPetalGrad1_${s})"/></g>`;
    }

    return `<svg class="sunflower-vector-svg ${className}" width="${s}" height="${s}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Sunflower Logo">
      <defs>
        <radialGradient id="sfCenterGrad_${s}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#795548"/>
          <stop offset="60%" stop-color="#4e342e"/>
          <stop offset="100%" stop-color="#2d1d17"/>
        </radialGradient>
        <linearGradient id="sfPetalGrad1_${s}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fff59d"/>
          <stop offset="50%" stop-color="#fbc02d"/>
          <stop offset="100%" stop-color="#f57f17"/>
        </linearGradient>
        <linearGradient id="sfPetalGrad2_${s}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fff9c4"/>
          <stop offset="55%" stop-color="#f9a825"/>
          <stop offset="100%" stop-color="#e65100"/>
        </linearGradient>
        <filter id="sfShadow_${s}" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#e65100" flood-opacity="0.4"/>
        </filter>
      </defs>
      <!-- Circular Crisp Base Disc for Maximum Contrast -->
      <circle cx="50" cy="50" r="47.5" fill="#ffffff" stroke="#ffd54f" stroke-width="2"/>
      
      <!-- Background Petals Layer -->
      <g filter="url(#sfShadow_${s})">
        ${bgPetals}
      </g>
      
      <!-- Foreground Petals Layer -->
      <g filter="url(#sfShadow_${s})">
        ${fgPetals}
      </g>
      
      <!-- Center Seed Disk -->
      <circle cx="50" cy="50" r="18" fill="url(#sfCenterGrad_${s})" stroke="#ffb300" stroke-width="1.8"/>
      
      <!-- Textured Seed Spiral Dots -->
      <circle cx="50" cy="50" r="14.5" fill="none" stroke="#ffca28" stroke-width="1" stroke-dasharray="1.5 2.5"/>
      <circle cx="50" cy="50" r="10.5" fill="none" stroke="#ffe082" stroke-width="1" stroke-dasharray="1.5 2.5"/>
      <circle cx="50" cy="50" r="6" fill="none" stroke="#fff8e1" stroke-width="1" stroke-dasharray="1.2 2"/>
      <circle cx="50" cy="50" r="2" fill="#fff9c4"/>
    </svg>`;
  }

  function getSunflowerDataUrl(size = 96) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(getSunflowerSvg(size));
  }

  // 2. Core State Management
  function getGlobalLogo() {
    if (memoryLogoUrl && isCustomLogoActive) {
      return { url: memoryLogoUrl, isCustom: true };
    }

    try {
      const stored = localStorage.getItem(getScopedKey(BASE_STORAGE_KEY));
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.url && parsed.isCustom && parsed.url !== "DEFAULT_SUNFLOWER") {
          memoryLogoUrl = parsed.url;
          isCustomLogoActive = true;
          return { url: parsed.url, isCustom: true };
        }
      }
    } catch (e) {}

    return {
      url: getSunflowerDataUrl(96),
      isCustom: false
    };
  }

  function broadcastLogoChange(logoData) {
    try {
      window.dispatchEvent(new CustomEvent(LOGO_CHANGED_EVENT, { detail: logoData }));
    } catch (e) {}
    updateAllRenderedLogos();
  }

  const BASE_PROJECT_TITLE_KEY = "flora_global_project_title";
  const PROJECT_TITLE_CHANGED_EVENT = "flora-project-title-changed";
  const BASE_PROJECT_NOTE_KEY = "flora_global_project_note";
  const PROJECT_NOTE_CHANGED_EVENT = "flora-project-note-changed";

  function getGlobalProjectTitle() {
    if (typeof window.getFloraOrgTree === "function") {
      try {
        const tree = window.getFloraOrgTree();
        if (tree && tree.name) return String(tree.name).trim();
      } catch (e) {}
    }
    try {
      const treeStored = localStorage.getItem(getScopedKey("flora_org_tree_v2")) || localStorage.getItem("flora_org_tree_v2");
      if (treeStored) {
        const parsed = JSON.parse(treeStored);
        const root = parsed.tree || parsed;
        if (root && root.name && String(root.name).trim()) return String(root.name).trim();
      }
      const stored = localStorage.getItem(getScopedKey(BASE_PROJECT_TITLE_KEY)) || localStorage.getItem(BASE_PROJECT_TITLE_KEY);
      if (stored && stored.trim()) return stored.trim();
    } catch (e) {}
    return "โครงการรัตนบุปผา และผลิตดอกไม้ธรรมยาตรา";
  }

  function getGlobalProjectNote() {
    if (typeof window.getFloraOrgTree === "function") {
      try {
        const tree = window.getFloraOrgTree();
        if (tree && typeof tree.note === "string") return String(tree.note).trim();
      } catch (e) {}
    }
    try {
      const treeStored = localStorage.getItem(getScopedKey("flora_org_tree_v2")) || localStorage.getItem("flora_org_tree_v2");
      if (treeStored) {
        const parsed = JSON.parse(treeStored);
        const root = parsed.tree || parsed;
        if (root && typeof root.note === "string") return String(root.note).trim();
      }
      const stored = localStorage.getItem(getScopedKey(BASE_PROJECT_NOTE_KEY)) || localStorage.getItem(BASE_PROJECT_NOTE_KEY);
      if (stored !== null && stored !== undefined) return stored.trim();
    } catch (e) {}
    return "";
  }

  function setGlobalProjectTitle(title) {
    const clean = String(title || "").trim() || "โครงการรัตนบุปผา และผลิตดอกไม้ธรรมยาตรา";
    try {
      localStorage.setItem(getScopedKey(BASE_PROJECT_TITLE_KEY), clean);
      localStorage.setItem(BASE_PROJECT_TITLE_KEY, clean);
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent(PROJECT_TITLE_CHANGED_EVENT, { detail: { title: clean } }));
    } catch (e) {}
    updateAllRenderedTitles(clean);
  }

  function setGlobalProjectNote(note) {
    const clean = String(note || "").trim();
    try {
      localStorage.setItem(getScopedKey(BASE_PROJECT_NOTE_KEY), clean);
      localStorage.setItem(BASE_PROJECT_NOTE_KEY, clean);
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent(PROJECT_NOTE_CHANGED_EVENT, { detail: { note: clean } }));
    } catch (e) {}
    updateAllRenderedNotes(clean);
  }

  function updateAllRenderedNotes(note) {
    const projectNote = String(note !== undefined ? note : getGlobalProjectNote()).trim();
    const bannerNoteEl = document.getElementById('slot-node1-note');
    if (bannerNoteEl) {
      if (projectNote) {
        bannerNoteEl.innerHTML = `<i class="bi bi-info-circle me-1 opacity-75 fs-8"></i>${projectNote.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}`;
        bannerNoteEl.style.display = 'flex';
      } else {
        bannerNoteEl.innerHTML = '';
        bannerNoteEl.style.display = 'none';
      }
    }
  }

  function updateAllRenderedTitles(title) {
    const projectTitle = String(title || getGlobalProjectTitle()).trim();
    if (!projectTitle) return;

    // Update browser title
    try {
      if (document.title && document.title.includes(' - ')) {
        const prefix = document.title.split(' - ')[0].trim();
        document.title = `${prefix} - ${projectTitle}`;
      }
    } catch (e) {}

    // Update all elements with specific data attribute or master classes
    document.querySelectorAll('[data-flora-project-title], .brand-master-title, .app-master-title, .poster-title-text, .banner-title').forEach(el => {
      if (el) el.textContent = projectTitle;
    });

    const subTitleEl = document.getElementById('orgProjectHeaderSubtitle');
    if (subTitleEl) subTitleEl.textContent = projectTitle;

    const bannerTitleEl = document.querySelector('.banner-title');
    if (bannerTitleEl) bannerTitleEl.textContent = projectTitle;

    const navBrandTitle = document.getElementById('navbarMasterBrandTitle');
    if (navBrandTitle) navBrandTitle.textContent = projectTitle;

    const loginTitle = document.getElementById('loginOverlayProjectTitle');
    if (loginTitle) loginTitle.textContent = projectTitle;

    const payslipTitle = document.getElementById('payslipProjectTitle');
    if (payslipTitle) payslipTitle.textContent = projectTitle;

    const jobAppNavTitle = document.getElementById('jobAppNavProjectTitle');
    if (jobAppNavTitle) jobAppNavTitle.textContent = projectTitle;

    const jobAppAppName = document.getElementById('jobAppApplicantProjectName');
    if (jobAppAppName) jobAppAppName.textContent = projectTitle;

    const appFormProjName = document.getElementById('applicantFormProjectName');
    if (appFormProjName) appFormProjName.textContent = projectTitle;

    const orgHeaderTitle = document.getElementById('orgProjectHeaderTitle');
    if (orgHeaderTitle) orgHeaderTitle.textContent = projectTitle;

    // Also update builder description if it contains default wording
    const builderDesc = document.getElementById('builderFormDesc');
    if (builderDesc && builderDesc.value && builderDesc.value.includes(' - ')) {
      const suffix = builderDesc.value.split(' - ')[1] || 'กรุณากรอกข้อมูลตามความเป็นจริงเพื่อประกอบการพิจารณาคัดเลือกเข้าปฏิบัติงาน';
      builderDesc.value = `${projectTitle} - ${suffix}`;
    }

    updateAllRenderedNotes();
  }

  function applyFirestoreTreeData(data) {
    if (!data || typeof data !== "object") return;
    const tree = data.tree || data;
    if (tree && typeof tree === "object") {
      const node1Name = tree.name || (Array.isArray(tree.children) && tree.children[0]?.name) || tree.organizationName || tree.projectName || "";
      if (node1Name && typeof node1Name === "string" && node1Name.trim()) {
        const cleanTitle = node1Name.trim();
        try {
          localStorage.setItem(getScopedKey(BASE_PROJECT_TITLE_KEY), cleanTitle);
          localStorage.setItem(BASE_PROJECT_TITLE_KEY, cleanTitle);
          localStorage.setItem(getScopedKey("flora_org_tree_v2"), JSON.stringify(tree));
          localStorage.setItem("flora_org_tree_v2", JSON.stringify(tree));
        } catch (e) {}
        updateAllRenderedTitles(cleanTitle);
      }
      const node1Note = (typeof tree.note === "string" ? tree.note : (tree.organizationNote || tree.projectNote || "")) || "";
      try {
        localStorage.setItem(getScopedKey(BASE_PROJECT_NOTE_KEY), String(node1Note).trim());
        localStorage.setItem(BASE_PROJECT_NOTE_KEY, String(node1Note).trim());
      } catch (e) {}
      updateAllRenderedNotes(node1Note);
    }
  }

  function applyFirestoreData(data) {
    if (!data || typeof data !== "object") return;
    
    // Sync Master Organization / Project Name
    const rawTitle = data.organizationName || data.projectName || data.projectTitle || data.title || "";
    if (rawTitle && typeof rawTitle === "string" && rawTitle.trim()) {
      const cleanTitle = rawTitle.trim();
      try {
        localStorage.setItem(getScopedKey(BASE_PROJECT_TITLE_KEY), cleanTitle);
        localStorage.setItem(BASE_PROJECT_TITLE_KEY, cleanTitle);
      } catch (e) {}
      updateAllRenderedTitles(cleanTitle);
    }
    const rawNote = data.organizationNote || data.projectNote || data.note || "";
    if (typeof rawNote === "string") {
      const cleanNote = rawNote.trim();
      try {
        localStorage.setItem(getScopedKey(BASE_PROJECT_NOTE_KEY), cleanNote);
        localStorage.setItem(BASE_PROJECT_NOTE_KEY, cleanNote);
      } catch (e) {}
      updateAllRenderedNotes(cleanNote);
    }

    if (data.logoType === "sunflower" || data.globalLogo === "DEFAULT_SUNFLOWER" || data.globalLogoUrl === "DEFAULT_SUNFLOWER") {
      memoryLogoUrl = "";
      isCustomLogoActive = false;
      try {
        localStorage.setItem(getScopedKey(BASE_STORAGE_KEY), JSON.stringify({ url: "", isCustom: false, updatedAt: new Date().toISOString() }));
      } catch (e) {}
      broadcastLogoChange({ url: getSunflowerDataUrl(96), isCustom: false });
      return;
    }

    const targetUrl = data.globalLogo || data.globalLogoUrl || data.logoUrl || data.url || "";
    if (targetUrl && typeof targetUrl === "string" && targetUrl !== "DEFAULT_SUNFLOWER") {
      memoryLogoUrl = targetUrl;
      isCustomLogoActive = true;
      try {
        localStorage.setItem(getScopedKey(BASE_STORAGE_KEY), JSON.stringify({ url: targetUrl, isCustom: true, updatedAt: data.updatedAt || new Date().toISOString() }));
      } catch (e) {}
      broadcastLogoChange({ url: targetUrl, isCustom: true });
    }
  }

  // 3. Upload & Save to Cloud
  async function uploadLogoToStorage(fileOrDataUrl) {
    let base64Data = "";
    let mimeType = "image/png";

    if (typeof fileOrDataUrl === "string") {
      const match = fileOrDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        return fileOrDataUrl;
      }
    }

    const bridge = getActiveFirestoreBridge();
    if (bridge && typeof bridge.uploadImageToStorage === "function") {
      try {
        const ext = mimeType === "image/svg+xml" ? "svg" : (mimeType === "image/webp" ? "webp" : "png");
        const uploadResult = await bridge.uploadImageToStorage(`system_assets/global-logo-${Date.now()}.${ext}`, fileOrDataUrl);
        if (uploadResult && typeof uploadResult === "string") {
          return uploadResult;
        }
      } catch (storageErr) {
        console.warn("Storage bridge upload notice:", storageErr);
      }
    }

    // Direct Firebase Storage REST fallback
    try {
      const bucket = "flora-gaden.firebasestorage.app";
      const ext = mimeType === "image/svg+xml" ? "svg" : (mimeType === "image/webp" ? "webp" : "png");
      const filename = `system_assets/global-logo-${Date.now()}.${ext}`;
      const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodeURIComponent(filename)}`;
      
      const byteCharacters = atob(base64Data);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }

      const resp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": mimeType },
        body: byteArray
      });

      if (resp.ok) {
        const resJson = await resp.json();
        const downloadToken = resJson.downloadTokens ? resJson.downloadTokens.split(",")[0] : "";
        return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(filename)}?alt=media${downloadToken ? "&token=" + downloadToken : ""}`;
      }
    } catch (directErr) {
      console.warn("Direct storage upload fallback to data URL:", directErr);
    }

    return fileOrDataUrl;
  }

  async function setGlobalLogo(fileOrDataUrl) {
    if (!fileOrDataUrl) return;

    let finalUrl = fileOrDataUrl;
    if (typeof fileOrDataUrl === "string" && fileOrDataUrl.startsWith("data:")) {
      finalUrl = await uploadLogoToStorage(fileOrDataUrl);
    }

    memoryLogoUrl = finalUrl;
    isCustomLogoActive = true;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        url: finalUrl,
        isCustom: true,
        updatedAt: new Date().toISOString()
      }));
    } catch (e) {}

    broadcastLogoChange({ url: finalUrl, isCustom: true });

    // Sync to Firestore
    const bridge = getActiveFirestoreBridge();
    if (bridge && bridge.db && bridge.doc && bridge.setDoc) {
      try {
        const logoDocRef = bridge.doc(bridge.db, "system_settings", "general");
        await bridge.setDoc(logoDocRef, {
          globalLogo: finalUrl,
          globalLogoUrl: finalUrl,
          logoType: "custom",
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn("Firestore logo sync notice:", err);
      }
    }

    return finalUrl;
  }

  async function resetGlobalLogo() {
    memoryLogoUrl = "";
    isCustomLogoActive = false;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        url: "",
        isCustom: false,
        updatedAt: new Date().toISOString()
      }));
    } catch (e) {}

    const defaultData = { url: getSunflowerDataUrl(96), isCustom: false };
    broadcastLogoChange(defaultData);

    const bridge = getActiveFirestoreBridge();
    if (bridge && bridge.db && bridge.doc && bridge.setDoc) {
      try {
        const logoDocRef = bridge.doc(bridge.db, "system_settings", "general");
        await bridge.setDoc(logoDocRef, {
          globalLogo: "DEFAULT_SUNFLOWER",
          globalLogoUrl: "DEFAULT_SUNFLOWER",
          logoType: "sunflower",
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn("Firestore logo reset notice:", err);
      }
    }
  }

  // 4. Firestore Bridge Connect
  function getActiveFirestoreBridge() {
    if (firestoreBridge) return firestoreBridge;
    if (window.floraFirebaseBridge) return window.floraFirebaseBridge;
    if (window.personnelApi && window.personnelApi.db) return window.personnelApi;
    return null;
  }

  function connectGlobalLogoFirestore(bridge) {
    if (!bridge || !bridge.db || !bridge.doc) return;
    firestoreBridge = bridge;
    if (isFirestoreListenerAttached) return;

    try {
      const logoDocRef = bridge.doc(bridge.db, "system_settings", "general");
      const treeDocRef = bridge.doc(bridge.db, "org_structure", "main");
      
      if (typeof bridge.onSnapshot === "function") {
        bridge.onSnapshot(logoDocRef, (snap) => {
          if (snap && snap.exists()) {
            applyFirestoreData(snap.data());
          }
        }, (err) => {
          console.warn("Firestore logo onSnapshot notice:", err);
        });

        bridge.onSnapshot(treeDocRef, (snap) => {
          if (snap && snap.exists()) {
            applyFirestoreTreeData(snap.data());
          }
        }, (err) => {
          console.warn("Firestore org_structure onSnapshot notice:", err);
        });

        isFirestoreListenerAttached = true;
      }

      if (typeof bridge.getDoc === "function") {
        bridge.getDoc(logoDocRef).then((snap) => {
          if (snap && snap.exists()) {
            applyFirestoreData(snap.data());
          }
        }).catch(() => {});

        bridge.getDoc(treeDocRef).then((snap) => {
          if (snap && snap.exists()) {
            applyFirestoreTreeData(snap.data());
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.warn("Attach Firestore logo listener notice:", err);
    }
  }

  window.addEventListener("flora-personnel-api-ready", () => {
    if (window.personnelApi) connectGlobalLogoFirestore(window.personnelApi);
  });
  window.addEventListener("flora-firebase-ready", () => {
    if (window.floraFirebaseBridge) connectGlobalLogoFirestore(window.floraFirebaseBridge);
  });

  let bridgeCheckAttempts = 0;
  const bridgeCheckTimer = setInterval(() => {
    bridgeCheckAttempts++;
    const b = getActiveFirestoreBridge();
    if (b) {
      connectGlobalLogoFirestore(b);
      clearInterval(bridgeCheckTimer);
    } else if (bridgeCheckAttempts > 30) {
      clearInterval(bridgeCheckTimer);
    }
  }, 250);

  // Auto-initialize standalone Firestore listener for pages without full framework setup
  async function autoInitFirebaseGlobalListener() {
    if (isFirestoreListenerAttached) return;
    try {
      let cfg = window.firebaseConfig || window.floraFirebaseConfig;
      if (!cfg || !cfg.projectId) {
        try {
          const res = await fetch('firebase-applet-config.json');
          if (res.ok) {
            cfg = await res.json();
            window.firebaseConfig = cfg;
          }
        } catch (e) {}
      }
      if (!cfg || !cfg.projectId) return;

      const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
      const { getFirestore, initializeFirestore, doc, onSnapshot, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      
      let appInstance;
      const apps = getApps();
      if (apps.length > 0) {
        appInstance = apps[0];
      } else {
        appInstance = initializeApp(cfg);
      }

      let database = window.db;
      if (!database) {
        const dbId = cfg.firestoreDatabaseId;
        if (dbId && dbId !== "(default)") {
          database = initializeFirestore(appInstance, {}, dbId);
        } else {
          database = getFirestore(appInstance);
        }
        window.db = database;
      }

      const bridge = {
        db: database,
        doc,
        onSnapshot,
        getDoc,
        setDoc
      };

      window.floraFirebaseBridge = bridge;
      connectGlobalLogoFirestore(bridge);
    } catch (e) {
      console.warn("Global Logo auto Firestore attach notice:", e);
    }
  }

  if (typeof window !== "undefined") {
    setTimeout(autoInitFirebaseGlobalListener, 500);
  }

  // 5. DOM Renderers & Updaters
  function updateFavicon(url) {
    try {
      const favicons = document.querySelectorAll("link[rel*='icon']");
      if (url) {
        favicons.forEach(el => { el.href = url; });
      }
    } catch (e) {}
  }

  function escapeAttribute(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function handleLogoImageError(img) {
    if (!img || img.dataset.logoFallbackApplied === "true") return;
    img.dataset.logoFallbackApplied = "true";
    const size = Math.max(24, parseInt(img.getAttribute("width") || img.style.width || "48", 10) || 48);
    const wrapper = img.parentElement;
    if (wrapper) {
      wrapper.innerHTML = getSunflowerSvg(size, "flora-logo-load-fallback");
    } else {
      img.src = getSunflowerDataUrl(size);
    }
  }

  function renderLogoHtml(size = 40, options = {}) {
    const logo = getGlobalLogo();
    const className = options.className || "";
    const title = options.title || (logo.isCustom ? "โลโก้องค์กร (คลิกเพื่อจัดการโลโก้)" : "โลโก้ดอกทานตะวัน (คลิกเพื่อจัดการโลโก้)");
    const interactiveAttr = options.interactive ? 'onclick="event.stopPropagation(); window.openGlobalLogoModal();"' : '';

    if (logo.isCustom && logo.url) {
      const safeUrl = escapeAttribute(logo.url);
      return `
        <div class="flora-logo-container custom-logo-badge ${className}" 
             style="width: ${size}px; height: ${size}px; background: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center;" 
             title="${title}" 
             ${interactiveAttr}>
          <img src="${safeUrl}" alt="Organization Logo" class="flora-logo-img" onerror="window.floraLogo.handleLogoImageError(this)" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%; background: #ffffff; padding: 2px; box-sizing: border-box;">
        </div>
      `;
    }

    return `
      <div class="flora-logo-container sunflower-logo-badge ${className}" 
           style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;" 
           title="${title}" 
           ${interactiveAttr}>
        ${getSunflowerSvg(size, "flora-sunflower-render")}
      </div>
    `;
  }

  function updateAllRenderedLogos() {
    const logo = getGlobalLogo();
    updateFavicon(logo.url);

    // 1. Top Navbar Logos
    document.querySelectorAll('[data-flora-logo="navbar"]').forEach(el => {
      const size = parseInt(el.getAttribute('data-logo-size') || '32', 10);
      el.innerHTML = renderLogoHtml(size, {
        interactive: false,
        title: "โลโก้องค์กร / โครงการ"
      });
    });

    // 2. Poster Corner Logos (Top-Left & Top-Right)
    document.querySelectorAll('[data-flora-logo="corner"], .poster-corner-badge').forEach(el => {
      const size = parseInt(el.getAttribute('data-logo-size') || '82', 10);
      el.innerHTML = renderLogoHtml(size, {
        className: "corner-logo-inner",
        interactive: false,
        title: "โลโก้องค์กร / โครงการ (คลิกเพื่อจัดการและเปลี่ยนโลโก้)"
      });
      el.onclick = function(e) {
        if (e) e.stopPropagation();
        openGlobalLogoModal();
      };
    });

    // 3. Generic logo badges
    document.querySelectorAll('[data-flora-logo="badge"]').forEach(el => {
      const size = parseInt(el.getAttribute('data-logo-size') || '48', 10);
      const isInteractive = el.getAttribute('data-interactive') === 'true';
      el.innerHTML = renderLogoHtml(size, {
        interactive: false
      });
      if (isInteractive) {
        el.onclick = function(e) {
          if (e) e.stopPropagation();
          openGlobalLogoModal();
        };
      }
    });
  }

  // 6. Modal Dialog for Logo Management
  let isModalOpening = false;

  function cleanupModalArtifacts() {
    document.querySelectorAll(".modal-backdrop").forEach(b => {
      try { b.remove(); } catch (e) {}
    });
    if (document.body) {
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-right");
    }
  }

  function closeGlobalLogoModal() {
    const modalEl = document.getElementById("globalLogoModal");
    if (!modalEl) {
      cleanupModalArtifacts();
      return;
    }

    if (window.bootstrap && window.bootstrap.Modal) {
      try {
        const bsModal = window.bootstrap.Modal.getInstance(modalEl);
        if (bsModal) {
          bsModal.hide();
          return;
        }
      } catch (e) {}
    }

    // Fallback if bootstrap is not available or instance not found
    modalEl.classList.remove("show");
    modalEl.style.display = "none";
    modalEl.setAttribute("aria-hidden", "true");
    cleanupModalArtifacts();
  }

  function openGlobalLogoModal() {
    if (isModalOpening) return;
    isModalOpening = true;
    setTimeout(() => { isModalOpening = false; }, 400);

    const existingModal = document.getElementById("globalLogoModal");
    if (existingModal && existingModal.classList.contains("show")) {
      return;
    }

    // Clean any previous artifacts
    cleanupModalArtifacts();

    let host = document.getElementById("globalLogoModalHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "globalLogoModalHost";
      document.body.appendChild(host);
    }

    const currentLogo = getGlobalLogo();

    host.innerHTML = `
      <div class="modal fade" id="globalLogoModal" tabindex="-1" aria-labelledby="globalLogoModalTitle" aria-hidden="true" style="z-index: 1060;">
        <div class="modal-dialog modal-dialog-centered modal-md" style="z-index: 1061; position: relative;">
          <div class="modal-content border-0 shadow-2xl rounded-4 overflow-hidden" style="background: #ffffff;">
            <!-- Modal Header -->
            <div class="modal-header bg-warning-subtle text-dark py-3 px-4 border-bottom">
              <div class="d-flex align-items-center gap-2.5">
                <div class="bg-warning text-dark p-2 rounded-circle d-flex align-items-center justify-content-center shadow-xs" style="width: 38px; height: 38px;">
                  <i class="bi bi-flower1 fs-5"></i>
                </div>
                <div>
                  <h5 class="modal-title fw-bold mb-0 text-dark" id="globalLogoModalTitle">จัดการโลโก้องค์กร / โครงการ</h5>
                  <small class="text-muted fs-8">โลโก้ที่บันทึกจะซิงค์ตรงกันทุกจุดในระบบ (4 มุมผังองค์กร และเมนูหลัก)</small>
                </div>
              </div>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4 text-center">
              <!-- Live Preview Area -->
              <div class="mb-4">
                <label class="form-label fw-bold text-dark fs-7 mb-2">ตัวอย่างโลโก้ปัจจุบันที่ใช้งานอยู่:</label>
                <div class="d-flex align-items-center justify-content-center p-3 rounded-4 bg-light border shadow-inner mx-auto" style="width: 140px; height: 140px; position: relative;">
                  <div id="logoModalPreviewHost" class="d-flex align-items-center justify-content-center w-100 h-100">
                    ${currentLogo.isCustom && currentLogo.url 
                      ? `<img src="${escapeAttribute(currentLogo.url)}" id="modalPreviewImg" alt="Current Logo" class="rounded-circle shadow-sm" onerror="window.floraLogo.handleLogoImageError(this)" style="width: 100px; height: 100px; object-fit: contain; background: #ffffff; padding: 4px; border: 2px solid #ffd54f;">`
                      : getSunflowerSvg(100, "modal-preview-sunflower")
                    }
                  </div>
                </div>
                <div class="mt-2">
                  <span id="modalLogoStatusBadge" class="badge ${currentLogo.isCustom ? 'bg-success' : 'bg-warning text-dark'} px-3 py-1.5 rounded-pill fs-8 fw-semibold">
                    ${currentLogo.isCustom ? '✓ กำลังใช้โลโก้ที่อัปโหลดเอง' : '🌻 กำลังใช้โลโก้ค่าเริ่มต้น (ดอกทานตะวัน)'}
                  </span>
                </div>
                
                <!-- Direct Download Options for Sunflower Logo -->
                <div class="mt-3 pt-2 border-top d-flex justify-content-center gap-2 flex-wrap">
                  <button type="button" class="btn btn-outline-warning text-dark btn-sm rounded-pill px-3 py-1 fw-semibold fs-8 shadow-xs" onclick="window.floraLogo.downloadSunflowerPng(1024)">
                    <i class="bi bi-download me-1"></i> โหลดทานตะวัน (PNG คมชัดสูง)
                  </button>
                  <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1 fw-semibold fs-8 shadow-xs" onclick="window.floraLogo.downloadSunflowerSvg()">
                    <i class="bi bi-file-earmark-code me-1"></i> โหลดทานตะวัน (SVG เวกเตอร์)
                  </button>
                </div>
              </div>

              <!-- Upload Drag & Drop Area -->
              <div class="upload-dropzone border border-2 border-dashed rounded-4 p-3 bg-white mb-3" 
                   id="logoModalDropzone"
                   onclick="document.getElementById('logoFileInput').click()"
                   style="cursor: pointer; transition: all 0.2s ease;">
                <input type="file" id="logoFileInput" accept="image/png,image/jpeg,image/svg+xml,image/webp" class="d-none" onchange="window.handleLogoFileSelect(event)">
                <i class="bi bi-cloud-arrow-up-fill text-warning display-6 mb-1 d-block"></i>
                <div class="fw-bold fs-7 text-dark">คลิกเพื่อเลือกไฟล์รูปภาพ หรือลากรูปมาวางที่นี่</div>
                <small class="text-muted fs-8 d-block mt-0.5">รองรับไฟล์ PNG, JPG, SVG, WebP (ระบบจะอัปโหลดไปยัง Firebase Storage อัตโนมัติ)</small>
              </div>

              <!-- Helper notice -->
              <div class="alert alert-warning-subtle text-start p-2.5 rounded-3 fs-8 text-dark mb-0 d-flex gap-2">
                <i class="bi bi-info-circle-fill text-warning fs-6 flex-shrink-0 mt-0.5"></i>
                <div>
                  เมื่อกด <b>"บันทึกโลโก้"</b> รูปจะถูกบันทึกลง Firebase Storage และ Firestore เพื่อให้แสดงตรงกันทุกหน้าจอทันที
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="modal-footer bg-light py-2.5 px-4 d-flex justify-content-between flex-wrap gap-2">
              <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1.5 fw-semibold" onclick="window.handleResetLogoToDefault()">
                <i class="bi bi-arrow-counterclockwise me-1"></i> ใช้ดอกทานตะวัน (Default)
              </button>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-light btn-sm rounded-pill px-3 py-1.5 fw-semibold border" data-bs-dismiss="modal">
                  ปิด
                </button>
                <button type="button" id="btnSaveModalLogo" class="btn btn-warning btn-sm rounded-pill px-4 py-1.5 fw-bold shadow-sm" onclick="window.handleSaveModalLogo()">
                  <i class="bi bi-check-circle-fill me-1"></i> บันทึกโลโก้
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const modalEl = document.getElementById("globalLogoModal");
    if (!modalEl) return;

    // Listen to hidden event to cleanup safely after Bootstrap finishes transition
    modalEl.addEventListener("hidden.bs.modal", function() {
      cleanupModalArtifacts();
      const inst = window.bootstrap?.Modal?.getInstance(modalEl);
      if (inst) {
        try { inst.dispose(); } catch (e) {}
      }
      if (host) {
        host.innerHTML = "";
      }
    }, { once: true });

    let shownViaBootstrap = false;
    if (window.bootstrap && window.bootstrap.Modal) {
      try {
        const bsModal = new window.bootstrap.Modal(modalEl, {
          backdrop: true,
          keyboard: true
        });
        bsModal.show();
        shownViaBootstrap = true;
      } catch (e) {
        shownViaBootstrap = false;
      }
    }

    if (!shownViaBootstrap) {
      modalEl.classList.add("show");
      modalEl.style.display = "block";
      modalEl.style.position = "fixed";
      modalEl.style.top = "0";
      modalEl.style.left = "0";
      modalEl.style.width = "100vw";
      modalEl.style.height = "100vh";
      modalEl.style.overflowY = "auto";
      modalEl.style.backgroundColor = "rgba(15, 23, 42, 0.65)";
      document.body.classList.add("modal-open");
    }

    const dropzone = document.getElementById("logoModalDropzone");
    if (dropzone) {
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("border-warning", "bg-warning-subtle");
      });
      dropzone.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dropzone.classList.remove("border-warning", "bg-warning-subtle");
      });
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("border-warning", "bg-warning-subtle");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          processLogoFile(e.dataTransfer.files[0]);
        }
      });
    }
  }

  function processLogoFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      alert("⚠️ กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (PNG, JPG, SVG, WebP)");
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const rawDataUrl = e.target.result;
      pendingLogoDataUrl = rawDataUrl;
      updateModalPreview(rawDataUrl, true);
    };
    reader.readAsDataURL(file);
  }

  function updateModalPreview(imgUrl, isCustom) {
    const previewHost = document.getElementById("logoModalPreviewHost");
    const badge = document.getElementById("modalLogoStatusBadge");
    
    if (previewHost) {
      if (isCustom && imgUrl) {
        previewHost.innerHTML = `<img src="${escapeAttribute(imgUrl)}" id="modalPreviewImg" alt="Preview Logo" class="rounded-circle shadow-sm" style="width: 100px; height: 100px; object-fit: contain; background: #ffffff; padding: 4px; border: 2px solid #ffd54f;">`;
      } else {
        previewHost.innerHTML = getSunflowerSvg(100, "modal-preview-sunflower");
      }
    }

    if (badge) {
      if (isCustom) {
        badge.className = "badge bg-success text-white px-3 py-1.5 rounded-pill fs-8 fw-semibold";
        badge.innerHTML = "✓ เลือกภาพใหม่แล้ว (กดบันทึกเพื่อใช้งาน)";
      } else {
        badge.className = "badge bg-warning text-dark px-3 py-1.5 rounded-pill fs-8 fw-semibold";
        badge.innerHTML = "🌻 ค่าเริ่มต้น (ดอกทานตะวัน)";
      }
    }
  }

  window.handleLogoFileSelect = function(e) {
    if (e.target && e.target.files && e.target.files[0]) {
      processLogoFile(e.target.files[0]);
    }
  };

  window.handleResetLogoToDefault = function() {
    pendingLogoDataUrl = "RESET_TO_DEFAULT";
    updateModalPreview(null, false);
  };

  window.handleSaveModalLogo = async function() {
    const btn = document.getElementById("btnSaveModalLogo");
    const originalHtml = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> กำลังบันทึกลง Firebase...`;
    }

    try {
      if (pendingLogoDataUrl === "RESET_TO_DEFAULT") {
        await resetGlobalLogo();
      } else if (pendingLogoDataUrl) {
        await setGlobalLogo(pendingLogoDataUrl);
      }

      closeGlobalLogoModal();
      updateAllRenderedLogos();
    } catch (e) {
      console.error("Error saving logo:", e);
      alert("⚠️ เกิดข้อผิดพลาดขณะบันทึกโลโก้: " + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
      pendingLogoDataUrl = null;
    }
  };

  // Direct Download Utilities
  function downloadSunflowerSvg() {
    try {
      const svgContent = getSunflowerSvg(800);
      const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "flora-garden-sunflower-logo.svg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error downloading SVG:", e);
    }
  }

  function downloadSunflowerPng(targetSize = 1024) {
    try {
      const svgContent = getSunflowerSvg(targetSize);
      const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement("canvas");
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, targetSize, targetSize);
        ctx.drawImage(img, 0, 0, targetSize, targetSize);
        
        canvas.toBlob(function(pngBlob) {
          if (!pngBlob) return;
          const pngUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement("a");
          a.href = pngUrl;
          a.download = `flora-garden-sunflower-logo-${targetSize}x${targetSize}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(pngUrl);
          URL.revokeObjectURL(url);
        }, "image/png");
      };
      img.src = url;
    } catch (e) {
      console.error("Error downloading PNG:", e);
    }
  }

  // Observers & Listeners
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) updateAllRenderedLogos();
  });

  window.addEventListener(LOGO_CHANGED_EVENT, () => {
    updateAllRenderedLogos();
  });

  window.addEventListener("DOMContentLoaded", updateAllRenderedLogos);
  window.addEventListener("load", updateAllRenderedLogos);

  try {
    const dynamicDomObserver = new MutationObserver((mutations) => {
      let hasLogoElements = false;
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              if (node.hasAttribute?.("data-flora-logo") || node.classList?.contains("poster-corner-badge") || node.querySelector?.("[data-flora-logo], .poster-corner-badge")) {
                hasLogoElements = true;
                break;
              }
            }
          }
        }
        if (hasLogoElements) break;
      }
      if (hasLogoElements) updateAllRenderedLogos();
    });

    if (document.body) {
      dynamicDomObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      window.addEventListener("DOMContentLoaded", () => {
        if (document.body) dynamicDomObserver.observe(document.body, { childList: true, subtree: true });
      });
    }
  } catch (e) {}

  setTimeout(updateAllRenderedLogos, 100);
  setTimeout(updateAllRenderedLogos, 600);
  setTimeout(updateAllRenderedTitles, 100);
  setTimeout(updateAllRenderedTitles, 600);

  window.addEventListener("flora-project-title-changed", (e) => {
    if (e.detail && e.detail.title) updateAllRenderedTitles(e.detail.title);
  });

  window.addEventListener("flora-project-note-changed", (e) => {
    if (e.detail && typeof e.detail.note === "string") updateAllRenderedNotes(e.detail.note);
  });

  window.addEventListener("flora-org-tree-changed", (e) => {
    if (e.detail?.tree) {
      if (e.detail.tree.name) updateAllRenderedTitles(e.detail.tree.name);
      if (typeof e.detail.tree.note === "string") updateAllRenderedNotes(e.detail.tree.note);
    }
  });

  window.addEventListener("storage", (e) => {
    if (e.key && (e.key.includes("flora_global_project_title") || e.key.includes("flora_org_tree_v2"))) {
      updateAllRenderedTitles(getGlobalProjectTitle());
    }
    if (e.key && (e.key.includes("flora_global_project_note") || e.key.includes("flora_org_tree_v2"))) {
      updateAllRenderedNotes(getGlobalProjectNote());
    }
    if (e.key && e.key.includes("flora_global_logo")) {
      updateAllRenderedLogos();
    }
  });

  // Export Public API
  window.floraLogo = {
    getGlobalLogo,
    setGlobalLogo,
    resetGlobalLogo,
    getSunflowerSvg,
    getSunflowerDataUrl,
    downloadSunflowerSvg,
    downloadSunflowerPng,
    renderLogoHtml,
    updateAllRenderedLogos,
    updateAllRenderedTitles,
    updateAllRenderedNotes,
    getGlobalProjectTitle,
    setGlobalProjectTitle,
    getGlobalProjectNote,
    setGlobalProjectNote,
    openGlobalLogoModal,
    closeModal: closeGlobalLogoModal,
    connectGlobalLogoFirestore,
    handleLogoImageError
  };

  window.openGlobalLogoModal = openGlobalLogoModal;
  window.closeGlobalLogoModal = closeGlobalLogoModal;
  window.getFloraGlobalLogo = getGlobalLogo;
  window.renderFloraLogoBadge = renderLogoHtml;
  window.getFloraProjectTitle = getGlobalProjectTitle;
  window.setFloraProjectTitle = setGlobalProjectTitle;
  window.getFloraProjectNote = getGlobalProjectNote;
  window.setFloraProjectNote = setGlobalProjectNote;
  window.updateAllFloraTitles = updateAllRenderedTitles;
  window.updateAllFloraNotes = updateAllRenderedNotes;
})();
