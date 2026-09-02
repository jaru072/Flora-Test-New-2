(function () {
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

  const BASE_STORAGE_KEY = "flora_org_tree_v2";
  const BASE_PROJECT_TITLE_KEY = "flora_global_project_title";
  const BASE_PROJECT_NOTE_KEY = "flora_global_project_note";
  const FORMAT = "flora-org-tree";
  const KIND_LABELS = {
    project: "👑 ชื่อหลักของระบบ (Master Organization Name)",
    position: "ตำแหน่งบริหาร",
    supervision: "สายกำกับ",
    division: "ส่วนงานหลัก",
    department: "หน่วยงานย่อย",
    role: "ตำแหน่งปฏิบัติงาน"
  };
  const VALID_KINDS = new Set(Object.keys(KIND_LABELS));
  const n = (id, code, name, kind, children = [], note = "") => ({ id, code, name, kind, children, ...(note ? { note } : {}) });
  const dept = (id, code, name, leader, worker) => n(id, code, name, "department", [leader, worker]);

  const seedTree = n("org-root", "ORG-ROOT", "โครงการรัตนบุปผา และผลิตดอกไม้ธรรมยาตรา", "project", [
    n("pos-1", "1", "ประธานโครงการ", "position", [
      n("pos-2", "2", "ที่ปรึกษาโครงการ", "position", [], "รองรับ 2 ตำแหน่งตามผังเดิม"),
      n("pos-3", "3", "ผู้ประสานงานโครงการ", "position", [
        n("division-1", "1", "งานส่วนกลาง", "division", [
          n("pos-4-1", "4.1", "หัวหน้างานส่วนกลาง", "position"),
          dept("dept-1-1", "1.1", "งานธุรการ / งานบุคคล", n("pos-5-1", "5.1", "หัวหน้างานธุรการ / งานบุคคล", "role"), n("pos-6-1", "6.1", "เจ้าหน้าที่ธุรการ", "role")),
          dept("dept-1-2", "1.2", "งานสวัสดิการ", n("pos-5-2", "5.2", "หัวหน้างานสวัสดิการ", "role"), n("pos-6-2", "6.2", "พนักงานสวัสดิการ", "role")),
          dept("dept-1-3-water", "1.3", "งานระบบน้ำ", n("pos-5-3", "5.3", "หัวหน้างานระบบน้ำ", "role"), n("pos-6-3", "6.3", "พนักงานดูแลระบบน้ำ", "role")),
          dept("dept-1-3-grass", "1.4", "งานตัดหญ้า", n("pos-5-3-1", "5.3.1", "หัวหน้างานตัดหญ้า", "role"), n("pos-6-4", "6.4", "พนักงานตัดหญ้า", "role"))
        ]),
        n("academic", "4.5", "สายวิชาการและเทคนิคการผลิต", "supervision", [
          n("pos-academic", "4.5.1", "นักวิชาการ", "role"),
          n("division-2", "2", "งานกุหลาบ / งานทดลอง", "division", [
            n("pos-4-2", "4.2", "หัวหน้างานกุหลาบ/งานทดลอง", "position"),
            dept("dept-2-1", "2.1", "งานทดลอง", n("pos-5-4", "5.4", "หัวหน้างานทดลอง", "role"), n("pos-6-5", "6.5", "พนักงานงานทดลอง", "role")),
            dept("dept-2-2", "2.2", "งานกุหลาบ", n("pos-5-5", "5.5", "หัวหน้างานกุหลาบ", "role"), n("pos-6-6", "6.6", "พนักงานดูแลกุหลาบ", "role"))
          ]),
          n("division-3", "3", "งานรัตนบุปผา", "division", [
            n("pos-4-3", "4.3", "หัวหน้างานรัตนบุปผา", "position"),
            dept("dept-3-1", "3.1", "งานเจดีย์", n("pos-5-6", "5.6", "หัวหน้างานเจดีย์", "role"), n("pos-6-7", "6.7", "พนักงานงานเจดีย์", "role")),
            dept("dept-3-2", "3.2", "งานวิหารหลวงปู่", n("pos-5-7", "5.7", "หัวหน้างานวิหารหลวงปู่", "role"), n("pos-6-8", "6.8", "พนักงานงานวิหารหลวงปู่", "role")),
            dept("dept-3-3", "3.3", "งานถนนธรรมชัย / เฟื่องฟ้า", n("pos-5-8", "5.8", "หัวหน้างานถนนธรรมชัย / เฟื่องฟ้า", "role"), n("pos-6-9", "6.9", "พนักงานดูแลถนนธรรมชัย", "role")),
            dept("dept-3-4", "3.4", "งานผสมแกลบ / งานโต๊ะกลาง", n("pos-5-9", "5.9", "หัวหน้างานผสมแกลบ / โต๊ะกลาง", "role"), n("pos-6-10", "6.10", "พนักงานผสมแกลบ", "role"))
          ]),
          n("division-4", "4", "งานธรรมยาตรา", "division", [
            n("pos-4-4", "4.4", "หัวหน้างานธรรมยาตรา", "position"),
            dept("dept-4-1", "4.1", "แปลง A / B", n("pos-5-10", "5.10", "หัวหน้างานแปลง A / B", "role"), n("pos-6-11", "6.11", "พนักงานดูแลแปลง A/B", "role")),
            dept("dept-4-2", "4.2", "แปลง E / P11", n("pos-5-11", "5.11", "หัวหน้างานแปลง E / P11", "role"), n("pos-6-12", "6.12", "พนักงานดูแลแปลง E/P11", "role")),
            dept("dept-4-3", "4.3", "งานไม้กระถางหลังวิหารคด 13–20", n("pos-5-12", "5.12", "หัวหน้างานไม้กระถางหลังวิหารคด 13–20", "role"), n("pos-6-13", "6.13", "พนักงานดูแลไม้กระถาง", "role"))
          ])
        ], "กำกับส่วนงาน 2, 3 และ 4 ตามผังเดิม")
      ])
    ])
  ], "แหล่งข้อมูลโครงสร้างหลักของ Tree และ Interactive Org Chart");

  let tree = clone(seedTree);
  let selectedId = "org-root";
  let query = "";
  let expanded = new Set(["org-root", "pos-1", "pos-3", "academic"]);
  let modalState = null;
  let showAdminCodes = false;
  let firestoreBridge = null;
  let applyingRemote = false;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c])); }
  function normalize(value) { return String(value || "").replace(/^\s*\d+(?:\.\d+)*\s*/, "").replace(/[–-]/g, "-").replace(/\s+/g, " ").trim().toLocaleLowerCase("th"); }
  function display(node) { return node.code === "ORG-ROOT" ? node.name : `${node.code} ${node.name}`.trim(); }
  function flatten(node = tree, parent = null, depth = 0, ancestors = []) {
    const row = { node, parent, depth, ancestors };
    return [row, ...(node.children || []).flatMap(child => flatten(child, node, depth + 1, [...ancestors, node]))];
  }
  function findNode(id) { return flatten().find(row => row.node.id === id)?.node || null; }
  function findRow(id) { return flatten().find(row => row.node.id === id) || null; }
  function getOrphanedEmployees(nextTree) {
    const ids = new Set(["executive-admin"]);
    const visit = node => { ids.add(node.id); (node.children || []).forEach(visit); };
    visit(nextTree);
    return (window.employees || []).filter(emp => {
      const anchorId = emp.positionNodeId || emp.departmentNodeId || "";
      return anchorId && !ids.has(anchorId);
    });
  }
  function replaceNode(root, id, updater) {
    if (root.id === id) return updater(root);
    return { ...root, children: (root.children || []).map(child => replaceNode(child, id, updater)) };
  }
  function removeNode(root, id) { return { ...root, children: (root.children || []).filter(child => child.id !== id).map(child => removeNode(child, id)) }; }
  function validateTree(value) {
    const ids = new Set(); let count = 0;
    const visit = (input, depth) => {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("พบโหนดที่ไม่ถูกต้อง");
      if (depth > 30) throw new Error("โครงสร้างลึกเกิน 30 ระดับ");
      const { id, code, name, kind, note, children } = input;
      if (typeof id !== "string" || !/^[A-Za-z0-9._:-]+$/.test(id)) throw new Error("รหัส id ของบางโหนดไม่ถูกต้อง");
      if (ids.has(id)) throw new Error(`รหัสโหนดซ้ำ: ${id}`); ids.add(id);
      if (typeof code !== "string" || !code.trim()) throw new Error(`โหนด ${id} ไม่มีเลข/รหัส`);
      if (typeof name !== "string" || !name.trim()) throw new Error(`โหนด ${id} ไม่มีชื่อ`);
      if (!VALID_KINDS.has(kind)) throw new Error(`ประเภทของโหนด ${id} ไม่ถูกต้อง`);
      if (note !== undefined && typeof note !== "string") throw new Error(`หมายเหตุของโหนด ${id} ไม่ถูกต้อง`);
      if (children !== undefined && !Array.isArray(children)) throw new Error(`โหนดย่อยของ ${id} ไม่ถูกต้อง`);
      if (++count > 5000) throw new Error("มีโหนดเกิน 5,000 รายการ");
      return { id, code: code.trim(), name: name.trim(), kind, ...(note ? { note } : {}), children: (children || []).map(child => visit(child, depth + 1)) };
    };
    return visit(value, 0);
  }

  function syncMasterTitleToStorageAndDom(title, note) {
    const cleanTitle = String(title || (tree?.name) || "โครงการรัตนบุปผา และผลิตดอกไม้ธรรมยาตรา").trim();
    const cleanNote = String(note !== undefined ? note : (tree?.note || "")).trim();
    try {
      localStorage.setItem(getScopedKey(BASE_PROJECT_TITLE_KEY), cleanTitle);
      localStorage.setItem(BASE_PROJECT_TITLE_KEY, cleanTitle);
      localStorage.setItem(getScopedKey(BASE_PROJECT_NOTE_KEY), cleanNote);
      localStorage.setItem(BASE_PROJECT_NOTE_KEY, cleanNote);
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent("flora-project-title-changed", { detail: { title: cleanTitle, note: cleanNote } }));
      window.dispatchEvent(new CustomEvent("flora-project-note-changed", { detail: { note: cleanNote, title: cleanTitle } }));
    } catch (e) {}
    if (typeof window.updateAllFloraTitles === "function") {
      window.updateAllFloraTitles(cleanTitle);
    } else {
      document.querySelectorAll('[data-flora-project-title], .brand-master-title, .app-master-title').forEach(el => {
        if (el) el.textContent = cleanTitle;
      });
      const subTitleEl = document.getElementById('orgProjectHeaderSubtitle');
      if (subTitleEl) subTitleEl.textContent = cleanTitle;
      const bannerTitleEl = document.querySelector('.banner-title');
      if (bannerTitleEl) bannerTitleEl.textContent = cleanTitle;
    }
    if (typeof window.updateAllFloraNotes === "function") {
      window.updateAllFloraNotes(cleanNote);
    } else {
      const bannerNoteEl = document.getElementById('slot-node1-note');
      if (bannerNoteEl) {
        if (cleanNote) {
          bannerNoteEl.innerHTML = `<i class="bi bi-info-circle me-1 opacity-75 fs-8"></i>${esc(cleanNote)}`;
          bannerNoteEl.style.display = 'flex';
        } else {
          bannerNoteEl.innerHTML = '';
          bannerNoteEl.style.display = 'none';
        }
      }
    }
  }

  function loadLocal() {
    try {
      const scopedKey = getScopedKey(BASE_STORAGE_KEY);
      let saved = localStorage.getItem(scopedKey);
      if (!saved) saved = localStorage.getItem(BASE_STORAGE_KEY);
      if (saved) tree = validateTree(JSON.parse(saved));
    } catch (error) { console.warn("Tree local data reset:", error); tree = clone(seedTree); }
    selectedId = tree.id;
    syncMasterTitleToStorageAndDom(tree.name, tree.note);
  }
  function persistLocal() { 
    localStorage.setItem(getScopedKey(BASE_STORAGE_KEY), JSON.stringify(tree)); 
    syncMasterTitleToStorageAndDom(tree.name, tree.note);
  }
  function syncDerivedLists() {
    const rows = flatten();
    window.positionsList = rows.filter(({node}) => ["position","role","supervision"].includes(node.kind)).map(({node}, index) => {
      let category = "worker";
      if (["pos-1","pos-2","pos-3"].includes(node.id)) category = "executive";
      else if (node.kind === "supervision" || node.id === "pos-academic") category = "academic";
      else if (node.kind === "position") category = "section_head";
      else if (String(node.code).startsWith("5") || node.name.includes("หัวหน้า")) category = "team_leader";
      else if (node.name.includes("เจ้าหน้าที่")) category = "staff";
      return { id: node.id, name: node.name, category, order: index + 1, nodeId: node.id };
    });
    window.departmentsList = getDepartments().map(item => ({ id: item.id, name: item.label, nodeId: item.id }));
  }
  function reconcileEmployeesFromTree(persist = true) {
    let changedCount = 0;
    for (const emp of (window.employees || [])) {
      const resolvedNodeId = resolveEmployeeNode(emp);
      const assignment = resolvedNodeId ? assignmentFor(resolvedNodeId) : null;
      if (!assignment) continue;

      const nextPosition = assignment.positionNodeId ? assignment.position : (emp.position || assignment.position);
      const changed = emp.department !== assignment.department ||
        emp.departmentNodeId !== assignment.departmentNodeId ||
        (assignment.positionNodeId && emp.position !== nextPosition) ||
        emp.positionNodeId !== assignment.positionNodeId;

      if (!changed) continue;
      emp.department = assignment.department;
      emp.departmentNodeId = assignment.departmentNodeId;
      emp.position = nextPosition;
      emp.positionNodeId = assignment.positionNodeId;
      emp.updatedAt = new Date().toISOString();
      changedCount += 1;
      if (persist && typeof window.persistEmployeeChanges === "function") {
        window.persistEmployeeChanges(emp);
      }
    }
    return changedCount;
  }
  function dispatchChange(origin = "local") {
    persistLocal(); syncDerivedLists(); reconcileEmployeesFromTree(true); renderManager();
    syncMasterTitleToStorageAndDom(tree.name, tree.note);
    window.dispatchEvent(new CustomEvent("flora-org-tree-changed", { detail: { origin, tree: clone(tree) } }));
    if (origin !== "remote" && firestoreBridge) firestoreBridge.write(tree);
    if (origin !== "remote") window.logPersonnelAudit?.("แก้ไขโครงสร้าง Tree", { rootId: tree.id, rootName: tree.name });
  }

  function getDepartments() {
    const result = flatten().filter(({node}) => ["division","department"].includes(node.kind)).map(({node}) => ({ id: node.id, code: node.code, name: node.name, label: node.name, kind:node.kind }));
    result.push({ id:"academic", code:"4.5", name:"งานวิชาการ", label:"งานวิชาการ", kind:"special" });
    result.push({ id:"executive-admin", code:"", name:"ฝ่ายบริหารและอำนวยการ", label:"ฝ่ายบริหารและอำนวยการ", kind:"special" });
    return result;
  }
  function assignmentFor(nodeId) {
    const row = findRow(nodeId); if (!row) return null;
    const { node, ancestors } = row;
    const chain = [...ancestors, node];
    const deptNode = [...chain].reverse().find(item => item.kind === "department");
    const divisionNode = [...chain].reverse().find(item => item.kind === "division");
    const inAcademic = chain.some(item => item.id === "academic");
    let department = deptNode ? display(deptNode) : divisionNode ? display(divisionNode) : inAcademic ? "งานวิชาการ" : "ฝ่ายบริหารและอำนวยการ";
    if (node.id === "academic" || node.id === "pos-academic") department = "งานวิชาการ";
    return {
      department,
      departmentNodeId: deptNode?.id || (inAcademic ? "academic" : divisionNode?.id || "executive-admin"),
      position: ["position","role","supervision"].includes(node.kind) ? node.name : "พนักงาน",
      positionNodeId: ["position","role","supervision"].includes(node.kind) ? node.id : ""
    };
  }
  function getQuickAssignGroups() {
    const groups = new Map();
    const add = (groupLabel, node) => {
      const assignment = assignmentFor(node.id);
      if (!assignment) return;
      if (!groups.has(groupLabel)) groups.set(groupLabel, []);
      const positionLabel = assignment.positionNodeId ? node.name : "พนักงาน";
      const departmentNode = findNode(assignment.departmentNodeId);
      const departmentLabel = departmentNode?.name || assignment.department;
      groups.get(groupLabel).push({
        nodeId: node.id,
        department: assignment.department,
        departmentNodeId: assignment.departmentNodeId,
        position: assignment.position,
        positionNodeId: assignment.positionNodeId,
        label: `${departmentLabel} — ${positionLabel}`
      });
    };

    for (const row of flatten()) {
      const { node, ancestors } = row;
      if (node.id === tree.id || node.id === "academic") continue;
      if (!["division", "department", "position", "role"].includes(node.kind)) continue;
      const chain = [...ancestors, node];
      const divisionNode = [...chain].reverse().find(item => item.kind === "division");
      const inAcademic = chain.some(item => item.id === "academic");
      const groupLabel = divisionNode ? divisionNode.name : (inAcademic ? "สายวิชาการและเทคนิคการผลิต" : "ฝ่ายบริหารและอำนวยการ");
      add(groupLabel, node);
    }

    return Array.from(groups, ([label, options]) => ({ label, options }));
  }
  function resolveEmployeeNode(emp) {
    if (!emp) return null;
    if (emp.positionNodeId && findNode(emp.positionNodeId)) return emp.positionNodeId;
    const positionMatch = flatten().find(({node}) => ["position","role","supervision"].includes(node.kind) && (normalize(emp.position) === normalize(node.name) || normalize(emp.position) === normalize(display(node))));
    if (positionMatch) return positionMatch.node.id;
    if (emp.departmentNodeId && findNode(emp.departmentNodeId)) return emp.departmentNodeId;
    const deptMatch = flatten().find(({node}) => ["department","division"].includes(node.kind) && (normalize(emp.department) === normalize(node.name) || normalize(emp.department) === normalize(display(node))));
    if (deptMatch) return deptMatch.node.id;
    if (normalize(emp.department).includes("วิชาการ")) return "academic";
    // An executive department alone does not identify a specific executive
    // position. Never fall back to the president node without an exact
    // position label or a valid positionNodeId.
    return null;
  }

  function renderManager() {
    const root = document.getElementById("treeManagerRoot"); if (!root) return;
    const rows = flatten();
    if (!findNode(selectedId)) selectedId = tree.id;
    if (query) {
      rows.forEach(row => {
        const hay = `${row.node.code} ${row.node.name} ${row.node.note || ""}`.toLocaleLowerCase("th");
        if (hay.includes(query.toLocaleLowerCase("th"))) row.ancestors.forEach(a => expanded.add(a.id));
      });
    }
    const selected = findRow(selectedId) || rows[0];
    const departments = rows.filter(r => r.node.kind === "department").length;
    const positions = rows.filter(r => ["position","role"].includes(r.node.kind)).length;
    root.innerHTML = `
      <div class="tree-manager-shell ${showAdminCodes ? "tree-codes-visible" : ""}">
        <div class="tree-toolbar">
          <label class="tree-search"><i class="bi bi-search"></i><input id="treeSearchInput" value="${esc(query)}" oninput="floraTreeSearch(this.value)" placeholder="ค้นหาชื่อหน่วยงานหรือตำแหน่ง..."></label>
          <div class="tree-toolbar-actions">
            <button class="tree-warning" onclick="openGlobalLogoModal()" title="จัดการโลโก้องค์กร / โครงการ (ซิงค์ตรงกันทุกจุด)"><i class="bi bi-flower1 me-1"></i>เปลี่ยนโลโก้องค์กร</button>
            <button onclick="floraTreeExpandAll()"><i class="bi bi-arrows-expand me-1"></i>ขยายทั้งหมด</button>
            <button onclick="floraTreeCollapseAll()"><i class="bi bi-arrows-collapse me-1"></i>ยุบทั้งหมด</button>
            <button onclick="floraTreeToggleCodes()"><i class="bi bi-${showAdminCodes ? "eye-slash" : "eye"} me-1"></i>${showAdminCodes ? "ซ่อนรหัส" : "แสดงรหัส"}</button>
            <button onclick="floraTreeExport()"><i class="bi bi-download me-1"></i>นำออก JSON</button>
            <button onclick="document.getElementById('floraTreeImportInput').click()"><i class="bi bi-upload me-1"></i>นำเข้า JSON</button>
            <input id="floraTreeImportInput" class="tree-hidden-input" type="file" accept=".json,application/json" onchange="floraTreeImport(event)">
            <button class="tree-danger" onclick="floraTreeReset()"><i class="bi bi-arrow-counterclockwise me-1"></i>คืนค่าเริ่มต้น</button>
          </div>
        </div>
        <div class="tree-summary"><div><strong>${rows.length}</strong><span>โหนดทั้งหมด</span></div><div><strong>${rows.filter(r=>r.node.kind==="division").length}</strong><span>ส่วนงานหลัก</span></div><div><strong>${departments}</strong><span>หน่วยงานย่อย</span></div><div><strong>${positions}</strong><span>ตำแหน่งงาน</span></div></div>
        <div class="tree-layout">
          <section class="tree-workspace">
            <div class="tree-workspace-head"><div><h5>จัดการโครงสร้างองค์กร</h5><small class="bg-transparent border-0 p-0">เพิ่ม แก้ไข หรือลบจาก Tree เพียงจุดเดียว</small></div><small><i class="bi bi-cloud-check me-1"></i>ใช้ร่วมกับผังบุคลากร</small></div>
            <div class="tree-scroll-area"><ul class="flora-tree-list">${renderManagerNode(tree)}</ul></div>
          </section>
          <aside class="tree-details">
            <span class="tree-detail-code">${esc(selected.node.code)}</span><p class="mt-2 mb-0 fw-bold text-success">${esc(KIND_LABELS[selected.node.kind])}</p><h5>${esc(selected.node.name)}</h5><p>${esc(selected.node.note || "ไม่มีหมายเหตุ")}</p>
            <dl class="tree-detail-list"><div class="tree-admin-code-field"><dt>รหัสถาวร</dt><dd>${esc(selected.node.id)}</dd></div><div><dt>ระดับ</dt><dd>${selected.depth}</dd></div><div><dt>โหนดแม่</dt><dd>${esc(selected.parent?.name || "ไม่มี — จุดเริ่มต้น")}</dd></div><div><dt>โหนดย่อย</dt><dd>${selected.node.children?.length || 0} รายการ</dd></div></dl>
            <div class="tree-detail-actions"><button class="primary" onclick="floraTreeOpenAdd('${selected.node.id}')"><i class="bi bi-plus-lg me-1"></i>เพิ่มโหนดย่อย</button><button onclick="floraTreeOpenEdit('${selected.node.id}')"><i class="bi bi-pencil me-1"></i>แก้ไขข้อมูล</button>${selected.node.id !== tree.id ? `<button class="danger" onclick="floraTreeDelete('${selected.node.id}')"><i class="bi bi-trash me-1"></i>ลบโหนดนี้</button>` : ""}</div>
          </aside>
        </div>
      </div>`;
    renderModalHost();
  }
  function renderManagerNode(node) {
    const children = node.children || []; const open = expanded.has(node.id); const selected = selectedId === node.id;
    const isRoot = node.id === tree.id;
    const matched = query && `${node.code} ${node.name} ${node.note || ""}`.toLocaleLowerCase("th").includes(query.toLocaleLowerCase("th"));
    return `<li class="flora-tree-item ${isRoot ? "flora-tree-root-item" : ""}"><div class="flora-tree-row ${isRoot ? "flora-tree-root-row" : ""}">
      <button class="flora-tree-toggle ${children.length ? "" : "leaf"}" onclick="floraTreeToggle('${node.id}')" aria-label="${children.length ? "เปิดปิดกิ่ง" : "ปลายกิ่ง"}">${children.length ? (open ? "−" : "+") : "•"}</button>
      <button class="flora-tree-card ${selected ? "selected" : ""} ${matched ? "matched" : ""} ${isRoot ? "root-node-card border-warning border-2" : ""}" onclick="floraTreeSelect('${node.id}')">
        <span class="flora-tree-code ${isRoot ? "bg-warning text-dark fw-bold" : ""}">${isRoot ? "👑 โหนด 1" : esc(node.code)}</span>
        <span class="flora-tree-copy">
          <b class="${isRoot ? "text-dark" : ""}">${esc(node.name)}</b>
          <small class="${isRoot ? "text-success fw-bold" : ""}">${isRoot ? "👑 ชื่อหลักของระบบทั้งหมด (Master Name)" : esc(KIND_LABELS[node.kind])}${children.length ? ` · ${children.length} โหนดย่อย` : ""}</small>
        </span>
      </button>
      <span class="flora-tree-actions">
        <button onclick="floraTreeOpenAdd('${node.id}')" title="เพิ่มโหนดย่อย">＋</button>
        <button onclick="floraTreeOpenEdit('${node.id}')" title="${isRoot ? "แก้ไขชื่อหลักของระบบทั้งหมด" : "แก้ไข"}">✎</button>
        ${!isRoot ? `<button class="danger" onclick="floraTreeDelete('${node.id}')" title="ลบ">⌫</button>` : ""}
      </span>
      </div>${children.length && open ? `<ul>${children.map(renderManagerNode).join("")}</ul>` : ""}</li>`;
  }
  function renderModalHost() {
    const host = document.getElementById("treeNodeModalHost"); if (!host) return;
    if (!modalState) { host.innerHTML = ""; return; }
    const editing = modalState.mode === "edit"; 
    const node = editing ? findNode(modalState.targetId) : null;
    const isRoot = editing && node?.id === tree.id;

    host.innerHTML = `<div class="tree-modal-backdrop" onclick="if(event.target===this) floraTreeCloseModal()"><form class="tree-modal-card" onsubmit="floraTreeSaveNode(event)">
      <div class="tree-modal-head">
        <div>
          <small class="text-success fw-bold">${isRoot ? "👑 โหนดที่ 1 · ศูนย์กลางชื่อระบบ" : (editing ? "แก้ไขโครงสร้าง" : "เพิ่มกิ่งใหม่")}</small>
          <h5>${isRoot ? "ปรับชื่อหลักของระบบทั้งหมด (Master Name)" : (editing ? "ปรับข้อมูลโหนด" : "สร้างโหนดย่อย")}</h5>
        </div>
        <button type="button" onclick="floraTreeCloseModal()">×</button>
      </div>

      ${isRoot ? `
        <div class="alert alert-success-subtle p-2.5 rounded-3 fs-8 text-dark mb-3 d-flex gap-2">
          <i class="bi bi-crown-fill text-warning fs-5 flex-shrink-0"></i>
          <div>
            <b>โหนดที่ 1 เป็นชื่อหลักของทุกระบบ (Master Organization Name)</b><br>
            เมื่อบันทึก ชื่อนี้จะมีผลทันทีกับ: ระบบพัสดุและอุปกรณ์, ผังโครงสร้างบุคลากร, ระบบพิมพ์บัตร/QR Code, แบบฟอร์มใบเบิกพัสดุ และเอกสารส่งออกทั้งหมด
          </div>
        </div>
      ` : ''}

      ${showAdminCodes ? `<label>เลข/รหัสโครงสร้าง<input id="treeFormCode" value="${esc(node?.code || "")}" placeholder="เช่น 1.5" required></label>` : `<input id="treeFormCode" type="hidden" value="${esc(node?.code || `AUTO-${Date.now().toString(36).toUpperCase()}`)}">${isRoot ? '' : '<div class="tree-code-note"><i class="bi bi-shield-check me-1"></i>ระบบจัดเก็บรหัสภายในให้อัตโนมัติ</div>'}`}
      
      <label>
        ${isRoot ? "ชื่อหลักของระบบ / โครงการ (Master Name)" : "ชื่อหน่วยงานหรือตำแหน่ง"}
        <input id="treeFormName" value="${esc(node?.name || "")}" placeholder="${isRoot ? 'ระบุชื่อหลักของระบบ/องค์กร' : 'ระบุชื่อหน่วยงานหรือตำแหน่ง'}" required>
      </label>

      <label>ประเภทโหนด
        ${isRoot ? `
          <select id="treeFormKind" disabled>
            <option value="project" selected>👑 ชื่อหลักของระบบ (Master Organization Name)</option>
          </select>
          <small class="text-muted">โหนดที่ 1 ถูกกำหนดเป็นชื่อหลักของระบบโดยอัตโนมัติ</small>
        ` : `
          <select id="treeFormKind" ${editing ? "disabled" : ""}>
            ${Object.entries(KIND_LABELS).filter(([kind])=>kind!=="project").map(([kind,label])=>`<option value="${kind}" ${(node?.kind || "department")===kind ? "selected" : ""}>${esc(label)}</option>`).join("")}
          </select>
          ${editing ? '<small>ประเภทโหนดถูกล็อกเพื่อป้องกันข้อมูลบุคลากรคลาดเคลื่อน</small>' : ''}
        `}
      </label>

      <label>หมายเหตุ<textarea id="treeFormNote" rows="3" placeholder="บันทึกรายละเอียดเพิ่มเติม (ถ้ามี)">${esc(node?.note || "")}</textarea></label>
      
      <div class="tree-modal-actions">
        <button type="button" onclick="floraTreeCloseModal()">ยกเลิก</button>
        <button class="primary" type="submit"><i class="bi bi-check-lg me-1"></i>${isRoot ? "บันทึกชื่อหลักของระบบ" : "บันทึกโหนด"}</button>
      </div>
    </form></div>`;
    setTimeout(() => document.getElementById(showAdminCodes ? "treeFormCode" : "treeFormName")?.focus(), 0);
  }

  window.floraTreeSelect = id => { selectedId = id; renderManager(); };
  window.floraTreeToggle = id => { const node=findNode(id); if (!node?.children?.length) return; expanded.has(id) ? expanded.delete(id) : expanded.add(id); renderManager(); };
  window.floraTreeSearch = value => { query = value.trim(); renderManager(); };
  window.floraTreeExpandAll = () => { expanded = new Set(flatten().filter(r=>r.node.children?.length).map(r=>r.node.id)); renderManager(); };
  window.floraTreeCollapseAll = () => { expanded = new Set([tree.id]); renderManager(); };
  window.floraTreeToggleCodes = () => { showAdminCodes = !showAdminCodes; renderManager(); };
  window.floraTreeOpenAdd = id => { if(window.requirePersonnelAdmin&&!window.requirePersonnelAdmin("เพิ่มโหนด Tree"))return; modalState={mode:"add",targetId:id}; selectedId=id; renderManager(); };
  window.floraTreeOpenEdit = id => { if(window.requirePersonnelAdmin&&!window.requirePersonnelAdmin("แก้ไขโหนด Tree"))return; modalState={mode:"edit",targetId:id}; selectedId=id; renderManager(); };
  window.floraTreeCloseModal = () => { modalState=null; renderModalHost(); };
  window.floraTreeSaveNode = async event => {
    event.preventDefault(); if (!modalState) return;
    if(window.requirePersonnelAdmin&&!window.requirePersonnelAdmin("บันทึกโครงสร้าง Tree"))return;
    const code=document.getElementById("treeFormCode").value.trim(), name=document.getElementById("treeFormName").value.trim(), kind=document.getElementById("treeFormKind").value, note=document.getElementById("treeFormNote").value.trim();
    if (!code || !name || !VALID_KINDS.has(kind)) return;
    if (modalState.mode === "add") {
      const newNode={id:`node-${Date.now()}`,code,name,kind,note,children:[]};
      tree=replaceNode(tree,modalState.targetId,node=>({...node,children:[...(node.children||[]),newNode]})); expanded.add(modalState.targetId); selectedId=newNode.id;
    } else {
      const old=findNode(modalState.targetId); if (!old) return;
      tree=replaceNode(tree,old.id,node=>({...node,code,name,kind,note}));
    }
    modalState=null; dispatchChange();
  };
  window.floraTreeDelete = id => {
    if(window.requirePersonnelAdmin&&!window.requirePersonnelAdmin("ลบโหนด Tree"))return;
    const node=findNode(id); if (!node || id===tree.id) return;
    if (node.children?.length) { alert(`ยังลบ “${node.name}” ไม่ได้ เพราะมีโหนดย่อย ${node.children.length} รายการ\nกรุณาย้ายหรือลบโหนดย่อยก่อน`); return; }
    const assigned=(window.employees||[]).filter(emp=>resolveEmployeeNode(emp)===id);
    if (assigned.length) { alert(`ยังลบ “${node.name}” ไม่ได้ เพราะมีบุคลากร ${assigned.length} คนอยู่ในโหนดนี้\nกรุณาไปแท็บผังบุคลากรและย้ายบุคลากรก่อน`); return; }
    if (!confirm(`ลบ “${node.name}” ออกจากโครงสร้างหรือไม่?`)) return;
    tree=removeNode(tree,id); selectedId=tree.id; dispatchChange();
  };
  window.floraTreeReset = () => {
    if(window.requirePersonnelAdmin&&!window.requirePersonnelAdmin("คืนค่า Tree"))return;
    if (!confirm("คืนค่าโครงสร้างเริ่มต้นหรือไม่? ข้อมูลบุคลากรจะไม่ถูกลบ")) return;
    const orphaned=getOrphanedEmployees(seedTree);
    if (orphaned.length) { alert(`ยังคืนค่าเริ่มต้นไม่ได้ เพราะมีบุคลากร ${orphaned.length} คนอยู่ในโหนดที่สร้างเพิ่ม\nกรุณาย้ายบุคลากรไปยังโหนดมาตรฐานก่อน`); return; }
    if (!confirm("ยืนยันอีกครั้ง: การแก้ไขโครงสร้างปัจจุบันจะถูกแทนที่")) return;
    tree=clone(seedTree); selectedId=tree.id; expanded=new Set(["org-root","pos-1","pos-3","academic"]); dispatchChange();
  };
  window.floraTreeExport = () => {
    const payload={format:FORMAT,version:2,exportedAt:new Date().toISOString(),tree};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"}); const url=URL.createObjectURL(blob); const link=document.createElement("a");
    link.href=url; link.download=`flora-org-tree-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };
  window.floraTreeImport = async event => {
    if(window.requirePersonnelAdmin&&!window.requirePersonnelAdmin("นำเข้า Tree")){event.target.value="";return;}
    const file=event.target.files?.[0]; event.target.value=""; if (!file) return;
    if (file.size>5*1024*1024) { alert("ไฟล์ใหญ่เกิน 5 MB"); return; }
    try { const parsed=JSON.parse(await file.text()); const imported=validateTree(parsed?.tree || parsed); const orphaned=getOrphanedEmployees(imported); if (orphaned.length) { alert(`ยังนำเข้าไม่ได้ เพราะจะทำให้บุคลากร ${orphaned.length} คนไม่มีโหนดอ้างอิง\nกรุณาย้ายบุคลากรหรือใช้ไฟล์ Tree ที่มี nodeId เดิม`); return; } if (!confirm(`นำเข้า “${imported.name}” และแทนที่ Tree ปัจจุบันหรือไม่?`)) return; tree=imported; selectedId=tree.id; expanded=new Set([tree.id]); dispatchChange(); alert("นำเข้าโครงสร้างสำเร็จแล้ว"); } catch(error) { alert(`นำเข้าไม่สำเร็จ: ${error.message || "ไฟล์ไม่ถูกต้อง"}`); }
  };

  function employeeCard(emp) {
    const id=esc(emp.id||emp.code), photo=String(emp.photoUrl||emp.photo||"");
    const avatar=photo ? `<img src="${esc(photo)}" alt="${esc(emp.name)}" onerror="this.style.display='none'">` : `<span class="live-person-icon"><i class="bi bi-person-fill"></i></span>`;
    return `<button type="button" class="live-person-chip" draggable="true" ondragstart="handleAvatarDragStart(event,'${id}')" ondragend="handleAvatarDragEnd(event)" onclick="handleAvatarClick(event,'${id}')" title="คลิกเพื่อแก้ไข หรือลากเพื่อย้าย">${avatar}<span><b>${esc(emp.name)}</b><small>${esc(emp.code||emp.id||"")}</small></span></button>`;
  }
  function renderLiveNode(node, assignmentMap) {
    const people=assignmentMap.get(node.id)||[];
    return `<li><div class="live-org-node" data-kind="${node.kind}"><div class="live-node-label"><span class="live-node-name"><b>${esc(node.name)}</b><small>${esc(KIND_LABELS[node.kind])}</small></span></div><div class="live-node-people" ondragover="handleSlotDragOver(event)" ondragleave="handleSlotDragLeave(event)" ondrop="handleTreeOrgDrop(event,'${node.id}')">${people.map(employeeCard).join("")}<button class="live-empty-slot" onclick="openAddModalForTreeNode('${node.id}')"><i class="bi bi-person-plus me-1"></i>${people.length ? "เพิ่มคน" : "วางหรือเพิ่มบุคลากร"}</button></div></div>${node.children?.length ? `<ul>${node.children.map(child=>renderLiveNode(child,assignmentMap)).join("")}</ul>` : ""}</li>`;
  }
  window.renderTreeBasedOrgChart = function(list, container) {
    const map=new Map(); for (const emp of list) { const id=resolveEmployeeNode(emp); if (!id) continue; if (!map.has(id)) map.set(id,[]); map.get(id).push(emp); }
    container.innerHTML=`<div class="chart-poster live-org-poster"><div class="live-org-title"><h3>ผังโครงสร้างบุคลากร</h3><p>${esc(tree.name)} · ใช้โครงสร้างชุดเดียวกับแท็บ Tree</p></div><ul class="live-org-tree">${renderLiveNode(tree,map)}</ul></div>`;
  };
  window.openAddModalForTreeNode = nodeId => { const a=assignmentFor(nodeId); if (a) window.openAddModalForSlot?.(a.department,a.position); };
  window.handleTreeOrgDrop = async function(event,nodeId) {
    if (event) {
      event.preventDefault?.(); 
      event.currentTarget?.classList?.remove("drop-target-active");
    }
    if(window.requirePersonnelAdmin&&!window.requirePersonnelAdmin("ย้ายบุคลากรในผัง"))return;
    const rawId=(event?.dataTransfer?.getData&&event.dataTransfer.getData("text/plain"))||window.draggedEmpId||window.lastDraggedEmpId;
    window.draggedEmpId = null;
    if (!rawId) return;

    const empIdStr = String(rawId);
    const emp=(window.employees||[]).find(e=>String(e.id||e.code)===empIdStr), a=assignmentFor(nodeId); 
    if (!emp||!a) return;
    if (typeof window.ensureFloraLeadershipPositionAvailable === "function" && !window.ensureFloraLeadershipPositionAvailable(empIdStr,a.positionNodeId||"",true)) return;

    // Capture snapshot before move
    const prevSnapshot = {
      id: String(emp.id || emp.code),
      code: emp.code,
      name: emp.name,
      department: emp.department || '',
      departmentNodeId: emp.departmentNodeId || '',
      position: emp.position || 'พนักงาน',
      positionNodeId: emp.positionNodeId || '',
      role: emp.role || 'WORKER'
    };

    emp.department=a.department; 
    emp.departmentNodeId=a.departmentNodeId; 
    emp.position=a.position; 
    emp.positionNodeId=a.positionNodeId;
    if (typeof window.getFloraRoleForPositionNode === "function") emp.role=window.getFloraRoleForPositionNode(emp.positionNodeId,emp.positionNodeId?emp.role:"WORKER");
    emp.updatedAt=new Date().toISOString();

    // Capture snapshot after move
    const nextSnapshot = {
      id: String(emp.id || emp.code),
      code: emp.code,
      name: emp.name,
      department: emp.department,
      departmentNodeId: emp.departmentNodeId,
      position: emp.position,
      positionNodeId: emp.positionNodeId,
      role: emp.role
    };

    // Push to Universal Undo/Redo Engine
    if (typeof window.createPersonnelMoveAction === 'function' && typeof window.pushFloraUndoAction === 'function') {
      const desc = `ย้าย [${emp.name}] ไปยัง "${a.department}"`;
      const action = window.createPersonnelMoveAction(empIdStr, prevSnapshot, nextSnapshot, desc);
      window.pushFloraUndoAction(action);
    }
    
    // Instant UI refresh
    window.orgChartDirty = true;
    if (typeof window.syncToLocalStorage === 'function') window.syncToLocalStorage();
    window.renderOrgChart?.(true); 
    window.renderUnassignedDrawer?.();
    if (typeof window.showToast === 'function') {
      window.showToast(`🎯 โยกย้าย [${emp.code || emp.id}] ${emp.name} ไปยัง "${a.department}" สำเร็จ!`);
    }

    // Persist in background
    await window.persistEmployeeChanges?.(emp);
  };
  window.getFloraOrgDepartments = getDepartments;
  window.getFloraOrgAssignment = assignmentFor;
  window.getFloraOrgQuickAssignGroups = getQuickAssignGroups;
  window.getFloraOrgNode = id => { const node=findNode(id); return node ? clone(node) : null; };
  window.getFloraOrgTree = () => clone(tree);
  window.getFloraProjectTitle = () => (tree?.name || localStorage.getItem(getScopedKey(BASE_PROJECT_TITLE_KEY)) || localStorage.getItem(BASE_PROJECT_TITLE_KEY) || "โครงการรัตนบุปผา และผลิตดอกไม้ธรรมยาตรา").trim();
  window.getFloraProjectNote = () => ((tree?.note !== undefined ? tree.note : (localStorage.getItem(getScopedKey(BASE_PROJECT_NOTE_KEY)) || localStorage.getItem(BASE_PROJECT_NOTE_KEY) || "")) || "").trim();
  window.syncFloraEmployeesToTree = (persist = true) => reconcileEmployeesFromTree(Boolean(persist));
  window.isEmployeeAssignedToFloraTree = emp => Boolean(resolveEmployeeNode(emp));
  window.resolveFloraAssignmentByLabels = (department, position) => {
    const positionRow=flatten().find(({node})=>["position","role","supervision"].includes(node.kind) && (normalize(position)===normalize(node.name) || normalize(position)===normalize(display(node))));
    if(positionRow) return assignmentFor(positionRow.node.id);
    const deptRow=flatten().find(({node})=>["department","division"].includes(node.kind) && (normalize(department)===normalize(node.name) || normalize(department)===normalize(display(node))));
    if(deptRow) return assignmentFor(deptRow.node.id);
    if(normalize(department).includes("วิชาการ")) return assignmentFor("academic");
    return {department,departmentNodeId:"",position:position||"พนักงาน",positionNodeId:""};
  };

  window.switchWorkspaceTab = function(tab) {
    const treeMode = tab === "tree";
    const directoryMode = tab === "directory";
    const attendanceMode = tab === "attendance";
    const chartMode = tab === "org";
    window.currentWorkspaceTab = tab;

    const tabOrg = document.getElementById("tabOrgChart");
    const tabDir = document.getElementById("tabPersonnelDirectory");
    const tabTree = document.getElementById("tabTreeManager");
    const tabAtt = document.getElementById("tabPersonnelAttendance");

    [tabOrg, tabDir, tabTree, tabAtt].forEach(btn => {
      if (btn) {
        btn.classList.remove("active", "bg-primary", "bg-opacity-10", "text-primary");
      }
    });

    const menuLabel = document.getElementById("currentSystemMenuLabel");

    if (chartMode) {
      tabOrg?.classList.add("active", "bg-primary", "bg-opacity-10", "text-primary");
      if (menuLabel) menuLabel.textContent = "ผังองค์กร";
    } else if (directoryMode) {
      tabDir?.classList.add("active", "bg-primary", "bg-opacity-10", "text-primary");
      if (menuLabel) menuLabel.textContent = "สารบรรณ";
    } else if (treeMode) {
      tabTree?.classList.add("active", "bg-primary", "bg-opacity-10", "text-primary");
      if (menuLabel) menuLabel.textContent = "โครงสร้าง";
    } else if (attendanceMode) {
      tabAtt?.classList.add("active", "bg-primary", "bg-opacity-10", "text-primary");
      if (menuLabel) menuLabel.textContent = "เวลา/การลา";
    }

    // Keep orgToolbar visible across tabs so users can always switch tabs using the System Menu Dropdown
    const chartElementIds = ["canvasWrapper", "zoomControls", "floatingUnassignedBtn"];
    chartElementIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (chartMode) {
          el.classList.remove("d-none");
          el.style.removeProperty("display");
        } else {
          el.classList.add("d-none");
          el.style.setProperty("display", "none", "important");
        }
      }
    });

    window.closeUnassignedDrawer?.();

    const treePanel = document.getElementById("treeManagerPanel");
    if (treePanel) {
      treePanel.classList.toggle("d-none", !treeMode);
      treePanel.style.display = treeMode ? "block" : "none";
    }

    const directoryPanel = document.getElementById("personnelDirectoryPanel");
    if (directoryPanel) {
      directoryPanel.classList.toggle("d-none", !directoryMode);
      directoryPanel.style.display = directoryMode ? "block" : "none";
    }

    const attendancePanel = document.getElementById("personnelAttendancePanel");
    if (attendancePanel) {
      attendancePanel.classList.toggle("d-none", !attendanceMode);
      attendancePanel.style.display = attendanceMode ? "block" : "none";
    }

    if (treeMode) {
      renderManager();
    } else if (attendanceMode) {
      window.renderPersonnelAttendanceControls?.();
    } else if (directoryMode) {
      window.renderPersonnelDirectory?.();
    } else {
      if (typeof window.onSwitchToOrgChart === "function") {
        window.onSwitchToOrgChart();
      } else {
        window.switchView?.("hierarchy");
      }
    }
  };
  let isTreeFirestoreListenerAttached = false;
  window.connectOrgTreeFirestore = function(api) {
    if (!api?.db || !api.doc || !api.setDoc || !api.onSnapshot) return;
    const ref = api.doc(api.db, "org_structure", "main");
    const settingsRef = api.doc(api.db, "system_settings", "general");
    firestoreBridge = {
      write: async nextTree => { 
        if (applyingRemote) return; 
        try { 
          await api.setDoc(ref, { format: FORMAT, version: 2, tree: clone(nextTree), updatedAt: new Date().toISOString() }, { merge: true }); 
          if (nextTree?.name) {
            await api.setDoc(settingsRef, { 
              organizationName: nextTree.name, 
              projectName: nextTree.name, 
              projectTitle: nextTree.name, 
              organizationNote: nextTree.note || '',
              updatedAt: new Date().toISOString() 
            }, { merge: true });
          }
        } catch(error) { console.warn("Tree Firestore save:", error); } 
      }
    };

    if (!isTreeFirestoreListenerAttached) {
      isTreeFirestoreListenerAttached = true;
      if (typeof api.getDoc === "function") {
        api.getDoc(ref).then(snapshot => {
          if (snapshot && snapshot.exists() && snapshot.data()?.tree) {
            try {
              applyingRemote = true;
              tree = validateTree(snapshot.data().tree);
              selectedId = findNode(selectedId) ? selectedId : tree.id;
              expanded.add(tree.id);
              dispatchChange("remote");
            } catch (error) {
              console.warn("Tree Firestore initial getDoc:", error);
            } finally {
              applyingRemote = false;
            }
          } else {
            firestoreBridge.write(tree);
          }
        }).catch(err => {
          console.warn("Tree Firestore initial fetch notice:", err);
          firestoreBridge.write(tree);
        });
      }

      api.onSnapshot(ref, snapshot => {
        if (snapshot && snapshot.exists() && snapshot.data()?.tree) {
          try {
            applyingRemote = true;
            tree = validateTree(snapshot.data().tree);
            selectedId = findNode(selectedId) ? selectedId : tree.id;
            expanded.add(tree.id);
            dispatchChange("remote");
          } catch(error) { console.warn("Tree Firestore data:", error); }
          finally { applyingRemote = false; }
        } else if (!snapshot.exists()) {
          firestoreBridge.write(tree);
        }
      }, error => console.warn("Tree Firestore listener:", error));
    }
  };

  window.addEventListener("flora-personnel-api-ready", () => {
    if (window.personnelApi) window.connectOrgTreeFirestore(window.personnelApi);
  });
  window.addEventListener("flora-firebase-ready", () => {
    if (window.floraFirebaseBridge) window.connectOrgTreeFirestore(window.floraFirebaseBridge);
  });

  let treeBridgeAttempts = 0;
  const treeBridgeTimer = setInterval(() => {
    treeBridgeAttempts++;
    const b = window.floraFirebaseBridge || (window.personnelApi && window.personnelApi.db ? window.personnelApi : null);
    if (b) {
      window.connectOrgTreeFirestore(b);
      clearInterval(treeBridgeTimer);
    } else if (treeBridgeAttempts > 30) {
      clearInterval(treeBridgeTimer);
    }
  }, 250);

  window.addEventListener("DOMContentLoaded", () => { loadLocal(); syncDerivedLists(); renderManager(); });
})();
