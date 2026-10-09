# Hype Cycle Decision Room

กิจกรรมตัดสินใจในชั้นเรียนแบบ mobile-first สำหรับ 3 ทีม โดยใช้กรณีจริงของ Klarna เพื่อประเมิน Agentic AI ใน Customer Service ภายใต้บริบทธุรกิจจำลองที่ต่างกัน

## จุดสำคัญ
- เข้าร่วมด้วยรหัส 4 ตัวและชื่อทีม 1–40 ตัวอักษร; อุปกรณ์แรกผูกกับทีมและกลับเข้าได้หลัง refresh
- สุ่มจับคู่แบบหนึ่งต่อหนึ่งกับ 3 บริบทจำลอง: สตาร์ทอัพ E-commerce ไทยที่กำลังเติบโต, กลุ่มโรงแรมบูติก 5 แห่ง, และสถาบันการเงินขนาดใหญ่ภายใต้การกำกับ
- 6 phases เดิม พร้อม timer 4 นาทีใน Round 1/2 และไม่มี timer ตอน pitch
- โทรศัพท์มีกราฟ Hype Cycle แบบ inline SVG ที่เลือกได้ด้วย radio/keyboard พร้อมคำอธิบาย Stage ภาษาไทย
- จอ Facilitator เป็น presentation: กติกาและ journey, 3 evidence slides, hybrid escalation, before/after, pitch guide และ takeaway
- ระบุที่มาชัดเจน: กรณี Klarna และตัวเลขที่บริษัทรายงาน เทียบกับบริบทธุรกิจจำลอง; Stage เป็นการตีความของทีม

## Local development
```bash
HOST_KEY='replace-me' PORT=4871 npm run dev
npm test
```
Player: `http://localhost:4871/`
Host: `http://localhost:4871/host`

Local state อยู่ที่ `data/state.json`; schema รุ่นปัจจุบันคือ v3 และ state รุ่นเก่าจะถูกแทนที่อย่าง atomic. Production ใช้ Upstash Redis โดยตั้ง `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `HOST_KEY` และ `GAME_STATE_KEY` (ถ้าต้องการ). ห้าม commit credentials.
