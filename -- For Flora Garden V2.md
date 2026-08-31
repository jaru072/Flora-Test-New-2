📋 สรุปสิ่งที่เก็บไว้ในโปรเจกต์หลัก(Flora Garden V.2) เก็บไว้หมด  
แต่ต้องลบโค้ดของ Flora Garden Test ที่จะ copy มาแทนที่ 4 ไฟล์ข่างล่างนี้

✅ firebase-applet-config.json
✅ script.js
✅ org_chart.html
✅ index.html

รบกวนช่วยตรวจสอบและตั้งค่าตามนี้: (ตรวจสอบแล้วไม่ต้องเก็บ 4 ไฟล์ข้างบนก็ได้)
1. ตรวจสอบไฟล์ firebase-applet-config.json,script.js,org_chart.html,index.html ให้เชื่อมต่อกับ Database ID ของโปรเจกต์นี้ คือ:
   👉 ai-studio-floragardenv2-c509b5a5-f4a3-4546-bbae-c5f21564ba7d

2. ปรับปุ่ม "ดึงข้อมูล" ในหน้าสำรองข้อมูล ให้ดึงต้นทางมาจาก Test คือ Database ID:
   👉 ai-studio-floragardentest-b067b23c-205a-446d-8774-e8804286e5e1

3. ทำการ compile_applet ให้เรียบร้อย

4. สำหรับโปรเจ็กต์ที่ Add Bucket ใหม่
รบกวนช่วยอัปเดตการตั้งค่า Firebase Storage Bucket ของโปรเจกต์นี้ และช่วย คัดลอกรูปภาพเดิมทั้งหมดมาไว้ใน Bucket ใหม่ ดังนี้ครับ:
การตั้งค่า Storage Bucket ใหม่:
เปลี่ยนไปใช้ Bucket ใหม่: pai-meditation.appspot.com (หรือ pai-meditation.firebasestorage.app ตามชื่อ Bucket gs://pai-meditation)
อัปเดตใน firebase-applet-config.json, script.js และ backup_restore.js
การคัดลอกรูปภาพเดิม (Image Migration / Copy Assets):
สร้างฟังก์ชันหรือปุ่มคำสั่งสำหรับ คัดลอกรูปภาพทั้งหมด (รูปอุปกรณ์ และรูปพนักงาน) ที่กำลังใช้งานอยู่ในฐานข้อมูลปัจจุบัน โดยดาวน์โหลดจาก URL เดิมใน Bucket เก่า แล้วนำไปอัปโหลดขึ้น Bucket ใหม่ (pai-meditation)
อัปเดต URL รูปภาพใหม่กลับเข้าไปในเอกสาร Firestore ของแต่ละรายการให้อัตโนมัติ เพื่อให้รูปภาพทั้งหมดกลายเป็นของ Bucket ใหม่อย่างสมบูรณ์ 100%
ยืนยันว่ารูปภาพทั้งหมดใน Bucket เดิมจะไม่ถูกลบหรือได้รับผลกระทบใดๆ ทั้งสิ้น

   แก้ไขปัญหาการคัดลอกรูปภาพค้างที่ 6%
   สาเหตุ: ชื่อ Bucket จริงในระบบ Google Cloud Storage / Firebase ของโปรเจกต์คือ pai-meditation (หรือ gs://pai-meditation) ซึ่งเมื่อระบุเป็น pai-meditation.firebasestorage.app ทำให้ Firebase API ส่งสถานะ 404 Not Found กลับมาและทำให้กระบวนการรอเชื่อมต่อไปเรื่อยๆ
   การแก้ไข:
   อัปเดตการตั้งค่า storageBucket ในทุกไฟล์ (firebase-applet-config.json, script.js, backup_restore.js, server.ts) ให้ชี้ตรงไปยัง Bucket pai-meditation
   เพิ่มระบบ Direct Server-side Image Migration (/api/migrate-image) ที่ช่วยดาวน์โหลดและอัปโหลดรูปภาพเข้าสู่ Storage Bucket ใหม่ได้โดยตรงโดยไม่ติดปัญหา CORS และประมวลผลได้อย่างรวดเร็ว


