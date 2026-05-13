const PDFDocument = require('pdfkit');
const fs = require('fs');

// Create PDF
const doc = new PDFDocument({
  size: 'A4',
  margin: 40,
  bufferPages: true
});

const filename = 'ZAI-FLOW-PRICING-GUIDE-ZAMBIA.pdf';
doc.pipe(fs.createWriteStream(filename));

// Colors
const primaryBlue = '#0052CC';
const accentBlue = '#1E7FD6';
const darkGray = '#1F2937';
const lightGray = '#F5F7FA';
const green = '#10B981';
const red = '#EF4444';
const orange = '#F59E0B';

// Helper functions
function addTitle(text) {
  doc.fontSize(32).font('Helvetica-Bold').fillColor(primaryBlue).text(text);
  doc.moveDown(0.5);
}

function addSubtitle(text) {
  doc.fontSize(16).font('Helvetica-Bold').fillColor(darkGray).text(text);
  doc.moveDown(0.3);
}

function addSectionTitle(text) {
  doc.moveDown(0.3);
  doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryBlue).text(text);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke(accentBlue).lineWidth(2).moveDown(0.3);
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
doc.fontSize(28).font('Helvetica-Bold').fillColor(primaryBlue).text('ZAI FLOW 2.0');
doc.fontSize(16).font('Helvetica').fillColor(accentBlue).text('Pricing Guide for Zambia');
doc.moveDown(0.5);
doc.fontSize(12).font('Helvetica').fillColor('#666').text('Effective Date: May 2026');

doc.moveDown(2);
doc.fontSize(14).font('Helvetica-Bold').fillColor(darkGray).text('PRICING IN ZMW (Zambian Kwacha)');
doc.moveDown(0.3);

// Key highlights
doc.fontSize(11).font('Helvetica').fillColor(darkGray).text('This document outlines the subscription plans, implementation costs, and pricing structure for ZAI FLOW 2.0 in Zambia.', { width: 515 });
doc.moveDown(1);

doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryBlue).text('Key Highlights:');
addBullet('60% cheaper than competitor systems');
addBullet('No long-term contracts required');
addBullet('All prices in ZMW');
addBullet('Payment plans available');
addBullet('Transparent pricing - no hidden fees');

// ========== PAGE 2: SUBSCRIPTION PLANS ==========
newPage();
addTitle('Subscription Plans');

addBodyText('Choose the plan that best fits your business needs. All plans include cloud hosting, automatic backups, and software updates.');

addSectionTitle('STARTER PLAN - ZMW 15,000/month');
doc.fontSize(11).font('Helvetica-Bold').fillColor(darkGray).text('Perfect for small businesses starting their digital transformation');
doc.moveDown(0.3);

const starterFeatures = [
  'Up to 5 users',
  'Basic modules (HR, Sales, Accounting)',
  'Cloud hosting (1GB storage)',
  'Email support (response within 24 hours)',
  'Monthly backups',
  'Basic reporting'
];

starterFeatures.forEach(f => addBullet(f));

doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica').fillColor(orange).text('Best for: Startups, Small shops, Service providers');

addSectionTitle('PROFESSIONAL PLAN - ZMW 45,000/month');
doc.fontSize(11).font('Helvetica-Bold').fillColor(darkGray).text('Most popular choice for growing businesses');
doc.moveDown(0.3);

const proFeatures = [
  'Up to 25 users',
  'All core modules (HR, Sales, Accounting, Inventory, Purchasing)',
  'Cloud hosting (50GB storage)',
  'Priority email & phone support',
  'Daily backups with point-in-time recovery',
  'Custom reports and dashboards',
  'API access for integrations',
  'Mobile app access',
  'User training included'
];

proFeatures.forEach(f => addBullet(f));

doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica').fillColor(green).text('Best for: Small-medium enterprises (SMEs), Growing companies');

addSectionTitle('ENTERPRISE PLAN - ZMW 95,000/month');
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
  'Priority feature requests'
];

entFeatures.forEach(f => addBullet(f));

doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica').fillColor(primaryBlue).text('Best for: Large enterprises, Multi-branch operations');

// ========== PAGE 3: IMPLEMENTATION COSTS ==========
newPage();
addTitle('Implementation & Setup Costs');

addBodyText('One-time implementation costs to get your system up and running. These are separate from monthly subscription fees.');

addSectionTitle('Standard Implementation Package');

const implItems = [
  { item: 'System Setup & Configuration', price: 'ZMW 150,000', desc: 'Initial system setup, security configuration, and customization' },
  { item: 'Data Migration Service', price: 'ZMW 200,000', desc: 'Export data from legacy systems, cleaning, and import to ZAI FLOW' },
  { item: 'User Training (per person)', price: 'ZMW 5,000', desc: 'Hands-on training for employees on system usage' },
  { item: 'Staff Training Session (group)', price: 'ZMW 50,000', desc: 'Full team training workshop (up to 20 people)' },
  { item: 'Customization (per hour)', price: 'ZMW 15,000', desc: 'Custom reports, workflows, or module modifications' },
  { item: 'Integration Service (per system)', price: 'ZMW 100,000', desc: 'Integration with existing third-party systems' }
];

let implY = doc.y;
implItems.forEach(item => {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryBlue).text(item.item, 40, implY);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(green).text(item.price, 350, implY);
  doc.fontSize(9).font('Helvetica').fillColor('#666').text(item.desc, 40, implY + 20, { width: 475 });
  implY = doc.y + 15;
});

addSectionTitle('Typical Implementation Timeline & Cost');

doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Example: Small Business (10 employees, basic modules)');
doc.moveDown(0.2);

const timeline = [
  { task: 'System Setup', duration: '3 days', cost: 'ZMW 150,000' },
  { task: 'Data Migration', duration: '5 days', cost: 'ZMW 200,000' },
  { task: 'Staff Training (10 people)', duration: '2 days', cost: 'ZMW 50,000' },
  { task: 'Customization', duration: '4 hours', cost: 'ZMW 60,000' }
];

let tY = doc.y + 15;
timeline.forEach(t => {
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(t.task, 50, tY);
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(t.duration, 300, tY);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryBlue).text(t.cost, 420, tY);
  tY += 20;
});

tY += 10;
doc.moveTo(50, tY).lineTo(520, tY).stroke('#E0E7FF');
doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryBlue).text('Total First-Year Implementation', 50, tY + 10);
doc.fontSize(11).font('Helvetica-Bold').fillColor(green).text('ZMW 460,000', 420, tY + 10);

// ========== PAGE 4: PRICING EXAMPLES ==========
newPage();
addTitle('Pricing Examples by Business Size');

addBodyText('Total cost of ownership including subscription and implementation for year 1');

// Small Business
addSectionTitle('Small Business (5-10 employees)');
const smallCalc = [
  { item: 'Monthly Subscription (Starter)', monthly: 15000, annual: 180000 },
  { item: 'Implementation Costs', once: 460000 },
  { item: 'Annual Support Cost', annual: 0 }
];

let calcY = doc.y;
smallCalc.forEach(calc => {
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(calc.item, 50, calcY);
  if (calc.once) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryBlue).text('ZMW ' + calc.once.toLocaleString(), 350, calcY);
  } else if (calc.annual) {
    doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('ZMW ' + calc.monthly.toLocaleString() + '/month', 300, calcY);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryBlue).text('ZMW ' + calc.annual.toLocaleString(), 420, calcY);
  }
  calcY += 20;
});
calcY += 10;
doc.moveTo(50, calcY).lineTo(520, calcY).stroke('#E0E7FF');
doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryBlue).text('Total Year 1 Cost', 50, calcY + 10);
doc.fontSize(12).font('Helvetica-Bold').fillColor(green).text('ZMW 640,000', 420, calcY + 10);
doc.moveDown(2);

// Medium Business
addSectionTitle('Medium Business (20-30 employees)');
const medCalc = [
  { item: 'Monthly Subscription (Professional)', monthly: 45000, annual: 540000 },
  { item: 'Implementation Costs', once: 500000 },
  { item: 'Custom Integrations (2 systems)', once2: 200000 },
  { item: 'Annual Support Cost', annual: 0 }
];

calcY = doc.y;
medCalc.forEach(calc => {
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(calc.item, 50, calcY);
  if (calc.once) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryBlue).text('ZMW ' + calc.once.toLocaleString(), 350, calcY);
  } else if (calc.once2) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryBlue).text('ZMW ' + calc.once2.toLocaleString(), 350, calcY);
  } else if (calc.annual) {
    doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('ZMW ' + calc.monthly.toLocaleString() + '/month', 300, calcY);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryBlue).text('ZMW ' + calc.annual.toLocaleString(), 420, calcY);
  }
  calcY += 20;
});
calcY += 10;
doc.moveTo(50, calcY).lineTo(520, calcY).stroke('#E0E7FF');
doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryBlue).text('Total Year 1 Cost', 50, calcY + 10);
doc.fontSize(12).font('Helvetica-Bold').fillColor(green).text('ZMW 1,240,000', 420, calcY + 10);

// ========== PAGE 5: COST COMPARISON ==========
newPage();
addTitle('Cost Comparison: ZAI FLOW vs Competitors');

addBodyText('Annual total cost of ownership comparison for a typical medium business (25 users, all modules)');

doc.moveDown(0.5);

// Comparison table
const tableY = doc.y;
const headers = ['Metric', 'ZAI FLOW', 'Competitor A', 'Competitor B'];
const colWidths = [130, 120, 120, 120];

// Header row
let tableX = 50;
headers.forEach((h, i) => {
  doc.fillColor(primaryBlue).rect(tableX, tableY, colWidths[i], 30).fill();
  doc.fontSize(10).font('Helvetica-Bold').fillColor('white').text(h, tableX + 5, tableY + 8, { width: colWidths[i] - 10 });
  tableX += colWidths[i];
});

// Data rows
const compData = [
  ['Monthly Subscription', 'ZMW 45k', 'ZMW 120k', 'ZMW 150k'],
  ['Annual Subscription', 'ZMW 540k', 'ZMW 1,440k', 'ZMW 1,800k'],
  ['Setup Cost', 'ZMW 500k', 'ZMW 2,000k', 'ZMW 3,000k'],
  ['Training Cost', 'ZMW 200k', 'ZMW 500k', 'ZMW 750k'],
  ['Total Year 1', 'ZMW 1,240k', 'ZMW 3,940k', 'ZMW 5,550k'],
  ['Your Savings', '—', 'ZMW 2,700k', 'ZMW 4,310k'],
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
      textColor = primaryBlue;
      textFont = 'Helvetica-Bold';
    }
    if (cellIdx === 1 && (isTotal || isSavings)) {
      textColor = green;
    }

    doc.fontSize(9).font(textFont).fillColor(textColor).text(cell, tableX + 5, rowY + 7, { width: colWidths[cellIdx] - 10 });
    tableX += colWidths[cellIdx];
  });

  rowY += 25;
});

doc.moveDown(2);
doc.fontSize(12).font('Helvetica-Bold').fillColor(green).text('ZAI FLOW saves you ZMW 2.7M - 4.3M in Year 1!');

// ========== PAGE 6: PAYMENT OPTIONS ==========
newPage();
addTitle('Payment Terms & Options');

addSectionTitle('Subscription Payment Options');

addBodyText('We offer flexible payment options to accommodate different business needs:');
doc.moveDown(0.3);

const paymentOptions = [
  {
    method: 'Monthly Payment',
    desc: 'Pay monthly subscription based on your chosen plan. No long-term commitment required.',
    features: ['Flexible', 'No contract', 'Cancel anytime']
  },
  {
    method: 'Quarterly Payment',
    desc: 'Save 5% by paying for 3 months upfront. Great for planning quarterly budgets.',
    features: ['5% discount', 'Better forecast', 'Quarterly billing']
  },
  {
    method: 'Annual Payment',
    desc: 'Save 10% by paying for the full year upfront. Best value for committed businesses.',
    features: ['10% discount', 'Maximum savings', 'Annual billing']
  }
];

paymentOptions.forEach(opt => {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryBlue).text(opt.method);
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(opt.desc, { width: 475 });
  opt.features.forEach(f => addBullet(f));
  doc.moveDown(0.3);
});

addSectionTitle('Payment Methods');

const methods = ['Bank Transfer (Standard Chartered, Zanaco, etc.)', 'Mobile Money (MTN, Airtel)', 'Credit/Debit Card', 'Cheque (for large organizations)'];

methods.forEach(m => addBullet(m));

addSectionTitle('Implementation Cost Payment');

addBodyText('Implementation costs can be paid as follows:');
addBullet('50% upfront upon agreement');
addBullet('50% upon system go-live');

addBodyText('Or negotiate custom payment plans for Enterprise customers.');

// ========== PAGE 7: ADDITIONAL SERVICES ==========
newPage();
addTitle('Additional Services & Add-ons');

addSectionTitle('Module Add-ons');

const addOns = [
  { name: 'Advanced Analytics Module', price: 'ZMW 15,000/month', desc: 'Predictive analytics, ML insights, advanced dashboards' },
  { name: 'Supply Chain Module', price: 'ZMW 10,000/month', desc: 'Advanced inventory forecasting and supply chain optimization' },
  { name: 'CRM Module', price: 'ZMW 12,000/month', desc: 'Customer relationship management with sales pipeline' },
  { name: 'Fixed Assets Module', price: 'ZMW 8,000/month', desc: 'Depreciation tracking and asset management' }
];

addOns.forEach(ao => {
  doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryBlue).text(ao.name);
  doc.fontSize(10).font('Helvetica').fillColor(green).text(ao.price);
  doc.fontSize(9).font('Helvetica').fillColor('#666').text(ao.desc);
  doc.moveDown(0.4);
});

addSectionTitle('Professional Services');

const services = [
  { service: 'Custom Report Development', price: 'ZMW 10,000 - 30,000 per report' },
  { service: 'Workflow Automation Setup', price: 'ZMW 20,000 - 50,000 per workflow' },
  { service: 'On-site Training (per day)', price: 'ZMW 80,000 - 150,000' },
  { service: 'System Optimization Review', price: 'ZMW 50,000 - 100,000' },
  { service: 'API Integration Development', price: 'ZMW 15,000/hour' }
];

services.forEach(svc => {
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(svc.service, 50, doc.y);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryBlue).text(svc.price, 350, doc.y);
  doc.moveDown(0.5);
});

// ========== PAGE 8: SPECIAL OFFERS & DISCOUNTS ==========
newPage();
addTitle('Special Offers & Discounts');

addSectionTitle('Volume Discounts');

addBodyText('For organizations with multiple branches or departments:');

const volumeDiscounts = [
  { users: '25-50 users', discount: '5% discount on Professional plan' },
  { users: '51-100 users', discount: '10% discount + move to Enterprise plan' },
  { users: '100+ users', discount: '15% discount + custom Enterprise pricing' }
];

volumeDiscounts.forEach(vd => {
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(vd.users, 50, doc.y);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(green).text(vd.discount, 200, doc.y);
  doc.moveDown(0.5);
});

addSectionTitle('Seasonal Promotions');

doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Q1 Launch Special (Jan-Mar 2026)');
doc.moveDown(0.2);
addBullet('50% off implementation costs for new customers');
addBullet('Free training for all staff (unlimited people)');
addBullet('Free integration with one legacy system');

doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Government & Non-Profit Discount');
doc.moveDown(0.2);
addBullet('20% discount on all subscription plans');
addBullet('Special training programs available');
addBullet('Flexible payment terms');

addSectionTitle('Free Trial');

addBodyText('Try ZAI FLOW completely free for 30 days with all Professional features enabled. No credit card required, no strings attached. Just contact us to get started.');

// ========== PAGE 9: FAQ ==========
newPage();
addTitle('Frequently Asked Questions');

const faqs = [
  {
    q: 'Can I upgrade or downgrade my plan anytime?',
    a: 'Yes! You can change your plan anytime. Upgrades take effect immediately. Downgrades take effect at the start of your next billing cycle.'
  },
  {
    q: 'Is there a minimum contract period?',
    a: 'No. ZAI FLOW operates on a month-to-month basis. You can cancel anytime with 30 days notice.'
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'We will provide a full data export in standard formats. Your data is always yours - we make it easy to leave if you choose to.'
  },
  {
    q: 'Are there any hidden fees?',
    a: 'No. Our pricing is completely transparent. The only costs are the subscription fee and optional add-on services you choose.'
  },
  {
    q: 'Do you offer discounts for non-profit organizations?',
    a: 'Yes! We offer 20% discount for registered non-profit organizations. Contact our sales team with proof of registration.'
  },
  {
    q: 'What support is included in each plan?',
    a: 'Starter: Email support (24hr response). Professional: Priority support (4hr response). Enterprise: 24/7 dedicated support.'
  }
];

faqs.forEach(faq => {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryBlue).text('Q: ' + faq.q);
  doc.moveDown(0.2);
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('A: ' + faq.a, { width: 475 });
  doc.moveDown(0.5);
});

// ========== PAGE 10: CONTACT & NEXT STEPS ==========
newPage();
addTitle('Ready to Get Started?');

doc.moveDown(0.5);

addSectionTitle('Next Steps');

const steps = [
  '1. Schedule a 30-minute demo call (free, no obligation)',
  '2. Discuss your specific business needs',
  '3. Receive a customized quote for your organization',
  '4. Sign agreement and begin implementation',
  '5. Go live in 2-4 weeks'
];

steps.forEach(step => {
  doc.fontSize(11).font('Helvetica').fillColor(darkGray).text(step);
  doc.moveDown(0.4);
});

addSectionTitle('Contact Information');

const contactInfo = [
  { label: 'Phone', value: '+260 96 123 4567' },
  { label: 'Email', value: 'sales@zaiflow.zm' },
  { label: 'Website', value: 'www.zaiflow.zm' },
  { label: 'Office', value: 'Plot 2847, Independence Avenue, Lusaka, Zambia' }
];

contactInfo.forEach(ci => {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryBlue).text(ci.label + ':');
  doc.fontSize(11).font('Helvetica').fillColor(darkGray).text(ci.value);
  doc.moveDown(0.3);
});

doc.moveDown(1);
doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryBlue).text('Schedule Your Free Demo Today!');
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('See ZAI FLOW in action. Discover how we can help your business grow.');

// Footer
doc.moveDown(1.5);
doc.fontSize(9).font('Helvetica').fillColor('#999').text('———————————————————————————', { align: 'center' });
doc.fontSize(9).font('Helvetica').fillColor('#999').text('ZAI FLOW 2.0 - Enterprise Resource Planning System', { align: 'center' });
doc.fontSize(9).font('Helvetica').fillColor('#999').text('Pricing Guide for Zambia | May 2026', { align: 'center' });

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

console.log(`✅ Pricing Guide generated: ${filename}`);
