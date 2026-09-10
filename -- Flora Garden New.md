📋 สรุปสิ่งที่เก็บไว้ในโปรเจกต์หลัก(Flora Garden New) 

รบกวนช่วยตรวจสอบและตั้งค่าตามนี้: 
1. ตรวจสอบไฟล์ firebase-applet-config.json Database ID คือ ai-studio-floragardennew-077d9b3a-d839-404a-986e-0ab7c5c9be6e 
   ถ้าไม่ใช่ให้ยกเลิกการแก้ไข ถ้าใช่ให้ตรวจสอบไฟล์ด้านล่างนี้ต่อและแก้ไข
   script.js, org_chart.html, payroll_system.js, job_application.js ให้เชื่อมต่อกับ Database ID ของโปรเจกต์นี้ คือ:
   👉 ai-studio-floragardennew-077d9b3a-d839-404a-986e-0ab7c5c9be6e 

2. ทำการ compile_applet ให้เรียบร้อย

*** หมายเหตุ Flora Garden New , Flora Garden V.2 , Flora Test New 2 
    ทั้งหมด ใช้ Bucket เดิม: flora-gaden.firebasestorage.app ร่วมกัน
    แต่ Flora Garden New ใช้ Firebase Firestore ต่างจากทั้ง 2

---- สำหรับโปรเจ็กต์ที่ Add Bucket ใหม่ หรือ ไม่ใช่ Bucket เดิมต้นฉบับ----

4. รบกวนช่วยอัปเดตการตั้งค่า Firebase Storage Bucket ของโปรเจกต์นี้ และช่วย คัดลอกรูปภาพเดิมทั้งหมดมาไว้ใน Bucket ใหม่ ดังนี้ครับ:
  การตั้งค่า Storage Bucket ใหม่:
  เปลี่ยนไปใช้ Bucket ใหม่: pai-meditation.firebasestorage.app ตามชื่อ Bucket gs://pai-meditation
  อัปเดตใน firebase-applet-config.json, script.js และ backup_restore.js
  การคัดลอกรูปภาพเดิม (Image Migration / Copy Assets):
  สร้างฟังก์ชันหรือปุ่มคำสั่งสำหรับ คัดลอกรูปภาพทั้งหมด (รูปอุปกรณ์ และรูปพนักงาน) ที่กำลังใช้งานอยู่ในฐานข้อมูลปัจจุบัน โดยดาวน์โหลดจาก URL เดิมใน Bucket เก่า แล้วนำไปอัปโหลดขึ้น Bucket ใหม่ (pai-meditation)
  อัปเดต URL รูปภาพใหม่กลับเข้าไปในเอกสาร Firestore ของแต่ละรายการให้อัตโนมัติ เพื่อให้รูปภาพทั้งหมดกลายเป็นของ Bucket ใหม่อย่างสมบูรณ์ 100%
  ยืนยันว่ารูปภาพทั้งหมดใน Bucket เดิมจะไม่ถูกลบหรือได้รับผลกระทบใดๆ ทั้งสิ้น

  สาเหตุ: ชื่อ Bucket จริงในระบบ Google Cloud Storage / Firebase ของโปรเจกต์คือ pai-meditation (หรือ gs://pai-meditation) ซึ่งเมื่อระบุเป็น pai-meditation.firebasestorage.app ทำให้ Firebase API ส่งสถานะ 404 Not Found กลับมาและทำให้กระบวนการรอเชื่อมต่อไปเรื่อยๆ
    การแก้ไข:
  อัปเดตการตั้งค่า storageBucket ในทุกไฟล์ (firebase-applet-config.json, script.js, backup_restore.js, server.ts) ให้ชี้ตรงไปยัง Bucket pai-meditation
  เพิ่มระบบ Direct Server-side Image Migration (/api/migrate-image) ที่ช่วยดาวน์โหลดและอัปโหลดรูปภาพเข้าสู่ Storage Bucket ใหม่ได้โดยตรงโดยไม่ติดปัญหา CORS และประมวลผลได้อย่างรวดเร็ว

*** หมายเหตุ Flora Garden Test กับ Flora Test New 1 ใช้ฐานข้อมูล Firebase Firestore ร่วมกัน
    และทั้งคู่ เปลี่ยนไปใช้ Bucket ใหม่: pai-meditation.firebasestorage.app