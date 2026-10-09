window.GameContent = {
  phases: { lobby: 'Rules & assignment', round1: 'Round 1', round2: 'Round 2 · new information', reveal: 'Reveal', pitch: 'Team pitches', takeaway: 'Takeaway' },
  phaseOrder: ['lobby', 'round1', 'round2', 'reveal', 'pitch', 'takeaway'],
  schedule: { rules: 2, assignment: 1, round1: 4, transition: 1, round2: 4, reveal: 2, pitches: 6 },
  takeaway: 'Same technology. Same evidence. Different context. Different action.',
  principle: 'The Hype Cycle informs strategic judgment rather than prescribing a universal decision.',
  companies: {
    startup: { color: '#a78bfa', title: 'NovaCart — E-commerce startup', operation: 'Direct-to-consumer online shop operating across Thailand, with seasonal campaign spikes.', customerVolume: 'About 2,000 support chats each week; campaign days can double volume.', staffingWorkflow: '12 employees total. Three people rotate customer service in a shared inbox and escalate refunds to a founder.', constraints: 'Eight months of runway, limited integration capacity, inconsistent product data, and no dedicated AI team.', riskTolerance: 'Moderate-to-high for reversible pilots; low for changes that could damage trust or consume runway.', decisionQuestion: 'Should NovaCart invest, pilot, wait, or stop Agentic AI customer service—and at what Hype Cycle stage?' },
    sme: { color: '#22d3ee', title: 'SiamStay — Boutique hotel group', operation: 'Five boutique hotels handling reservations, changes, refunds, local recommendations, and in-stay requests.', customerVolume: 'Roughly 6,500 guest messages per month in Thai, English, Chinese, and other languages.', staffingWorkflow: '18 front-desk and reservation staff use separate property systems; night coverage is thin and managers handle exceptions.', constraints: 'Small IT budget, uneven property data, review scores directly affect bookings, and service must feel personal.', riskTolerance: 'Moderate for FAQs and reservation support; low for complaints, refunds, VIP guests, and safety issues.', decisionQuestion: 'Should SiamStay deploy broadly, run a bounded pilot, wait for stronger evidence, or stop?' },
    corporate: { color: '#f59e0b', title: 'MetroBank — Regulated bank', operation: 'National retail bank supporting accounts, cards, payments, fraud alerts, disputes, and complaints.', customerVolume: 'Several million customers and more than 500,000 service contacts per month across phone, chat, and branches.', staffingWorkflow: 'A 1,200-person service operation uses scripted workflows, specialist queues, audit logs, and mandatory escalation.', constraints: 'Strict privacy, model governance, explainability, vendor review, auditability, and regulatory obligations.', riskTolerance: 'Low for customer-specific financial decisions; moderate for authenticated, low-risk informational workflows.', decisionQuestion: 'Where, if anywhere, should MetroBank use Agentic AI now, and what action fits the evidence?' }
  },
  stages: { innovation: 'Innovation Trigger', peak: 'Peak of Inflated Expectations', trough: 'Trough of Disillusionment', slope: 'Slope of Enlightenment', plateau: 'Plateau of Productivity' },
  stageShort: { innovation: 'Trigger', peak: 'Peak', trough: 'Trough', slope: 'Slope', plateau: 'Plateau' },
  actions: { invest: 'Invest', pilot: 'Pilot', wait: 'Wait', stop: 'Stop' },
  evidence: [
    { id: 'company_volume', stat: '2.3M', title: 'Conversations', text: 'Klarna reported 2.3 million AI-assisted conversations in its first month.' },
    { id: 'two_thirds', stat: '⅔', title: 'Share of chats', text: 'The company said AI handled about two-thirds of customer-service chats.' },
    { id: 'fte_equivalent', stat: '700', title: 'Work equivalent', text: 'Klarna compared the handled volume with the work of about 700 full-time agents.' },
    { id: 'fast_resolution', stat: '11→2', title: 'Resolution minutes', text: 'Reported average resolution time fell from about 11 minutes to under 2.' },
    { id: 'repeat_drop', stat: '−25%', title: 'Repeat contacts', text: 'The company reported repeat inquiries falling by about 25%.' },
    { id: 'languages', stat: '35+', title: 'Languages', text: 'The assistant served customers in more than 35 languages.' },
    { id: 'profit_projection', stat: '$40M', title: 'Projected impact', text: 'Klarna projected about $40 million in annual profit improvement.' },
    { id: 'company_reported', stat: '!', title: 'Source caution', text: 'Most headline results were company-reported rather than independent research.' }
  ],
  newEvidence: [
    { id: 'human_choice', title: 'Human choice matters', text: 'Customers still want a clear path to a person for complex or sensitive problems.' },
    { id: 'complex_escalation', title: 'Judgment needs escalation', text: 'Patterned tasks automate well; ambiguous cases still require human judgment.' },
    { id: 'quality_tradeoff', title: 'Cost is not the only outcome', text: 'Over-automation can reduce trust, service quality, and customer retention.' },
    { id: 'hybrid_model', title: 'Hybrid designs are emerging', text: 'AI handles volume while people own exceptions, complaints, and valuable relationships.' },
    { id: 'workflow_matters', title: 'Workflow beats demos', text: 'Data quality, escalation rules, audit logs, and oversight determine real outcomes.' }
  ],
  risks: { service_quality: 'Service quality', customer_trust: 'Customer trust', implementation_complexity: 'Implementation complexity', compliance_privacy: 'Compliance & privacy', financial_exposure: 'Financial exposure', workforce_dependency: 'Workforce dependency' }
};
