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


## Classroom reliability checklist
- ตั้ง `HOST_KEY`, Upstash, `RATE_LIMIT_READ_PER_MIN=3000`, และ `RATE_LIMIT_WRITE_PER_MIN=180` ก่อนเปิดห้อง
- เปิด Host และ Player บนเครือข่ายจริง ตรวจ QR, รหัสทีม และการ join ครบ 3 ทีม
- ทดสอบปุ่ม “ปล่อยอุปกรณ์” ด้วยห้องทดลอง และยืนยันว่าอุปกรณ์เดิมส่งคำตอบไม่ได้
- ซ่อน/เปิดแท็บ Player และ Host เพื่อยืนยัน polling กลับมาทันทีโดย draft และ Host Key ยังอยู่
- สร้าง QR ใหม่เมื่อ URL เปลี่ยน: `npm run generate:qr -- https://example.com/`
- ห้าม reset ห้อง production หรือเปลี่ยน environment ระหว่างชั้นเรียน


## Classroom reliability checklist
- Before class, open `/host`, confirm all three access codes, and test the projected QR from a phone.
- Keep the facilitator tab visible during transitions; hidden tabs pause polling and refresh immediately when visible again.
- If a team changes device, use **ปล่อยอุปกรณ์** for that joined team, confirm the prompt, then let the team re-enter its original code. Existing name, context, and answers are preserved.
- Anonymous join screens poll every 8 seconds; joined players and the host poll every 1.5 seconds. The 250 ms countdown display is local and does not increase API traffic.
- Regenerate the checked-in fallback QR with `npm run generate:qr -- https://hype-cycle-decision-room.vercel.app/` and verify it before deployment.
