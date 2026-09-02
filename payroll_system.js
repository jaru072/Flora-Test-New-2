/**
 * Payroll System Engine & UI Module (ระบบเงินเดือนและสลิปเงินเดือน)
 * Flora Garden & Project Rattanabuppha
 */
(function() {
  'use strict';

  // Core State
  const payrollState = {
    periods: [],
    currentPeriodId: null,
    currentPeriod: null,
    records: [],
    employees: [],
    attendanceLogs: [],
    filterDepartment: 'ALL',
    filterWageType: 'ALL',
    searchQuery: '',
    selectedRecord: null,
    isLoading: false,
    currentUser: null,
    isAdmin: false
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const fmtNum = (n, decimals = 2) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const fmtCurrency = (n) => `฿${fmtNum(n)}`;

  const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  function showToast(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
    } else {
      console.log('Toast:', msg);
    }
  }

  // Check Admin Authority
  function checkAdminAuth() {
    if (window.auth?.currentUser?.email === 'jaru072@gmail.com') return true;
    if (window.currentUserRole === 'ADMIN' || window.currentUserRole === 'SUPER_ADMIN') return true;
    if (payrollState.isAdmin) return true;
    return false;
  }

  // Tax and Social Security Calculation (Thai Standard)
  function calculateSocialSecurity(baseSalary) {
    // 5% capped at base salary 15,000 THB (Max 750 THB)
    const cappedBase = Math.min(Math.max(baseSalary, 0), 15000);
    return Math.round(cappedBase * 0.05);
  }

  function calculateTaxDeduction(totalEarnings) {
    // Simplified estimated progressive tax or fixed zero for low income
    const annualEst = totalEarnings * 12;
    if (annualEst <= 150000) return 0;
    if (annualEst <= 300000) return Math.round(((annualEst - 150000) * 0.05) / 12);
    if (annualEst <= 500000) return Math.round((7500 + (annualEst - 300000) * 0.10) / 12);
    return Math.round((27500 + (annualEst - 500000) * 0.15) / 12);
  }

  // ==================== FIRESTORE DATA SYNC & RESILIENCE ====================
  async function ensurePayrollDatabase() {
    if (window.db) return window.db;

    try {
      let cfg = window.firebaseConfig || window.floraFirebaseConfig;
      if (!cfg || !cfg.projectId) {
        try {
          const res = await fetch('firebase-applet-config.json');
          if (res.ok) {
            cfg = await res.json();
            window.firebaseConfig = cfg;
            window.floraFirebaseConfig = cfg;
          }
        } catch (e) {}
      }

      if (!cfg || !cfg.projectId) {
        cfg = {
          apiKey: "AIzaSyCVFTo7glMah6eeubjCLQa6HtIrnwpmrc4",
          authDomain: "flora-gaden.firebaseapp.com",
          projectId: "flora-gaden",
          firestoreDatabaseId: "ai-studio-remixfloratestne-7fc63c6e-7cdb-49cc-b006-9bd6ab3a7926",
          storageBucket: "flora-gaden.firebasestorage.app",
          messagingSenderId: "633519077693",
          appId: "1:633519077693:web:6267796ae34a8286ff6d54"
        };
      }

      const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
      const { getFirestore, initializeFirestore, doc, onSnapshot, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');

      let app;
      const apps = getApps();
      if (apps.length > 0) {
        app = apps[0];
      } else {
        app = initializeApp(cfg);
      }

      const dbId = cfg.firestoreDatabaseId;
      if (dbId && dbId !== "(default)") {
        window.db = initializeFirestore(app, {}, dbId);
      } else {
        window.db = getFirestore(app);
      }

      window.floraFirebaseBridge = {
        db: window.db,
        doc,
        onSnapshot,
        getDoc,
        setDoc
      };
      window.dispatchEvent(new CustomEvent('flora-firebase-ready'));

      if (typeof window.connectGlobalLogoFirestore === 'function') {
        window.connectGlobalLogoFirestore(window.floraFirebaseBridge);
      }
      if (typeof window.updateAllFloraTitles === 'function') {
        window.updateAllFloraTitles();
      }

      return window.db;
    } catch (e) {
      console.warn('ensurePayrollDatabase error:', e);
      return window.db || null;
    }
  }

  async function loadPayrollPeriods() {
    const db = await ensurePayrollDatabase();
    if (!db) {
      payrollState.isLoading = false;
      renderPeriodsSelector();
      renderPayrollRecordsTable();
      return;
    }
    try {
      payrollState.isLoading = true;
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const snap = await getDocs(collection(db, 'payroll_periods'));
      const periods = [];
      snap.forEach(doc => {
        periods.push({ id: doc.id, ...doc.data() });
      });

      // Sort in-memory to prevent missing composite-index Firestore errors
      periods.sort((a, b) => {
        const yA = Number(a.year) || 0;
        const yB = Number(b.year) || 0;
        if (yB !== yA) return yB - yA;
        const mA = Number(a.month) || 0;
        const mB = Number(b.month) || 0;
        return mB - mA;
      });

      payrollState.periods = periods;
      
      // Auto-select latest or current
      if (!payrollState.currentPeriodId && periods.length > 0) {
        payrollState.currentPeriodId = periods[0].id;
        payrollState.currentPeriod = periods[0];
      } else if (payrollState.currentPeriodId) {
        payrollState.currentPeriod = periods.find(p => p.id === payrollState.currentPeriodId) || periods[0] || null;
      }
      
      renderPeriodsSelector();
      if (payrollState.currentPeriodId) {
        await loadPayrollRecords(payrollState.currentPeriodId);
      } else {
        renderPayrollRecordsTable();
      }
    } catch (err) {
      console.warn('Error loading payroll periods:', err);
      renderPeriodsSelector();
      renderPayrollRecordsTable();
    } finally {
      payrollState.isLoading = false;
    }
  }

  async function loadPayrollRecords(periodId) {
    const db = await ensurePayrollDatabase();
    if (!db || !periodId) {
      renderPayrollRecordsTable();
      return;
    }
    try {
      const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const q = query(collection(db, 'payroll_records'), where('periodId', '==', periodId));
      const snap = await getDocs(q);
      const records = [];
      snap.forEach(doc => {
        records.push({ id: doc.id, ...doc.data() });
      });
      payrollState.records = records;
      renderPayrollSummaryCards();
      renderPayrollRecordsTable();
    } catch (err) {
      console.warn('Error loading payroll records:', err);
      renderPayrollSummaryCards();
      renderPayrollRecordsTable();
    }
  }

  // Load active personnel for calculation
  async function loadEmployees() {
    const db = await ensurePayrollDatabase();
    if (!db) return;
    try {
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const snap = await getDocs(collection(db, 'employees'));
      const list = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.status !== 'พ้นสภาพ') {
          list.push({ id: doc.id, ...d });
        }
      });
      payrollState.employees = list;
    } catch (e) {
      console.warn('Error loading employees for payroll:', e);
    }
  }

  // Load attendance logs for a period
  async function loadAttendanceLogs(startDate, endDate) {
    const db = await ensurePayrollDatabase();
    if (!db) return [];
    try {
      const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      let q = collection(db, 'attendance');
      if (startDate && endDate) {
        q = query(q, where('dateKey', '>=', startDate), where('dateKey', '<=', endDate));
      }
      const snap = await getDocs(q);
      const logs = [];
      snap.forEach(d => logs.push({ id: d.id, ...d.data() }));
      return logs;
    } catch (e) {
      console.warn('Error fetching attendance logs:', e);
      return [];
    }
  }

  // ==================== CALCULATION & WORKFLOW ====================

  // Create new period
  async function createPayrollPeriod(month, year, startDate, endDate, payDate) {
    if (!checkAdminAuth()) {
      showToast('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถสร้างงวดเงินเดือนได้');
      return;
    }
    const db = await ensurePayrollDatabase();
    if (!db) return;

    const title = `งวดประจำเดือน ${THAI_MONTHS[month - 1]} ${year + 543}`;
    const periodData = {
      title,
      month: Number(month),
      year: Number(year),
      startDate,
      endDate,
      payDate,
      status: 'draft',
      totalEmployees: 0,
      totalBaseSalary: 0,
      totalOt: 0,
      totalAllowances: 0,
      totalDeductions: 0,
      totalSocialSecurity: 0,
      totalTax: 0,
      totalNetPay: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: window.auth?.currentUser?.email || 'admin'
    };

    try {
      const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const docRef = await addDoc(collection(db, 'payroll_periods'), periodData);
      payrollState.currentPeriodId = docRef.id;
      showToast(`สร้างงวด "${title}" เรียบร้อยแล้ว`);
      
      // Auto-generate records for active employees
      await autoCalculatePeriodRecords(docRef.id, startDate, endDate);
      await loadPayrollPeriods();
    } catch (err) {
      console.error('Error creating period:', err);
      showToast('ไม่สามารถสร้างงวดเงินเดือนได้');
    }
  }

  // Detect wage type from employee profile
  function detectEmployeeWageType(emp) {
    if (emp.wageType && ['monthly', 'daily', 'weekly'].includes(emp.wageType.toLowerCase())) {
      return emp.wageType.toLowerCase();
    }
    const combinedStr = `${emp.employmentType || ''} ${emp.role || ''} ${emp.position || ''} ${emp.notes || ''} ${emp.paymentType || ''}`.toLowerCase();
    if (combinedStr.includes('รายวัน') || combinedStr.includes('daily')) return 'daily';
    if (combinedStr.includes('รายสัปดาห์') || combinedStr.includes('weekly')) return 'weekly';
    
    // If salary is <= 1000 and > 0, it's typically a daily wage
    const rawSal = Number(emp.salary || emp.baseSalary || 0);
    if (rawSal > 0 && rawSal <= 1000) return 'daily';
    if (rawSal > 1000 && rawSal <= 5000 && combinedStr.includes('สัปดาห์')) return 'weekly';

    return 'monthly';
  }

  // Auto-calculate records for employees
  async function autoCalculatePeriodRecords(periodId, startDate, endDate) {
    const db = await ensurePayrollDatabase();
    if (!db || !periodId) return;
    await loadEmployees();
    const attendance = await loadAttendanceLogs(startDate, endDate);

    const { collection, addDoc, doc, updateDoc, writeBatch } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    const batch = writeBatch(db);

    let sumBase = 0;
    let sumOt = 0;
    let sumAllow = 0;
    let sumDeduct = 0;
    let sumSS = 0;
    let sumTax = 0;
    let sumNet = 0;
    let count = 0;

    for (const emp of payrollState.employees) {
      // Analyze attendance for this employee
      const empLogs = attendance.filter(a => String(a.employeeId) === String(emp.id) || String(a.employeeCode) === String(emp.code));
      
      const wageType = detectEmployeeWageType(emp);
      let wageRate = 0;
      let workUnits = 1;
      let baseSalary = 0;
      let dailyRate = 0;
      let hourlyRate = 0;

      if (wageType === 'daily') {
        // Daily wage calculation
        wageRate = Number(emp.dailyWage || emp.wageRate || (emp.salary && Number(emp.salary) <= 1000 ? emp.salary : Math.round((emp.salary || 15000) / 30)) || 450);
        workUnits = Number(emp.workDays || (empLogs.length > 0 ? empLogs.length : 26)); // Default 26 worked days or actual logs
        baseSalary = Math.round(wageRate * workUnits);
        dailyRate = wageRate;
        hourlyRate = Math.round(dailyRate / 8);
      } else if (wageType === 'weekly') {
        // Weekly wage calculation
        wageRate = Number(emp.weeklyWage || emp.wageRate || (emp.salary && Number(emp.salary) <= 5000 && Number(emp.salary) > 1000 ? emp.salary : Math.round((emp.salary || 15000) / 4)) || 3500);
        workUnits = Number(emp.workWeeks || 4); // Default 4 weeks
        baseSalary = Math.round(wageRate * workUnits);
        dailyRate = Math.round(wageRate / 6);
        hourlyRate = Math.round(dailyRate / 8);
      } else {
        // Monthly wage calculation (Default)
        wageRate = Number(emp.salary || emp.baseSalary || 15000);
        workUnits = 1;
        baseSalary = wageRate;
        dailyRate = Math.round(baseSalary / 30);
        hourlyRate = Math.round(dailyRate / 8);
      }

      // Estimate OT & attendance (e.g. from attendance logs)
      const otHours = Number(emp.otHours || 0);
      const otRate = Number(hourlyRate * 1.5);
      const otAmount = Math.round(otHours * otRate);

      const diligenceAllowance = Number(emp.diligenceAllowance || 1000); // เบี้ยขยัน
      const positionAllowance = Number(emp.positionAllowance || 0);
      const bonus = Number(emp.bonus || 0);
      const otherEarnings = Number(emp.otherEarnings || 0);

      const totalEarnings = baseSalary + otAmount + diligenceAllowance + positionAllowance + bonus + otherEarnings;

      const lateMinutes = Number(emp.lateMinutes || 0);
      const lateDeduction = Number(emp.lateDeduction || 0);
      const absenceDays = Number(emp.absenceDays || 0);
      // For daily wage, absence is naturally reflected in worked days unless specified
      const absenceDeduction = wageType === 'daily' ? 0 : (absenceDays * dailyRate);
      const leaveDeduction = Number(emp.leaveDeduction || 0);

      const socialSecurity = calculateSocialSecurity(baseSalary);
      const tax = calculateTaxDeduction(totalEarnings);
      const otherDeductions = Number(emp.otherDeductions || 0);

      const totalDeductions = lateDeduction + absenceDeduction + leaveDeduction + socialSecurity + tax + otherDeductions;
      const netPay = Math.max(0, totalEarnings - totalDeductions);

      const recordRef = doc(collection(window.db, 'payroll_records'));
      const recordData = {
        periodId,
        employeeId: String(emp.id || emp.code || ''),
        employeeCode: String(emp.code || emp.id || ''),
        employeeName: emp.name || 'ไม่ระบุชื่อ',
        department: emp.department || 'ทั่วไป',
        position: emp.role || emp.position || 'พนักงาน',
        bankName: emp.bankName || 'ธนาคารกสิกรไทย',
        bankAccount: emp.bankAccount || emp.accountNo || '-',
        wageType,
        wageRate,
        workUnits,
        baseSalary,
        dailyRate,
        otHours,
        otRate,
        otAmount,
        diligenceAllowance,
        positionAllowance,
        bonus,
        otherEarnings,
        totalEarnings,
        lateMinutes,
        lateDeduction,
        absenceDays,
        absenceDeduction,
        leaveDeduction,
        socialSecurity,
        tax,
        otherDeductions,
        totalDeductions,
        netPay,
        status: 'calculated',
        remarks: emp.payrollRemarks || '',
        attendanceCount: empLogs.length,
        updatedAt: new Date().toISOString()
      };

      batch.set(recordRef, recordData);

      sumBase += baseSalary;
      sumOt += otAmount;
      sumAllow += (diligenceAllowance + positionAllowance + bonus + otherEarnings);
      sumDeduct += (lateDeduction + absenceDeduction + leaveDeduction + otherDeductions);
      sumSS += socialSecurity;
      sumTax += tax;
      sumNet += netPay;
      count++;
    }

    // Update Period Summary
    const periodRef = doc(db, 'payroll_periods', periodId);
    batch.update(periodRef, {
      totalEmployees: count,
      totalBaseSalary: sumBase,
      totalOt: sumOt,
      totalAllowances: sumAllow,
      totalDeductions: sumDeduct,
      totalSocialSecurity: sumSS,
      totalTax: sumTax,
      totalNetPay: sumNet,
      updatedAt: new Date().toISOString()
    });

    await batch.commit();
    showToast(`คำนวณเงินเดือนสำเร็จ ${count} รายชื่อ (รองรับรายวัน/สัปดาห์/เดือน)`);
  }

  // Save individual record edit
  async function saveRecordAdjustment(recordId, updatedFields) {
    if (!checkAdminAuth()) {
      showToast('เฉพาะ Admin เท่านั้นที่แก้ไขรายการเงินเดือนได้');
      return;
    }
    const db = await ensurePayrollDatabase();
    if (!db || !recordId) return;

    try {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      
      const wageType = updatedFields.wageType || 'monthly';
      const wageRate = Number(updatedFields.wageRate || 0);
      const workUnits = Number(updatedFields.workUnits || 1);
      const baseSalary = Number(updatedFields.baseSalary || 0);

      const otAmount = Number(updatedFields.otAmount || 0);
      const diligenceAllowance = Number(updatedFields.diligenceAllowance || 0);
      const positionAllowance = Number(updatedFields.positionAllowance || 0);
      const bonus = Number(updatedFields.bonus || 0);
      const otherEarnings = Number(updatedFields.otherEarnings || 0);
      const totalEarnings = baseSalary + otAmount + diligenceAllowance + positionAllowance + bonus + otherEarnings;

      const lateDeduction = Number(updatedFields.lateDeduction || 0);
      const absenceDeduction = Number(updatedFields.absenceDeduction || 0);
      const leaveDeduction = Number(updatedFields.leaveDeduction || 0);
      const socialSecurity = updatedFields.socialSecurity !== undefined ? Number(updatedFields.socialSecurity) : calculateSocialSecurity(baseSalary);
      const tax = updatedFields.tax !== undefined ? Number(updatedFields.tax) : calculateTaxDeduction(totalEarnings);
      const otherDeductions = Number(updatedFields.otherDeductions || 0);
      const totalDeductions = lateDeduction + absenceDeduction + leaveDeduction + socialSecurity + tax + otherDeductions;
      const netPay = Math.max(0, totalEarnings - totalDeductions);

      const payload = {
        ...updatedFields,
        wageType,
        wageRate,
        workUnits,
        baseSalary,
        otAmount,
        diligenceAllowance,
        positionAllowance,
        bonus,
        otherEarnings,
        totalEarnings,
        lateDeduction,
        absenceDeduction,
        leaveDeduction,
        socialSecurity,
        tax,
        otherDeductions,
        totalDeductions,
        netPay,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'payroll_records', recordId), payload);
      showToast('บันทึกการปรับปรุงเงินเดือนเรียบร้อย');
      if (payrollState.currentPeriodId) {
        await loadPayrollRecords(payrollState.currentPeriodId);
      }
    } catch (err) {
      console.error('Error updating payroll record:', err);
      showToast('บันทึกข้อมูลไม่สำเร็จ');
    }
  }

  // Update Period Status (Approve / Mark Paid)
  async function updatePeriodStatus(periodId, newStatus) {
    if (!checkAdminAuth()) {
      showToast('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น');
      return;
    }
    const db = await ensurePayrollDatabase();
    if (!db || !periodId) return;

    try {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      await updateDoc(doc(db, 'payroll_periods', periodId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      showToast(`เปลี่ยนสถานะงวดเป็น "${newStatus === 'approved' ? 'อนุมัติแล้ว' : newStatus === 'paid' ? 'จ่ายเงินแล้ว' : newStatus}" สำเร็จ`);
      await loadPayrollPeriods();
    } catch (e) {
      console.error('Status update error:', e);
      showToast('ไม่สามารถอัปเดตสถานะได้');
    }
  }

  // ==================== UI RENDERING ====================

  function renderPeriodsSelector() {
    const select = $('payrollPeriodSelect');
    if (!select) return;

    if (!payrollState.periods.length) {
      select.innerHTML = '<option value="">-- ยังไม่มีงวดเงินเดือน --</option>';
      return;
    }

    select.innerHTML = payrollState.periods.map(p => {
      const isSelected = p.id === payrollState.currentPeriodId ? 'selected' : '';
      const statusBadge = p.status === 'paid' ? ' [จ่ายแล้ว]' : p.status === 'approved' ? ' [อนุมัติ]' : ' [ร่าง]';
      return `<option value="${p.id}" ${isSelected}>${esc(p.title)}${statusBadge}</option>`;
    }).join('');

    // Period Status Badge in Header
    const badgeEl = $('payrollPeriodStatusBadge');
    if (badgeEl) {
      if (payrollState.currentPeriod) {
        const st = payrollState.currentPeriod.status;
        if (st === 'paid') {
          badgeEl.className = 'badge bg-success px-2.5 py-1 rounded-pill';
          badgeEl.innerHTML = '<i class="bi bi-check-all me-1"></i> จ่ายเงินแล้ว';
        } else if (st === 'approved') {
          badgeEl.className = 'badge bg-primary px-2.5 py-1 rounded-pill';
          badgeEl.innerHTML = '<i class="bi bi-shield-check me-1"></i> อนุมัติแล้ว';
        } else {
          badgeEl.className = 'badge bg-warning text-dark px-2.5 py-1 rounded-pill';
          badgeEl.innerHTML = '<i class="bi bi-pencil me-1"></i> ฉบับร่าง (กำลังตรวจสอบ)';
        }
      } else {
        badgeEl.className = 'badge bg-secondary px-2.5 py-1 rounded-pill';
        badgeEl.innerHTML = 'ไม่มีงวด';
      }
    }
  }

  function renderPayrollSummaryCards() {
    const current = payrollState.currentPeriod;
    const records = payrollState.records;

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let totalSocialSecurity = 0;
    let totalTax = 0;

    records.forEach(r => {
      totalGross += Number(r.totalEarnings || 0);
      totalDeductions += Number(r.totalDeductions || 0);
      totalNet += Number(r.netPay || 0);
      totalSocialSecurity += Number(r.socialSecurity || 0);
      totalTax += Number(r.tax || 0);
    });

    if ($('statPayrollEmployees')) $('statPayrollEmployees').textContent = records.length;
    if ($('statPayrollGross')) $('statPayrollGross').textContent = fmtCurrency(totalGross);
    if ($('statPayrollDeductions')) $('statPayrollDeductions').textContent = fmtCurrency(totalDeductions);
    if ($('statPayrollNet')) $('statPayrollNet').textContent = fmtCurrency(totalNet);
    if ($('statPayrollSS')) $('statPayrollSS').textContent = fmtCurrency(totalSocialSecurity);
    if ($('statPayrollTax')) $('statPayrollTax').textContent = fmtCurrency(totalTax);
  }

  function renderPayrollRecordsTable() {
    const tbody = $('payrollRecordsTableBody');
    if (!tbody) return;

    if (payrollState.isLoading) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-muted">
        <div class="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
        กำลังโหลดข้อมูลเงินเดือน...
      </td></tr>`;
      return;
    }

    if (!payrollState.periods.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5">
        <div class="py-3">
          <i class="bi bi-calendar-plus text-primary fs-1 mb-2 d-block"></i>
          <h6 class="fw-bold text-dark">ยังไม่มีงวดการจ่ายเงินเดือนในระบบ</h6>
          <p class="text-muted fs-8 mb-3">สร้างงวดการจ่ายเงินเดือนเพื่อคำนวณรายรับ-รายจ่ายและพิมพ์สลิปเงินเดือน</p>
          <button class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm" data-bs-toggle="modal" data-bs-target="#newPeriodModal">
            <i class="bi bi-plus-circle me-1"></i> สร้างงวดเงินเดือนใหม่
          </button>
        </div>
      </td></tr>`;
      return;
    }

    let list = [...payrollState.records];

    // Filter Department
    if (payrollState.filterDepartment !== 'ALL') {
      list = list.filter(r => r.department === payrollState.filterDepartment);
    }

    // Filter Wage Type
    if (payrollState.filterWageType !== 'ALL') {
      list = list.filter(r => (r.wageType || 'monthly') === payrollState.filterWageType);
    }

    // Search
    if (payrollState.searchQuery.trim()) {
      const q = payrollState.searchQuery.trim().toLowerCase();
      list = list.filter(r => 
        (r.employeeName || '').toLowerCase().includes(q) ||
        (r.employeeCode || '').toLowerCase().includes(q) ||
        (r.department || '').toLowerCase().includes(q) ||
        (r.position || '').toLowerCase().includes(q) ||
        (r.wageType || '').toLowerCase().includes(q)
      );
    }

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-muted">
        <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
        ${payrollState.currentPeriodId ? 'ไม่พบข้อมูลรายการเงินเดือนที่ตรงกับเงื่อนไข (คลิกปุ่ม <b>"คำนวณเงินเดือนงวดนี้"</b> ด้านบน เพื่อประมวลผลข้อมูล)' : 'กรุณาเลือกหรือสร้างงวดเงินเดือน'}
      </td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((r, idx) => {
      let wageTypeBadge = '';
      const wType = r.wageType || 'monthly';
      if (wType === 'daily') {
        wageTypeBadge = `<span class="badge bg-success bg-opacity-10 text-success border border-success-subtle fs-9"><i class="bi bi-clock-history me-1"></i>รายวัน (฿${fmtNum(r.wageRate || r.dailyRate)} × ${r.workUnits || 26} วัน)</span>`;
      } else if (wType === 'weekly') {
        wageTypeBadge = `<span class="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning-subtle fs-9"><i class="bi bi-calendar3 me-1"></i>รายสัปดาห์ (฿${fmtNum(r.wageRate)} × ${r.workUnits || 4} สัปดาห์)</span>`;
      } else {
        wageTypeBadge = `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle fs-9"><i class="bi bi-briefcase me-1"></i>รายเดือน</span>`;
      }

      return `
        <tr>
          <td class="text-center text-muted fs-8">${idx + 1}</td>
          <td>
            <div class="fw-bold text-dark">${esc(r.employeeName)}</div>
            <div class="d-flex align-items-center gap-1.5 mt-0.5">
              <span class="small text-muted font-monospace">${esc(r.employeeCode || '-')}</span>
              ${wageTypeBadge}
            </div>
          </td>
          <td>
            <span class="badge bg-light text-dark border">${esc(r.department || '-')}</span>
            <div class="small text-muted">${esc(r.position || '-')}</div>
          </td>
          <td class="text-end fw-semibold text-secondary">
            <div>${fmtNum(r.baseSalary)}</div>
            ${wType !== 'monthly' && r.wageRate ? `<div class="fs-9 text-muted font-monospace">@${fmtNum(r.wageRate)}</div>` : ''}
          </td>
          <td class="text-end text-success">${fmtNum(r.otAmount)}</td>
          <td class="text-end fw-bold text-primary">${fmtNum(r.totalEarnings)}</td>
          <td class="text-end text-danger">-${fmtNum(r.totalDeductions)}</td>
          <td class="text-end fw-bold text-success fs-6 bg-success bg-opacity-10">${fmtNum(r.netPay)}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary rounded-pill px-2.5 py-0.5" onclick="window.openPayslipModal('${r.id}')" title="ดูสลิปเงินเดือน">
                <i class="bi bi-receipt me-1"></i> สลิป
              </button>
              <button class="btn btn-outline-secondary rounded-pill px-2 py-0.5 ms-1" onclick="window.openEditRecordModal('${r.id}')" title="แก้ไข/ปรับยอด">
                <i class="bi bi-pencil-square"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Open E-Payslip Modal
  function openPayslipModal(recordId) {
    const record = payrollState.records.find(r => r.id === recordId);
    if (!record) return;
    payrollState.selectedRecord = record;

    const modalEl = $('payslipModal');
    if (!modalEl) return;

    const period = payrollState.currentPeriod || { title: 'งวดเงินเดือน' };
    const projectTitle = (typeof window.getFloraProjectTitle === 'function' ? window.getFloraProjectTitle() : '') || 'โครงการรัตนบุปผา และผลิตดอกไม้ธรรมยาตรา';

    const payslipProjEl = $('payslipProjectTitle');
    if (payslipProjEl) payslipProjEl.textContent = projectTitle;

    $('payslipEmployeeName').textContent = record.employeeName || '-';
    $('payslipEmployeeCode').textContent = record.employeeCode || '-';
    $('payslipDepartment').textContent = record.department || '-';
    $('payslipPosition').textContent = record.position || '-';
    $('payslipPeriodTitle').textContent = period.title || '-';
    $('payslipPayDate').textContent = period.payDate || '-';
    $('payslipBankAccount').textContent = `${record.bankName || 'ธนาคาร'} : ${record.bankAccount || '-'}`;

    // Wage Type Badge & Formula
    const wType = record.wageType || 'monthly';
    const badgeEl = $('payslipWageTypeBadge');
    const labelEl = $('slipBaseSalaryLabel');
    const detailEl = $('slipWageRateDetail');
    const detailRowEl = $('slipWageRateDetailRow');

    if (wType === 'daily') {
      if (badgeEl) {
        badgeEl.className = 'badge bg-success bg-opacity-10 text-success border border-success-subtle';
        badgeEl.textContent = '⏱️ พนักงานรายวัน (Daily Wage)';
      }
      if (labelEl) labelEl.textContent = 'ค่าจ้างรายวัน:';
      if (detailEl) detailEl.textContent = `฿${fmtNum(record.wageRate || record.dailyRate)} × ${record.workUnits || 26} วันทำงาน`;
      if (detailRowEl) detailRowEl.classList.remove('d-none');
    } else if (wType === 'weekly') {
      if (badgeEl) {
        badgeEl.className = 'badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning-subtle';
        badgeEl.textContent = '📅 พนักงานรายสัปดาห์ (Weekly Wage)';
      }
      if (labelEl) labelEl.textContent = 'ค่าจ้างรายสัปดาห์:';
      if (detailEl) detailEl.textContent = `฿${fmtNum(record.wageRate)} × ${record.workUnits || 4} สัปดาห์`;
      if (detailRowEl) detailRowEl.classList.remove('d-none');
    } else {
      if (badgeEl) {
        badgeEl.className = 'badge bg-primary bg-opacity-10 text-primary border border-primary-subtle';
        badgeEl.textContent = '💼 พนักงานรายเดือน (Monthly Salary)';
      }
      if (labelEl) labelEl.textContent = 'เงินเดือนพื้นฐาน:';
      if (detailEl) detailEl.textContent = `อัตราประจำเดือน (฿${fmtNum(record.wageRate || record.baseSalary)})`;
      if (detailRowEl) detailRowEl.classList.remove('d-none');
    }

    // Earnings
    $('slipBaseSalary').textContent = fmtNum(record.baseSalary);
    $('slipOtHours').textContent = `${record.otHours || 0} ชม.`;
    $('slipOtAmount').textContent = fmtNum(record.otAmount);
    $('slipDiligence').textContent = fmtNum(record.diligenceAllowance);
    $('slipPositionAllow').textContent = fmtNum(record.positionAllowance);
    $('slipBonus').textContent = fmtNum(record.bonus);
    $('slipOtherEarnings').textContent = fmtNum(record.otherEarnings);
    $('slipTotalEarnings').textContent = fmtNum(record.totalEarnings);

    // Deductions
    $('slipLateDeduct').textContent = fmtNum(record.lateDeduction);
    $('slipAbsenceDeduct').textContent = fmtNum(record.absenceDeduction);
    $('slipLeaveDeduct').textContent = fmtNum(record.leaveDeduction);
    $('slipSocialSecurity').textContent = fmtNum(record.socialSecurity);
    $('slipTax').textContent = fmtNum(record.tax);
    $('slipOtherDeduct').textContent = fmtNum(record.otherDeductions);
    $('slipTotalDeductions').textContent = fmtNum(record.totalDeductions);

    // Net
    $('slipNetPay').textContent = fmtCurrency(record.netPay);

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
  }

  // Update Edit Modal Wage Formula UI
  function updateEditModalWageControls() {
    const wageType = $('editWageType')?.value || 'monthly';
    const rateInput = $('editWageRate');
    const unitsInput = $('editWorkUnits');
    const baseSalInput = $('editBaseSalary');
    const badgeEl = $('wageTypeDescriptionBadge');
    const rateLabel = $('editWageRateLabel');
    const unitsLabel = $('editWorkUnitsLabel');
    const unitsUnitText = $('editWorkUnitsUnitText');
    const previewEl = $('wageFormulaPreviewText');

    const rate = Number(rateInput?.value || 0);
    const units = Number(unitsInput?.value || 1);

    if (wageType === 'daily') {
      if (badgeEl) {
        badgeEl.className = 'badge bg-success px-2.5 py-1 rounded-pill fs-9';
        badgeEl.textContent = '⏱️ รายวัน (Daily)';
      }
      if (rateLabel) rateLabel.textContent = 'อัตราค่าจ้างต่อวัน (฿/วัน)';
      if (unitsLabel) unitsLabel.textContent = 'จำนวนวันทำงานจริง';
      if (unitsUnitText) unitsUnitText.textContent = 'วัน';
      if (unitsInput && !unitsInput.value) unitsInput.value = '26';
      
      const calcBase = Math.round(rate * units);
      if (baseSalInput && document.activeElement !== baseSalInput) {
        baseSalInput.value = calcBase;
      }
      if (previewEl) {
        previewEl.innerHTML = `<i class="bi bi-calculator me-1"></i> สูตรคำนวณ: <b>฿${fmtNum(rate)}</b> × <b>${units} วัน</b> = <span class="text-success fw-bold">฿${fmtNum(calcBase)}</span>`;
      }
    } else if (wageType === 'weekly') {
      if (badgeEl) {
        badgeEl.className = 'badge bg-warning text-dark px-2.5 py-1 rounded-pill fs-9';
        badgeEl.textContent = '📅 รายสัปดาห์ (Weekly)';
      }
      if (rateLabel) rateLabel.textContent = 'อัตราค่าจ้างต่อสัปดาห์ (฿/สัปดาห์)';
      if (unitsLabel) unitsLabel.textContent = 'จำนวนสัปดาห์ทำงาน';
      if (unitsUnitText) unitsUnitText.textContent = 'สัปดาห์';
      if (unitsInput && !unitsInput.value) unitsInput.value = '4';

      const calcBase = Math.round(rate * units);
      if (baseSalInput && document.activeElement !== baseSalInput) {
        baseSalInput.value = calcBase;
      }
      if (previewEl) {
        previewEl.innerHTML = `<i class="bi bi-calculator me-1"></i> สูตรคำนวณ: <b>฿${fmtNum(rate)}</b> × <b>${units} สัปดาห์</b> = <span class="text-warning-emphasis fw-bold">฿${fmtNum(calcBase)}</span>`;
      }
    } else {
      // Monthly
      if (badgeEl) {
        badgeEl.className = 'badge bg-primary px-2.5 py-1 rounded-pill fs-9';
        badgeEl.textContent = '💼 รายเดือน (Monthly)';
      }
      if (rateLabel) rateLabel.textContent = 'ฐานเงินเดือน (฿/เดือน)';
      if (unitsLabel) unitsLabel.textContent = 'รอบการจ่าย (เดือน)';
      if (unitsUnitText) unitsUnitText.textContent = 'เดือน';
      if (unitsInput) unitsInput.value = '1';

      if (baseSalInput && document.activeElement !== baseSalInput) {
        baseSalInput.value = rate;
      }
      if (previewEl) {
        previewEl.innerHTML = `<i class="bi bi-calculator me-1"></i> สูตรคำนวณ: <b>฿${fmtNum(rate)}</b> ต่อเดือน = <span class="text-primary fw-bold">฿${fmtNum(rate)}</span>`;
      }
    }
  }

  // Quick preset helper
  window.setPresetUnits = function(units) {
    const unitsInput = $('editWorkUnits');
    if (unitsInput) {
      unitsInput.value = units;
      updateEditModalWageControls();
    }
  };

  // Open Edit Record Modal
  function openEditRecordModal(recordId) {
    const record = payrollState.records.find(r => r.id === recordId);
    if (!record) return;
    payrollState.selectedRecord = record;

    const modalEl = $('editRecordModal');
    if (!modalEl) return;

    $('editRecordEmpName').textContent = `${record.employeeName} (${record.employeeCode || ''})`;
    $('editRecordId').value = record.id;

    // Wage Type Setup
    const wageType = record.wageType || 'monthly';
    const wageTypeSelect = $('editWageType');
    if (wageTypeSelect) wageTypeSelect.value = wageType;

    const wageRate = record.wageRate !== undefined ? record.wageRate : (wageType === 'monthly' ? (record.baseSalary || 15000) : (record.dailyRate || 450));
    const workUnits = record.workUnits !== undefined ? record.workUnits : (wageType === 'daily' ? 26 : (wageType === 'weekly' ? 4 : 1));

    if ($('editWageRate')) $('editWageRate').value = wageRate;
    if ($('editWorkUnits')) $('editWorkUnits').value = workUnits;
    if ($('editBaseSalary')) $('editBaseSalary').value = record.baseSalary || 0;

    $('editOtHours').value = record.otHours || 0;
    $('editOtAmount').value = record.otAmount || 0;
    $('editDiligence').value = record.diligenceAllowance || 0;
    $('editPositionAllow').value = record.positionAllowance || 0;
    $('editBonus').value = record.bonus || 0;
    $('editOtherEarnings').value = record.otherEarnings || 0;
    $('editLateDeduct').value = record.lateDeduction || 0;
    $('editAbsenceDeduct').value = record.absenceDeduction || 0;
    $('editLeaveDeduct').value = record.leaveDeduction || 0;
    $('editSocialSecurity').value = record.socialSecurity || 0;
    $('editTax').value = record.tax || 0;
    $('editOtherDeduct').value = record.otherDeductions || 0;
    $('editRemarks').value = record.remarks || '';

    updateEditModalWageControls();

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
  }

  // Export CSV
  function exportPayrollCsv() {
    if (!payrollState.records.length) {
      showToast('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }
    const projectTitle = (typeof window.getFloraProjectTitle === 'function' ? window.getFloraProjectTitle() : '') || 'โครงการรัตนบุปผา และผลิตดอกไม้ธรรมยาตรา';
    const metaRows = [
      [`"ชื่อโครงการ"`, `"${projectTitle}"`],
      [`"งวดการจ่ายเงินเดือน"`, `"${payrollState.currentPeriod?.title || ''}"`],
      [`"กำหนดจ่ายเงิน"`, `"${payrollState.currentPeriod?.payDate || ''}"`],
      []
    ];

    const headers = ['รหัสพนักงาน', 'ชื่อ-นามสกุล', 'แผนก', 'ตำแหน่ง', 'ประเภทการจ้าง', 'อัตราต่อหน่วย', 'จำนวนหน่วยทำงาน', 'ฐานเงินเดือน/ค่าจ้าง', 'ค่าล่วงเวลา(OT)', 'เบี้ยขยัน', 'เงินเพิ่มอื่นๆ', 'รวมรับ', 'ประกันสังคม', 'ภาษี', 'หักขาด/ลา/มาสาย', 'รวมหัก', 'สุทธิ (Net Pay)', 'ธนาคาร', 'เลขที่บัญชี'];
    const rows = payrollState.records.map(r => {
      const wTypeLabel = r.wageType === 'daily' ? 'รายวัน' : (r.wageType === 'weekly' ? 'รายสัปดาห์' : 'รายเดือน');
      return [
        `"${r.employeeCode || ''}"`,
        `"${r.employeeName || ''}"`,
        `"${r.department || ''}"`,
        `"${r.position || ''}"`,
        `"${wTypeLabel}"`,
        r.wageRate || r.baseSalary || 0,
        r.workUnits || 1,
        r.baseSalary || 0,
        r.otAmount || 0,
        r.diligenceAllowance || 0,
        (r.positionAllowance || 0) + (r.bonus || 0) + (r.otherEarnings || 0),
        r.totalEarnings || 0,
        r.socialSecurity || 0,
        r.tax || 0,
        (r.lateDeduction || 0) + (r.absenceDeduction || 0) + (r.leaveDeduction || 0) + (r.otherDeductions || 0),
        r.totalDeductions || 0,
        r.netPay || 0,
        `"${r.bankName || ''}"`,
        `"${r.bankAccount || ''}"`
      ];
    });

    const allCsvLines = [
      ...metaRows.map(e => e.join(',')),
      headers.join(','),
      ...rows.map(e => e.join(','))
    ];

    const csvContent = '\uFEFF' + allCsvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `รายงานเงินเดือน_${projectTitle}_${payrollState.currentPeriod?.title || 'งวด'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('ส่งออกไฟล์ CSV สรุปเงินเดือนเรียบร้อยแล้ว');
  }

  // Print Payslip Single / Batch
  function printCurrentPayslip() {
    window.print();
  }

  // ==================== INITIALIZATION ====================
  function initPayrollModule() {
    // Populate Department Filter
    const deptSelect = $('payrollDeptFilter');
    if (deptSelect) {
      deptSelect.addEventListener('change', (e) => {
        payrollState.filterDepartment = e.target.value;
        renderPayrollRecordsTable();
      });
    }

    // Wage Type Filter
    const wageTypeFilterSelect = $('payrollWageTypeFilter');
    if (wageTypeFilterSelect) {
      wageTypeFilterSelect.addEventListener('change', (e) => {
        payrollState.filterWageType = e.target.value;
        renderPayrollRecordsTable();
      });
    }

    // Search Input
    const searchInput = $('payrollSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        payrollState.searchQuery = e.target.value;
        renderPayrollRecordsTable();
      });
    }

    // Period Switch
    const periodSelect = $('payrollPeriodSelect');
    if (periodSelect) {
      periodSelect.addEventListener('change', async (e) => {
        payrollState.currentPeriodId = e.target.value;
        payrollState.currentPeriod = payrollState.periods.find(p => p.id === e.target.value) || null;
        renderPeriodsSelector();
        if (payrollState.currentPeriodId) {
          await loadPayrollRecords(payrollState.currentPeriodId);
        }
      });
    }

    // New Period Form
    const createPeriodForm = $('createPeriodForm');
    if (createPeriodForm) {
      createPeriodForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const month = $('newPeriodMonth').value;
        const year = $('newPeriodYear').value;
        const startDate = $('newPeriodStartDate').value;
        const endDate = $('newPeriodEndDate').value;
        const payDate = $('newPeriodPayDate').value;
        await createPayrollPeriod(month, year, startDate, endDate, payDate);
        const modalEl = bootstrap.Modal.getInstance($('newPeriodModal'));
        if (modalEl) modalEl.hide();
      });
    }

    // Wage Type Change in Edit Modal
    const editWageTypeEl = $('editWageType');
    if (editWageTypeEl) {
      editWageTypeEl.addEventListener('change', () => {
        const val = editWageTypeEl.value;
        const rateInput = $('editWageRate');
        if (val === 'daily' && Number(rateInput.value) > 1000) {
          rateInput.value = Math.round(Number(rateInput.value) / 30) || 450;
        } else if (val === 'weekly' && Number(rateInput.value) > 5000) {
          rateInput.value = Math.round(Number(rateInput.value) / 4) || 3500;
        } else if (val === 'monthly' && Number(rateInput.value) <= 1000 && Number(rateInput.value) > 0) {
          rateInput.value = Number(rateInput.value) * 30 || 15000;
        }
        updateEditModalWageControls();
      });
    }

    const editWageRateEl = $('editWageRate');
    if (editWageRateEl) {
      editWageRateEl.addEventListener('input', updateEditModalWageControls);
    }

    const editWorkUnitsEl = $('editWorkUnits');
    if (editWorkUnitsEl) {
      editWorkUnitsEl.addEventListener('input', updateEditModalWageControls);
    }

    // Edit Record Form
    const editRecordForm = $('editRecordForm');
    if (editRecordForm) {
      editRecordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const recordId = $('editRecordId').value;
        const payload = {
          wageType: $('editWageType')?.value || 'monthly',
          wageRate: Number($('editWageRate')?.value || 0),
          workUnits: Number($('editWorkUnits')?.value || 1),
          baseSalary: Number($('editBaseSalary').value || 0),
          otHours: Number($('editOtHours').value || 0),
          otAmount: Number($('editOtAmount').value || 0),
          diligenceAllowance: Number($('editDiligence').value || 0),
          positionAllowance: Number($('editPositionAllow').value || 0),
          bonus: Number($('editBonus').value || 0),
          otherEarnings: Number($('editOtherEarnings').value || 0),
          lateDeduction: Number($('editLateDeduct').value || 0),
          absenceDeduction: Number($('editAbsenceDeduct').value || 0),
          leaveDeduction: Number($('editLeaveDeduct').value || 0),
          socialSecurity: Number($('editSocialSecurity').value || 0),
          tax: Number($('editTax').value || 0),
          otherDeductions: Number($('editOtherDeduct').value || 0),
          remarks: $('editRemarks').value.trim()
        };
        await saveRecordAdjustment(recordId, payload);
        const modalEl = bootstrap.Modal.getInstance($('editRecordModal'));
        if (modalEl) modalEl.hide();
      });
    }

    // Recalculate Button
    const btnRecalc = $('btnRecalculatePayroll');
    if (btnRecalc) {
      btnRecalc.addEventListener('click', async () => {
        if (!payrollState.currentPeriod) {
          showToast('กรุณาเลือกงวดเงินเดือนก่อน');
          return;
        }
        if (confirm(`ต้องการคำนวณเงินเดือนใหม่สำหรับงวด "${payrollState.currentPeriod.title}" ใช่หรือไม่?`)) {
          await autoCalculatePeriodRecords(payrollState.currentPeriod.id, payrollState.currentPeriod.startDate, payrollState.currentPeriod.endDate);
          await loadPayrollRecords(payrollState.currentPeriod.id);
        }
      });
    }

    // Initial Data Fetch
    loadPayrollPeriods();

    // Listen for Firebase Bridge or Auth Ready
    window.addEventListener('flora-firebase-ready', () => {
      loadPayrollPeriods();
      if (typeof window.updateAllFloraTitles === 'function') {
        window.updateAllFloraTitles();
      }
    });

    // Listen for project title updates (from Node 1 of org structure)
    window.addEventListener('flora-project-title-changed', (e) => {
      const newTitle = e.detail?.title || (typeof window.getFloraProjectTitle === 'function' ? window.getFloraProjectTitle() : '');
      if (newTitle) {
        const payslipProjEl = $('payslipProjectTitle');
        if (payslipProjEl) payslipProjEl.textContent = newTitle;
        const navBrandTitle = $('navbarMasterBrandTitle');
        if (navBrandTitle) navBrandTitle.textContent = newTitle;
      }
    });

    window.addEventListener('flora-org-tree-changed', (e) => {
      const tree = e.detail?.tree;
      if (tree && tree.name) {
        const payslipProjEl = $('payslipProjectTitle');
        if (payslipProjEl) payslipProjEl.textContent = tree.name;
        const navBrandTitle = $('navbarMasterBrandTitle');
        if (navBrandTitle) navBrandTitle.textContent = tree.name;
      }
    });

    // Fallback retries for slow connections or shared preview environments
    setTimeout(() => {
      if (!payrollState.periods.length && !payrollState.isLoading) {
        loadPayrollPeriods();
      }
    }, 1200);
  }

  // Export globals
  window.payrollModule = {
    loadPayrollPeriods,
    loadPayrollRecords,
    createPayrollPeriod,
    autoCalculatePeriodRecords,
    updatePeriodStatus,
    exportPayrollCsv,
    printCurrentPayslip,
    ensurePayrollDatabase
  };

  window.openPayslipModal = openPayslipModal;
  window.openEditRecordModal = openEditRecordModal;
  window.initPayrollModule = initPayrollModule;
  window.loadPayrollPeriods = loadPayrollPeriods;

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initPayrollModule);
  } else {
    initPayrollModule();
  }
})();
