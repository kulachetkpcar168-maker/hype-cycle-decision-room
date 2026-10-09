# Hype Cycle Decision Room — Approved Thai-first Specification

## Purpose
กิจกรรม 20 นาทีสำหรับ Facilitator และ 3 ทีม ใช้ Evidence เดียวกันเพื่อฝึกตีความ Hype Cycle และเลือก Action ตามบริบท โดยไม่เพิ่มระบบคะแนนหรือการแข่งขัน

## Access and identity
ระบบสร้าง Team A/B/C เป็น fallback และสุ่มจับคู่บริบทจำลองสามแบบหนึ่งต่อหนึ่ง: สตาร์ทอัพ E-commerce ไทยที่กำลังเติบโต, กลุ่มโรงแรมบูติก 5 แห่ง, และสถาบันการเงินขนาดใหญ่ภายใต้การกำกับ. ผู้เล่นเข้าด้วยรหัส 4 ตัว, `deviceId`, และ `teamName` 1–40 ตัวอักษร. การเข้าครั้งแรกผูกทั้งสามค่า; อุปกรณ์เดิม refresh/rejoin ได้โดยชื่อไม่เปลี่ยน. เปลี่ยนชื่อได้เฉพาะใน lobby เมื่อส่งคำขอแก้ชื่ออย่างชัดเจน. จอสาธารณะใช้ชื่อทีมและไม่เปิดเผย code/device/context ก่อน pitch.

## Phases and timing
คง 6 phases: `lobby`, `round1`, `round2`, `reveal`, `pitch`, `takeaway`. Host เท่านั้นที่เปลี่ยน phase. Round 1/2 มี deadline 4 นาที; timer ถึงศูนย์ไม่ lock หรือ advance. Pitch ไม่มี timer.

## Decisions
แต่ละรอบส่งเฉพาะ `stage`, `action`, `mostInfluentialEvidence`, `mainRisk`. Stage: innovation/peak/trough/slope/plateau. Action: Invest/Pilot/Wait/Stop. Round 2 ต้องมี Round 1 ก่อนและแก้คำตอบได้ระหว่าง phase เปิด.

## Player presentation
Thai เป็นภาษาหลัก. หน้าร่วมกิจกรรมอธิบายกติกาและแยก “Klarna = กรณีศึกษาจริง” จาก “บริบทธุรกิจของทีม = สถานการณ์จำลอง”. หน้าบริบทใช้ประโยค “ชื่อทีม, บทบาทของคุณคือทีมผู้บริหารของ…”. การเลือก Stage ใช้ inline SVG Hype Cycle 5 จุดที่ responsive, keyboard-compatible, highlight จุดที่เลือก และแสดงคำอธิบายภาษาไทยหนึ่งประโยค.

## Projected presentation
Lobby แสดง rules, activity journey, QR/URL, วิธี join และสถานะชื่อทีม. Codes อยู่ใน host-only collapsed details. Round 1 มี client-side Previous/Next สำหรับ 3 slides: scale (2.3M, ⅔, 35+), operations (11→2, −25%, 700), interpretation ($40M, company-reported caution, decision question). Round 2 แสดง AI strengths เทียบ Human roles และ hybrid escalation. Reveal แสดงชื่อทีมและ before/after โดยไม่แสดง context. Pitch แสดงทีมที่เลือก บทบาท/context before/after Evidence Risk และ speaking guide. Takeaway สรุปภาษาไทย.

## Provenance
ใช้ป้าย “ข้อมูลจริงที่ Klarna รายงาน”, “ข้อมูลที่บริษัทรายงานเอง”, “ข้อมูลใหม่จากกรณีภายหลัง”, และ “บริบทธุรกิจจำลอง”. ห้ามอ้างว่า Gartner จัด Klarna ไว้ใน Stage ใด; Stage คือการตีความเชิงกลยุทธ์ของทีม.

## Technical constraints
Node.js standard library only. Preserve host authentication, roomId compare-and-set, randomized one-to-one mapping, device binding, safe public projection, request limits, schema migration, local atomic JSON writes, and Upstash atomic Lua operations. State schema v3 persists `teamName` and replaces incompatible older state atomically.
