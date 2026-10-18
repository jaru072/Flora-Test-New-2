import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, initializeFirestore, collection, getDocs, getDoc, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

fetch('/firebase-applet-config.json')
  .then(res => res.json())
  .then((config) => {
    window.firebaseConfig = config;
    window.floraFirebaseConfig = config;
    const app = initializeApp(config);

    const fsSettings = { experimentalForceLongPolling: true, useFetchStreams: false };
    const dbId = (config.firestoreDatabaseId && config.firestoreDatabaseId !== "(default)")
      ? config.firestoreDatabaseId
      : undefined;

    try {
      window.db = dbId ? initializeFirestore(app, fsSettings, dbId) : initializeFirestore(app, fsSettings);
    } catch (eFs) {
      console.warn("Procurement firestore init warning:", eFs);
      window.db = dbId ? getFirestore(app, dbId) : getFirestore(app);
    }

    window.auth = getAuth(app);

    window.floraFirebaseBridge = {
      db: window.db,
      auth: window.auth,
      collection,
      getDocs,
      doc,
      setDoc,
      addDoc,
      updateDoc,
      deleteDoc,
      onSnapshot,
      query,
      orderBy
    };

    if (typeof window.connectGlobalLogoFirestore === 'function') {
      window.connectGlobalLogoFirestore(window.floraFirebaseBridge);
    }
    if (typeof window.connectOrgTreeFirestore === 'function') {
      window.connectOrgTreeFirestore(window.floraFirebaseBridge);
    }
    if (typeof window.updateAllFloraTitles === 'function') {
      window.updateAllFloraTitles();
    }

    onAuthStateChanged(window.auth, async (user) => {
      let canManage = false;
      if (user) {
        let userProfile = null;
        const isSuperOwner = (user.email === 'jaru072@gmail.com');
        try {
          if (window.db) {
            const uSnap = await getDoc(doc(window.db, 'users', user.uid));
            if (uSnap.exists()) {
              userProfile = uSnap.data();
            }
          }
        } catch (e) {
          console.warn('Procurement user profile fetch notice:', e);
        }
        if (isSuperOwner || userProfile?.role === 'ADMIN' || userProfile?.role === 'MANAGER' || userProfile?.accessProcurement === true) {
          canManage = true;
        }

        window.currentUserProfile = userProfile;
        window.currentUserRole = isSuperOwner ? 'ADMIN' : (userProfile?.role || 'WORKER');
        window.currentUserCanManageProcurement = canManage;

        const roleEl = document.getElementById('currentRoleText');
        if (roleEl) {
          const roleTitle = canManage ? (isSuperOwner || userProfile?.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'ฝ่ายจัดซื้อ/บริหาร') : 'ผู้ใช้งาน (ดูรายการ)';
          roleEl.textContent = `${user.displayName || user.email?.split('@')[0] || 'ผู้ใช้งาน'} (${roleTitle})`;
        }
        const avatarEl = document.getElementById('navUserAvatar');
        if (avatarEl && (user.photoURL || userProfile?.photoURL)) {
          avatarEl.src = user.photoURL || userProfile?.photoURL;
        }
      } else {
        window.currentUserProfile = null;
        window.currentUserRole = 'WORKER';
        window.currentUserCanManageProcurement = false;
      }

      if (window.procurementModule?.updateAuthPermissions) {
        window.procurementModule.updateAuthPermissions(canManage);
      }
      if (window.procurementModule?.init) {
        window.procurementModule.init();
      }
    });

    // Initialize immediately if procurementModule is loaded
    if (window.procurementModule?.init) {
      window.procurementModule.init();
    }
  })
  .catch(err => console.error('Firebase config load error in procurement:', err));

window.handleSignOut = function() {
  if (window.auth) {
    signOut(window.auth).then(() => {
      window.location.href = 'index.html';
    });
  }
};
