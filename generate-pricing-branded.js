const PDFDocument = require('pdfkit');
const fs = require('fs');

// Create PDF
const doc = new PDFDocument({
  size: 'A4',
  margin: 40,
  bufferPages: true
});

const filename = 'ZAI-FLOW-PRICING-GUIDE-BRANDED.pdf';
doc.pipe(fs.createWriteStream(filename));

// Brand colors
const primaryTurquoise = '#40C9D6';
const secondaryRed = '#A82D3A';
const accentGold = '#f7c948';
const darkNavy = '#0c2a44';
const darkGray = '#1F2937';
const lightGray = '#F5F7FA';
const white = '#FFFFFF';

// Contact
const contact = {
  email: 'mhatwiinda@gmail.com',
  phone: '+260971810616',
  web: 'zai-digital-studio.com'
};

// Helper functions
function addTitle(text) {
  doc.fontSize(32).font('Helvetica-Bold').fillColor(primaryTurquoise).text(text);
  doc.moveDown(0.5);
}

function addSubtitle(text) {
  doc.fontSize(16).font('Helvetica-Bold').fillColor(darkGray).text(text);
  doc.moveDown(0.3);
}

function addSectionTitle(text) {
  doc.moveDown(0.3);
  doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryTurquoise).text(text);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke(accentGold).lineWidth(2).moveDown(0.3);
  doc.moveDown(0.2);
}

function addBodyText(text) {
  doc.fontSize(11).font('Helvetica').fillColor(darkGray).text(text, { width: 515, lineGap: 3 });
  doc.moveDown(0.2);
}

function addBullet(text) {
  doc.fontSize(11).font('Helvetica').fillColor(darkGray).text('• ' + text, { width: 495 });
  doc.moveDown(0.3);
}

function newPage() {
  doc.addPage();
}

// ========== PAGE 1: COVER ==========
addTitle('ZAI FLOW 2.0');
doc.fontSize(16).font('Helvetica').fillColor(secondaryRed).text('Pricing Guide for Zambia');
doc.moveDown(0.5);
doc.fontSize(12).font('Helvetica').fillColor('#666').text('Effective Date: May 2026');

doc.moveDown(2);
doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryTurquoise).text('PRICING IN ZMW (Zambian Kwacha)');
doc.moveDown(0.3);

addBodyText('This document outlines subscription plans, implementation costs, and pricing structure for ZAI FLOW 2.0 - the most affordable ERP solution in Zambia.');
doc.moveDown(1);

doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryTurquoise).text('Key Highlights:');
addBullet('50% cheaper than competitor systems');
addBullet('Starting from just ZMW 5,000/month');
addBullet('Professional plans at ZMW 15,000/month');
addBullet('No long-term contracts required');
addBullet('30-day money-back guarantee');

// ========== PAGE 2: SUBSCRIPTION PLANS ==========
newPage();
addTitle('Subscription Plans');

addBodyText('Choose the plan that fits your business. All plans include cloud hosting, automatic backups, and software updates.');

addSectionTitle('STARTER PLAN - ZMW 5,000/month');
doc.fontSize(11).font('Helvetica-Bold').fillColor(darkGray).text('Perfect for solo entrepreneurs and very small businesses');
doc.moveDown(0.3);

const starterFeatures = [
  'Up to 2 users',
  'Basic modules (HR, Sales, Accounting)',
  'Cloud hosting (500MB storage)',
  'Email support (response within 24 hours)',
  'Monthly backups',
  'Basic reporting'
];

starterFeatures.forEach(f => addBullet(f));

doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica').fillColor(secondaryRed).text('💡 Best for: Freelancers, Small shops, Service providers');

addSectionTitle('PROFESSIONAL PLAN - ZMW 15,000/month');
doc.fontSize(11).font('Helvetica-Bold').fillColor(darkGray).text('⭐ Most popular - perfect for growing SMEs');
doc.moveDown(0.3);

const proFeatures = [
  'Up to 10 users',
  'All core modules (HR, Sales, Accounting, Inventory, Purchasing)',
  'Cloud hosting (50GB storage)',
  'Priority email & phone support',
  'Daily backups with recovery',
  'Custom reports and dashboards',
  'API access for integrations',
  'Mobile app access',
  'Free user training',
  'Free integrations (1 system)'
];

proFeatures.forEach(f => addBullet(f));

doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica').fillColor(primaryTurquoise).text('💼 Best for: Small-medium enterprises, Multi-location businesses');

addSectionTitle('ENTERPRISE PLAN - ZMW 45,000/month');
doc.fontSize(11).font('Helvetica-Bold').fillColor(darkGray).text('Full-featured solution for large organizations');
doc.moveDown(0.3);

const entFeatures = [
  'Unlimited users',
  'All modules including advanced analytics',
  'Cloud or on-premise deployment',
  'Dedicated account manager',
  '24/7 phone, email, and chat support',
  'Hourly backups',
  'Advanced security options',
  'Custom development and integrations',
  'On-site training and consultation',
  'White-label options',
  'Priority feature requests',
  'SLA guarantee (99.9% uptime)'
];

entFeatures.forEach(f => addBullet(f));

doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica').fillColor(primaryTurquoise).text('🏢 Best for: Large enterprises, Multi-branch operations');

// ========== PAGE 3: IMPLEMENTATION COSTS ==========
newPage();
addTitle('Implementation & Setup Costs');

addBodyText('One-time implementation costs to get your system operational. These are separate from monthly subscriptions.');

addSectionTitle('Standard Implementation Package');

const implItems = [
  { item: 'System Setup & Configuration', price: 'ZMW 50,000', desc: 'Initial setup, security, and customization' },
  { item: 'Data Migration Service', price: 'ZMW 75,000', desc: 'Export from legacy systems, cleaning, and import' },
  { item: 'User Training (per person)', price: 'ZMW 2,000', desc: 'Hands-on training for system usage' },
  { item: 'Group Training Session', price: 'ZMW 30,000', desc: 'Full team training workshop (up to 20 people)' },
  { item: 'Customization (per hour)', price: 'ZMW 10,000', desc: 'Custom reports, workflows, or modifications' },
  { item: 'Integration Service', price: 'ZMW 60,000', desc: 'Integration with third-party systems' }
];

let implY = doc.y;
implItems.forEach(item => {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryTurquoise).text(item.item, 40, implY);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(secondaryRed).text(item.price, 350, implY);
  doc.fontSize(9).font('Helvetica').fillColor('#666').text(item.desc, 40, implY + 20, { width: 475 });
  implY = doc.y + 15;
});

addSectionTitle('Typical Implementation Timeline & Cost');

doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Example: Small Business (5 employees, basic modules)');
doc.moveDown(0.2);

const timeline = [
  { task: 'System Setup', duration: '2 days', cost: 'ZMW 50,000' },
  { task: 'Data Migration', duration: '3 days', cost: 'ZMW 75,000' },
  { task: 'Staff Training (5 people)', duration: '1 day', cost: 'ZMW 10,000' },
  { task: 'Customization', duration: '2 hours', cost: 'ZMW 20,000' }
];

let tY = doc.y + 15;
timeline.forEach(t => {
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(t.task, 50, tY);
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(t.duration, 300, tY);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryTurquoise).text(t.cost, 420, tY);
  tY += 20;
});

tY += 10;
doc.moveTo(50, tY).lineTo(520, tY).stroke('#E0E7FF');
doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryTurquoise).text('Total First-Year Setup', 50, tY + 10);
doc.fontSize(11).font('Helvetica-Bold').fillColor(secondaryRed).text('ZMW 155,000', 420, tY + 10);

// ========== PAGE 4: PRICING EXAMPLES ==========
newPage();
addTitle('Annual Cost Examples by Business Size');

addBodyText('Total annual investment including subscription and one-time implementation');

// Small Business
addSectionTitle('Small Business (2-5 employees)');
doc.fontSize(11).font('Helvetica').fillColor(darkGray).text('Starter Plan Example:');
doc.moveDown(0.2);

const smallCalc = [
  { item: 'Monthly Subscription (Starter)', monthly: 5000, annual: 60000 },
  { item: 'Implementation (one-time)', once: 155000 }
];

let calcY = doc.y;
smallCalc.forEach(calc => {
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(calc.item, 50, calcY);
  if (calc.once) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor(secondaryRed).text('ZMW ' + calc.once.toLocaleString(), 350, calcY);
  } else {
    doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('ZMW ' + calc.monthly.toLocaleString() + '/month', 300, calcY);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryTurquoise).text('ZMW ' + calc.annual.toLocaleString(), 420, calcY);
  }
  calcY += 20;
});
calcY += 10;
doc.moveTo(50, calcY).lineTo(520, calcY).stroke('#E0E7FF');
doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryTurquoise).text('Total Year 1 Cost', 50, calcY + 10);
doc.fontSize(12).font('Helvetica-Bold').fillColor(secondaryRed).text('ZMW 215,000', 420, calcY + 10);

doc.moveDown(2);

// Medium Business
addSectionTitle('Medium Business (5-10 employees)');
doc.fontSize(11).font('Helvetica').fillColor(darkGray).text('Professional Plan Example:');
doc.moveDown(0.2);

const medCalc = [
  { item: 'Monthly Subscription (Professional)', monthly: 15000, annual: 180000 },
  { item: 'Implementation (one-time)', once: 200000 },
  { item: 'Integration (optional)', once2: 60000 }
];

calcY = doc.y;
medCalc.forEach(calc => {
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(calc.item, 50, calcY);
  if (calc.once) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor(secondaryRed).text('ZMW ' + calc.once.toLocaleString(), 350, calcY);
  } else if (calc.once2) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor(secondaryRed).text('ZMW ' + calc.once2.toLocaleString(), 350, calcY);
  } else {
    doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('ZMW ' + calc.monthly.toLocaleString() + '/month', 300, calcY);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryTurquoise).text('ZMW ' + calc.annual.toLocaleString(), 420, calcY);
  }
  calcY += 20;
});
calcY += 10;
doc.moveTo(50, calcY).lineTo(520, calcY).stroke('#E0E7FF');
doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryTurquoise).text('Total Year 1 Cost', 50, calcY + 10);
doc.fontSize(12).font('Helvetica-Bold').fillColor(secondaryRed).text('ZMW 440,000', 420, calcY + 10);

// ========== PAGE 5: COST COMPARISON ==========
newPage();
addTitle('Cost Comparison: ZAI FLOW vs Competitors');

addBodyText('Annual total cost comparison for a typical small-medium business (Professional plan)');

doc.moveDown(0.5);

// Comparison table
const tableY = doc.y;
const headers = ['Metric', 'ZAI FLOW', 'Competitor A', 'Competitor B'];
const colWidths = [130, 120, 120, 120];

// Header row
let tableX = 50;
headers.forEach((h, i) => {
  doc.fillColor(primaryTurquoise).rect(tableX, tableY, colWidths[i], 30).fill();
  doc.fontSize(10).font('Helvetica-Bold').fillColor('white').text(h, tableX + 5, tableY + 8, { width: colWidths[i] - 10 });
  tableX += colWidths[i];
});

// Data rows
const compData = [
  ['Monthly Subscription', 'ZMW 15k', 'ZMW 40k', 'ZMW 50k'],
  ['Annual Subscription', 'ZMW 180k', 'ZMW 480k', 'ZMW 600k'],
  ['Setup Cost', 'ZMW 200k', 'ZMW 500k', 'ZMW 750k'],
  ['Training Cost', 'ZMW 20k', 'ZMW 100k', 'ZMW 150k'],
  ['Total Year 1', 'ZMW 400k', 'ZMW 1,080k', 'ZMW 1,500k'],
  ['Your Savings', '—', 'ZMW 680k', 'ZMW 1,100k'],
];

let rowY = tableY + 30;
compData.forEach((row, idx) => {
  const bgColor = idx % 2 === 0 ? lightGray : 'white';
  const isTotal = idx === 4;
  const isSavings = idx === 5;

  tableX = 50;
  row.forEach((cell, cellIdx) => {
    doc.fillColor(bgColor).rect(tableX, rowY, colWidths[cellIdx], 25).fill();

    let textColor = darkGray;
    let textFont = 'Helvetica';
    if (isTotal || isSavings) {
      textColor = primaryTurquoise;
      textFont = 'Helvetica-Bold';
    }
    if (cellIdx === 1 && (isTotal || isSavings)) {
      textColor = secondaryRed;
    }

    doc.fontSize(9).font(textFont).fillColor(textColor).text(cell, tableX + 5, rowY + 7, { width: colWidths[cellIdx] - 10 });
    tableX += colWidths[cellIdx];
  });

  rowY += 25;
});

doc.moveDown(2);
doc.fontSize(12).font('Helvetica-Bold').fillColor(secondaryRed).text('ZAI FLOW saves you ZMW 680K - 1.1M in Year 1!');

// ========== PAGE 6: PAYMENT OPTIONS ==========
newPage();
addTitle('Payment Options & Terms');

addSectionTitle('Flexible Subscription Payment');

addBodyText('We offer flexible payment options to work with your cash flow:');
doc.moveDown(0.3);

const paymentOptions = [
  {
    method: 'Monthly Payment',
    desc: 'Pay monthly with no commitment. Cancel anytime with 30 days notice.',
    features: ['Most flexible', 'No contract', 'Cancel anytime']
  },
  {
    method: 'Quarterly Payment',
    desc: 'Save 5% by paying for 3 months upfront. Great for planning.',
    features: ['5% discount', 'Better budget', 'Quarterly billing']
  },
  {
    method: 'Annual Payment',
    desc: 'Save 10% by paying for the full year. Best value for committed businesses.',
    features: ['10% discount', 'Maximum savings', 'Annual billing']
  }
];

paymentOptions.forEach(opt => {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryTurquoise).text(opt.method);
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(opt.desc, { width: 475 });
  opt.features.forEach(f => addBullet(f));
  doc.moveDown(0.3);
});

addSectionTitle('Payment Methods');

const methods = [
  'Bank Transfer (Standard Chartered, Zanaco, First National Bank, etc.)',
  'Mobile Money (MTN Mobile Money, Airtel Money)',
  'Credit/Debit Card (Visa, Mastercard)',
  'Cheque (for large implementations)'
];

methods.forEach(m => addBullet(m));

addSectionTitle('Implementation Cost Payment');

addBodyText('Implementation costs can be split as follows:');
addBullet('50% upfront upon agreement');
addBullet('50% upon system go-live');

addBodyText('Or discuss custom payment plans for larger implementations.');

// ========== PAGE 7: SPECIAL OFFERS ==========
newPage();
addTitle('Special Offers & Discounts');

addSectionTitle('Early Adopter Promotion (Limited Time)');

doc.fillColor(lightGray).rect(50, doc.y, 495, 80).fill();
doc.fillColor(secondaryRed).rect(50, doc.y, 495, 80).stroke().lineWidth(2);

doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryTurquoise).text('30% OFF Setup Costs', 60, doc.y + 10);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Plus 3 months of professional training included FREE', 60, doc.y + 32, { width: 475 });
doc.fontSize(9).font('Helvetica').fillColor('#999').text('Valid until June 30, 2026', 60, doc.y + 52, { width: 475 });

doc.moveDown(7);

addSectionTitle('Volume Discounts');

addBodyText('For organizations with multiple branches or departments:');

const volumeDiscounts = [
  { users: '5-20 users', discount: '5% discount on Professional plan' },
  { users: '21-50 users', discount: '10% discount + move to Enterprise' },
  { users: '50+ users', discount: '15% discount + custom pricing' }
];

volumeDiscounts.forEach(vd => {
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(vd.users, 50, doc.y);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryTurquoise).text(vd.discount, 200, doc.y);
  doc.moveDown(0.5);
});

addSectionTitle('Non-Profit & Government Discount');

doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Registered non-profit organizations and government agencies:');
doc.moveDown(0.2);
addBullet('25% discount on all subscription plans');
addBullet('Free setup and implementation');
addBullet('Flexible payment terms');

addSectionTitle('Free Trial');

addBodyText('Try ZAI FLOW completely free for 30 days with all Professional features. No credit card required. Start your trial today!');

// ========== PAGE 8: FAQ ==========
newPage();
addTitle('Frequently Asked Questions');

const faqs = [
  {
    q: 'Can I upgrade or downgrade my plan?',
    a: 'Yes! Change your plan anytime. Upgrades take effect immediately. Downgrades take effect at the start of your next billing cycle.'
  },
  {
    q: 'Is there a minimum contract period?',
    a: 'No. ZAI FLOW operates on a month-to-month basis. Cancel anytime with 30 days notice.'
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'We will provide a full data export in standard formats. Your data is always yours - we make it easy to leave if needed.'
  },
  {
    q: 'Are there any hidden fees?',
    a: 'No. Our pricing is completely transparent. The only costs are the subscription fee and optional add-on services you choose.'
  },
  {
    q: 'Do you offer discounts for non-profits?',
    a: 'Yes! We offer 25% discount for registered non-profit organizations. Contact our team with proof of registration.'
  },
  {
    q: 'What support is included?',
    a: 'Starter: Email support (24hr). Professional: Priority support (4hr). Enterprise: 24/7 dedicated support.'
  },
  {
    q: 'Can I use ZAI FLOW on my phone?',
    a: 'Yes! All plans include mobile app access. Login from any smartphone or tablet.'
  }
];

faqs.forEach(faq => {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryTurquoise).text('Q: ' + faq.q);
  doc.moveDown(0.2);
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('A: ' + faq.a, { width: 475 });
  doc.moveDown(0.5);
});

// ========== PAGE 9: CONTACT & NEXT STEPS ==========
newPage();
addTitle('Ready to Get Started?');

doc.moveDown(0.5);

addSectionTitle('Your Next Steps');

const steps = [
  '1. Schedule a 30-minute demo (free)',
  '2. Discuss your business needs',
  '3. Get a customized quote',
  '4. Sign agreement',
  '5. Go live in 2-4 weeks'
];

steps.forEach(step => {
  doc.fontSize(11).font('Helvetica').fillColor(darkGray).text(step);
  doc.moveDown(0.4);
});

addSectionTitle('Contact Information');

const contactCards = [
  { emoji: '📧', label: 'Email', value: contact.email },
  { emoji: '📱', label: 'Phone', value: contact.phone },
  { emoji: '🌐', label: 'Website', value: contact.web }
];

contactCards.forEach(ci => {
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(ci.emoji + '  ' + ci.label + ': ' + ci.value);
  doc.moveDown(0.4);
});

doc.moveDown(1);

// CTA Button
doc.fillColor(primaryTurquoise).rect(50, doc.y, 495, 40).fill();
doc.fontSize(12).font('Helvetica-Bold').fillColor(white).text('📅 Book Your FREE Trial Today!', 60, doc.y + 12);

doc.moveDown(3);

doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryTurquoise).text('The Most Affordable ERP for Zambian Businesses');
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Start from just ZMW 5,000/month • Professional plans at ZMW 15,000/month');

// Footer
doc.moveDown(2);
doc.fontSize(9).font('Helvetica').fillColor('#999').text('———————————————————————————', { align: 'center' });
doc.fontSize(9).font('Helvetica').fillColor('#999').text('ZAI FLOW 2.0 - Enterprise Resource Planning System for Zambia', { align: 'center' });
doc.fontSize(9).font('Helvetica').fillColor('#999').text('Pricing Guide | May 2026', { align: 'center' });

// Add page numbers
const pages = doc.bufferedPageRange().count;
for (let i = 1; i <= pages; i++) {
  doc.switchToPage(i - 1);
  doc.fontSize(9).font('Helvetica').fillColor('#999999').text(
    `Page ${i} of ${pages}`,
    50,
    doc.page.height - 30,
    { align: 'right', width: 495 }
  );
}

doc.end();

console.log(`✅ Branded Pricing Guide generated: ${filename}`);
