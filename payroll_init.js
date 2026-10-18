import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, initializeFirestore, doc, onSnapshot, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

fetch('/firebase-applet-config.json')
  .then(res => res.json())
  .then(config => {
    window.firebaseConfig = config;
    window.floraFirebaseConfig = config;
    const app = initializeApp(config);
    const dbId = (config.firestoreDatabaseId && config.firestoreDatabaseId !== "(default)") ? config.firestoreDatabaseId : undefined;
    const fsSettings = { experimentalForceLongPolling: true, useFetchStreams: false };
    try {
      window.db = dbId ? initializeFirestore(app, fsSettings, dbId) : initializeFirestore(app, fsSettings);
    } catch (eFs) {
      window.db = dbId ? getFirestore(app, dbId) : getFirestore(app);
    }
    window.auth = getAuth(app);
    
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
    if (typeof window.connectOrgTreeFirestore === 'function') {
      window.connectOrgTreeFirestore(window.floraFirebaseBridge);
    }
    if (typeof window.updateAllFloraTitles === 'function') {
      window.updateAllFloraTitles();
    }

    onAuthStateChanged(window.auth, (user) => {
      if (user) {
        window.currentUserRole = 'ADMIN';
        const roleEl = document.getElementById('currentRoleText');
        if (roleEl) roleEl.textContent = user.displayName || user.email?.split('@')[0] || 'Admin';
        const avatarEl = document.getElementById('navUserAvatar');
        if (avatarEl && user.photoURL) avatarEl.src = user.photoURL;
      }
      if (window.payrollModule?.loadPayrollPeriods) {
        window.payrollModule.loadPayrollPeriods();
      }
    });
  })
  .catch(err => console.error('Firebase config load error in payroll:', err));

window.handleSignOut = function() {
  if (window.auth) {
    signOut(window.auth).then(() => {
      window.location.href = 'index.html';
    });
  }
};
