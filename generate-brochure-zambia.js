const PDFDocument = require('pdfkit');
const fs = require('fs');

// Create PDF
const doc = new PDFDocument({
  size: 'A4',
  margin: 0,
  bufferPages: true
});

// Pipe to file
const filename = 'ZAI-FLOW-BROCHURE-ZAMBIA.pdf';
doc.pipe(fs.createWriteStream(filename));

// Define colors
const primaryBlue = '#0052CC';
const darkBlue = '#003A99';
const lightBlue = '#E3F0FF';
const accentBlue = '#1E7FD6';
const darkGray = '#1F2937';
const lightGray = '#F5F7FA';
const white = '#FFFFFF';

// Helper functions
function drawBlueBox(x, y, width, height, opacity = 1) {
  doc.fillOpacity(opacity).fillColor(primaryBlue).rect(x, y, width, height).fill();
  doc.fillOpacity(1);
}

function drawGradientBackground(x, y, width, height) {
  // Simulate gradient with multiple rectangles
  for (let i = 0; i < 10; i++) {
    const gradient = 0.052 + (i * 0.01);
    doc.fillOpacity(gradient).fillColor(primaryBlue).rect(x, y + (i * height / 10), width, height / 10).fill();
  }
  doc.fillOpacity(1);
}

function addHeading(text, size = 32, color = primaryBlue) {
  doc.fontSize(size).font('Helvetica-Bold').fillColor(color).text(text);
}

function addSubHeading(text, size = 20, color = darkGray) {
  doc.fontSize(size).font('Helvetica-Bold').fillColor(color).text(text);
}

function addBodyText(text, size = 11, color = darkGray) {
  doc.fontSize(size).font('Helvetica').fillColor(color).text(text, { align: 'left', lineGap: 3 });
}

function addBullet(text, color = darkGray) {
  doc.fontSize(11).font('Helvetica').fillColor(color).text('  ▪ ' + text, { lineGap: 2 });
}

function newPage() {
  doc.addPage();
}

// ========== PAGE 1: COVER ==========
drawBlueBox(0, 0, 595, 842);
doc.moveTo(0, 0).lineTo(595, 0).lineTo(595, 100).lineTo(0, 100).fill();

// Logo area
doc.fontSize(24).font('Helvetica-Bold').fillColor(white).text('ZAI', 50, 30, { width: 495 });
doc.fontSize(18).font('Helvetica').fillColor(accentBlue).text('FLOW', 50, 60, { width: 495 });

// Diagonal accent line
doc.moveTo(450, 0).lineTo(595, 150).stroke(accentBlue).lineWidth(3);

// Main content
doc.fontSize(48).font('Helvetica-Bold').fillColor(white).text('Business', 50, 200, { width: 495 });
doc.fontSize(48).font('Helvetica-Bold').fillColor(accentBlue).text('Automation', 50, 250, { width: 495 });

doc.fontSize(14).font('Helvetica').fillColor(lightBlue).text('Enterprise Resource Planning Solution', 50, 310, { width: 495 });
doc.fontSize(12).font('Helvetica').fillColor(white).text('For Modern Businesses in Zambia', 50, 335, { width: 495 });

// Bottom section
drawBlueBox(0, 650, 595, 192);
doc.fontSize(36).font('Helvetica-Bold').fillColor(white).text('01', 50, 680);

doc.fontSize(14).font('Helvetica-Bold').fillColor(accentBlue).text('Professional ERP Solution', 50, 740);
doc.fontSize(11).font('Helvetica').fillColor(lightBlue).text('Streamline your operations with ZAI FLOW - the most affordable enterprise system in Zambia', 50, 765, { width: 450 });

// ========== PAGE 2: CONTENT & FEATURES ==========
newPage();

// Header
drawBlueBox(0, 0, 595, 60);
doc.fontSize(20).font('Helvetica-Bold').fillColor(white).text('KEY FEATURES', 50, 18);

doc.moveDown(3);

// Two column layout
const col1X = 50;
const col2X = 320;

// Feature 1
doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryBlue).text('HR & Payroll', col1X, 80);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Complete employee management with automated payroll processing, attendance tracking, and compliance reporting.', col1X, 100, { width: 250 });

// Feature 2
doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryBlue).text('Sales Management', col2X, 80);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Order management, customer tracking, and sales analytics all in one place. Real-time sales insights.', col2X, 100, { width: 250 });

// Feature 3
doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryBlue).text('Accounting', col1X, 180);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('General ledger, journal entries, and financial reporting. Tax-compliant with audit trails.', col1X, 200, { width: 250 });

// Feature 4
doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryBlue).text('Inventory Control', col2X, 180);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Real-time stock tracking, warehouse management, and automated reorder calculations.', col2X, 200, { width: 250 });

// Feature 5
doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryBlue).text('Purchasing', col1X, 280);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Purchase orders, vendor management, goods receipt, and three-way invoice matching.', col1X, 300, { width: 250 });

// Feature 6
doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryBlue).text('Analytics', col2X, 280);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Real-time dashboards, business intelligence, and customizable reports for decision making.', col2X, 300, { width: 250 });

// Divider
doc.moveTo(50, 380).lineTo(545, 380).stroke('#E0E7FF').lineWidth(1);

// Benefits section
doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryBlue).text('Why Choose ZAI FLOW?', 50, 410);

const benefits = [
  '✓ 60% cheaper than competitor systems',
  '✓ Fast deployment - Go live in 2 weeks',
  '✓ Complete data integration',
  '✓ Mobile-friendly interface',
  '✓ 24/7 support included',
  '✓ Cloud-based - No hardware required'
];

let bY = 440;
benefits.forEach(benefit => {
  doc.fontSize(11).font('Helvetica').fillColor(darkGray).text(benefit);
  bY += 25;
});

// ========== PAGE 3: MODULES DETAILED ==========
newPage();

// Header with blue background
drawBlueBox(0, 0, 595, 50);
doc.fontSize(18).font('Helvetica-Bold').fillColor(white).text('COMPLETE MODULES', 50, 15);

// Module 1
drawBlueBox(50, 70, 10, 80);
doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryBlue).text('02 HR & PAYROLL', 70, 75);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Employee management • Attendance • Payroll processing • Tax compliance • Leave management • Performance reviews', 70, 100, { width: 470 });

// Module 2
drawBlueBox(50, 170, 10, 80);
doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryBlue).text('03 SALES', 70, 175);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Sales orders • Customer management • Order tracking • Commission calculation • Sales analytics', 70, 200, { width: 470 });

// Module 3
drawBlueBox(50, 270, 10, 80);
doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryBlue).text('04 PURCHASING', 70, 275);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Purchase orders • Vendor management • Goods receipt • Three-way matching • Purchase analytics', 70, 300, { width: 470 });

// Module 4
drawBlueBox(50, 370, 10, 80);
doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryBlue).text('05 ACCOUNTING', 70, 375);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('General ledger • Journal entries • Financial reports • Tax reporting • Audit trails', 70, 400, { width: 470 });

// Module 5
drawBlueBox(50, 470, 10, 80);
doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryBlue).text('06 INVENTORY', 70, 475);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Stock tracking • Warehouse ops • Product catalog • Automated reordering • Inventory forecasting', 70, 500, { width: 470 });

// Module 6
drawBlueBox(50, 570, 10, 80);
doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryBlue).text('07 ANALYTICS', 70, 575);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Real-time dashboards • Business intelligence • Customizable reports • Data visualization', 70, 600, { width: 470 });

// ========== PAGE 4: PRICING ==========
newPage();

// Header
drawBlueBox(0, 0, 595, 70);
doc.fontSize(28).font('Helvetica-Bold').fillColor(white).text('PRICING GUIDE', 50, 20);

doc.moveDown(2);

// Pricing intro
doc.fontSize(12).font('Helvetica').fillColor(darkGray).text('Simple, Transparent Pricing - No Hidden Fees', 50, 90);
doc.fontSize(10).font('Helvetica').fillColor('#666').text('All prices in ZMW (Zambian Kwacha)', 50, 110);

// Price boxes
const pricingBoxes = [
  {
    name: 'STARTER',
    price: 'ZMW 15,000',
    period: 'per month',
    features: [
      'Up to 5 users',
      'Basic modules only',
      'Email support',
      'Cloud hosting'
    ]
  },
  {
    name: 'PROFESSIONAL',
    price: 'ZMW 45,000',
    period: 'per month',
    features: [
      'Up to 25 users',
      'All core modules',
      'Priority support',
      'Cloud hosting',
      'Custom reports',
      'API access'
    ]
  },
  {
    name: 'ENTERPRISE',
    price: 'ZMW 95,000',
    period: 'per month',
    features: [
      'Unlimited users',
      'All modules',
      '24/7 dedicated support',
      'Cloud or on-premise',
      'Custom development',
      'Advanced analytics',
      'White-label option'
    ]
  }
];

let boxX = 50;
const boxWidth = 160;
const boxHeight = 310;

pricingBoxes.forEach((pkg, idx) => {
  // Box background
  if (idx === 1) {
    // Professional - highlight
    doc.fillColor(primaryBlue).rect(boxX, 150, boxWidth, boxHeight).fill();
    doc.fillColor(white).fontSize(14).font('Helvetica-Bold').text(pkg.name, boxX + 10, 165, { width: boxWidth - 20 });
    doc.fillColor(accentBlue).fontSize(16).font('Helvetica-Bold').text(pkg.price, boxX + 10, 190, { width: boxWidth - 20 });
    doc.fillColor(lightBlue).fontSize(9).font('Helvetica').text(pkg.period, boxX + 10, 215, { width: boxWidth - 20 });

    doc.strokeColor(white).lineWidth(2).rect(boxX, 150, boxWidth, boxHeight).stroke();

    let fY = 245;
    pkg.features.forEach(feature => {
      doc.fillColor(white).fontSize(9).font('Helvetica').text('✓ ' + feature, boxX + 10, fY, { width: boxWidth - 20 });
      fY += 20;
    });
  } else {
    // Other packages
    doc.fillColor(lightGray).rect(boxX, 150, boxWidth, boxHeight).fill();
    doc.strokeColor(primaryBlue).lineWidth(1).rect(boxX, 150, boxWidth, boxHeight).stroke();

    doc.fillColor(primaryBlue).fontSize(12).font('Helvetica-Bold').text(pkg.name, boxX + 10, 165, { width: boxWidth - 20 });
    doc.fillColor(darkGray).fontSize(16).font('Helvetica-Bold').text(pkg.price, boxX + 10, 190, { width: boxWidth - 20 });
    doc.fillColor('#999').fontSize(9).font('Helvetica').text(pkg.period, boxX + 10, 215, { width: boxWidth - 20 });

    let fY = 245;
    pkg.features.forEach(feature => {
      doc.fillColor(darkGray).fontSize(9).font('Helvetica').text('✓ ' + feature, boxX + 10, fY, { width: boxWidth - 20 });
      fY += 20;
    });
  }

  boxX += boxWidth + 15;
});

// Implementation costs
doc.moveDown(30);
doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryBlue).text('Implementation & Setup', 50, 510);

const impl = [
  { item: 'System Setup', price: 'ZMW 150,000' },
  { item: 'Data Migration', price: 'ZMW 200,000' },
  { item: 'User Training (per user)', price: 'ZMW 5,000' },
  { item: 'Customization (per hour)', price: 'ZMW 15,000' }
];

let implY = 535;
impl.forEach(i => {
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(i.item, 50, implY);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryBlue).text(i.price, 350, implY);
  implY += 25;
});

// ========== PAGE 5: COMPARISON ==========
newPage();

drawBlueBox(0, 0, 595, 70);
doc.fontSize(28).font('Helvetica-Bold').fillColor(white).text('MARKET COMPARISON', 50, 20);

doc.moveDown(2);

// Comparison table
const tableY = 120;
const col1W = 150;
const col2W = 120;
const col3W = 120;
const col4W = 120;

// Headers
doc.fillColor(primaryBlue).rect(50, tableY, col1W, 30).fill();
doc.fillColor(white).fontSize(11).font('Helvetica-Bold').text('FEATURE', 60, tableY + 8, { width: col1W - 20 });

doc.fillColor(primaryBlue).rect(50 + col1W, tableY, col2W, 30).fill();
doc.fillColor(white).fontSize(11).font('Helvetica-Bold').text('ZAI FLOW', 50 + col1W + 10, tableY + 8, { width: col2W - 20 });

doc.fillColor('#666').rect(50 + col1W + col2W, tableY, col3W, 30).fill();
doc.fillColor(white).fontSize(11).font('Helvetica-Bold').text('COMPETITOR A', 50 + col1W + col2W + 10, tableY + 8, { width: col3W - 20 });

doc.fillColor('#666').rect(50 + col1W + col2W + col3W, tableY, col4W, 30).fill();
doc.fillColor(white).fontSize(11).font('Helvetica-Bold').text('COMPETITOR B', 50 + col1W + col2W + col3W + 10, tableY + 8, { width: col4W - 20 });

// Data rows
const rows = [
  ['Monthly Cost', 'ZMW 45k', 'ZMW 120k', 'ZMW 150k'],
  ['Setup Cost', 'ZMW 150k', 'ZMW 500k', 'ZMW 750k'],
  ['All Modules', '✓', '✗', '✓'],
  ['Support 24/7', '✓', '✗', '✓'],
  ['Cloud-based', '✓', '✓', '✗'],
  ['Mobile Access', '✓', '✗', '✓'],
  ['Unlimited Users', '✗', '✓', '✓'],
  ['API Access', '✓', '✗', '✗']
];

let rowY = tableY + 30;
rows.forEach((row, idx) => {
  const bgColor = idx % 2 === 0 ? '#F5F7FA' : white;

  doc.fillColor(bgColor).rect(50, rowY, col1W, 25).fill();
  doc.fillColor(darkGray).fontSize(10).font('Helvetica').text(row[0], 60, rowY + 7);

  doc.fillColor(bgColor).rect(50 + col1W, rowY, col2W, 25).fill();
  doc.fillColor(primaryBlue).fontSize(10).font('Helvetica-Bold').text(row[1], 50 + col1W + 10, rowY + 7);

  doc.fillColor(bgColor).rect(50 + col1W + col2W, rowY, col3W, 25).fill();
  doc.fillColor(darkGray).fontSize(10).font('Helvetica').text(row[2], 50 + col1W + col2W + 15, rowY + 7);

  doc.fillColor(bgColor).rect(50 + col1W + col2W + col3W, rowY, col4W, 25).fill();
  doc.fillColor(darkGray).fontSize(10).font('Helvetica').text(row[3], 50 + col1W + col2W + col3W + 15, rowY + 7);

  rowY += 25;
});

// Highlight box
doc.fillColor(lightBlue).rect(50, rowY + 20, 495, 60).fill();
doc.fillColor(primaryBlue).fontSize(12).font('Helvetica-Bold').text('SAVINGS WITH ZAI FLOW', 60, rowY + 30);
doc.fillColor(darkGray).fontSize(11).font('Helvetica').text('Year 1: Save ZMW 900,000+ vs Competitor A  •  Year 1: Save ZMW 1,260,000+ vs Competitor B', 60, rowY + 50, { width: 475 });

// ========== PAGE 6: CONTACT & NEXT STEPS ==========
newPage();

// Background
drawBlueBox(0, 0, 595, 842);

// Content box
doc.fillColor(white).rect(40, 80, 515, 680).fill();

// Title in blue
doc.fontSize(32).font('Helvetica-Bold').fillColor(primaryBlue).text('Get Started Today', 60, 100);

// Divider
doc.moveTo(60, 150).lineTo(520, 150).stroke(accentBlue).lineWidth(2);

// Benefits
const finalBenefits = [
  'Start using ZAI FLOW in just 2 weeks',
  'No expensive servers or IT infrastructure needed',
  'All modules included with Professional plan',
  '24/7 support from our Zambian team',
  'Free training for all your staff',
  'Money-back guarantee if not satisfied'
];

let bY2 = 180;
finalBenefits.forEach(benefit => {
  doc.fontSize(12).font('Helvetica').fillColor(darkGray).text('→ ' + benefit);
  bY2 += 30;
});

// Contact section
doc.moveTo(60, 410).lineTo(520, 410).stroke('#E0E7FF').lineWidth(1);

doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryBlue).text('Contact Us', 60, 440);

const contacts = [
  { label: 'Phone', value: '+260 96 123 4567' },
  { label: 'Email', value: 'sales@zaiflow.zm' },
  { label: 'Website', value: 'www.zaiflow.zm' },
  { label: 'Office', value: 'Plot 2847, Independence Avenue, Lusaka' }
];

let cY = 475;
contacts.forEach(c => {
  doc.fontSize(10).font('Helvetica-Bold').fillColor(accentBlue).text(c.label + ':', 60, cY);
  doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(c.value, 130, cY);
  cY += 30;
});

// Bottom CTA
doc.moveTo(60, 630).lineTo(520, 630).stroke(accentBlue).lineWidth(2);

doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryBlue).text('Schedule a FREE Demo', 60, 660);
doc.fontSize(11).font('Helvetica').fillColor(darkGray).text('See ZAI FLOW in action. No credit card required. No obligation.', 60, 685);

// Footer
doc.fontSize(10).font('Helvetica').fillColor('#999').text('ZAI FLOW 2.0 - Enterprise Resource Planning System for Zambia', 60, 750);

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

console.log(`✅ Professional Brochure generated: ${filename}`);
