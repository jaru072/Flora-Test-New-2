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
  function playPleasantChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
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

  // ==================== STATE MANAGEMENT ====================
  const STORAGE_KEY_TEAM_MSGS = "flora_team_chat_messages_v2";
  const STORAGE_KEY_BOT_MSGS = "flora_bot_chat_messages_v2";
  const STORAGE_KEY_USER_NAME = "flora_chat_custom_username";

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
  let activeTab = "assistant"; // "assistant" | "team"
  let unreadTeamCount = 0;
  let selectedTeamTag = "ทั่วไป";
  let broadcastChannel = null;
  let firestoreDb = null;
  let unsubscribeFirestore = null;

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
    try {
      customName = localStorage.getItem(STORAGE_KEY_USER_NAME) || "";
    } catch (e) {}

    const authUser = window.auth?.currentUser || window.currentAuthUser;
    const profile = window.currentUserProfile;

    let name = customName || authUser?.displayName || profile?.displayName || "";
    let email = authUser?.email || profile?.email || "";
    let role = profile?.role || window.currentUserRole || "เจ้าหน้าที่";

    if (!name && email) {
      name = email.split("@")[0];
    }
    if (!name) {
      name = "เจ้าหน้าที่ปฏิบัติงาน";
    }

    return {
      name: name,
      email: email,
      role: role,
      id: authUser?.uid || profile?.uid || "user_" + Math.random().toString(36).substring(2, 8)
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
          <button type="button" class="flora-chat-tab-btn is-active" id="floraTabAssistantBtn">
            <i class="bi bi-stars text-warning"></i>
            <span>ผู้ช่วย</span>
          </button>
          <button type="button" class="flora-chat-tab-btn" id="floraTabTeamBtn">
            <i class="bi bi-people-fill"></i>
            <span>เพื่อน</span>
            <span class="flora-chat-tab-badge d-none" id="floraTeamTabBadge">0</span>
          </button>
        </div>
      </div>

      <!-- Body Area -->
      <div class="flora-chat-body">
        
        <!-- ===== TAB 1: ASSISTANT CONTENT ===== -->
        <div class="flora-chat-tab-content is-active" id="floraAssistantTabContent">
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

        <!-- ===== TAB 2: TEAM / PEER CONTENT ===== -->
        <div class="flora-chat-tab-content" id="floraTeamTabContent">
          <!-- Identity Sub-Bar -->
          <div class="flora-team-bar">
            <div class="flora-team-user-info">
              <div class="flora-team-user-avatar" id="floraTeamCurrentAvatar">คุณ</div>
              <div>
                <span class="text-muted" style="font-size: 10.5px;">ชื่อของคุณ:</span>
                <span class="flora-team-user-name" id="floraTeamCurrentName">ผู้ใช้งาน</span>
              </div>
            </div>
            <button type="button" class="flora-team-edit-btn" id="floraTeamChangeNameBtn">
              <i class="bi bi-pencil-square"></i> เปลี่ยนชื่อ
            </button>
          </div>

          <!-- Team Message List -->
          <div class="flora-chat-messages" id="floraTeamMessageList"></div>

          <!-- Team Input Footer -->
          <div class="flora-chat-footer">
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
    `;

    document.body.appendChild(panel);

    setupEventListeners();
    renderAssistantMessages();
    renderTeamMessages();
    initFirestoreListener();
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

    // Change custom user name
    if (changeNameBtn) {
      changeNameBtn.addEventListener("click", promptChangeUserName);
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

    // Reset unread if opening team tab
    if (activeTab === "team") {
      resetUnreadTeamCount();
    }

    // Update user identity display
    updateUserIdentityHeader();

    // Auto focus active input
    setTimeout(() => {
      if (activeTab === "assistant") {
        document.getElementById("floraAssistantInput")?.focus();
        scrollMessageContainer("floraAssistantMessageList");
      } else {
        document.getElementById("floraTeamInput")?.focus();
        scrollMessageContainer("floraTeamMessageList");
      }
    }, 150);
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

  function promptChangeUserName() {
    const current = getCurrentUserIdentity();
    const newName = prompt("ระบุชื่อหรือตำแหน่งของคุณที่ต้องการแสดงในการสนทนากลุ่ม:", current.name);
    if (newName && newName.trim() && newName.trim() !== current.name) {
      try {
        localStorage.setItem(STORAGE_KEY_USER_NAME, newName.trim());
      } catch (e) {}
      updateUserIdentityHeader();
      renderTeamMessages();
    }
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
      timestamp: new Date().toISOString()
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

  function handleIncomingTeamMessage(msg, fromFirestore = false) {
    if (!msg || !msg.id) return;
    const exists = teamMessages.some(m => m.id === msg.id);
    if (exists) return;

    teamMessages.push(msg);
    saveLocalTeamMessages(teamMessages);
    renderTeamMessages();

    const currentUser = getCurrentUserIdentity();
    const isFromSelf = msg.senderId === currentUser.id || msg.senderName === currentUser.name;

    if (!isFromSelf) {
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

    if (teamMessages.length === 0) {
      list.innerHTML = `
        <div class="flora-empty-chat">
          <div class="flora-empty-icon"><i class="bi bi-chat-heart"></i></div>
          <div class="flora-empty-title">ยังไม่มีข้อความสนทนา</div>
          <div class="flora-empty-desc">เริ่มพิมพ์ข้อความแรกเพื่อประสานงานกับเพื่อนร่วมงานในองค์กรได้เลยครับ</div>
        </div>
      `;
      return;
    }

    const currentUser = getCurrentUserIdentity();

    teamMessages.forEach(msg => {
      const isSelf = msg.senderId === currentUser.id || msg.senderName === currentUser.name;
      const item = document.createElement("div");
      item.className = `flora-msg-item ${isSelf ? "outgoing" : "incoming"}`;

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

      const safeText = escapeHtml(msg.text).replace(/\n/g, "<br>");

      item.innerHTML = `
        <div class="flora-msg-header">
          <span class="flora-msg-sender">${isSelf ? "คุณ" : escapeHtml(msg.senderName || "เพื่อนร่วมงาน")}</span>
          ${msg.senderRole && !isSelf ? `<span class="flora-msg-role-tag">${escapeHtml(msg.senderRole)}</span>` : ""}
        </div>
        <div class="flora-msg-bubble">
          ${tagBadge}
          <div>${safeText}</div>
        </div>
        <div class="flora-msg-time">${formatThaiDateTime(msg.timestamp)}</div>
      `;

      list.appendChild(item);
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
      // Check if Firebase config is ready or wait for event
      if (!window.firebaseConfig && !window.floraFirebaseConfig) {
        window.addEventListener("flora-firebase-ready", () => {
          connectFirestoreSync();
        }, { once: true });
      } else {
        connectFirestoreSync();
      }
    } catch (e) {
      console.warn("Flora Chat Firestore initialization skipped:", e);
    }
  }

  async function connectFirestoreSync() {
    try {
      const cfg = window.firebaseConfig || window.floraFirebaseConfig;
      if (!cfg) return;

      const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
      const { getFirestore, initializeFirestore, collection, addDoc, onSnapshot, query, orderBy, limit } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");

      let app = getApps().length > 0 ? getApp() : initializeApp(cfg);
      const dbId = cfg.firestoreDatabaseId;
      if (dbId && dbId !== "(default)") {
        firestoreDb = initializeFirestore(app, {}, dbId);
      } else {
        firestoreDb = getFirestore(app);
      }

      // Listen to team_chat_messages collection
      const q = query(
        collection(firestoreDb, "team_chat_messages"),
        orderBy("timestamp", "asc"),
        limit(100)
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
              timestamp: data.timestamp || new Date().toISOString()
            };

            const exists = teamMessages.some(m => m.id === msgObj.id || (m.timestamp === msgObj.timestamp && m.text === msgObj.text));
            if (!exists) {
              teamMessages.push(msgObj);
              hasNew = true;
              const currentUser = getCurrentUserIdentity();
              if (msgObj.senderId !== currentUser.id && msgObj.senderName !== currentUser.name) {
                if (!isChatOpen || activeTab !== "team") {
                  incrementUnreadTeamCount();
                }
              }
            }
          }
        });

        if (hasNew) {
          saveLocalTeamMessages(teamMessages);
          renderTeamMessages();
        }
      }, (err) => {
        console.warn("Flora Chat Firestore onSnapshot error:", err);
      });
    } catch (err) {
      console.warn("Flora Chat Firestore connect warning:", err);
    }
  }

  async function saveMessageToFirestore(msg) {
    if (!firestoreDb) return;
    try {
      const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      await addDoc(collection(firestoreDb, "team_chat_messages"), {
        senderId: msg.senderId || "",
        senderName: msg.senderName || "",
        senderRole: msg.senderRole || "",
        text: msg.text || "",
        tag: msg.tag || "ทั่วไป",
        timestamp: msg.timestamp || new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Save team chat message to Firestore error:", e);
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
    switchTab: switchTab
  };

})();
