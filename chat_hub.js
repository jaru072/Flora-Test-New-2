/**
 * Centralized Chat Hub (ศูนย์การสนทนาและผู้ช่วย)
 * ระบบรวมศูนย์การสนทนา: แท็บ 1 "ผู้ช่วย" (AI & System Assistant) และ แท็บ 2 "เพื่อน" (Team / Peer Messenger)
 * โครงการรัตนบุปผา และผลิตดอกไม้ธรรมยาตรา
 */

(function() {
  "use strict";

  // ==================== THAI DATE & TIME FORMATTERS ====================
  // วัน/เดือน/ปีพุทธศักราช รูปแบบเวลา 24 ชั่วโมง ตามระเบียบข้อกำหนดเคร่งครัด
  const THAI_MONTHS_SHORT = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];

  function formatThaiDateTime(dateInput) {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) return "-";
    const day = d.getDate();
    const month = THAI_MONTHS_SHORT[d.getMonth()];
    const beYear = d.getFullYear() + 543;
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${month} ${beYear} ${hours}:${mins} น.`;
  }

  // ==================== NOTIFICATION SOUND ====================
  // 1. General broadcast message chime
  function playPleasantChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  }

  // 2. Distinct alert sound specifically for direct personal messages (เสียงเตือนที่เครื่องของบุคคลปลายทาง)
  function playDirectAlertSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") ctx.resume();

      const now = ctx.currentTime;
      // Melodic arpeggio (C5 -> E5 -> G5 -> C6) clear and noticeable
      const notes = [
        { freq: 523.25, start: 0.00, dur: 0.09 },
        { freq: 659.25, start: 0.08, dur: 0.09 },
        { freq: 783.99, start: 0.16, dur: 0.10 },
        { freq: 1046.50, start: 0.24, dur: 0.45 }
      ];

      notes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(n.freq, now + n.start);
        gain.gain.setValueAtTime(0.12, now + n.start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur);
      });
    } catch (e) {
      console.warn("Direct alert audio error:", e);
    }
  }

  // Browser tab title alert for direct messages
  let originalDocumentTitle = document.title;
  let titleAlertInterval = null;

  function triggerDirectMessageTitleAlert(senderName) {
    if (document.hasFocus && document.hasFocus() && isChatOpen && activeTab === "team") return;
    if (titleAlertInterval) clearInterval(titleAlertInterval);

    originalDocumentTitle = document.title.replace(/^🔔\s*\[ข้อความใหม่\]\s*/, "");
    let toggle = false;
    titleAlertInterval = setInterval(() => {
      toggle = !toggle;
      document.title = toggle
        ? `🔔 [ข้อความเฉพาะบุคคล] จากคุณ ${senderName || "เพื่อนร่วมงาน"}`
        : originalDocumentTitle;
    }, 1100);

    const clearAlert = () => {
      if (titleAlertInterval) {
        clearInterval(titleAlertInterval);
        titleAlertInterval = null;
      }
      document.title = originalDocumentTitle;
      window.removeEventListener("focus", clearAlert);
      document.removeEventListener("click", clearAlert);
    };

    window.addEventListener("focus", clearAlert, { once: true });
    document.addEventListener("click", clearAlert, { once: true });
  }

  // ==================== STATE MANAGEMENT ====================
  const STORAGE_KEY_TEAM_MSGS = "flora_team_chat_messages_v2";
  const STORAGE_KEY_BOT_MSGS = "flora_bot_chat_messages_v2";
  const STORAGE_KEY_USER_NAME = "flora_chat_custom_username";
  const STORAGE_KEY_USER_EMP_ID = "flora_chat_custom_emp_id";
  const STORAGE_KEY_USER_EMP_ROLE = "flora_chat_custom_emp_role";

  // Dynamic project title from Org Chart (Node 1) or Global settings
  function getChatProjectTitle() {
    if (typeof window.getFloraProjectTitle === "function") {
      try {
        const t = window.getFloraProjectTitle();
        if (t && String(t).trim()) return String(t).trim();
      } catch (e) {}
    }
    if (typeof window.getFloraOrgTree === "function") {
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

  let isChatOpen = false;
  let activeTab = "team"; // ล็อคอยู่ที่แท็บเพื่อนเสมอ
  let unreadTeamCount = 0;
  let selectedTeamTag = "ทั่วไป";
  let selectedRecipient = null; // null = ทุกคน (ทั้งองค์กร), or { id, name, department, position, photoUrl }
  let teamFilter = "all"; // "all" | "direct" | "broadcast"
  let broadcastChannel = null;
  let firestoreDb = null;
  let unsubscribeFirestore = null;
  let isFirstFirestoreLoad = true;
  let isConnectingFirestore = false;
  const pendingOutgoingMessages = [];
  let cachedOrgEmployees = [];

  // Load organization personnel for recipient targeting
  function getOrganizationEmployees() {
    let list = [];
    if (window.employees && Array.isArray(window.employees) && window.employees.length > 0) {
      list = window.employees;
    } else if (window.employeeList && Array.isArray(window.employeeList) && window.employeeList.length > 0) {
      list = window.employeeList;
    } else {
      try {
        const stored = (typeof window.getScopedLocalStorageItem === "function"
          ? window.getScopedLocalStorageItem("flora_employees")
          : null) || localStorage.getItem("flora_employees");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) list = parsed;
        }
      } catch (e) {}
    }

    if (list.length > 0) {
      cachedOrgEmployees = list.map(emp => ({
        id: emp.id || emp.code || emp.name,
        code: emp.code || "",
        name: emp.name || "ไม่ระบุชื่อ",
        department: emp.department || "ทั่วไป",
        position: emp.position || emp.role || "เจ้าหน้าที่",
        photoUrl: emp.photoUrl || emp.avatar || ""
      }));
    }
    return cachedOrgEmployees;
  }

  try {
    if (typeof BroadcastChannel !== "undefined") {
      broadcastChannel = new BroadcastChannel("flora_team_chat_broadcast");
      broadcastChannel.onmessage = (event) => {
        if (event.data?.type === "NEW_TEAM_MESSAGE") {
          handleIncomingTeamMessage(event.data.message, false);
        }
      };
    }
  } catch (e) {}

  // ==================== USER IDENTITY HELPER ====================
  function getCurrentUserIdentity() {
    let customName = "";
    let customEmpId = "";
    let customRole = "";
    try {
      customName = localStorage.getItem(STORAGE_KEY_USER_NAME) || "";
      customEmpId = localStorage.getItem(STORAGE_KEY_USER_EMP_ID) || "";
      customRole = localStorage.getItem(STORAGE_KEY_USER_EMP_ROLE) || "";
    } catch (e) {}

    const authUser = window.auth?.currentUser || window.currentAuthUser;
    const profile = window.currentUserProfile;

    let name = customName || authUser?.displayName || profile?.displayName || "";
    let email = authUser?.email || profile?.email || "";
    let role = customRole || profile?.role || window.currentUserRole || "เจ้าหน้าที่";
    let empId = customEmpId || authUser?.uid || profile?.uid || "";

    if (!name && email) {
      name = email.split("@")[0];
    }
    if (!name) {
      name = "เจ้าหน้าที่ปฏิบัติงาน";
    }

    // Auto-match employee if ID is missing
    if (!empId) {
      const emps = getOrganizationEmployees();
      const matched = emps.find(e => e.name && e.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (matched) {
        empId = matched.id;
        if (!customRole && matched.position) role = matched.position;
      } else {
        empId = "user_" + name.trim().replace(/\s+/g, "_");
      }
    }

    return {
      name: name,
      email: email,
      role: role,
      id: empId,
      employeeId: customEmpId || empId
    };
  }

  // ==================== INITIAL BOT GREETING ====================
  function getInitialAssistantMessages() {
    const projName = getChatProjectTitle();
    return [
      {
        id: "bot_init_1",
        sender: "ผู้ช่วยอัจฉริยะ",
        isAssistant: true,
        text: `สวัสดีครับ ยินดีต้อนรับสู่ระบบงาน${projName} ผมพร้อมให้ข้อมูล แนะนำการใช้งาน และตรวจสอบสถานะงานในระบบ สามารถพิมพ์คำถามหรือเลือกหัวข้อด่วนด้านล่างได้เลยครับ`,
        timestamp: new Date().toISOString(),
        quickLinks: [
          { label: "ระบบพัสดุ-อุปกรณ์", url: "index.html", icon: "bi-box-seam-fill" },
          { label: "ระบบงานบุคคล", url: "org_chart.html", icon: "bi-people-fill" },
          { label: "ระบบเงินเดือน", url: "payroll.html", icon: "bi-cash-coin" },
          { label: "ระบบจัดซื้อ-จัดจ้าง", url: "procurement.html", icon: "bi-cart-check-fill" }
        ]
      }
    ];
  }

  // ==================== DEFAULT INITIAL TEAM MESSAGES ====================
  const DEFAULT_TEAM_MESSAGES = [
    {
      id: "team_init_1",
      senderId: "system",
      senderName: "หัวหน้างานประสานงาน",
      senderRole: "ผู้ดูแลระบบ",
      text: "ยินดีต้อนรับบุคลากรทุกท่านสู่ศูนย์ข้อความประสานงาน สามารถแจ้งเรื่องด่วน ปรึกษาข้อติดขัด หรือแจ้งความประสงค์ขอเบิกพัสดุได้ที่นี่ครับ",
      tag: "ทั่วไป",
      timestamp: new Date(Date.now() - 3600000).toISOString()
    }
  ];

  function loadLocalTeamMessages() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_TEAM_MSGS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_TEAM_MESSAGES;
  }

  function saveLocalTeamMessages(messages) {
    try {
      localStorage.setItem(STORAGE_KEY_TEAM_MSGS, JSON.stringify(messages.slice(-150)));
    } catch (e) {}
  }

  function loadLocalBotMessages() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_BOT_MSGS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If only initial bot message exists, refresh it with current project name
          if (parsed.length === 1 && parsed[0].id === "bot_init_1") {
            return getInitialAssistantMessages();
          }
          return parsed;
        }
      }
    } catch (e) {}
    return getInitialAssistantMessages();
  }

  function saveLocalBotMessages(messages) {
    try {
      localStorage.setItem(STORAGE_KEY_BOT_MSGS, JSON.stringify(messages.slice(-80)));
    } catch (e) {}
  }

  let teamMessages = loadLocalTeamMessages();
  let botMessages = loadLocalBotMessages();

  // ==================== ASSISTANT KNOWLEDGE ENGINE ====================
  function generateAssistantResponse(query) {
    const q = (query || "").trim().toLowerCase();

    // 1. ตรวจสอบพัสดุและสต็อก
    if (q.includes("พัสดุ") || q.includes("อุปกรณ์") || q.includes("สต็อก") || q.includes("คงเหลือ") || q.includes("เบิก") || q.includes("ยืม") || q.includes("คืน")) {
      let liveStockInfo = "";
      if (window.equipmentList && Array.isArray(window.equipmentList) && window.equipmentList.length > 0) {
        const matching = window.equipmentList.filter(eq => 
          (eq.name && eq.name.toLowerCase().includes(q)) ||
          (eq.category && eq.category.toLowerCase().includes(q)) ||
          (eq.code && eq.code.toLowerCase().includes(q))
        );
        if (matching.length > 0) {
          liveStockInfo = `\n\n🔍 พบอุปกรณ์ที่ตรงกับคำค้นหาในคลังจำนวน ${matching.length} รายการ:\n` +
            matching.slice(0, 3).map(m => `• ${m.name} (${m.code || "-"}): คงเหลือ ${m.available ?? m.total ?? 0} หน่วย (สถานที่: ${m.location || "คลังหลัก"})`).join("\n");
        }
      }

      return {
        text: `📌 **ข้อมูลระบบพัสดุ-อุปกรณ์:**\n` +
          `• การเบิก-ยืมอุปกรณ์: ให้เลือกอุปกรณ์ในหน้าระบบพัสดุ กดปุ่ม "ทำรายการเบิก/ยืม" ระบุชื่อผู้เบิกและจำนวน จากนั้นระบบจะตัดสต็อกและบันทึกประวัติทันที\n` +
          `• การคืนอุปกรณ์: ค้นหารายการที่ถูกยืมในแถบ "ประวัติการเบิก-ยืม" แล้วกดยืนยันการคืน เพื่อปรับยอดสต็อกให้กลับมาพร้อมใช้\n` +
          `• การตรวจนับสต็อก: สามารถพิมพ์บาร์โค้ด หรือสแกนผ่านกล้องมือถือได้ที่ปุ่ม "สแกนบาร์โค้ด"` +
          liveStockInfo,
        quickLinks: [
          { label: "เปิดระบบพัสดุ-อุปกรณ์", url: "index.html", icon: "bi-box-seam-fill" }
        ]
      };
    }

    // 2. ตรวจสอบผังองค์กร และบุคลากร
    if (q.includes("บุคลากร") || q.includes("พนักงาน") || q.includes("ผัง") || q.includes("องค์กร") || q.includes("ตำแหน่ง") || q.includes("แผนก") || q.includes("สายงาน")) {
      return {
        text: `👥 **ข้อมูลระบบงานบุคคลและผังองค์กร:**\n` +
          `• ผังองค์กร: แสดงโครงสร้างสายการบังคับบัญชาแบบต้นไม้ เชื่อมโยงทุกตำแหน่งงานในโครงการอย่างเป็นระบบ\n` +
          `• สารบบบุคลากร: สามารถค้นหาข้อมูลประวัติบุคคล เบอร์โทรติดต่อ แผนก ตำแหน่งงาน และสถานะการทำงาน\n` +
          `• การเพิ่ม/แก้ไขบุคลากร: สามารถกดปุ่ม "เพิ่มบุคลากร" ในหน้าสารบบบุคลากร หรือแก้ไขผ่านกล่องข้อความข้อมูลบุคคลได้ทันที`,
        quickLinks: [
          { label: "เปิดระบบงานบุคคล", url: "org_chart.html", icon: "bi-people-fill" }
        ]
      };
    }

    // 3. ตรวจสอบระบบเงินเดือน
    if (q.includes("เงินเดือน") || q.includes("ค่าจ้าง") || q.includes("สลิป") || q.includes("เบี้ยเลี้ยง") || q.includes("ภาษี") || q.includes("ประกันสังคม") || q.includes("รอบ")) {
      return {
        text: `💰 **ข้อมูลระบบเงินเดือน:**\n` +
          `• รอบการคำนวณ: ระบบรองรับการคำนวณเงินเดือนทั้งแบบรายเดือนและรายวัน พร้อมสรุปยอดรวมทั้งโครงการ\n` +
          `• รายการได้และรายการหัก: คำนวณเบี้ยขยัน ค่าล่วงเวลา (OT) ภาษีหัก ณ ที่จ่าย และเงินสมทบประกันสังคมอย่างถูกต้องตามมาตรฐาน\n` +
          `• สลิปเงินเดือน: สามารถพิมพ์หรือบันทึกสลิปเงินเดือนรายบุคคล และส่งออกเอกสารสรุปเป็นไฟล์ตารางคำนวณได้`,
        quickLinks: [
          { label: "เปิดระบบเงินเดือน", url: "payroll.html", icon: "bi-cash-coin" }
        ]
      };
    }

    // 4. ตรวจสอบระบบจัดซื้อ-จัดจ้าง
    if (q.includes("จัดซื้อ") || q.includes("จัดจ้าง") || q.includes("ซื้อ") || q.includes("จ้าง") || q.includes("pr") || q.includes("po") || q.includes("ตรวจรับ") || q.includes("ผู้ขาย") || q.includes("คู่ค้า")) {
      return {
        text: `🛒 **ข้อมูลระบบจัดซื้อ-จัดจ้าง:**\n` +
          `• ใบขอซื้อ/ขอจ้าง: สร้างเอกสารคำขอความต้องการพัสดุ ระบุรายการ ราคาประมาณการ และผู้ขอซื้อ\n` +
          `• ใบสั่งซื้อ/สั่งจ้าง: ออกเอกสารคำสั่งซื้อส่งให้ผู้ขายหรือคู่ค้า พร้อมกำหนดเงื่อนไขการส่งมอบ\n` +
          `• การตรวจรับพัสดุ: บันทึกการรับมอบสินค้า ตรวจสอบคุณภาพ และนำเข้าสต็อกพัสดุโดยอัตโนมัติ`,
        quickLinks: [
          { label: "เปิดระบบจัดซื้อ-จัดจ้าง", url: "procurement.html", icon: "bi-cart-check-fill" }
        ]
      };
    }

    // 5. ตรวจสอบการรับสมัครงาน
    if (q.includes("สมัครงาน") || q.includes("รับสมัคร") || q.includes("ใบสมัคร") || q.includes("ผู้สมัคร")) {
      return {
        text: `📝 **ข้อมูลระบบรับสมัครงานและแบบฟอร์ม:**\n` +
          `• เปิดรับสมัครออนไลน์: มีแบบฟอร์มรับสมัครงานที่รองรับการใช้งานทั้งบนมือถือและคอมพิวเตอร์\n` +
          `• แชร์ลิงก์และคิวอาร์โค้ด: สามารถสร้างคิวอาร์โค้ดสำหรับนำไปพิมพ์โปสเตอร์ หรือคัดลอกลิงก์ส่งให้ผู้สมัครได้ทันที\n` +
          `• อนุมัติรับเข้าทำงาน: ผู้ดูแลระบบสามารถตรวจสอบรายชื่อผู้สมัคร สัมภาษณ์ และอนุมัติบรรจุเป็นพนักงานในระบบได้ทันที`,
        quickLinks: [
          { label: "เปิดระบบรับสมัครงาน", url: "job_application.html", icon: "bi-file-earmark-person-fill" }
        ]
      };
    }

    // คำตอบทั่วไป / คำแนะนำการใช้งาน
    return {
      text: `รับทราบครับ สำหรับหัวข้อ "${query}" หากต้องการให้ผมช่วยดำเนินการเรื่องใดเพิ่มเติม สามารถพิมพ์ถามได้เลยนะครับ เช่น:\n` +
        `• สอบถามสถานะหรือยอดคงเหลือของอุปกรณ์\n` +
        `• ขั้นตอนการเบิกจ่ายหรือยืมคืน\n` +
        `• การดูผังองค์กรและการติดต่อเจ้าหน้าที่\n` +
        `• ขั้นตอนการเปิดใบขอซื้อหรือการคำนวณเงินเดือน`,
      quickLinks: [
        { label: "ระบบพัสดุ-อุปกรณ์", url: "index.html", icon: "bi-box-seam-fill" },
        { label: "ระบบงานบุคคล", url: "org_chart.html", icon: "bi-people-fill" }
      ]
    };
  }

  // ==================== RENDER DOM ELEMENTS ====================
  function injectChatWidgetDOM() {
    if (document.getElementById("floraChatPanel")) return;

    // 1. Floating Trigger Button
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "floraChatFloatingBtn";
    btn.title = "ศูนย์การสนทนาและผู้ช่วย (คุยกับผู้ช่วย / คุยกับเพื่อน)";
    btn.innerHTML = `
      <div class="chat-btn-icon">
        <i class="bi bi-chat-dots-fill"></i>
      </div>
      <span class="chat-unread-badge d-none" id="floraChatUnreadBadge">0</span>
    `;
    btn.addEventListener("click", toggleChatPanel);
    document.body.appendChild(btn);

    // 2. Chat Panel Container
    const panel = document.createElement("div");
    panel.id = "floraChatPanel";
    panel.innerHTML = `
      <!-- Header -->
      <div class="flora-chat-header">
        <div class="flora-chat-header-top">
          <h4 class="flora-chat-title">
            <i class="bi bi-chat-heart-fill text-warning"></i>
            <div class="flora-chat-title-group">
              <span>ศูนย์การสนทนา</span>
              <span class="flora-chat-subtitle" id="floraChatProjectNameText">${escapeHtml(getChatProjectTitle())}</span>
            </div>
          </h4>
          <div class="flora-chat-controls">
            <button type="button" class="flora-chat-ctrl-btn" id="floraChatMinimizeBtn" title="ย่อหน้าต่าง">
              <i class="bi bi-dash-lg"></i>
            </button>
            <button type="button" class="flora-chat-ctrl-btn" id="floraChatCloseBtn" title="ปิดหน้าต่าง">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <!-- Tab Switcher Bar -->
        <div class="flora-chat-nav-tabs">
          <button type="button" class="flora-chat-tab-btn is-active" id="floraTabTeamBtn">
            <i class="bi bi-people-fill"></i>
            <span>เพื่อน</span>
            <span class="flora-chat-tab-badge d-none" id="floraTeamTabBadge">0</span>
          </button>
          <button type="button" class="flora-chat-tab-btn" id="floraTabAssistantBtn">
            <i class="bi bi-stars text-warning"></i>
            <span>ผู้ช่วย</span>
          </button>
        </div>
      </div>

      <!-- Body Area -->
      <div class="flora-chat-body">
        
        <!-- ===== TAB 1: ASSISTANT CONTENT ===== -->
        <div class="flora-chat-tab-content" id="floraAssistantTabContent">
          <div class="flora-chat-messages" id="floraAssistantMessageList"></div>

          <!-- Quick Suggestion Prompt Chips -->
          <div class="flora-prompt-chips-wrapper">
            <button type="button" class="flora-prompt-chip" data-prompt="เช็คพัสดุในคลัง">
              <i class="bi bi-box-seam text-success"></i> เช็คพัสดุในคลัง
            </button>
            <button type="button" class="flora-prompt-chip" data-prompt="วิธีเบิก-ยืมอุปกรณ์">
              <i class="bi bi-arrow-left-right text-primary"></i> วิธีเบิก-ยืมอุปกรณ์
            </button>
            <button type="button" class="flora-prompt-chip" data-prompt="ดูผังองค์กร">
              <i class="bi bi-diagram-3 text-info"></i> ดูผังองค์กร
            </button>
            <button type="button" class="flora-prompt-chip" data-prompt="รอบคำนวณเงินเดือน">
              <i class="bi bi-cash-coin text-warning"></i> รอบเงินเดือน
            </button>
            <button type="button" class="flora-prompt-chip" data-prompt="การเปิดใบขอซื้อ">
              <i class="bi bi-cart-check text-success"></i> การขอซื้อ-ขอจ้าง
            </button>
          </div>

          <!-- Assistant Input Footer -->
          <div class="flora-chat-footer">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <span class="text-muted" style="font-size: 11px;">
                <i class="bi bi-shield-check text-success"></i> ผู้ช่วยตอบคำถามอัตโนมัติ
              </span>
              <button type="button" class="flora-chat-clear-btn" id="floraClearAssistantBtn" title="เริ่มบทสนทนาใหม่">
                <i class="bi bi-arrow-counterclockwise"></i> ล้างการสนทนา
              </button>
            </div>
            <div class="flora-input-wrapper">
              <input type="text" class="flora-chat-input" id="floraAssistantInput" placeholder="พิมพ์คำถามที่ต้องการถามผู้ช่วย..." autocomplete="off">
              <button type="button" class="flora-chat-send-btn" id="floraAssistantSendBtn" title="ส่งคำถาม">
                <i class="bi bi-send-fill"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- ===== TAB 2: TEAM / PEER CONTENT (ACTIVE BY DEFAULT) ===== -->
        <div class="flora-chat-tab-content is-active" id="floraTeamTabContent">
          <!-- Identity Sub-Bar -->
          <div class="flora-team-bar">
            <div class="flora-team-user-info">
              <div class="flora-team-user-avatar" id="floraTeamCurrentAvatar">คุณ</div>
              <div>
                <span class="text-muted" style="font-size: 10px;">ตัวตนของคุณในระบบ:</span>
                <div class="flora-team-user-name" id="floraTeamCurrentName">ผู้ใช้งาน</div>
              </div>
            </div>
            <button type="button" class="flora-team-edit-btn" id="floraTeamChangeNameBtn" title="เลือกตัวตนจากรายชื่อบุคลากรหรือเปลี่ยนชื่อ">
              <i class="bi bi-person-check-fill text-success"></i> ระบุตัวตน
            </button>
          </div>

          <!-- Team Filter Bar (ทั้งหมด / เฉพาะบุคคล / ข้อความรวม) -->
          <div class="flora-team-filter-bar">
            <button type="button" class="flora-filter-btn is-active" id="floraFilterAllBtn" data-filter="all">
              <i class="bi bi-chat-left-text"></i> ทั้งหมด
            </button>
            <button type="button" class="flora-filter-btn" id="floraFilterDirectBtn" data-filter="direct">
              <i class="bi bi-lock-fill text-purple"></i> เฉพาะบุคคล
              <span class="flora-filter-badge" id="floraDirectFilterBadge">0</span>
            </button>
            <button type="button" class="flora-filter-btn" id="floraFilterBroadcastBtn" data-filter="broadcast">
              <i class="bi bi-broadcast"></i> ข้อความรวม
            </button>
          </div>

          <!-- Team Message List -->
          <div class="flora-chat-messages" id="floraTeamMessageList"></div>

          <!-- Team Input Footer -->
          <div class="flora-chat-footer">
            <!-- Recipient Selector Bar (ส่งถึงทุกคน หรือ ส่งเฉพาะเจาะจงบุคคล) -->
            <div class="flora-recipient-bar">
              <div class="flora-recipient-info">
                <span class="flora-recipient-label"><i class="bi bi-send-arrow-up"></i> ส่งถึง:</span>
                <span class="flora-recipient-pill is-public" id="floraRecipientPill">
                  <i class="bi bi-broadcast"></i> ทุกคน (ทั้งองค์กร)
                </span>
                <button type="button" class="flora-recipient-clear-btn d-none" id="floraRecipientClearBtn" title="ยกเลิก ส่งถึงทุกคน">
                  <i class="bi bi-x-circle-fill"></i>
                </button>
              </div>
              <button type="button" class="flora-recipient-pick-btn" id="floraRecipientPickBtn" title="เลือกบุคคลปลายทางที่จะส่งข้อความถึง">
                <i class="bi bi-person-lines-fill"></i> เลือกผู้รับ
              </button>
            </div>

            <!-- Tag Selection -->
            <div class="flora-tag-selector">
              <span class="text-muted" style="font-size: 11px;">ประเภท:</span>
              <button type="button" class="flora-tag-option is-selected" data-tag="ทั่วไป">💬 ทั่วไป</button>
              <button type="button" class="flora-tag-option" data-tag="ด่วน">🚨 เรื่องด่วน</button>
              <button type="button" class="flora-tag-option" data-tag="ขอเบิกพัสดุ">📦 ขอเบิกพัสดุ</button>
            </div>

            <div class="flora-input-wrapper">
              <input type="text" class="flora-chat-input" id="floraTeamInput" placeholder="พิมพ์ข้อความถึงเพื่อนร่วมงาน..." autocomplete="off">
              <button type="button" class="flora-chat-send-btn" id="floraTeamSendBtn" title="ส่งข้อความ">
                <i class="bi bi-send-fill"></i>
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- Recipient / Identity Selection Modal Overlay -->
      <div class="flora-chat-modal-overlay" id="floraChatModalOverlay">
        <div class="flora-chat-modal-card">
          <div class="flora-chat-modal-header">
            <h5 class="flora-chat-modal-title" id="floraModalTitle">
              <i class="bi bi-people-fill text-success"></i> เลือกผู้รับข้อความ
            </h5>
            <button type="button" class="flora-chat-modal-close" id="floraModalCloseBtn">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <div class="flora-chat-modal-body">
            <input type="text" class="flora-chat-modal-search" id="floraModalSearch" placeholder="พิมพ์ชื่อ แผนก หรือตำแหน่ง เพื่อค้นหา...">
            <div id="floraModalContentList"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    setupEventListeners();
    renderAssistantMessages();
    renderTeamMessages();
    initFirestoreListener();
  }

  // ==================== MOBILE VISIBILITY CONTROLLER ====================
  // Comprehensive mobile detection: User-Agent, Touch screen, coarse pointer, or screen width
  function isMobileUser() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || "";
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|silk|kindle|tablet/i.test(ua);
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    const isCoarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    return isMobileUA || (isTouch && isCoarse) || (window.innerWidth <= 1024);
  }

  // Consistent chat button visibility across both desktop and mobile
  function updateMobileChatVisibility() {
    const btn = document.getElementById("floraChatFloatingBtn");
    if (!btn) return;

    const isModalOpen = document.body.classList.contains("modal-open") || Boolean(document.querySelector(".modal.show"));
    if (isModalOpen) {
      btn.classList.add("flora-mobile-hidden");
      return;
    }

    btn.classList.remove("flora-mobile-hidden");
  }

  // ==================== EVENT LISTENERS SETUP ====================
  function setupEventListeners() {
    const closeBtn = document.getElementById("floraChatCloseBtn");
    const minBtn = document.getElementById("floraChatMinimizeBtn");
    const tabAssistantBtn = document.getElementById("floraTabAssistantBtn");
    const tabTeamBtn = document.getElementById("floraTabTeamBtn");
    const assistantInput = document.getElementById("floraAssistantInput");
    const assistantSendBtn = document.getElementById("floraAssistantSendBtn");
    const teamInput = document.getElementById("floraTeamInput");
    const teamSendBtn = document.getElementById("floraTeamSendBtn");
    const clearAssistantBtn = document.getElementById("floraClearAssistantBtn");
    const changeNameBtn = document.getElementById("floraTeamChangeNameBtn");

    const recipientPickBtn = document.getElementById("floraRecipientPickBtn");
    const recipientClearBtn = document.getElementById("floraRecipientClearBtn");
    const modalCloseBtn = document.getElementById("floraModalCloseBtn");
    const modalOverlay = document.getElementById("floraChatModalOverlay");
    const modalSearch = document.getElementById("floraModalSearch");

    const filterAllBtn = document.getElementById("floraFilterAllBtn");
    const filterDirectBtn = document.getElementById("floraFilterDirectBtn");
    const filterBroadcastBtn = document.getElementById("floraFilterBroadcastBtn");

    if (closeBtn) closeBtn.addEventListener("click", closeChatPanel);
    if (minBtn) minBtn.addEventListener("click", closeChatPanel);

    if (tabAssistantBtn) {
      tabAssistantBtn.addEventListener("click", () => switchTab("assistant"));
    }
    if (tabTeamBtn) {
      tabTeamBtn.addEventListener("click", () => switchTab("team"));
    }

    // Assistant send
    if (assistantSendBtn) {
      assistantSendBtn.addEventListener("click", handleAssistantSend);
    }
    if (assistantInput) {
      assistantInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleAssistantSend();
        }
      });
    }

    // Team send
    if (teamSendBtn) {
      teamSendBtn.addEventListener("click", handleTeamSend);
    }
    if (teamInput) {
      teamInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleTeamSend();
        }
      });
    }

    // Clear assistant
    if (clearAssistantBtn) {
      clearAssistantBtn.addEventListener("click", () => {
        botMessages = [...getInitialAssistantMessages()];
        saveLocalBotMessages(botMessages);
        renderAssistantMessages();
      });
    }

    // Identity picker modal
    if (changeNameBtn) {
      changeNameBtn.addEventListener("click", openIdentityPickerModal);
    }

    // Recipient picker modal
    if (recipientPickBtn) {
      recipientPickBtn.addEventListener("click", openRecipientPickerModal);
    }
    if (recipientClearBtn) {
      recipientClearBtn.addEventListener("click", () => {
        setRecipient(null);
      });
    }

    // Modal controls
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener("click", closeChatModal);
    }
    if (modalOverlay) {
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) closeChatModal();
      });
    }
    if (modalSearch) {
      modalSearch.addEventListener("input", () => {
        filterModalList(modalSearch.value);
      });
    }

    // Filter bar controls
    if (filterAllBtn) {
      filterAllBtn.addEventListener("click", () => setTeamFilter("all"));
    }
    if (filterDirectBtn) {
      filterDirectBtn.addEventListener("click", () => setTeamFilter("direct"));
    }
    if (filterBroadcastBtn) {
      filterBroadcastBtn.addEventListener("click", () => setTeamFilter("broadcast"));
    }

    // Quick prompt chips
    const chips = document.querySelectorAll(".flora-prompt-chip");
    chips.forEach(chip => {
      chip.addEventListener("click", () => {
        const text = chip.getAttribute("data-prompt") || "";
        if (text && assistantInput) {
          assistantInput.value = text;
          handleAssistantSend();
        }
      });
    });

    // Tag selector in team chat
    const tagBtns = document.querySelectorAll(".flora-tag-option");
    tagBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        tagBtns.forEach(b => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        selectedTeamTag = btn.getAttribute("data-tag") || "ทั่วไป";
      });
    });

    // Listen for dynamic project title changes from Org Tree or Global Logo
    window.addEventListener("flora-project-title-changed", (evt) => {
      const newTitle = (evt && evt.detail && evt.detail.title) || getChatProjectTitle();
      const chatTitleEl = document.getElementById("floraChatProjectNameText");
      if (chatTitleEl) {
        chatTitleEl.textContent = newTitle;
      }
    });

    // Mobile visibility listeners for tabs, modals, and screen resize
    document.addEventListener("shown.bs.tab", () => {
      updateMobileChatVisibility();
      setTimeout(updateMobileChatVisibility, 80);
    });
    document.addEventListener("hidden.bs.tab", () => {
      updateMobileChatVisibility();
      setTimeout(updateMobileChatVisibility, 80);
    });
    document.addEventListener("show.bs.modal", updateMobileChatVisibility);
    document.addEventListener("shown.bs.modal", updateMobileChatVisibility);
    document.addEventListener("hide.bs.modal", updateMobileChatVisibility);
    document.addEventListener("hidden.bs.modal", () => {
      updateMobileChatVisibility();
      setTimeout(updateMobileChatVisibility, 80);
    });
    window.addEventListener("resize", updateMobileChatVisibility);
    window.addEventListener("orientationchange", updateMobileChatVisibility);

    // Mutation observer to instantly catch modal-open class changes on body
    if (window.MutationObserver) {
      const observer = new MutationObserver(() => {
        updateMobileChatVisibility();
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }

    // Initial check for mobile visibility
    setTimeout(updateMobileChatVisibility, 60);
  }

  // ==================== PANEL DISPLAY & TABS ====================
  function toggleChatPanel() {
    if (isChatOpen) {
      closeChatPanel();
    } else {
      openChatPanel();
    }
  }

  function openChatPanel() {
    const panel = document.getElementById("floraChatPanel");
    if (!panel) return;
    panel.classList.add("is-open");
    isChatOpen = true;

    // ล็อคอยู่ที่แท็บเพื่อนเสมอเมื่อเปิดแชท
    switchTab("team");

    // Reset unread count
    resetUnreadTeamCount();

    // Update user identity display
    updateUserIdentityHeader();

    // Re-render and show messages immediately
    renderTeamMessages();

    // Auto focus active input and scroll down
    setTimeout(() => {
      document.getElementById("floraTeamInput")?.focus();
      scrollMessageContainer("floraTeamMessageList");
    }, 120);
  }

  function closeChatPanel() {
    const panel = document.getElementById("floraChatPanel");
    if (!panel) return;
    panel.classList.remove("is-open");
    isChatOpen = false;
  }

  function switchTab(tabName) {
    activeTab = tabName;
    const tabAssistantBtn = document.getElementById("floraTabAssistantBtn");
    const tabTeamBtn = document.getElementById("floraTabTeamBtn");
    const assistantContent = document.getElementById("floraAssistantTabContent");
    const teamContent = document.getElementById("floraTeamTabContent");

    if (tabName === "assistant") {
      tabAssistantBtn?.classList.add("is-active");
      tabTeamBtn?.classList.remove("is-active");
      assistantContent?.classList.add("is-active");
      teamContent?.classList.remove("is-active");
      setTimeout(() => {
        document.getElementById("floraAssistantInput")?.focus();
        scrollMessageContainer("floraAssistantMessageList");
      }, 50);
    } else {
      tabTeamBtn?.classList.add("is-active");
      tabAssistantBtn?.classList.remove("is-active");
      teamContent?.classList.add("is-active");
      assistantContent?.classList.remove("is-active");
      resetUnreadTeamCount();
      updateUserIdentityHeader();
      setTimeout(() => {
        document.getElementById("floraTeamInput")?.focus();
        scrollMessageContainer("floraTeamMessageList");
      }, 50);
    }
  }

  function updateUserIdentityHeader() {
    const user = getCurrentUserIdentity();
    const nameEl = document.getElementById("floraTeamCurrentName");
    const avatarEl = document.getElementById("floraTeamCurrentAvatar");
    if (nameEl) nameEl.textContent = user.name + (user.role ? ` (${user.role})` : "");
    if (avatarEl) {
      const initial = (user.name || "ผ")[0];
      avatarEl.textContent = initial;
    }
  }

  // ==================== RECIPIENT & IDENTITY MODALS ====================
  let currentModalMode = "recipient"; // "recipient" | "identity"

  function openRecipientPickerModal() {
    currentModalMode = "recipient";
    const overlay = document.getElementById("floraChatModalOverlay");
    const title = document.getElementById("floraModalTitle");
    const search = document.getElementById("floraModalSearch");
    if (!overlay) return;

    if (title) {
      title.innerHTML = `<i class="bi bi-person-lines-fill text-success"></i> เลือกผู้รับข้อความเฉพาะบุคคล`;
    }
    if (search) {
      search.value = "";
      search.placeholder = "พิมพ์ชื่อ แผนก หรือตำแหน่ง เพื่อค้นหา...";
    }

    renderModalRecipientList("");
    overlay.classList.add("is-open");
    setTimeout(() => search?.focus(), 120);
  }

  function openIdentityPickerModal() {
    currentModalMode = "identity";
    const overlay = document.getElementById("floraChatModalOverlay");
    const title = document.getElementById("floraModalTitle");
    const search = document.getElementById("floraModalSearch");
    if (!overlay) return;

    if (title) {
      title.innerHTML = `<i class="bi bi-person-badge text-primary"></i> ระบุตัวตนของคุณในระบบ`;
    }
    if (search) {
      search.value = "";
      search.placeholder = "ค้นหาชื่อของคุณจากรายชื่อบุคลากร...";
    }

    renderModalIdentityList("");
    overlay.classList.add("is-open");
    setTimeout(() => search?.focus(), 120);
  }

  function closeChatModal() {
    const overlay = document.getElementById("floraChatModalOverlay");
    if (overlay) overlay.classList.remove("is-open");
  }

  function filterModalList(query) {
    if (currentModalMode === "recipient") {
      renderModalRecipientList(query);
    } else {
      renderModalIdentityList(query);
    }
  }

  function renderModalRecipientList(query) {
    const container = document.getElementById("floraModalContentList");
    if (!container) return;

    const q = (query || "").trim().toLowerCase();
    const emps = getOrganizationEmployees();
    const currentUser = getCurrentUserIdentity();

    let html = `
      <!-- Option 1: ทุกคน (ทั้งองค์กร) -->
      <div class="flora-emp-list-item ${!selectedRecipient ? 'is-selected' : ''}" id="floraModalPickPublic">
        <div class="flora-emp-avatar" style="background: #e2e8f0; color: #0f172a;">
          <i class="bi bi-broadcast"></i>
        </div>
        <div class="flora-emp-details">
          <div class="flora-emp-name">ทุกคน (ทั้งองค์กร)</div>
          <div class="flora-emp-sub">ส่งข้อความรวมถึงบุคลากรทุกคนในระบบ</div>
        </div>
        ${!selectedRecipient ? '<i class="bi bi-check-circle-fill text-success ms-auto"></i>' : ''}
      </div>
      <div class="my-2 text-muted px-1" style="font-size: 11px; font-weight: 600;">
        รายชื่อบุคลากรในองค์กร (แชทเฉพาะบุคคล พร้อมส่งเสียงเตือนเฉพาะเครื่อง):
      </div>
    `;

    const filtered = emps.filter(emp => {
      if (emp.name && emp.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()) return false;
      if (!q) return true;
      const matchName = emp.name && emp.name.toLowerCase().includes(q);
      const matchDept = emp.department && emp.department.toLowerCase().includes(q);
      const matchPos = emp.position && emp.position.toLowerCase().includes(q);
      const matchCode = emp.code && emp.code.toLowerCase().includes(q);
      return matchName || matchDept || matchPos || matchCode;
    });

    if (filtered.length === 0) {
      html += `
        <div class="text-center py-4 text-muted" style="font-size: 12px;">
          <i class="bi bi-search d-block mb-1 fs-4 text-secondary"></i>
          ไม่พบบุคลากรที่ตรงกับคำค้นหา
        </div>
      `;
    } else {
      filtered.forEach(emp => {
        const isSelected = selectedRecipient && (selectedRecipient.id === emp.id || selectedRecipient.name === emp.name);
        const avatarInitial = (emp.name || "บ")[0];
        const avatarContent = emp.photoUrl 
          ? `<img src="${escapeHtml(emp.photoUrl)}" class="flora-emp-avatar" alt="${escapeHtml(emp.name)}">`
          : `<div class="flora-emp-avatar">${avatarInitial}</div>`;

        html += `
          <div class="flora-emp-list-item ${isSelected ? 'is-selected' : ''}" data-emp-id="${escapeHtml(emp.id)}" data-emp-name="${escapeHtml(emp.name)}" data-emp-pos="${escapeHtml(emp.position)}" data-emp-dept="${escapeHtml(emp.department)}">
            ${avatarContent}
            <div class="flora-emp-details">
              <div class="flora-emp-name">${escapeHtml(emp.name)}</div>
              <div class="flora-emp-sub">${escapeHtml(emp.position)} • ${escapeHtml(emp.department)}</div>
            </div>
            ${isSelected ? '<i class="bi bi-check-circle-fill text-success ms-auto"></i>' : '<i class="bi bi-chat-text text-muted ms-auto"></i>'}
          </div>
        `;
      });
    }

    container.innerHTML = html;

    // Attach click events
    const publicBtn = document.getElementById("floraModalPickPublic");
    if (publicBtn) {
      publicBtn.addEventListener("click", () => {
        setRecipient(null);
        closeChatModal();
      });
    }

    container.querySelectorAll(".flora-emp-list-item[data-emp-name]").forEach(item => {
      item.addEventListener("click", () => {
        const id = item.getAttribute("data-emp-id");
        const name = item.getAttribute("data-emp-name");
        const pos = item.getAttribute("data-emp-pos");
        const dept = item.getAttribute("data-emp-dept");
        setRecipient({ id, name, position: pos, department: dept });
        closeChatModal();
      });
    });
  }

  function renderModalIdentityList(query) {
    const container = document.getElementById("floraModalContentList");
    if (!container) return;

    const q = (query || "").trim().toLowerCase();
    const emps = getOrganizationEmployees();
    const currentUser = getCurrentUserIdentity();

    let html = `
      <!-- Manual Name Input Form -->
      <div class="p-2 mb-2 bg-light rounded-3 border" style="font-size: 12px;">
        <div class="fw-bold mb-1 text-dark">
          <i class="bi bi-pencil-square text-primary"></i> หรือพิมพ์ชื่อแสดงของคุณเอง:
        </div>
        <div class="d-flex gap-2">
          <input type="text" id="floraManualIdentityInput" class="form-control form-control-sm" placeholder="ระบุชื่อของคุณ..." value="${escapeHtml(currentUser.name)}">
          <button type="button" id="floraManualIdentityBtn" class="btn btn-primary btn-sm px-3 text-nowrap">
            บันทึก
          </button>
        </div>
      </div>
      <div class="my-2 text-muted px-1" style="font-size: 11px; font-weight: 600;">
        คลิกเลือกชื่อของคุณจากรายชื่อบุคลากร (เพื่อรับเสียงเตือนเฉพาะเครื่องของคุณ):
      </div>
    `;

    const filtered = emps.filter(emp => {
      if (!q) return true;
      const matchName = emp.name && emp.name.toLowerCase().includes(q);
      const matchDept = emp.department && emp.department.toLowerCase().includes(q);
      const matchPos = emp.position && emp.position.toLowerCase().includes(q);
      return matchName || matchDept || matchPos;
    });

    if (filtered.length === 0) {
      html += `
        <div class="text-center py-3 text-muted" style="font-size: 12px;">
          ไม่พบบุคลากรที่ตรงกับคำค้นหา
        </div>
      `;
    } else {
      filtered.forEach(emp => {
        const isCurrent = currentUser.name.trim().toLowerCase() === emp.name.trim().toLowerCase();
        const avatarInitial = (emp.name || "บ")[0];
        const avatarContent = emp.photoUrl 
          ? `<img src="${escapeHtml(emp.photoUrl)}" class="flora-emp-avatar" alt="${escapeHtml(emp.name)}">`
          : `<div class="flora-emp-avatar">${avatarInitial}</div>`;

        html += `
          <div class="flora-emp-list-item ${isCurrent ? 'is-selected' : ''}" data-emp-id="${escapeHtml(emp.id)}" data-emp-name="${escapeHtml(emp.name)}" data-emp-pos="${escapeHtml(emp.position)}">
            ${avatarContent}
            <div class="flora-emp-details">
              <div class="flora-emp-name">${escapeHtml(emp.name)} ${isCurrent ? '<span class="badge bg-success ms-1" style="font-size: 9.5px;">คุณคือคนนี้</span>' : ''}</div>
              <div class="flora-emp-sub">${escapeHtml(emp.position)} • ${escapeHtml(emp.department)}</div>
            </div>
            <button type="button" class="btn btn-outline-success btn-sm py-0 px-2" style="font-size: 11px;">
              ${isCurrent ? 'กำลังใช้งาน' : 'ฉันคือคนนี้'}
            </button>
          </div>
        `;
      });
    }

    container.innerHTML = html;

    // Manual save
    const manualBtn = document.getElementById("floraManualIdentityBtn");
    const manualInput = document.getElementById("floraManualIdentityInput");
    if (manualBtn && manualInput) {
      manualBtn.addEventListener("click", () => {
        const newName = manualInput.value.trim();
        if (newName) {
          try {
            localStorage.setItem(STORAGE_KEY_USER_NAME, newName);
          } catch (e) {}
          updateUserIdentityHeader();
          renderTeamMessages();
          closeChatModal();
        }
      });
      manualInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          manualBtn.click();
        }
      });
    }

    // Pick from staff list
    container.querySelectorAll(".flora-emp-list-item[data-emp-name]").forEach(item => {
      item.addEventListener("click", () => {
        const id = item.getAttribute("data-emp-id");
        const name = item.getAttribute("data-emp-name");
        const pos = item.getAttribute("data-emp-pos");
        if (name) {
          try {
            localStorage.setItem(STORAGE_KEY_USER_NAME, name);
            if (id) localStorage.setItem(STORAGE_KEY_USER_EMP_ID, id);
            if (pos) localStorage.setItem(STORAGE_KEY_USER_EMP_ROLE, pos);
          } catch (e) {}
          updateUserIdentityHeader();
          renderTeamMessages();
          closeChatModal();
        }
      });
    });
  }

  function setRecipient(recipient) {
    selectedRecipient = recipient;
    const pill = document.getElementById("floraRecipientPill");
    const clearBtn = document.getElementById("floraRecipientClearBtn");

    if (pill) {
      if (!selectedRecipient) {
        pill.className = "flora-recipient-pill is-public";
        pill.innerHTML = `<i class="bi bi-broadcast"></i> ทุกคน (ทั้งองค์กร)`;
      } else {
        pill.className = "flora-recipient-pill is-private";
        pill.innerHTML = `<i class="bi bi-lock-fill text-warning"></i> เฉพาะคุณ ${escapeHtml(selectedRecipient.name)}`;
      }
    }

    if (clearBtn) {
      if (selectedRecipient) {
        clearBtn.classList.remove("d-none");
      } else {
        clearBtn.classList.add("d-none");
      }
    }

    document.getElementById("floraTeamInput")?.focus();
  }

  function setTeamFilter(filter) {
    teamFilter = filter;
    const allBtn = document.getElementById("floraFilterAllBtn");
    const directBtn = document.getElementById("floraFilterDirectBtn");
    const broadcastBtn = document.getElementById("floraFilterBroadcastBtn");

    [allBtn, directBtn, broadcastBtn].forEach(b => b?.classList.remove("is-active"));

    if (filter === "all") allBtn?.classList.add("is-active");
    if (filter === "direct") directBtn?.classList.add("is-active");
    if (filter === "broadcast") broadcastBtn?.classList.add("is-active");

    renderTeamMessages();
  }

  // ==================== ASSISTANT MESSAGING ====================
  function handleAssistantSend() {
    const input = document.getElementById("floraAssistantInput");
    if (!input) return;
    const text = (input.value || "").trim();
    if (!text) return;

    input.value = "";

    // 1. Add User message
    const userMsg = {
      id: "user_" + Date.now(),
      sender: "คุณ",
      isAssistant: false,
      text: text,
      timestamp: new Date().toISOString()
    };
    botMessages.push(userMsg);
    saveLocalBotMessages(botMessages);
    renderAssistantMessages();

    // 2. Show typing indicator
    showAssistantTypingIndicator();

    // 3. Generate response with small natural delay
    setTimeout(() => {
      removeAssistantTypingIndicator();
      const resp = generateAssistantResponse(text);
      const botMsg = {
        id: "bot_" + Date.now(),
        sender: "ผู้ช่วยอัจฉริยะ",
        isAssistant: true,
        text: resp.text,
        quickLinks: resp.quickLinks || [],
        timestamp: new Date().toISOString()
      };
      botMessages.push(botMsg);
      saveLocalBotMessages(botMessages);
      renderAssistantMessages();
      playPleasantChime();
    }, 450);
  }

  function showAssistantTypingIndicator() {
    const list = document.getElementById("floraAssistantMessageList");
    if (!list || document.getElementById("floraAssistantTyping")) return;
    const typing = document.createElement("div");
    typing.id = "floraAssistantTyping";
    typing.className = "flora-typing-indicator";
    typing.innerHTML = `
      <span class="flora-typing-dot"></span>
      <span class="flora-typing-dot"></span>
      <span class="flora-typing-dot"></span>
    `;
    list.appendChild(typing);
    scrollMessageContainer("floraAssistantMessageList");
  }

  function removeAssistantTypingIndicator() {
    const typing = document.getElementById("floraAssistantTyping");
    if (typing) typing.remove();
  }

  function renderAssistantMessages() {
    const list = document.getElementById("floraAssistantMessageList");
    if (!list) return;

    list.innerHTML = "";

    botMessages.forEach(msg => {
      const item = document.createElement("div");
      item.className = `flora-msg-item ${msg.isAssistant ? "incoming" : "outgoing"}`;

      let linksHtml = "";
      if (msg.quickLinks && msg.quickLinks.length > 0) {
        linksHtml = `
          <div class="flora-quick-links">
            ${msg.quickLinks.map(l => `
              <a href="${l.url}" class="flora-quick-link-btn">
                <i class="bi ${l.icon || "bi-arrow-right-circle-fill"}"></i>
                <span>${l.label}</span>
              </a>
            `).join("")}
          </div>
        `;
      }

      // Convert line breaks and simple markdown
      const formattedText = escapeHtml(msg.text)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");

      item.innerHTML = `
        <div class="flora-msg-header">
          <span class="flora-msg-sender">
            ${msg.isAssistant ? '<i class="bi bi-stars text-warning me-1"></i>ผู้ช่วยอัจฉริยะ' : 'คุณ'}
          </span>
        </div>
        <div class="flora-msg-bubble">
          <div>${formattedText}</div>
          ${linksHtml}
        </div>
        <div class="flora-msg-time">${formatThaiDateTime(msg.timestamp)}</div>
      `;

      list.appendChild(item);
    });

    scrollMessageContainer("floraAssistantMessageList");
  }

  // ==================== TEAM / PEER MESSAGING ====================
  function handleTeamSend() {
    const input = document.getElementById("floraTeamInput");
    if (!input) return;
    const text = (input.value || "").trim();
    if (!text) return;

    input.value = "";

    const user = getCurrentUserIdentity();
    const newMsg = {
      id: "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      text: text,
      tag: selectedTeamTag,
      recipientId: selectedRecipient ? selectedRecipient.id : null,
      recipientName: selectedRecipient ? selectedRecipient.name : null,
      isDirect: !!selectedRecipient,
      timestamp: new Date().toISOString(),
      status: "pending" // "pending" | "synced" | "failed"
    };

    // 1. Add locally
    teamMessages.push(newMsg);
    saveLocalTeamMessages(teamMessages);
    renderTeamMessages();

    // 2. Broadcast to other tabs on same device
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: "NEW_TEAM_MESSAGE", message: newMsg });
      } catch (e) {}
    }

    // 3. Save to Firestore if available
    saveMessageToFirestore(newMsg);
  }

  function retrySendMessage(msgId) {
    const target = teamMessages.find(m => m.id === msgId);
    if (!target) return;
    target.status = "pending";
    saveLocalTeamMessages(teamMessages);
    renderTeamMessages();
    saveMessageToFirestore(target);
  }

  // ==================== RESILIENT RECIPIENT & SENDER MATCHING ====================
  function isUserRecipientOfMessage(msg, currentUser) {
    if (!msg || !msg.isDirect) return false;

    // 1. Direct ID matches
    if (msg.recipientId) {
      if (currentUser.employeeId && currentUser.employeeId === msg.recipientId) return true;
      if (currentUser.id && currentUser.id === msg.recipientId) return true;
    }

    // 2. Normalize and check names and codes
    const rName = (msg.recipientName || "").trim().toLowerCase();
    const rId = (msg.recipientId || "").trim().toLowerCase();
    const cName = (currentUser.name || "").trim().toLowerCase();
    const cEmpId = (currentUser.employeeId || "").trim().toLowerCase();
    const cId = (currentUser.id || "").trim().toLowerCase();

    if (rName && cName) {
      if (rName === cName) return true;
      const cleanR = rName.replace(/^(คุณ|นาย|นางสาว|นาง|น\.ส\.)\s*/, "");
      const cleanC = cName.replace(/^(คุณ|นาย|นางสาว|นาง|น\.ส\.)\s*/, "");
      if (cleanR && cleanC && (cleanR === cleanC || cleanR.includes(cleanC) || cleanC.includes(cleanR))) {
        return true;
      }
    }

    if (rId && (rId === cEmpId || rId === cId)) return true;

    // 3. Match against cached organization staff directory
    const emps = getOrganizationEmployees();
    const matchedRecipient = emps.find(e =>
      (e.id && e.id === msg.recipientId) ||
      (e.code && e.code === msg.recipientId) ||
      (e.name && e.name.trim().toLowerCase() === rName)
    );
    if (matchedRecipient) {
      if (cEmpId && (cEmpId === matchedRecipient.id || cEmpId === matchedRecipient.code)) return true;
      const matchedName = (matchedRecipient.name || "").trim().toLowerCase();
      if (cName && matchedName) {
        const cleanM = matchedName.replace(/^(คุณ|นาย|นางสาว|นาง|น\.ส\.)\s*/, "");
        const cleanC = cName.replace(/^(คุณ|นาย|นางสาว|นาง|น\.ส\.)\s*/, "");
        if (cleanC && cleanM && (cleanC === cleanM || cleanC.includes(cleanM) || cleanM.includes(cleanC))) {
          return true;
        }
      }
    }

    return false;
  }

  function isUserSenderOfMessage(msg, currentUser) {
    if (!msg) return false;
    if (msg.senderId && (msg.senderId === currentUser.id || msg.senderId === currentUser.employeeId)) return true;
    const sName = (msg.senderName || "").trim().toLowerCase();
    const cName = (currentUser.name || "").trim().toLowerCase();
    if (sName && cName) {
      if (sName === cName) return true;
      const cleanS = sName.replace(/^(คุณ|นาย|นางสาว|นาง|น\.ส\.)\s*/, "");
      const cleanC = cName.replace(/^(คุณ|นาย|นางสาว|นาง|น\.ส\.)\s*/, "");
      if (cleanS && cleanC && (cleanS === cleanC || cleanS.includes(cleanC) || cleanC.includes(cleanS))) {
        return true;
      }
    }
    return false;
  }

  function handleIncomingTeamMessage(msg, fromFirestore = false) {
    if (!msg || !msg.id) return;
    const exists = teamMessages.some(m => m.id === msg.id);
    if (exists) return;

    // Messages received from Firestore have already been synced
    if (fromFirestore) {
      msg.status = "synced";
    }

    teamMessages.push(msg);
    saveLocalTeamMessages(teamMessages);
    renderTeamMessages();

    const currentUser = getCurrentUserIdentity();
    const isFromSelf = isUserSenderOfMessage(msg, currentUser);

    if (isFromSelf) return;

    if (msg.isDirect) {
      // Check if this device belongs to the designated recipient
      const isRecipient = isUserRecipientOfMessage(msg, currentUser);

      if (isRecipient) {
        // PLAY SPECIAL ALERT SOUND SPECIFICALLY ON RECIPIENT'S MACHINE!
        playDirectAlertSound();
        if (navigator.vibrate) {
          try { navigator.vibrate([200, 100, 200]); } catch (e) {}
        }
        triggerDirectMessageTitleAlert(msg.senderName);
        if (!isChatOpen || activeTab !== "team") {
          incrementUnreadTeamCount();
        }
      }
      // If NOT recipient: completely silent and no alerts
    } else {
      // General team broadcast
      playPleasantChime();
      if (!isChatOpen || activeTab !== "team") {
        incrementUnreadTeamCount();
      }
    }
  }

  function renderTeamMessages() {
    const list = document.getElementById("floraTeamMessageList");
    if (!list) return;

    list.innerHTML = "";
    const currentUser = getCurrentUserIdentity();

    // 1. Calculate direct message count for badge
    let directCount = 0;
    teamMessages.forEach(m => {
      if (m.isDirect) {
        const isSelf = isUserSenderOfMessage(m, currentUser);
        const isRecipient = isUserRecipientOfMessage(m, currentUser);
        if (isSelf || isRecipient) directCount++;
      }
    });

    const directBadge = document.getElementById("floraDirectFilterBadge");
    if (directBadge) directBadge.textContent = directCount;

    // 2. Filter messages for display (privacy: direct messages only visible to sender and recipient)
    const visibleMessages = teamMessages.filter(msg => {
      if (msg.isDirect) {
        const isSelf = isUserSenderOfMessage(msg, currentUser);
        const isRecipient = isUserRecipientOfMessage(msg, currentUser);

        if (!isSelf && !isRecipient) return false;
        if (teamFilter === "broadcast") return false;
        return true;
      } else {
        if (teamFilter === "direct") return false;
        return true;
      }
    });

    if (visibleMessages.length === 0) {
      let emptyText = "ยังไม่มีข้อความสนทนาในหมวดนี้";
      if (teamFilter === "direct") {
        emptyText = "ยังไม่มีข้อความเฉพาะบุคคลที่เกี่ยวข้องกับคุณ";
      } else if (teamFilter === "broadcast") {
        emptyText = "ยังไม่มีข้อความรวมในองค์กร";
      }
      list.innerHTML = `
        <div class="flora-empty-chat">
          <div class="flora-empty-icon"><i class="bi bi-chat-heart"></i></div>
          <div class="flora-empty-title">${emptyText}</div>
          <div class="flora-empty-desc">กดปุ่มเลือกผู้รับด้านล่างเพื่อเริ่มส่งข้อความถึงเพื่อนร่วมงานได้เลยครับ</div>
        </div>
      `;
      return;
    }

    visibleMessages.forEach(msg => {
      const isSelf = isUserSenderOfMessage(msg, currentUser);
      const item = document.createElement("div");
      item.className = `flora-msg-item ${isSelf ? "outgoing" : "incoming"} ${msg.isDirect ? "flora-msg-direct-container" : ""}`;

      let tagClass = "flora-msg-tag-general";
      let tagIcon = "bi-chat-dots";
      if (msg.tag === "ด่วน") {
        tagClass = "flora-msg-tag-urgent";
        tagIcon = "bi-exclamation-triangle-fill";
      } else if (msg.tag === "ขอเบิกพัสดุ") {
        tagClass = "flora-msg-tag-stock";
        tagIcon = "bi-box-seam-fill";
      }

      const tagBadge = msg.tag ? `
        <div>
          <span class="flora-msg-tag-badge ${tagClass}">
            <i class="bi ${tagIcon}"></i> ${msg.tag}
          </span>
        </div>
      ` : "";

      // Direct message header badge
      let directHeader = "";
      if (msg.isDirect) {
        if (isSelf) {
          directHeader = `
            <div>
              <span class="flora-msg-direct-header">
                <i class="bi bi-lock-fill text-purple"></i> ส่งเฉพาะบุคคลถึง: คุณ${escapeHtml(msg.recipientName || "เพื่อนร่วมงาน")}
              </span>
            </div>
          `;
        } else {
          directHeader = `
            <div>
              <span class="flora-msg-direct-header">
                <i class="bi bi-lock-fill text-purple"></i> ข้อความเฉพาะถึงคุณ จาก: คุณ${escapeHtml(msg.senderName || "เพื่อนร่วมงาน")}
              </span>
            </div>
          `;
        }
      }

      // Delivery Status indicator for outgoing messages
      let statusIndicator = "";
      if (isSelf) {
        if (msg.status === "synced") {
          statusIndicator = `<span class="flora-msg-status synced" title="ส่งขึ้นระบบคลาวด์แล้ว"><i class="bi bi-check2-all"></i></span>`;
        } else if (msg.status === "failed") {
          statusIndicator = `<button type="button" class="flora-msg-retry-btn" data-retry-id="${escapeHtml(msg.id)}" title="ส่งไม่สำเร็จ แตะเพื่อลองส่งใหม่"><i class="bi bi-exclamation-circle-fill"></i> ลองส่งใหม่</button>`;
        } else {
          statusIndicator = `<span class="flora-msg-status pending" title="กำลังบันทึกและส่งข้อมูล..."><i class="bi bi-check2"></i></span>`;
        }
      }

      // Quick action link on message
      let replyLink = "";
      if (!isSelf) {
        replyLink = `
          <button type="button" class="flora-msg-reply-link" data-sender-id="${escapeHtml(msg.senderId)}" data-sender-name="${escapeHtml(msg.senderName)}" data-sender-role="${escapeHtml(msg.senderRole || '')}">
            <i class="bi ${msg.isDirect ? 'bi-reply-fill' : 'bi-chat-quote-fill'}"></i> ${msg.isDirect ? "ตอบกลับเฉพาะบุคคล" : "แชทเฉพาะบุคคล"}
          </button>
        `;
      }

      const safeText = escapeHtml(msg.text).replace(/\n/g, "<br>");

      item.innerHTML = `
        <div class="flora-msg-header">
          <span class="flora-msg-sender">${isSelf ? "คุณ" : escapeHtml(msg.senderName || "เพื่อนร่วมงาน")}</span>
          ${msg.senderRole && !isSelf ? `<span class="flora-msg-role-tag">${escapeHtml(msg.senderRole)}</span>` : ""}
        </div>
        <div class="flora-msg-bubble">
          ${directHeader}
          ${tagBadge}
          <div>${safeText}</div>
        </div>
        <div class="d-flex align-items-center justify-content-between mt-1">
          <div class="flora-msg-time">
            <span>${formatThaiDateTime(msg.timestamp)}</span>
            ${statusIndicator}
          </div>
          ${replyLink}
        </div>
      `;

      list.appendChild(item);
    });

    // Wire up retry buttons
    list.querySelectorAll(".flora-msg-retry-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-retry-id");
        if (id) retrySendMessage(id);
      });
    });

    // Wire up quick reply buttons
    list.querySelectorAll(".flora-msg-reply-link").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-sender-id");
        const name = btn.getAttribute("data-sender-name");
        const role = btn.getAttribute("data-sender-role");
        if (name) {
          setRecipient({ id: id || name, name: name, position: role || "เจ้าหน้าที่" });
          document.getElementById("floraTeamInput")?.focus();
        }
      });
    });

    scrollMessageContainer("floraTeamMessageList");
  }

  // ==================== UNREAD BADGE COUNTER ====================
  function incrementUnreadTeamCount() {
    unreadTeamCount++;
    updateUnreadBadgeUI();
  }

  function resetUnreadTeamCount() {
    unreadTeamCount = 0;
    updateUnreadBadgeUI();
  }

  function updateUnreadBadgeUI() {
    const floatBadge = document.getElementById("floraChatUnreadBadge");
    const tabBadge = document.getElementById("floraTeamTabBadge");

    if (unreadTeamCount > 0) {
      if (floatBadge) {
        floatBadge.textContent = unreadTeamCount > 99 ? "99+" : unreadTeamCount;
        floatBadge.classList.remove("d-none");
      }
      if (tabBadge) {
        tabBadge.textContent = unreadTeamCount > 99 ? "99+" : unreadTeamCount;
        tabBadge.classList.remove("d-none");
      }
    } else {
      if (floatBadge) floatBadge.classList.add("d-none");
      if (tabBadge) tabBadge.classList.add("d-none");
    }
  }

  // ==================== FIRESTORE INTEGRATION ====================
  async function initFirestoreListener() {
    try {
      if (window.floraFirebaseBridge?.db || window.db || window.floraDb) {
        connectFirestoreSync();
      }
      window.addEventListener("flora-firebase-ready", () => {
        connectFirestoreSync();
      });
      // Fallback timers in case events fired earlier
      setTimeout(() => {
        if (!firestoreDb) connectFirestoreSync();
      }, 400);
      setTimeout(() => {
        if (!firestoreDb) connectFirestoreSync();
      }, 1500);

      // Auto-reconnect and sync when device wakes up, tab regains focus, or network returns
      window.addEventListener("online", () => {
        connectFirestoreSync();
        flushPendingOutgoingMessages();
      });

      window.addEventListener("focus", () => {
        if (!firestoreDb || !unsubscribeFirestore) {
          connectFirestoreSync();
        } else {
          flushPendingOutgoingMessages();
        }
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          if (!firestoreDb || !unsubscribeFirestore) {
            connectFirestoreSync();
          } else {
            flushPendingOutgoingMessages();
          }
        }
      });
    } catch (e) {
      console.warn("Flora Chat Firestore initialization skipped:", e);
    }
  }

  async function connectFirestoreSync() {
    if (isConnectingFirestore) return;
    isConnectingFirestore = true;

    try {
      const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
      const { getFirestore, initializeFirestore, collection, getDocs, setDoc, doc, onSnapshot, query, orderBy, limit } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");

      // 1. Prefer existing Firestore DB instance from main app bridge
      let targetDb = window.floraFirebaseBridge?.db || window.db || window.floraDb;

      // 2. If not yet initialized by main app, resolve independently
      if (!targetDb) {
        let cfg = window.firebaseConfig || window.floraFirebaseConfig;
        if (!cfg || !cfg.projectId) {
          try {
            const res = await fetch("firebase-applet-config.json");
            if (res.ok) {
              cfg = await res.json();
              window.firebaseConfig = cfg;
              window.floraFirebaseConfig = cfg;
            }
          } catch (e) {}
        }

        if (cfg && cfg.projectId) {
          const app = getApps().length > 0 ? getApp() : initializeApp(cfg);
          const dbId = (cfg.firestoreDatabaseId && cfg.firestoreDatabaseId !== "(default)")
            ? cfg.firestoreDatabaseId
            : undefined;

          const fsSettings = { experimentalForceLongPolling: true, useFetchStreams: false };
          try {
            targetDb = dbId ? initializeFirestore(app, fsSettings, dbId) : initializeFirestore(app, fsSettings);
          } catch (e1) {
            try {
              targetDb = dbId ? getFirestore(app, dbId) : getFirestore(app);
            } catch (e2) {
              console.warn("Chat Firestore fallback warning:", e2);
            }
          }
        }
      }

      if (!targetDb) {
        isConnectingFirestore = false;
        return;
      }

      // If already connected to this same DB instance, simply flush pending
      if (firestoreDb === targetDb && unsubscribeFirestore) {
        isConnectingFirestore = false;
        flushPendingOutgoingMessages();
        return;
      }

      // Clean up previous listener if re-connecting
      if (unsubscribeFirestore) {
        try { unsubscribeFirestore(); } catch (e) {}
        unsubscribeFirestore = null;
      }

      firestoreDb = targetDb;
      window.floraChatFirestoreDb = targetDb;

      // Flush any queued messages that were sent before connection completed
      flushPendingOutgoingMessages();

      // Sync employees directory from Firestore for freshest staff list
      try {
        const empSnap = await getDocs(collection(firestoreDb, "employees"));
        if (empSnap && !empSnap.empty) {
          const fetched = [];
          empSnap.forEach(d => {
            const data = d.data();
            fetched.push({
              id: d.id,
              code: data.code || "",
              name: data.name || "ไม่ระบุชื่อ",
              department: data.department || "ทั่วไป",
              position: data.position || data.role || "เจ้าหน้าที่",
              photoUrl: data.photoUrl || data.avatar || ""
            });
          });
          if (fetched.length > 0) {
            cachedOrgEmployees = fetched;
          }
        }
      } catch (e) {}

      // Listen to team_chat_messages collection for real-time updates
      const q = query(
        collection(firestoreDb, "team_chat_messages"),
        orderBy("timestamp", "asc"),
        limit(150)
      );

      unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        let hasNew = false;
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const msgObj = {
              id: change.doc.id,
              senderId: data.senderId || "",
              senderName: data.senderName || "เพื่อนร่วมงาน",
              senderRole: data.senderRole || "",
              text: data.text || "",
              tag: data.tag || "ทั่วไป",
              recipientId: data.recipientId || null,
              recipientName: data.recipientName || null,
              isDirect: !!data.isDirect,
              timestamp: data.timestamp || new Date().toISOString(),
              status: "synced"
            };

            const existingIdx = teamMessages.findIndex(m => m.id === msgObj.id || (m.timestamp === msgObj.timestamp && m.text === msgObj.text));
            if (existingIdx >= 0) {
              teamMessages[existingIdx].status = "synced";
              teamMessages[existingIdx].id = msgObj.id;
            } else {
              if (isFirstFirestoreLoad) {
                teamMessages.push(msgObj);
                hasNew = true;
              } else {
                handleIncomingTeamMessage(msgObj, true);
              }
            }
          }
        });

        if (isFirstFirestoreLoad) {
          isFirstFirestoreLoad = false;
          teamMessages.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
          saveLocalTeamMessages(teamMessages);
          renderTeamMessages();
        } else {
          saveLocalTeamMessages(teamMessages);
          renderTeamMessages();
        }
      }, (err) => {
        console.warn("Flora Chat Firestore onSnapshot error:", err);
      });

    } catch (err) {
      console.warn("Flora Chat Firestore connect warning:", err);
    } finally {
      isConnectingFirestore = false;
    }
  }

  function flushPendingOutgoingMessages() {
    if (!firestoreDb || pendingOutgoingMessages.length === 0) return;
    const toSend = pendingOutgoingMessages.splice(0, pendingOutgoingMessages.length);
    toSend.forEach(msg => {
      saveMessageToFirestore(msg);
    });
  }

  async function saveMessageToFirestore(msg) {
    if (!firestoreDb) {
      if (!pendingOutgoingMessages.some(m => m.id === msg.id)) {
        pendingOutgoingMessages.push(msg);
      }
      connectFirestoreSync();
      return;
    }
    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const targetDocId = msg.id || ("team_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6));
      await setDoc(doc(firestoreDb, "team_chat_messages", targetDocId), {
        id: targetDocId,
        senderId: msg.senderId || "",
        senderName: msg.senderName || "",
        senderRole: msg.senderRole || "",
        text: msg.text || "",
        tag: msg.tag || "ทั่วไป",
        recipientId: msg.recipientId || null,
        recipientName: msg.recipientName || null,
        isDirect: !!msg.isDirect,
        timestamp: msg.timestamp || new Date().toISOString(),
        createdAt: new Date().toISOString()
      }, { merge: true });

      // Mark message as synced in local memory and UI
      const target = teamMessages.find(m => m.id === msg.id);
      if (target) {
        target.status = "synced";
        target.id = targetDocId;
        saveLocalTeamMessages(teamMessages);
        renderTeamMessages();
      }
    } catch (e) {
      console.warn("Save team chat message to Firestore error:", e);
      // Mark as failed so user sees retry option
      const target = teamMessages.find(m => m.id === msg.id);
      if (target) {
        target.status = "failed";
        saveLocalTeamMessages(teamMessages);
        renderTeamMessages();
      }
      if (!pendingOutgoingMessages.some(m => m.id === msg.id)) {
        pendingOutgoingMessages.push(msg);
      }
      setTimeout(() => {
        flushPendingOutgoingMessages();
      }, 4000);
    }
  }

  // ==================== UTILITY FUNCTIONS ====================
  function scrollMessageContainer(containerId) {
    const el = document.getElementById(containerId);
    if (el) {
      setTimeout(() => {
        el.scrollTop = el.scrollHeight;
      }, 30);
    }
  }

  function escapeHtml(string) {
    if (!string) return "";
    return String(string)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ==================== INITIALIZATION ====================
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectChatWidgetDOM);
  } else {
    injectChatWidgetDOM();
  }

  // Expose public API to window
  window.FloraChatHub = {
    open: openChatPanel,
    close: closeChatPanel,
    toggle: toggleChatPanel,
    switchTab: switchTab,
    updateVisibility: updateMobileChatVisibility
  };

})();
