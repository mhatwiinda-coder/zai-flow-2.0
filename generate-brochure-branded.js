const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Create PDF
const doc = new PDFDocument({
  size: 'A4',
  margin: 0,
  bufferPages: true
});

// Pipe to file
const filename = 'ZAI-FLOW-BROCHURE-ZAMBIA-BRANDED.pdf';
doc.pipe(fs.createWriteStream(filename));

// Brand colors from actual logo
const primaryTurquoise = '#40C9D6';  // Main brand color
const secondaryRed = '#A82D3A';      // Accent color
const accentGold = '#f7c948';        // Highlight color
const darkNavy = '#0c2a44';          // Dark background
const darkSidebar = '#081826';       // Very dark
const textLight = '#cfd8e3';         // Light text
const textWhite = '#FFFFFF';
const darkGray = '#1F2937';
const lightGray = '#F5F7FA';

// Contact info
const contact = {
  email: 'mhatwiinda@gmail.com',
  phone: '+260971810616',
  web: 'zai-digital-studio.com'
};

// Helper functions
function drawBlueBox(x, y, width, height, color = primaryTurquoise) {
  doc.fillColor(color).rect(x, y, width, height).fill();
}

function addHeading(text, size = 32, color = textWhite) {
  doc.fontSize(size).font('Helvetica-Bold').fillColor(color).text(text);
}

function addSubHeading(text, size = 18, color = textWhite) {
  doc.fontSize(size).font('Helvetica-Bold').fillColor(color).text(text);
}

function addBodyText(text, size = 11, color = darkGray) {
  doc.fontSize(size).font('Helvetica').fillColor(color).text(text, { width: 470, lineGap: 3 });
}

function addBullet(text, color = darkGray) {
  doc.fontSize(11).font('Helvetica').fillColor(color).text('  ✓ ' + text, { lineGap: 2, width: 470 });
}

function newPage() {
  doc.addPage();
}

// ========== PAGE 1: COVER ==========
drawBlueBox(0, 0, 595, 842, darkNavy);

// Top accent bar
drawBlueBox(0, 0, 595, 80, primaryTurquoise);

// Logo placeholder (text-based since we're working with PDF)
doc.fontSize(36).font('Helvetica-Bold').fillColor(secondaryRed).text('ZAI', 50, 20);
doc.fontSize(24).font('Helvetica').fillColor(textWhite).text('FLOW', 130, 35);

// Diagonal accent
doc.moveTo(450, 0).lineTo(595, 120).stroke(secondaryRed).lineWidth(4);

// Main content on dark background
doc.fontSize(52).font('Helvetica-Bold').fillColor(primaryTurquoise).text('Business', 50, 200, { width: 495 });
doc.fontSize(52).font('Helvetica-Bold').fillColor(secondaryRed).text('Automation', 50, 260, { width: 495 });

doc.fontSize(14).font('Helvetica').fillColor(textLight).text('Enterprise Resource Planning Solution', 50, 330, { width: 495 });
doc.fontSize(12).font('Helvetica').fillColor(accentGold).text('For Modern Businesses in Zambia', 50, 355, { width: 495 });

// Bottom section with new pricing highlight
drawBlueBox(0, 600, 595, 242, secondaryRed);

doc.fontSize(44).font('Helvetica-Bold').fillColor(textWhite).text('50% CHEAPER', 50, 620);
doc.fontSize(14).font('Helvetica').fillColor(accentGold).text('Than competitor systems', 50, 680);

doc.fontSize(12).font('Helvetica').fillColor(textLight).text('Start from just ZMW 5,000/month • Professional plans at ZMW 15,000/month', 50, 710, { width: 495 });

doc.fontSize(11).font('Helvetica-Bold').fillColor(textWhite).text('Affordable ERP for every Zambian business', 50, 750);

// ========== PAGE 2: FEATURES ==========
newPage();

// Header
drawBlueBox(0, 0, 595, 60, primaryTurquoise);
doc.fontSize(20).font('Helvetica-Bold').fillColor(textWhite).text('AFFORDABLE SOLUTIONS', 50, 18);

doc.moveDown(2);

// Feature grid
const features = [
  { title: 'HR & Payroll', emoji: '👥', desc: 'Complete employee management with automated payroll' },
  { title: 'Sales', emoji: '💼', desc: 'Order management and customer tracking' },
  { title: 'Accounting', emoji: '📊', desc: 'General ledger and financial reporting' },
  { title: 'Inventory', emoji: '📦', desc: 'Real-time stock tracking and management' },
  { title: 'Purchasing', emoji: '🛒', desc: 'Purchase orders and vendor management' },
  { title: 'Analytics', emoji: '📈', desc: 'Real-time dashboards and insights' }
];

let featureY = 90;
features.forEach((feat, idx) => {
  const isEven = idx % 2 === 0;
  const xPos = isEven ? 50 : 325;

  // Draw box
  doc.fillColor(lightGray).rect(xPos, featureY, 220, 110).stroke(primaryTurquoise).lineWidth(2);

  // Emoji
  doc.fontSize(28).text(feat.emoji, xPos + 15, featureY + 10);

  // Title
  doc.fontSize(12).font('Helvetica-Bold').fillColor(secondaryRed).text(feat.title, xPos + 50, featureY + 15);

  // Description
  doc.fontSize(9).font('Helvetica').fillColor(darkGray).text(feat.desc, xPos + 15, featureY + 40, { width: 190 });

  if (isEven && idx < features.length - 1) {
    featureY += 130;
  }
});

// Why choose us
doc.moveDown(2);
drawBlueBox(50, doc.y, 495, 2, primaryTurquoise);
doc.moveDown(0.5);

doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryTurquoise).text('Why Choose ZAI FLOW?');
doc.moveDown(0.3);

const reasons = [
  '✓ 50% cheaper than competitors',
  '✓ Go live in just 2 weeks',
  '✓ Complete data integration',
  '✓ 24/7 support included',
  '✓ No hidden fees'
];

reasons.forEach(r => {
  doc.fontSize(11).font('Helvetica').fillColor(darkGray).text(r);
});

// ========== PAGE 3: PRICING ==========
newPage();

drawBlueBox(0, 0, 595, 70, darkNavy);
doc.fontSize(32).font('Helvetica-Bold').fillColor(primaryTurquoise).text('COMPETITIVE PRICING', 50, 18);

doc.moveDown(2);

doc.fontSize(11).font('Helvetica').fillColor(darkGray).text('Simple, transparent pricing in ZMW. All prices include cloud hosting and support.', 50, 90);

// Pricing boxes - NOW MUCH CHEAPER
const pricingBoxes = [
  {
    name: 'STARTER',
    price: '5,000',
    period: 'per month',
    subtitle: 'For Solopreneurs',
    features: [
      'Up to 2 users',
      'Basic modules',
      'Email support',
      'Cloud hosting'
    ],
    isBest: false
  },
  {
    name: 'PROFESSIONAL',
    price: '15,000',
    period: 'per month',
    subtitle: 'Most Popular',
    features: [
      'Up to 10 users',
      'All core modules',
      'Priority support',
      'Cloud hosting',
      'Custom reports',
      'API access'
    ],
    isBest: true
  },
  {
    name: 'ENTERPRISE',
    price: '45,000',
    period: 'per month',
    subtitle: 'For Large Teams',
    features: [
      'Unlimited users',
      'All modules',
      '24/7 support',
      'Cloud or on-premise',
      'Custom development',
      'Dedicated manager'
    ],
    isBest: false
  }
];

let boxX = 50;
const boxWidth = 160;

pricingBoxes.forEach((pkg, idx) => {
  const bgColor = pkg.isBest ? primaryTurquoise : lightGray;
  const textColor = pkg.isBest ? textWhite : darkGray;
  const priceColor = pkg.isBest ? accentGold : secondaryRed;

  // Main box
  doc.fillColor(bgColor).rect(boxX, 130, boxWidth, 360).fill();
  doc.strokeColor(secondaryRed).lineWidth(pkg.isBest ? 3 : 1).rect(boxX, 130, boxWidth, 360).stroke();

  // Badge
  if (pkg.isBest) {
    drawBlueBox(boxX + 20, 145, 120, 20, secondaryRed);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(textWhite).text('⭐ RECOMMENDED', boxX + 25, 148, { width: 110 });
  }

  // Plan name
  doc.fontSize(13).font('Helvetica-Bold').fillColor(textColor).text(pkg.name, boxX + 10, 175, { width: boxWidth - 20 });

  // Subtitle
  doc.fontSize(9).font('Helvetica').fillColor(pkg.isBest ? accentGold : '#999').text(pkg.subtitle, boxX + 10, 195, { width: boxWidth - 20 });

  // Price
  doc.fontSize(18).font('Helvetica-Bold').fillColor(priceColor).text('ZMW ' + pkg.price, boxX + 10, 220, { width: boxWidth - 20 });
  doc.fontSize(9).font('Helvetica').fillColor(textColor).text(pkg.period, boxX + 10, 245, { width: boxWidth - 20 });

  // Features
  let fY = 270;
  pkg.features.forEach(feature => {
    doc.fontSize(8).font('Helvetica').fillColor(textColor).text('✓ ' + feature, boxX + 10, fY, { width: boxWidth - 20 });
    fY += 16;
  });

  boxX += boxWidth + 20;
});

// Implementation note
doc.moveDown(28);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Setup: ZMW 50,000 (one-time) | Training: ZMW 3,000 per person', 50, doc.y);

// ========== PAGE 4: COMPARISON ==========
newPage();

drawBlueBox(0, 0, 595, 70, darkNavy);
doc.fontSize(32).font('Helvetica-Bold').fillColor(primaryTurquoise).text('PRICE COMPARISON', 50, 18);

doc.moveDown(2);

// Comparison table
const tableY = 100;
const cols = [
  { header: 'Feature', width: 130 },
  { header: 'ZAI FLOW', width: 120, color: primaryTurquoise },
  { header: 'Competitor A', width: 120, color: darkGray },
  { header: 'Competitor B', width: 120, color: darkGray }
];

let tableX = 50;
// Header
cols.forEach((col, idx) => {
  const bgColor = idx === 0 ? darkNavy : col.color;
  doc.fillColor(bgColor).rect(tableX, tableY, col.width, 30).fill();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(textWhite).text(col.header, tableX + 5, tableY + 8, { width: col.width - 10 });
  tableX += col.width;
});

// Data rows
const comparisonData = [
  ['Monthly Cost', 'ZMW 15k', 'ZMW 40k', 'ZMW 50k'],
  ['Setup Cost', 'ZMW 50k', 'ZMW 300k', 'ZMW 500k'],
  ['All Modules', '✓', '✗', '✓'],
  ['Support 24/7', '✓', '✗', '✓'],
  ['Mobile App', '✓', '✗', '✓'],
  ['Training Included', '✓', '✗', '✗']
];

let rowY = tableY + 30;
comparisonData.forEach((row, ridx) => {
  const bgColor = ridx % 2 === 0 ? '#F5F7FA' : textWhite;

  tableX = 50;
  row.forEach((cell, cidx) => {
    doc.fillColor(bgColor).rect(tableX, rowY, cols[cidx].width, 25).fill();

    let cellColor = darkGray;
    let cellFont = 'Helvetica';
    if (cidx === 1) {
      cellColor = primaryTurquoise;
      cellFont = 'Helvetica-Bold';
    }

    doc.fontSize(9).font(cellFont).fillColor(cellColor).text(cell, tableX + 5, rowY + 7, { width: cols[cidx].width - 10 });
    tableX += cols[cidx].width;
  });

  rowY += 25;
});

// Savings highlight
doc.fillColor(lightGray).rect(50, rowY + 15, 495, 50).fill();
doc.fillColor(secondaryRed).rect(50, rowY + 15, 495, 50).stroke().lineWidth(2);

doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryTurquoise).text('SAVE ZMW 300K+ IN YEAR 1', 60, rowY + 25);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Professional plan vs Competitor A - includes setup, monthly fees, and support', 60, rowY + 42, { width: 475 });

// ========== PAGE 5: BENEFITS & CONTACT ==========
newPage();

drawBlueBox(0, 0, 595, 80, darkNavy);
doc.fontSize(32).font('Helvetica-Bold').fillColor(primaryTurquoise).text('GET STARTED TODAY', 50, 18);

doc.moveDown(2);

// Benefits section
doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryTurquoise).text('Why Zambian Businesses Choose ZAI FLOW:', 50, 100);
doc.moveDown(0.3);

const benefits = [
  'Designed for Zambian businesses - understands local requirements',
  'Affordable payment plans - as low as ZMW 5,000/month',
  'Fast implementation - go live in 2 weeks',
  'Local support team - in Lusaka, speaks your language',
  'No expensive hardware needed - cloud-based',
  '30-day money-back guarantee - risk-free trial'
];

benefits.forEach(b => {
  doc.fontSize(11).font('Helvetica').fillColor(darkGray).text('→ ' + b);
  doc.moveDown(0.4);
});

doc.moveDown(0.5);

// Contact section
drawBlueBox(50, doc.y, 495, 2, primaryTurquoise);
doc.moveDown(0.5);

doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryTurquoise).text('Contact Us', 50, doc.y);
doc.moveDown(0.3);

const contactItems = [
  { icon: '📧', label: 'Email:', value: contact.email },
  { icon: '📱', label: 'Phone:', value: contact.phone },
  { icon: '🌐', label: 'Website:', value: contact.web }
];

contactItems.forEach(ci => {
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(ci.icon + ' ' + ci.label + ' ' + ci.value);
  doc.moveDown(0.4);
});

doc.moveDown(0.5);

// CTA
drawBlueBox(50, doc.y, 495, 40, primaryTurquoise);
doc.fontSize(12).font('Helvetica-Bold').fillColor(textWhite).text('📅 Schedule Your FREE 30-Day Trial Today', 60, doc.y + 12);

// Footer
doc.moveDown(3);
doc.fontSize(9).font('Helvetica').fillColor('#999').text('ZAI FLOW 2.0 - The Most Affordable ERP for Zambian Businesses', 50, doc.y, { align: 'center', width: 495 });

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

console.log(`✅ Branded Brochure generated: ${filename}`);
