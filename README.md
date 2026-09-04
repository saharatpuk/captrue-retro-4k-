# Captrue Retro 4K - Cyber Terminal Screen Recorder

Chrome Extension สำหรับบันทึกหน้าจอความละเอียดสูงระดับ **4K (3840 x 2160)** ดีไซน์ธีม **Vintage Cinema + Hacker Green / Black** พร้อมระบบบันทึกเสียงคู่ (Mic + System) และแดชบอร์ด **Cyber Vault** แบบ Local 100%

---

## สไตล์และธีมใหม่ (Theme & Styling)
- **ไอคอนโลโก้:** กล้องภาพยนตร์วินเทจคลาสสิก (Vintage Movie Camera) พร้อมม้วนฟิล์มคู่แบบเดียวกับ Flaticon ที่เลือกมา
- **โทนสี:** เขียวแฮกเกอร์ / เทอร์มินัล (Neon Matrix & Laser Green) บนพื้นหลังดำสนิท (Carbon Black) เสริมด้วยลูกเล่น Scanlines สไตล์ CRT Screen
- **ความเป็นส่วนตัว:** Local 100% ทำงานในเครื่อง ไม่ส่งข้อมูลหรือวิดีโอออกไปข้างนอกแม้แต่บิตเดียว
1. **การบันทึกหน้าจอ (Screen Recording):**
   - รองรับ **Entire Screen (Desktop)**, **Window**, และ **Chrome Tab**
   - ปรับความละเอียดได้ 3 ระดับ: **4K (3840 x 2160)**, **2K (2560 x 1440)**, **1080p (Full HD)**
   - บิตเรตสูงพิเศษถึง **40 Mbps** สำหรับ 4K (ภาพคมชัด ไม่แตกเบลอ)
2. **ระบบเสียง (Dual Audio Recording):**
   - **Microphone:** บันทึกเสียงพูดผ่านไมค์
   - **System Audio:** บันทึกเสียงระบบ/เสียงคลิปในคอมพิวเตอร์
   - รวมสัญญาณเสียงทั้งสองเข้าด้วยกันด้วย Web Audio API แบบเรียลไทม์
3. **Local My Items Dashboard:**
   - หน้ารวมคลิปสไตล์ Awesome Screenshot (`items.html`)
   - แสดงรายการคลิปพร้อม Thumbnail, ความยาว, ขนาดไฟล์, และวันที่
   - เล่นวิดีโอในตัว (Built-in Player)
   - ค้นหาคลิป (Search filter)
   - เปลี่ยนชื่อคลิป (Rename)
   - ดาวน์โหลดลงเครื่อง (Download file)
   - ลบคลิปที่ไม่ต้องการ (Delete)

---

## วิธีการติดตั้งใน Google Chrome (Install Guide)

1. เปิดเบราว์เซอร์ **Google Chrome**
2. ไปที่หน้าจัดการส่วนขยาย โดยพิมพ์ URL ในช่องแอดเดรส:
   ```text
   chrome://extensions/
   ```
3. เปิดสวิตช์ **Developer mode (โหมดนักพัฒนา)** ที่มุมบนขวา
4. คลิกปุ่ม **Load unpacked (โหลดส่วนขยายที่คลายการบีบอัดแล้ว)** ที่มุมบนซ้าย
5. เลือกโฟลเดอร์:
   ```text
   D:\Work\MyProject\Dev\local-screen-recorder
   ```
6. ตัว Extension ชื่อ **"Local Screen & Video Recorder (4K)"** จะปรากฏขึ้นในแถบเครื่องมือของ Chrome ทันที

---

## วิธีใช้งาน (How to Use)

1. คลิกที่ไอคอนรูปกล้องสีแดงของ Extension ในแถบเครื่องมือ Chrome
2. เลือกความละเอียดที่ต้องการ เช่น **4K (3840 x 2160)**
3. เลือกเปิด/ปิด เสียงไมค์ (Microphone) และ เสียงระบบ (System Audio) ตามต้องการ
4. คลิก **"เริ่มบันทึก (Start Recording)"**
5. เลือกว่าจะบันทึกหน้าจอใด (Entire Screen หรือ Window หรือ Chrome Tab)
   - *หมายเหตุ: หากต้องการบันทึกเสียงระบบ ให้ติ๊กถูกที่กล่อง "Also share system audio" หรือ "แชร์เสียงระบบ" ในหน้าต่างที่ Chrome เด้งขึ้นมาถามด้วย*
6. เมื่อบันทึกเสร็จ คลิกไอคอน Extension อีกครั้งแล้วกด **"หยุดการบันทึก (Stop Recording)"** (หรือกดปุ่ม Stop Sharing บนแถบลอยของ Chrome)
7. ระบบจะเปิดหน้า **My Items** ขึ้นมาให้อัตโนมัติ เพื่อให้เปิดดูและกดดาวน์โหลดได้ทันที
