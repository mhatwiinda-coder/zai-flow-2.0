const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({
  size: 'A4',
  margin: 40,
  bufferPages: true
});

const filename = 'ZAI-FLOW-PRICING-CLEAN.pdf';
doc.pipe(fs.createWriteStream(filename));

// Modern colors
const turquoise = '#00D9D9';
const purple = '#7C3AED';
const darkBg = '#0F172A';
const white = '#FFFFFF';
const lightGray = '#F1F5F9';
const accent = '#FF6B6B';
const gold = '#FFD700';

const contact = {
  email: 'mhatwiinda@gmail.com',
  phone: '+260 971 810 616',
  website: 'zai-digital-studio.com'
};

function newPage() {
  doc.addPage();
}

function addTitle(text) {
  doc.fontSize(36).font('Helvetica-Bold').fillColor(turquoise).text(text);
  doc.moveDown(0.5);
}

function addSectionTitle(text) {
  doc.moveDown(0.3);
  doc.fontSize(14).font('Helvetica-Bold').fillColor(turquoise).text(text);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke(gold).lineWidth(2).moveDown(0.3);
  doc.moveDown(0.2);
}

function addBodyText(text) {
  doc.fontSize(11).font('Helvetica').fillColor(white).text(text, { width: 515, lineGap: 3 });
  doc.moveDown(0.2);
}

function addBullet(text) {
  doc.fontSize(11).font('Helvetica').fillColor(lightGray).text('- ' + text, { width: 495 });
  doc.moveDown(0.3);
}

// ===== PAGE 1: COVER =====
doc.fillColor(darkBg).rect(0, 0, 595, 842).fill();

// Background shapes
doc.fillOpacity(0.1).fillColor(turquoise).circle(100, 50, 200).fill();
doc.fillOpacity(0.1).fillColor(purple).circle(500, 700, 250).fill();
doc.fillOpacity(1);

doc.fillColor(turquoise).rect(0, 0, 595, 8).fill();

// Title
addTitle('ZAI FLOW 2.0');
doc.fontSize(16).font('Helvetica').fillColor(turquoise).text('Pricing Guide for Zambia');
doc.moveDown(0.5);
doc.fontSize(12).font('Helvetica').fillColor('#AAA').text('Effective May 2026');

doc.moveDown(2);

addBodyText('Discover why ZAI FLOW is the most affordable enterprise resource planning solution for Zambian businesses - with pricing starting at just ZMW 5,000/month.');

doc.moveDown(1);

// Key stats
doc.fillColor(purple).fillOpacity(0.2).rect(40, doc.y, 515, 100).fill();
doc.fillOpacity(1);

doc.fontSize(12).font('Helvetica-Bold').fillColor(turquoise).text('Key Benefits:', 60, doc.y + 15);
addBullet('50% cheaper than ZamTech ERP');
addBullet('Professional plans at ZMW 15,000/month');
addBullet('Free setup and training included');

doc.moveDown(1);

// ===== PAGE 2: SUBSCRIPTION PLANS =====
newPage();

doc.fillColor(darkBg).rect(0, 0, 595, 842).fill();

addTitle('Subscription Plans');

addBodyText('Simple, transparent pricing. No hidden fees. Cancel anytime.');

doc.moveDown(0.5);

// Plan cards
const plans = [
  {
    name: 'STARTER',
    price: 5000,
    users: 2,
    subtitle: 'For Solopreneurs',
    features: [
      'Basic modules (HR, Sales, Accounting)',
      'Up to 2 users',
      'Cloud hosting (500MB)',
      'Email support (24hr response)',
      'Monthly backups',
      'Basic reporting'
    ],
    isPopular: false
  },
  {
    name: 'PROFESSIONAL',
    price: 15000,
    users: 10,
    subtitle: 'Most Popular',
    features: [
      'ALL 6 core modules',
      'Up to 10 users',
      'Cloud hosting (50GB)',
      'Priority support (4hr response)',
      'Daily backups',
      'Custom reports and dashboards',
      'API access',
      'Mobile app',
      'Free training (5 people)',
      'Free integration (1 system)'
    ],
    isPopular: true
  },
  {
    name: 'ENTERPRISE',
    price: 45000,
    users: 999,
    subtitle: 'For Large Teams',
    features: [
      'Everything in Professional',
      'Unlimited users',
      'Cloud or on-premise',
      'Dedicated account manager',
      '24/7 phone and chat support',
      'Hourly backups',
      'Custom development',
      'On-site training',
      'White-label option',
      'SLA guarantee (99.9% uptime)'
    ],
    isPopular: false
  }
];

let planY = doc.y + 20;

plans.forEach(plan => {
  const cardColor = plan.isPopular ? turquoise : purple;
  const bgOpacity = plan.isPopular ? 0.25 : 0.15;

  // Card
  doc.fillColor(cardColor).fillOpacity(bgOpacity).rect(50, planY, 495, 290).fill();
  doc.strokeColor(cardColor).lineWidth(plan.isPopular ? 3 : 1).rect(50, planY, 495, 290).stroke();
  doc.fillOpacity(1);

  // Popular badge
  if (plan.isPopular) {
    doc.fillColor(gold).rect(60, planY + 10, 100, 18).fill();
    doc.fontSize(8).font('Helvetica-Bold').fillColor(darkBg).text('RECOMMENDED', 65, planY + 12);
  }

  // Name & subtitle
  doc.fontSize(13).font('Helvetica-Bold').fillColor(cardColor).text(plan.name, 60, planY + 35);
  doc.fontSize(9).font('Helvetica').fillColor(turquoise).text(plan.subtitle, 60, planY + 52);

  // Price
  doc.fontSize(20).font('Helvetica-Bold').fillColor(white).text('ZMW ' + plan.price.toLocaleString(), 60, planY + 75);
  doc.fontSize(9).font('Helvetica').fillColor(lightGray).text('/month', 60, planY + 100);

  // Features
  let featY = planY + 120;
  plan.features.forEach(feat => {
    doc.fontSize(9).font('Helvetica').fillColor(white).text('- ' + feat, 60, featY, { width: 475 });
    featY += 14;
  });

  planY += 310;
});

// ===== PAGE 3: IMPLEMENTATION COSTS =====
newPage();

doc.fillColor(darkBg).rect(0, 0, 595, 842).fill();

addTitle('Implementation and Setup Costs');

addBodyText('One-time costs to get your system operational. These are separate from monthly subscriptions.');

addSectionTitle('Service Pricing');

const services = [
  { service: 'System Setup and Configuration', price: 'ZMW 50,000', detail: 'Initial setup, security, customization' },
  { service: 'Data Migration', price: 'ZMW 75,000', detail: 'Import from legacy systems, cleaning, validation' },
  { service: 'User Training (per person)', price: 'ZMW 2,000', detail: 'Hands-on training for system usage' },
  { service: 'Group Training (up to 20 people)', price: 'ZMW 30,000', detail: 'Full team training workshop' },
  { service: 'Customization (per hour)', price: 'ZMW 10,000', detail: 'Custom reports, workflows, modifications' },
  { service: 'Third-Party Integration', price: 'ZMW 60,000', detail: 'Integration with existing business systems' }
];

let serviceY = doc.y + 10;
services.forEach(svc => {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(turquoise).text(svc.service, 50, serviceY);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(gold).text(svc.price, 350, serviceY);
  doc.fontSize(9).font('Helvetica').fillColor(lightGray).text(svc.detail, 50, serviceY + 20, { width: 495 });
  serviceY += 50;
});

addSectionTitle('Typical Small Business Setup');

doc.fontSize(11).font('Helvetica').fillColor(lightGray).text('Example: 5-employee business with basic modules');
doc.moveDown(0.2);

const breakdown = [
  { item: 'System Setup', cost: 'ZMW 50,000' },
  { item: 'Data Migration', cost: 'ZMW 75,000' },
  { item: 'Training (5 people)', cost: 'ZMW 10,000' },
  { item: 'Customization (2 hours)', cost: 'ZMW 20,000' }
];

let breakY = doc.y + 15;
breakdown.forEach(item => {
  doc.fontSize(10).font('Helvetica').fillColor(white).text(item.item, 50, breakY);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(turquoise).text(item.cost, 400, breakY);
  breakY += 20;
});

breakY += 5;
doc.moveTo(50, breakY).lineTo(520, breakY).stroke(gold).lineWidth(1);
doc.fontSize(12).font('Helvetica-Bold').fillColor(turquoise).text('Total Setup Investment', 50, breakY + 10);
doc.fontSize(12).font('Helvetica-Bold').fillColor(gold).text('ZMW 155,000', 400, breakY + 10);

// ===== PAGE 4: ANNUAL COST EXAMPLES =====
newPage();

doc.fillColor(darkBg).rect(0, 0, 595, 842).fill();

addTitle('Total Cost of Ownership');

addBodyText('Annual investment including subscription and implementation');

// Small Business
addSectionTitle('Small Business - Starter Plan');
doc.fontSize(10).font('Helvetica').fillColor(lightGray).text('2-5 employees, basic modules');
doc.moveDown(0.3);

const smallItems = [
  { item: 'Monthly Subscription (Starter)', detail: 'ZMW 5,000 per month', value: 'ZMW 60,000' },
  { item: 'Setup and Implementation', detail: 'System setup, data migration, training', value: 'ZMW 155,000' }
];

let smallY = doc.y + 10;
smallItems.forEach(item => {
  doc.fontSize(10).font('Helvetica').fillColor(white).text(item.item, 50, smallY);
  doc.fontSize(9).font('Helvetica').fillColor(turquoise).text(item.detail, 50, smallY + 18);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(gold).text(item.value, 400, smallY + 18);
  smallY += 45;
});

smallY += 5;
doc.moveTo(50, smallY).lineTo(520, smallY).stroke(turquoise).lineWidth(2);
doc.fontSize(13).font('Helvetica-Bold').fillColor(white).text('Year 1 Total Cost', 50, smallY + 10);
doc.fontSize(13).font('Helvetica-Bold').fillColor(gold).text('ZMW 215,000', 400, smallY + 10);

doc.moveDown(5);

// Professional Business
addSectionTitle('Medium Business - Professional Plan');
doc.fontSize(10).font('Helvetica').fillColor(lightGray).text('5-10 employees, all modules');
doc.moveDown(0.3);

const medItems = [
  { item: 'Monthly Subscription (Professional)', detail: 'ZMW 15,000 per month', value: 'ZMW 180,000' },
  { item: 'Setup and Implementation', detail: 'System setup, data migration, training', value: 'ZMW 200,000' },
  { item: 'Integration Service', detail: 'Connect to existing systems', value: 'ZMW 60,000' }
];

let medY = doc.y + 10;
medItems.forEach(item => {
  doc.fontSize(10).font('Helvetica').fillColor(white).text(item.item, 50, medY);
  doc.fontSize(9).font('Helvetica').fillColor(turquoise).text(item.detail, 50, medY + 18);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(gold).text(item.value, 400, medY + 18);
  medY += 45;
});

medY += 5;
doc.moveTo(50, medY).lineTo(520, medY).stroke(turquoise).lineWidth(2);
doc.fontSize(13).font('Helvetica-Bold').fillColor(white).text('Year 1 Total Cost', 50, medY + 10);
doc.fontSize(13).font('Helvetica-Bold').fillColor(gold).text('ZMW 440,000', 400, medY + 10);

// ===== PAGE 5: COMPETITIVE COMPARISON =====
newPage();

doc.fillColor(darkBg).rect(0, 0, 595, 842).fill();

addTitle('Competitive Pricing Analysis');

addBodyText('Annual cost comparison for professional plans (10 users, all modules)');

doc.moveDown(0.5);

// Comparison table
const competitors = [
  { name: 'ZAI FLOW', monthly: 15000, annual: 180000, setup: 50000, total: 230000 },
  { name: 'ZamTech ERP', monthly: 40000, annual: 480000, setup: 300000, total: 780000 },
  { name: 'AfricaFlow Pro', monthly: 50000, annual: 600000, setup: 500000, total: 1100000 },
  { name: 'SmartBiz Systems', monthly: 45000, annual: 540000, setup: 400000, total: 940000 }
];

const tableY = doc.y + 20;
const colW = [140, 120, 120, 120, 90];

// Header
let tX = 50;
['System', 'Monthly', 'Annual', 'Setup', 'Year 1 Total'].forEach((h, i) => {
  doc.fillColor(turquoise).rect(tX, tableY, colW[i], 30).fill();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(darkBg).text(h, tX + 5, tableY + 8, { width: colW[i] - 10 });
  tX += colW[i];
});

// Data rows
let rowY = tableY + 30;
competitors.forEach((comp, idx) => {
  const bgColor = comp.name === 'ZAI FLOW' ? turquoise : purple;
  const opacity = comp.name === 'ZAI FLOW' ? 0.25 : 0.12;

  tX = 50;
  const row = [comp.name, 'ZMW ' + (comp.monthly / 1000).toFixed(0) + 'k', 'ZMW ' + (comp.annual / 1000).toFixed(0) + 'k', 'ZMW ' + (comp.setup / 1000).toFixed(0) + 'k', 'ZMW ' + (comp.total / 1000).toFixed(0) + 'k'];

  row.forEach((cell, i) => {
    doc.fillColor(bgColor).fillOpacity(opacity).rect(tX, rowY, colW[i], 28).fill();
    doc.strokeColor(bgColor).lineWidth(0.5).rect(tX, rowY, colW[i], 28).stroke();
    doc.fillOpacity(1);

    const textColor = comp.name === 'ZAI FLOW' ? gold : white;
    doc.fontSize(9).font('Helvetica').fillColor(textColor).text(cell, tX + 5, rowY + 8, { width: colW[i] - 10 });
    tX += colW[i];
  });

  rowY += 28;
});

doc.moveDown(3);

// Savings highlights
doc.fillColor(turquoise).fillOpacity(0.1).rect(50, doc.y, 495, 80).fill();
doc.strokeColor(turquoise).lineWidth(2).rect(50, doc.y, 495, 80).stroke();

doc.fontSize(14).font('Helvetica-Bold').fillColor(gold).text('Save ZMW 550K - 870K in Year 1', 65, doc.y + 15);
doc.fontSize(10).font('Helvetica').fillColor(white).text('ZAI FLOW Professional vs ZamTech (550K savings) vs AfricaFlow (870K savings)', 65, doc.y + 35, { width: 465 });
doc.fontSize(10).font('Helvetica').fillColor(white).text('That is a 70% cost reduction compared to competitors', 65, doc.y + 55, { width: 465 });

// ===== PAGE 6: PAYMENT & CONTACT =====
newPage();

doc.fillColor(darkBg).rect(0, 0, 595, 842).fill();

addTitle('Payment Options and Flexibility');

addSectionTitle('Subscription Payment Plans');

const paymentPlans = [
  {
    name: 'Monthly',
    desc: 'Pay as you go - No contract - Cancel anytime'
  },
  {
    name: 'Quarterly',
    desc: 'Save 5% with quarterly billing'
  },
  {
    name: 'Annual',
    desc: 'Save 10% with annual payment'
  }
];

let paymentY = doc.y + 15;
paymentPlans.forEach(plan => {
  doc.fillColor(purple).fillOpacity(0.15).rect(50, paymentY, 495, 50).fill();
  doc.strokeColor(turquoise).lineWidth(1).rect(50, paymentY, 495, 50).stroke();

  doc.fontSize(11).font('Helvetica-Bold').fillColor(turquoise).text(plan.name, 65, paymentY + 10);
  doc.fontSize(10).font('Helvetica').fillColor(white).text(plan.desc, 65, paymentY + 28);

  paymentY += 65;
});

addSectionTitle('Payment Methods');

const methods = ['Bank Transfer (All major banks)', 'Mobile Money (MTN, Airtel)', 'Debit and Credit Card', 'Cheque (large orders)'];
methods.forEach(m => addBullet(m));

doc.moveDown(1);

addSectionTitle('Get in Touch');

// Contact section - NO SPECIAL SYMBOLS
doc.fontSize(11).font('Helvetica').fillColor(lightGray).text('Email: ' + contact.email);
doc.moveDown(0.4);
doc.fontSize(11).font('Helvetica').fillColor(lightGray).text('Phone: ' + contact.phone);
doc.moveDown(0.4);
doc.fontSize(11).font('Helvetica').fillColor(lightGray).text('Website: ' + contact.website);

doc.moveDown(1);

// CTA
doc.fillColor(turquoise).rect(50, doc.y, 495, 50).fill();
doc.fontSize(13).font('Helvetica-Bold').fillColor(darkBg).text('Book Your FREE 30-Day Trial Today', 65, doc.y + 18);

// Footer
doc.moveDown(5);
doc.fontSize(9).font('Helvetica').fillColor('#666').text('ZAI FLOW 2.0 - The Most Affordable ERP for Zambia | zai-digital-studio.com', { align: 'center', width: 515 });

// Page numbers
const pages = doc.bufferedPageRange().count;
for (let i = 1; i <= pages; i++) {
  doc.switchToPage(i - 1);
  doc.fontSize(8).font('Helvetica').fillColor('#555').text(
    `Page ${i} of ${pages}`,
    50,
    doc.page.height - 25,
    { align: 'right', width: 495 }
  );
}

doc.end();

console.log(`✅ Clean Pricing Guide (no special symbols) generated: ${filename}`);
