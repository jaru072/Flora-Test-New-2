import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { 
      getFirestore, 
      initializeFirestore,
      collection, 
      doc, 
      getDoc,
      getDocs, 
      addDoc,
      setDoc, 
      updateDoc,
      deleteDoc, 
      onSnapshot 
    } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
    import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
    import { 
      getAuth, 
      onAuthStateChanged, 
      signOut, 
      GoogleAuthProvider, 
      signInWithPopup, 
      updateProfile 
    } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

    // Application Global State
    let currentAuthUser = null;
    let currentUserProfile = null;
    let googleProvider = null;
    let allUsersList = [];
    window.employees = [];
    window.attendanceLogs = [];
    window.departments = [];
    window.currentView = 'hierarchy'; // 'hierarchy' | 'department' | 'grid'
    window.currentZoom = 1.0;
    window.activeFilterDept = 'ALL';
    window.searchKeyword = '';
    window.db = null;
    window.storage = null;
    window.personnelAuth = null;
    let personnelSessionAccess = null;
    try { personnelSessionAccess = JSON.parse(sessionStorage.getItem('flora_personnel_access') || localStorage.getItem('flora_saved_user_profile') || 'null'); } catch (e) {}
    window.personnelAccess = personnelSessionAccess?.isAdmin === true && personnelSessionAccess?.email === 'jaru072@gmail.com'
      ? { loading: true, isAdmin: true, uid: personnelSessionAccess.uid || '', email: personnelSessionAccess.email, role: 'ADMIN' }
      : { loading: true, isAdmin: false, uid: personnelSessionAccess?.uid || '', email: personnelSessionAccess?.email || '', role: personnelSessionAccess?.role || 'VIEWER' };

    // Default Positions Structure (ระดับ 1 - 6 ครบ 13 สายงาน)
    window.defaultPositions = [
      { id: "pos-1", name: "1. ประธานโครงการ", category: "executive", order: 1 },
      { id: "pos-2", name: "2. ที่ปรึกษาโครงการ", category: "executive", order: 2 },
      { id: "pos-3", name: "3. ผู้ประสานงานโครงการ", category: "executive", order: 3 },
      { id: "pos-4-1", name: "4.1 หัวหน้างานส่วนกลาง", category: "section_head", order: 4 },
      { id: "pos-4-2", name: "4.2 หัวหน้างานกุหลาบ/งานทดลอง", category: "section_head", order: 5 },
      { id: "pos-4-3", name: "4.3 หัวหน้างานรัตนบุปผา", category: "section_head", order: 6 },
      { id: "pos-4-4", name: "4.4 หัวหน้างานธรรมยาตรา", category: "section_head", order: 7 },
      { id: "pos-4-5", name: "นักวิชาการ", category: "academic", order: 8 },
      { id: "pos-5-1", name: "5.1 หัวหน้างานธุรการ / งานบุคคล", category: "team_leader", order: 9 },
      { id: "pos-5-2", name: "5.2 หัวหน้างานสวัสดิการ", category: "team_leader", order: 10 },
      { id: "pos-5-3", name: "5.3 หัวหน้างานระบบน้ำ", category: "team_leader", order: 11 },
      { id: "pos-5-3-1", name: "5.3.1 หัวหน้างานตัดหญ้า", category: "team_leader", order: 12 },
      { id: "pos-5-4", name: "5.4 หัวหน้างานทดลอง", category: "team_leader", order: 13 },
      { id: "pos-5-5", name: "5.5 หัวหน้างานกุหลาบ", category: "team_leader", order: 14 },
      { id: "pos-5-6", name: "5.6 หัวหน้างานเจดีย์", category: "team_leader", order: 15 },
      { id: "pos-5-7", name: "5.7 หัวหน้างานวิหารหลวงปู่", category: "team_leader", order: 16 },
      { id: "pos-5-8", name: "5.8 หัวหน้างานถนนธรรมชัย / เฟื่องฟ้า", category: "team_leader", order: 17 },
      { id: "pos-5-9", name: "5.9 หัวหน้างานผสมแกลบ / โต๊ะกลาง", category: "team_leader", order: 18 },
      { id: "pos-5-10", name: "5.10 หัวหน้างานแปลง A / B", category: "team_leader", order: 19 },
      { id: "pos-5-11", name: "5.11 หัวหน้างานแปลง E / P11", category: "team_leader", order: 20 },
      { id: "pos-5-12", name: "5.12 หัวหน้างานไม้กระถางหลังวิหารคด 13-20", category: "team_leader", order: 21 },
      { id: "pos-6-1", name: "เจ้าหน้าที่ธุรการ", category: "staff", order: 22 },
      { id: "pos-6-2", name: "พนักงานสวัสดิการ", category: "worker", order: 23 },
      { id: "pos-6-3", name: "พนักงานดูแลระบบน้ำ", category: "worker", order: 24 },
      { id: "pos-6-4", name: "พนักงานตัดหญ้า", category: "worker", order: 25 },
      { id: "pos-6-5", name: "พนักงานงานทดลอง", category: "worker", order: 26 },
      { id: "pos-6-6", name: "พนักงานดูแลกุหลาบ", category: "worker", order: 27 },
      { id: "pos-6-7", name: "พนักงานงานเจดีย์", category: "worker", order: 28 },
      { id: "pos-6-8", name: "พนักงานงานวิหารหลวงปู่", category: "worker", order: 29 },
      { id: "pos-6-9", name: "พนักงานดูแลถนนธรรมชัย", category: "worker", order: 30 },
      { id: "pos-6-10", name: "พนักงานผสมแกลบ", category: "worker", order: 31 },
      { id: "pos-6-11", name: "พนักงานดูแลแปลง A/B", category: "worker", order: 32 },
      { id: "pos-6-12", name: "พนักงานดูแลแปลง E/P11", category: "worker", order: 33 },
      { id: "pos-6-13", name: "พนักงานดูแลไม้กระถาง", category: "worker", order: 34 },
      { id: "pos-6-14", name: "พนักงานปฏิบัติการ", category: "worker", order: 35 }
    ];

    window.defaultDepartments = [
      "1.1 งานธุรการ / งานบุคคล",
      "1.2 งานสวัสดิการ",
      "1.3 งานระบบน้ำ",
      "1.4 งานตัดหญ้า",
      "2.1 งานทดลอง",
      "2.2 งานกุหลาบ",
      "3.1 งานเจดีย์",
      "3.2 งานวิหารหลวงปู่",
      "3.3 งานถนนธรรมชัย / เฟื่องฟ้า",
      "3.4 งานผสมแกลบ / งานโต๊ะกลาง",
      "4.1 แปลง A / B",
      "4.2 แปลง E / P11",
      "4.3 งานไม้กระถางหลังวิหารคด 13-20",
      "งานวิชาการ",
      "ฝ่ายบริหารและอำนวยการ"
    ];

    window.positionsList = [...window.defaultPositions];
    window.departmentsList = [...window.defaultDepartments];

    // Scoped LocalStorage Key Generator (Scoped to active Firestore Database ID)
    function getScopedStorageKey(baseKey) {
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
    window.getScopedStorageKey = getScopedStorageKey;

    function getScopedLocalStorageItem(baseKey) {
      const scopedKey = getScopedStorageKey(baseKey);
      const val = localStorage.getItem(scopedKey);
      if (val !== null) return val;
      return localStorage.getItem(baseKey);
    }
    window.getScopedLocalStorageItem = getScopedLocalStorageItem;

    function setScopedLocalStorageItem(baseKey, val) {
      const scopedKey = getScopedStorageKey(baseKey);
      localStorage.setItem(scopedKey, val);
    }
    window.setScopedLocalStorageItem = setScopedLocalStorageItem;

    // Initialize Firebase
    async function initFirebase() {
      try {
        const fallbackDatabaseId = window.firebaseConfig?.firestoreDatabaseId || window.floraFirebaseConfig?.firestoreDatabaseId || "ai-studio-remixfloratestne-7fc63c6e-7cdb-49cc-b006-9bd6ab3a7926";
        let config = null;
        try {
          const resp = await fetch('/firebase-applet-config.json');
          if (resp.ok) {
            config = await resp.json();
          }
        } catch (e) {}

        if (!config || !config.projectId) {
          config = {
            projectId: "flora-gaden",
            appId: "1:633519077693:web:6267796ae34a8286ff6d54",
            apiKey: "AIzaSyCVFTo7glMah6eeubjCLQa6HtIrnwpmrc4",
            authDomain: "flora-gaden.firebaseapp.com",
            firestoreDatabaseId: fallbackDatabaseId,
            storageBucket: "flora-gaden.firebasestorage.app"
          };
        }

        window.firebaseConfig = config;
        window.floraFirebaseConfig = config;

        const targetDbId = (config.firestoreDatabaseId && config.firestoreDatabaseId !== "(default)")
          ? config.firestoreDatabaseId
          : undefined;

        const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
        const fsSettings = { experimentalForceLongPolling: true, useFetchStreams: false };
        try {
          window.db = targetDbId ? initializeFirestore(app, fsSettings, targetDbId) : initializeFirestore(app, fsSettings);
        } catch (eFs) {
          window.db = targetDbId ? getFirestore(app, targetDbId) : getFirestore(app);
        }
        window.storage = getStorage(app);
        window.personnelAuth = getAuth(app);
        googleProvider = new GoogleAuthProvider();
        googleProvider.setCustomParameters({ prompt: 'select_account' });

        window.personnelApi = {
          db: window.db, storage: window.storage, auth: window.personnelAuth,
          collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, onSnapshot,
          ref, uploadBytes, getDownloadURL, deleteObject
        };
        if (typeof window.floraLogo?.connectGlobalLogoFirestore === 'function') {
          window.floraLogo.connectGlobalLogoFirestore(window.personnelApi);
        }
        window.dispatchEvent(new CustomEvent('flora-personnel-api-ready'));
        window.checkOrgModuleAccess = function(access) {
          const isSuperAdmin = access?.isAdmin === true || access?.role === 'ADMIN' || access?.email === 'jaru072@gmail.com';
          if (isSuperAdmin) {
            const modalElem = document.getElementById('moduleAccessDeniedModal');
            if (modalElem && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
              const bsModal = bootstrap.Modal.getInstance(modalElem);
              if (bsModal) bsModal.hide();
            }
            return true;
          }

          if (!access || access.loading) return true;

          const hasPersonnel = access.accessPersonnel !== false;
          const hasInventory = access.accessInventory !== false;

          if (!hasPersonnel) {
            const modalElem = document.getElementById('moduleAccessDeniedModal');
            if (modalElem && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
              const nameElem = document.getElementById('moduleDeniedUserName');
              const emailElem = document.getElementById('moduleDeniedUserEmail');
              const switchBtn = document.getElementById('btnSwitchToAllowedInventory');
              if (nameElem) nameElem.textContent = access.displayName || access.email?.split('@')[0] || 'ผู้ใช้งาน';
              if (emailElem) emailElem.textContent = access.email || '-';
              if (switchBtn) {
                if (hasInventory) {
                  switchBtn.classList.remove('d-none');
                } else {
                  switchBtn.classList.add('d-none');
                }
              }
              const bsModal = bootstrap.Modal.getOrCreateInstance(modalElem);
              bsModal.show();
            }
            return false;
          } else {
            const modalElem = document.getElementById('moduleAccessDeniedModal');
            if (modalElem && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
              const bsModal = bootstrap.Modal.getInstance(modalElem);
              if (bsModal) bsModal.hide();
            }
          }
          return true;
        };

        onAuthStateChanged(window.personnelAuth, async (user) => {
          currentAuthUser = user;
          let access = !user && personnelSessionAccess?.isAdmin === true && personnelSessionAccess?.email === 'jaru072@gmail.com'
            ? { loading: false, isAdmin: true, uid: personnelSessionAccess.uid || '', email: personnelSessionAccess.email, role: 'ADMIN', accessPersonnel: true, accessInventory: true }
            : { 
                loading: false, 
                isAdmin: false, 
                uid: user?.uid || personnelSessionAccess?.uid || '', 
                email: user?.email || personnelSessionAccess?.email || '', 
                role: user ? 'VIEWER' : (personnelSessionAccess?.role || 'VIEWER'),
                accessPersonnel: personnelSessionAccess?.accessPersonnel !== undefined ? personnelSessionAccess.accessPersonnel : true,
                accessInventory: personnelSessionAccess?.accessInventory !== undefined ? personnelSessionAccess.accessInventory : true
              };
          if (user) {
            const email = String(user.email || '').trim().toLowerCase();
            if (email === 'jaru072@gmail.com') {
              access = { ...access, isAdmin: true, role: 'ADMIN', accessPersonnel: true, accessInventory: true, displayName: user.displayName || 'ผู้ดูแลระบบ', photoURL: user.photoURL || '' };
              currentUserProfile = {
                uid: user.uid,
                email: email,
                displayName: user.displayName || 'Thamma Srithong',
                role: 'ADMIN',
                isAdmin: true,
                photoURL: user.photoURL || ''
              };
            } else {
              try {
                const userSnap = await getDoc(doc(window.db, 'users', user.uid));
                const profile = userSnap.exists() ? userSnap.data() : {};
                const role = String(profile.role || '').toUpperCase();
                const isSuperAdmin = role === 'ADMIN' || profile.isAdmin === true;
                const accessPersonnel = isSuperAdmin ? true : (profile.accessPersonnel !== undefined ? Boolean(profile.accessPersonnel) : true);
                const accessInventory = isSuperAdmin ? true : (profile.accessInventory !== undefined ? Boolean(profile.accessInventory) : true);
                access = { 
                  ...access, 
                  isAdmin: isSuperAdmin, 
                  role: role || 'VIEWER',
                  accessPersonnel: accessPersonnel,
                  accessInventory: accessInventory,
                  displayName: profile.displayName || user.displayName || 'ผู้ใช้งาน',
                  photoURL: profile.photoURL || user.photoURL || ''
                };
                currentUserProfile = {
                  uid: user.uid,
                  email: email,
                  displayName: profile.displayName || user.displayName || 'ผู้ใช้งาน',
                  role: role || 'VIEWER',
                  isAdmin: isSuperAdmin,
                  photoURL: profile.photoURL || user.photoURL || '',
                  accessPersonnel: accessPersonnel,
                  accessInventory: accessInventory
                };
              } catch (authError) {
                console.warn('Unable to verify personnel admin profile:', authError);
              }
            }
          } else {
            currentUserProfile = null;
          }
          window.personnelAccess = access;
          window.dispatchEvent(new CustomEvent('flora-personnel-auth-changed', { detail: access }));
          
          // Update Settings Dropdown Header Profile & Navbar
          const navAvatar = document.getElementById('orgNavUserAvatar') || document.getElementById('navUserAvatar');
          const navRoleText = document.getElementById('orgNavRoleText') || document.getElementById('currentRoleText');
          const menuAvatar = document.getElementById('orgMenuUserAvatar');
          const menuName = document.getElementById('orgMenuUserName');
          const menuEmail = document.getElementById('orgMenuUserEmail');
          const menuRoleBadge = document.getElementById('orgMenuUserRoleBadge');

          const userDisplayName = access.displayName || access.email?.split('@')[0] || (user ? 'ผู้ใช้งาน' : 'ผู้เยี่ยมชม');
          const userEmailVal = access.email || (user ? '-' : 'ยังไม่ได้เข้าสู่ระบบ');
          const userPhotoVal = access.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
          const isSuperAdmin = access.isAdmin === true || access.role === 'ADMIN';

          if (navAvatar) {
            navAvatar.src = userPhotoVal;
            navAvatar.classList.remove('d-none');
          }
          if (navRoleText) {
            navRoleText.textContent = isSuperAdmin ? 'ผู้ดูแลระบบ' : (access.role === 'MANAGER' ? 'เจ้าหน้าที่' : (user ? 'สมาชิก' : 'ตั้งค่า'));
          }
          if (menuAvatar) menuAvatar.src = userPhotoVal;
          if (menuName) menuName.textContent = userDisplayName;
          if (menuEmail) menuEmail.textContent = userEmailVal;
          if (menuRoleBadge) {
            if (isSuperAdmin) {
              menuRoleBadge.textContent = '🔴 ผู้ดูแลระบบ (Admin)';
              menuRoleBadge.className = 'badge bg-danger rounded-pill px-2 py-0.5 fs-8 fw-semibold';
            } else if (access.role === 'MANAGER') {
              menuRoleBadge.textContent = '🔵 เจ้าหน้าที่ (Manager)';
              menuRoleBadge.className = 'badge bg-primary rounded-pill px-2 py-0.5 fs-8 fw-semibold';
            } else if (user) {
              menuRoleBadge.textContent = '🟢 สมาชิก/ผู้ใช้ทั่วไป';
              menuRoleBadge.className = 'badge bg-success rounded-pill px-2 py-0.5 fs-8 fw-semibold';
            } else {
              menuRoleBadge.textContent = '⚪ ผู้เยี่ยมชม (Guest)';
              menuRoleBadge.className = 'badge bg-secondary rounded-pill px-2 py-0.5 fs-8 fw-semibold';
            }
          }

          // Update userAuthModal UI
          const loggedInBox = document.getElementById('profileLoggedInBox');
          const loggedOutBox = document.getElementById('profileLoggedOutBox');
          if (user) {
            if (loggedInBox) loggedInBox.classList.remove('d-none');
            if (loggedOutBox) loggedOutBox.classList.add('d-none');
            const pImg = document.getElementById('userProfileImg');
            const pName = document.getElementById('userProfileName');
            const pRoleBadge = document.getElementById('userProfileRoleBadge');
            const pEmail = document.getElementById('userProfileEmail');
            const pUid = document.getElementById('userProfileUid');
            const eNameInput = document.getElementById('editProfileNameInput');
            const ePhotoInput = document.getElementById('editProfilePhotoInput');
            if (pImg) pImg.src = userPhotoVal;
            if (pName) pName.textContent = userDisplayName;
            if (pRoleBadge) {
              if (isSuperAdmin) {
                pRoleBadge.className = 'badge bg-danger rounded-pill px-3 py-1.5';
                pRoleBadge.textContent = 'ผู้ดูแลระบบ (ADMIN)';
              } else if (access.role === 'MANAGER') {
                pRoleBadge.className = 'badge bg-primary rounded-pill px-3 py-1.5';
                pRoleBadge.textContent = 'เจ้าหน้าที่ (MANAGER)';
              } else {
                pRoleBadge.className = 'badge bg-success rounded-pill px-3 py-1.5';
                pRoleBadge.textContent = 'สมาชิก (WORKER)';
              }
            }
            if (pEmail) pEmail.textContent = user.email || '-';
            if (pUid) pUid.textContent = `UID: ${user.uid}`;
            if (eNameInput && !eNameInput.value) eNameInput.value = user.displayName || '';
            if (ePhotoInput && !ePhotoInput.value) ePhotoInput.value = user.photoURL || '';
          } else {
            if (loggedInBox) loggedInBox.classList.add('d-none');
            if (loggedOutBox) loggedOutBox.classList.remove('d-none');
          }

          // Admin only elements toggle
          const adminElements = document.querySelectorAll('.admin-only-element, .super-admin-only-element');
          adminElements.forEach(el => {
            if (isSuperAdmin) {
              el.classList.remove('d-none');
            } else {
              el.classList.add('d-none');
            }
          });

          if (isSuperAdmin && typeof window.loadUsersTableFromFirestore === 'function') {
            window.loadUsersTableFromFirestore();
          }

          if (typeof window.checkOrgModuleAccess === 'function') {
            window.checkOrgModuleAccess(access);
          }
        });

        // Google Sign In
        window.handleGoogleSignIn = async function() {
          if (!window.personnelAuth || !googleProvider) {
            googleProvider = new GoogleAuthProvider();
            googleProvider.setCustomParameters({ prompt: 'select_account' });
          }
          try {
            if (typeof showToast === 'function') showToast("⏳ กำลังเปิดหน้าต่าง Google Sign-In...");
            const result = await signInWithPopup(window.personnelAuth, googleProvider);
            if (typeof showToast === 'function') showToast(`🟢 เข้าสู่ระบบด้วย Google สำเร็จ: ${result.user.displayName || result.user.email}`);
            window.switchAuthTab('auth-profile-tab');
          } catch (err) {
            console.error("Google Auth error:", err);
            let errorMsg = err.message || 'ไม่สำเร็จ';
            if (err.code === 'auth/unauthorized-domain') {
              errorMsg = "โดเมนยังไม่ได้รับอนุญาตใน Firebase Console";
            } else if (err.code === 'auth/popup-closed-by-user') {
              errorMsg = "ปิดหน้าต่าง Pop-up ก่อนทำรายการ";
            }
            if (typeof showToast === 'function') showToast(`🔴 เข้าสู่ระบบ Google ไม่สำเร็จ: ${errorMsg}`);
          }
        };

        // Sign Out
        window.handleSignOut = async function() {
          try {
            sessionStorage.clear();
            if (window.personnelAuth) {
              await signOut(window.personnelAuth);
            }
            if (typeof showToast === 'function') showToast("ออกจากระบบเรียบร้อยแล้ว");
          } catch (err) {
            console.warn("SignOut notice:", err.message);
          }
        };

        // Global Sign Out handler for Personnel Page
        window.handlePersonnelSignOut = async function() {
          await window.handleSignOut();
          window.location.href = 'index.html';
        };

        // Switch Tab inside Auth Modal
        window.switchAuthTab = function(tabId) {
          const btn = document.getElementById(tabId);
          if (btn && typeof bootstrap !== 'undefined' && bootstrap.Tab) {
            const bsTab = new bootstrap.Tab(btn);
            bsTab.show();
          }
        };

        // Update User Profile
        window.handleUpdateUserProfile = async function() {
          if (!window.personnelAuth || !currentAuthUser) return;
          const nameInput = document.getElementById('editProfileNameInput');
          const photoInput = document.getElementById('editProfilePhotoInput');
          const name = nameInput ? nameInput.value.trim() : '';
          const photo = photoInput ? photoInput.value.trim() : '';

          try {
            await updateProfile(currentAuthUser, {
              displayName: name,
              photoURL: photo
            });
            if (window.db) {
              const userRef = doc(window.db, "users", currentAuthUser.uid);
              await setDoc(userRef, {
                displayName: name,
                photoURL: photo,
                updatedAt: new Date().toISOString()
              }, { merge: true });
            }
            if (typeof showToast === 'function') showToast("อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว");
          } catch (err) {
            if (typeof showToast === 'function') showToast(`อัปเดตโปรไฟล์ไม่สำเร็จ: ${err.message}`);
          }
        };

        // Ensure Admin User in Firestore
        window.ensureAdminUserInUsersCollection = async function() {
          if (!window.db) return;
          try {
            const adminDocRef = doc(window.db, "users", "admin_jaru072");
            const adminDocSnap = await getDoc(adminDocRef);
            const nowIso = new Date().toISOString();
            if (!adminDocSnap.exists()) {
              await setDoc(adminDocRef, {
                uid: "admin_jaru072",
                displayName: "Thamma Srithong",
                email: "jaru072@gmail.com",
                role: "ADMIN",
                status: "Online",
                isOnline: true,
                photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
                createdAt: nowIso,
                updatedAt: nowIso,
                lastLoginAt: nowIso
              });
            }
          } catch (err) {
            console.warn("ensureAdminUserInUsersCollection notice:", err);
          }
        };

        // Helper to evaluate user online status
        function getUserOnlineStatusInfo(u) {
          const isCurrentAuth = Boolean(currentAuthUser && (
            (currentAuthUser.uid && (currentAuthUser.uid === u.id || currentAuthUser.uid === u.uid)) ||
            (currentAuthUser.email && u.email && currentAuthUser.email.toLowerCase() === u.email.toLowerCase())
          ));
          let isOnline = isCurrentAuth || (u.isOnline === true) || (u.status === 'Online');
          let timeVal = 0;
          if (u.lastActiveAt) timeVal = new Date(u.lastActiveAt).getTime();
          else if (u.lastLoginAt) timeVal = new Date(u.lastLoginAt).getTime();
          else if (u.updatedAt) timeVal = new Date(u.updatedAt).getTime();
          if (isNaN(timeVal)) timeVal = 0;
          return { isOnline, timeVal };
        }

        // Render Users Table in Admin Tab
        window.renderUsersTable = function renderUsersTable() {
          const tbody = document.getElementById('usersTableBody');
          const countBadge = document.getElementById('userSearchResultCount');
          if (!tbody) return;

          if (allUsersList.length === 0) {
            if (countBadge) countBadge.textContent = 'แสดง 0 รายการ';
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">ยังไม่มีผู้ใช้งานลงทะเบียนในระบบ</td></tr>`;
            return;
          }

          const searchQuery = (document.getElementById('userSearchInput')?.value || '').trim().toLowerCase();
          const roleFilter = document.getElementById('userRoleFilterSelect')?.value || 'ALL';

          const filteredList = allUsersList.filter(u => {
            const uRole = u.role || 'WORKER';
            if (roleFilter !== 'ALL' && uRole !== roleFilter) return false;
            if (searchQuery) {
              const name = (u.displayName || '').toLowerCase();
              const email = (u.email || '').toLowerCase();
              const uid = (u.id || '').toLowerCase();
              return name.includes(searchQuery) || email.includes(searchQuery) || uid.includes(searchQuery);
            }
            return true;
          });

          filteredList.sort((a, b) => {
            const infoA = getUserOnlineStatusInfo(a);
            const infoB = getUserOnlineStatusInfo(b);
            if (infoA.isOnline && !infoB.isOnline) return -1;
            if (!infoA.isOnline && infoB.isOnline) return 1;
            if (infoB.timeVal !== infoA.timeVal) return infoB.timeVal - infoA.timeVal;
            const nameA = a.displayName || a.email || '';
            const nameB = b.displayName || b.email || '';
            return nameA.localeCompare(nameB, 'th');
          });

          if (countBadge) {
            countBadge.textContent = `แสดง ${filteredList.length} / ${allUsersList.length} รายการ`;
          }

          if (filteredList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4"><i class="bi bi-search me-1 text-warning"></i> ไม่พบรายชื่อผู้ใช้งานที่ค้นหา</td></tr>`;
            return;
          }

          const empList = Array.isArray(window.employees) ? window.employees : [];

          tbody.innerHTML = filteredList.map(u => {
            const uRole = u.role || 'WORKER';
            const img = u.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
            const { isOnline } = getUserOnlineStatusInfo(u);

            const onlineBadge = isOnline
              ? `<span class="badge bg-success bg-opacity-10 text-success rounded-pill px-2.5 py-1 fw-bold fs-8 d-inline-flex align-items-center gap-1"><i class="bi bi-circle-fill text-success" style="font-size: 7px;"></i> Online</span>`
              : `<span class="badge bg-danger bg-opacity-10 text-danger rounded-pill px-2.5 py-1 fw-bold fs-8 d-inline-flex align-items-center gap-1"><i class="bi bi-circle-fill text-danger" style="font-size: 7px;"></i> Offline</span>`;

            const safeName = u.displayName || 'ผู้ใช้';
            const safeEmail = u.email || '-';
            const hasPersonnel = (u.accessPersonnel !== undefined) ? Boolean(u.accessPersonnel) : (uRole === 'ADMIN' || uRole === 'MANAGER' || uRole === 'STAFF');
            const hasInventory = (u.accessInventory !== undefined) ? Boolean(u.accessInventory) : true;
            const hasPayroll = Boolean(u.accessPayroll);
            const hasProcurement = Boolean(u.accessProcurement);

            // Match linked employee
            const currentLinkedEmpId = u.linkedEmployeeId || '';
            const matchedEmpByEmail = !currentLinkedEmpId && u.email ? empList.find(e => e.email && String(e.email).trim().toLowerCase() === String(u.email).trim().toLowerCase()) : null;
            const targetEmpId = currentLinkedEmpId || (matchedEmpByEmail ? (matchedEmpByEmail.id || matchedEmpByEmail.code) : '');

            const empOptions = [
              `<option value="">-- ยังไม่ผูกบุคลากร --</option>`,
              ...empList.map(emp => {
                const empIdVal = emp.id || emp.code;
                const isSelected = (empIdVal === targetEmpId || emp.code === targetEmpId) ? 'selected' : '';
                const empCodeStr = emp.code ? `[${emp.code}] ` : '';
                const empDeptStr = emp.department ? ` (${emp.department})` : '';
                return `<option value="${empIdVal}" ${isSelected}>${empCodeStr}${emp.name || 'ไม่มีชื่อ'}${empDeptStr}</option>`;
              })
            ].join('');

            return `
              <tr class="text-nowrap align-middle">
                <td class="ps-3 text-nowrap">
                  <div class="d-flex align-items-center gap-2 text-nowrap">
                    <img src="${img}" class="rounded-circle shadow-sm flex-shrink-0" style="width: 28px; height: 28px; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'" />
                    <span class="fw-bold text-dark text-nowrap">${safeName}</span>
                  </div>
                </td>
                <td class="text-muted fs-8 text-nowrap">
                  <span>${safeEmail}</span>
                  ${matchedEmpByEmail && !currentLinkedEmpId ? `<span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 ms-1 fs-9 text-nowrap" title="แนะนำผูกตามอีเมล"><i class="bi bi-link-45deg"></i> แนะนำ</span>` : ''}
                </td>
                <td class="text-center text-nowrap">${onlineBadge}</td>
                <td class="text-center text-nowrap">
                  <select id="userRoleSelect_${u.id}" class="form-select form-select-sm fw-semibold" style="min-width: 140px;" onchange="window.onUserRoleSelectChanged('${u.id}')">
                    <option value="ADMIN" ${uRole === 'ADMIN' ? 'selected' : ''}>🔴 ผู้ดูแลระบบ (ADMIN)</option>
                    <option value="MANAGER" ${uRole === 'MANAGER' ? 'selected' : ''}>🔵 ผู้จัดการ/บริหาร (MANAGER)</option>
                    <option value="STAFF" ${uRole === 'STAFF' ? 'selected' : ''}>🟣 เจ้าหน้าที่ (STAFF)</option>
                    <option value="WORKER" ${uRole === 'WORKER' ? 'selected' : ''}>🟢 พนักงาน (WORKER)</option>
                  </select>
                </td>
                <td class="text-center text-nowrap">
                  <div class="d-flex align-items-center justify-content-center gap-2 text-nowrap flex-nowrap">
                    <div class="form-check form-switch m-0 d-inline-flex align-items-center gap-1" title="สิทธิ์เข้าระบบงานบุคคล (HR)">
                      <input class="form-check-input mt-0" type="checkbox" id="userAccPersonnel_${u.id}" ${hasPersonnel ? 'checked' : ''} onchange="window.updateFirestoreUserRole('${u.id}')">
                      <label class="form-check-label fs-8 fw-semibold text-primary text-nowrap" for="userAccPersonnel_${u.id}">👥 บุคคล</label>
                    </div>
                    <div class="form-check form-switch m-0 d-inline-flex align-items-center gap-1" title="สิทธิ์เข้าระบบพัสดุและอุปกรณ์">
                      <input class="form-check-input mt-0" type="checkbox" id="userAccInventory_${u.id}" ${hasInventory ? 'checked' : ''} onchange="window.updateFirestoreUserRole('${u.id}')">
                      <label class="form-check-label fs-8 fw-semibold text-success text-nowrap" for="userAccInventory_${u.id}">📦 พัสดุฯ</label>
                    </div>
                    <div class="form-check form-switch m-0 d-inline-flex align-items-center gap-1" title="สิทธิ์เข้าระบบเงินเดือน (เฉพาะการเงิน/ผู้ดูแลระบบ)">
                      <input class="form-check-input mt-0" type="checkbox" id="userAccPayroll_${u.id}" ${hasPayroll ? 'checked' : ''} onchange="window.updateFirestoreUserRole('${u.id}')">
                      <label class="form-check-label fs-8 fw-semibold text-warning text-nowrap" for="userAccPayroll_${u.id}">💰 เงินเดือน</label>
                    </div>
                    <div class="form-check form-switch m-0 d-inline-flex align-items-center gap-1" title="สิทธิ์การจัดการจัดซื้อ (อนุมัติ/ออก PO/ตรวจรับ)">
                      <input class="form-check-input mt-0" type="checkbox" id="userAccProcurement_${u.id}" ${hasProcurement ? 'checked' : ''} onchange="window.updateFirestoreUserRole('${u.id}')">
                      <label class="form-check-label fs-8 fw-semibold text-nowrap" style="color: #0f766e;" for="userAccProcurement_${u.id}">🛒 จัดซื้อฯ</label>
                    </div>
                  </div>
                </td>
                <td class="text-center text-nowrap">
                  <select id="userLinkedEmp_${u.id}" class="form-select form-select-sm fs-8 border-secondary border-opacity-50 text-truncate" style="min-width: 170px;" onchange="window.updateFirestoreUserRole('${u.id}')">
                    ${empOptions}
                  </select>
                </td>
                <td class="text-end pe-3 text-nowrap">
                  <button class="btn btn-sm btn-outline-success rounded-pill px-3 fw-semibold text-nowrap" onclick="window.updateFirestoreUserRole('${u.id}')">
                    <i class="bi bi-check-lg me-1"></i> บันทึก
                  </button>
                </td>
              </tr>
            `;
          }).join('');
        };

        // Role Select Change Handler
        window.onUserRoleSelectChanged = function(userId) {
          const selectElem = document.getElementById(`userRoleSelect_${userId}`);
          const chkPersonnel = document.getElementById(`userAccPersonnel_${userId}`);
          const chkInventory = document.getElementById(`userAccInventory_${userId}`);
          const chkPayroll = document.getElementById(`userAccPayroll_${userId}`);
          const chkProcurement = document.getElementById(`userAccProcurement_${userId}`);
          if (!selectElem) return;

          const role = selectElem.value;
          if (role === 'ADMIN') {
            if (chkPersonnel) chkPersonnel.checked = true;
            if (chkInventory) chkInventory.checked = true;
            if (chkPayroll) chkPayroll.checked = true;
            if (chkProcurement) chkProcurement.checked = true;
          } else if (role === 'MANAGER') {
            if (chkPersonnel) chkPersonnel.checked = true;
            if (chkInventory) chkInventory.checked = true;
            if (chkPayroll) chkPayroll.checked = true;
            if (chkProcurement) chkProcurement.checked = true;
          } else if (role === 'STAFF') {
            if (chkPersonnel) chkPersonnel.checked = false;
            if (chkInventory) chkInventory.checked = true;
            if (chkPayroll) chkPayroll.checked = false;
            if (chkProcurement) chkProcurement.checked = false;
          } else if (role === 'WORKER') {
            if (chkPersonnel) chkPersonnel.checked = false;
            if (chkInventory) chkInventory.checked = true;
            if (chkPayroll) chkPayroll.checked = false;
            if (chkProcurement) chkProcurement.checked = false;
          }
          window.updateFirestoreUserRole(userId);
        };

        // Load Users Table from Firestore
        window.loadUsersTableFromFirestore = async function() {
          const tbody = document.getElementById('usersTableBody');
          if (!tbody || !window.db) return;
          try {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3"><div class="spinner-border spinner-border-sm text-success me-2"></div> กำลังโหลดรายชื่อผู้ใช้งาน...</td></tr>`;
            await window.ensureAdminUserInUsersCollection();

            onSnapshot(collection(window.db, "users"), (snapshot) => {
              allUsersList = [];
              snapshot.forEach(docSnap => {
                allUsersList.push({ id: docSnap.id, ...docSnap.data() });
              });
              window.renderUsersTable();
            }, (err) => {
              console.warn("Users snapshot notice:", err);
              if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-3">เกิดข้อผิดพลาด: ${err.message}</td></tr>`;
            });
          } catch (err) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-3">ไม่สามารถอ่านข้อมูลผู้ใช้: ${err.message}</td></tr>`;
          }
        };

        // Update Firestore User Role & Linked Employee
        window.updateFirestoreUserRole = async function(userId) {
          const selectElem = document.getElementById(`userRoleSelect_${userId}`);
          const chkPersonnel = document.getElementById(`userAccPersonnel_${userId}`);
          const chkInventory = document.getElementById(`userAccInventory_${userId}`);
          const chkPayroll = document.getElementById(`userAccPayroll_${userId}`);
          const chkProcurement = document.getElementById(`userAccProcurement_${userId}`);
          const selEmp = document.getElementById(`userLinkedEmp_${userId}`);
          if (!selectElem || !window.db) return;

          const newRole = selectElem.value;
          const accessPersonnel = chkPersonnel ? chkPersonnel.checked : (newRole === 'ADMIN' || newRole === 'MANAGER' || newRole === 'STAFF');
          const accessInventory = chkInventory ? chkInventory.checked : true;
          const accessPayroll = chkPayroll ? chkPayroll.checked : (newRole === 'ADMIN');
          const accessProcurement = chkProcurement ? chkProcurement.checked : (newRole === 'ADMIN' || newRole === 'MANAGER');

          const linkedEmpId = selEmp ? selEmp.value : '';
          const empList = Array.isArray(window.employees) ? window.employees : [];
          const matchedEmp = empList.find(e => (e.id === linkedEmpId || e.code === linkedEmpId));
          const linkedEmpName = matchedEmp ? (matchedEmp.name || '') : '';
          const linkedEmpCode = matchedEmp ? (matchedEmp.code || '') : '';

          try {
            const userRef = doc(window.db, "users", userId);
            await updateDoc(userRef, {
              role: newRole,
              accessPersonnel: accessPersonnel,
              accessInventory: accessInventory,
              accessPayroll: accessPayroll,
              accessProcurement: accessProcurement,
              linkedEmployeeId: linkedEmpId,
              linkedEmployeeName: linkedEmpName,
              linkedEmployeeCode: linkedEmpCode,
              modules: [
                ...(accessPersonnel ? ['personnel'] : []),
                ...(accessInventory ? ['inventory'] : []),
                ...(accessPayroll ? ['payroll'] : []),
                ...(accessProcurement ? ['procurement'] : [])
              ],
              updatedAt: new Date().toISOString()
            });

            // Bi-directional link to employee document if selected
            if (linkedEmpId) {
              const uObj = allUsersList.find(u => u.id === userId);
              const userEmailStr = uObj?.email || '';
              try {
                const empRef = doc(window.db, "employees", linkedEmpId);
                await updateDoc(empRef, {
                  linkedUserId: userId,
                  linkedUserEmail: userEmailStr,
                  updatedAt: new Date().toISOString()
                });
              } catch (empErr) {
                console.warn("Could not update linked employee document:", empErr);
              }
            }

            if (typeof showToast === 'function') showToast(`บันทึกสิทธิ์และผูกบัญชีบุคลากรเรียบร้อยแล้ว`);
          } catch (err) {
            if (typeof showToast === 'function') showToast(`บันทึกไม่สำเร็จ: ${err.message}`);
          }
        };

        // Open Personnel Backup & Restore Modal Helper
        if (!window.openPersonnelBackupRestoreModal) {
          window.openPersonnelBackupRestoreModal = function() {
            const modalElem = document.getElementById('personnelBackupRestoreModal');
            if (modalElem && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
              const modalInst = bootstrap.Modal.getOrCreateInstance(modalElem);
              modalInst.show();
            }
            if (typeof window.refreshPersonnelBackupModalStats === 'function') {
              window.refreshPersonnelBackupModalStats();
            }
          };
        }
        window.openBackupRestoreModal = window.openPersonnelBackupRestoreModal;

        if (typeof window.connectOrgTreeFirestore === 'function') window.connectOrgTreeFirestore({ db: window.db, doc, setDoc, onSnapshot });
        if (typeof window.floraLogo?.connectGlobalLogoFirestore === 'function') window.floraLogo.connectGlobalLogoFirestore({ db: window.db, doc, setDoc, onSnapshot, getDoc, getDocs, collection, deleteDoc });

        // Real-time listener for employees
        onSnapshot(collection(window.db, "employees"), async (snapshot) => {
          let list = [];
          if (!snapshot.empty) {
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              list.push({ id: docSnap.id, ...data });
            });
            window.employees = list;
            try {
              if (typeof window.syncFloraEmployeesToTree === 'function') window.syncFloraEmployeesToTree(false);
            } catch (err) {
              console.warn("syncFloraEmployeesToTree notice:", err);
            }
            syncToLocalStorage();
          } else {
            // If cloud collection is currently empty, preserve any cached personnel data from localStorage
            let cached = null;
            try {
              const saved = getScopedLocalStorageItem('flora_employees') || localStorage.getItem('flora_employees');
              if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) cached = parsed;
              }
            } catch (e) {}
            if (cached && cached.length > 0) {
              window.employees = cached;
            } else {
              window.employees = [];
            }
          }

          try {
            renderOrgChart();
            renderPersonnelAttendanceControls();
            window.dispatchEvent(new CustomEvent('flora-personnel-data-changed', { detail: { count: window.employees ? window.employees.length : 0 } }));
          } catch (err) {
            console.error("renderOrgChart notice:", err);
          }
        }, (error) => {
          console.warn("Firestore snapshot notice:", error);
          loadFromLocalStorageOrSeed();
        });

        // Attendance is managed in the personnel workspace and stored in the
        // same primary Firestore database as employees and org_structure.
        onSnapshot(collection(window.db, "attendance"), (snapshot) => {
          window.attendanceLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          renderPersonnelAttendanceControls();
        }, (error) => {
          console.warn("Attendance snapshot notice:", error);
          renderPersonnelAttendanceControls();
        });

        // ตำแหน่งและแผนกอ่านจาก Tree ชุดเดียว

      } catch (err) {
        console.error("Firebase init error in Org Chart:", err);
        loadFromLocalStorageOrSeed();
      }
    }

    function localDateKey(date = new Date()) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // --- State & Scanner Variables for Attendance ---
    let attHtml5QrCode = null;
    let attIsScanning = false;
    let attLastScannedCode = '';
    let attLastScanTimestamp = 0;
    let attCurrentGpsLocation = null;
    let attIsLocatingGps = false;

    // GPS Location Tracker (HTML5 Geolocation)
    function updateGpsStatusUi(status, text, coordsText) {
      const badge = document.getElementById('attGpsStatusBadge');
      const coords = document.getElementById('attGpsCoordinatesText');
      const icon = document.getElementById('attGpsIcon');

      if (badge) {
        badge.textContent = text;
        badge.className = status === 'ready' ? 'badge bg-success text-white border-0 px-1.5 py-0.5 rounded-pill fs-9' :
                          status === 'locating' ? 'badge bg-warning text-dark border-0 px-1.5 py-0.5 rounded-pill fs-9' :
                          'badge bg-secondary text-white border-0 px-1.5 py-0.5 rounded-pill fs-9';
      }
      if (coords && coordsText) {
        coords.textContent = coordsText;
      }
      if (icon) {
        icon.className = status === 'ready' ? 'bi bi-geo-alt-fill text-success fs-6' :
                         status === 'locating' ? 'bi bi-geo-alt text-warning fs-6' :
                         'bi bi-geo-alt-fill text-secondary fs-6';
      }
    }

    async function requestGpsPosition(userInitiated = false) {
      if (!('geolocation' in navigator)) {
        updateGpsStatusUi('disabled', 'ไม่รองรับ GPS', 'อุปกรณ์นี้ไม่รองรับระบบตรวจหาตำแหน่ง');
        if (userInitiated) showToast('อุปกรณ์/เบราว์เซอร์ไม่รองรับ GPS');
        return null;
      }

      if (attIsLocatingGps && !userInitiated) return attCurrentGpsLocation;
      attIsLocatingGps = true;
      updateGpsStatusUi('locating', 'กำลังระบุพิกัด...', 'กำลังเชื่อมต่อสัญญาณดาวเทียม/เครือข่าย');

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            attIsLocatingGps = false;
            const lat = Number(pos.coords.latitude.toFixed(6));
            const lng = Number(pos.coords.longitude.toFixed(6));
            const acc = Math.round(pos.coords.accuracy || 0);
            attCurrentGpsLocation = {
              latitude: lat,
              longitude: lng,
              accuracy: acc,
              timestamp: new Date().toISOString()
            };
            updateGpsStatusUi('ready', `พิกัดพร้อม (±${acc}m)`, `ละติจูด: ${lat}, ลองจิจูด: ${lng}`);
            if (userInitiated) showToast(`อัปเดตพิกัด GPS สำเร็จ (ความแม่นยำ ±${acc} เมตร)`);
            resolve(attCurrentGpsLocation);
          },
          (err) => {
            attIsLocatingGps = false;
            console.warn('Geolocation notice:', err.message || err);
            let errMsg = 'ไม่ได้รับอนุญาตสิทธิ์เข้าถึงพิกัด';
            if (err.code === 2) errMsg = 'ไม่สามารถจับสัญญาณพิกัดได้';
            else if (err.code === 3) errMsg = 'หมดเวลารอสัญญาณ GPS';
            updateGpsStatusUi('error', 'ไม่ได้เปิดพิกัด', errMsg);
            if (userInitiated) showToast(`ไม่สามารถดึงพิกัดได้: ${errMsg}`);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
        );
      });
    }
    window.requestGpsPosition = requestGpsPosition;

    // Helper: Find employee by raw scanned QR text or barcode
    function resolveEmployeeFromScan(rawCode) {
      if (!rawCode || typeof rawCode !== 'string') return null;
      let clean = rawCode.trim();
      const list = window.employees || [];

      // 1. Direct match on ID or Code
      let found = list.find(e => 
        String(e.id || '').trim().toLowerCase() === clean.toLowerCase() || 
        String(e.code || '').trim().toLowerCase() === clean.toLowerCase()
      );
      if (found) return found;

      // 2. Strip common prefixes like EMPLOYEE:, EE:, EMP:, PERSONNEL:, STAFF:, ID:, CODE:
      const stripped = clean.replace(/^(EMPLOYEE|EE|EMP|PERSONNEL|STAFF|ID|CODE)\s*[:=\-_\/]\s*/i, '').trim();
      if (stripped) {
        found = list.find(e => 
          String(e.id || '').trim().toLowerCase() === stripped.toLowerCase() || 
          String(e.code || '').trim().toLowerCase() === stripped.toLowerCase()
        );
        if (found) return found;
      }

      // 2.1 Check if stored employee code has prefix that matches clean/stripped
      found = list.find(e => {
        const strippedEId = String(e.id || '').trim().toLowerCase().replace(/^(employee|ee|emp|personnel|staff|id|code)\s*[:=\-_\/]\s*/i, '');
        const strippedECode = String(e.code || '').trim().toLowerCase().replace(/^(employee|ee|emp|personnel|staff|id|code)\s*[:=\-_\/]\s*/i, '');
        const lowerClean = clean.toLowerCase();
        const lowerStripped = stripped ? stripped.toLowerCase() : '';
        return strippedEId === lowerClean || strippedECode === lowerClean ||
               (lowerStripped && (strippedEId === lowerStripped || strippedECode === lowerStripped));
      });
      if (found) return found;

      // 3. JSON Payload match (e.g. {"id":"SF-01", "code":"SF-01", "name":"..."})
      try {
        if (clean.startsWith('{') && clean.endsWith('}')) {
          const parsed = JSON.parse(clean);
          const candidateId = parsed.code || parsed.id || parsed.employeeId || parsed.empId;
          if (candidateId) {
            const candClean = String(candidateId).trim().replace(/^(EMPLOYEE|EE|EMP|PERSONNEL|STAFF|ID|CODE)\s*[:=\-_\/]\s*/i, '').trim();
            found = list.find(e => 
              String(e.id || '').trim().toLowerCase() === candClean.toLowerCase() || 
              String(e.code || '').trim().toLowerCase() === candClean.toLowerCase()
            );
            if (found) return found;
          }
        }
      } catch (e) {}

      // 4. Match URL/URI format (e.g. https://domain.com/emp/SF-01 or id=SF-01 or code=SF-01)
      if (clean.includes('id=') || clean.includes('code=')) {
        const idMatch = clean.match(/(?:id|code)=([^&]+)/i);
        if (idMatch && idMatch[1]) {
          const extractedId = decodeURIComponent(idMatch[1]).trim().replace(/^(EMPLOYEE|EE|EMP|PERSONNEL|STAFF|ID|CODE)\s*[:=\-_\/]\s*/i, '').trim();
          found = list.find(e => 
            String(e.id || '').trim().toLowerCase() === extractedId.toLowerCase() || 
            String(e.code || '').trim().toLowerCase() === extractedId.toLowerCase()
          );
          if (found) return found;
        }
      }

      // 5. Match by Exact Name
      found = list.find(e => 
        String(e.name || '').trim().toLowerCase() === clean.toLowerCase() ||
        (stripped && String(e.name || '').trim().toLowerCase() === stripped.toLowerCase())
      );
      return found || null;
    }

    // Audio Feedback for Scanning (Web Audio API)
    function playScanBeep(success = true) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        if (success) {
          osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
          osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08); // E6
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.25);
        } else {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, ctx.currentTime);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.35);
        }
      } catch (e) {}
    }

    // Determine Auto Status (Clock In vs Clock Out)
    function determineAutoAttendanceStatus(employeeId) {
      const now = new Date();
      const todayKey = localDateKey(now);
      const todayThai = now.toLocaleDateString('th-TH');

      const todayLogs = (window.attendanceLogs || []).filter(log => {
        const matchEmp = String(log.employeeId || '') === String(employeeId);
        const matchDate = log.dateKey === todayKey || log.date === todayThai;
        return matchEmp && matchDate;
      });

      if (todayLogs.length === 0) {
        // No logs today -> Default to Clock In (เข้างาน)
        return 'เข้างาน';
      }

      // If already clocked in and not clocked out yet -> Default to Clock Out (เลิกงาน)
      const hasClockIn = todayLogs.some(l => l.status === 'เข้างาน');
      const hasClockOut = todayLogs.some(l => l.status === 'เลิกงาน');

      if (hasClockIn && !hasClockOut) {
        return 'เลิกงาน';
      }

      // If already both clocked in and out, look at time of day (morning: เข้างาน, afternoon: เลิกงาน)
      const currentHour = now.getHours();
      return currentHour < 12 ? 'เข้างาน' : 'เลิกงาน';
    }

    // Process Scanned Employee QR/Barcode
    async function processAttendanceScan(rawCode, source = 'qr_scanner') {
      const nowTs = Date.now();
      if (rawCode === attLastScannedCode && (nowTs - attLastScanTimestamp) < 4000) {
        // Debounce / Cooldown protection
        return;
      }
      attLastScannedCode = rawCode;
      attLastScanTimestamp = nowTs;

      // Update cooldown indicator
      const cooldownBadge = document.getElementById('attScanCooldownBadge');
      if (cooldownBadge) {
        cooldownBadge.textContent = 'กำลังประมวลผล...';
        cooldownBadge.className = 'badge bg-warning text-dark font-monospace';
        setTimeout(() => {
          if (cooldownBadge) {
            cooldownBadge.textContent = 'พร้อมสแกน';
            cooldownBadge.className = 'badge bg-secondary-subtle text-secondary font-monospace';
          }
        }, 3000);
      }

      const emp = resolveEmployeeFromScan(rawCode);
      const resultCard = document.getElementById('attLastScanResult');

      if (!emp) {
        playScanBeep(false);
        if (resultCard) {
          resultCard.className = 'mt-3 p-3 rounded-3 border border-danger bg-danger bg-opacity-10 text-danger d-block';
          resultCard.innerHTML = `
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-exclamation-triangle-fill fs-4"></i>
              <div>
                <div class="fw-bold">ไม่พบบุคลากรในสารบบ</div>
                <div class="small">รหัสที่สแกนได้: <code class="text-danger fw-bold">${escapeHtml(rawCode)}</code></div>
              </div>
            </div>
          `;
        }
        showToast(`ไม่พบบุคลากรรหัส "${rawCode}" ในระบบ`);
        return;
      }

      if (!window.db) {
        showToast('ยังไม่สามารถเชื่อมต่อฐานข้อมูลหลัก Firestore ได้');
        return;
      }

      // Determine Auto Status (Clock In vs Clock Out)
      const autoStatus = determineAutoAttendanceStatus(emp.id || emp.code);
      const now = new Date();
      const statusColor = autoStatus === 'เข้างาน' ? 'success' : 'danger';
      const statusIcon = autoStatus === 'เข้างาน' ? 'bi-box-arrow-in-right' : 'bi-box-arrow-right';

      // Capture GPS location if available or refresh quickly
      let gps = attCurrentGpsLocation;
      if (!gps && 'geolocation' in navigator) {
        try {
          gps = await requestGpsPosition(false);
        } catch (e) {}
      }

      const entry = {
        employeeId: String(emp.id || emp.code || ''),
        employeeName: emp.name || 'ไม่ระบุชื่อ',
        employeeCode: emp.code || emp.id || '',
        department: emp.department || '',
        role: emp.role || '',
        status: autoStatus,
        time: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
        date: now.toLocaleDateString('th-TH'),
        dateKey: localDateKey(now),
        note: `สแกนผ่าน ${source === 'barcode_gun' ? 'บาร์โค้ด / รหัส' : 'QR Scanner'} (อัตโนมัติ)`,
        timestamp: now.toISOString(),
        source: source,
        latitude: gps?.latitude || null,
        longitude: gps?.longitude || null,
        accuracy: gps?.accuracy || null
      };

      try {
        await addDoc(collection(window.db, 'attendance'), entry);
        await window.logPersonnelAudit?.('สแกนลงเวลาอัตโนมัติ', {
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          status: autoStatus,
          source: source,
          hasGps: !!(entry.latitude && entry.longitude)
        });

        playScanBeep(true);

        const gpsNotice = (entry.latitude && entry.longitude) ?
          `<div class="small text-success mt-1"><i class="bi bi-geo-alt-fill me-1"></i>บันทึกพิกัด GPS: ${entry.latitude}, ${entry.longitude} (±${entry.accuracy || 0}m)</div>` :
          `<div class="small text-muted mt-1"><i class="bi bi-geo-alt me-1"></i>ไม่มีพิกัด GPS (ไม่ได้เปิดการระบุตำแหน่ง)</div>`;

        if (resultCard) {
          resultCard.className = `mt-3 p-3 rounded-3 border border-${statusColor} bg-${statusColor} bg-opacity-10 text-${statusColor} d-block`;
          resultCard.innerHTML = `
            <div class="d-flex align-items-center gap-3">
              <div class="rounded-circle bg-${statusColor} text-white d-flex align-items-center justify-content-center" style="width: 44px; height: 44px; min-width: 44px;">
                <i class="bi ${statusIcon} fs-4"></i>
              </div>
              <div class="flex-grow-1">
                <div class="fw-bold text-dark fs-6">${escapeHtml(emp.name || 'บุคลากร')} <span class="badge bg-${statusColor} ms-1">${escapeHtml(autoStatus)}</span></div>
                <div class="small text-muted">${escapeHtml(emp.department || '')} • ${escapeHtml(emp.role || '')}</div>
                <div class="small fw-semibold text-${statusColor} mt-1"><i class="bi bi-clock me-1"></i>ลงเวลา: ${entry.time} (${entry.date})</div>
                ${gpsNotice}
              </div>
            </div>
          `;
        }
        showToast(`บันทึก "${autoStatus}" ของ ${emp.name} สำเร็จ` + (entry.latitude ? ' พร้อมพิกัด GPS' : ''));
      } catch (err) {
        console.error('Scan attendance save error:', err);
        showToast('บันทึกลงฐานข้อมูลไม่สำเร็จ กรุณาตรวจสอบสิทธิ์การเชื่อมต่อ');
      }
    }

    // Camera Scanner Controller
    async function toggleAttCameraScanner() {
      const container = document.getElementById('attCameraContainer');
      const btnText = document.getElementById('btnToggleAttCameraText');
      const btn = document.getElementById('btnToggleAttCamera');

      if (attIsScanning) {
        await stopAttQrScanner();
        return;
      }

      if (typeof Html5Qrcode === 'undefined') {
        showToast('กำลังโหลดไลบรารีสแกนเนอร์ กรุณาลองใหม่อีกครั้ง');
        return;
      }

      // Pre-fetch GPS location when camera starts
      requestGpsPosition(false);

      try {
        if (!attHtml5QrCode) {
          attHtml5QrCode = new Html5Qrcode('attQrReader');
        }

        container?.classList.remove('d-none');
        if (btnText) btnText.textContent = 'หยุดกล้องสแกน';
        if (btn) btn.className = 'btn btn-danger flex-grow-1 rounded-pill fw-semibold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2';

        const config = { fps: 10, qrbox: { width: 220, height: 220 } };
        await attHtml5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            processAttendanceScan(decodedText, 'camera_qr');
          },
          () => {}
        );
        attIsScanning = true;
      } catch (err) {
        console.error('Start QR Scanner Error:', err);
        showToast('ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบการอนุญาตสิทธิ์กล้อง');
        stopAttQrScanner();
      }
    }

    async function stopAttQrScanner() {
      const container = document.getElementById('attCameraContainer');
      const btnText = document.getElementById('btnToggleAttCameraText');
      const btn = document.getElementById('btnToggleAttCamera');

      if (attHtml5QrCode && attIsScanning) {
        try {
          await attHtml5QrCode.stop();
        } catch (e) {}
      }
      attIsScanning = false;
      container?.classList.add('d-none');
      if (btnText) btnText.textContent = 'เปิดกล้องสแกน QR';
      if (btn) btn.className = 'btn btn-success flex-grow-1 rounded-pill fw-semibold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2';
    }

    window.toggleAttCameraScanner = toggleAttCameraScanner;
    window.stopAttQrScanner = stopAttQrScanner;

    // Barcode Gun & Text Input Handler
    function submitAttBarcodeInput() {
      const input = document.getElementById('attBarcodeInput');
      const code = (input?.value || '').trim();
      if (!code) {
        showToast('กรุณายิงบาร์โค้ด หรือพิมพ์รหัสพนักงาน');
        return;
      }
      processAttendanceScan(code, 'barcode_gun');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
    window.submitAttBarcodeInput = submitAttBarcodeInput;

    // Delete Log Entry
    async function deleteAttendanceLog(logId, employeeName) {
      if (!logId || !window.db) return;
      if (window.requirePersonnelAdmin && !window.requirePersonnelAdmin('ลบรายการลงเวลา')) return;
      if (!confirm(`ต้องการลบรายการลงเวลาของ "${employeeName || 'บุคลากร'}" ใช่หรือไม่?`)) return;

      try {
        await deleteDoc(doc(window.db, 'attendance', logId));
        await window.logPersonnelAudit?.('ลบรายการลงเวลา', { logId, employeeName });
        showToast('ลบรายการลงเวลาเรียบร้อยแล้ว');
      } catch (err) {
        console.error('Delete attendance error:', err);
        showToast('ลบรายการไม่สำเร็จ กรุณาตรวจสอบสิทธิ์');
      }
    }
    window.deleteAttendanceLog = deleteAttendanceLog;

    // Export Today Attendance CSV
    function exportTodayAttendanceCsv() {
      const now = new Date();
      const todayKey = localDateKey(now);
      const todayThai = now.toLocaleDateString('th-TH');

      const today = (window.attendanceLogs || []).filter(log => log.dateKey === todayKey || log.date === todayThai).sort((a, b) => {
        const ta = Date.parse(a.timestamp || a.updatedAt || '') || 0;
        const tb = Date.parse(b.timestamp || b.updatedAt || '') || 0;
        return tb - ta;
      });

      if (!today.length) {
        showToast('ยังไม่มีข้อมูลการลงเวลาสำหรับส่งออกวันนี้');
        return;
      }

      const headers = ['เวลา', 'รหัสพนักงาน', 'ชื่อ-นามสกุล', 'แผนก', 'สถานะ', 'ช่องทาง', 'ละติจูด', 'ลองจิจูด', 'ความแม่นยำ(เมตร)', 'ลิงก์แผนที่', 'หมายเหตุ', 'วันที่'];
      const rows = today.map(l => [
        `"${l.time || ''}"`,
        `"${l.employeeCode || l.employeeId || ''}"`,
        `"${l.employeeName || ''}"`,
        `"${l.department || ''}"`,
        `"${l.status || ''}"`,
        `"${l.source || 'org_chart'}"`,
        `"${l.latitude || ''}"`,
        `"${l.longitude || ''}"`,
        `"${l.accuracy || ''}"`,
        `"${l.latitude && l.longitude ? `https://www.google.com/maps?q=${l.latitude},${l.longitude}` : ''}"`,
        `"${(l.note || '').replace(/"/g, '""')}"`,
        `"${l.date || todayThai}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${todayKey}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('ส่งออกไฟล์ CSV พร้อมพิกัด GPS เรียบร้อยแล้ว');
    }
    window.exportTodayAttendanceCsv = exportTodayAttendanceCsv;

    function renderPersonnelAttendanceControls() {
      const select = document.getElementById('personnelAttendanceEmployee');
      if (select) {
        const previous = select.value;
        const list = [...(window.employees || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'));
        select.innerHTML = '<option value="">-- เลือกบุคลากร --</option>' + list.map(emp => {
          const id = String(emp.id || emp.code || '');
          const label = [emp.name || 'ไม่ระบุชื่อ', emp.department || ''].filter(Boolean).join(' — ');
          return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
        }).join('');
        if (list.some(emp => String(emp.id || emp.code || '') === previous)) select.value = previous;
      }

      const now = new Date();
      const todayKey = localDateKey(now);
      const todayThai = now.toLocaleDateString('th-TH');
      const dateBadge = document.getElementById('personnelAttendanceDate');
      if (dateBadge) dateBadge.textContent = `ประจำวันที่ ${todayThai}`;

      const allToday = (window.attendanceLogs || []).filter(log => log.dateKey === todayKey || log.date === todayThai).sort((a, b) => {
        const ta = Date.parse(a.timestamp || a.updatedAt || '') || 0;
        const tb = Date.parse(b.timestamp || b.updatedAt || '') || 0;
        return tb - ta;
      });

      // Update counters
      const counts = { 'เข้างาน': 0, 'เลิกงาน': 0, 'ลาป่วย': 0, 'ลาหยุด': 0 };
      allToday.forEach(log => { if (Object.prototype.hasOwnProperty.call(counts, log.status)) counts[log.status] += 1; });
      const countIds = { 'เข้างาน': 'personnelAttCountIn', 'เลิกงาน': 'personnelAttCountOut', 'ลาป่วย': 'personnelAttCountSick', 'ลาหยุด': 'personnelAttCountLeave' };
      Object.entries(countIds).forEach(([status, id]) => { const el = document.getElementById(id); if (el) el.textContent = counts[status]; });

      // Apply Filters
      const searchKeyword = (document.getElementById('attTableSearch')?.value || '').trim().toLowerCase();
      const statusFilter = document.getElementById('attTableFilterStatus')?.value || 'ALL';

      let filteredToday = allToday;
      if (statusFilter !== 'ALL') {
        filteredToday = filteredToday.filter(l => l.status === statusFilter);
      }
      if (searchKeyword) {
        filteredToday = filteredToday.filter(l => {
          const name = String(l.employeeName || '').toLowerCase();
          const dept = String(l.department || '').toLowerCase();
          const code = String(l.employeeCode || l.employeeId || '').toLowerCase();
          const note = String(l.note || '').toLowerCase();
          return name.includes(searchKeyword) || dept.includes(searchKeyword) || code.includes(searchKeyword) || note.includes(searchKeyword);
        });
      }

      const tbody = document.getElementById('personnelAttendanceTable');
      if (!tbody) return;
      if (!filteredToday.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">ยังไม่มีรายการลงเวลาตรงตามเงื่อนไข</td></tr>';
        return;
      }

      const badgeClass = { 'เข้างาน': 'text-bg-success', 'เลิกงาน': 'text-bg-danger', 'ลาป่วย': 'text-bg-primary', 'ลาหยุด': 'text-bg-warning' };
      tbody.innerHTML = filteredToday.map(log => {
        const sourceBadge = log.source === 'camera_qr' ? '<span class="badge bg-light text-dark border"><i class="bi bi-qr-code me-1 text-success"></i>QR</span>' :
                            log.source === 'barcode_gun' ? '<span class="badge bg-light text-dark border"><i class="bi bi-upc me-1 text-primary"></i>บาร์โค้ด</span>' :
                            '<span class="badge bg-light text-muted border">ฟอร์ม</span>';

        const gpsBadge = (log.latitude && log.longitude) ?
          `<a href="https://www.google.com/maps?q=${log.latitude},${log.longitude}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-success py-0 px-1.5 text-nowrap rounded-pill fs-9 text-decoration-none shadow-none" title="พิกัด: ${log.latitude}, ${log.longitude} (±${log.accuracy || 0}m) คลิกเพื่อดูบนแผนที่">
            <i class="bi bi-geo-alt-fill text-danger me-0.5"></i>ดูแผนที่
          </a>` :
          `<span class="badge bg-light text-secondary border fs-9">ไม่มีพิกัด</span>`;

        return `<tr>
          <td class="text-nowrap fw-semibold">${escapeHtml(log.time || '-')}</td>
          <td>
            <b>${escapeHtml(log.employeeName || '-')}</b>
            <div class="text-muted small">${escapeHtml(log.department || '')} ${log.employeeCode ? `• <span class="font-monospace text-secondary">${escapeHtml(log.employeeCode)}</span>` : ''}</div>
          </td>
          <td><span class="badge ${badgeClass[log.status] || 'text-bg-secondary'}">${escapeHtml(log.status || '-')}</span></td>
          <td>${sourceBadge}</td>
          <td>${gpsBadge}</td>
          <td class="text-truncate" style="max-width: 180px;" title="${escapeHtml(log.note || '-')}">${escapeHtml(log.note || '-')}</td>
          <td class="text-center">
            <button class="btn btn-outline-danger btn-sm p-1 rounded-circle border-0" onclick="deleteAttendanceLog('${escapeHtml(log.id || '')}', '${escapeHtml(log.employeeName || '')}')" title="ลบรายการ">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>`;
      }).join('');
    }

    window.renderPersonnelAttendanceControls = renderPersonnelAttendanceControls;

    window.addEventListener('DOMContentLoaded', () => {
      // Background GPS pre-fetch on workspace open
      requestGpsPosition(false);

      // Manual Submission Form
      document.getElementById('personnelAttendanceForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (window.requirePersonnelAdmin && !window.requirePersonnelAdmin('บันทึกเวลาและการลา')) return;
        const employeeId = document.getElementById('personnelAttendanceEmployee')?.value || '';
        const emp = (window.employees || []).find(item => String(item.id || item.code || '') === employeeId);
        if (!emp) {
          showToast('กรุณาเลือกบุคลากร');
          return;
        }
        if (!window.db) {
          showToast('ยังเชื่อมต่อฐานข้อมูลหลักไม่ได้ กรุณาลองใหม่');
          return;
        }

        // Try getting GPS if available
        let gps = attCurrentGpsLocation;
        if (!gps && 'geolocation' in navigator) {
          try {
            gps = await requestGpsPosition(false);
          } catch (e) {}
        }

        const now = new Date();
        const status = document.querySelector('input[name="personnelAttendanceStatus"]:checked')?.value || 'เข้างาน';
        const entry = {
          employeeId,
          employeeName: emp.name || '',
          employeeCode: emp.code || emp.id || '',
          department: emp.department || '',
          role: emp.role || '',
          status,
          time: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
          date: now.toLocaleDateString('th-TH'),
          dateKey: localDateKey(now),
          note: document.getElementById('personnelAttendanceNote')?.value.trim() || '-',
          timestamp: now.toISOString(),
          source: 'manual_form',
          latitude: gps?.latitude || null,
          longitude: gps?.longitude || null,
          accuracy: gps?.accuracy || null
        };
        try {
          await addDoc(collection(window.db, 'attendance'), entry);
          await window.logPersonnelAudit?.('บันทึกเวลา/การลา', { employeeId, employeeName: emp.name || '', status, dateKey: entry.dateKey, hasGps: !!(entry.latitude && entry.longitude) });
          document.getElementById('personnelAttendanceForm')?.reset();
          showToast(`บันทึก "${status}" ของ ${emp.name || 'บุคลากร'} เรียบร้อยแล้ว` + (entry.latitude ? ' พร้อมพิกัด GPS' : ''));
        } catch (error) {
          console.error('Attendance save error:', error);
          showToast('บันทึกลงฐานข้อมูลไม่สำเร็จ กรุณาตรวจการเชื่อมต่อและสิทธิ์');
        }
      });

      // Enter key support for Barcode Scanner
      document.getElementById('attBarcodeInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitAttBarcodeInput();
        }
      });

      renderPersonnelAttendanceControls();
    });

    function loadFromLocalStorageOrSeed() {
      try {
        let bestEmployees = null;
        const saved = getScopedLocalStorageItem('flora_employees');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              bestEmployees = parsed;
            }
          } catch (e) {}
        }
        // If scoped only has 5 or fewer dummy seed items, look for richer cache across localStorage
        if (!bestEmployees || bestEmployees.length <= 5) {
          try {
            const raw = localStorage.getItem('flora_employees');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > (bestEmployees ? bestEmployees.length : 0)) {
                bestEmployees = parsed;
              }
            }
          } catch (e) {}
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith('flora_employees')) {
                const val = localStorage.getItem(k);
                if (val) {
                  const parsed = JSON.parse(val);
                  if (Array.isArray(parsed) && parsed.length > (bestEmployees ? bestEmployees.length : 0)) {
                    bestEmployees = parsed;
                  }
                }
              }
            }
          } catch (e) {}
        }

        if (Array.isArray(bestEmployees) && bestEmployees.length > 0) {
          window.employees = bestEmployees;
          try {
            if (typeof window.syncFloraEmployeesToTree === 'function') window.syncFloraEmployeesToTree(false);
          } catch (err) {
            console.warn("syncFloraEmployeesToTree notice:", err);
          }
          renderOrgChart();
          return;
        }
      } catch (e) {
        console.warn("loadFromLocalStorageOrSeed notice:", e);
      }

      window.employees = generateSeedEmployees();
      try {
        if (typeof window.syncFloraEmployeesToTree === 'function') window.syncFloraEmployeesToTree(false);
      } catch (err) {}
      syncToLocalStorage();
      renderOrgChart();
    }

    function syncToLocalStorage() {
      try {
        if (Array.isArray(window.employees) && window.employees.length > 0) {
          setScopedLocalStorageItem('flora_employees', JSON.stringify(window.employees));
        }
      } catch (e) {}
    }

    function getEmployeeKey(emp) {
      return String(emp?.id || emp?.code || '');
    }

    function getPositionMeta(positionNodeId) {
      if (!positionNodeId) return null;
      const node = typeof window.getFloraOrgNode === 'function' ? window.getFloraOrgNode(positionNodeId) : null;
      const position = (window.positionsList || []).find(item => {
        if (!item || typeof item !== 'object') return false;
        return (item.nodeId || item.id || '') === positionNodeId;
      });
      return { node, position };
    }

    function getLeadershipPositionCapacity(positionNodeId) {
      const executiveCapacity = {
        'pos-1': 1,
        'pos-2': 2,
        'pos-3': 1
      };
      if (Object.prototype.hasOwnProperty.call(executiveCapacity, positionNodeId)) {
        return executiveCapacity[positionNodeId];
      }
      const meta = getPositionMeta(positionNodeId);
      const category = meta?.position?.category || '';
      if (category === 'section_head' || category === 'team_leader' || String(meta?.node?.name || '').includes('หัวหน้า')) {
        return 1;
      }
      return Infinity;
    }

    window.getFloraRoleForPositionNode = function(positionNodeId, fallbackRole = 'WORKER') {
      const category = getPositionMeta(positionNodeId)?.position?.category || '';
      const roleByCategory = {
        executive: 'ADMIN',
        section_head: 'MANAGER',
        academic: 'STAFF',
        team_leader: 'STAFF',
        staff: 'STAFF',
        worker: 'WORKER'
      };
      return roleByCategory[category] || fallbackRole;
    };

    function resolveEmployeePositionNodeId(emp) {
      if (emp?.positionNodeId) return emp.positionNodeId;
      if (typeof window.resolveFloraAssignmentByLabels === 'function') {
        return window.resolveFloraAssignmentByLabels(emp?.department || '', emp?.position || '')?.positionNodeId || '';
      }
      return '';
    }

    window.getFloraLeadershipPositionConflict = function(empId, positionNodeId) {
      const capacity = getLeadershipPositionCapacity(positionNodeId);
      if (!Number.isFinite(capacity)) return null;
      const movingKey = String(empId || '');
      const occupants = (window.employees || []).filter(other => {
        const otherKey = getEmployeeKey(other);
        return otherKey && otherKey !== movingKey && resolveEmployeePositionNodeId(other) === positionNodeId;
      });
      return occupants.length >= capacity ? { occupants, capacity } : null;
    };

    window.ensureFloraLeadershipPositionAvailable = function(empId, positionNodeId, notify = true) {
      const conflict = window.getFloraLeadershipPositionConflict(empId, positionNodeId);
      if (!conflict) return true;
      if (notify) {
        const meta = getPositionMeta(positionNodeId);
        const positionLabel = meta?.node ? (meta.node.name || 'หัวหน้างาน') : 'หัวหน้างาน';
        const occupantLabels = conflict.occupants
          .slice(0, conflict.capacity)
          .map(occupant => `[${occupant.code || occupant.id || '-'}] ${occupant.name || 'บุคลากรเดิม'}`)
          .join(', ');
        const message = `ไม่สามารถย้ายลงตำแหน่ง “${positionLabel}” ได้\n\nตำแหน่งนี้มีผู้ดำรงตำแหน่งครบ ${conflict.capacity} คนแล้ว: ${occupantLabels}\nกรุณาย้ายบุคลากรเดิมออกจากตำแหน่งก่อน`;
        alert(message);
        if (typeof showToast === 'function') showToast(`⚠️ ตำแหน่ง “${positionLabel}” มีผู้ดำรงตำแหน่งครบแล้ว`);
      }
      return false;
    };

    window.persistEmployeeChanges = async function(emp) {
      if (!emp) return;
      if (!window.personnelAccess?.isAdmin) return;
      syncToLocalStorage();
      if (window.db) {
        try { await setDoc(doc(window.db, "employees", emp.id || emp.code), emp, { merge: true }); }
        catch (error) { console.warn("Employee Tree sync notice:", error); }
      }
    };

    function generateSeedEmployees() {
      return [
        {
          id: "EXEC-01",
          code: "EXEC-01",
          name: "ประธานโครงการ",
          role: "ADMIN",
          position: "ประธานโครงการ",
          department: "ฝ่ายบริหารและอำนวยการ",
          phone: "081-000-0001",
          status: "ปฏิบัติงาน",
          photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"
        },
        {
          id: "EXEC-02",
          code: "EXEC-02",
          name: "ที่ปรึกษาโครงการ 1",
          role: "ADMIN",
          position: "ที่ปรึกษาโครงการ",
          department: "ฝ่ายบริหารและอำนวยการ",
          phone: "081-000-0002",
          status: "ปฏิบัติงาน"
        },
        {
          id: "EXEC-03",
          code: "EXEC-03",
          name: "ที่ปรึกษาโครงการ 2",
          role: "ADMIN",
          position: "ที่ปรึกษาโครงการ",
          department: "ฝ่ายบริหารและอำนวยการ",
          phone: "081-000-0003",
          status: "ปฏิบัติงาน"
        },
        {
          id: "EXEC-04",
          code: "EXEC-04",
          name: "ผู้ประสานงานโครงการ",
          role: "MANAGER",
          position: "ผู้ประสานงานโครงการ",
          department: "ฝ่ายบริหารและอำนวยการ",
          phone: "081-000-0004",
          status: "ปฏิบัติงาน"
        },
        {
          id: "ACAD-01",
          code: "ACAD-01",
          name: "นักวิชาการเกษตร",
          role: "STAFF",
          position: "นักวิชาการ",
          department: "งานวิชาการ",
          phone: "081-000-0005",
          status: "ปฏิบัติงาน",
          note: "กำกับมาตรฐานวิชาการสายงาน 4.2, 4.3, 4.4"
        }
      ];
    }

    // ==================== RENDERING ENGINE ====================
    let orgChartRendered = false;
    let orgChartDirty = true;
    let lastRenderState = { signature: '' };

    function computeOrgDataSignature() {
      const emps = window.employees || [];
      const empsSummary = emps.map(e => `${e.id || e.code}:${e.department || ''}:${e.position || ''}:${e.departmentNodeId || ''}:${e.positionNodeId || ''}:${e.updatedAt || ''}`).join(';');
      const projTitle = typeof window.getFloraProjectTitle === 'function' ? window.getFloraProjectTitle() : '';
      const projNote = typeof window.getFloraProjectNote === 'function' ? window.getFloraProjectNote() : '';
      return `${emps.length}|${empsSummary}|${window.currentView || 'hierarchy'}|${window.activeFilterDept || 'ALL'}|${window.searchKeyword || ''}|${window.orgTreeVersion || 0}|${projTitle}|${projNote}`;
    }

    window.markOrgChartDirty = function() {
      orgChartDirty = true;
      if (window.currentWorkspaceTab === 'org' || !window.currentWorkspaceTab) {
        renderOrgChart(true);
      }
    };

    window.renderOrgChart = function(force = false) {
      updateDepartmentDropdownFilter();
      updateStats();

      const container = document.getElementById('chartContent');
      if (!container) return;

      const currentSignature = computeOrgDataSignature();
      if (!force && orgChartRendered && !orgChartDirty && currentSignature === lastRenderState.signature) {
        return;
      }

      let filteredList = [...(window.employees || [])];

      // Filter by Department
      if (window.activeFilterDept !== 'ALL') {
        filteredList = filteredList.filter(e => e.department === window.activeFilterDept);
      }

      // Filter by Search Keyword
      if (window.searchKeyword) {
        const kw = window.searchKeyword.toLowerCase();
        filteredList = filteredList.filter(e => 
          (e.name && e.name.toLowerCase().includes(kw)) ||
          (e.code && e.code.toLowerCase().includes(kw)) ||
          (e.position && e.position.toLowerCase().includes(kw)) ||
          (e.department && e.department.toLowerCase().includes(kw)) ||
          (e.phone && e.phone.includes(kw))
        );
      }

      if (window.currentView === 'hierarchy') {
        // คงรูปแบบ Interactive Org Chart เดิมทุกส่วน
        // Tree ใช้เป็นหน้าจัดการข้อมูลโครงสร้าง ไม่เปลี่ยนหน้าตาของผังบุคลากร
        renderHierarchyPoster(filteredList, container);
      } else if (window.currentView === 'department') {
        renderDepartmentGroups(filteredList, container);
      } else {
        renderFullGrid(filteredList, container);
      }

      // Update Unassigned Drawer and Badge counts
      renderUnassignedDrawer();

      orgChartRendered = true;
      orgChartDirty = false;
      lastRenderState.signature = currentSignature;

      // Automatically recalculate stage size
      applyZoom();
    };

    window.onSwitchToOrgChart = function() {
      const container = document.getElementById('chartContent');
      const hasContent = container && container.children.length > 0;
      const signature = computeOrgDataSignature();

      if (!hasContent || orgChartDirty || signature !== lastRenderState.signature) {
        renderOrgChart(true);
        if (!window.currentZoom || window.currentZoom === 1.0) {
          fitToWidth();
        }
      } else {
        // Fast instant path: 0ms
        if (window.currentView === 'hierarchy') {
          updateRequestedHierarchyLines();
        }
      }
    };

    function updateStats() {
      const projectTitle = typeof window.getFloraProjectTitle === 'function' ? window.getFloraProjectTitle() : 'โครงการรัตนบุปผา และผลิตดอกไม้ธรรมยาตรา';
      const subTitleEl = document.getElementById('orgProjectHeaderSubtitle');
      if (subTitleEl) subTitleEl.textContent = projectTitle;

      const depts = new Set();
      window.employees.forEach(e => {
        if (e.department) depts.add(e.department);
      });
      window.departments = Array.from(depts);

      const totalEmpsEl = document.getElementById('statTotalEmps');
      const totalDeptsEl = document.getElementById('statTotalDepts');
      if (totalEmpsEl) totalEmpsEl.textContent = window.employees.length;
      const treeDeptCount = typeof window.getFloraOrgDepartments === 'function' ? window.getFloraOrgDepartments().filter(d => d.kind === 'department').length : Math.max(window.departments.length, 12);
      if (totalDeptsEl) totalDeptsEl.textContent = treeDeptCount;
    }

    function updateDepartmentDropdownFilter() {
      const select = document.getElementById('deptFilterSelect');
      if (!select) return;

      const currentVal = window.activeFilterDept;
      const deptList = typeof window.getFloraOrgDepartments === 'function' ? window.getFloraOrgDepartments().map(d => d.label) : [...(window.defaultDepartments || [])];

      // Add any custom departments from employees
      window.employees.forEach(e => {
        if (e.department && !deptList.includes(e.department)) {
          deptList.push(e.department);
        }
      });

      let html = '<option value="ALL">🏢 แสดงทุกฝ่าย/แผนก</option>';
      deptList.forEach(d => {
        html += `<option value="${escapeHtml(d)}" ${d === currentVal ? 'selected' : ''}>${escapeHtml(stripStructureCode(d))}</option>`;
      });
      select.innerHTML = html;
    }

    function updateRequestedHierarchyLines() {
      const poster = document.getElementById('chartPosterArea');
      const svg = document.getElementById('requestedHierarchyLines');
      const coordinatorBox = document.getElementById('slot-exec-coordinator');
      const academicBox = document.getElementById('academic-supervision-box');
      const centralHeader = document.getElementById('slot-head-central');
      const supervisedHeaders = [
        document.getElementById('slot-head-rose-exp'),
        document.getElementById('slot-head-rattanabuppha'),
        document.getElementById('slot-head-dhammayatra')
      ];
      if (!poster || !svg || !coordinatorBox || !academicBox || !centralHeader || supervisedHeaders.some(item => !item)) return;

      const posterRect = poster.getBoundingClientRect();
      const scaleX = posterRect.width / poster.offsetWidth || 1;
      const scaleY = posterRect.height / poster.offsetHeight || 1;
      const point = (element, horizontal, vertical) => {
        const rect = element.getBoundingClientRect();
        return {
          x: (rect.left - posterRect.left + rect.width * horizontal) / scaleX,
          y: (rect.top - posterRect.top + rect.height * vertical) / scaleY
        };
      };
      const fixed = value => Number(value.toFixed(1));

      svg.setAttribute('viewBox', `0 0 ${poster.offsetWidth} ${poster.offsetHeight}`);
      svg.setAttribute('preserveAspectRatio', 'none');

      const coordinatorStart = point(coordinatorBox, 0, 0.5);
      const centralTarget = point(centralHeader, 0.5, 0);
      const academicStart = point(academicBox, 0.5, 1);
      const academicTargets = supervisedHeaders.map(header => point(header, 0.5, 0));
      const firstTargetY = Math.min(...academicTargets.map(target => target.y));
      const branchY = academicStart.y + Math.max(8, (firstTargetY - academicStart.y) / 2);
      const branchMinX = Math.min(...academicTargets.map(target => target.x));
      const branchMaxX = Math.max(...academicTargets.map(target => target.x));
      const drops = [
        ['#d81b60', academicTargets[0]],
        ['#e65100', academicTargets[1]],
        ['#2e7d32', academicTargets[2]]
      ];

      svg.innerHTML = `
        <path d="M ${fixed(coordinatorStart.x)} ${fixed(coordinatorStart.y)} H ${fixed(centralTarget.x)} V ${fixed(centralTarget.y)}" fill="none" stroke="#0d2258" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M ${fixed(academicStart.x)} ${fixed(academicStart.y)} V ${fixed(branchY)}" fill="none" stroke="#6a1b9a" stroke-width="2.5" stroke-linecap="round" />
        <path d="M ${fixed(branchMinX)} ${fixed(branchY)} H ${fixed(branchMaxX)}" fill="none" stroke="#6a1b9a" stroke-width="2.5" stroke-linecap="round" />
        ${drops.map(([color, target]) => `<path d="M ${fixed(target.x)} ${fixed(branchY)} V ${fixed(target.y)}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />`).join('')}
      `;
    }

    // ==================== 1. HIERARCHY POSTER (TARGET แผนผัง 2) ====================
    function renderHierarchyPoster(list, container) {
  
    // Helper to retrieve concurrent / acting positions for an employee
    function getEmployeeConcurrentPositions(emp) {
      if (!emp) return [];
      if (Array.isArray(emp.concurrentPositions)) return emp.concurrentPositions;
      return [];
    }

    // Helper to check if employee is assigned to a specific department/position (Primary or Concurrent)
    function isEmployeeInDeptOrPos(emp, deptName, deptNodeId, posName, posNodeId) {
      if (!emp) return false;
      // Check Primary
      if (deptNodeId && emp.departmentNodeId === deptNodeId) return true;
      if (deptName && (emp.department === deptName || (emp.department && emp.department.includes(deptName)))) return true;
      if (posNodeId && emp.positionNodeId === posNodeId) return true;
      if (posName && emp.position === posName) return true;

      // Check Concurrent / Acting
      const concList = getEmployeeConcurrentPositions(emp);
      return concList.some(c => {
        if (deptNodeId && c.departmentNodeId === deptNodeId) return true;
        if (deptName && (c.department === deptName || (c.department && c.department.includes(deptName)))) return true;
        if (posNodeId && c.positionNodeId === posNodeId) return true;
        if (posName && c.position === posName) return true;
        return false;
      });
    }

        // Helper to check if an employee is unassigned (not placed on chart)
      const isUnassigned = (e) => {
        if (!e) return true;
        if (typeof window.isUnassignedEmployee === 'function') {
          return window.isUnassignedEmployee(e);
        }
        const dept = (e.department || '').trim();
        return !dept || dept === 'ยังไม่ระบุ' || dept === 'ยังไม่ระบุแผนก' || dept === 'ทั่วไป' || dept === 'Unassigned' || dept === '-';
      };

      // Track placed employees across the poster chart to prevent duplicate appearance
      const placedEmployeeIds = new Set();
      const markPlaced = (emp) => {
        if (!emp) return;
        const id = emp.id || emp.code;
        if (id) placedEmployeeIds.add(String(id));
      };

      // Helper to match section leader strictly or by prefix
      const matchLeader = (leaderTitle, leaderCode, deptName) => {
        return list.find(e => {
          if (isUnassigned(e)) return false;
          const eid = String(e.id || e.code);
          if (placedEmployeeIds.has(eid)) return false;
          const pos = e.position || '';
          const dept = e.department || '';
          return pos === leaderTitle || 
                 (leaderCode && pos.startsWith(leaderCode)) || 
                 (pos.includes('หัวหน้า') && dept.includes(deptName) && !pos.includes('4.'));
        }) || null;
      };

      // Executive tier: positionNodeId is authoritative. Exact labels are used
      // only for legacy records that do not have a positionNodeId yet.
      const matchesExecutivePosition = (emp, nodeId, legacyLabel) => {
        if (isUnassigned(emp)) return false;
        return emp.positionNodeId ? emp.positionNodeId === nodeId : emp.position === legacyLabel;
      };
      const president = list.find(e => matchesExecutivePosition(e, 'pos-1', 'ประธานโครงการ')) || null;
      if (president) markPlaced(president);

      const advisors = list.filter(e => {
        if (!matchesExecutivePosition(e, 'pos-2', 'ที่ปรึกษาโครงการ')) return false;
        const eid = String(e.id || e.code);
        return !placedEmployeeIds.has(eid);
      }).slice(0, 2);
      const advisor1 = advisors[0] || null;
      if (advisor1) markPlaced(advisor1);
      const advisor2 = advisors[1] || null;
      if (advisor2) markPlaced(advisor2);

      const coordinator = list.find(e => {
        if (!matchesExecutivePosition(e, 'pos-3', 'ผู้ประสานงานโครงการ')) return false;
        const eid = String(e.id || e.code);
        return !placedEmployeeIds.has(eid);
      }) || null;
      if (coordinator) markPlaced(coordinator);
      
      // Auto-repair any section heads whose departmentNodeId was erroneously saved as 'academic'
      list.forEach(e => {
        if (!e) return;
        const pNode = e.positionNodeId || '';
        const pName = e.position || '';
        if (pNode === 'pos-4-1' || pName.includes('หัวหน้างานส่วนกลาง') || pName.startsWith('4.1')) {
          if (e.departmentNodeId === 'academic') e.departmentNodeId = 'division-1';
        } else if (pNode === 'pos-4-2' || pName.includes('หัวหน้างานกุหลาบ') || pName.startsWith('4.2')) {
          if (e.departmentNodeId === 'academic') e.departmentNodeId = 'division-2';
        } else if (pNode === 'pos-4-3' || pName.includes('หัวหน้างานรัตนบุปผา') || pName.startsWith('4.3')) {
          if (e.departmentNodeId === 'academic') e.departmentNodeId = 'division-3';
        } else if (pNode === 'pos-4-4' || pName.includes('หัวหน้างานธรรมยาตรา') || pName.startsWith('4.4')) {
          if (e.departmentNodeId === 'academic') e.departmentNodeId = 'division-4';
        }
      });

      // Section Heads for 4 Main Pillars (หัวหน้าส่วนงานทั้ง 4 - รองรับทั้งตำแหน่งหลัก และ ตำแหน่งควบ/รักษาการ)
      function findPillarHead(divisionId, posNodeId, posLabels, deptKeywords) {
        // 1. ตรวจสอบตำแหน่งหลัก (ต้องยังไม่ถูกวาดที่อื่น)
        const primaryMatch = list.find(e => {
          if (isUnassigned(e)) return false;
          const eid = String(e.id || e.code);
          if (placedEmployeeIds.has(eid)) return false;
          const p = e.position || '';
          const d = e.department || '';
          const pn = e.positionNodeId || '';
          const dn = e.departmentNodeId || '';
          if (pn && pn === posNodeId) return true;
          if (posLabels.some(l => p === l || p.includes(l))) return true;
          if (dn === divisionId && p.includes('หัวหน้า') && !pn.startsWith('pos-5-')) return true;
          if (deptKeywords.some(k => d.includes(k)) && p.includes('หัวหน้า') && !p.includes('1.1') && !p.includes('1.2') && !p.includes('1.3') && !p.includes('1.4') && !pn.startsWith('pos-5-')) return true;
          return false;
        });
        if (primaryMatch) {
          markPlaced(primaryMatch);
          return primaryMatch;
        }

        // 2. ตรวจสอบตำแหน่งควบ / รักษาการ (อนุญาตให้แสดงได้แม้จะมีตำแหน่งหลักอยู่ที่อื่น)
        const concurrentMatch = (window.employees || list || []).find(e => {
          if (!e) return false;
          const concList = Array.isArray(e.concurrentPositions) ? e.concurrentPositions : [];
          if (concList.length === 0) return false;
          return concList.some(c => {
            if (!c) return false;
            if (c.positionNodeId && c.positionNodeId === posNodeId) return true;
            if (c.departmentNodeId && c.departmentNodeId === divisionId) return true;
            const cp = String(c.position || '').trim();
            const cd = String(c.department || '').trim();
            if (posLabels.some(l => cp === l || cp.includes(l))) return true;
            if (deptKeywords.some(k => cd.includes(k)) && cp.includes('หัวหน้า')) return true;
            return false;
          });
        });

        if (concurrentMatch) {
          return { ...concurrentMatch, isConcurrentInThisHead: true };
        }
        return null;
      }

      // หัวหน้าฝ่ายระดับ 4: ต้องไม่รวมตำแหน่งหัวหน้าทีมระดับ 5 (เช่น pos-5-5, 2.2 หัวหน้างานกุหลาบ)
      function findPillarHeadStrict(divisionId, posNodeId, exactLabels, excludedLabels, deptKeywords) {
        // 1. ตรวจสอบตำแหน่งหลัก
        const primaryMatch = list.find(e => {
          if (isUnassigned(e)) return false;
          const eid = String(e.id || e.code);
          if (placedEmployeeIds.has(eid)) return false;
          const p = e.position || '';
          const d = e.department || '';
          const pn = e.positionNodeId || '';
          const dn = e.departmentNodeId || '';

          // ตรวจสอบการถูกคัดออกอย่างเด็ดขาด (ห้ามเป็นระดับ 5)
          if (pn && pn.startsWith('pos-5-')) return false;
          if (dn && dn.startsWith('dept-')) return false;
          if (excludedLabels.some(ex => p === ex || p.includes(ex))) return false;

          // ตรวจสอบตรงโหนด หรือตรงชื่อตำแหน่ง
          if (pn && pn === posNodeId) return true;
          if (exactLabels.some(l => p === l || (p.startsWith('4.') && p.includes(l)))) return true;
          if (dn === divisionId && p.includes('หัวหน้า') && !p.includes('5.')) return true;
          return false;
        });

        if (primaryMatch) {
          markPlaced(primaryMatch);
          return primaryMatch;
        }

        // 2. ตรวจสอบตำแหน่งควบ / รักษาการ
        const concurrentMatch = (window.employees || list || []).find(e => {
          if (!e) return false;
          const concList = Array.isArray(e.concurrentPositions) ? e.concurrentPositions : [];
          if (concList.length === 0) return false;
          return concList.some(c => {
            if (!c) return false;
            const cpn = c.positionNodeId || '';
            const cdn = c.departmentNodeId || '';
            const cp = String(c.position || '').trim();

            if (cpn && cpn.startsWith('pos-5-')) return false;
            if (cdn && cdn.startsWith('dept-')) return false;
            if (excludedLabels.some(ex => cp === ex || cp.includes(ex))) return false;

            if (cpn && cpn === posNodeId) return true;
            if (cdn === divisionId && cp.includes('หัวหน้า')) return true;
            if (exactLabels.some(l => cp === l || (cp.startsWith('4.') && cp.includes(l)))) return true;
            return false;
          });
        });

        if (concurrentMatch) {
          return { ...concurrentMatch, isConcurrentInThisHead: true };
        }
        return null;
      }

      const headCentral = findPillarHeadStrict('division-1', 'pos-4-1', ['4.1 หัวหน้างานส่วนกลาง', 'หัวหน้างานส่วนกลาง'], ['1.1', '1.2', '1.3', '1.4'], ['ส่วนกลาง']);
      // 4.2 หัวหน้างานกุหลาบ/งานทดลอง (ระดับ 4) - แยกเด็ดขาดจาก 5.5 หัวหน้างานกุหลาบ (ระดับ 5)
      const headRoseExp = findPillarHeadStrict('division-2', 'pos-4-2', ['4.2 หัวหน้างานกุหลาบ/งานทดลอง', 'หัวหน้างานกุหลาบ/งานทดลอง'], ['5.5', '2.2', 'หัวหน้างานกุหลาบ (ระดับ 5)'], ['กุหลาบ / งานทดลอง']);
      const headRattanabuppha = findPillarHeadStrict('division-3', 'pos-4-3', ['4.3 หัวหน้างานรัตนบุปผา', 'หัวหน้างานรัตนบุปผา'], ['3.1', '3.2', '3.3', '3.4'], ['รัตนบุปผา']);
      const headDhammayatra = findPillarHeadStrict('division-4', 'pos-4-4', ['4.4 หัวหน้างานธรรมยาตรา', 'หัวหน้างานธรรมยาตรา'], ['4.1', '4.2', '4.3'], ['ธรรมยาตรา']);

      // Academic Supervisor / Academic Staff (งานวิชาการ - เฉพาะผู้ที่ถูกกำหนดสังกัดงานวิชาการ และไม่เอาหัวหน้าส่วนงาน/ฝ่าย)
      const academicList = list.filter(e => {
        if (isUnassigned(e)) return false;
        const eid = String(e.id || e.code);
        if (placedEmployeeIds.has(eid)) return false;
        const pos = e.position || '';
        const dept = e.department || '';
        const posNode = e.positionNodeId || '';
        const deptNode = e.departmentNodeId || '';

        // Strict Exclusion: Never include Section Heads (4.1, 4.2, 4.3, 4.4) or Division Heads
        if (['pos-4-1', 'pos-4-2', 'pos-4-3', 'pos-4-4'].includes(posNode)) return false;
        if (['division-1', 'division-2', 'division-3', 'division-4'].includes(deptNode)) return false;
        if (pos.startsWith('4.1') || pos.startsWith('4.2') || pos.startsWith('4.3') || pos.startsWith('4.4')) return false;
        if (pos.includes('หัวหน้างานส่วนกลาง') || pos.includes('หัวหน้างานกุหลาบ') || pos.includes('หัวหน้างานรัตนบุปผา') || pos.includes('หัวหน้างานธรรมยาตรา')) return false;
        if (posNode.startsWith('pos-5-') || deptNode.startsWith('dept-')) return false;
        if (pos.includes('หัวหน้า') && !pos.includes('วิชาการ')) return false;

        // Inclusion: Must be strictly academic position or assigned to academic department
        return (
          posNode === 'academic' ||
          posNode === 'pos-academic' ||
          pos === 'นักวิชาการ' ||
          pos.includes('วิชาการ') ||
          ((deptNode === 'academic' || dept === 'งานวิชาการ' || dept === 'สายวิชาการและเทคนิคการผลิต') && (pos === 'นักวิชาการ' || pos === '' || !pos.includes('หัวหน้า')))
        );
      });
      academicList.forEach(markPlaced);

      // Group workers by specific sections (ต้องไม่เป็นบุคลากรรอลงผัง)
      function getEmpsForKeywords(keywords, requiredPrefix = '') {
        return list.filter(e => {
          if (isUnassigned(e)) return false;
          const dept = (e.department || '').toLowerCase();
          const pos = (e.position || '').toLowerCase();
          const note = (e.note || '').toLowerCase();
          
          if (requiredPrefix) {
            const prefix = requiredPrefix.toLowerCase();
            const hasPrefix = dept.startsWith(prefix) || pos.startsWith(prefix);
            if (hasPrefix) return true;
          }

          return keywords.some(k => dept.includes(k.toLowerCase()) || pos.includes(k.toLowerCase()) || note.includes(k.toLowerCase()));
        });
      }

      // Member Avatar List Renderer (ทุกส่วนงานไม่จำกัดจำนวนคน + รองรับ Drag & Drop และ 1-Click Popup Menu)
      function renderAvatarMatrix(emps, deptDefault, posDefault) {
        const safeTargetDept = escapeHtml(deptDefault);
        const safeTargetPos = escapeHtml(posDefault);
        const safeTargetDeptLabel = escapeHtml(stripStructureCode(deptDefault));

        let html = `<div class="d-flex flex-wrap justify-content-center align-items-center gap-1 my-1" 
                         data-target-dept="${safeTargetDept}" 
                         data-target-pos="${safeTargetPos}"
                         ondragover="handleSlotDragOver(event)" 
                         ondragleave="handleSlotDragLeave(event)" 
                         ondrop="handleSlotDrop(event, '${safeTargetDept}', '${safeTargetPos}')">`;
        
        if (emps && emps.length > 0) {
          emps.forEach(emp => {
            const safeName = escapeHtml(emp.name || 'พนักงาน');
            const safeCode = escapeHtml(emp.code || emp.id || '');
            const safeId = escapeHtml(emp.id || emp.code);
            const photoUrl = emp.photoUrl || emp.photo || '';
            html += `
              <div class="avatar-item" 
                   id="avatar-item-${safeId}"
                   data-emp-id="${safeId}"
                   data-target-dept="${safeTargetDept}"
                   data-target-pos="${safeTargetPos}"
                   draggable="true"
                   ondragstart="handleAvatarDragStart(event, '${safeId}')"
                   ondragend="handleAvatarDragEnd(event)"
                   ondragover="handleSlotDragOver(event)"
                   ondragleave="handleSlotDragLeave(event)"
                   ondrop="handleSlotDrop(event, '${safeTargetDept}', '${safeTargetPos}')"
                   onclick="handleAvatarClick(event, '${safeId}')"
                   title="[${safeCode}] ${safeName} (${escapeHtml(stripStructureCode(emp.position || emp.department || ''))}) - คลิกเพื่อเลือกเมนู หรือกดแช่/ลากเพื่อย้าย">
                <div class="avatar-circle-ph has-emp position-relative">
                  ${photoUrl ? `<img src="${photoUrl}" alt="${safeName}" onerror="this.parentElement.innerHTML='<i class=\\\'bi bi-person-fill text-primary\\\'></i>'" />` : `<i class="bi bi-person-fill text-primary"></i>`}
                ${emp.isConcurrentInThisDept ? `<span class="position-absolute top-0 end-0 badge bg-warning text-dark border border-white p-0.5 rounded-circle" style="font-size: 7px; transform: translate(30%, -30%);" title="ดำรงตำแหน่งควบ/รักษาการ"><i class="bi bi-star-fill"></i></span>` : ''}</div>
                <div class="avatar-name-label">${safeName}</div>
                <div class="avatar-dots"></div>
              </div>
            `;
          });
        }

        // Action slot "+ เพิ่มคน" / Drop target for Drag-and-Drop
        html += `
          <div class="avatar-item avatar-slot-add" 
               id="add-slot-${Math.random().toString(36).substring(2, 8)}"
               data-target-dept="${safeTargetDept}"
               data-target-pos="${safeTargetPos}"
               ondragover="handleSlotDragOver(event)"
               ondragleave="handleSlotDragLeave(event)"
               ondrop="handleSlotDrop(event, '${safeTargetDept}', '${safeTargetPos}')"
               onclick="openAddModalForSlot('${safeTargetDept}', '${safeTargetPos}')" 
               title="คลิกเพื่อเพิ่มบุคลากรเข้าสู่ ${safeTargetDeptLabel} หรือลากรูปคนมาวางที่นี่เพื่อโยกย้าย">
            <div class="avatar-circle-ph" style="border: 1.5px dashed #90caf9; background: #f4f9ff;">
              <i class="bi bi-plus-lg text-primary fs-6"></i>
            </div>
            <div class="avatar-name-label text-primary fw-bold">+ เพิ่มคน</div>
            <div class="avatar-dots" style="border-color: #90caf9;"></div>
          </div>
        `;

        html += '</div>';
        return html;
      }

      function renderSubSectionCard({
        nodeId = '',
        isLegacyKnownDept = false,
        theme = 'blue',
        title = '',
        deptName = '',
        leaderCode = '',
        leaderTitle = '',
        defaultMemberPos = 'พนักงาน',
        keywords = [],
        customIcon = ''
      }) {
        const isCustomNode = !isLegacyKnownDept;
        const departmentNode = nodeId && typeof window.getFloraOrgNode === 'function' ? window.getFloraOrgNode(nodeId) : null;
        const departmentAssignment = nodeId && typeof window.getFloraOrgAssignment === 'function' ? window.getFloraOrgAssignment(nodeId) : null;
        const roleNodes = (departmentNode?.children || []).filter(node => ['position', 'role', 'supervision'].includes(node.kind));
        const leaderNode = roleNodes.find(node => (node.name || '').includes('หัวหน้า')) || roleNodes[0] || null;
        const memberNode = roleNodes.find(node => node.id !== leaderNode?.id) || null;

        if (departmentNode && departmentAssignment) {
          title = departmentAssignment.department;
          deptName = departmentAssignment.department;
          leaderCode = leaderNode?.code || leaderCode;
          leaderTitle = leaderNode ? `${leaderNode.code} ${leaderNode.name}`.trim() : leaderTitle;
          defaultMemberPos = memberNode?.name || defaultMemberPos;
          if (isLegacyKnownDept) {
            keywords = Array.from(new Set([...keywords, departmentNode.name, leaderNode?.name, memberNode?.name].filter(Boolean)));
          } else {
            keywords = [];
          }
        } else if (isCustomNode) {
          keywords = [];
        }

        // Match leader specifically (ตำแหน่งหลัก หรือ ตำแหน่งควบ/รักษาการหัวหน้าทีม)
        const leader = list.find(e => {
          if (isUnassigned(e)) return false;
          const eid = String(e.id || e.code);
          const pos = e.position || '';
          const dept = e.department || '';

          // 1. ตรวจสอบตำแหน่งหลัก (ต้องไม่เป็นตำแหน่งระดับ 4 เช่น pos-4-2 หรือหัวหน้าฝ่าย)
          if (!placedEmployeeIds.has(eid)) {
            if (e.positionNodeId && e.positionNodeId.startsWith('pos-4-')) return false;
            if (e.departmentNodeId && e.departmentNodeId.startsWith('division-')) return false;
            if (pos.startsWith('4.') || pos.includes('หัวหน้างานกุหลาบ/งานทดลอง')) return false;

            if (leaderNode && e.positionNodeId === leaderNode.id) return true;
            if (leaderTitle && pos === leaderTitle && (e.departmentNodeId === nodeId || dept === deptName || dept === title)) return true;
            if ((e.departmentNodeId === nodeId || dept === deptName || (dept && deptName && (dept.includes(deptName) || deptName.includes(dept)))) && 
                pos.includes('หัวหน้า') && !pos.startsWith('4.')) {
              return true;
            }
            if (isLegacyKnownDept && !e.departmentNodeId && leaderCode && pos.includes(leaderCode)) return true;
          }

          // 2. ตรวจสอบตำแหน่งควบ/รักษาการ
          const concList = Array.isArray(e.concurrentPositions) ? e.concurrentPositions : [];
          const hasConcLeader = concList.some(c => {
            if (!c) return false;
            if (leaderNode && c.positionNodeId === leaderNode.id) return true;
            const cDept = String(c.department || '').trim();
            const targetD = String(deptName || title || '').trim();
            const deptMatches = (nodeId && c.departmentNodeId === nodeId) || (cDept && targetD && (cDept === targetD || cDept.includes(targetD) || targetD.includes(cDept)));
            if (deptMatches && (c.position === leaderTitle || (c.position && c.position.includes('หัวหน้า')))) return true;
            return false;
          });
          if (hasConcLeader) return true;

          return false;
        }) || null;
        if (leader) {
          const isConc = Array.isArray(leader.concurrentPositions) && leader.concurrentPositions.some(c => c.department === deptName || c.position === leaderTitle);
          if (!isConc) markPlaced(leader);
        }

        // Get members excluding section heads, executive tier, unassigned, and already placed employees
        const memberMap = new Map();

        // 1. Direct departmentNodeId or role positionNodeId match (HIGHEST PRIORITY)
        if (nodeId) {
          list.filter(emp => {
            if (isUnassigned(emp)) return false;
            const eid = String(emp.id || emp.code);
            if (placedEmployeeIds.has(eid)) return false;
            return emp.departmentNodeId === nodeId || roleNodes.some(node => emp.positionNodeId === node.id);
          }).forEach(emp => memberMap.set(String(emp.id || emp.code), emp));
        }

        // 2. Exact department name match (HIGHEST PRIORITY)
        list.filter(emp => {
          if (isUnassigned(emp)) return false;
          const eid = String(emp.id || emp.code);
          if (placedEmployeeIds.has(eid)) return false;
          return emp.department === deptName || emp.department === title;
        }).forEach(emp => memberMap.set(String(emp.id || emp.code), emp));

        // 3. Keyword search ONLY as fallback for unlinked legacy employees without another assigned department
        if (isLegacyKnownDept && keywords && keywords.length > 0) {
          getEmpsForKeywords(keywords, leaderCode).forEach(emp => {
            const eid = String(emp.id || emp.code);
            if (placedEmployeeIds.has(eid) || memberMap.has(eid)) return;
            const empDept = emp.department || '';
            const hasOtherDept = allDeptNodes.some(d => d.id !== nodeId && (emp.departmentNodeId === d.id || empDept === d.name || empDept === `${d.code} ${d.name}`.trim()));
            if (!hasOtherDept) {
              memberMap.set(eid, emp);
            }
          });
        }

        // 4. ค้นหาบุคลากรที่ดำรงตำแหน่งควบ / รักษาการ ในแผนกนี้
        // (คัดกรองเฉพาะตำแหน่งพนักงาน/สมาชิกทีมเท่านั้น หากเป็นหัวหน้าทีมต้องไม่หลุดมาแสดงซ้ำที่ช่องสมาชิก)
        const leaderIdStr = leader ? String(leader.id || leader.code) : '';

        (window.employees || list || []).forEach(emp => {
          if (!emp) return;
          const eid = String(emp.id || emp.code);
          // หากคนนี้เป็นหัวหน้าทีมของแผนกนี้อยู่แล้ว ห้ามนำมาใส่ในแถวสมาชิกซ้ำเด็ดขาด
          if (leaderIdStr && eid === leaderIdStr) return;

          const concList = Array.isArray(emp.concurrentPositions) ? emp.concurrentPositions : [];
          if (concList.length === 0) return;

          const isMatchingConcMember = concList.some(c => {
            if (!c) return false;
            // ตรวจสอบว่าตำแหน่งที่ควบมา เป็นตำแหน่งหัวหน้าหรือไม่ (ถ้าเป็นหัวหน้า จะแสดงที่ช่องหัวหน้าทีมเท่านั้น)
            const cPos = String(c.position || '').trim();
            if (cPos.includes('หัวหน้า') || (c.positionNodeId && c.positionNodeId.includes('lead'))) {
              return false;
            }

            // เทียบด้วย nodeId ของแผนก
            if (nodeId && c.departmentNodeId && c.departmentNodeId === nodeId) return true;
            // เทียบด้วยชื่อแผนก
            const cDept = String(c.department || '').trim();
            const targetD = String(deptName || title || '').trim();
            if (cDept && targetD && (cDept === targetD || cDept.includes(targetD) || targetD.includes(cDept))) return true;
            return false;
          });

          if (isMatchingConcMember) {
            const concKey = eid + '_conc_' + (nodeId || deptName);
            memberMap.set(concKey, {
              ...emp,
              isConcurrentInThisDept: true
            });
          }
        });

        const rawMembers = Array.from(memberMap.values());
        const members = rawMembers.filter(e => {
          if (isUnassigned(e)) return false;
          const eid = String(e.id || e.code);
          // ถ้าคนนี้เป็นหัวหน้าทีมของแผนกนี้อยู่แล้ว ไม่แสดงในแถวสมาชิกซ้ำ
          if (leaderIdStr && eid === leaderIdStr) return false;
          // ถ้าเป็นตำแหน่งควบ อนุญาตให้แสดงผลในแผนกนี้ได้เสมอ
          if (e.isConcurrentInThisDept) return true;
          if (placedEmployeeIds.has(eid)) return false;
          return true;
        });

        // Register only primary members so primary position won't duplicate across cards
        members.filter(m => !m.isConcurrentInThisDept).forEach(markPlaced);

        const cardBorderClass = `dept-card-${theme}`;
        const badgeClass = `badge-${theme}`;
        const tagClass = `tag-${theme}`;
        const avatarBgClass = `avatar-bg-${theme}`;

        let leaderHtml = '';
        if (leader) {
          const safeLeaderId = escapeHtml(leader.id || leader.code);
          const safeLeaderName = escapeHtml(leader.name);
          const safeLeaderPhoto = leader.photoUrl || leader.photo || '';
          leaderHtml = `
            <div class="team-leader-slot" 
                 id="slot-lead-${safeLeaderId}"
                 data-emp-id="${safeLeaderId}"
                 data-target-dept="${escapeHtml(deptName)}"
                 data-target-pos="${escapeHtml(leaderTitle)}"
                 draggable="true"
                 ondragstart="handleAvatarDragStart(event, '${safeLeaderId}')"
                 ondragend="handleAvatarDragEnd(event)"
                 ondragover="handleSlotDragOver(event)"
                 ondragleave="handleSlotDragLeave(event)"
                 ondrop="handleSlotDrop(event, '${escapeHtml(deptName)}', '${escapeHtml(leaderTitle)}')"
                 onclick="handleAvatarClick(event, '${safeLeaderId}')"
                 title="หัวหน้าทีม ${safeLeaderName} - คลิกเพื่อเลือกเมนู หรือกดแช่/ลากเพื่อโยกย้าย">
              <span class="leader-badge ${tagClass}">หัวหน้าทีม</span>
              <div class="leader-avatar-circle ${avatarBgClass}">
                ${safeLeaderPhoto ? `<img src="${safeLeaderPhoto}" alt="${safeLeaderName}" />` : `<i class="bi bi-person-badge-fill"></i>`}
              </div>
              <div class="leader-info">
                <div class="leader-name">${safeLeaderName}</div>
                <div class="leader-title text-truncate">${escapeHtml(stripStructureCode(leaderTitle))}</div>
              </div>
            </div>
          `;
        } else {
          leaderHtml = `
            <div class="team-leader-slot leader-empty" 
                 id="slot-lead-empty-${leaderCode.replace(/\./g, '_')}"
                 data-target-dept="${escapeHtml(deptName)}"
                 data-target-pos="${escapeHtml(leaderTitle)}"
                 ondragover="handleSlotDragOver(event)"
                 ondragleave="handleSlotDragLeave(event)"
                 ondrop="handleSlotDrop(event, '${escapeHtml(deptName)}', '${escapeHtml(leaderTitle)}')"
                 onclick="openAddModalForSlot('${escapeHtml(deptName)}', '${escapeHtml(leaderTitle)}')"
                 title="คลิกเพื่อกำหนดหัวหน้าทีม หรือลากบุคลากรมาวางที่นี่">
              <span class="leader-badge ${tagClass}">หัวหน้าทีม</span>
              <div class="leader-avatar-circle ${avatarBgClass}" style="background: transparent; border: 1.5px dashed currentColor;">
                <i class="bi bi-person-plus-fill"></i>
              </div>
              <div class="leader-info">
                <div class="leader-name text-muted">+ กำหนดหัวหน้าทีม</div>
                <div class="leader-title text-truncate text-muted">${escapeHtml(stripStructureCode(leaderTitle))}</div>
              </div>
            </div>
          `;
        }

        return `
          <div class="dept-card ${cardBorderClass} text-center position-relative"
               data-target-dept="${escapeHtml(deptName)}"
               data-target-pos="${escapeHtml(defaultMemberPos)}"
               ondragover="handleSlotDragOver(event)"
               ondragleave="handleSlotDragLeave(event)"
               ondrop="handleSlotDrop(event, '${escapeHtml(deptName)}', '${escapeHtml(defaultMemberPos)}')">
            ${nodeId ? `
              <button type="button" 
                      class="node-card-btn personnel-admin-only" 
                      onclick="openNodeActionMenu(event, '${escapeHtml(nodeId)}')" 
                      title="จัดการแผนกนี้ (เพิ่ม/แก้ไข/ลบ)">
                <i class="bi bi-three-dots-vertical"></i>
              </button>
            ` : ''}
            <div class="dept-title-badge ${badgeClass}">${customIcon ? `<i class="bi ${customIcon} me-1"></i>` : ''}${escapeHtml(stripStructureCode(title))}</div>
            ${leaderHtml}
            ${renderAvatarMatrix(members, deptName, defaultMemberPos)}
          </div>
        `;
      }

      // ==================== DYNAMIC PILLARS BUILDER (FROM ORG TREE) ====================
      const KNOWN_DEPT_META = {
        'dept-1-1': { theme: 'blue', customIcon: 'bi-file-earmark-person-fill', keywords: ['ธุรการ', 'บุคคล'] },
        'dept-1-2': { theme: 'blue', customIcon: 'bi-heart-pulse-fill', keywords: ['สวัสดิการ'] },
        'dept-1-3-water': { theme: 'blue', customIcon: 'bi-droplet-fill', keywords: ['ระบบน้ำ', 'น้ำ'] },
        'dept-1-3-grass': { theme: 'blue', customIcon: 'bi-scissors', keywords: ['ตัดหญ้า', 'หญ้า', 'สนับสนุน'] },
        'dept-2-1': { theme: 'pink', customIcon: 'bi-funnel-fill', keywords: ['ทดลอง', 'วิจัย'] },
        'dept-2-2': { theme: 'pink', customIcon: 'bi-flower3', keywords: ['กุหลาบ'] },
        'dept-3-1': { theme: 'orange', customIcon: 'bi-bank2', keywords: ['เจดีย์', 'แปลง g'] },
        'dept-3-2': { theme: 'orange', customIcon: 'bi-house-door-fill', keywords: ['วิหารหลวงปู่', 'วิหาร'] },
        'dept-3-3': { theme: 'orange', customIcon: 'bi-tree-fill', keywords: ['ถนน', 'ธรรมชัย', 'เฟื่องฟ้า'] },
        'dept-3-4': { theme: 'orange', customIcon: 'bi-boxes', keywords: ['ผสมแกลบ', 'โต๊ะกลาง', 'ผสมดิน', 'แกลบ'] },
        'dept-4-1': { theme: 'green', customIcon: 'bi-grid-3x3-gap-fill', keywords: ['แปลง a', 'แปลง b', 'แปลง a-b', 'แปลง a / b'] },
        'dept-4-2': { theme: 'green', customIcon: 'bi-flower2', keywords: ['แปลง e', 'p11', 'แปลง e / p11'] },
        'dept-4-3': { theme: 'green', customIcon: 'bi-archive-fill', keywords: ['วิหารคด', 'ไม้กระถาง', '13-20', 'ปอ'] }
      };

      const STANDARD_DIVISIONS = [
        {
          id: 'division-1',
          theme: 'blue',
          defaultName: '1. งานส่วนกลาง',
          headBoxId: 'slot-head-central',
          headDefaultPos: '4.1 หัวหน้างานส่วนกลาง',
          headTitleText: 'หัวหน้างานส่วนกลาง',
          headNameClass: 'text-primary',
          headKeywords: ['ส่วนกลาง'],
          defaultDeptIds: ['dept-1-1', 'dept-1-2', 'dept-1-3-water', 'dept-1-3-grass']
        },
        {
          id: 'division-2',
          theme: 'pink',
          defaultName: '2. งานกุหลาบ / งานทดลอง',
          headBoxId: 'slot-head-rose-exp',
          headDefaultPos: '4.2 หัวหน้างานกุหลาบ/งานทดลอง',
          headTitleText: 'หัวหน้างานกุหลาบ/ทดลอง',
          headNameClass: 'text-danger',
          headKeywords: ['กุหลาบ', 'ทดลอง'],
          defaultDeptIds: ['dept-2-1', 'dept-2-2']
        },
        {
          id: 'division-3',
          theme: 'orange',
          defaultName: '3. งานรัตนบุปผา',
          headBoxId: 'slot-head-rattanabuppha',
          headDefaultPos: '4.3 หัวหน้างานรัตนบุปผา',
          headTitleText: 'หัวหน้างานรัตนบุปผา',
          headNameClass: 'text-warning',
          headStyle: 'color: #e65100 !important;',
          headKeywords: ['รัตนบุปผา'],
          defaultDeptIds: ['dept-3-1', 'dept-3-2', 'dept-3-3', 'dept-3-4']
        },
        {
          id: 'division-4',
          theme: 'green',
          defaultName: '4. งานธรรมยาตรา',
          headBoxId: 'slot-head-dhammayatra',
          headDefaultPos: '4.4 หัวหน้างานธรรมยาตรา',
          headTitleText: 'หัวหน้างานธรรมยาตรา',
          headNameClass: 'text-success',
          headKeywords: ['ธรรมยาตรา'],
          defaultDeptIds: ['dept-4-1', 'dept-4-2', 'dept-4-3']
        }
      ];

      function collectNodesByKind(node, kind) {
        if (!node) return [];
        const result = [];
        if (node.kind === kind) result.push(node);
        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) {
            result.push(...collectNodesByKind(child, kind));
          }
        }
        return result;
      }

      function findNodeInTree(node, id) {
        if (!node) return null;
        if (node.id === id) return node;
        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) {
            const found = findNodeInTree(child, id);
            if (found) return found;
          }
        }
        return null;
      }

      const liveTree = typeof window.getFloraOrgTree === 'function' ? window.getFloraOrgTree() : null;
      const allDivNodes = liveTree ? collectNodesByKind(liveTree, 'division') : [];
      const allDeptNodes = liveTree ? collectNodesByKind(liveTree, 'department') : [];

      const renderedDeptIds = new Set();
      const dynamicColumns = [];
      const THEME_CYCLE = ['blue', 'pink', 'orange', 'green', 'blue', 'pink', 'orange', 'green'];

      // Process standard divisions first
      STANDARD_DIVISIONS.forEach((std) => {
        const divNode = liveTree ? findNodeInTree(liveTree, std.id) : null;
        const divName = divNode ? (divNode.code ? `${divNode.code}. ${divNode.name}` : divNode.name) : std.defaultName;
        
        const headNode = divNode ? ((divNode.children || []).find(c => ['position', 'role', 'supervision'].includes(c.kind) && (c.name.includes('หัวหน้า') || String(c.code).startsWith('4.'))) ||
                         (divNode.children || []).find(c => ['position', 'role'].includes(c.kind)) || null) : null;

        let headEmp = null;
        if (std.id === 'division-1') headEmp = headCentral;
        else if (std.id === 'division-2') headEmp = headRoseExp;
        else if (std.id === 'division-3') headEmp = headRattanabuppha;
        else if (std.id === 'division-4') headEmp = headDhammayatra;
        else if (headNode) {
          headEmp = list.find(e => !isUnassigned(e) && (e.positionNodeId === headNode.id || e.position === headNode.name || (e.department || '').includes(divNode.name))) || null;
        }

        const divDepts = divNode ? collectNodesByKind(divNode, 'department') : [];
        const deptListForCol = [];

        if (divDepts.length > 0) {
          divDepts.forEach(d => {
            deptListForCol.push(d);
            renderedDeptIds.add(d.id);
          });
        } else {
          std.defaultDeptIds.forEach(did => {
            const dn = allDeptNodes.find(d => d.id === did) || { id: did, code: '', name: did, kind: 'department', children: [] };
            deptListForCol.push(dn);
            renderedDeptIds.add(did);
          });
        }

        dynamicColumns.push({
          id: std.id,
          theme: std.theme,
          divName: divName,
          headBoxId: std.headBoxId,
          headTitle: headNode ? (headNode.code ? `${headNode.code} ${headNode.name}`.trim() : headNode.name) : std.headDefaultPos,
          headTitleText: headNode ? headNode.name : std.headTitleText,
          headEmp: headEmp,
          headNameClass: std.headNameClass,
          headStyle: std.headStyle || '',
          departments: deptListForCol
        });
      });

      // Include any newly added divisions from tree
      allDivNodes.forEach((divNode, idx) => {
        if (STANDARD_DIVISIONS.some(std => std.id === divNode.id)) return;
        const isAutoCodeStr = (c) => !c || c === 'ORG-ROOT' || /^AUTO[-_]/i.test(String(c).trim()) || /^POS-\d+/i.test(String(c).trim());
        const cleanNameStr = (n) => String(n || '').replace(/^AUTO-[A-Z0-9_-]+\s*/i, '').trim();
        const theme = THEME_CYCLE[(4 + idx) % THEME_CYCLE.length];
        const cleanDivName = cleanNameStr(divNode.name);
        const divName = (divNode.code && !isAutoCodeStr(divNode.code)) ? `${divNode.code}. ${cleanDivName}` : cleanDivName;
        const headNode = (divNode.children || []).find(c => ['position', 'role', 'supervision'].includes(c.kind) && (c.name.includes('หัวหน้า') || String(c.code).startsWith('4.'))) ||
                         (divNode.children || []).find(c => ['position', 'role'].includes(c.kind)) || null;
        const headEmp = headNode ? list.find(e => {
          if (isUnassigned(e)) return false;
          // ตรวจสอบตำแหน่งหลัก
          const isPrimary = (e.positionNodeId === headNode.id || e.position === headNode.name);
          if (isPrimary && !placedEmployeeIds.has(String(e.id || e.code))) return true;
          // ตรวจสอบตำแหน่งควบ
          const concList = Array.isArray(e.concurrentPositions) ? e.concurrentPositions : [];
          const isConc = concList.some(c => (c.positionNodeId === headNode.id) || (c.position === headNode.name) || (c.departmentNodeId === divNode.id));
          if (isConc) return true;
          return false;
        }) || null : null;
        if (headEmp) markPlaced(headEmp);

        const divDepts = collectNodesByKind(divNode, 'department');
        divDepts.forEach(d => renderedDeptIds.add(d.id));

        const cleanHeadNodeName = headNode ? cleanNameStr(headNode.name) : `หัวหน้า${cleanDivName}`;
        dynamicColumns.push({
          id: divNode.id,
          theme: theme,
          divName: divName,
          headBoxId: `slot-head-${divNode.id}`,
          headTitle: headNode ? (headNode.code && !isAutoCodeStr(headNode.code) ? `${headNode.code} ${cleanHeadNodeName}`.trim() : cleanHeadNodeName) : `หัวหน้า${cleanDivName}`,
          headTitleText: cleanHeadNodeName,
          headEmp: headEmp,
          headNameClass: 'text-primary',
          headStyle: '',
          departments: divDepts
        });
      });

      // Include any orphan departments that do not belong to any division
      const orphanDepts = allDeptNodes.filter(d => !renderedDeptIds.has(d.id));
      if (orphanDepts.length > 0) {
        dynamicColumns.push({
          id: 'division-custom-extra',
          theme: 'blue',
          divName: 'ฝ่าย / แผนกเพิ่มเติม',
          headBoxId: 'slot-head-extra',
          headTitle: 'หัวหน้างาน',
          headTitleText: 'แผนกเพิ่มเติม',
          headEmp: null,
          headNameClass: 'text-primary',
          headStyle: '',
          departments: orphanDepts
        });
      }

      function renderDeptCardDynamic(deptNode, colTheme) {
        const isAutoCodeStr = (c) => !c || c === 'ORG-ROOT' || /^AUTO[-_]/i.test(String(c).trim()) || /^POS-\d+/i.test(String(c).trim());
        const cleanNameStr = (n) => String(n || '').replace(/^AUTO-[A-Z0-9_-]+\s*/i, '').trim();
        const isLegacyKnownDept = Boolean(KNOWN_DEPT_META[deptNode.id]);
        const meta = KNOWN_DEPT_META[deptNode.id] || {};
        const assignment = typeof window.getFloraOrgAssignment === 'function' ? window.getFloraOrgAssignment(deptNode.id) : null;
        const cleanDeptName = cleanNameStr(deptNode.name);
        const deptTitle = assignment?.department ? cleanNameStr(assignment.department) : (deptNode.code && !isAutoCodeStr(deptNode.code) ? `${deptNode.code} ${cleanDeptName}` : cleanDeptName);

        const roleNodes = (deptNode.children || []).filter(c => ['position', 'role', 'supervision'].includes(c.kind));
        const leaderNode = roleNodes.find(c => (c.name || '').includes('หัวหน้า')) || roleNodes[0] || null;
        const memberNode = roleNodes.find(c => c.id !== leaderNode?.id) || null;

        const leaderCode = (leaderNode?.code && !isAutoCodeStr(leaderNode.code)) ? leaderNode.code : '';
        const cleanLeaderName = leaderNode ? cleanNameStr(leaderNode.name) : `หัวหน้า${cleanDeptName}`;
        const leaderTitle = leaderNode ? (leaderCode ? `${leaderCode} ${cleanLeaderName}`.trim() : cleanLeaderName) : `หัวหน้า${cleanDeptName}`;
        const defaultMemberPos = memberNode ? cleanNameStr(memberNode.name) : 'พนักงาน';

        let icon = meta.customIcon || '';
        if (!icon) {
          const n = (deptNode.name || '').toLowerCase();
          if (n.includes('ธุรการ') || n.includes('บุคคล')) icon = 'bi-file-earmark-person-fill';
          else if (n.includes('สวัสดิการ')) icon = 'bi-heart-pulse-fill';
          else if (n.includes('น้ำ')) icon = 'bi-droplet-fill';
          else if (n.includes('หญ้า')) icon = 'bi-scissors';
          else if (n.includes('ทดลอง') || n.includes('วิจัย')) icon = 'bi-funnel-fill';
          else if (n.includes('กุหลาบ')) icon = 'bi-flower3';
          else if (n.includes('เจดีย์')) icon = 'bi-bank2';
          else if (n.includes('วิหาร')) icon = 'bi-house-door-fill';
          else if (n.includes('ถนน')) icon = 'bi-tree-fill';
          else if (n.includes('แกลบ') || n.includes('ดิน')) icon = 'bi-boxes';
          else if (n.includes('แปลง') && (n.includes('a') || n.includes('b'))) icon = 'bi-grid-3x3-gap-fill';
          else if (n.includes('กระถาง')) icon = 'bi-archive-fill';
          else if (n.includes('รถ') || n.includes('ยาน')) icon = 'bi-truck';
          else if (n.includes('คลัง') || n.includes('พัสดุ')) icon = 'bi-box-seam';
          else if (n.includes('ดอกไม้') || n.includes('พืช')) icon = 'bi-flower1';
          else icon = 'bi-diagram-3-fill';
        }

        return renderSubSectionCard({
          nodeId: deptNode.id,
          isLegacyKnownDept: isLegacyKnownDept,
          theme: meta.theme || colTheme,
          title: deptTitle,
          deptName: deptTitle,
          leaderCode: leaderCode,
          leaderTitle: leaderTitle,
          defaultMemberPos: defaultMemberPos,
          keywords: isLegacyKnownDept ? (meta.keywords || [deptNode.name]) : [],
          customIcon: icon
        });
      }

      const dynamicColumnsHtml = dynamicColumns.map(col => `
        <div class="d-flex flex-column">
          <!-- Section Head -->
          <div class="section-head-box head-${col.theme} position-relative" 
               id="${col.headBoxId}"
               ondragover="handleSlotDragOver(event)"
               ondragleave="handleSlotDragLeave(event)"
               ondrop="handleSlotDrop(event, '${escapeHtml(col.divName)}', '${escapeHtml(col.headTitle)}')"
               onclick="${col.headEmp ? `handleAvatarClick(event, '${escapeHtml(col.headEmp.id || col.headEmp.code)}')` : `openAddModalForSlot('${escapeHtml(col.divName)}', '${escapeHtml(col.headTitle)}')`}" 
               title="คลิกเพื่อเลือกเมนู / ลากคนมาวางเพื่อกำหนดเป็น${escapeHtml(col.headTitleText)}">
            <button type="button" 
                    class="node-card-btn personnel-admin-only" 
                    onclick="openNodeActionMenu(event, '${escapeHtml(col.id)}')" 
                    title="จัดการฝ่ายนี้ (เพิ่มแผนก/แก้ไข/ลบ)">
              <i class="bi bi-three-dots-vertical"></i>
            </button>
            <span class="head-tag tag-${col.theme}">หัวหน้างาน</span>
            <div class="head-avatar avatar-bg-${col.theme} position-relative"
                 ${col.headEmp ? `draggable="true" ondragstart="handleAvatarDragStart(event, '${escapeHtml(col.headEmp.id || col.headEmp.code)}')"` : ''}>
              ${col.headEmp && (col.headEmp.photoUrl || col.headEmp.photo) ? `<img src="${col.headEmp.photoUrl || col.headEmp.photo}" alt="${escapeHtml(col.headEmp.name)}">` : `<i class="bi bi-person-badge-fill"></i>`}
              ${col.headEmp && col.headEmp.isConcurrentInThisHead ? `<span class="position-absolute top-0 end-0 badge bg-warning text-dark border border-white p-0.5 rounded-circle" style="font-size: 7px; transform: translate(25%, -25%);" title="รักษาการ / ดำรงตำแหน่งควบ"><i class="bi bi-star-fill"></i></span>` : ''}
            </div>
            <div class="text-start">
              <div class="fw-bold fs-7 text-dark lh-1">${escapeHtml(col.headTitleText)}</div>
              <div class="${col.headNameClass} fs-8 fw-bold mt-1" ${col.headStyle ? `style="${col.headStyle}"` : ''}>
                ${col.headEmp ? escapeHtml(col.headEmp.name) : '<span class="text-muted opacity-75">+ กำหนดรายชื่อ</span>'}
              </div>
            </div>
          </div>

          <!-- Departments in this Division -->
          ${col.departments.map(dept => renderDeptCardDynamic(dept, col.theme)).join('')}
        </div>
      `).join('');

      let posterHtml = `
        <div class="chart-poster" id="chartPosterArea">
          
          <!-- Top 2 Organization Logos (Top-Left & Top-Right) -->
          <div class="poster-corner-badge poster-corner-tl" data-flora-logo="corner" data-logo-size="82" onclick="openGlobalLogoModal()" title="โลโก้องค์กร / โครงการ (คลิกเพื่อจัดการและเปลี่ยนโลโก้)">
            ${typeof window.renderFloraLogoBadge === 'function' ? window.renderFloraLogoBadge(82, { className: 'corner-logo-inner', interactive: false }) : '<div class="corner-logo-inner"><svg width="82" height="82" viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="#fff" stroke="#ffd54f" stroke-width="2"/><circle cx="50" cy="50" r="18" fill="#5d4037"/></svg></div>'}
          </div>
          <div class="poster-corner-badge poster-corner-tr" data-flora-logo="corner" data-logo-size="82" onclick="openGlobalLogoModal()" title="โลโก้องค์กร / โครงการ (คลิกเพื่อจัดการและเปลี่ยนโลโก้)">
            ${typeof window.renderFloraLogoBadge === 'function' ? window.renderFloraLogoBadge(82, { className: 'corner-logo-inner', interactive: false }) : '<div class="corner-logo-inner"><svg width="82" height="82" viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="#fff" stroke="#ffd54f" stroke-width="2"/><circle cx="50" cy="50" r="18" fill="#5d4037"/></svg></div>'}
          </div>

          <!-- SVG Hierarchy Connecting Lines -->
          <svg class="svg-hierarchy-lines" viewBox="0 0 1540 1000" preserveAspectRatio="none">
            <!-- 1. President to Advisors line -->
            <line x1="770" y1="120" x2="770" y2="145" stroke="#0d2258" stroke-width="2" />
            <line x1="460" y1="145" x2="1080" y2="145" stroke="#0d2258" stroke-width="2" />
            <line x1="460" y1="145" x2="460" y2="160" stroke="#0d2258" stroke-width="2" />
            <line x1="1080" y1="145" x2="1080" y2="160" stroke="#0d2258" stroke-width="2" />

            <!-- 2. Advisors down to Project Coordinator -->
            <line x1="770" y1="145" x2="770" y2="230" stroke="#0d2258" stroke-width="2" />

            <!-- 3. Coordinator to Academic Box -->
            <line x1="770" y1="290" x2="770" y2="330" stroke="#6a1b9a" stroke-width="2" />

          </svg>

          <!-- Requested relationship lines are calculated from the actual boxes -->
          <svg id="requestedHierarchyLines" class="svg-hierarchy-lines requested-hierarchy-lines" aria-hidden="true"></svg>

          <!-- ==================== 1. TOP ROYAL BANNER ==================== -->
          <div class="top-navy-banner" id="slot-node1-banner">
            <h1 class="banner-title text-center">
              ${escapeHtml(typeof window.getFloraProjectTitle === 'function' ? window.getFloraProjectTitle() : 'โครงการรัตนบุปผา และผลิตดอกไม้ธรรมยาตรา')}
            </h1>
            ${(() => {
              const note = (typeof window.getFloraProjectNote === 'function' ? window.getFloraProjectNote() : (window.getFloraOrgTree?.()?.note || '')).trim();
              if (note) {
                return `<div class="banner-note" id="slot-node1-note"><i class="bi bi-info-circle me-1 opacity-75 fs-8"></i>${escapeHtml(note)}</div>`;
              }
              return `<div class="banner-note" id="slot-node1-note" style="display: none;"></div>`;
            })()}
          </div>

          <!-- ==================== 2. EXECUTIVE & ACADEMIC HIERARCHY ==================== -->
          <div class="d-flex flex-column align-items-center mb-3 position-relative" style="z-index: 5;">
            
            <!-- Level 1: ประธานโครงการ (Center Top - อยู่สูงกว่าที่ปรึกษา) -->
            <div class="mb-3 d-flex justify-content-center w-100 px-2">
              <div class="exec-box shadow-sm position-relative" 
                   id="slot-exec-president"
                   style="width: clamp(260px, 85vw, 320px); border-width: 2.5px; border-color: #0d2258;" 
                   ondragover="handleSlotDragOver(event)"
                   ondragleave="handleSlotDragLeave(event)"
                   ondrop="handleSlotDrop(event, 'ฝ่ายบริหารและอำนวยการ', 'ประธานโครงการ')"
                   onclick="${president ? `handleAvatarClick(event, '${escapeHtml(president.id || president.code)}')` : `openAddModalForSlot('ฝ่ายบริหารและอำนวยการ', 'ประธานโครงการ')`}" 
                   title="คลิกเพื่อเลือกเมนู / ลากคนมาวางเพื่อกำหนดเป็นประธานโครงการ">
                <button type="button" 
                        class="node-card-btn personnel-admin-only" 
                        onclick="openNodeActionMenu(event, 'pos-1')" 
                        title="จัดการตำแหน่งประธาน (แก้ไข/เพิ่มโหนด)">
                  <i class="bi bi-three-dots-vertical"></i>
                </button>
                <div class="exec-avatar" 
                     style="width: 52px; height: 52px; background: #0d2258;"
                     ${president ? `draggable="true" ondragstart="handleAvatarDragStart(event, '${escapeHtml(president.id || president.code)}')"` : ''}>
                  ${president && president.photoUrl ? `<img src="${president.photoUrl}" alt="${president.name}">` : `<i class="bi bi-person-fill"></i>`}
                </div>
                <div class="flex-grow-1 overflow-hidden text-start">
                  <div class="fw-bold text-dark fs-5 lh-1 text-truncate">ประธานโครงการ</div>
                  <div class="text-primary fs-7 fw-bold mt-1 text-truncate">${president ? escapeHtml(president.name) : '<span class="text-muted opacity-75">+ กำหนดรายชื่อ</span>'}</div>
                  <div class="dotted-line" style="width: 100%; max-width: 175px;"></div>
                </div>
              </div>
            </div>

            <!-- Level 2: ที่ปรึกษาโครงการ (2 คน ซ้าย-ขวา อยู่ระดับใต้ประธานโครงการ) -->
            <div class="d-flex align-items-center justify-content-center gap-5 mb-3 w-100">
              
              <!-- ที่ปรึกษาโครงการ (ท่านที่ 1 - ซ้าย) -->
              <div class="exec-box position-relative" 
                   id="slot-exec-advisor1"
                   style="width: 270px;" 
                   ondragover="handleSlotDragOver(event)"
                   ondragleave="handleSlotDragLeave(event)"
                   ondrop="handleSlotDrop(event, 'ฝ่ายบริหารและอำนวยการ', 'ที่ปรึกษาโครงการ')"
                   onclick="${advisor1 ? `handleAvatarClick(event, '${escapeHtml(advisor1.id || advisor1.code)}')` : `openAddModalForSlot('ฝ่ายบริหารและอำนวยการ', 'ที่ปรึกษาโครงการ')`}" 
                   title="คลิกเพื่อเลือกเมนู / ลากคนมาวางเพื่อกำหนดเป็นที่ปรึกษาโครงการ">
                <button type="button" 
                        class="node-card-btn personnel-admin-only" 
                        onclick="openNodeActionMenu(event, 'pos-2')" 
                        title="จัดการตำแหน่งที่ปรึกษา (แก้ไข/เพิ่มโหนด)">
                  <i class="bi bi-three-dots-vertical"></i>
                </button>
                <div class="exec-avatar"
                     ${advisor1 ? `draggable="true" ondragstart="handleAvatarDragStart(event, '${escapeHtml(advisor1.id || advisor1.code)}')"` : ''}>
                  ${advisor1 && advisor1.photoUrl ? `<img src="${advisor1.photoUrl}" alt="${advisor1.name}">` : `<i class="bi bi-person-fill"></i>`}
                </div>
                <div>
                  <div class="fw-bold text-dark fs-6 lh-1">ที่ปรึกษาโครงการ</div>
                  <div class="text-primary fs-8 fw-semibold mt-1">${advisor1 ? escapeHtml(advisor1.name) : '<span class="text-muted opacity-75">+ กำหนดรายชื่อ</span>'}</div>
                  <div class="dotted-line"></div>
                </div>
              </div>

              <!-- ที่ปรึกษาโครงการ (ท่านที่ 2 - ขวา) -->
              <div class="exec-box position-relative" 
                   id="slot-exec-advisor2"
                   style="width: 270px;" 
                   ondragover="handleSlotDragOver(event)"
                   ondragleave="handleSlotDragLeave(event)"
                   ondrop="handleSlotDrop(event, 'ฝ่ายบริหารและอำนวยการ', 'ที่ปรึกษาโครงการ')"
                   onclick="${advisor2 ? `handleAvatarClick(event, '${escapeHtml(advisor2.id || advisor2.code)}')` : `openAddModalForSlot('ฝ่ายบริหารและอำนวยการ', 'ที่ปรึกษาโครงการ')`}" 
                   title="คลิกเพื่อเลือกเมนู / ลากคนมาวางเพื่อกำหนดเป็นที่ปรึกษาโครงการ">
                <button type="button" 
                        class="node-card-btn personnel-admin-only" 
                        onclick="openNodeActionMenu(event, 'pos-2')" 
                        title="จัดการตำแหน่งที่ปรึกษา (แก้ไข/เพิ่มโหนด)">
                  <i class="bi bi-three-dots-vertical"></i>
                </button>
                <div class="exec-avatar"
                     ${advisor2 ? `draggable="true" ondragstart="handleAvatarDragStart(event, '${escapeHtml(advisor2.id || advisor2.code)}')"` : ''}>
                  ${advisor2 && advisor2.photoUrl ? `<img src="${advisor2.photoUrl}" alt="${advisor2.name}">` : `<i class="bi bi-person-fill"></i>`}
                </div>
                <div>
                  <div class="fw-bold text-dark fs-6 lh-1">ที่ปรึกษาโครงการ</div>
                  <div class="text-primary fs-8 fw-semibold mt-1">${advisor2 ? escapeHtml(advisor2.name) : '<span class="text-muted opacity-75">+ กำหนดรายชื่อ</span>'}</div>
                  <div class="dotted-line"></div>
                </div>
              </div>

            </div>

            <!-- Level 3: ผู้ประสานงานโครงการ (Center) -->
            <div class="mb-3">
              <div class="exec-box exec-box-green position-relative" 
                   id="slot-exec-coordinator"
                   style="width: 320px; border-width: 2.2px;" 
                   ondragover="handleSlotDragOver(event)"
                   ondragleave="handleSlotDragLeave(event)"
                   ondrop="handleSlotDrop(event, 'ฝ่ายบริหารและอำนวยการ', 'ผู้ประสานงานโครงการ')"
                   onclick="${coordinator ? `handleAvatarClick(event, '${escapeHtml(coordinator.id || coordinator.code)}')` : `openAddModalForSlot('ฝ่ายบริหารและอำนวยการ', 'ผู้ประสานงานโครงการ')`}" 
                   title="คลิกเพื่อเลือกเมนู / ลากคนมาวางเพื่อกำหนดเป็นผู้ประสานงานโครงการ">
                <button type="button" 
                        class="node-card-btn personnel-admin-only" 
                        onclick="openNodeActionMenu(event, 'pos-3')" 
                        title="จัดการตำแหน่งผู้ประสานงาน (แก้ไข/เพิ่มโหนด)">
                  <i class="bi bi-three-dots-vertical"></i>
                </button>
                <div class="exec-avatar exec-avatar-green" 
                     style="width: 48px; height: 48px;"
                     ${coordinator ? `draggable="true" ondragstart="handleAvatarDragStart(event, '${escapeHtml(coordinator.id || coordinator.code)}')"` : ''}>
                  ${coordinator && coordinator.photoUrl ? `<img src="${coordinator.photoUrl}" alt="${coordinator.name}">` : `<i class="bi bi-person-fill"></i>`}
                </div>
                <div>
                  <div class="fw-bold fs-6 lh-1" style="color: #1b5e20;">ผู้ประสานงานโครงการ</div>
                  <div class="fs-7 fw-bold text-success mt-1">${coordinator ? escapeHtml(coordinator.name) : '<span class="text-muted opacity-75">+ กำหนดรายชื่อ</span>'}</div>
                  <div class="dotted-line" style="width: 175px;"></div>
                </div>
              </div>
            </div>

            <!-- Level 4: งานวิชาการ (ใส่เพิ่มได้หลายคน - กำกับดูแลและมีเส้นลงมายังส่วนงานทั้ง 3 ด้านล่าง 4.2, 4.3, 4.4) -->
            <div class="mb-2">
              <div class="academic-middle-box position-relative" id="academic-supervision-box" style="min-width: 520px; max-width: 780px;">
                <button type="button" 
                        class="node-card-btn personnel-admin-only" 
                        onclick="openNodeActionMenu(event, 'academic')" 
                        title="จัดการสายวิชาการ (แก้ไข/เพิ่มตำแหน่ง)">
                  <i class="bi bi-three-dots-vertical"></i>
                </button>
                <span class="academic-tag-header">สายวิชาการและเทคนิคการผลิต</span>
                
                <div class="d-flex align-items-center gap-3 w-100 flex-wrap">
                  <div class="d-flex align-items-center gap-2 border-end pe-3 py-1">
                    <div class="head-avatar avatar-bg-pink" style="background: #6a1b9a; width: 44px; height: 44px;">
                      <i class="bi bi-award-fill"></i>
                    </div>
                    <div class="text-start">
                      <div class="fw-bold fs-6" style="color: #4a148c; line-height: 1.2;">
                        งานวิชาการ
                      </div>
                      <small class="text-secondary fs-8 d-block" style="font-size: 11px;">
                        (ตำแหน่ง: นักวิชาการ)
                      </small>
                    </div>
                  </div>

                  <!-- Multi-person Academic Staff List -->
                  <div class="d-flex align-items-center gap-2 flex-wrap flex-grow-1 justify-content-start">
                    ${academicList && academicList.length > 0 ? academicList.map(ac => {
                      const safeAcName = escapeHtml(ac.name || 'นักวิชาการ');
                      const safeAcCode = escapeHtml(ac.code || ac.id || '');
                      const safeAcId = escapeHtml(ac.id || ac.code);
                      const acPhoto = ac.photoUrl || ac.photo || '';
                      return `
                        <div class="avatar-item" 
                             id="avatar-item-${safeAcId}"
                             draggable="true"
                             ondragstart="handleAvatarDragStart(event, '${safeAcId}')"
                             ondragend="handleAvatarDragEnd(event)"
                             onclick="handleAvatarClick(event, '${safeAcId}')"
                             title="[${safeAcCode}] ${safeAcName} (${escapeHtml(stripStructureCode(ac.position || 'นักวิชาการ'))}) - คลิกเพื่อเลือกเมนู หรือลากเพื่อย้าย">
                          <div class="avatar-circle-ph has-emp" style="border: 1.5px solid #ab47bc;">
                            ${acPhoto ? `<img src="${acPhoto}" alt="${safeAcName}" onerror="this.parentElement.innerHTML='<i class=\\\'bi bi-person-fill text-purple\\\'></i>'" />` : `<i class="bi bi-person-fill" style="color: #6a1b9a;"></i>`}
                          </div>
                          <div class="avatar-name-label fw-bold" style="color: #4a148c;">${safeAcName}</div>
                          <div class="avatar-dots" style="border-color: #ba68c8;"></div>
                        </div>
                      `;
                    }).join('') : `
                      <div class="text-muted fs-8 py-1">ยังไม่มีรายชื่อนักวิชาการ</div>
                    `}

                    <!-- Slot to add more academic personnel -->
                    <div class="avatar-item avatar-slot-add" 
                         id="add-slot-academic"
                         ondragover="handleSlotDragOver(event)"
                         ondragleave="handleSlotDragLeave(event)"
                         ondrop="handleSlotDrop(event, 'งานวิชาการ', 'นักวิชาการ')"
                         onclick="openAddModalForSlot('งานวิชาการ', 'นักวิชาการ')" 
                         title="คลิกเพื่อเพิ่มนักวิชาการ หรือลากรูปคนมาวางที่นี่เพื่อย้ายเข้างานวิชาการ">
                      <div class="avatar-circle-ph" style="border: 1.5px dashed #ab47bc; background: #fdf7ff;">
                        <i class="bi bi-plus-lg fs-6" style="color: #6a1b9a;"></i>
                      </div>
                      <div class="avatar-name-label fw-bold" style="color: #6a1b9a;">+ เพิ่มคน</div>
                      <div class="avatar-dots" style="border-color: #ba68c8;"></div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>

          <!-- ==================== 3. MAIN PILLARS (DYNAMIC FROM TREE) ==================== -->
          <div class="columns-grid" style="${dynamicColumns.length !== 4 ? `grid-template-columns: repeat(${dynamicColumns.length}, minmax(330px, 1fr));` : ''}">
            ${dynamicColumnsHtml}
          </div>

        </div>
      `;

      container.innerHTML = posterHtml;
      if (typeof window.floraLogo?.updateAllRenderedLogos === 'function') {
        window.floraLogo.updateAllRenderedLogos();
      }
      requestAnimationFrame(() => requestAnimationFrame(updateRequestedHierarchyLines));
    }

    // ==================== 2. DEPARTMENT GROUPS VIEW ====================
    function renderDepartmentGroups(list, container) {
      const depts = {};
      list.forEach(e => {
        const d = e.department || 'ฝ่ายทั่วไป';
        if (!depts[d]) depts[d] = [];
        depts[d].push(e);
      });

      let html = `<div class="w-100 d-flex flex-column align-items-center gap-4">`;

      Object.keys(depts).forEach(deptName => {
        const members = depts[deptName];
        html += `
          <div class="dept-section-view">
            <div class="d-flex align-items-center justify-content-between border-bottom pb-3 mb-3">
              <div class="d-flex align-items-center gap-2">
                <i class="bi bi-building text-primary fs-4"></i>
                <h5 class="fw-bold text-dark mb-0">${escapeHtml(stripStructureCode(deptName))}</h5>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-primary bg-opacity-10 text-primary border px-3 py-1.5 rounded-pill">${members.length} บุคลากร</span>
                <button type="button" class="btn btn-outline-primary btn-sm rounded-pill px-3 fw-semibold" onclick="openAddModalForSlot('${escapeHtml(deptName)}', 'พนักงาน')">
                  <i class="bi bi-plus-lg me-1"></i> เพิ่มคนในแผนกนี้
                </button>
              </div>
            </div>

            <div class="d-flex flex-wrap gap-3 justify-content-start">
              ${members.map(emp => renderStandardCard(emp)).join('')}
            </div>
          </div>
        `;
      });

      html += `</div>`;
      container.innerHTML = html;
    }

    // ==================== 3. FULL GRID VIEW ====================
    function renderFullGrid(list, container) {
      let html = `
        <div class="w-100" style="max-width: 1400px;">
          <div class="d-flex justify-content-between align-items-center mb-3 bg-white p-3 rounded-4 border shadow-sm">
            <span class="text-dark fs-7 fw-bold"><i class="bi bi-people-fill text-primary me-1"></i> แสดงรายชื่อบุคลากรทั้งหมด (${list.length} คน)</span>
            <button type="button" class="btn btn-warning btn-sm rounded-pill px-3.5 fw-bold text-dark shadow-sm" onclick="openAddModal()">
              <i class="bi bi-person-plus-fill me-1"></i> เพิ่มบุคลากรใหม่
            </button>
          </div>
          <div class="d-flex flex-wrap justify-content-center gap-3">
            ${list.map(emp => renderStandardCard(emp)).join('')}
          </div>
        </div>
      `;
      container.innerHTML = html;
    }

    function renderStandardCard(emp) {
      const safeId = escapeHtml(emp.id || emp.code);
      const safeCode = escapeHtml(emp.code || emp.id || '');
      const safeName = escapeHtml(emp.name || 'ไม่ระบุชื่อ');
      const safePos = escapeHtml(stripStructureCode(emp.position || emp.role || 'พนักงาน'));
      const safeDept = escapeHtml(stripStructureCode(emp.department || 'โครงการรัตนบุปผา'));
      const safePhone = escapeHtml(emp.phone || '-');
      const photoUrl = emp.photoUrl || emp.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';

      return `
        <div class="emp-card-grid" onclick="openEditModal('${safeId}')" title="คลิกเพื่อแก้ไขข้อมูลบุคลากร">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="badge bg-light text-dark border font-monospace fs-9">${safeCode}</span>
            <span class="badge bg-success bg-opacity-10 text-success fs-9 border border-success-subtle">${escapeHtml(emp.status || 'ปฏิบัติงาน')}</span>
          </div>

          <div class="position-relative d-inline-block mb-2">
            <img src="${photoUrl}" class="rounded-circle shadow-sm" style="width: 72px; height: 72px; object-fit: cover; border: 2.5px solid #0d2258;" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'" />
          </div>

          <div class="fw-bold text-dark fs-7 text-truncate mb-1">${safeName}</div>
          <div class="text-primary fs-8 fw-semibold text-truncate mb-1">${safePos}</div>
          <div class="badge bg-secondary bg-opacity-10 text-secondary text-truncate fs-9 w-100 mb-2">${safeDept}</div>
          
          <div class="text-muted fs-8 d-flex align-items-center justify-content-center gap-1">
            <i class="bi bi-telephone-fill text-success fs-9"></i>
            <span>${safePhone}</span>
          </div>
        </div>
      `;
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function stripStructureCode(value) {
      return String(value || '').replace(/^\s*\d+(?:\.\d+)*\s*/, '').trim();
    }

    // ==================== CRUD & ASSIGN MODAL LOGIC ====================
    window.targetAssignDept = '';
    window.targetAssignPos = '';

    window.openAddModal = function() {
      openAddModalForSlot('1.1 งานธุรการ / งานบุคคล', 'พนักงาน');
    };

    window.openAddModalForSlot = function(deptDefault = '', posDefault = '') {
      if (window.requirePersonnelAdmin && !window.requirePersonnelAdmin('เพิ่มหรือกำหนดตำแหน่งบุคลากร')) return;
      const treeAssignment = typeof window.resolveFloraAssignmentByLabels === 'function' ? window.resolveFloraAssignmentByLabels(deptDefault, posDefault) : null;
      window.targetAssignDept = treeAssignment?.department || deptDefault || '1.1 งานธุรการ / งานบุคคล';
      window.targetAssignPos = treeAssignment?.position || posDefault || 'พนักงาน';
      window.targetAssignDeptNodeId = treeAssignment?.departmentNodeId || '';
      window.targetAssignPosNodeId = treeAssignment?.positionNodeId || '';
      updateDepartmentDropdownOptions();
      updatePositionDropdownOptions(window.targetAssignDept, window.targetAssignPos);

      // Show Tab 1 (Create New) by default & Tab navigation
      document.getElementById('empModalTabs').classList.remove('d-none');
      const tabAssignBtn = document.getElementById('tab-assign-btn');
      const tabAssignPane = document.getElementById('tab-assign-pane');
      const tabNewBtn = document.getElementById('tab-new-btn');
      const tabNewPane = document.getElementById('tab-new-pane');

      tabNewBtn.classList.add('active');
      tabNewPane.classList.add('show', 'active');
      tabAssignBtn.classList.remove('active');
      tabAssignPane.classList.remove('show', 'active');
      document.getElementById('tabNewTitleText').textContent = '1. ➕ สร้างบุคลากรใหม่';

      document.getElementById('empModalTitle').textContent = 'จัดการบุคลากรในตำแหน่ง';
      document.getElementById('empModalSubtitle').textContent = `ตำแหน่งเป้าหมาย: ${stripStructureCode(window.targetAssignDept)} (${stripStructureCode(window.targetAssignPos)})`;
      document.getElementById('modalHeaderIcon').className = 'bi bi-person-plus-fill fs-5';
      document.getElementById('btnDeleteEmployee').classList.add('d-none');
      if (document.getElementById('btnPrintEmployeeBadgeModal')) document.getElementById('btnPrintEmployeeBadgeModal').classList.add('d-none');

      // Update Target Banner
      document.getElementById('assignTargetDeptText').textContent = stripStructureCode(window.targetAssignDept);
      document.getElementById('assignTargetPosText').textContent = `ตำแหน่งเป้าหมาย: ${stripStructureCode(window.targetAssignPos)}`;

      // Reset search and render list of existing employees
      document.getElementById('assignSearchInput').value = '';
      renderExistingAssignList('');

      // Also reset Tab 2 Form in case user wants to create brand new
      document.getElementById('empForm').reset();
      document.getElementById('empEditId').value = '';
      const nextCode = generateNextEmpCode('WK');
      document.getElementById('formEmpCode').value = nextCode;
      document.getElementById('formEmpRole').value = 'WORKER';
      document.getElementById('formEmpStatus').value = 'ปฏิบัติงาน';
      
      const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80';
      document.getElementById('formPhotoPreview').src = defaultAvatar;
      document.getElementById('formPhotoDataUrl').value = defaultAvatar;
      document.getElementById('formPhotoUrlInput').value = '';
      if (document.getElementById('formEmpNickname')) document.getElementById('formEmpNickname').value = '';
      if (document.getElementById('formEmpDetails')) document.getElementById('formEmpDetails').value = '';
      if (document.getElementById('formPhotoFileInput')) document.getElementById('formPhotoFileInput').value = '';
      if (document.getElementById('formPhotoCameraInput')) document.getElementById('formPhotoCameraInput').value = '';

      if (deptDefault) {
        document.getElementById('formEmpDept').value = deptDefault;
        const deptOption = Array.from(document.getElementById('formEmpDept').options).find(o => o.dataset.nodeId === window.targetAssignDeptNodeId);
        if (deptOption) deptOption.selected = true;
      }
      // Populate positions filtered by selected department
      updatePositionDropdownOptions(document.getElementById('formEmpDept').value, posDefault);

      if (posDefault) {
        document.getElementById('formEmpPosition').value = posDefault;
        document.getElementById('formEmpPositionSelect').value = posDefault;
      }
      const posOption = Array.from(document.getElementById('formEmpPositionSelect').options).find(o => o.dataset.nodeId === window.targetAssignPosNodeId);
      if (posOption) { posOption.selected = true; document.getElementById('formEmpPosition').value = posOption.value; }

      updateSupervisorDropdown('');

      const modal = new bootstrap.Modal(document.getElementById('empModal'));
      modal.show();
    };

    window.renderExistingAssignList = function(keyword = '') {
      const container = document.getElementById('assignExistingListContainer');
      if (!container) return;

      const kw = (keyword || '').toLowerCase().trim();
      let list = window.employees || [];

      if (kw) {
        list = list.filter(e => {
          const name = (e.name || '').toLowerCase();
          const code = (e.code || e.id || '').toLowerCase();
          const dept = (e.department || '').toLowerCase();
          const pos = (e.position || '').toLowerCase();
          const phone = (e.phone || '').toLowerCase();
          const note = (e.note || '').toLowerCase();
          return name.includes(kw) || code.includes(kw) || dept.includes(kw) || pos.includes(kw) || phone.includes(kw) || note.includes(kw);
        });
      }

      if (list.length === 0) {
        container.innerHTML = `
          <div class="text-center py-5 bg-white rounded-3 border border-dashed text-muted">
            <i class="bi bi-search fs-2 d-block mb-2 text-secondary"></i>
            <div class="fw-bold">ไม่พบบุคลากรที่ค้นหา "${escapeHtml(keyword)}"</div>
            <div class="fs-8 mt-1">สามารถสร้างบุคลากรใหม่ได้ที่แท็บ "➕ สร้างบุคลากรใหม่"</div>
          </div>
        `;
        return;
      }

      let html = '';
      list.forEach(emp => {
        const safeId = escapeHtml(emp.id || emp.code);
        const safeCode = escapeHtml(emp.code || emp.id || '');
        const safeName = escapeHtml(emp.name || 'ไม่ระบุชื่อ');
        const safeDept = escapeHtml(stripStructureCode(emp.department || 'ยังไม่ระบุแผนก'));
        const safePos = escapeHtml(stripStructureCode(emp.position || emp.role || 'พนักงาน'));
        const photo = emp.photoUrl || emp.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
        const isCurrentSlot = window.targetAssignPosNodeId
          ? emp.positionNodeId === window.targetAssignPosNodeId
          : (emp.departmentNodeId === window.targetAssignDeptNodeId || emp.department === window.targetAssignDept);

        html += `
          <div class="d-flex align-items-center justify-content-between p-2.5 bg-white rounded-3 border hover-shadow-sm transition gap-2">
            <div class="d-flex align-items-center gap-2.5 overflow-hidden">
              <img src="${photo}" class="rounded-circle flex-shrink-0" style="width: 44px; height: 44px; object-fit: cover; border: 2px solid #0d2258;" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'" />
              
              <div class="overflow-hidden">
                <div class="d-flex align-items-center gap-1.5 flex-wrap">
                  <span class="badge bg-dark font-monospace fs-9">${safeCode}</span>
                  <span class="fw-bold text-dark fs-7 text-truncate">${safeName}</span>
                </div>
                <div class="fs-8 text-muted text-truncate">
                  <span class="text-secondary">${safePos}</span> &bull; 
                  <span class="text-primary fw-medium">${safeDept}</span>
                </div>
              </div>
            </div>

            <div class="flex-shrink-0">
              ${isCurrentSlot ? `
                <button type="button" class="btn btn-outline-success btn-sm rounded-pill px-3 py-1 fw-bold fs-8" disabled>
                  <i class="bi bi-check2-circle me-1"></i> อยู่ในแผนกนี้แล้ว
                </button>
              ` : `
                <div class="d-flex align-items-center gap-1">
                  <button type="button" class="btn btn-success btn-sm rounded-pill px-2.5 py-1 fw-bold shadow-sm fs-8 text-nowrap" onclick="assignExistingEmployeeToSlot('${safeId}')" title="ย้ายตำแหน่งหลักมายังตำแหน่งนี้">
                    <i class="bi bi-arrow-right-circle-fill me-1"></i> ย้ายตำแหน่งหลัก
                  </button>
                  <button type="button" class="btn btn-warning text-dark btn-sm rounded-pill px-2.5 py-1 fw-bold shadow-sm fs-8 text-nowrap" onclick="assignExistingEmployeeAsConcurrent('${safeId}')" title="คงตำแหน่งหลักเดิมไว้ และเพิ่มตำแหน่งนี้เป็นตำแหน่งควบ/รักษาการ">
                    <i class="bi bi-plus-circle-fill me-1"></i> ดำรงตำแหน่งควบ
                  </button>
                </div>
              `}
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    };


    window.assignExistingEmployeeAsConcurrent = async function(empId) {
      if (window.requirePersonnelAdmin && !window.requirePersonnelAdmin('กำหนดตำแหน่งควบ')) return;
      const emp = window.employees.find(e => (e.id || e.code) === empId);
      if (!emp) return;

      const targetDept = window.targetAssignDept;
      const targetPos = window.targetAssignPos || 'รักษาการ';
      const targetDeptNodeId = window.targetAssignDeptNodeId || '';
      const targetPosNodeId = window.targetAssignPosNodeId || '';

      if (!emp.concurrentPositions) emp.concurrentPositions = [];
      const alreadyHas = emp.concurrentPositions.some(c => 
        (targetPosNodeId && c.positionNodeId === targetPosNodeId) || 
        (c.department === targetDept && c.position === targetPos)
      );

      if (alreadyHas) {
        showToast(`⚠️ [${emp.name}] ดำรงตำแหน่งควบนี้อยู่แล้ว`);
        return;
      }

      emp.concurrentPositions.push({
        department: targetDept,
        departmentNodeId: targetDeptNodeId,
        position: targetPos,
        positionNodeId: targetPosNodeId,
        assignedAt: new Date().toISOString()
      });

      emp.updatedAt = new Date().toISOString();
      syncToLocalStorage();

      if (window.db) {
        try {
          const docRef = doc(window.db, "employees", emp.id || emp.code);
          await setDoc(docRef, { concurrentPositions: emp.concurrentPositions, updatedAt: emp.updatedAt }, { merge: true });
        } catch (err) {
          console.warn("Firestore save error:", err);
        }
      }

      const modalEl = document.getElementById('empModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      showToast(`🎉 กำหนดให้ [${emp.code || emp.id}] ${emp.name} ดำรงตำแหน่งควบ: "${targetPos}" สำเร็จ!`);
      renderOrgChart(true);
    };

    window.assignExistingEmployeeToSlot = async function(empId) {
      if (window.requirePersonnelAdmin && !window.requirePersonnelAdmin('ย้ายบุคลากรลงตำแหน่ง')) return;
      const emp = window.employees.find(e => (e.id || e.code) === empId);
      if (!emp) return;

      const oldDept = emp.department || 'ยังไม่ระบุแผนก';
      const targetDept = window.targetAssignDept;
      const targetPos = window.targetAssignPos;

      if (!window.ensureFloraLeadershipPositionAvailable(empId, window.targetAssignPosNodeId || '', true)) return;

      emp.department = targetDept;
      emp.departmentNodeId = window.targetAssignDeptNodeId || '';
      emp.position = targetPos || 'พนักงาน';
      emp.positionNodeId = window.targetAssignPosNodeId || '';
      emp.role = window.getFloraRoleForPositionNode(emp.positionNodeId, emp.positionNodeId ? emp.role : 'WORKER');
      emp.updatedAt = new Date().toISOString();

      syncToLocalStorage();

      if (window.db) {
        try {
          const docRef = doc(window.db, "employees", emp.id || emp.code);
          await setDoc(docRef, { role: emp.role, department: targetDept, position: emp.position || targetPos, departmentNodeId: emp.departmentNodeId, positionNodeId: emp.positionNodeId, updatedAt: emp.updatedAt }, { merge: true });
        } catch (err) {
          console.warn("Firestore sync error:", err);
        }
      }

      const modalEl = document.getElementById('empModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      showToast(`✅ โยกย้าย [${emp.code || emp.id}] ${emp.name} จาก "${oldDept}" เข้าสู่ "${targetDept}" สำเร็จ!`);
      await window.logPersonnelAudit?.('กำหนดตำแหน่งบุคลากร', { employeeId: empId, name: emp.name, oldDepartment: oldDept, department: targetDept, position: emp.position });
      renderOrgChart();
    };

    window.openEditModal = function(empId) {
      if (window.requirePersonnelAdmin && !window.requirePersonnelAdmin('แก้ไขข้อมูลบุคลากร')) return;
      const emp = window.employees.find(e => (e.id || e.code) === empId);
      if (!emp) return;

      // Hide Tab navigation and open direct Edit form
      document.getElementById('empModalTabs').classList.add('d-none');
      const tabAssignPane = document.getElementById('tab-assign-pane');
      const tabNewPane = document.getElementById('tab-new-pane');
      tabAssignPane.classList.remove('show', 'active');
      tabNewPane.classList.add('show', 'active');

      document.getElementById('empEditId').value = emp.id || emp.code;
      document.getElementById('empModalTitle').textContent = `แก้ไขข้อมูล: ${emp.name}`;
      document.getElementById('empModalSubtitle').textContent = `รหัส: ${emp.code || emp.id} | แผนก: ${emp.department || '-'}`;
      document.getElementById('modalHeaderIcon').className = 'bi bi-person-gear fs-5';
      document.getElementById('btnDeleteEmployee').classList.remove('d-none');
      if (document.getElementById('btnPrintEmployeeBadgeModal')) document.getElementById('btnPrintEmployeeBadgeModal').classList.remove('d-none');

      updateDepartmentDropdownOptions();
      document.getElementById('formEmpDept').value = emp.department || '1.1 งานธุรการ / งานบุคคล';
      const departmentNodeOption = Array.from(document.getElementById('formEmpDept').options).find(o => o.dataset.nodeId === emp.departmentNodeId);
      if (departmentNodeOption) departmentNodeOption.selected = true;

      // Filter positions for the employee's department
      updatePositionDropdownOptions(document.getElementById('formEmpDept').value, emp.position);

      document.getElementById('formEmpCode').value = emp.code || emp.id || '';
      document.getElementById('formEmpName').value = emp.name || '';
      if (document.getElementById('formEmpNickname')) document.getElementById('formEmpNickname').value = emp.nickname || '';
      document.getElementById('formEmpRole').value = emp.role || 'WORKER';
      document.getElementById('formEmpPosition').value = emp.position || '';
      document.getElementById('formEmpPositionSelect').value = emp.position || '';
      const positionNodeOption = Array.from(document.getElementById('formEmpPositionSelect').options).find(o => o.dataset.nodeId === emp.positionNodeId);
      if (positionNodeOption) positionNodeOption.selected = true;
      document.getElementById('formEmpPhone').value = emp.phone || '';
      document.getElementById('formEmpStatus').value = emp.status || 'ปฏิบัติงาน';
      document.getElementById('formEmpNote').value = emp.note || '';
      if (document.getElementById('formEmpDetails')) document.getElementById('formEmpDetails').value = emp.details || '';

      const photo = emp.photoUrl || emp.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80';
      document.getElementById('formPhotoPreview').src = photo;
      document.getElementById('formPhotoDataUrl').value = photo;
      document.getElementById('formPhotoUrlInput').value = photo.startsWith('http') ? photo : '';

      updateSupervisorDropdown(emp.id || emp.code);
      document.getElementById('formEmpReportsTo').value = emp.reportsTo || '';

      const modal = new bootstrap.Modal(document.getElementById('empModal'));
      modal.show();
    };

    // ==================== MIGRATION ASSISTANT MODAL LOGIC ====================
    window.openMigrationAssistantModal = function() {
      const modal = new bootstrap.Modal(document.getElementById('migrationModal'));
      modal.show();
      renderMigrationTable();
    };

    window.renderMigrationTable = function() {
      const tbody = document.getElementById('migrationTableBody');
      if (!tbody) return;

      const kw = (document.getElementById('migrationSearchInput')?.value || '').toLowerCase().trim();
      const filterDept = document.getElementById('migrationFilterDept')?.value || 'ALL';

      const departmentsList = typeof window.getFloraOrgDepartments === 'function'
        ? window.getFloraOrgDepartments().map(dept => ({ id: dept.id, label: dept.label }))
        : (window.departmentsList || []).map(dept => ({
            id: typeof dept === 'object' ? (dept.nodeId || dept.id || '') : '',
            label: typeof dept === 'object' ? dept.name : dept
          }));

      let list = window.employees || [];

      if (filterDept === 'UNASSIGNED') {
        list = list.filter(e => {
          const dept = e.department || '';
          return !departmentsList.some(d => dept === d.label);
        });
      }

      if (kw) {
        list = list.filter(e => {
          const name = (e.name || '').toLowerCase();
          const code = (e.code || e.id || '').toLowerCase();
          const dept = (e.department || '').toLowerCase();
          const pos = (e.position || '').toLowerCase();
          return name.includes(kw) || code.includes(kw) || dept.includes(kw) || pos.includes(kw);
        });
      }

      if (list.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-5 text-muted">
              <i class="bi bi-inbox fs-2 d-block mb-2"></i>
              <div class="fw-bold">ไม่พบบุคลากรตามเงื่อนไขที่เลือก</div>
            </td>
          </tr>
        `;
        return;
      }

      let html = '';
      list.forEach(emp => {
        const safeId = escapeHtml(emp.id || emp.code);
        const safeCode = escapeHtml(emp.code || emp.id || '-');
        const safeName = escapeHtml(emp.name || 'ไม่ระบุชื่อ');
        const currentDept = emp.department || 'ยังไม่ระบุแผนก';
        const currentPos = emp.position || emp.role || 'พนักงาน';
        const photo = emp.photoUrl || emp.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';

        const deptOptionsHtml = departmentsList.map(d => {
          const isSelected = currentDept === d.label || emp.departmentNodeId === d.id;
          return `<option value="node:${escapeHtml(d.id)}" ${isSelected ? 'selected' : ''}>${escapeHtml(stripStructureCode(d.label))}</option>`;
        }).join('');

        html += `
          <tr id="mig-row-${safeId}">
            <td class="ps-3">
              <img src="${photo}" class="rounded-circle border" style="width: 38px; height: 38px; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'" />
            </td>
            <td>
              <span class="badge bg-light text-dark border font-monospace fs-8">${safeCode}</span>
            </td>
            <td>
              <div class="fw-bold text-dark fs-7">${safeName}</div>
              <small class="text-muted fs-9">${escapeHtml(emp.phone || '-')}</small>
            </td>
            <td>
              <span class="badge bg-secondary bg-opacity-10 text-secondary border fs-8">${escapeHtml(stripStructureCode(currentDept))}</span>
            </td>
            <td>
              <select id="mig-dept-${safeId}" class="form-select form-select-sm fw-semibold border-primary-subtle fs-8">
                ${deptOptionsHtml}
              </select>
            </td>
            <td>
              <input type="text" id="mig-pos-${safeId}" class="form-control form-control-sm fs-8" value="${escapeHtml(stripStructureCode(currentPos))}" placeholder="ตำแหน่ง..." />
            </td>
            <td class="text-center pe-3">
              <button type="button" class="btn btn-primary btn-sm rounded-pill px-3 py-1 fw-bold fs-8 shadow-sm" onclick="saveMigrationRow('${safeId}')">
                <i class="bi bi-check-lg me-1"></i> บันทึกย้าย
              </button>
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = html;
    };

    window.saveMigrationRow = async function(empId) {
      const emp = window.employees.find(e => (e.id || e.code) === empId);
      if (!emp) return;

      const selectedDeptValue = document.getElementById(`mig-dept-${empId}`)?.value;
      const newPos = document.getElementById(`mig-pos-${empId}`)?.value || emp.position;

      if (!selectedDeptValue) return;

      const selectedNodeId = selectedDeptValue.startsWith('node:') ? selectedDeptValue.slice(5) : '';
      const treeAssignment = selectedNodeId && typeof window.getFloraOrgAssignment === 'function'
        ? window.getFloraOrgAssignment(selectedNodeId)
        : (typeof window.resolveFloraAssignmentByLabels === 'function' ? window.resolveFloraAssignmentByLabels(selectedDeptValue, newPos) : null);
      const newDept = treeAssignment?.department || selectedDeptValue;
      const positionAssignment = typeof window.resolveFloraAssignmentByLabels === 'function' ? window.resolveFloraAssignmentByLabels(newDept, newPos) : null;

      if (!window.ensureFloraLeadershipPositionAvailable(empId, positionAssignment?.positionNodeId || '', true)) return;

      emp.department = newDept;
      emp.departmentNodeId = treeAssignment?.departmentNodeId || '';
      emp.position = newPos;
      emp.positionNodeId = positionAssignment?.positionNodeId || '';
      emp.role = window.getFloraRoleForPositionNode(emp.positionNodeId, emp.positionNodeId ? emp.role : 'WORKER');
      emp.updatedAt = new Date().toISOString();

      syncToLocalStorage();

      if (window.db) {
        try {
          const docRef = doc(window.db, "employees", emp.id || emp.code);
          await setDoc(docRef, { role: emp.role, department: newDept, position: newPos, departmentNodeId: emp.departmentNodeId, positionNodeId: emp.positionNodeId, updatedAt: emp.updatedAt }, { merge: true });
        } catch (err) {
          console.warn("Firestore save error:", err);
        }
      }

      showToast(`✅ ย้าย [${emp.code || emp.id}] ${emp.name} เข้าสู่ "${newDept}" เรียบร้อยแล้ว`);
      renderMigrationTable();
      renderOrgChart();
    };

    window.handlePositionSelectChange = function(posVal) {
      if (!posVal) return;
      const select = document.getElementById('formEmpPositionSelect');
      const option = select?.selectedOptions?.[0];
      const nodeId = option?.dataset?.nodeId || '';
      const assignment = nodeId && typeof window.getFloraOrgAssignment === 'function'
        ? window.getFloraOrgAssignment(nodeId)
        : null;
      document.getElementById('formEmpPosition').value = assignment?.position || posVal;

      // Only update department if department isn't selected yet
      const departmentSelect = document.getElementById('formEmpDept');
      if (departmentSelect && !departmentSelect.value && assignment?.departmentNodeId) {
        const departmentOption = Array.from(departmentSelect?.options || []).find(item => item.dataset.nodeId === assignment.departmentNodeId);
        if (departmentOption) {
          departmentOption.selected = true;
          updatePositionDropdownOptions(departmentSelect.value, posVal);
        }
      }

      const category = option?.dataset?.category || '';
      const roleByCategory = {
        executive: 'ADMIN',
        section_head: 'MANAGER',
        academic: 'STAFF',
        team_leader: 'STAFF',
        staff: 'STAFF',
        worker: 'WORKER'
      };
      if (roleByCategory[category]) document.getElementById('formEmpRole').value = roleByCategory[category];
    };

    window.handleDepartmentSelectChange = function(deptVal) {
      const deptSelect = document.getElementById('formEmpDept');
      const val = deptVal !== undefined ? deptVal : (deptSelect?.value || '');
      const selectedOption = deptSelect?.selectedOptions?.[0];
      if (selectedOption?.dataset?.nodeId) {
        deptSelect.dataset.selectedNodeId = selectedOption.dataset.nodeId;
      }

      // Update position dropdown to filter by the selected department
      updatePositionDropdownOptions(val);

      const posSelect = document.getElementById('formEmpPositionSelect');
      const posInput = document.getElementById('formEmpPosition');
      if (posSelect && posSelect.options.length > 1) {
        const currentTyped = posInput?.value?.trim() || '';
        const matchOpt = Array.from(posSelect.options).find(o => o.value && (o.value === currentTyped || stripStructureCode(o.value) === stripStructureCode(currentTyped)));
        if (matchOpt) {
          matchOpt.selected = true;
          handlePositionSelectChange(matchOpt.value);
        } else {
          // Default to the first worker or first available non-empty option
          const defaultOpt = Array.from(posSelect.options).find(o => o.dataset.category === 'worker' || o.dataset.category === 'staff') || posSelect.options[1];
          if (defaultOpt) {
            defaultOpt.selected = true;
            handlePositionSelectChange(defaultOpt.value);
          }
        }
      } else if (posInput && !val) {
        posInput.value = '';
      }
    };

    function getPositionDropdownGroups(deptFilter = '') {
      // Structure groups strictly by Leader (หัวหน้า) and Worker (พนักงาน)
      const groups = {
        leader: { label: '👑 ระดับหัวหน้า', items: [] },
        worker: { label: '👷 ระดับพนักงาน / ปฏิบัติการ', items: [] }
      };

      const rawDept = String(deptFilter || '').trim();
      if (!rawDept) return groups;

      const cleanDept = stripStructureCode(rawDept).toLowerCase();
      const codeMatch = rawDept.match(/^(\d+\.\d+|\d+)/);
      const deptCode = codeMatch ? codeMatch[1] : '';

      // Special Case 1: Executive / Board
      if (rawDept.includes('บริหาร') || rawDept.includes('อำนวยการ') || rawDept.includes('executive')) {
        groups.leader.label = '👑 ระดับบริหารและประสานงาน';
        (window.positionsList || []).forEach(pos => {
          const name = typeof pos === 'string' ? pos : (pos.name || '');
          const cat = typeof pos === 'object' ? (pos.category || '') : '';
          const nodeId = typeof pos === 'object' ? (pos.nodeId || pos.id || '') : '';
          if (cat === 'executive' || name.includes('ประธาน') || name.includes('ที่ปรึกษา') || name.includes('ผู้ประสานงาน')) {
            groups.leader.items.push({ name, displayName: stripStructureCode(name), nodeId, category: 'executive' });
          }
        });
        groups.worker.items.push({ name: 'พนักงานปฏิบัติการ', displayName: 'พนักงานปฏิบัติการ', nodeId: 'pos-6-14', category: 'worker' });
        return groups;
      }

      // Special Case 2: Academic
      if (rawDept.includes('วิชาการ') || rawDept.includes('academic')) {
        groups.leader.label = '🔬 สายวิชาการ';
        (window.positionsList || []).forEach(pos => {
          const name = typeof pos === 'string' ? pos : (pos.name || '');
          const cat = typeof pos === 'object' ? (pos.category || '') : '';
          const nodeId = typeof pos === 'object' ? (pos.nodeId || pos.id || '') : '';
          if (cat === 'academic' || name.includes('วิชาการ')) {
            groups.leader.items.push({ name, displayName: stripStructureCode(name), nodeId, category: 'academic' });
          }
        });
        groups.worker.items.push({ name: 'พนักงานปฏิบัติการ', displayName: 'พนักงานปฏิบัติการ', nodeId: 'pos-6-14', category: 'worker' });
        return groups;
      }

      // 1. Try matching directly from Org Tree Node Children
      try {
        if (typeof window.getFloraOrgDepartments === 'function' && typeof window.getFloraOrgNode === 'function') {
          const depts = window.getFloraOrgDepartments() || [];
          const found = depts.find(d => 
            (d.id && (d.id === rawDept || d.nodeId === rawDept)) ||
            (d.name && d.name.trim() === rawDept) ||
            (d.display && d.display.trim() === rawDept) ||
            (d.code && deptCode && d.code === deptCode) ||
            (d.cleanName && d.cleanName === cleanDept)
          );
          if (found) {
            const node = window.getFloraOrgNode(found.id || found.nodeId);
            if (node && Array.isArray(node.children)) {
              const roleNodes = node.children.filter(c => ['role', 'position', 'supervision'].includes(c.kind));
              roleNodes.forEach(rn => {
                const rnName = rn.name || '';
                const isLeader = rnName.includes('หัวหน้า') || rn.kind === 'supervision' || rn.kind === 'position';
                const item = {
                  name: rnName,
                  displayName: stripStructureCode(rnName),
                  nodeId: rn.id || '',
                  category: isLeader ? 'team_leader' : 'worker'
                };
                if (isLeader) {
                  if (!groups.leader.items.some(x => x.name === rnName)) groups.leader.items.push(item);
                } else {
                  if (!groups.worker.items.some(x => x.name === rnName)) groups.worker.items.push(item);
                }
              });
            }
          }
        }
      } catch (e) {}

      // 2. Keyword & Standard Department Mapping for 13 Divisions
      const departmentKeywordsMap = [
        { code: '1.1', kw: ['ธุรการ', 'บุคคล'], leaderKw: ['ธุรการ', 'บุคคล'], workerKw: ['ธุรการ'] },
        { code: '1.2', kw: ['สวัสดิการ'], leaderKw: ['สวัสดิการ'], workerKw: ['สวัสดิการ'] },
        { code: '1.3', kw: ['ระบบน้ำ'], leaderKw: ['ระบบน้ำ'], workerKw: ['ระบบน้ำ'] },
        { code: '1.4', kw: ['ตัดหญ้า'], leaderKw: ['ตัดหญ้า'], workerKw: ['ตัดหญ้า'] },
        { code: '2.1', kw: ['ทดลอง'], leaderKw: ['ทดลอง'], workerKw: ['ทดลอง'] },
        { code: '2.2', kw: ['กุหลาบ'], leaderKw: ['กุหลาบ'], workerKw: ['กุหลาบ'] },
        { code: '3.1', kw: ['เจดีย์'], leaderKw: ['เจดีย์'], workerKw: ['เจดีย์'] },
        { code: '3.2', kw: ['วิหารหลวงปู่'], leaderKw: ['วิหารหลวงปู่'], workerKw: ['วิหารหลวงปู่'] },
        { code: '3.3', kw: ['ถนนธรรมชัย', 'เฟื่องฟ้า'], leaderKw: ['ถนนธรรมชัย', 'เฟื่องฟ้า'], workerKw: ['ถนนธรรมชัย', 'เฟื่องฟ้า'] },
        { code: '3.4', kw: ['ผสมแกลบ', 'โต๊ะกลาง'], leaderKw: ['ผสมแกลบ', 'โต๊ะกลาง'], workerKw: ['ผสมแกลบ', 'โต๊ะกลาง'] },
        { code: '4.1', kw: ['แปลง a', 'แปลง b', 'a / b', 'a/b'], leaderKw: ['แปลง a / b', 'แปลง a/b', 'แปลง a'], workerKw: ['แปลง a/b', 'แปลง a'] },
        { code: '4.2', kw: ['แปลง e', 'p11', 'e / p11', 'e/p11'], leaderKw: ['แปลง e / p11', 'แปลง e/p11', 'แปลง e'], workerKw: ['แปลง e/p11', 'แปลง e'] },
        { code: '4.3', kw: ['ไม้กระถาง', 'วิหารคด'], leaderKw: ['ไม้กระถาง', 'วิหารคด'], workerKw: ['ไม้กระถาง'] },
        // Main Division heads
        { code: '1', kw: ['ส่วนกลาง'], leaderKw: ['ส่วนกลาง'], workerKw: ['ธุรการ'] },
        { code: '2', kw: ['กุหลาบและงานทดลอง', 'กุหลาบ/งานทดลอง'], leaderKw: ['กุหลาบ/งานทดลอง', 'กุหลาบและงานทดลอง'], workerKw: ['ทดลอง'] },
        { code: '3', kw: ['รัตนบุปผา'], leaderKw: ['รัตนบุปผา'], workerKw: [] },
        { code: '4', kw: ['ธรรมยาตรา'], leaderKw: ['ธรรมยาตรา'], workerKw: [] }
      ];

      const matchedConfig = departmentKeywordsMap.find(cfg => 
        (deptCode && cfg.code === deptCode) ||
        cfg.kw.some(k => cleanDept.includes(k) || rawDept.toLowerCase().includes(k))
      );

      (window.positionsList || []).forEach(pos => {
        const pName = typeof pos === 'string' ? pos : (pos.name || '');
        const pDisp = stripStructureCode(pName);
        const pCat = typeof pos === 'object' ? (pos.category || '') : '';
        const pNodeId = typeof pos === 'object' ? (pos.nodeId || pos.id || '') : '';
        const isLeaderRole = pCat === 'team_leader' || pCat === 'section_head' || pName.includes('หัวหน้า');

        if (matchedConfig) {
          if (isLeaderRole) {
            const matchesLeader = matchedConfig.leaderKw.some(k => pName.toLowerCase().includes(k.toLowerCase()));
            if (matchesLeader && !groups.leader.items.some(x => x.name === pName)) {
              groups.leader.items.push({ name: pName, displayName: pDisp, nodeId: pNodeId, category: 'team_leader' });
            }
          } else {
            const matchesWorker = matchedConfig.workerKw.some(k => pName.toLowerCase().includes(k.toLowerCase()));
            if (matchesWorker && !groups.worker.items.some(x => x.name === pName)) {
              groups.worker.items.push({ name: pName, displayName: pDisp, nodeId: pNodeId, category: 'worker' });
            }
          }
        }
      });

      // If no leader found yet, synthesize a clean department leader
      if (groups.leader.items.length === 0) {
        const syntheticLeader = `หัวหน้า${cleanDept}`;
        groups.leader.items.push({
          name: syntheticLeader,
          displayName: syntheticLeader,
          nodeId: '',
          category: 'team_leader'
        });
      }

      // Always ensure general operational worker "พนักงานปฏิบัติการ" is available in worker group
      if (!groups.worker.items.some(x => x.name === 'พนักงานปฏิบัติการ' || x.displayName === 'พนักงานปฏิบัติการ')) {
        groups.worker.items.push({
          name: 'พนักงานปฏิบัติการ',
          displayName: 'พนักงานปฏิบัติการ',
          nodeId: 'pos-6-14',
          category: 'worker'
        });
      }

      return groups;
    }

    function updatePositionDropdownOptions(selectedDeptVal, preferredPosVal) {
      const select = document.getElementById('formEmpPositionSelect');
      if (!select) return;
      
      const deptSelect = document.getElementById('formEmpDept');
      const currentDept = selectedDeptVal !== undefined ? selectedDeptVal : (deptSelect?.value || '');
      const currentPos = preferredPosVal !== undefined ? preferredPosVal : (select.value || '');

      if (!currentDept) {
        select.innerHTML = '<option value="">-- กรุณาเลือกแผนก / สายงานก่อน --</option>';
        return;
      }

      const groups = getPositionDropdownGroups(currentDept);

      let html = '<option value="">-- กรุณาเลือกตำแหน่ง --</option>';
      let hasSelected = false;

      for (const [key, grp] of Object.entries(groups)) {
        if (grp.items && grp.items.length > 0) {
          html += `<optgroup label="${escapeHtml(grp.label)}">`;
          grp.items.forEach(item => {
            const isSel = (!hasSelected && currentPos && (item.name === currentPos || item.displayName === currentPos || stripStructureCode(item.name) === stripStructureCode(currentPos)));
            if (isSel) hasSelected = true;
            html += `<option value="${escapeHtml(item.name)}" data-node-id="${escapeHtml(item.nodeId || '')}" data-category="${escapeHtml(item.category || key)}" ${isSel ? 'selected' : ''}>${escapeHtml(item.displayName)}</option>`;
          });
          html += '</optgroup>';
        }
      }

      // If an existing employee has a custom or previous position outside the filtered list, preserve it
      if (currentPos && !hasSelected) {
        html += `<optgroup label="📌 ตำแหน่งเดิมที่บันทึกไว้">`;
        html += `<option value="${escapeHtml(currentPos)}" selected>${escapeHtml(stripStructureCode(currentPos))}</option>`;
        html += `</optgroup>`;
      }

      select.innerHTML = html;
    }

    function getDepartmentDropdownGroups() {
      const groups = {
        central: { label: '🏢 สายงานส่วนกลาง (1)', items: [] },
        rose: { label: '🌹 สายงานกุหลาบและงานทดลอง (2)', items: [] },
        ratana: { label: '🪷 สายงานรัตนบุปผา (3)', items: [] },
        dhamma: { label: '🌾 สายงานธรรมยาตรา (4)', items: [] },
        admin: { label: '👑 ฝ่ายบริหารและอำนวยการ', items: [] },
        academic: { label: '🔬 สายวิชาการและเทคนิคการผลิต', items: [] },
        other: { label: '📁 แผนกทั่วไป / อื่นๆ', items: [] }
      };

      const rawDepts = typeof window.getFloraOrgDepartments === 'function'
        ? window.getFloraOrgDepartments()
        : (window.departmentsList || []);

      rawDepts.forEach((dept, idx) => {
        const id = typeof dept === 'object' ? (dept.id || dept.nodeId || `dept-${idx}`) : `dept-${idx}`;
        const code = typeof dept === 'object' ? (dept.code || '') : '';
        const rawName = typeof dept === 'object' ? (dept.display || dept.label || dept.name || '') : String(dept);
        const cleanName = typeof dept === 'object' ? (dept.cleanName || dept.name || rawName) : rawName;
        const grp = typeof dept === 'object' ? (dept.group || '') : '';

        const item = {
          id,
          code,
          name: rawName,
          displayName: rawName,
          cleanName: stripStructureCode(cleanName),
          nodeId: id,
          group: grp
        };

        if (grp.includes('ส่วนกลาง') || code.startsWith('1.') || id.includes('dept-1') || id === 'division-1') {
          groups.central.items.push(item);
        } else if (grp.includes('กุหลาบ') || grp.includes('ทดลอง') || code.startsWith('2.') || id.includes('dept-2') || id === 'division-2') {
          groups.rose.items.push(item);
        } else if (grp.includes('รัตนบุปผา') || code.startsWith('3.') || id.includes('dept-3') || id === 'division-3') {
          groups.ratana.items.push(item);
        } else if (grp.includes('ธรรมยาตรา') || (code.startsWith('4.') && !code.startsWith('4.5')) || id.includes('dept-4') || id === 'division-4') {
          groups.dhamma.items.push(item);
        } else if (id === 'academic' || id === 'pos-academic' || grp.includes('วิชาการ') || code.startsWith('4.5') || rawName.includes('วิชาการ')) {
          groups.academic.items.push(item);
        } else if (id === 'executive-admin' || grp.includes('บริหาร') || rawName.includes('บริหาร') || rawName.includes('ประธาน')) {
          groups.admin.items.push(item);
        } else {
          groups.other.items.push(item);
        }
      });

      return groups;
    }

    function updateDepartmentDropdownOptions() {
      const select = document.getElementById('formEmpDept');
      const filterSelect = document.getElementById('deptFilterSelect');
      const groups = getDepartmentDropdownGroups();

      if (select) {
        const currentVal = select.value;
        let html = '<option value="">-- กรุณาเลือกแผนก / สายงาน --</option>';
        let hasSelected = false;

        for (const [key, grp] of Object.entries(groups)) {
          if (grp.items.length > 0) {
            html += `<optgroup label="${escapeHtml(grp.label)}">`;
            grp.items.forEach(item => {
              const isSelected = item.name === currentVal || item.displayName === currentVal || (item.nodeId && select.dataset.selectedNodeId === item.nodeId);
              if (isSelected) hasSelected = true;
              html += `<option value="${escapeHtml(item.name)}" data-node-id="${escapeHtml(item.nodeId)}" data-code="${escapeHtml(item.code)}" ${isSelected ? 'selected' : ''}>${escapeHtml(item.displayName)}</option>`;
            });
            html += '</optgroup>';
          }
        }

        if (currentVal && !hasSelected) {
          html += `<optgroup label="แผนกเดิม / นอกโครงสร้าง">`;
          html += `<option value="${escapeHtml(currentVal)}" selected>${escapeHtml(stripStructureCode(currentVal))} (เดิม)</option>`;
          html += `</optgroup>`;
        }

        select.innerHTML = html;
      }

      if (filterSelect) {
        const currentFilter = filterSelect.value;
        let filterHtml = '<option value="ALL">🏢 ทุกสายงานและแผนก</option>';
        for (const [key, grp] of Object.entries(groups)) {
          if (grp.items.length > 0) {
            filterHtml += `<optgroup label="${escapeHtml(grp.label)}">`;
            grp.items.forEach(item => {
              filterHtml += `<option value="${escapeHtml(item.name)}" ${item.name === currentFilter ? 'selected' : ''}>${escapeHtml(item.displayName)}</option>`;
            });
            filterHtml += '</optgroup>';
          }
        }
        filterSelect.innerHTML = filterHtml;
      }
    }

    // ==================== POSITIONS & DEPARTMENTS MANAGER LOGIC ====================
    window.openPositionsManagerModal = function() {
      renderPositionsTable();
      renderDepartmentsTable();
      const modalEl = document.getElementById('positionsModal');
      if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
      }
    };

    window.renderPositionsTable = function() {
      const tbody = document.getElementById('positionsTableBody');
      if (!tbody) return;

      if (!window.positionsList || window.positionsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">ไม่พบข้อมูลตำแหน่งงาน</td></tr>`;
        return;
      }

      // Count employees per position
      const posCounts = {};
      (window.employees || []).forEach(emp => {
        const p = emp.position || '';
        if (p) posCounts[p] = (posCounts[p] || 0) + 1;
      });

      const categoryLabels = {
        executive: '<span class="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle">ระดับบริหาร</span>',
        section_head: '<span class="badge bg-info bg-opacity-10 text-info border border-info-subtle">หัวหน้างานส่วนหลัก</span>',
        academic: '<span class="badge bg-purple bg-opacity-10 text-purple border border-purple-subtle" style="color: #6a1b9a; border-color: #ce93d8;">สายวิชาการ</span>',
        team_leader: '<span class="badge bg-warning bg-opacity-10 text-warning border border-warning-subtle text-dark">หัวหน้าทีม/แผนก</span>',
        staff: '<span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary-subtle">เจ้าหน้าที่</span>',
        worker: '<span class="badge bg-light text-dark border">พนักงาน</span>'
      };

      tbody.innerHTML = window.positionsList.map((pos, idx) => {
        const pName = typeof pos === 'string' ? pos : pos.name;
        const pId = typeof pos === 'string' ? `pos-${idx}` : (pos.id || `pos-${idx}`);
        const pCat = typeof pos === 'object' && pos.category ? pos.category : 'worker';
        const count = posCounts[pName] || 0;

        return `
          <tr>
            <td class="ps-3 text-muted fw-semibold">${idx + 1}</td>
            <td>
              <span class="fw-bold text-dark fs-7">${escapeHtml(stripStructureCode(pName))}</span>
            </td>
            <td>${categoryLabels[pCat] || '<span class="badge bg-light text-dark border">ทั่วไป</span>'}</td>
            <td class="text-center">
              <span class="badge ${count > 0 ? 'bg-primary' : 'bg-light text-muted border'} rounded-pill px-2.5">
                ${count} คน
              </span>
            </td>
            <td class="text-center pe-3">
              <button type="button" class="btn btn-outline-danger btn-sm rounded-circle p-1" style="width: 28px; height: 28px;" onclick="handleDeletePosition('${escapeHtml(pId)}', '${escapeHtml(pName)}')" title="ลบตำแหน่งนี้">
                <i class="bi bi-trash3-fill fs-9"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    };

    window.renderDepartmentsTable = function() {
      const tbody = document.getElementById('departmentsTableBody');
      if (!tbody) return;

      if (!window.departmentsList || window.departmentsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">ไม่พบข้อมูลฝ่าย/แผนกงาน</td></tr>`;
        return;
      }

      // Count employees per department
      const deptCounts = {};
      (window.employees || []).forEach(emp => {
        const d = emp.department || '';
        if (d) deptCounts[d] = (deptCounts[d] || 0) + 1;
      });

      tbody.innerHTML = window.departmentsList.map((dept, idx) => {
        const dName = typeof dept === 'string' ? dept : dept.name;
        const dId = typeof dept === 'string' ? `dept-${idx}` : (dept.id || `dept-${idx}`);
        const count = deptCounts[dName] || 0;

        return `
          <tr>
            <td class="ps-3 text-muted fw-semibold">${idx + 1}</td>
            <td>
              <div class="d-flex align-items-center gap-2">
                <i class="bi bi-folder2-open text-warning fs-6"></i>
                <span class="fw-bold text-dark fs-7">${escapeHtml(stripStructureCode(dName))}</span>
              </div>
            </td>
            <td class="text-center">
              <span class="badge ${count > 0 ? 'bg-success' : 'bg-light text-muted border'} rounded-pill px-2.5">
                ${count} คน
              </span>
            </td>
            <td class="text-center pe-3">
              <button type="button" class="btn btn-outline-danger btn-sm rounded-circle p-1" style="width: 28px; height: 28px;" onclick="handleDeleteDepartment('${escapeHtml(dId)}', '${escapeHtml(dName)}')" title="ลบแผนกนี้">
                <i class="bi bi-trash3-fill fs-9"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    };

    window.handleAddNewPosition = async function() {
      const nameInput = document.getElementById('newPosNameInput');
      const catSelect = document.getElementById('newPosCategorySelect');

      if (!nameInput) return;
      const name = nameInput.value.trim();
      if (!name) {
        alert("กรุณากรอกชื่อตำแหน่งงาน");
        nameInput.focus();
        return;
      }

      // Check duplicate
      const exists = window.positionsList.some(p => (typeof p === 'string' ? p : p.name).toLowerCase() === name.toLowerCase());
      if (exists) {
        alert(`ตำแหน่ง "${name}" มีอยู่ในระบบแล้ว`);
        return;
      }

      const newPosObj = {
        id: `pos-${Date.now()}`,
        name: name,
        category: catSelect ? catSelect.value : 'worker',
        order: window.positionsList.length + 1
      };

      window.positionsList.push(newPosObj);
      nameInput.value = '';

      // Sync to Firestore
      if (window.db) {
        try {
          const docRef = doc(window.db, "positions", newPosObj.id);
          await setDoc(docRef, newPosObj);
        } catch (err) {
          console.warn("Firestore position save notice:", err);
        }
      }
      try {
        localStorage.setItem('org_chart_positions', JSON.stringify(window.positionsList));
      } catch (e) {}

      updatePositionDropdownOptions();
      renderPositionsTable();
      renderOrgChart();
      showToast(`✅ เพิ่มตำแหน่ง "${name}" สำเร็จ`);
    };

    window.handleDeletePosition = async function(posId, posName) {
      if (!confirm(`คุณต้องการลบตำแหน่ง "${posName}" ออกจากระบบใช่หรือไม่?`)) return;

      window.positionsList = window.positionsList.filter(p => {
        const id = typeof p === 'string' ? p : p.id;
        const name = typeof p === 'string' ? p : p.name;
        return id !== posId && name !== posName;
      });

      // Sync delete to Firestore
      if (window.db) {
        try {
          const docRef = doc(window.db, "positions", posId);
          await deleteDoc(docRef);
        } catch (err) {
          console.warn("Firestore position delete notice:", err);
        }
      }
      try {
        localStorage.setItem('org_chart_positions', JSON.stringify(window.positionsList));
      } catch (e) {}

      updatePositionDropdownOptions();
      renderPositionsTable();
      renderOrgChart();
      showToast(`🗑️ ลบตำแหน่ง "${posName}" เรียบร้อย`);
    };

    window.handleAddNewDepartment = async function() {
      const nameInput = document.getElementById('newDeptNameInput');
      if (!nameInput) return;
      const name = nameInput.value.trim();
      if (!name) {
        alert("กรุณากรอกชื่อฝ่าย/แผนกงาน");
        nameInput.focus();
        return;
      }

      // Check duplicate
      const exists = window.departmentsList.some(d => (typeof d === 'string' ? d : d.name).toLowerCase() === name.toLowerCase());
      if (exists) {
        alert(`ฝ่าย/แผนก "${name}" มีอยู่ในระบบแล้ว`);
        return;
      }

      const newDeptObj = {
        id: `dept-${Date.now()}`,
        name: name,
        order: window.departmentsList.length + 1
      };

      window.departmentsList.push(newDeptObj);
      nameInput.value = '';

      // Sync to Firestore
      if (window.db) {
        try {
          const docRef = doc(window.db, "departments", newDeptObj.id);
          await setDoc(docRef, newDeptObj);
        } catch (err) {
          console.warn("Firestore department save notice:", err);
        }
      }
      try {
        localStorage.setItem('org_chart_departments', JSON.stringify(window.departmentsList));
      } catch (e) {}

      updateDepartmentDropdownOptions();
      renderDepartmentsTable();
      renderOrgChart();
      showToast(`✅ เพิ่มแผนก "${name}" สำเร็จ`);
    };

    window.handleDeleteDepartment = async function(deptId, deptName) {
      if (!confirm(`คุณต้องการลบฝ่าย/แผนก "${deptName}" ออกจากระบบใช่หรือไม่?`)) return;

      window.departmentsList = window.departmentsList.filter(d => {
        const id = typeof d === 'string' ? d : d.id;
        const name = typeof d === 'string' ? d : d.name;
        return id !== deptId && name !== deptName;
      });

      // Sync delete to Firestore
      if (window.db) {
        try {
          const docRef = doc(window.db, "departments", deptId);
          await deleteDoc(docRef);
        } catch (err) {
          console.warn("Firestore department delete notice:", err);
        }
      }
      try {
        localStorage.setItem('org_chart_departments', JSON.stringify(window.departmentsList));
      } catch (e) {}

      updateDepartmentDropdownOptions();
      renderDepartmentsTable();
      renderOrgChart();
      showToast(`🗑️ ลบแผนก "${deptName}" เรียบร้อย`);
    };

    function updateSupervisorDropdown(currentEmpId = '') {
      const select = document.getElementById('formEmpReportsTo');
      if (!select) return;
      
      const currentVal = select.value;
      select.innerHTML = '<option value="">-- เป็นระดับสูงสุด / ไม่มีหัวหน้างานกำกับโดยตรง --</option>';

      window.employees
        .filter(e => e.id !== currentEmpId && (e.id || e.code))
        .forEach(e => {
          const opt = document.createElement('option');
          opt.value = e.id || e.code;
          opt.textContent = `[${e.code || e.id}] ${e.name} (${e.position || e.department || 'เจ้าหน้าที่'})`;
          if ((e.id || e.code) === currentVal) opt.selected = true;
          select.appendChild(opt);
        });
    }

    function generateNextEmpCode(prefix = 'WK') {
      const matches = window.employees
        .map(e => e.code || e.id || '')
        .filter(c => c.startsWith(`${prefix}-`))
        .map(c => parseInt(c.replace(`${prefix}-`, ''), 10))
        .filter(n => !isNaN(n));
      const maxNum = matches.length > 0 ? Math.max(...matches) : 0;
      return `${prefix}-${String(maxNum + 1).padStart(2, '0')}`;
    }

    window.handleRoleChange = function(newRole) {
      const codeInput = document.getElementById('formEmpCode');
      if (!codeInput.value || codeInput.value.startsWith('SF-') || codeInput.value.startsWith('WK-') || codeInput.value.startsWith('ADM-')) {
        const prefix = newRole === 'ADMIN' ? 'ADM' : newRole === 'MANAGER' ? 'MGR' : newRole === 'STAFF' ? 'SF' : 'WK';
        codeInput.value = generateNextEmpCode(prefix);
      }
    };

    window.handlePhotoFileSelected = function(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        const dataUrl = e.target.result;
        document.getElementById('formPhotoPreview').src = dataUrl;
        document.getElementById('formPhotoDataUrl').value = dataUrl;
        document.getElementById('formPhotoUrlInput').value = '';
      };
      reader.readAsDataURL(file);
    };

    window.handlePhotoUrlInput = function(url) {
      if (url && url.trim().startsWith('http')) {
        document.getElementById('formPhotoPreview').src = url.trim();
        document.getElementById('formPhotoDataUrl').value = url.trim();
      }
    };

    window.promptNewDepartment = function() {
      const newDept = prompt("กรุณาระบุชื่อแผนก/ฝ่ายงานใหม่:");
      if (newDept && newDept.trim()) {
        const trimmed = newDept.trim();
        const select = document.getElementById('formEmpDept');
        const opt = document.createElement('option');
        opt.value = trimmed;
        opt.textContent = trimmed;
        opt.selected = true;
        select.appendChild(opt);
        showToast(`เพิ่มแผนก "${trimmed}" เรียบร้อย`);
      }
    };

    // Save Employee
    window.handleSaveEmployee = async function(event) {
      event.preventDefault();
      if (window.requirePersonnelAdmin && !window.requirePersonnelAdmin('บันทึกข้อมูลบุคลากร')) return;
      
      const editId = document.getElementById('empEditId').value.trim();
      const code = document.getElementById('formEmpCode').value.trim();
      const name = document.getElementById('formEmpName').value.trim();
      const nickname = document.getElementById('formEmpNickname')?.value.trim() || '';
      const selectedRole = document.getElementById('formEmpRole').value;
      const typedPosition = document.getElementById('formEmpPosition').value.trim();
      const selectedPositionValue = document.getElementById('formEmpPositionSelect').value;
      const phone = document.getElementById('formEmpPhone').value.trim();
      const status = document.getElementById('formEmpStatus').value;
      const reportsTo = document.getElementById('formEmpReportsTo').value;
      const note = document.getElementById('formEmpNote').value.trim();
      const details = document.getElementById('formEmpDetails')?.value.trim() || '';
      const currentEmployee = editId ? window.employees.find(e => (e.id || e.code) === editId) : null;
      const positionSelect = document.getElementById('formEmpPositionSelect');
      const departmentSelect = document.getElementById('formEmpDept');
      const selectedOption = positionSelect?.selectedOptions?.[0];
      const selectedPositionNodeId = selectedOption?.dataset?.nodeId || '';
      const selectedAssignment = selectedPositionNodeId && typeof window.getFloraOrgAssignment === 'function'
        ? window.getFloraOrgAssignment(selectedPositionNodeId)
        : null;
      const selectionStillMatches = !typedPosition || typedPosition === selectedPositionValue || typedPosition === selectedAssignment?.position;
      const positionNodeId = selectionStillMatches
        ? selectedPositionNodeId
        : (currentEmployee?.position === typedPosition ? currentEmployee?.positionNodeId || '' : '');
      const position = positionNodeId && selectedAssignment ? selectedAssignment.position : (typedPosition || selectedPositionValue || selectedRole);
      const department = positionNodeId && selectedAssignment
        ? selectedAssignment.department
        : document.getElementById('formEmpDept').value.trim();
      const departmentNodeId = positionNodeId && selectedAssignment
        ? selectedAssignment.departmentNodeId
        : (departmentSelect?.selectedOptions?.[0]?.dataset?.nodeId || currentEmployee?.departmentNodeId || '');
      const role = positionNodeId ? window.getFloraRoleForPositionNode(positionNodeId, selectedRole) : selectedRole;
      const employeeId = editId || code || `EMP-${Date.now()}`;

      let photoUrl = currentEmployee?.photoUrl || currentEmployee?.photo || document.getElementById('formPhotoUrlInput').value.trim();
      try {
        if (typeof window.preparePersonnelPhotoForSave === 'function') {
          photoUrl = await window.preparePersonnelPhotoForSave(employeeId, photoUrl);
        } else {
          photoUrl = document.getElementById('formPhotoDataUrl').value || document.getElementById('formPhotoPreview').src;
        }
      } catch (photoError) {
        showToast(`บันทึกรูปไม่สำเร็จ: ${photoError.message || photoError}`);
        return;
      }

      if (!window.ensureFloraLeadershipPositionAvailable(employeeId, positionNodeId, true)) return;

      const empData = {
        id: employeeId,
        code: code || editId,
        name: name,
        nickname: nickname,
        role: role,
        position: position,
        department: department,
        positionNodeId: positionNodeId,
        departmentNodeId: departmentNodeId,
        phone: phone,
        status: status,
        reportsTo: reportsTo,
        note: note,
        details: details,
        photoUrl: photoUrl,
        updatedAt: new Date().toISOString()
      };

      if (editId) {
        const idx = window.employees.findIndex(e => (e.id || e.code) === editId);
        if (idx !== -1) {
          window.employees[idx] = { ...window.employees[idx], ...empData };
        } else {
          window.employees.push(empData);
        }
      } else {
        window.employees.push(empData);
      }

      syncToLocalStorage();

      if (window.db) {
        try {
          const docRef = doc(window.db, "employees", empData.id);
          await setDoc(docRef, empData, { merge: true });
        } catch (err) {
          console.warn("Firestore save notice:", err);
        }
      }

      const modalEl = document.getElementById('empModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      showToast(`บันทึกข้อมูล "${name}" เรียบร้อยแล้ว!`);
      await window.logPersonnelAudit?.(editId ? 'แก้ไขบุคลากร' : 'เพิ่มบุคลากร', { employeeId, name, department, position });
      renderOrgChart();
    };

    // ==================== DRAG & DROP AND 1-CLICK POPUP MENU ====================
    window.activeContextMenuEmpId = null;
    window.draggedEmpId = null;

    // 1-Click Popup Menu
    window.justFinishedDragging = false;
    window.handleAvatarClick = function(event, empId) {
      if (window.justFinishedDragging) {
        window.justFinishedDragging = false;
        event?.stopPropagation?.();
        return;
      }
      event.stopPropagation();
      window.activeContextMenuEmpId = empId;
      const avatarEl = event.currentTarget;
      const slotDept = avatarEl?.getAttribute('data-target-dept') || '';
      const slotPos = avatarEl?.getAttribute('data-target-pos') || '';
      window.activeContextMenuSlotDept = slotDept;
      window.activeContextMenuSlotPos = slotPos;

      const emp = window.employees.find(e => (e.id || e.code) === empId);
      if (!emp) return;

      const menu = document.getElementById('empContextMenu');
      if (!menu) return;

      // ตรวจสอบว่ารูปที่คลิกนี้ อยู่ในฐานะตำแหน่งควบหรือไม่
      const concList = Array.isArray(emp.concurrentPositions) ? emp.concurrentPositions : [];
      const isConcSlot = concList.some(c => 
        (slotDept && (c.department === slotDept || (c.department && c.department.includes(slotDept)))) ||
        (slotPos && c.position === slotPos)
      );

      const removeConcBtn = document.getElementById('ctxMenuRemoveConcurrentBtn');
      if (removeConcBtn) {
        removeConcBtn.style.display = isConcSlot ? 'flex' : 'none';
      }

      document.getElementById('ctxMenuEmpName').textContent = emp.name || 'พนักงาน';
      document.getElementById('ctxMenuEmpDept').textContent = isConcSlot 
        ? `⭐ ตำแหน่งควบ: ${slotDept || emp.department} • ${slotPos || 'รักษาการ'}`
        : `${emp.department || 'ยังไม่ระบุแผนก'} • ${emp.position || 'พนักงาน'}`;
      
      const photo = emp.photoUrl || emp.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
      document.getElementById('ctxMenuEmpPhoto').src = photo;

      // Position menu near cursor
      const clickX = event.clientX;
      const clickY = event.clientY;
      const menuWidth = 240;
      const menuHeight = 170;

      let posX = clickX + 5;
      let posY = clickY + 5;

      if (posX + menuWidth > window.innerWidth) {
        posX = window.innerWidth - menuWidth - 15;
      }
      if (posY + menuHeight > window.innerHeight) {
        posY = window.innerHeight - menuHeight - 15;
      }

      menu.style.left = `${posX}px`;
      menu.style.top = `${posY}px`;
      menu.style.display = 'block';
    };

    window.openZoomEmpPhoto = function() {
      const empId = window.activeContextMenuEmpId;
      if (!empId) return;
      const emp = (window.employees || []).find(e => (e.id || e.code) === empId);
      if (!emp) return;

      const photo = emp.photoUrl || emp.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';
      const name = emp.name || 'พนักงาน';
      const code = emp.code || emp.id || '';
      const dept = emp.department || 'ยังไม่ระบุแผนก';
      const pos = emp.position || 'พนักงาน';

      const imgEl = document.getElementById('zoomEmpPhotoImg');
      const nameEl = document.getElementById('zoomEmpPhotoName');
      const deptEl = document.getElementById('zoomEmpPhotoDept');

      if (imgEl) imgEl.src = photo;
      if (nameEl) nameEl.textContent = `[${code}] ${name}`;
      if (deptEl) deptEl.textContent = `${dept} • ${pos}`;

      hideContextMenu();

      const modalEl = document.getElementById('zoomEmpPhotoModal');
      if (modalEl) {
        const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
        bsModal.show();
      }
    };

    window.executeContextMenuAction = function(action) {
      const empId = window.activeContextMenuEmpId;
      hideContextMenu();
      if (!empId) return;

      if (action === 'removeConcurrent') {
        const emp = window.employees.find(e => (e.id || e.code) === empId);
        if (emp && Array.isArray(emp.concurrentPositions)) {
          const slotDept = window.activeContextMenuSlotDept;
          const slotPos = window.activeContextMenuSlotPos;
          emp.concurrentPositions = emp.concurrentPositions.filter(c => {
            if (slotDept && (c.department === slotDept || (c.department && c.department.includes(slotDept)))) return false;
            if (slotPos && c.position === slotPos) return false;
            return true;
          });
          emp.updatedAt = new Date().toISOString();
          syncToLocalStorage();
          if (window.db) {
            try {
              const docRef = doc(window.db, "employees", emp.id || emp.code);
              setDoc(docRef, { concurrentPositions: emp.concurrentPositions, updatedAt: emp.updatedAt }, { merge: true }).catch(e => console.warn(e));
            } catch (err) {}
          }
          showToast(`🗑️ ยกเลิกตำแหน่งควบของ "${emp.name}" ใน "${slotDept || 'แผนก'}" เรียบร้อยแล้ว`);
          renderOrgChart(true);
        }
        return;
      } else if (action === 'edit') {
        openEditModal(empId);
      } else if (action === 'printBadge') {
        if (typeof window.openPersonnelBadgePrint === 'function') {
          window.openPersonnelBadgePrint([empId]);
        }
      } else if (action === 'removeFromChart') {
        removeFromChart(empId);
      } else if (action === 'deleteFromSystem') {
        const emp = window.employees.find(e => (e.id || e.code) === empId);
        if (emp) confirmDeleteEmployee(empId, emp.name);
      }
    };

    window.openPrintCurrentEmployeeBadge = function() {
      const editId = document.getElementById('empEditId')?.value;
      if (!editId) return;
      const modalElem = document.getElementById('empModal');
      if (modalElem) {
        bootstrap.Modal.getInstance(modalElem)?.hide();
      }
      if (typeof window.openPersonnelBadgePrint === 'function') {
        window.openPersonnelBadgePrint([editId]);
      }
    };

    window.hideContextMenu = function() {
      const menu = document.getElementById('empContextMenu');
      if (menu) menu.style.display = 'none';
      window.activeContextMenuEmpId = null;
    };

    window.activeActionNodeId = null;

    window.hideNodeActionMenu = function() {
      const menu = document.getElementById('orgNodeActionMenu');
      if (menu) menu.style.display = 'none';
      window.activeActionNodeId = null;
    };

    window.openNodeActionMenu = function(event, nodeId) {
      if (event) {
        event.stopPropagation();
        event.preventDefault();
      }
      hideContextMenu();
      if (window.requirePersonnelAdmin && !window.requirePersonnelAdmin('จัดการโครงสร้างผังองค์กร')) return;

      const liveTree = typeof window.getFloraOrgTree === 'function' ? window.getFloraOrgTree() : null;
      let node = typeof window.getFloraOrgNode === 'function' ? window.getFloraOrgNode(nodeId) : null;
      if (!node && liveTree) {
        function searchTree(n) {
          if (!n) return null;
          if (n.id === nodeId) return n;
          for (const c of (n.children || [])) {
            const found = searchTree(c);
            if (found) return found;
          }
          return null;
        }
        node = searchTree(liveTree);
      }
      if (!node) {
        if (typeof showToast === 'function') showToast('ไม่พบข้อมูลโครงสร้างของโหนดนี้');
        return;
      }

      window.activeActionNodeId = nodeId;
      const menu = document.getElementById('orgNodeActionMenu');
      if (!menu) return;

      const titleEl = document.getElementById('nodeMenuTitle');
      const subtitleEl = document.getElementById('nodeMenuSubtitle');
      const deleteBtn = document.getElementById('nodeMenuDeleteBtn');
      const divider = document.getElementById('nodeMenuDivider');

      const isRoot = liveTree && (liveTree.id === nodeId || nodeId === 'org-root');
      const cleanName = String(node.name || '').replace(/^AUTO-[A-Z0-9_-]+\s*/i, '').trim();

      let kindTh = 'หน่วยงาน';
      if (node.kind === 'division') kindTh = 'ฝ่าย/สายงานหลัก';
      else if (node.kind === 'department') kindTh = 'แผนก/งานย่อย';
      else if (['position', 'role', 'supervision'].includes(node.kind)) kindTh = 'ตำแหน่ง/บทบาท';
      else if (node.kind === 'organization') kindTh = 'องค์กรหลัก';

      if (titleEl) titleEl.textContent = cleanName || 'หน่วยงาน';
      if (subtitleEl) {
        const isAuto = !node.code || node.code === 'ORG-ROOT' || /^AUTO[-_]/i.test(String(node.code).trim()) || /^POS-\d+/i.test(String(node.code).trim());
        const codeText = (!isAuto && node.code) ? `รหัส: ${node.code}` : '';
        subtitleEl.textContent = [kindTh, codeText].filter(Boolean).join(' • ');
      }

      if (deleteBtn) {
        deleteBtn.style.display = isRoot ? 'none' : 'flex';
      }
      if (divider) {
        divider.style.display = isRoot ? 'none' : 'block';
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const menuWidth = 260;
      const menuHeight = isRoot ? 115 : 165;

      let posX = rect.right - menuWidth;
      let posY = rect.bottom + 6;

      if (posX < 8) posX = 8;
      if (posX + menuWidth > window.innerWidth - 8) {
        posX = window.innerWidth - menuWidth - 8;
      }
      if (posY + menuHeight > window.innerHeight - 8) {
        posY = rect.top - menuHeight - 6;
      }

      menu.style.left = `${Math.round(posX)}px`;
      menu.style.top = `${Math.round(posY)}px`;
      menu.style.display = 'block';
    };

    window.executeNodeAction = function(action) {
      const nodeId = window.activeActionNodeId;
      hideNodeActionMenu();
      if (!nodeId) return;

      if (action === 'edit') {
        if (typeof window.floraTreeOpenEdit === 'function') {
          window.floraTreeOpenEdit(nodeId);
        }
      } else if (action === 'add') {
        if (typeof window.floraTreeOpenAdd === 'function') {
          window.floraTreeOpenAdd(nodeId);
        }
      } else if (action === 'delete') {
        if (typeof window.floraTreeDelete === 'function') {
          window.floraTreeDelete(nodeId);
        }
      }
    };

    window.openAddDivisionModal = function() {
      if (window.requirePersonnelAdmin && !window.requirePersonnelAdmin('เพิ่มโครงสร้างองค์กร')) return;
      const liveTree = typeof window.getFloraOrgTree === 'function' ? window.getFloraOrgTree() : null;
      const rootId = liveTree?.id || 'org-root';
      if (typeof window.floraTreeOpenAdd === 'function') {
        window.floraTreeOpenAdd(rootId);
      }
    };

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#empContextMenu')) {
        hideContextMenu();
      }
      if (!e.target.closest('#orgNodeActionMenu') && !e.target.closest('.node-card-btn')) {
        hideNodeActionMenu();
      }
    });

    // Remove from Chart (ปลดออกจากผัง โดยเก็บข้อมูลไว้ในสารบบ)
    window.removeFromChart = async function(empId) {
      if (window.requirePersonnelAdmin && !window.requirePersonnelAdmin('ปลดบุคลากรออกจากผัง')) return;
      const emp = window.employees.find(e => (e.id || e.code) === empId);
      if (!emp) return;

      if (!confirm(`คุณต้องการปลด "${emp.name}" ออกจากผังโครงสร้างใช่หรือไม่?\n(ข้อมูล รหัส และประวัติจะยังคงบันทึกอยู่ในสารบบทั้งหมด)`)) {
        return;
      }

      const oldDept = emp.department || 'ยังไม่ระบุแผนก';
      emp.department = 'ยังไม่ระบุแผนก';
      emp.position = 'พนักงาน';
      emp.departmentNodeId = '';
      emp.positionNodeId = '';
      emp.updatedAt = new Date().toISOString();

      syncToLocalStorage();

      if (window.db) {
        try {
          const docRef = doc(window.db, "employees", emp.id || emp.code);
          await setDoc(docRef, { department: 'ยังไม่ระบุแผนก', position: 'พนักงาน', departmentNodeId: '', positionNodeId: '', updatedAt: emp.updatedAt }, { merge: true });
        } catch (err) {
          console.warn("Firestore remove-from-chart sync:", err);
        }
      }

      showToast(`ℹ️ ปลด [${emp.code || emp.id}] ${emp.name} ออกจากผังแล้ว (ข้อมูลยังคงอยู่ในสารบบ)`);
      await window.logPersonnelAudit?.('ปลดบุคลากรออกจากผัง', { employeeId: empId, name: emp.name, oldDepartment: oldDept });
      renderOrgChart();
    };

    // ==================== DRAG AND DROP LOGIC (MOUSE & TOUCH/LONG-PRESS) ====================
    window.handleAvatarDragStart = function(event, empId) {
      if (window.requirePersonnelAdmin && !window.requirePersonnelAdmin('ลากย้ายบุคลากร')) {
        event?.preventDefault?.();
        return;
      }
      const safeId = String(empId);
      window.draggedEmpId = safeId;
      window.lastDraggedEmpId = safeId;
      if (event?.dataTransfer) {
        event.dataTransfer.setData('text/plain', safeId);
        event.dataTransfer.effectAllowed = 'move';
      }
      
      const el = event?.currentTarget || document.getElementById(`avatar-item-${safeId}`);
      if (el) {
        el.classList.add('dragging');
      }

      // เมื่อลากบุคลากรจากแถบ "รอลงผัง" ให้ซ่อนแผงรอลงผังทันที เพื่อไม่ให้บังผังองค์กร
      const drawer = document.getElementById('unassignedDrawer');
      if (drawer && drawer.classList.contains('show')) {
        window.drawerWasOpenBeforeDrag = true;
        // หน่วงเวลาเล็กน้อย 40ms เพื่อให้เบราว์เซอร์สร้าง drag image เสร็จสมบูรณ์ แล้วค่อยพับเก็บแถบ
        setTimeout(() => {
          if (typeof closeUnassignedDrawer === 'function') {
            closeUnassignedDrawer();
          }
        }, 40);
      } else {
        window.drawerWasOpenBeforeDrag = false;
      }

      hideContextMenu();
    };

    window.handleAvatarDragEnd = function(event) {
      const el = event?.currentTarget;
      if (el) {
        el.classList.remove('dragging');
      }
      document.querySelectorAll('.avatar-item.dragging, .unassigned-card.dragging').forEach(item => {
        item.classList.remove('dragging');
      });
      document.querySelectorAll('.drop-target-active').forEach(slot => {
        slot.classList.remove('drop-target-active');
      });
      window.draggedEmpId = null;
      setTimeout(() => {
        window.lastDraggedEmpId = null;
      }, 400);

      if (window.drawerWasOpenBeforeDrag) {
        window.drawerWasOpenBeforeDrag = false;
        setTimeout(() => {
          const unassignedRemaining = (window.employees || []).filter(isUnassignedEmployee);
          if (unassignedRemaining.length > 0 && typeof openUnassignedDrawer === 'function') {
            openUnassignedDrawer();
          }
        }, 200);
      }
    };

    window.handleSlotDragOver = function(event) {
      if (event) {
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'move';
        }
      }
      const slot = event?.currentTarget || event?.target?.closest?.('.avatar-slot-add, .avatar-item, .team-leader-slot, .section-head-box, .exec-box, .dept-card, [ondrop]');
      if (slot && !slot.classList.contains('drop-target-active')) {
        slot.classList.add('drop-target-active');
      }
    };

    window.handleSlotDragLeave = function(event) {
      const slot = event?.currentTarget || event?.target?.closest?.('.drop-target-active');
      if (slot) {
        slot.classList.remove('drop-target-active');
      }
    };


    window.confirmDragChoiceAction = async function(choice) {
      const modalEl = document.getElementById('dragActionChoiceModal');
      if (modalEl) {
        bootstrap.Modal.getInstance(modalEl)?.hide();
      }

      const pending = window.pendingDragDropAction;
      if (!pending || !pending.emp) return;
      window.pendingDragDropAction = null;

      const { empIdStr, emp, nextDept, nextDeptNodeId, nextPos, nextPosNodeId } = pending;

      if (choice === 'concurrent') {
        // เพิ่มเป็นตำแหน่งควบ / รักษาการ
        if (!emp.concurrentPositions) emp.concurrentPositions = [];
        const alreadyHas = emp.concurrentPositions.some(c => 
          (nextPosNodeId && c.positionNodeId === nextPosNodeId) || 
          (c.department === nextDept && c.position === nextPos)
        );

        if (alreadyHas) {
          showToast(`⚠️ [${emp.name}] ดำรงตำแหน่งควบนี้อยู่แล้ว`);
          return;
        }

        // ตรวจสอบว่าตำแหน่งนี้ (โดยเฉพาะตำแหน่งหัวหน้างานหรือตำแหน่งเดี่ยว) มีคนอื่นครองตำแหน่งหรือดำรงตำแหน่งควบอยู่แล้วหรือไม่
        const isLeadership = (nextPos || '').includes('หัวหน้า') || (nextPosNodeId && nextPosNodeId.includes('lead'));
        if (isLeadership) {
          const currentOccupant = (window.employees || []).find(other => {
            if (other.id === emp.id || other.code === emp.code) return false;
            // คนอื่นที่เป็นตำแหน่งหลัก
            if (other.positionNodeId && nextPosNodeId && other.positionNodeId === nextPosNodeId) return true;
            if (other.department === nextDept && other.position === nextPos) return true;
            // หรือคนอื่นที่เป็นตำแหน่งควบ
            const otherConc = Array.isArray(other.concurrentPositions) ? other.concurrentPositions : [];
            return otherConc.some(c => (nextPosNodeId && c.positionNodeId === nextPosNodeId) || (c.department === nextDept && c.position === nextPos));
          });

          if (currentOccupant) {
            const ok = confirm(`ตำแหน่ง "${nextPos}" มีคุณ "${currentOccupant.name}" ครองตำแหน่งอยู่แล้ว\nต้องการให้คุณ "${emp.name}" มารักษาการแทน และปลดตำแหน่งเดิมของ "${currentOccupant.name}" หรือไม่?`);
            if (!ok) return;
            // ปลดคนเดิมออกจากตำแหน่งควบนี้ หรือย้ายตำแหน่ง
            if (Array.isArray(currentOccupant.concurrentPositions)) {
              currentOccupant.concurrentPositions = currentOccupant.concurrentPositions.filter(c => 
                !((nextPosNodeId && c.positionNodeId === nextPosNodeId) || (c.department === nextDept && c.position === nextPos))
              );
            }
          }
        }

        emp.concurrentPositions.push({
          department: nextDept,
          departmentNodeId: nextDeptNodeId,
          position: nextPos,
          positionNodeId: nextPosNodeId,
          assignedAt: new Date().toISOString()
        });

        emp.updatedAt = new Date().toISOString();
        syncToLocalStorage();

        if (window.db) {
          try {
            const docRef = doc(window.db, "employees", emp.id || emp.code);
            await setDoc(docRef, { concurrentPositions: emp.concurrentPositions, updatedAt: emp.updatedAt }, { merge: true });
          } catch (err) {
            console.warn("Firestore save error:", err);
          }
        }

        showToast(`⭐ เพิ่มตำแหน่งควบ: [${emp.code || emp.id}] ${emp.name} ใน "${nextDept}" สำเร็จ!`);
        renderOrgChart(true);
        return;
      }

      // choice === 'move': ย้ายตำแหน่งหลัก
      // Snapshot before change
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

      const isLeadRole = (nextPos || '').includes('หัวหน้า') || 
                         (nextPos || '').includes('ประธาน') || 
                         (nextPos || '').includes('ผู้ประสานงาน') ||
                         (nextPosNodeId && (nextPosNodeId.includes('lead') || nextPosNodeId.startsWith('pos-4-') || nextPosNodeId.startsWith('pos-5-') || nextPosNodeId === 'pos-1' || nextPosNodeId === 'pos-3'));

      const currentOccupants = (window.employees || []).filter(other => {
        if (!other || String(other.id || other.code) === empIdStr) return false;
        if (nextPosNodeId && other.positionNodeId === nextPosNodeId) return true;
        if (other.department === nextDept && other.position === nextPos) return true;
        return false;
      });

      if (isLeadRole && currentOccupants.length > 0) {
        const occupantNames = currentOccupants.map(o => `[${o.code || o.id}] ${o.name}`).join(', ');
        const confirmSwap = confirm(
          `⚠️ ตำแหน่ง "${nextPos}" มีผู้ครองตำแหน่งอยู่แล้วคือ:
${occupantNames}

ต้องการให้ "${emp.name}" ขึ้นมารับตำแหน่งนี้แทน และสลับบุคลากรเดิมลงมาเป็น "พนักงานทั่วไป" หรือไม่?`
        );
        if (!confirmSwap) {
          return;
        }

        currentOccupants.forEach(existing => {
          existing.position = 'พนักงาน';
          existing.positionNodeId = '';
          existing.role = 'WORKER';
          existing.updatedAt = new Date().toISOString();
          if (window.db) {
            try {
              const docRef = doc(window.db, "employees", existing.id || existing.code);
              setDoc(docRef, { position: 'พนักงาน', positionNodeId: '', role: 'WORKER', updatedAt: existing.updatedAt }, { merge: true }).catch(e => console.warn(e));
            } catch (err) {}
          }
        });
      } else if (nextPosNodeId && typeof window.getFloraLeadershipPositionConflict === 'function') {
        const conflict = window.getFloraLeadershipPositionConflict(empIdStr, nextPosNodeId);
        if (conflict && conflict.occupants.length >= conflict.capacity) {
          conflict.occupants.forEach(existing => {
            existing.position = 'พนักงาน';
            existing.positionNodeId = '';
            existing.role = 'WORKER';
            existing.updatedAt = new Date().toISOString();
          });
        }
      }

      emp.department = nextDept;
      emp.departmentNodeId = nextDeptNodeId;
      emp.position = nextPos;
      emp.positionNodeId = nextPosNodeId;
      emp.role = window.getFloraRoleForPositionNode ? window.getFloraRoleForPositionNode(emp.positionNodeId, emp.positionNodeId ? emp.role : 'WORKER') : (emp.role || 'WORKER');
      emp.updatedAt = new Date().toISOString();

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

      if (typeof window.createPersonnelMoveAction === 'function' && typeof window.pushFloraUndoAction === 'function') {
        const desc = `ย้าย [${emp.name}] ไปยัง "${nextDept}"`;
        const action = window.createPersonnelMoveAction(empIdStr, prevSnapshot, nextSnapshot, desc);
        window.pushFloraUndoAction(action);
      }

      orgChartDirty = true;
      syncToLocalStorage();
      renderOrgChart(true);
      if (typeof renderUnassignedDrawer === 'function') renderUnassignedDrawer();

      if (window.db) {
        try {
          const docRef = doc(window.db, "employees", emp.id || emp.code);
          await setDoc(docRef, { role: emp.role, department: emp.department, position: emp.position, departmentNodeId: emp.departmentNodeId, positionNodeId: emp.positionNodeId, updatedAt: emp.updatedAt }, { merge: true });
        } catch (err) {
          console.warn("Firestore sync notice:", err);
        }
      }

      showToast(`🎯 ย้ายตำแหน่งหลัก: [${emp.code || emp.id}] ${emp.name} ไปยัง "${nextDept}" สำเร็จ!`);
    };

    window.handleSlotDrop = async function(event, targetDept, targetPos) {
      if (event) {
        event.preventDefault?.();
        event.stopPropagation?.();
      }
      
      document.querySelectorAll('.drop-target-active').forEach(slot => {
        slot.classList.remove('drop-target-active');
      });

      const rawId = (event?.dataTransfer?.getData && event.dataTransfer.getData('text/plain')) || window.draggedEmpId || window.lastDraggedEmpId;
      window.draggedEmpId = null;
      if (!rawId) return;

      const empIdStr = String(rawId);
      const emp = (window.employees || []).find(e => String(e.id || e.code) === empIdStr);
      if (!emp) return;

      const oldDept = emp.department || 'ยังไม่ระบุแผนก';
      const treeAssignment = typeof window.resolveFloraAssignmentByLabels === 'function' ? window.resolveFloraAssignmentByLabels(targetDept, targetPos) : null;
      
      const nextDept = treeAssignment?.department || targetDept;
      const nextDeptNodeId = treeAssignment?.departmentNodeId || '';
      const nextPos = treeAssignment?.position || targetPos || 'พนักงาน';
      const nextPosNodeId = treeAssignment?.positionNodeId || '';

      const sameDept = (emp.department === nextDept) || (nextDeptNodeId && emp.departmentNodeId === nextDeptNodeId);
      const samePos = (emp.position === nextPos) || (nextPosNodeId && emp.positionNodeId === nextPosNodeId);
      if (sameDept && samePos && (emp.department || emp.departmentNodeId)) {
        showToast(`⚠️ [${emp.name}] อยู่ในตำแหน่งนี้แล้ว`);
        return;
      }

      // ตรวจสอบว่าพนักงานมีตำแหน่งหลักเดิมอยู่แล้วหรือไม่ (ถ้ามาจากแถบรอลงผัง ให้ย้ายลงตำแหน่งได้เลยโดยไม่ต้องถาม)
      const isCurrentlyAssigned = emp.department && emp.department !== 'ยังไม่ระบุ' && emp.department !== 'ยังไม่ระบุแผนก' && emp.department !== 'ทั่วไป';

      if (isCurrentlyAssigned) {
        // บันทึก context การโยกย้ายไว้รอการยืนยันจากหน้าต่างตัวเลือก
        window.pendingDragDropAction = {
          empIdStr,
          emp,
          nextDept,
          nextDeptNodeId,
          nextPos,
          nextPosNodeId
        };

        const modalEl = document.getElementById('dragActionChoiceModal');
        if (modalEl) {
          const subEl = document.getElementById('dragChoiceEmpSubtitle');
          const deptEl = document.getElementById('dragChoiceTargetDept');
          const posEl = document.getElementById('dragChoiceTargetPos');
          if (subEl) subEl.textContent = `[${emp.code || emp.id}] ${emp.name}`;
          if (deptEl) deptEl.textContent = nextDept;
          if (posEl) posEl.textContent = `ตำแหน่ง: ${nextPos}`;
          const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
          bsModal.show();
          return;
        }
      }

      // Snapshot before change
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

      // ตรวจสอบตำแหน่งหัวหน้างาน / ผู้บริหาร: หากมีคนครองตำแหน่งอยู่แล้ว ให้แสดงหน้าต่างถามยืนยันก่อนสลับเก้าอี้
      const isLeadershipRole = (nextPos || '').includes('หัวหน้า') || 
                               (nextPos || '').includes('ประธาน') || 
                               (nextPos || '').includes('ผู้ประสานงาน') ||
                               (nextPosNodeId && (nextPosNodeId.includes('lead') || nextPosNodeId.startsWith('pos-4-') || nextPosNodeId.startsWith('pos-5-') || nextPosNodeId === 'pos-1' || nextPosNodeId === 'pos-3'));

      // ค้นหาผู้ครองตำแหน่งเดิมในตำแหน่งนี้
      const currentLeadershipOccupants = (window.employees || []).filter(other => {
        if (!other || String(other.id || other.code) === empIdStr) return false;
        if (nextPosNodeId && other.positionNodeId === nextPosNodeId) return true;
        if (other.department === nextDept && other.position === nextPos) return true;
        return false;
      });

      if (isLeadershipRole && currentLeadershipOccupants.length > 0) {
        const occupantNames = currentLeadershipOccupants.map(o => `[${o.code || o.id}] ${o.name}`).join(', ');
        const confirmSwap = confirm(
          `⚠️ ตำแหน่ง "${nextPos}" มีผู้ครองตำแหน่งอยู่แล้วคือ:
${occupantNames}

ต้องการให้ "${emp.name}" ขึ้นมารับตำแหน่งนี้แทน และสลับบุคลากรเดิมลงมาเป็น "พนักงานทั่วไป" หรือไม่?`
        );
        if (!confirmSwap) {
          // ผู้ใช้กดยกเลิก ไม่สลับเก้าอี้
          return;
        }

        // ผู้ใช้กดยืนยัน สลับคนเดิมลงมาเป็นพนักงานทั่วไปในแผนกเดิม
        currentLeadershipOccupants.forEach(existing => {
          existing.position = 'พนักงาน';
          existing.positionNodeId = '';
          existing.role = 'WORKER';
          existing.updatedAt = new Date().toISOString();
          if (window.db) {
            try {
              const docRef = doc(window.db, "employees", existing.id || existing.code);
              setDoc(docRef, { position: 'พนักงาน', positionNodeId: '', role: 'WORKER', updatedAt: existing.updatedAt }, { merge: true }).catch(e => console.warn(e));
            } catch (err) {}
          }
        });
      } else if (nextPosNodeId && typeof window.getFloraLeadershipPositionConflict === 'function') {
        const conflict = window.getFloraLeadershipPositionConflict(empIdStr, nextPosNodeId);
        if (conflict && conflict.occupants.length >= conflict.capacity) {
          conflict.occupants.forEach(existing => {
            existing.position = 'พนักงาน';
            existing.positionNodeId = '';
            existing.role = 'WORKER';
            existing.updatedAt = new Date().toISOString();
          });
        }
      }

      // 1. Update in-memory state
      emp.department = nextDept;
      emp.departmentNodeId = nextDeptNodeId;
      emp.position = nextPos;
      emp.positionNodeId = nextPosNodeId;
      emp.role = window.getFloraRoleForPositionNode ? window.getFloraRoleForPositionNode(emp.positionNodeId, emp.positionNodeId ? emp.role : 'WORKER') : (emp.role || 'WORKER');
      emp.updatedAt = new Date().toISOString();

      // Snapshot after change
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

      // Push into Universal Undo/Redo Engine
      if (typeof window.createPersonnelMoveAction === 'function' && typeof window.pushFloraUndoAction === 'function') {
        const desc = `ย้าย [${emp.name}] ไปยัง "${nextDept}"`;
        const action = window.createPersonnelMoveAction(empIdStr, prevSnapshot, nextSnapshot, desc);
        window.pushFloraUndoAction(action);
      }

      // 2. Mark dirty and synchronous local cache persistence
      orgChartDirty = true;
      syncToLocalStorage();

      // 3. IMMEDIATE UI REFRESH (รูปและข้อมูลย้ายทันทีแบบไม่ต้องรอ)
      renderOrgChart(true);
      if (typeof renderUnassignedDrawer === 'function') {
        renderUnassignedDrawer();
      }

      // 4. Instant feedback toast
      showToast(`🎯 โยกย้าย [${emp.code || emp.id}] ${emp.name} ไปยัง "${nextDept}" สำเร็จ!`);

      // 5. Asynchronous background persistence (Non-blocking)
      if (window.db) {
        try {
          const docRef = doc(window.db, "employees", emp.id || emp.code);
          setDoc(docRef, { 
            role: emp.role, 
            department: emp.department, 
            position: emp.position, 
            departmentNodeId: emp.departmentNodeId, 
            positionNodeId: emp.positionNodeId, 
            updatedAt: emp.updatedAt 
          }, { merge: true }).catch(err => console.warn("Firestore drag drop sync:", err));
        } catch (err) {
          console.warn("Firestore async setDoc:", err);
        }
      }

      try {
        window.logPersonnelAudit?.('ย้ายบุคลากรในผัง', { 
          employeeId: empIdStr, 
          name: emp.name, 
          oldDepartment: oldDept, 
          department: emp.department, 
          position: emp.position 
        });
      } catch (err) {
        // silent audit error
      }
    };

    // ==================== TOUCH & LONG-PRESS DRAG-AND-DROP CONTROLLER ====================
    (function initTouchDragAndDrop() {
      let touchTimer = null;
      let isTouchDragging = false;
      let startTouchX = 0, startTouchY = 0;
      let currentDropTarget = null;
      let draggedElement = null;
      let ghostEl = null;

      function cleanupTouchDrag() {
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }
        if (ghostEl && ghostEl.parentNode) {
          ghostEl.parentNode.removeChild(ghostEl);
        }
        ghostEl = null;
        if (draggedElement) {
          draggedElement.classList.remove('dragging');
          draggedElement = null;
        }
        document.querySelectorAll('.drop-target-active').forEach(el => el.classList.remove('drop-target-active'));
        currentDropTarget = null;
        isTouchDragging = false;
      }

      document.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) {
          cleanupTouchDrag();
          return;
        }

        const touch = e.touches[0];
        startTouchX = touch.clientX;
        startTouchY = touch.clientY;

        const target = touch.target;
        const source = target.closest('[draggable="true"], .avatar-item, .team-leader-slot, .head-avatar, .exec-avatar, .unassigned-card, .live-person-chip');
        if (!source) return;

        // Extract empId
        let empId = source.getAttribute('data-emp-id');
        if (!empId) {
          const idAttr = source.id || '';
          if (idAttr.startsWith('avatar-item-')) empId = idAttr.replace('avatar-item-', '');
          else if (idAttr.startsWith('slot-lead-')) empId = idAttr.replace('slot-lead-', '');
        }
        if (!empId) {
          const ondragAttr = source.getAttribute('ondragstart') || '';
          const match = ondragAttr.match(/handleAvatarDragStart\([^,]+,\s*'([^']+)'\)/);
          if (match) empId = match[1];
        }
        if (!empId) {
          const onclickAttr = source.getAttribute('onclick') || '';
          const match = onclickAttr.match(/handleAvatarClick\([^,]+,\s*'([^']+)'\)/);
          if (match) empId = match[1];
        }

        if (!empId) return;

        const safeEmpId = String(empId);
        const emp = (window.employees || []).find(e => String(e.id || e.code) === safeEmpId);
        if (!emp) return;

        // Start long-press timer (180ms)
        touchTimer = setTimeout(() => {
          isTouchDragging = true;
          window.draggedEmpId = safeEmpId;
          window.lastDraggedEmpId = safeEmpId;
          draggedElement = source;
          source.classList.add('dragging');
          if (navigator.vibrate) {
            try { navigator.vibrate(35); } catch (_) {}
          }
          hideContextMenu();

          // Create floating touch ghost
          ghostEl = document.createElement('div');
          ghostEl.id = 'touchDragGhost';
          ghostEl.style.position = 'fixed';
          ghostEl.style.left = `${touch.clientX}px`;
          ghostEl.style.top = `${touch.clientY}px`;
          ghostEl.style.zIndex = '999999';
          ghostEl.style.pointerEvents = 'none';
          ghostEl.style.transform = 'translate(-50%, -50%) scale(1.18)';
          ghostEl.style.borderRadius = '50%';
          ghostEl.style.width = '52px';
          ghostEl.style.height = '52px';
          ghostEl.style.boxShadow = '0 10px 25px rgba(0,0,0,0.35), 0 0 0 3px #ff9800';
          ghostEl.style.background = '#ffffff';
          ghostEl.style.overflow = 'hidden';
          ghostEl.style.display = 'flex';
          ghostEl.style.alignItems = 'center';
          ghostEl.style.justifyContent = 'center';

          const photoUrl = emp.photoUrl || emp.photo || '';
          if (photoUrl) {
            ghostEl.innerHTML = `<img src="${photoUrl}" style="width:100%; height:100%; object-fit:cover;" />`;
          } else {
            ghostEl.innerHTML = `<i class="bi bi-person-fill text-primary" style="font-size:26px;"></i>`;
          }
          document.body.appendChild(ghostEl);
          showToast(`👆 ลาก [${emp.name}] ไปปล่อยยังตำแหน่งที่ต้องการ`);
        }, 180);
      }, { passive: true });

      document.addEventListener('touchmove', (e) => {
        if (!e.touches.length) return;
        const touch = e.touches[0];

        if (!isTouchDragging) {
          // If moved before long-press fires, cancel timer so standard page scrolling works
          const dist = Math.hypot(touch.clientX - startTouchX, touch.clientY - startTouchY);
          if (dist > 8 && touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
          }
          return;
        }

        // We ARE touch-dragging
        e.preventDefault();

        if (ghostEl) {
          ghostEl.style.left = `${touch.clientX}px`;
          ghostEl.style.top = `${touch.clientY}px`;
        }

        // Find element under touch point
        const elUnderPoint = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!elUnderPoint) return;

        const candidateTarget = elUnderPoint.closest('.avatar-slot-add, .avatar-item, .team-leader-slot, .section-head-box, .exec-box, .dept-card, .live-node-people, [ondrop]');
        if (candidateTarget !== currentDropTarget) {
          if (currentDropTarget) {
            currentDropTarget.classList.remove('drop-target-active');
          }
          currentDropTarget = candidateTarget;
          if (currentDropTarget) {
            currentDropTarget.classList.add('drop-target-active');
          }
        }
      }, { passive: false });

      document.addEventListener('touchend', (e) => {
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }

        if (!isTouchDragging) {
          cleanupTouchDrag();
          return;
        }

        e.preventDefault();
        window.justFinishedDragging = true;
        setTimeout(() => { window.justFinishedDragging = false; }, 350);

        const dropTarget = currentDropTarget;
        const empId = window.draggedEmpId || window.lastDraggedEmpId;
        cleanupTouchDrag();

        if (dropTarget && empId) {
          // Check for tree node drop
          const treeNodeId = dropTarget.getAttribute('data-node-id') || dropTarget.closest('[data-node-id]')?.getAttribute('data-node-id');
          if (treeNodeId && typeof window.handleTreeOrgDrop === 'function') {
            const mockEvt = { preventDefault: () => {}, currentTarget: dropTarget };
            window.handleTreeOrgDrop(mockEvt, treeNodeId);
            return;
          }

          // Main org chart drop
          let targetDept = dropTarget.getAttribute('data-target-dept');
          let targetPos = dropTarget.getAttribute('data-target-pos');

          if (!targetDept || !targetPos) {
            const ondropAttr = dropTarget.getAttribute('ondrop') || '';
            const match = ondropAttr.match(/handleSlotDrop\([^,]+,\s*'([^']+)',\s*'([^']+)'\)/);
            if (match) {
              targetDept = match[1];
              targetPos = match[2];
            }
          }

          if (targetDept && targetPos) {
            window.handleSlotDrop(null, targetDept, targetPos);
          }
        }
      }, { passive: false });

      document.addEventListener('touchcancel', cleanupTouchDrag, { passive: true });
    })();

    // Global protection against accidental image drops causing full-screen navigation
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    }, false);
    window.addEventListener('drop', (e) => {
      // If not on an active drop slot, prevent browser from opening the image URL
      if (!e.target.closest('.avatar-slot-add') && !e.target.closest('.team-leader-slot') && !e.target.closest('.section-head-box') && !e.target.closest('.exec-box') && !e.target.closest('[ondrop]')) {
        e.preventDefault();
      }
    }, false);

    window.confirmDeleteCurrentEmployee = function() {
      const editId = document.getElementById('empEditId').value;
      const emp = window.employees.find(e => (e.id || e.code) === editId);
      if (emp) {
        confirmDeleteEmployee(editId, emp.name);
      }
    };

    window.confirmDeleteEmployee = async function(empId, empName) {
      if (window.requirePersonnelAdmin && !window.requirePersonnelAdmin('ลบข้อมูลบุคลากร')) return;
      if (!confirm(`ย้ายข้อมูลบุคลากร "${empName}" ไปยัง “บุคลากรที่ลบแล้ว” หรือไม่?\nสามารถกู้คืนกลับมาด้วยรหัสเดิมได้`)) {
        return;
      }
      const reasonInput = prompt('ระบุเหตุผลการลบ (เว้นว่างได้):', 'ลบออกจากสารบบ');
      if (reasonInput === null) return;
      const employee = window.employees.find(e => String(e.id || e.code) === String(empId));
      if (!employee || !window.db) {
        showToast('ไม่พบข้อมูลบุคลากรหรือฐานข้อมูลยังไม่พร้อม จึงยังไม่ได้ลบ');
        return;
      }

      try {
        const deletedAt = new Date().toISOString();
        const trashData = {
          ...employee,
          originalId: empId,
          deletedAt,
          deletedByUid: window.personnelAccess?.uid || '',
          deletedByEmail: window.personnelAccess?.email || '',
          deleteReason: reasonInput.trim() || 'ไม่ระบุเหตุผล',
          deletedFrom: 'org_chart'
        };
        await setDoc(doc(window.db, 'deleted_employees', empId), trashData);
        await deleteDoc(doc(window.db, 'employees', empId));
        window.employees = window.employees.filter(e => String(e.id || e.code) !== String(empId));
        syncToLocalStorage();
      } catch (err) {
        console.warn('Personnel soft delete notice:', err);
        showToast(`ย้ายไปถังขยะไม่สำเร็จ: ${err.message || err}`);
        return;
      }

      const modalEl = document.getElementById('empModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      showToast(`ย้าย "${empName}" ไปยังบุคลากรที่ลบแล้ว สามารถกู้คืนได้`);
      await window.logPersonnelAudit?.('ย้ายบุคลากรไปถังขยะ', { employeeId: empId, name: empName, reason: reasonInput.trim() || 'ไม่ระบุเหตุผล' });
      renderOrgChart();
    };

    // ==================== INTERACTION & CONTROLS ====================
    window.switchView = function(view) {
      if (window.currentView === view && orgChartRendered && !orgChartDirty) return;
      window.currentView = view;
      const btnHierarchy = document.getElementById('btnViewHierarchy');
      const btnDept = document.getElementById('btnViewDept');
      const btnGrid = document.getElementById('btnViewGrid');
      if (btnHierarchy) btnHierarchy.className = `btn btn-sm rounded-pill px-3 py-1 ${view === 'hierarchy' ? 'btn-primary active shadow-sm fw-bold' : 'fw-semibold text-muted'}`;
      if (btnDept) btnDept.className = `btn btn-sm rounded-pill px-3 py-1 ${view === 'department' ? 'btn-primary active shadow-sm fw-bold' : 'fw-semibold text-muted'}`;
      if (btnGrid) btnGrid.className = `btn btn-sm rounded-pill px-3 py-1 ${view === 'grid' ? 'btn-primary active shadow-sm fw-bold' : 'fw-semibold text-muted'}`;
      renderOrgChart(true);
    };

    window.filterByDepartment = function(dept) {
      window.activeFilterDept = dept;
      renderOrgChart(true);
    };

    window.searchMatchedIds = [];
    window.currentSearchMatchIndex = -1;
    window.searchDebounceTimer = null;

    window.handleSearch = function(keyword) {
      const q = (keyword || '').trim();
      window.searchKeyword = q;

      // Clear existing highlight timeout
      if (window.searchHighlightTimer) {
        clearTimeout(window.searchHighlightTimer);
        window.searchHighlightTimer = null;
      }

      // Remove existing search highlights from previous search
      document.querySelectorAll('.search-target-highlight').forEach(el => {
        el.classList.remove('search-target-highlight');
      });

      const navControls = document.getElementById('searchNavControls');
      const countBadge = document.getElementById('searchMatchCount');

      if (!q) {
        window.searchMatchedIds = [];
        window.currentSearchMatchIndex = -1;
        if (navControls) navControls.className = 'd-none';
        return;
      }

      const qLower = q.toLowerCase();

      // Find matching employees (เฉพาะคนที่อยู่ในผังโครงสร้างแล้วเท่านั้น ไม่รวมคนที่รอลงผัง)
      const matched = (window.employees || []).filter(emp => {
        if (typeof window.isUnassignedEmployee === 'function' && window.isUnassignedEmployee(emp)) {
          return false;
        }
        const name = (emp.name || '').toLowerCase();
        const code = (emp.code || emp.id || '').toLowerCase();
        const pos = (emp.position || '').toLowerCase();
        const dept = (emp.department || '').toLowerCase();
        const nickname = (emp.nickname || '').toLowerCase();
        return name.includes(qLower) || code.includes(qLower) || pos.includes(qLower) || dept.includes(qLower) || nickname.includes(qLower);
      });

      window.searchMatchedIds = matched.map(e => String(e.id || e.code));
      window.currentSearchMatchIndex = matched.length > 0 ? 0 : -1;

      if (navControls && countBadge) {
        if (matched.length > 0) {
          navControls.className = 'd-flex align-items-center gap-1.5 bg-white border rounded-pill px-2.5 py-1 shadow-xs';
          countBadge.textContent = `พบ ${matched.length} คน (1/${matched.length})`;
        } else {
          navControls.className = 'd-flex align-items-center gap-1.5 bg-white border rounded-pill px-2.5 py-1 shadow-xs';
          countBadge.textContent = 'ไม่พบบุคลากร';
        }
      }

      // Debounce scroll to first match
      clearTimeout(window.searchDebounceTimer);
      window.searchDebounceTimer = setTimeout(() => {
        if (window.searchMatchedIds.length > 0) {
          jumpToEmployeeCard(window.searchMatchedIds[0]);
        }
      }, 250);
    };

    window.navigateSearchResult = function(direction) {
      if (!window.searchMatchedIds || window.searchMatchedIds.length === 0) return;

      window.currentSearchMatchIndex += direction;
      if (window.currentSearchMatchIndex >= window.searchMatchedIds.length) {
        window.currentSearchMatchIndex = 0;
      } else if (window.currentSearchMatchIndex < 0) {
        window.currentSearchMatchIndex = window.searchMatchedIds.length - 1;
      }

      const countBadge = document.getElementById('searchMatchCount');
      if (countBadge) {
        countBadge.textContent = `พบ ${window.searchMatchedIds.length} คน (${window.currentSearchMatchIndex + 1}/${window.searchMatchedIds.length})`;
      }

      const targetId = window.searchMatchedIds[window.currentSearchMatchIndex];
      jumpToEmployeeCard(targetId);
    };

    window.jumpToEmployeeCard = function(empId) {
      if (!empId) return;

      // Remove highlight from previous items
      document.querySelectorAll('.search-target-highlight').forEach(el => {
        el.classList.remove('search-target-highlight');
      });

      // Find element in Org chart by diverse selectors
      let targetEl = document.getElementById(`avatar-item-${empId}`);
      if (!targetEl) targetEl = document.getElementById(`slot-lead-${empId}`);
      if (!targetEl) targetEl = document.querySelector(`[id*="${empId}"]`);

      // If in executive slots, look by text or onclick
      if (!targetEl) {
        const execBoxes = document.querySelectorAll('.exec-box, .section-head-box, .academic-middle-box, .team-leader-slot, .avatar-item');
        for (const box of execBoxes) {
          if (box.getAttribute('onclick')?.includes(empId) || box.getAttribute('title')?.includes(empId)) {
            targetEl = box;
            break;
          }
        }
      }

      if (targetEl) {
        // Smooth scroll to the target element with viewport centering
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

        // Add glowing pulse animation class
        targetEl.classList.add('search-target-highlight');

        // Automatically remove highlight after 5 seconds
        if (window.searchHighlightTimer) clearTimeout(window.searchHighlightTimer);
        window.searchHighlightTimer = setTimeout(() => {
          if (targetEl) targetEl.classList.remove('search-target-highlight');
        }, 5000);
      }
    };

    window.clearSearch = function() {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = '';
      window.searchKeyword = '';
      window.searchMatchedIds = [];
      window.currentSearchMatchIndex = -1;

      const navControls = document.getElementById('searchNavControls');
      if (navControls) navControls.className = 'd-none';

      document.querySelectorAll('.search-target-highlight').forEach(el => {
        el.classList.remove('search-target-highlight');
      });

      if (window.searchHighlightTimer) {
        clearTimeout(window.searchHighlightTimer);
        window.searchHighlightTimer = null;
      }
    };

    window.reloadEmployeeData = async function() {
      showToast("🔄 กำลังซิงค์ข้อมูลบุคลากรจาก Firestore...");
      try {
        if (window.db) {
          const snap = await getDocs(collection(window.db, "employees"));
          if (!snap.empty) {
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            window.employees = list;
          }
        }
        syncToLocalStorage();
        renderOrgChart();
        showToast(`✅ โหลดข้อมูลสำเร็จ (${window.employees.length} คน)`);
      } catch (err) {
        console.warn("Reload error:", err);
        loadFromLocalStorageOrSeed();
      }
    };

    // ==================== UNASSIGNED EMPLOYEES DRAWER CONTROLLER ====================
    window.currentDrawerTab = 'with_photo';
    window.drawerSearchKeyword = '';

    let inUnassignedEmployeeCheck = false;
    window.isUnassignedEmployee = function(emp) {
      if (!emp) return false;
      if (inUnassignedEmployeeCheck) return false;
      inUnassignedEmployeeCheck = true;
      try {
        if (typeof window.isEmployeeAssignedToFloraTree === 'function' && window.isEmployeeAssignedToFloraTree(emp)) return false;
        const dept = (emp.department || '').trim();

        if (!dept || dept === 'ยังไม่ระบุ' || dept === 'ยังไม่ระบุแผนก' || dept === 'ทั่วไป' || dept === 'Unassigned' || dept === '-') {
          return true;
        }
        const normalizeLabel = value => String(value || '').replace(/^\s*\d+(?:\.\d+)*\s*/, '').replace(/\s+/g, ' ').trim().toLowerCase();
        const deptMatch = (window.departmentsList || []).some(item => normalizeLabel(typeof item === 'object' ? item.name : item) === normalizeLabel(dept));
        const posMatch = (window.positionsList || []).some(item => normalizeLabel(typeof item === 'object' ? item.name : item) === normalizeLabel(emp.position));
        return !deptMatch && !posMatch;
      } finally {
        inUnassignedEmployeeCheck = false;
      }
    };

    window.hasPhoto = function(emp) {
      if (!emp) return false;
      const p = (emp.photoUrl || emp.photo || '').trim();
      return (p.length > 10 && !p.includes('placeholder') && !p.endsWith('/default'));
    };

    window.toggleUnassignedDrawer = function() {
      const drawer = document.getElementById('unassignedDrawer');
      if (!drawer) return;
      if (drawer.classList.contains('show')) {
        closeUnassignedDrawer();
      } else {
        openUnassignedDrawer();
      }
    };

    window.openUnassignedDrawer = function() {
      const drawer = document.getElementById('unassignedDrawer');
      const backdrop = document.getElementById('unassignedDrawerBackdrop');
      if (drawer) drawer.classList.add('show');
      if (backdrop) backdrop.classList.add('show');
      renderUnassignedDrawer();
    };

    window.closeUnassignedDrawer = function() {
      const drawer = document.getElementById('unassignedDrawer');
      const backdrop = document.getElementById('unassignedDrawerBackdrop');
      if (drawer) drawer.classList.remove('show');
      if (backdrop) backdrop.classList.remove('show');
    };

    window.setDrawerTab = function(tab) {
      window.currentDrawerTab = tab;
      const tabWithPhoto = document.getElementById('drawerTabWithPhoto');
      const tabNoPhoto = document.getElementById('drawerTabNoPhoto');
      const tabAll = document.getElementById('drawerTabAll');

      if (tabWithPhoto) {
        tabWithPhoto.className = tab === 'with_photo' ? 'btn btn-sm rounded-pill fw-bold btn-primary shadow-sm' : 'btn btn-sm rounded-pill fw-semibold text-muted';
      }
      if (tabNoPhoto) {
        tabNoPhoto.className = tab === 'no_photo' ? 'btn btn-sm rounded-pill fw-bold btn-primary shadow-sm' : 'btn btn-sm rounded-pill fw-semibold text-muted';
      }
      if (tabAll) {
        tabAll.className = tab === 'all' ? 'btn btn-sm rounded-pill fw-bold btn-primary shadow-sm' : 'btn btn-sm rounded-pill fw-semibold text-muted';
      }

      renderUnassignedDrawer();
    };

    window.handleDrawerSearch = function(val) {
      window.drawerSearchKeyword = (val || '').trim();
      renderUnassignedDrawer();
    };

    window.clearDrawerSearch = function() {
      window.drawerSearchKeyword = '';
      const input = document.getElementById('drawerSearchInput');
      if (input) input.value = '';
      renderUnassignedDrawer();
    };

    const quickAssignInFlight = new Set();

    window.quickAssignEmployee = async function(empId, targetValue, selectElement = null) {
      if (!empId || !targetValue) return;
      const lockKey = String(empId);
      if (quickAssignInFlight.has(lockKey)) return;
      const emp = window.employees.find(e => (e.id || e.code) === empId);
      if (!emp) return;
      const previousAssignment = {
        role: emp.role,
        department: emp.department,
        position: emp.position,
        departmentNodeId: emp.departmentNodeId,
        positionNodeId: emp.positionNodeId,
        updatedAt: emp.updatedAt
      };

      quickAssignInFlight.add(lockKey);
      if (selectElement) selectElement.disabled = true;

      try {

        const selectedNodeId = targetValue.startsWith('node:') ? targetValue.slice(5) : '';
        const parts = selectedNodeId ? [] : targetValue.split('|');
        const targetDept = parts[0] || '';
        const targetPos = parts[1] || 'พนักงาน';
        const treeAssignment = selectedNodeId && typeof window.getFloraOrgAssignment === 'function'
          ? window.getFloraOrgAssignment(selectedNodeId)
          : (typeof window.resolveFloraAssignmentByLabels === 'function' ? window.resolveFloraAssignmentByLabels(targetDept, targetPos) : null);
        if (!treeAssignment) throw new Error('ไม่พบตำแหน่งนี้ใน Tree');
        if (!window.ensureFloraLeadershipPositionAvailable(empId, treeAssignment.positionNodeId || '', true)) {
          if (selectElement?.isConnected) selectElement.value = '';
          return;
        }

        emp.department = treeAssignment.department; emp.position = treeAssignment.position;
        emp.departmentNodeId = treeAssignment.departmentNodeId; emp.positionNodeId = treeAssignment.positionNodeId;
        emp.role = window.getFloraRoleForPositionNode(emp.positionNodeId, emp.positionNodeId ? emp.role : 'WORKER');
        emp.updatedAt = new Date().toISOString();

        syncToLocalStorage();

        if (window.db) {
          const docRef = doc(window.db, "employees", emp.id || emp.code);
          await setDoc(docRef, { role: emp.role, department: emp.department, position: emp.position, departmentNodeId: emp.departmentNodeId || '', positionNodeId: emp.positionNodeId || '', updatedAt: emp.updatedAt }, { merge: true });
        }

        showToast(`🎯 กำหนด [${emp.code || emp.id}] ${emp.name} ลงใน "${emp.department}" สำเร็จ!`);
        renderOrgChart();
      } catch (err) {
        Object.assign(emp, previousAssignment);
        syncToLocalStorage();
        console.warn("Quick assign sync:", err);
        showToast(`⚠️ กำหนดตำแหน่งไม่สำเร็จ: ${err.message || 'กรุณาลองใหม่'}`);
        if (selectElement?.isConnected) selectElement.value = '';
      } finally {
        quickAssignInFlight.delete(lockKey);
        if (selectElement?.isConnected) selectElement.disabled = false;
      }
    };

    window.handleCardDragEnd = function(event) {
      const card = event.currentTarget;
      if (card) card.classList.remove('dragging');
      document.querySelectorAll('.avatar-item.dragging, .unassigned-card.dragging').forEach(item => {
        item.classList.remove('dragging');
      });
      document.querySelectorAll('.drop-target-active').forEach(slot => {
        slot.classList.remove('drop-target-active');
      });
      window.draggedEmpId = null;
      setTimeout(() => {
        window.lastDraggedEmpId = null;
      }, 400);

      // หากก่อนลากเปิดแผงรอลงผังไว้ และยังมีคนรอลงผังเหลืออยู่ ให้เปิดแผงกลับคืนมาเพื่อให้ทำงานต่อได้ต่อเนื่อง
      if (window.drawerWasOpenBeforeDrag) {
        window.drawerWasOpenBeforeDrag = false;
        setTimeout(() => {
          const unassignedRemaining = (window.employees || []).filter(isUnassignedEmployee);
          if (unassignedRemaining.length > 0 && typeof openUnassignedDrawer === 'function') {
            openUnassignedDrawer();
          }
        }, 200);
      }
    };

    window.renderUnassignedDrawer = function() {
      const unassigned = (window.employees || []).filter(isUnassignedEmployee);
      const withPhoto = unassigned.filter(hasPhoto);
      const noPhoto = unassigned.filter(e => !hasPhoto(e));

      // Update Floating Trigger & Badge counts
      const floatingBtn = document.getElementById('floatingUnassignedBtn');
      const badgeFloating = document.getElementById('drawerUnassignedBadge');
      const badgeToolbar = document.getElementById('toolbarUnassignedBadge');
      const badgeTotal = document.getElementById('drawerTotalCountBadge');
      const countWithPhoto = document.getElementById('tabCountWithPhoto');
      const countNoPhoto = document.getElementById('tabCountNoPhoto');
      const countAll = document.getElementById('tabCountAll');

      if (floatingBtn) {
        if (unassigned.length === 0) {
          floatingBtn.classList.add('is-empty');
        } else {
          floatingBtn.classList.remove('is-empty');
        }
      }

      if (badgeFloating) badgeFloating.textContent = unassigned.length;
      if (badgeToolbar) badgeToolbar.textContent = unassigned.length;
      if (badgeTotal) badgeTotal.textContent = `${unassigned.length} คน`;
      if (countWithPhoto) countWithPhoto.textContent = withPhoto.length;
      if (countNoPhoto) countNoPhoto.textContent = noPhoto.length;
      if (countAll) countAll.textContent = unassigned.length;

      // Filter list based on selected Tab
      let displayList = unassigned;
      if (window.currentDrawerTab === 'with_photo') {
        displayList = withPhoto;
      } else if (window.currentDrawerTab === 'no_photo') {
        displayList = noPhoto;
      }

      // Filter list based on Search keyword
      if (window.drawerSearchKeyword) {
        const kw = window.drawerSearchKeyword.toLowerCase();
        displayList = displayList.filter(e => 
          (e.name && e.name.toLowerCase().includes(kw)) ||
          (e.code && e.code.toLowerCase().includes(kw)) ||
          (e.phone && e.phone.includes(kw)) ||
          (e.position && e.position.toLowerCase().includes(kw)) ||
          (e.department && e.department.toLowerCase().includes(kw))
        );
      }

      const countShowing = document.getElementById('drawerShowingCount');
      if (countShowing) countShowing.textContent = `${displayList.length} คน`;

      const listContainer = document.getElementById('drawerEmployeesList');
      if (!listContainer) return;

      if (unassigned.length === 0) {
        listContainer.innerHTML = `
          <div class="text-center py-5 text-muted">
            <div class="bg-success bg-opacity-10 text-success rounded-circle d-inline-flex p-3 mb-3">
              <i class="bi bi-check2-circle fs-1"></i>
            </div>
            <h6 class="fw-bold text-dark mb-1">จัดวางบุคลากรครบทั้งหมดแล้ว!</h6>
            <p class="fs-8 text-muted mb-3">ไม่มีบุคลากรที่ค้างอยู่ในสถานะรอระบุตำแหน่ง</p>
            <button type="button" class="btn btn-primary btn-sm rounded-pill px-3" onclick="openAddModal()">
              <i class="bi bi-person-plus-fill me-1"></i> เพิ่มบุคลากรใหม่
            </button>
          </div>
        `;
        return;
      }

      if (displayList.length === 0) {
        listContainer.innerHTML = `
          <div class="text-center py-5 text-muted">
            <i class="bi bi-search fs-2 text-muted mb-2 d-block"></i>
            <h6 class="fw-semibold mb-1">ไม่พบบุคลากรตามเงื่อนไข</h6>
            <p class="fs-8 text-muted">ลองเปลี่ยนแท็บ หรือล้างคำค้นหา</p>
            <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill px-3" onclick="clearDrawerSearch()">
              ล้างคำค้นหา
            </button>
          </div>
        `;
        return;
      }

      // ใช้กลุ่มและลำดับเดียวกับช่อง “ตำแหน่งงานในโครงสร้าง” ในแบบฟอร์มแก้ไขบุคลากร
      const quickAssignGroups = getPositionDropdownGroups();
      const quickAssignOptionsHtml = '<option value="">🎯 -- กำหนดตำแหน่งลงผังทันที --</option>' +
        Object.values(quickAssignGroups).filter(group => group.items.some(item => item.nodeId)).map(group => `
          <optgroup label="${escapeHtml(group.label)}">
            ${group.items.filter(item => item.nodeId).map(item => `<option value="node:${escapeHtml(item.nodeId)}">${escapeHtml(item.displayName || stripStructureCode(item.name))}</option>`).join('')}
          </optgroup>
        `).join('');

      let cardsHtml = '';
      displayList.forEach(emp => {
        const safeId = emp.id || emp.code;
        const empPhoto = hasPhoto(emp) ? (emp.photoUrl || emp.photo) : '';
        const hasPic = !!empPhoto;

        cardsHtml += `
          <div class="unassigned-card" draggable="true" ondragstart="handleAvatarDragStart(event, '${safeId}')" ondragend="handleCardDragEnd(event)">
            <div class="d-flex align-items-start gap-2.5">
              <!-- Drag Grip Handle -->
              <div class="text-muted d-flex align-items-center justify-content-center py-2" title="ลากการ์ดนี้ไปปล่อยในกล่องผังโครงสร้าง" style="cursor: grab;">
                <i class="bi bi-grip-vertical fs-5 text-secondary"></i>
              </div>

              <!-- Avatar / Photo -->
              <div class="position-relative">
                ${hasPic ? `
                  <img src="${empPhoto}" class="unassigned-card-photo" alt="${escapeHtml(emp.name)}" draggable="false" style="pointer-events: none; -webkit-user-drag: none;" onerror="this.onerror=null; this.outerHTML='<div class=\\'unassigned-card-no-photo\\'><i class=\\'bi bi-person-fill\\'></i></div>';">
                  <span class="position-absolute bottom-0 end-0 badge bg-success p-1 rounded-circle border border-white" title="มีรูปถ่าย"><i class="bi bi-check-lg" style="font-size: 8px;"></i></span>
                ` : `
                  <div class="unassigned-card-no-photo" onclick="openEditModal('${safeId}')" title="คลิกเพื่ออัปโหลดรูปภาพ" style="cursor: pointer;">
                    <i class="bi bi-person-fill"></i>
                  </div>
                  <span class="position-absolute bottom-0 end-0 badge bg-warning text-dark p-1 rounded-circle border border-white" title="ยังไม่มีรูปภาพ"><i class="bi bi-camera" style="font-size: 8px;"></i></span>
                `}
              </div>

              <!-- Info Details -->
              <div class="flex-grow-1 min-w-0">
                <div class="d-flex align-items-center justify-content-between gap-1">
                  <span class="badge bg-light text-primary border font-monospace fs-9 fw-bold px-1.5 py-0.5">${escapeHtml(emp.code || emp.id)}</span>
                  <div class="d-flex align-items-center gap-1">
                    <button type="button" class="btn btn-outline-primary btn-sm rounded-circle p-0 d-flex align-items-center justify-content-center" style="width: 24px; height: 24px;" onclick="openEditModal('${safeId}')" title="แก้ไขข้อมูล">
                      <i class="bi bi-pencil-fill" style="font-size: 10px;"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm rounded-circle p-0 d-flex align-items-center justify-content-center" style="width: 24px; height: 24px;" onclick="confirmDeleteEmployee('${safeId}', '${escapeHtml(emp.name)}')" title="ลบบุคลากร">
                      <i class="bi bi-trash-fill" style="font-size: 10px;"></i>
                    </button>
                  </div>
                </div>

                <h6 class="fw-bold text-dark mb-0 text-truncate fs-7 mt-1">${escapeHtml(emp.name)}</h6>
                <div class="text-muted fs-9 text-truncate mt-0.5">
                  <i class="bi bi-tag text-secondary me-1"></i> ${escapeHtml(stripStructureCode(emp.department || 'ยังไม่ระบุแผนก'))}
                  ${emp.phone ? `<span class="ms-1.5"><i class="bi bi-telephone text-success"></i> ${escapeHtml(emp.phone)}</span>` : ''}
                </div>

                <!-- Quick Assign Dropdown -->
                <div class="mt-2">
                  <select class="form-select fw-semibold w-100" aria-label="ตำแหน่งงานในโครงสร้าง" onchange="if(this.value) quickAssignEmployee('${safeId}', this.value, this)">
                    ${quickAssignOptionsHtml}
                  </select>
                </div>
              </div>
            </div>
          </div>
        `;
      });

      listContainer.innerHTML = cardsHtml;
    };

    // Zoom Controls & Stage Dimensions Calculator
    window.setZoom = function(newZoom, clientX, clientY) {
      const wrapper = document.getElementById('canvasWrapper');
      const prevZoom = window.currentZoom || 1.0;
      newZoom = Math.min(Math.max(newZoom, 0.35), 2.2);
      newZoom = Math.round(newZoom * 100) / 100;
      if (newZoom === prevZoom) return;

      let focusX = 0, focusY = 0;
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        focusX = (clientX !== undefined) ? (clientX - rect.left) : (wrapper.clientWidth / 2);
        focusY = (clientY !== undefined) ? (clientY - rect.top) : (wrapper.clientHeight / 2);
      }

      const contentX = wrapper ? (wrapper.scrollLeft + focusX) : 0;
      const contentY = wrapper ? (wrapper.scrollTop + focusY) : 0;

      window.currentZoom = newZoom;
      applyZoom();

      if (wrapper && prevZoom > 0) {
        const ratio = newZoom / prevZoom;
        const newScrollLeft = (contentX * ratio) - focusX;
        const newScrollTop = (contentY * ratio) - focusY;
        wrapper.scrollLeft = Math.max(0, newScrollLeft);
        wrapper.scrollTop = Math.max(0, newScrollTop);
      }
    };

    window.zoomIn = function() {
      window.setZoom((window.currentZoom || 1.0) + 0.15);
    };

    window.zoomOut = function() {
      window.setZoom((window.currentZoom || 1.0) - 0.15);
    };

    window.resetZoom = function() {
      window.currentZoom = 1.0;
      applyZoom();
      setTimeout(() => {
        const wrapper = document.getElementById('canvasWrapper');
        const stage = document.getElementById('zoomStage');
        if (wrapper && stage) {
          wrapper.scrollLeft = Math.max(0, (stage.scrollWidth - wrapper.clientWidth) / 2);
          wrapper.scrollTop = 0;
        }
      }, 40);
    };

    window.fitToWidth = function() {
      const wrapper = document.getElementById('canvasWrapper');
      if (!wrapper) return;
      const wrapperWidth = wrapper.clientWidth || window.innerWidth;
      const targetWidth = 1580; // Poster width + safe padding
      const calculatedZoom = Math.min(Math.max((wrapperWidth - 60) / targetWidth, 0.4), 1.25);
      window.currentZoom = Math.round(calculatedZoom * 100) / 100;
      applyZoom();
      setTimeout(() => {
        const stage = document.getElementById('zoomStage');
        if (stage && wrapper) {
          wrapper.scrollLeft = Math.max(0, (stage.scrollWidth - wrapper.clientWidth) / 2);
          wrapper.scrollTop = 0;
        }
      }, 40);
    };

    function applyZoom() {
      const layer = document.getElementById('zoomLayer');
      const stage = document.getElementById('zoomStage');
      const wrapper = document.getElementById('canvasWrapper');
      const text = document.getElementById('zoomPercentText');
      if (!layer) return;

      const poster = document.querySelector('.chart-poster') || document.getElementById('chartContent');
      const baseWidth = (poster && poster.offsetWidth > 600) ? poster.offsetWidth : 1540;
      const baseHeight = (poster && poster.offsetHeight > 300) ? poster.offsetHeight : 1100;

      const scaledW = baseWidth * window.currentZoom;
      const scaledH = baseHeight * window.currentZoom;

      if (stage) {
        const minStageWidth = Math.max(scaledW + 100, wrapper ? wrapper.clientWidth : 0);
        stage.style.width = `${minStageWidth}px`;
        stage.style.minWidth = `${minStageWidth}px`;
        stage.style.height = `${scaledH + 120}px`;
      }

      layer.style.transform = `scale(${window.currentZoom})`;

      if (text) {
        text.textContent = `${Math.round(window.currentZoom * 100)}%`;
      }
    }

    // Interactive Drag-to-Pan (Grab Canvas) & Touch Support
    function setupPanAndGesture() {
      const wrapper = document.getElementById('canvasWrapper');
      if (!wrapper) return;

      let isDown = false;
      let startX = 0, startY = 0;
      let scrollLeft = 0, scrollTop = 0;

      wrapper.addEventListener('mousedown', (e) => {
        // Ignore dragging if clicking interactive components
        if (e.target.closest('button, input, select, textarea, a, .avatar-item, .exec-box, .section-head-box, .team-leader-slot, #empContextMenu, #orgNodeActionMenu, .node-card-btn, .modal, .dropdown-menu')) {
          return;
        }
        isDown = true;
        wrapper.classList.add('is-panning');
        startX = e.pageX - wrapper.offsetLeft;
        startY = e.pageY - wrapper.offsetTop;
        scrollLeft = wrapper.scrollLeft;
        scrollTop = wrapper.scrollTop;
      });

      window.addEventListener('mouseup', () => {
        if (isDown) {
          isDown = false;
          wrapper.classList.remove('is-panning');
        }
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - wrapper.offsetLeft;
        const y = e.pageY - wrapper.offsetTop;
        const walkX = (x - startX);
        const walkY = (y - startY);
        wrapper.scrollLeft = scrollLeft - walkX;
        wrapper.scrollTop = scrollTop - walkY;
      });

      // Mouse Wheel Zoom (Ctrl + Wheel or Cmd + Wheel)
      wrapper.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.1 : -0.1;
          window.setZoom(window.currentZoom + delta, e.clientX, e.clientY);
        }
      }, { passive: false });

      // Touch Pinch-to-Zoom & Pan
      let initialPinchDist = null;
      let initialPinchZoom = 1.0;

      wrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          initialPinchDist = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
          );
          initialPinchZoom = window.currentZoom;
        }
      }, { passive: true });

      wrapper.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDist) {
          const currentDist = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
          );
          const pinchRatio = currentDist / initialPinchDist;
          const targetZoom = initialPinchZoom * pinchRatio;
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          window.setZoom(targetZoom, midX, midY);
        }
      }, { passive: true });

      wrapper.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
          initialPinchDist = null;
        }
      }, { passive: true });
    }

    // ==================== EXPORT TO PDF & HD PNG ====================
    window.downloadPosterPDF = async function() {
      const btn = document.getElementById('btnDownloadPdf');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> กำลังสร้าง PDF...';
      showToast("⏳ กำลังแปลงผังองค์กรเป็นไฟล์ PDF คุณภาพสูง...");

      try {
        const posterEl = document.getElementById('chartPosterArea');
        if (!posterEl) {
          throw new Error("ไม่พบพื้นที่ผังสำหรับ Export");
        }

        // Temporarily reset transform for clean render
        const zoomLayer = document.getElementById('zoomLayer');
        const oldTransform = zoomLayer.style.transform;
        zoomLayer.style.transform = 'none';

        const canvas = await html2canvas(posterEl, {
          scale: 2, // High resolution (300 DPI equivalent)
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#fbfbf8',
          logging: false
        });

        zoomLayer.style.transform = oldTransform;

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const { jsPDF } = window.jspdf;
        
        // Create Landscape A3 PDF
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a3'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = imgWidth / imgHeight;

        let renderWidth = pdfWidth - 20;
        let renderHeight = renderWidth / ratio;

        if (renderHeight > (pdfHeight - 20)) {
          renderHeight = pdfHeight - 20;
          renderWidth = renderHeight * ratio;
        }

        const posX = (pdfWidth - renderWidth) / 2;
        const posY = (pdfHeight - renderHeight) / 2;

        pdf.addImage(imgData, 'JPEG', posX, posY, renderWidth, renderHeight);
        pdf.save('ผังโครงสร้างบุคลากร_โครงการรัตนบุปผา.pdf');

        showToast("✅ ดาวน์โหลดไฟล์ PDF เรียบร้อยแล้ว!");
      } catch (err) {
        console.error("PDF Export Error:", err);
        showToast("⚠️ ไม่สามารถสร้าง PDF ได้: " + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    };

    window.downloadPosterPNG = async function() {
      const btn = document.getElementById('btnDownloadPng');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> กำลังสร้างภาพ HD...';
      showToast("⏳ กำลังสร้างรูปภาพความละเอียดสูง (HD PNG)...");

      try {
        const posterEl = document.getElementById('chartPosterArea');
        if (!posterEl) {
          throw new Error("ไม่พบพื้นที่ผังสำหรับ Export");
        }

        const zoomLayer = document.getElementById('zoomLayer');
        const oldTransform = zoomLayer.style.transform;
        zoomLayer.style.transform = 'none';

        const canvas = await html2canvas(posterEl, {
          scale: 2.5, // Ultra-high resolution
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#fbfbf8',
          logging: false
        });

        zoomLayer.style.transform = oldTransform;

        const link = document.createElement('a');
        link.download = 'ผังโครงสร้างบุคลากร_HD.png';
        link.href = canvas.toDataURL('image/png');
        link.click();

        showToast("✅ บันทึกรูปภาพ HD (PNG) เรียบร้อยแล้ว!");
      } catch (err) {
        console.error("PNG Export Error:", err);
        showToast("⚠️ ไม่สามารถสร้างภาพได้: " + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    };

    // Toast Alert Helper
    function showToast(msg) {
      const container = document.getElementById('orgToastContainer');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = 'toast align-items-center text-white bg-dark border-0 show shadow-lg mb-2';
      toast.style.borderRadius = '12px';
      toast.setAttribute('role', 'alert');
      toast.innerHTML = `
        <div class="d-flex">
          <div class="toast-body py-2.5 px-3 fs-7 fw-semibold">
            <i class="bi bi-info-circle-fill text-warning me-2"></i> ${msg}
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      `;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }
    window.showToast = showToast;

    // Go Back / Close Tab
    window.handleGoBackToMain = function() {
      window.close();
      setTimeout(() => {
        if (window.opener) {
          try { window.opener.focus(); } catch (e) {}
        }
        window.location.href = 'index.html';
      }, 100);
    };

    // Initialize on load
    window.addEventListener('flora-org-tree-changed', () => {
      window.orgTreeVersion = (window.orgTreeVersion || 0) + 1;
      if (typeof window.syncFloraEmployeesToTree === 'function') window.syncFloraEmployeesToTree(false);
      updatePositionDropdownOptions(); updateDepartmentDropdownOptions();
      window.markOrgChartDirty?.();
    });

    window.addEventListener('flora-project-title-changed', () => {
      window.orgTreeVersion = (window.orgTreeVersion || 0) + 1;
      window.markOrgChartDirty?.();
    });

    window.addEventListener('flora-project-note-changed', () => {
      window.orgTreeVersion = (window.orgTreeVersion || 0) + 1;
      window.markOrgChartDirty?.();
    });

    // ==================== TOGGLE ORG TOOLBAR (ซ่อน / แสดง แถบเครื่องมือผัง) ====================
    window.isOrgToolbarVisible = true;

    window.toggleOrgToolbar = function(forceState) {
      const toolbar = document.getElementById('orgToolbar');
      const topBtnText = document.getElementById('btnToggleOrgToolbarText');
      const topBtnIcon = document.getElementById('btnToggleOrgToolbarIcon');
      const topBtn = document.getElementById('btnToggleOrgToolbar');
      const floatBtnIcon = document.getElementById('btnFloatingToggleToolbarIcon');
      const floatBtn = document.getElementById('btnFloatingToggleToolbar');

      if (typeof forceState === 'boolean') {
        window.isOrgToolbarVisible = forceState;
      } else {
        window.isOrgToolbarVisible = !window.isOrgToolbarVisible;
      }

      if (toolbar) {
        if (window.isOrgToolbarVisible) {
          toolbar.classList.remove('d-none');
          toolbar.style.display = 'flex';
        } else {
          toolbar.classList.add('d-none');
          toolbar.style.display = 'none';
        }
      }

      if (topBtnText) {
        topBtnText.textContent = window.isOrgToolbarVisible ? 'ซ่อนเมนู' : 'แสดงเมนู';
      }
      if (topBtnIcon) {
        topBtnIcon.className = window.isOrgToolbarVisible ? 'bi bi-eye-slash-fill text-warning' : 'bi bi-eye-fill text-warning';
      }
      if (topBtn) {
        topBtn.title = window.isOrgToolbarVisible ? 'คลิกเพื่อซ่อนแถบเครื่องมือค้นหาและเมนูผังองค์กร' : 'คลิกเพื่อแสดงแถบเครื่องมือค้นหาและเมนูผังองค์กร';
        topBtn.classList.toggle('btn-primary', !window.isOrgToolbarVisible);
        topBtn.classList.toggle('btn-outline-light', window.isOrgToolbarVisible);
      }
      if (floatBtnIcon) {
        floatBtnIcon.className = window.isOrgToolbarVisible ? 'bi bi-eye-slash-fill' : 'bi bi-eye-fill';
      }
      if (floatBtn) {
        floatBtn.title = window.isOrgToolbarVisible ? 'ซ่อนเมนูผัง' : 'แสดงเมนูผัง';
        floatBtn.classList.toggle('text-warning', !window.isOrgToolbarVisible);
        floatBtn.classList.toggle('text-primary', window.isOrgToolbarVisible);
      }

      try {
        localStorage.setItem('flora_org_toolbar_visible', window.isOrgToolbarVisible ? '1' : '0');
      } catch (e) {}

      // Re-trigger zoom calculation & layout adjust
      setTimeout(() => {
        if (typeof applyZoom === 'function') applyZoom();
      }, 50);
    };

    window.addEventListener('DOMContentLoaded', () => {
      // Default is expanded/shown (true), unless user toggled previously
      let savedToolbarPref = null;
      try {
        savedToolbarPref = localStorage.getItem('flora_org_toolbar_visible');
      } catch (e) {}
      
      // Default is always visible
      const initialVisible = savedToolbarPref !== null ? savedToolbarPref === '1' : true;
      toggleOrgToolbar(initialVisible);

      updatePositionDropdownOptions(); updateDepartmentDropdownOptions();
      initFirebase();
      setupPanAndGesture();
      setTimeout(fitToWidth, 300);
      setTimeout(() => {
        if (typeof window.renderPersonnelDirectory !== 'function') {
          const root = document.getElementById('personnelDirectoryRoot');
          if (root) root.innerHTML = '<div class="container py-5"><div class="alert alert-danger text-center"><b>โหลดหน้าสารบบบุคลากรไม่สำเร็จ</b><br><small>กรุณารีเฟรชหน้าเว็บอีกครั้ง หากยังพบอาการเดิมให้ติดตั้งไฟล์โปรเจ็กต์ฉบับล่าสุด</small></div></div>';
        }
      }, 1500);
    });

    window.addEventListener('resize', () => {
      applyZoom();
    });
