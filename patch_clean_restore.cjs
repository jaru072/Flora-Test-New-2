const fs = require('fs');

let br = fs.readFileSync('backup_restore.js', 'utf8');

// 1. Replace replaceCollectionInFirestore to do a clean overwrite (delete old docs, write new without leftover fields)
const oldReplaceFn = `async function replaceCollectionInFirestore(collName, newList) {
  if (!window.db || !window.isFirebaseReady) return;
  try {
    const snap = await getDocs(collection(window.db, collName));
    const newIds = new Set((newList || []).map(x => x && x.id).filter(Boolean));
    const newImageUrls = new Set((newList || []).map(x => x && (x.imageUrl || x.photoUrl)).filter(Boolean));

    for (const docSnap of snap.docs) {
      if (!newIds.has(docSnap.id)) {
        await deleteDoc(doc(window.db, collName, docSnap.id));
      }
    }

    for (const item of (newList || [])) {
      if (item && item.id) {
        await setDoc(doc(window.db, collName, item.id), item);
      }
    }
  } catch (err) {
    console.warn(\`Error replacing Firestore collection \${collName}:\`, err);
  }
}`;

const newReplaceFn = `async function replaceCollectionInFirestore(collName, newList) {
  if (!window.db || !window.isFirebaseReady) return;
  try {
    const snap = await getDocs(collection(window.db, collName));
    const newIds = new Set((newList || []).map(x => x && (x.id || x.code)).filter(Boolean));

    // ลบเอกสารเดิมที่ไม่มีอยู่ในชุดข้อมูลที่กำลังจะกู้คืน
    for (const docSnap of snap.docs) {
      if (!newIds.has(docSnap.id)) {
        await deleteDoc(doc(window.db, collName, docSnap.id));
      }
    }

    // เขียนทับเอกสารใหม่แบบ Clean Overwrite (ไม่ merge เพื่อล้างฟิลด์ส่วนเกินที่ไม่มีในจุดกู้คืน เช่น ตำแหน่งควบ)
    for (const item of (newList || [])) {
      if (item && (item.id || item.code)) {
        const docId = String(item.id || item.code);
        // แปลงเป็น plain object และลบค่า undefined
        const cleanItem = JSON.parse(JSON.stringify(item));
        await setDoc(doc(window.db, collName, docId), cleanItem, { merge: false });
      }
    }
  } catch (err) {
    console.warn(\`Error replacing Firestore collection \${collName}:\`, err);
  }
}`;

if (!br.includes(oldReplaceFn)) {
  console.error("oldReplaceFn not found");
  process.exit(1);
}
br = br.replace(oldReplaceFn, newReplaceFn);
console.log("1. Replaced replaceCollectionInFirestore with non-merging clean overwrite");

// 2. In restoreCloudSnapshot: also update localStorage with scoped keys so org_chart and inventory sync immediately
const oldStorageRestore = `    if (Array.isArray(data.employees)) {
      await replaceCollectionInFirestore("employees", data.employees);
      window.employeeList = data.employees;
      localStorage.setItem('flora_employees', JSON.stringify(data.employees));
    }`;

const newStorageRestore = `    if (Array.isArray(data.employees)) {
      await replaceCollectionInFirestore("employees", data.employees);
      window.employeeList = data.employees;
      window.employees = data.employees;
      localStorage.setItem('flora_employees', JSON.stringify(data.employees));
      // ล้าง scoped keys ของบุคลากร เพื่อไม่ให้ข้อมูลเก่าในแคชเบราว์เซอร์นำกลับมาทับ
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('flora_employees')) {
            localStorage.setItem(k, JSON.stringify(data.employees));
          }
        }
      } catch (e) {}
    }`;

if (!br.includes(oldStorageRestore)) {
  console.error("oldStorageRestore not found");
  process.exit(1);
}
br = br.replace(oldStorageRestore, newStorageRestore);
console.log("2. Updated localStorage caching during cloud restore");

fs.writeFileSync('backup_restore.js', br, 'utf8');
console.log("Successfully patched backup_restore.js for pristine clean restore!");
