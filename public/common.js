window.GameContent = {
  phases: {
    lobby: 'Lobby', round1: 'Round 1', round1_locked: 'Round 1 Locked',
    twist: 'Twist Reveal', round2: 'Round 2', round2_locked: 'Final Locked',
    pitch: 'Pitch Mode', debrief: 'Debrief'
  },
  phaseOrder: ['lobby','round1','round1_locked','twist','round2','round2_locked','pitch','debrief'],
  teams: {
    startup: {
      label: 'Startup', icon: '↗', color: '#a78bfa',
      title: 'NovaCart — E-commerce Startup',
      brief: 'ร้านออนไลน์อายุ 2 ปี มีพนักงาน 12 คน รับแชตประมาณ 2,000 ครั้งต่อสัปดาห์ เงินทุนเหลือ 8 เดือน และทีมบริการลูกค้ามีเพียง 3 คน',
      question: 'ควรใช้ AI รับ Customer Service เกือบทั้งหมดเพื่อประหยัดต้นทุนและ Scale หรือไม่?',
      priorities: ['Runway', 'ความเร็วในการ Scale', 'ต้นทุนต่อบทสนทนา', 'ความเสี่ยงต่อชื่อเสียง']
    },
    sme: {
      label: 'SME', icon: '◆', color: '#22d3ee',
      title: 'SiamStay — Boutique Hotel SME',
      brief: 'เครือโรงแรมขนาดเล็ก 5 แห่ง รับคำถามหลายภาษาเรื่องห้องพัก การจอง และการคืนเงิน โดยคะแนนรีวิวมีผลต่อยอดจองโดยตรง',
      question: 'ควรใช้ AI ดูแลแขกตลอด 24 ชั่วโมง หรือจำกัดเฉพาะคำถามพื้นฐานและการจอง?',
      priorities: ['Customer trust', 'ค่าใช้จ่าย', 'ความง่ายในการติดตั้ง', 'คุณภาพบริการ']
    },
    corporate: {
      label: 'Corporate', icon: '▦', color: '#f59e0b',
      title: 'MetroBank — Large Financial Corporate',
      brief: 'ธนาคารที่มีลูกค้าหลายล้านรายและคำถามจำนวนมากเกี่ยวกับบัญชี บัตร การชำระเงิน และข้อร้องเรียน ซึ่งมีข้อมูลอ่อนไหวและกฎกำกับเข้มงวด',
      question: 'ควรใช้ AI ในวงกว้าง หรือจำกัดเฉพาะงานที่มีความเสี่ยงต่ำ?',
      priorities: ['Compliance', 'Privacy', 'Auditability', 'Customer satisfaction']
    }
  },
  stages: {
    innovation: 'Innovation Trigger', peak: 'Peak of Inflated Expectations',
    trough: 'Trough of Disillusionment', slope: 'Slope of Enlightenment',
    plateau: 'Plateau of Productivity'
  },
  stageShort: {
    innovation: 'Trigger', peak: 'Peak', trough: 'Trough', slope: 'Slope', plateau: 'Plateau'
  },
  actions: { invest: 'Invest', pilot: 'Pilot', wait: 'Wait', stop: 'Stop' },
  actionHelp: {
    invest: 'ลงทุนจริงและเตรียมขยาย', pilot: 'ทดลองในขอบเขตจำกัด',
    wait: 'ติดตามและรอหลักฐานเพิ่ม', stop: 'หยุดหรือไม่ดำเนินการต่อ'
  },
  kpis: {
    cost_per_conversation: 'Cost per conversation', resolution_time: 'Resolution time',
    first_contact_resolution: 'First-contact resolution', repeat_inquiry_rate: 'Repeat inquiry rate',
    customer_satisfaction: 'Customer satisfaction', escalation_rate: 'Escalation to human rate',
    complaint_rate: 'Complaint rate', revenue_impact: 'Revenue impact'
  },
  evidence: [
    { id: 'company_volume', stat: '2.3M', title: 'บทสนทนาในเดือนแรก', text: 'Klarna รายงานว่า AI Assistant สนทนากับลูกค้า 2.3 ล้านครั้งในเดือนแรก' },
    { id: 'two_thirds', stat: '⅔', title: 'ของ Customer-service chats', text: 'บริษัทระบุว่า AI รองรับประมาณสองในสามของบทสนทนาฝ่ายบริการลูกค้า' },
    { id: 'fte_equivalent', stat: '700', title: 'พนักงานเทียบเท่า', text: 'Klarna ระบุว่าปริมาณงานเทียบเท่าพนักงานประมาณ 700 คน' },
    { id: 'fast_resolution', stat: '11→2', title: 'นาทีในการแก้ปัญหา', text: 'บริษัทระบุว่าเวลาการแก้ปัญหาลดจากประมาณ 11 นาทีเหลือต่ำกว่า 2 นาที' },
    { id: 'repeat_drop', stat: '−25%', title: 'การติดต่อซ้ำ', text: 'บริษัทระบุว่าจำนวนการติดต่อซ้ำลดลงประมาณ 25%' },
    { id: 'languages', stat: '35+', title: 'ภาษา', text: 'ระบบให้บริการลูกค้าได้มากกว่า 35 ภาษา' },
    { id: 'profit_projection', stat: '$40M', title: 'ผลกำไรที่คาดการณ์', text: 'บริษัทคาดการณ์ผลต่อกำไรประมาณ 40 ล้านดอลลาร์ในปีเปิดตัว' },
    { id: 'company_reported', stat: '!', title: 'Company-reported data', text: 'ผลลัพธ์หลักมาจากการประกาศของบริษัท ไม่ใช่งานวิจัยอิสระทั้งหมด' }
  ],
  twist: [
    { id: 'human_choice', title: 'ลูกค้าต้องการทางเลือก', text: 'ลูกค้าบางส่วนยังต้องการติดต่อมนุษย์ โดยเฉพาะเมื่อปัญหาซับซ้อนหรือละเอียดอ่อน' },
    { id: 'complex_escalation', title: 'งานซับซ้อนต้อง Escalate', text: 'AI ทำงานที่มีรูปแบบชัดเจนได้ดี แต่งานที่ต้องใช้ Judgment ยังต้องส่งต่อมนุษย์' },
    { id: 'quality_tradeoff', title: 'Cost ไม่ใช่ KPI เดียว', text: 'การลดพนักงานมากเกินไปอาจกระทบคุณภาพบริการ ความเชื่อใจ และประสบการณ์ลูกค้า' },
    { id: 'hybrid_model', title: 'Hybrid model เริ่มชัด', text: 'AI จัดการงานปริมาณสูง ส่วนมนุษย์ดูแลงานซับซ้อน ข้อร้องเรียน และลูกค้า VIP' },
    { id: 'workflow_matters', title: 'Workflow สำคัญกว่า Demo', text: 'ผลลัพธ์ขึ้นกับ Data, Escalation rules, Audit log และ Human oversight ไม่ใช่ตัวโมเดลอย่างเดียว' }
  ]
};
