// ==================== JOB APPLICATION MODULE (job_application.js) ====================
import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  initializeFirestore,
  getFirestore, 
  collection, 
  addDoc, 
  getDocs,
  onSnapshot, 
  doc, 
  getDoc,
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Global module state
let app = null;
let db = null;
let currentSchema = null;
let applicantList = [];
let unsubscribeApplicants = null;
let currentViewingApplicant = null;

// Default Application Form Schema Template (Standard Thai Job Application)
export const DEFAULT_FORM_SCHEMA = {
  title: "ใบสมัครงาน (Job Application Form)",
  description: "โครงการรัตนบุปผา และผลิตดอกไม้ธรรมยาตรา - กรุณากรอกข้อมูลตามความเป็นจริงเพื่อประกอบการพิจารณาคัดเลือกเข้าปฏิบัติงาน",
  fields: [
    {
      id: "sec_personal",
      type: "section_header",
      label: "1. ข้อมูลส่วนตัว (Personal Information)",
      description: "ข้อมูลทั่วไปของผู้สมัครงาน"
    },
    {
      id: "applicant_photo",
      type: "file",
      label: "รูปถ่ายหน้าตรงของผู้สมัคร (Applicant Photo)",
      required: false,
      accept: "image/*",
      helpText: "รูปถ่ายหน้าตรงชัดเจน ขนาดไม่เกิน 5MB"
    },
    {
      id: "position_applied",
      type: "text",
      label: "ตำแหน่งงานที่ต้องการสมัคร (Position Applied For)",
      placeholder: "เช่น เจ้าหน้าที่ธุรการ, พนักงานคลังพัสดุ, ช่างเทคนิค",
      required: true
    },
    {
      id: "expected_salary",
      type: "number",
      label: "เงินเดือนหรือค่าตอบแทนที่คาดหวัง (บาท/เดือน)",
      placeholder: "เช่น 18000",
      required: false
    },
    {
      id: "fullname",
      type: "text",
      label: "ชื่อ-นามสกุล (Full Name)",
      placeholder: "นาย/นาง/นางสาว สมชาย ใจดี",
      required: true
    },
    {
      id: "nickname",
      type: "text",
      label: "ชื่อเล่น (Nickname)",
      placeholder: "เช่น ชาย",
      required: false
    },
    {
      id: "id_card",
      type: "text",
      label: "เลขประจำตัวประชาชน 13 หลัก",
      placeholder: "x-xxxx-xxxxx-xx-x",
      required: true
    },
    {
      id: "birthdate",
      type: "date",
      label: "วัน/เดือน/ปี เกิด (Date of Birth)",
      required: true
    },
    {
      id: "gender",
      type: "radio",
      label: "เพศ (Gender)",
      options: ["ชาย (Male)", "หญิง (Female)", "อื่นๆ (Other)"],
      required: true
    },
    {
      id: "phone",
      type: "tel",
      label: "เบอร์โทรศัพท์ติดต่อ (Phone Number)",
      placeholder: "08x-xxx-xxxx",
      required: true
    },
    {
      id: "email",
      type: "email",
      label: "อีเมล (Email Address)",
      placeholder: "example@gmail.com",
      required: false
    },
    {
      id: "address",
      type: "textarea",
      label: "ที่อยู่ปัจจุบันที่สามารถติดต่อได้สะดวก",
      placeholder: "บ้านเลขที่, หมู่, ถนน, ตำบล/แขวง, อำเภอ/เขต, จังหวัด, รหัสไปรษณีย์",
      required: true
    },
    {
      id: "sec_education",
      type: "section_header",
      label: "2. ประวัติการศึกษา (Education History)",
      description: "ระดับการศึกษาสูงสุดและสถาบันที่สำเร็จการศึกษา"
    },
    {
      id: "education_level",
      type: "select",
      label: "ระดับการศึกษาสูงสุด (Highest Education)",
      options: [
        "มัธยมศึกษาตอนต้น (ม.3)",
        "มัธยมศึกษาตอนปลาย / กศน. (ม.6)",
        "ประกาศนียบัตรวิชาชีพ (ปวช.)",
        "ประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.) / อนุปริญญา",
        "ปริญญาตรี (Bachelor's Degree)",
        "ปริญญาโท (Master's Degree)",
        "ปริญญาเอก (Doctoral Degree)",
        "อื่นๆ"
      ],
      required: true
    },
    {
      id: "education_detail",
      type: "text",
      label: "สาขาวิชา / สถาบันการศึกษา / ปีที่จบ",
      placeholder: "เช่น วิทยาการคอมพิวเตอร์ มหาวิทยาลัยธรรมศาสตร์ (พ.ศ. 2565)",
      required: false
    },
    {
      id: "sec_experience",
      type: "section_header",
      label: "3. ประสบการณ์ทำงาน & ทักษะความสามารถ (Work Experience & Skills)",
      description: "ประวัติการทำงานและทักษะพิเศษ"
    },
    {
      id: "work_experience",
      type: "textarea",
      label: "ประวัติการทำงานที่ผ่านมา (เรียงจากล่าสุด)",
      placeholder: "ระบุชื่อบริษัท, ตำแหน่ง, ระยะเวลาที่ทำ และลักษณะงานโดยย่อ",
      required: false
    },
    {
      id: "special_skills",
      type: "checkbox",
      label: "ทักษะพิเศษและความสามารถ (Special Skills)",
      options: [
        "ขับรถยนต์ได้ (มีใบขับขี่)",
        "ขับขี่รถจักรยานยนต์ได้ (มีใบขับขี่)",
        "ใช้งานคอมพิวเตอร์ / Microsoft Office ได้คล่อง",
        "ทักษะภาษาอังกฤษ (สื่อสารได้)",
        "งานช่างซ่อมบำรุง / ไฟฟ้า / ประปา",
        "งานออกแบบกราฟิก / ถ่ายภาพ / ตัดต่อ",
        "งานจัดซื้อ / บริหารคลังพัสดุ",
        "อื่นๆ"
      ],
      required: false
    },
    {
      id: "available_start_date",
      type: "date",
      label: "วันที่พร้อมเริ่มงาน (Available Start Date)",
      required: true
    },
    {
      id: "sec_attachment",
      type: "section_header",
      label: "4. เอกสารแนบเพิ่มเติม (Attachments)",
      description: "เอกสารประกอบการสมัคร เช่น เรซูเม่ สำเนาบัตรประชาชน หรือวุฒิการศึกษา"
    },
    {
      id: "resume_file",
      type: "file",
      label: "แนบไฟล์ Resume / CV / ผลงาน (ถ้ามี)",
      required: false,
      accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png",
      helpText: "รองรับไฟล์ PDF, Word หรือรูปภาพ"
    }
  ]
};

// Initialize Firebase
export async function initJobApplicationFirebase() {
  let firebaseConfig = {
    apiKey: "AIzaSyCVFTo7glMah6eeubjCLQa6HtIrnwpmrc4",
    authDomain: "flora-gaden.firebaseapp.com",
    projectId: "flora-gaden",
    firestoreDatabaseId: "ai-studio-remixfloratestne-7fc63c6e-7cdb-49cc-b006-9bd6ab3a7926",
    storageBucket: "flora-gaden.firebasestorage.app",
    messagingSenderId: "633519077693",
    appId: "1:633519077693:web:6267796ae34a8286ff6d54"
  };

  try {
    const res = await fetch('firebase-applet-config.json');
    if (res.ok) {
      const cfg = await res.json();
      if (cfg && cfg.projectId) {
        firebaseConfig = { ...firebaseConfig, ...cfg };
      }
    }
  } catch (e) {
    console.warn("Could not load config file, using fallback config", e);
  }

  try {
    app = initializeApp(firebaseConfig, "jobAppInstance_" + Date.now());
  } catch (e) {
    try { app = getApp(); } catch (err) { app = initializeApp(firebaseConfig); }
  }

  const dbId = firebaseConfig.firestoreDatabaseId;
  if (dbId && dbId !== "(default)") {
    db = initializeFirestore(app, {}, dbId);
  } else {
    db = getFirestore(app);
  }

  window.jobAppDb = db;
  return { app, db };
}

// ----------------------------------------------------
// Schema Manager (Load / Save / Reset)
// ----------------------------------------------------
export async function loadFormSchema() {
  if (!db) await initJobApplicationFirebase();

  try {
    const schemaRef = doc(db, "job_application_schemas", "default");
    const snap = await getDoc(schemaRef);
    if (snap.exists()) {
      currentSchema = snap.data();
      console.log("Loaded custom schema from Firestore:", currentSchema);
    } else {
      // Check localStorage
      const local = localStorage.getItem("flora_job_form_schema");
      if (local) {
        currentSchema = JSON.parse(local);
      } else {
        currentSchema = JSON.parse(JSON.stringify(DEFAULT_FORM_SCHEMA));
      }
    }
  } catch (e) {
    console.warn("Error loading schema from Firestore, using default:", e);
    const local = localStorage.getItem("flora_job_form_schema");
    currentSchema = local ? JSON.parse(local) : JSON.parse(JSON.stringify(DEFAULT_FORM_SCHEMA));
  }

  window.currentJobSchema = currentSchema;
  renderApplicantForm();
  renderFormBuilder();
  return currentSchema;
}

export async function saveFormSchema(schemaToSave) {
  if (!db) await initJobApplicationFirebase();
  try {
    currentSchema = schemaToSave;
    localStorage.setItem("flora_job_form_schema", JSON.stringify(currentSchema));
    const schemaRef = doc(db, "job_application_schemas", "default");
    await setDoc(schemaRef, {
      ...currentSchema,
      updatedAt: serverTimestamp()
    });
    console.log("Schema successfully saved to Firestore & LocalStorage");
    renderApplicantForm();
    renderFormBuilder();
    return true;
  } catch (e) {
    console.error("Failed to save schema to Firestore:", e);
    localStorage.setItem("flora_job_form_schema", JSON.stringify(currentSchema));
    renderApplicantForm();
    renderFormBuilder();
    return false;
  }
}

export async function resetFormSchemaToDefault() {
  if (confirm("คุณต้องการคืนค่าแบบฟอร์มเป็นเทมเพลตมาตรฐานเริ่มต้นใช่หรือไม่? (การเปลี่ยนแปลงที่กำหนดเองจะถูกแทนที่)")) {
    const defaultCopy = JSON.parse(JSON.stringify(DEFAULT_FORM_SCHEMA));
    await saveFormSchema(defaultCopy);
    alert("คืนค่าแบบฟอร์มมาตรฐานเรียบร้อยแล้ว");
  }
}

// ----------------------------------------------------
// Form Builder UI & Logic
// ----------------------------------------------------
export function renderFormBuilder() {
  const container = document.getElementById("formBuilderFieldsList");
  if (!container || !currentSchema) return;

  const titleInput = document.getElementById("builderFormTitle");
  const descInput = document.getElementById("builderFormDesc");
  if (titleInput) titleInput.value = currentSchema.title || "";
  if (descInput) descInput.value = currentSchema.description || "";

  container.innerHTML = "";

  if (!currentSchema.fields || currentSchema.fields.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-inbox fs-1 d-block mb-2"></i>
        ยังไม่มีช่องกรอกข้อมูล กดปุ่ม "เพิ่มช่องกรอกข้อมูลใหม่" ด้านล่างเพื่อเริ่มต้น
      </div>
    `;
    return;
  }

  currentSchema.fields.forEach((field, index) => {
    const isSection = field.type === "section_header";
    const fieldCard = document.createElement("div");
    fieldCard.className = `builder-field-item ${isSection ? 'section-header-item' : ''}`;
    fieldCard.dataset.index = index;
    fieldCard.draggable = true;

    // Field Type Label Badge
    const typeBadges = {
      text: '<span class="badge bg-primary fs-9">ข้อความสั้น</span>',
      textarea: '<span class="badge bg-secondary fs-9">ข้อความยาว / ย่อหน้า</span>',
      number: '<span class="badge bg-info text-dark fs-9">ตัวเลข</span>',
      email: '<span class="badge bg-dark fs-9">อีเมล</span>',
      tel: '<span class="badge bg-success fs-9">เบอร์โทร</span>',
      date: '<span class="badge bg-warning text-dark fs-9">วันที่</span>',
      select: '<span class="badge bg-danger fs-9">ตัวเลือก Dropdown</span>',
      radio: '<span class="badge bg-danger fs-9">เลือกข้อเดียว (Radio)</span>',
      checkbox: '<span class="badge bg-danger fs-9">เลือกได้หลายข้อ (Checkbox)</span>',
      file: '<span class="badge bg-success fs-9">แนบไฟล์ / รูปภาพ</span>',
      section_header: '<span class="badge bg-success text-white fs-9"><i class="bi bi-bookmark-fill me-1"></i>หัวข้อส่วน</span>'
    };

    fieldCard.innerHTML = `
      <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
        <div class="d-flex align-items-center gap-2 flex-grow-1">
          <i class="bi bi-grip-vertical drag-handle fs-5" title="ลากเพื่อสลับตำแหน่ง"></i>
          <span class="fw-bold text-dark fs-7">${index + 1}. ${escapeHtml(field.label || "ไม่มีชื่อหัวข้อ")}</span>
          ${field.required ? '<span class="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle fs-9">จำเป็นต้องกรอก</span>' : ''}
          ${typeBadges[field.type] || `<span class="badge bg-light text-dark fs-9">${field.type}</span>`}
        </div>
        <div class="d-flex align-items-center gap-1">
          <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2 rounded-pill fs-8" onclick="window.editFormField(${index})" title="แก้ไขช่องนี้">
            <i class="bi bi-pencil-fill me-1"></i>แก้ไข
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 rounded-pill fs-8" onclick="window.deleteFormField(${index})" title="ลบช่องนี้">
            <i class="bi bi-trash-fill"></i>
          </button>
        </div>
      </div>
      <div class="text-muted fs-8 ps-4">
        ${field.placeholder ? `<span class="me-3"><b>Placeholder:</b> ${escapeHtml(field.placeholder)}</span>` : ''}
        ${field.helpText || field.description ? `<span><b>คำอธิบาย:</b> ${escapeHtml(field.helpText || field.description)}</span>` : ''}
        ${Array.isArray(field.options) && field.options.length ? `<div class="mt-1"><b>ตัวเลือก (${field.options.length} ข้อ):</b> ${escapeHtml(field.options.join(", "))}</div>` : ''}
      </div>
    `;

    // Drag and Drop Events for Reordering
    fieldCard.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index);
      fieldCard.classList.add('dragging');
    });
    fieldCard.addEventListener('dragend', () => {
      fieldCard.classList.remove('dragging');
    });
    fieldCard.addEventListener('dragover', (e) => {
      e.preventDefault();
      fieldCard.classList.add('bg-light');
    });
    fieldCard.addEventListener('dragleave', () => {
      fieldCard.classList.remove('bg-light');
    });
    fieldCard.addEventListener('drop', (e) => {
      e.preventDefault();
      fieldCard.classList.remove('bg-light');
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIndex = index;
      if (!isNaN(fromIndex) && fromIndex !== toIndex) {
        const movedItem = currentSchema.fields.splice(fromIndex, 1)[0];
        currentSchema.fields.splice(toIndex, 0, movedItem);
        saveFormSchema(currentSchema);
      }
    });

    container.appendChild(fieldCard);
  });
}

// Add / Edit Modal Helper
window.openAddFieldModal = function() {
  document.getElementById("fieldModalTitle").textContent = "เพิ่มช่องกรอกข้อมูลใหม่";
  document.getElementById("fieldEditIndex").value = "-1";
  document.getElementById("fieldForm").reset();
  document.getElementById("fieldOptionsContainer").classList.add("d-none");
  document.getElementById("fieldFileOptionsContainer").classList.add("d-none");
  
  const modal = new bootstrap.Modal(document.getElementById("formFieldModal"));
  modal.show();
};

window.editFormField = function(index) {
  if (!currentSchema || !currentSchema.fields[index]) return;
  const field = currentSchema.fields[index];
  
  document.getElementById("fieldModalTitle").textContent = "แก้ไขช่องกรอกข้อมูล (" + (field.label || "") + ")";
  document.getElementById("fieldEditIndex").value = index;
  document.getElementById("fieldTypeSelect").value = field.type || "text";
  document.getElementById("fieldLabelInput").value = field.label || "";
  document.getElementById("fieldPlaceholderInput").value = field.placeholder || "";
  document.getElementById("fieldHelpTextInput").value = field.helpText || field.description || "";
  document.getElementById("fieldRequiredCheck").checked = !!field.required;

  window.onFieldTypeChange();

  if (Array.isArray(field.options)) {
    document.getElementById("fieldOptionsTextarea").value = field.options.join("\n");
  } else {
    document.getElementById("fieldOptionsTextarea").value = "";
  }

  if (field.accept) {
    document.getElementById("fieldAcceptInput").value = field.accept;
  }

  const modal = new bootstrap.Modal(document.getElementById("formFieldModal"));
  modal.show();
};

window.deleteFormField = function(index) {
  if (!currentSchema || !currentSchema.fields[index]) return;
  const label = currentSchema.fields[index].label || `ข้อที่ ${index + 1}`;
  if (confirm(`คุณต้องการลบช่อง "${label}" ใช่หรือไม่?`)) {
    currentSchema.fields.splice(index, 1);
    saveFormSchema(currentSchema);
  }
};

window.onFieldTypeChange = function() {
  const type = document.getElementById("fieldTypeSelect").value;
  const optionsBox = document.getElementById("fieldOptionsContainer");
  const fileBox = document.getElementById("fieldFileOptionsContainer");
  const placeholderBox = document.getElementById("fieldPlaceholderBox");
  const requiredBox = document.getElementById("fieldRequiredBox");

  if (["select", "radio", "checkbox"].includes(type)) {
    optionsBox.classList.remove("d-none");
  } else {
    optionsBox.classList.add("d-none");
  }

  if (type === "file") {
    fileBox.classList.remove("d-none");
  } else {
    fileBox.classList.add("d-none");
  }

  if (type === "section_header") {
    if (placeholderBox) placeholderBox.classList.add("d-none");
    if (requiredBox) requiredBox.classList.add("d-none");
  } else {
    if (placeholderBox) placeholderBox.classList.remove("d-none");
    if (requiredBox) requiredBox.classList.remove("d-none");
  }
};

window.saveFieldFromModal = function() {
  const index = parseInt(document.getElementById("fieldEditIndex").value, 10);
  const type = document.getElementById("fieldTypeSelect").value;
  const label = document.getElementById("fieldLabelInput").value.trim();
  const placeholder = document.getElementById("fieldPlaceholderInput").value.trim();
  const helpText = document.getElementById("fieldHelpTextInput").value.trim();
  const required = document.getElementById("fieldRequiredCheck").checked;
  const optionsRaw = document.getElementById("fieldOptionsTextarea").value.trim();
  const accept = document.getElementById("fieldAcceptInput").value.trim();

  if (!label) {
    alert("กรุณาระบุชื่อคำถาม / ป้ายข้อความ (Label)");
    return;
  }

  const fieldObj = {
    id: index >= 0 && currentSchema.fields[index]?.id ? currentSchema.fields[index].id : "field_" + Date.now(),
    type,
    label,
    placeholder: placeholder || undefined,
    helpText: helpText || undefined,
    required: type === "section_header" ? false : required
  };

  if (type === "section_header") {
    fieldObj.description = helpText;
  }

  if (["select", "radio", "checkbox"].includes(type)) {
    const opts = optionsRaw.split("\n").map(s => s.trim()).filter(Boolean);
    if (opts.length === 0) {
      alert("กรุณาระบุตัวเลือกอย่างน้อย 1 รายการ (บรรทัดละ 1 ตัวเลือก)");
      return;
    }
    fieldObj.options = opts;
  }

  if (type === "file" && accept) {
    fieldObj.accept = accept;
  }

  if (index >= 0) {
    currentSchema.fields[index] = fieldObj;
  } else {
    currentSchema.fields.push(fieldObj);
  }

  saveFormSchema(currentSchema);

  const modalEl = document.getElementById("formFieldModal");
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();
};

window.saveFormHeaderSettings = function() {
  if (!currentSchema) return;
  const title = document.getElementById("builderFormTitle").value.trim();
  const desc = document.getElementById("builderFormDesc").value.trim();

  currentSchema.title = title || "ใบสมัครงาน";
  currentSchema.description = desc;
  saveFormSchema(currentSchema);
  alert("บันทึกการตั้งค่าหัวแบบฟอร์มสำเร็จ");
};

// ----------------------------------------------------
// Applicant Form Renderer & Submission
// ----------------------------------------------------
export function renderApplicantForm() {
  const container = document.getElementById("applicantFormDynamicFields");
  if (!container || !currentSchema) return;

  // Set Title & Description
  const titleEl = document.getElementById("applicantFormTitle");
  const descEl = document.getElementById("applicantFormDesc");
  if (titleEl) titleEl.textContent = currentSchema.title || "ใบสมัครงาน";
  if (descEl) descEl.textContent = currentSchema.description || "";

  container.innerHTML = "";

  if (!currentSchema.fields || currentSchema.fields.length === 0) {
    container.innerHTML = `<div class="alert alert-warning">ยังไม่ได้กำหนดช่องกรอกข้อมูลในแบบฟอร์ม</div>`;
    return;
  }

  currentSchema.fields.forEach((field) => {
    const isRequired = field.required;
    const reqBadge = isRequired ? '<span class="text-danger fw-bold ms-1">*</span>' : '';
    const helpMarkup = field.helpText ? `<small class="form-text text-muted d-block mt-1">${escapeHtml(field.helpText)}</small>` : '';

    if (field.type === "section_header") {
      const secDiv = document.createElement("div");
      secDiv.className = "form-section-title mt-4 mb-3";
      secDiv.innerHTML = `
        <i class="bi bi-bookmark-fill"></i>
        <span>${escapeHtml(field.label)}</span>
      `;
      if (field.description) {
        secDiv.innerHTML += `<div class="w-100 text-muted fs-8 fw-normal mt-1">${escapeHtml(field.description)}</div>`;
      }
      container.appendChild(secDiv);
      return;
    }

    const fieldGroup = document.createElement("div");
    fieldGroup.className = "mb-3";

    switch (field.type) {
      case "text":
      case "number":
      case "email":
      case "tel":
      case "date":
        fieldGroup.innerHTML = `
          <label class="form-label fw-semibold text-dark fs-7" for="${field.id}">
            ${escapeHtml(field.label)} ${reqBadge}
          </label>
          <input type="${field.type}" class="form-control rounded-3" id="${field.id}" name="${field.id}" 
            placeholder="${escapeHtml(field.placeholder || '')}" ${isRequired ? 'required' : ''}>
          ${helpMarkup}
        `;
        break;

      case "textarea":
        fieldGroup.innerHTML = `
          <label class="form-label fw-semibold text-dark fs-7" for="${field.id}">
            ${escapeHtml(field.label)} ${reqBadge}
          </label>
          <textarea class="form-control rounded-3" id="${field.id}" name="${field.id}" rows="3" 
            placeholder="${escapeHtml(field.placeholder || '')}" ${isRequired ? 'required' : ''}></textarea>
          ${helpMarkup}
        `;
        break;

      case "select":
        const optionsHtml = (field.options || []).map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join("");
        fieldGroup.innerHTML = `
          <label class="form-label fw-semibold text-dark fs-7" for="${field.id}">
            ${escapeHtml(field.label)} ${reqBadge}
          </label>
          <select class="form-select rounded-3" id="${field.id}" name="${field.id}" ${isRequired ? 'required' : ''}>
            <option value="">-- โปรดเลือก --</option>
            ${optionsHtml}
          </select>
          ${helpMarkup}
        `;
        break;

      case "radio":
        const radioHtml = (field.options || []).map((opt, idx) => `
          <div class="form-check form-check-inline me-3 mt-1">
            <input class="form-check-input" type="radio" name="${field.id}" id="${field.id}_${idx}" value="${escapeHtml(opt)}" ${isRequired && idx === 0 ? 'required' : ''}>
            <label class="form-check-label fs-7" for="${field.id}_${idx}">${escapeHtml(opt)}</label>
          </div>
        `).join("");
        fieldGroup.innerHTML = `
          <label class="form-label fw-semibold text-dark fs-7 d-block mb-1">
            ${escapeHtml(field.label)} ${reqBadge}
          </label>
          <div class="d-flex flex-wrap gap-2">${radioHtml}</div>
          ${helpMarkup}
        `;
        break;

      case "checkbox":
        const checkHtml = (field.options || []).map((opt, idx) => `
          <div class="form-check me-3 mt-1">
            <input class="form-check-input" type="checkbox" name="${field.id}" id="${field.id}_${idx}" value="${escapeHtml(opt)}">
            <label class="form-check-label fs-7" for="${field.id}_${idx}">${escapeHtml(opt)}</label>
          </div>
        `).join("");
        fieldGroup.innerHTML = `
          <label class="form-label fw-semibold text-dark fs-7 d-block mb-1">
            ${escapeHtml(field.label)} ${reqBadge}
          </label>
          <div class="row row-cols-1 row-cols-md-2 g-2">${checkHtml}</div>
          ${helpMarkup}
        `;
        break;

      case "file":
        const isPhoto = field.id.includes("photo") || (field.accept && field.accept.includes("image"));
        if (isPhoto) {
          fieldGroup.innerHTML = `
            <label class="form-label fw-semibold text-dark fs-7 d-block">
              ${escapeHtml(field.label)} ${reqBadge}
            </label>
            <div class="d-flex align-items-center gap-3">
              <img id="${field.id}_preview" src="https://placehold.co/110x130/e2e8f0/64748b?text=รูปถ่าย" class="photo-preview-avatar" alt="รูปถ่าย">
              <div>
                <input type="file" class="form-control rounded-3" id="${field.id}" name="${field.id}" accept="${field.accept || 'image/*'}" onchange="window.previewApplicantPhoto(this, '${field.id}_preview')" ${isRequired ? 'required' : ''}>
                ${helpMarkup}
              </div>
            </div>
          `;
        } else {
          fieldGroup.innerHTML = `
            <label class="form-label fw-semibold text-dark fs-7" for="${field.id}">
              ${escapeHtml(field.label)} ${reqBadge}
            </label>
            <input type="file" class="form-control rounded-3" id="${field.id}" name="${field.id}" accept="${field.accept || '*/*'}" ${isRequired ? 'required' : ''}>
            ${helpMarkup}
          `;
        }
        break;

      default:
        fieldGroup.innerHTML = `
          <label class="form-label fw-semibold text-dark fs-7" for="${field.id}">${escapeHtml(field.label)}</label>
          <input type="text" class="form-control rounded-3" id="${field.id}" name="${field.id}">
        `;
    }

    container.appendChild(fieldGroup);
  });
}

window.previewApplicantPhoto = function(input, previewImgId) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = document.getElementById(previewImgId);
      if (img) img.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
};

// Helper: Convert File to Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// Handle Form Submission
export async function submitApplicantForm(e) {
  if (e) e.preventDefault();
  if (!db) await initJobApplicationFirebase();

  const form = document.getElementById("applicantMainForm");
  if (!form || !currentSchema) return;

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const btnSubmit = document.getElementById("btnSubmitApplication");
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> กำลังส่งใบสมัคร...`;
  }

  try {
    const formDataObj = {
      submittedAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
      status: "รอพิจารณา", // 'รอพิจารณา', 'นัดสัมภาษณ์', 'ผ่านการคัดเลือก', 'ไม่ผ่าน', 'สละสิทธิ์'
      statusNote: "",
      fieldsData: {}
    };

    // Extract fields
    for (const field of currentSchema.fields) {
      if (field.type === "section_header") continue;

      if (field.type === "radio") {
        const checked = form.querySelector(`input[name="${field.id}"]:checked`);
        formDataObj.fieldsData[field.id] = checked ? checked.value : "";
      } else if (field.type === "checkbox") {
        const checkedBoxes = Array.from(form.querySelectorAll(`input[name="${field.id}"]:checked`)).map(cb => cb.value);
        formDataObj.fieldsData[field.id] = checkedBoxes;
      } else if (field.type === "file") {
        const fileInput = document.getElementById(field.id);
        if (fileInput && fileInput.files && fileInput.files[0]) {
          const file = fileInput.files[0];
          const base64 = await fileToBase64(file);
          formDataObj.fieldsData[field.id] = {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            dataUrl: base64
          };
          if (field.id.includes("photo") || file.type.startsWith("image/")) {
            formDataObj.photoUrl = base64;
          }
        }
      } else {
        const el = document.getElementById(field.id);
        formDataObj.fieldsData[field.id] = el ? el.value.trim() : "";
      }
    }

    // Quick access summary fields for HR dashboard
    formDataObj.applicantName = formDataObj.fieldsData["fullname"] || formDataObj.fieldsData["name"] || "ไม่ระบุชื่อ";
    formDataObj.position = formDataObj.fieldsData["position_applied"] || formDataObj.fieldsData["position"] || "ไม่ระบุตำแหน่ง";
    formDataObj.phone = formDataObj.fieldsData["phone"] || formDataObj.fieldsData["tel"] || "-";
    formDataObj.email = formDataObj.fieldsData["email"] || "-";
    formDataObj.code = "APP-" + Date.now().toString().slice(-6);

    // Save to Firestore
    const docRef = await addDoc(collection(db, "job_applications"), formDataObj);
    formDataObj.id = docRef.id;

    // Show Success Modal
    document.getElementById("submitSuccessCode").textContent = formDataObj.code;
    document.getElementById("submitSuccessName").textContent = formDataObj.applicantName;
    document.getElementById("submitSuccessPosition").textContent = formDataObj.position;
    
    const successModal = new bootstrap.Modal(document.getElementById("submissionSuccessModal"));
    successModal.show();

    // Reset Form
    form.reset();
    const photoPreviews = form.querySelectorAll(".photo-preview-avatar");
    photoPreviews.forEach(p => p.src = "https://placehold.co/110x130/e2e8f0/64748b?text=รูปถ่าย");

  } catch (err) {
    console.error("Submission Error:", err);
    alert("เกิดข้อผิดพลาดในการส่งใบสมัคร กรุณาลองใหม่อีกครั้ง: " + err.message);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<i class="bi bi-send-fill me-2"></i> ยืนยันและส่งใบสมัครงาน`;
    }
  }
}

// ----------------------------------------------------
// HR Review & Applications Management Dashboard
// ----------------------------------------------------
export function listenToApplicants() {
  if (!db) return;
  if (unsubscribeApplicants) unsubscribeApplicants();

  const q = collection(db, "job_applications");
  unsubscribeApplicants = onSnapshot(q, (snapshot) => {
    applicantList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort newest first
    applicantList.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    renderApplicantTable();
    updateApplicantSummaryCounts();
  }, (err) => {
    console.warn("Realtime listener error:", err);
  });
}

export function updateApplicantSummaryCounts() {
  const totalEl = document.getElementById("hrStatTotal");
  const pendingEl = document.getElementById("hrStatPending");
  const interviewEl = document.getElementById("hrStatInterview");
  const approvedEl = document.getElementById("hrStatApproved");

  if (!totalEl) return;

  const total = applicantList.length;
  const pending = applicantList.filter(a => a.status === "รอพิจารณา").length;
  const interview = applicantList.filter(a => a.status === "นัดสัมภาษณ์").length;
  const approved = applicantList.filter(a => a.status === "ผ่านการคัดเลือก" || a.status === "ผ่านการคัดเลือก (รับเข้าทำงานแล้ว)").length;

  totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (interviewEl) interviewEl.textContent = interview;
  if (approvedEl) approvedEl.textContent = approved;
}

export function renderApplicantTable() {
  const tbody = document.getElementById("hrApplicantsTableBody");
  if (!tbody) return;

  const searchKeyword = (document.getElementById("hrSearchApplicantInput")?.value || "").toLowerCase().trim();
  const statusFilter = document.getElementById("hrFilterStatusSelect")?.value || "all";

  const filtered = applicantList.filter(app => {
    const matchStatus = statusFilter === "all" || app.status === statusFilter || (statusFilter === "approved" && (app.status === "ผ่านการคัดเลือก" || app.status === "ผ่านการคัดเลือก (รับเข้าทำงานแล้ว)"));
    const textCorpus = `${app.applicantName || ''} ${app.position || ''} ${app.phone || ''} ${app.code || ''}`.toLowerCase();
    const matchSearch = !searchKeyword || textCorpus.includes(searchKeyword);
    return matchStatus && matchSearch;
  });

  tbody.innerHTML = "";

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5 text-muted">
          <i class="bi bi-inbox fs-2 d-block mb-2"></i>
          ไม่พบข้อมูลผู้สมัครตามเงื่อนไขที่ระบุ
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach((appItem, idx) => {
    const tr = document.createElement("tr");

    // Status Badge
    let badgeClass = "status-badge-pending";
    if (appItem.status === "นัดสัมภาษณ์") badgeClass = "status-badge-interview";
    else if (appItem.status?.includes("ผ่าน")) badgeClass = "status-badge-approved";
    else if (appItem.status === "ไม่ผ่าน") badgeClass = "status-badge-rejected";
    else if (appItem.status === "สละสิทธิ์") badgeClass = "status-badge-withdrawn";

    const photoSrc = appItem.photoUrl || (appItem.fieldsData && appItem.fieldsData.applicant_photo?.dataUrl) || "https://placehold.co/40x40/e2e8f0/64748b?text=รูป";
    const dateFormatted = appItem.submittedAt ? new Date(appItem.submittedAt).toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : "-";

    tr.innerHTML = `
      <td class="text-center fw-bold text-muted fs-8">${idx + 1}</td>
      <td>
        <div class="d-flex align-items-center gap-2.5">
          <img src="${photoSrc}" class="rounded-circle border" style="width: 38px; height: 38px; object-fit: cover;" alt="รูปผู้สมัคร">
          <div>
            <div class="fw-bold text-dark fs-7">${escapeHtml(appItem.applicantName || "ไม่ระบุชื่อ")}</div>
            <small class="text-muted fs-9"><i class="bi bi-qr-code me-1"></i>${escapeHtml(appItem.code || "-")}</small>
          </div>
        </div>
      </td>
      <td>
        <span class="badge bg-light text-primary border border-primary-subtle fs-8 fw-semibold px-2.5 py-1">
          <i class="bi bi-briefcase me-1"></i>${escapeHtml(appItem.position || "-")}
        </span>
      </td>
      <td class="fs-8">
        <div><i class="bi bi-telephone text-success me-1"></i>${escapeHtml(appItem.phone || "-")}</div>
        ${appItem.email && appItem.email !== '-' ? `<small class="text-muted"><i class="bi bi-envelope text-secondary me-1"></i>${escapeHtml(appItem.email)}</small>` : ''}
      </td>
      <td class="fs-8 text-muted">${dateFormatted}</td>
      <td>
        <span class="badge ${badgeClass} rounded-pill px-3 py-1 fs-8 fw-bold">
          ${escapeHtml(appItem.status || "รอพิจารณา")}
        </span>
      </td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <button type="button" class="btn btn-outline-primary rounded-pill px-2.5 py-1 fw-semibold fs-8" onclick="window.viewApplicantDetail('${appItem.id}')" title="ดูรายละเอียดใบสมัคร">
            <i class="bi bi-eye-fill me-1"></i>เปิดดู
          </button>
          <button type="button" class="btn btn-outline-success rounded-pill px-2.5 py-1 fw-semibold fs-8 ms-1" onclick="window.transferApplicantToPersonnel('${appItem.id}')" title="รับเข้าทำงาน / โอนข้อมูลเข้าสู่ระบบบุคลากร">
            <i class="bi bi-person-plus-fill me-1"></i>รับเข้าทำงาน
          </button>
          <button type="button" class="btn btn-outline-danger rounded-pill px-2 py-1 fs-8 ms-1" onclick="window.deleteApplicantRecord('${appItem.id}')" title="ลบใบสมัครนี้">
            <i class="bi bi-trash-fill"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// View Application Detail Modal
window.viewApplicantDetail = function(applicantId) {
  const applicant = applicantList.find(a => a.id === applicantId);
  if (!applicant) return;
  currentViewingApplicant = applicant;

  const modalBody = document.getElementById("applicantDetailModalBody");
  if (!modalBody) return;

  const photoSrc = applicant.photoUrl || (applicant.fieldsData && applicant.fieldsData.applicant_photo?.dataUrl) || "https://placehold.co/120x150/e2e8f0/64748b?text=ไม่มีรูปถ่าย";
  
  let fieldsHtml = "";
  if (currentSchema && currentSchema.fields) {
    currentSchema.fields.forEach(field => {
      if (field.type === "section_header") {
        fieldsHtml += `
          <div class="col-12 mt-3 mb-1">
            <h6 class="fw-bold text-success border-bottom pb-1 mb-0"><i class="bi bi-bookmark-fill me-1"></i>${escapeHtml(field.label)}</h6>
          </div>
        `;
        return;
      }

      const val = applicant.fieldsData ? applicant.fieldsData[field.id] : undefined;
      let displayVal = "-";

      if (val !== undefined && val !== null && val !== "") {
        if (Array.isArray(val)) {
          displayVal = val.join(", ");
        } else if (typeof val === "object" && val.fileName) {
          displayVal = `<a href="${val.dataUrl}" download="${escapeHtml(val.fileName)}" class="btn btn-sm btn-outline-primary py-0 px-2 rounded-pill"><i class="bi bi-file-earmark-arrow-down-fill me-1"></i>ดาวน์โหลด ${escapeHtml(val.fileName)}</a>`;
        } else {
          displayVal = escapeHtml(String(val));
        }
      }

      if (field.type === "file" && (field.id.includes("photo") || field.accept?.includes("image"))) {
        return; // Already shown on top avatar
      }

      fieldsHtml += `
        <div class="col-12 col-md-6 mb-2">
          <div class="p-2 rounded-3 bg-light border-0">
            <small class="text-muted d-block fs-8 fw-semibold">${escapeHtml(field.label)}</small>
            <div class="fw-bold text-dark fs-7 mt-0.5">${displayVal}</div>
          </div>
        </div>
      `;
    });
  }

  modalBody.innerHTML = `
    <div class="p-2">
      <!-- Top Card Header -->
      <div class="d-flex flex-wrap align-items-center gap-3 bg-light p-3 rounded-4 border mb-3">
        <img src="${photoSrc}" class="photo-preview-avatar rounded-3 border" style="width: 100px; height: 120px;" alt="รูปผู้สมัคร">
        <div class="flex-grow-1">
          <div class="d-flex align-items-center gap-2 mb-1">
            <h5 class="fw-bold text-dark mb-0">${escapeHtml(applicant.applicantName || "ไม่ระบุชื่อ")}</h5>
            <span class="badge bg-primary rounded-pill px-2.5 py-1 fs-9">${escapeHtml(applicant.code || "-")}</span>
          </div>
          <div class="text-success fw-bold fs-7 mb-1"><i class="bi bi-briefcase-fill me-1"></i>ตำแหน่งที่สมัคร: ${escapeHtml(applicant.position || "-")}</div>
          <div class="text-muted fs-8"><i class="bi bi-clock me-1"></i>ยื่นใบสมัครเมื่อ: ${applicant.submittedAt ? new Date(applicant.submittedAt).toLocaleString("th-TH") : "-"}</div>
          <div class="mt-2 d-flex align-items-center gap-2">
            <span class="fs-8 fw-bold">สถานะปัจจุบัน:</span>
            <select class="form-select form-select-sm w-auto rounded-pill fw-bold" id="modalChangeStatusSelect" onchange="window.updateApplicantStatus('${applicant.id}', this.value)">
              <option value="รอพิจารณา" ${applicant.status === "รอพิจารณา" ? 'selected' : ''}>⏳ รอพิจารณา</option>
              <option value="นัดสัมภาษณ์" ${applicant.status === "นัดสัมภาษณ์" ? 'selected' : ''}>📅 นัดสัมภาษณ์</option>
              <option value="ผ่านการคัดเลือก" ${applicant.status === "ผ่านการคัดเลือก" || applicant.status === "ผ่านการคัดเลือก (รับเข้าทำงานแล้ว)" ? 'selected' : ''}>✅ ผ่านการคัดเลือก</option>
              <option value="ไม่ผ่าน" ${applicant.status === "ไม่ผ่าน" ? 'selected' : ''}>❌ ไม่ผ่าน</option>
              <option value="สละสิทธิ์" ${applicant.status === "สละสิทธิ์" ? 'selected' : ''}>🚫 สละสิทธิ์</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Application Fields Details Grid -->
      <div class="row g-2">
        ${fieldsHtml}
      </div>
    </div>
  `;

  const modal = new bootstrap.Modal(document.getElementById("applicantDetailModal"));
  modal.show();
};

// Update Application Status in Firestore
window.updateApplicantStatus = async function(applicantId, newStatus) {
  if (!db) await initJobApplicationFirebase();
  try {
    const docRef = doc(db, "job_applications", applicantId);
    await updateDoc(docRef, {
      status: newStatus,
      statusUpdatedAt: serverTimestamp()
    });
    console.log(`Status updated to ${newStatus}`);
  } catch (err) {
    console.error("Error updating status:", err);
    alert("ไม่สามารถอัปเดตสถานะได้: " + err.message);
  }
};

// Transfer Applicant to Personnel / Employees Collection
window.transferApplicantToPersonnel = async function(applicantId) {
  const applicant = applicantList.find(a => a.id === applicantId);
  if (!applicant) return;

  const empName = applicant.applicantName || applicant.fieldsData?.fullname || "ไม่ระบุชื่อ";
  const position = applicant.position || applicant.fieldsData?.position_applied || "พนักงาน";
  const phone = applicant.phone || applicant.fieldsData?.phone || "";
  const email = applicant.email || applicant.fieldsData?.email || "";
  const photo = applicant.photoUrl || (applicant.fieldsData && applicant.fieldsData.applicant_photo?.dataUrl) || "";
  const address = applicant.fieldsData?.address || "";
  const birthdate = applicant.fieldsData?.birthdate || "";
  const gender = applicant.fieldsData?.gender || "";
  const education = applicant.fieldsData?.education_level || "";
  const startDate = applicant.fieldsData?.available_start_date || new Date().toISOString().slice(0, 10);

  if (!confirm(`คุณต้องการอนุมัติรับคุณ "${empName}" เข้าทำงาน และโอนข้อมูลเข้าสู่ระบบบุคลากร (Personnel System) ทันทีใช่หรือไม่?`)) {
    return;
  }

  try {
    if (!db) await initJobApplicationFirebase();

    // Auto-generate employee code or use format EMP-xxx
    const empCode = "EMP" + Math.floor(1000 + Math.random() * 9000);

    const newEmployeeDoc = {
      empCode: empCode,
      name: empName,
      nickname: applicant.fieldsData?.nickname || "",
      position: position,
      department: "ทั่วไป / รอดำเนินการ",
      phone: phone,
      email: email,
      photoUrl: photo,
      imageUrl: photo,
      address: address,
      birthdate: birthdate,
      gender: gender,
      education: education,
      startDate: startDate,
      status: "ปฏิบัติงาน",
      role: "staff",
      createdAt: serverTimestamp(),
      source: "job_application",
      applicationId: applicantId
    };

    // Add to 'employees' collection in Firestore
    const empRef = await addDoc(collection(db, "employees"), newEmployeeDoc);

    // Update status in job_applications collection
    const appRef = doc(db, "job_applications", applicantId);
    await updateDoc(appRef, {
      status: "ผ่านการคัดเลือก (รับเข้าทำงานแล้ว)",
      transferredEmployeeId: empRef.id,
      transferredAt: serverTimestamp()
    });

    alert(`🎉 โอนย้ายข้อมูลสำเร็จ!\nสร้างข้อมูลบุคลากรใหม่: ${empName} (รหัสพนักงาน: ${empCode}) ในระบบบุคลากรเรียบร้อยแล้ว`);

  } catch (err) {
    console.error("Transfer error:", err);
    alert("เกิดข้อผิดพลาดในการโอนข้อมูลเข้าสู่ระบบบุคลากร: " + err.message);
  }
};

// Delete Applicant Record
window.deleteApplicantRecord = async function(applicantId) {
  if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบใบสมัครนี้ออกจากระบบอย่างถาวร?")) return;
  if (!db) await initJobApplicationFirebase();
  try {
    await deleteDoc(doc(db, "job_applications", applicantId));
    console.log("Deleted applicant:", applicantId);
  } catch (err) {
    console.error("Delete error:", err);
    alert("ไม่สามารถลบข้อมูลได้: " + err.message);
  }
};

// Export to Excel/CSV
window.exportApplicantsToCSV = function() {
  if (!applicantList || applicantList.length === 0) {
    alert("ไม่มีข้อมูลผู้สมัครสำหรับส่งออก");
    return;
  }

  const headers = ["รหัสใบสมัคร", "ชื่อ-นามสกุล", "ตำแหน่งที่สมัคร", "เบอร์โทร", "อีเมล", "วันที่ยื่นใบสมัคร", "สถานะ"];
  const rows = applicantList.map(a => [
    `"${a.code || ''}"`,
    `"${a.applicantName || ''}"`,
    `"${a.position || ''}"`,
    `"${a.phone || ''}"`,
    `"${a.email || ''}"`,
    `"${a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('th-TH') : ''}"`,
    `"${a.status || ''}"`
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Flora_Job_Applicants_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Export Schema to JSON file (Backup Form Design)
window.exportFormSchemaJson = function() {
  if (!currentSchema) return;
  const jsonStr = JSON.stringify(currentSchema, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Flora_Job_Form_Schema_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// Import Schema from JSON file
window.importFormSchemaJson = function(fileInput) {
  if (!fileInput.files || !fileInput.files[0]) return;
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed && Array.isArray(parsed.fields)) {
        await saveFormSchema(parsed);
        alert("นำเข้าแบบฟอร์มสำเร็จเรียบร้อย");
      } else {
        alert("ไฟล์ JSON ไม่ถูกต้องตามรูปแบบโครงสร้างแบบฟอร์ม");
      }
    } catch (err) {
      alert("ไม่สามารถอ่านไฟล์ JSON ได้: " + err.message);
    }
  };
  reader.readAsText(file);
};

// Helper: Escape HTML string to avoid XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Global initialization when DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  await initJobApplicationFirebase();
  await loadFormSchema();
  listenToApplicants();

  // Attach search & filter events
  const searchInput = document.getElementById("hrSearchApplicantInput");
  const filterSelect = document.getElementById("hrFilterStatusSelect");
  if (searchInput) searchInput.addEventListener("input", renderApplicantTable);
  if (filterSelect) filterSelect.addEventListener("change", renderApplicantTable);

  const mainForm = document.getElementById("applicantMainForm");
  if (mainForm) mainForm.addEventListener("submit", submitApplicantForm);
});
