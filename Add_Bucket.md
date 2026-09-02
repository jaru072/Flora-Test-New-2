# 🚀 แม่แบบคำสั่ง (Prompt Template): สำหรับย้ายหรือเพิ่ม Firebase Storage Bucket ใหม่ & Image Migration

> **วัตถุประสงค์:** ใช้ส่งให้ AI เพื่ออัปเดตการตั้งค่าโปรเจกต์ให้เชื่อมต่อไปยัง Firebase Storage Bucket ใหม่ พร้อมทั้งมีระบบคัดลอกรูปภาพทั้งหมด (รูปพัสดุ/อุปกรณ์ และรูปบุคลากร) จาก Bucket เดิมไปยัง Bucket ใหม่ และอัปเดต URL ใน Firestore อัตโนมัติ โดยไม่กระทบข้อมูลเดิม

---

## 📝 ข้อความ Prompt สำหรับคัดลอกไปใช้งาน (Copy & Paste)

```markdown
รบกวนช่วยอัปเดตการตั้งค่า Firebase Storage Bucket ของโปรเจกต์นี้ และช่วยคัดลอกรูปภาพเดิมทั้งหมดมาไว้ใน Bucket ใหม่ตามขั้นตอนดังนี้ครับ:

### 1. การตั้งค่า Database และ Storage Bucket ใหม่
- กำหนด Database ID ของโปรเจกต์นี้เป็น: `[ระบุ_DATABASE_ID_ปลายทาง เช่น ai-studio-floragardenv2-xxx]`
- เปลี่ยน Storage Bucket ไปใช้ Bucket ใหม่: `[ระบุ_ชื่อ_BUCKET_ใหม่ เช่น pai-meditation หรือ pai-meditation.firebasestorage.app]` (gs://`[ระบุ_ชื่อ_BUCKET_ใหม่]`)
- อัปเดตการตั้งค่า `storageBucket` และ `databaseId` ในทุกไฟล์ที่เกี่ยวข้องให้ถูกต้องตรงกันทั้งหมด:
  - `firebase-applet-config.json`
  - `script.js`
  - `backup_restore.js`
  - `server.ts`
  - `index.html` และ `org_chart.html`

### 2. ระบบคัดลอกรูปภาพเดิม (Image Migration / Copy Assets)
- สร้าง/ตรวจสอบระบบ **Server-side Image Migration (`/api/migrate-image`)** บน `server.ts` เพื่อดาวน์โหลดรูปภาพจาก URL เดิม และอัปโหลดเข้า Storage Bucket ใหม่โดยตรง เพื่อป้องกันปัญหา CORS และทำงานได้อย่างรวดเร็ว
- เพิ่มปุ่มคำสั่งหรือฟังก์ชันสำหรับการกดย้ายรูปภาพทั้งหมด (รูปอุปกรณ์/พัสดุ และรูปถ่ายบุคลากร)
- เมื่อคัดลอกรูปภาพสำเร็จ ให้อัปเดต URL รูปภาพใหม่กลับเข้าไปในเอกสาร Firestore ของแต่ละรายการให้อัตโนมัติ (100% Fully Migrated)
- **การันตีความปลอดภัย:** รูปภาพและไฟล์ทั้งหมดใน Storage Bucket เดิมจะต้องคงอยู่ ไม่ถูกลบหรือได้รับผลกระทบใดๆ ทั้งสิ้น

### 3. การตรวจสอบและทดสอบระบบ (Verification)
- ตรวจสอบว่ารูปภาพใหม่แสดงผลได้อย่างถูกต้อง ไม่มีปัญหา 404 หรือ Access Denied
- รัน `compile_applet` เพื่อให้มั่นใจว่าโค้ดคอมไพล์ผ่านสมบูรณ์ 100% ไม่มีข้อผิดพลาด
```

---

## 📌 สรุปจุดสำคัญทางเทคนิคที่ระบบต้องรองรับ (Technical Highlights)

1. **การระบุชื่อ Bucket ให้ตรงกับ Google Cloud Storage:**
   - หากระบุแบบมีโดเมนแล้วติด `404 Not Found` ให้กำหนดเป็นชื่อ Bucket โดยตรง (เช่น `pai-meditation` หรือตามค่าจริงใน GCS)
   - อัปเดต `firebase-applet-config.json` และโค้ด Client/Server ให้เชื่อมโยงเป็น Bucket เดียวกัน

2. **การป้องกัน CORS ด้วย Server-side Proxy (`/api/migrate-image`):**
   - การดึงรูปภาพข้ามโดเมนบนฝั่ง Client อาจติดข้อจำกัด CORS Browser Security
   - การประมวลผลผ่าน Route ฝั่งเซิร์ฟเวอร์จะช่วยให้ Stream ไฟล์ภาพและอัปโหลดขึ้น Bucket ใหม่ได้ราบรื่น

3. **ความต่อเนื่องของข้อมูล (Zero-Downtime & Data Safety):**
   - อ่านรายการเอกสารจากคอลเลกชันใน Firestore (เช่น อุปกรณ์ และ บุคลากร)
   - อัปโหลดไฟล์ขึ้นโฟลเดอร์ใหม่ (เช่น `equipment/` และ `personnel/`)
   - นำ Public/Download URL ที่ได้มาบันทึกทับฟิลด์ URL ใน Firestore เดิม
