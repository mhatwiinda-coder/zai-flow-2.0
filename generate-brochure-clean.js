const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({
  size: 'A4',
  margin: 0,
  bufferPages: true
});

const filename = 'ZAI-FLOW-BROCHURE-CLEAN.pdf';
doc.pipe(fs.createWriteStream(filename));

// Modern color palette
const turquoise = '#00D9D9';
const purple = '#7C3AED';
const darkBg = '#0F172A';
const white = '#FFFFFF';
const lightGray = '#F1F5F9';
const accent = '#FF6B6B';
const gold = '#FFD700';

// Contact info
const contact = {
  email: 'mhatwiinda@gmail.com',
  phone: '+260 971 810 616',
  website: 'zai-digital-studio.com'
};

function newPage() {
  doc.addPage();
}

// ===== PAGE 1: HERO COVER =====
doc.fillColor(darkBg).rect(0, 0, 595, 842).fill();

// Animated gradient background
doc.fillColor(purple).circle(100, 50, 200).fill();
doc.fillOpacity(0.1).fillColor(turquoise).circle(500, 700, 250).fill();
doc.fillOpacity(1);

// Top accent
doc.fillColor(turquoise).rect(0, 0, 595, 8).fill();

// Logo/Brand
doc.fontSize(48).font('Helvetica-Bold').fillColor(turquoise).text('ZAI', 50, 60);
doc.fontSize(36).font('Helvetica').fillColor(white).text('FLOW', 140, 80);
doc.fontSize(10).font('Helvetica').fillColor(turquoise).text('2.0', 230, 70);

// Tagline
doc.fontSize(16).font('Helvetica-Bold').fillColor(white).text('The Affordable ERP Revolution', 50, 150, { width: 495 });
doc.fontSize(12).font('Helvetica').fillColor(turquoise).text('for Zambian Businesses', 50, 175);

// Main headline
doc.fontSize(56).font('Helvetica-Bold').fillColor(turquoise).text('50% Cheaper', 50, 250, { width: 495 });
doc.fontSize(56).font('Helvetica-Bold').fillColor(white).text('Than Competitors', 50, 320, { width: 495 });

// Subheading
doc.fontSize(14).font('Helvetica').fillColor(lightGray).text('Professional ERP starting from just ZMW 5,000/month', 50, 400, { width: 495 });

// Stats - NO SPECIAL SYMBOLS
doc.fontSize(11).font('Helvetica-Bold').fillColor(gold).text('- 2-Week Implementation  - 24/7 Local Support  - 30-Day Money-Back Guarantee', 50, 450);

// CTA Button
doc.fillColor(turquoise).rect(50, 520, 200, 50).fill();
doc.fontSize(14).font('Helvetica-Bold').fillColor(darkBg).text('GET YOUR FREE TRIAL', 60, 533);

// Bottom highlight
doc.fillColor(purple).rect(0, 700, 595, 142).fill();
doc.fontSize(28).font('Helvetica-Bold').fillColor(turquoise).text('Save ZMW 680K in Year 1', 50, 740);
doc.fontSize(12).font('Helvetica').fillColor(white).text('vs ZamTech ERP  |  Professional plans at ZMW 15,000/month', 50, 775, { width: 495 });

// ===== PAGE 2: FEATURES & FUNCTIONS =====
newPage();

doc.fillColor(darkBg).rect(0, 0, 595, 842).fill();

// Header
doc.fillColor(turquoise).rect(0, 0, 595, 60).fill();
doc.fontSize(28).font('Helvetica-Bold').fillColor(darkBg).text('Complete Business Modules', 50, 16);

doc.moveDown(4);

// Feature grid - detailed
const features = [
  {
    title: 'HR & Payroll',
    functions: [
      'Employee database and profiles',
      'Automated payroll processing',
      'Attendance tracking (clock in/out)',
      'Leave management system',
      'Tax calculations and compliance',
      'Performance reviews'
    ]
  },
  {
    title: 'Sales Management',
    functions: [
      'Sales order creation and tracking',
      'Customer relationship management',
      'Sales pipeline visualization',
      'Commission calculations',
      'Sales analytics and forecasting',
      'Invoice generation'
    ]
  },
  {
    title: 'Purchasing',
    functions: [
      'Purchase order management',
      'Vendor management system',
      'Goods receipt tracking',
      'Three-way invoice matching',
      'Supplier ratings and compliance',
      'Purchase analytics'
    ]
  },
  {
    title: 'Inventory Management',
    functions: [
      'Real-time stock tracking',
      'Product catalog management',
      'Warehouse operations',
      'Stock transfers and reconciliation',
      'Automated reorder points',
      'Inventory forecasting'
    ]
  },
  {
    title: 'Accounting',
    functions: [
      'Complete general ledger',
      'Journal entry automation',
      'Financial statement generation',
      'Tax reporting and compliance',
      'Account reconciliation',
      'Audit trail logging'
    ]
  },
  {
    title: 'Analytics & Reports',
    functions: [
      'Real-time dashboards',
      'Business intelligence',
      'Custom report builder',
      'Data visualization',
      'Predictive analytics',
      'Export to Excel and PDF'
    ]
  }
];

let featureY = 80;
let colCount = 0;

features.forEach((feat, idx) => {
  const xPos = colCount === 0 ? 50 : 320;

  // Feature card
  doc.fillColor(purple).fillOpacity(0.1).rect(xPos, featureY, 245, 200).fill();
  doc.strokeColor(turquoise).lineWidth(2).rect(xPos, featureY, 245, 200).stroke();
  doc.fillOpacity(1);

  // Title
  doc.fontSize(12).font('Helvetica-Bold').fillColor(turquoise).text(feat.title, xPos + 15, featureY + 15);

  // Functions list
  let funcY = featureY + 40;
  feat.functions.forEach(func => {
    doc.fontSize(8).font('Helvetica').fillColor(white).text('- ' + func, xPos + 15, funcY, { width: 215 });
    funcY += 16;
  });

  colCount++;
  if (colCount === 2) {
    featureY += 220;
    colCount = 0;
  }
});

// ===== PAGE 3: PRICING COMPARISON =====
newPage();

doc.fillColor(darkBg).rect(0, 0, 595, 842).fill();

// Header
doc.fillColor(turquoise).rect(0, 0, 595, 70).fill();
doc.fontSize(32).font('Helvetica-Bold').fillColor(darkBg).text('Unbeatable Pricing', 50, 18);

doc.moveDown(2);

// Comparison header
doc.fontSize(12).font('Helvetica-Bold').fillColor(white).text('Professional Plan Comparison (Annual Cost)', 50, 90);

// Pricing comparison with modern design
const competitors = [
  {
    name: 'ZAI FLOW',
    monthly: 15000,
    annual: 180000,
    setup: 50000,
    isWinner: true,
    color: turquoise
  },
  {
    name: 'ZamTech ERP',
    monthly: 40000,
    annual: 480000,
    setup: 300000,
    isWinner: false,
    color: accent
  },
  {
    name: 'AfricaFlow Pro',
    monthly: 50000,
    annual: 600000,
    setup: 500000,
    isWinner: false,
    color: accent
  },
  {
    name: 'SmartBiz Systems',
    monthly: 45000,
    annual: 540000,
    setup: 400000,
    isWinner: false,
    color: accent
  }
];

let priceX = 50;
const priceCardWidth = 125;

competitors.forEach((comp, idx) => {
  const bgColor = comp.isWinner ? turquoise : purple;
  const textColor = comp.isWinner ? darkBg : white;

  // Card
  doc.fillColor(bgColor).fillOpacity(comp.isWinner ? 1 : 0.15).rect(priceX, 130, priceCardWidth, 250).fill();
  doc.strokeColor(bgColor).lineWidth(comp.isWinner ? 3 : 1).rect(priceX, 130, priceCardWidth, 250).stroke();
  doc.fillOpacity(1);

  // Winner badge
  if (comp.isWinner) {
    doc.fillColor(gold).rect(priceX + 5, 140, priceCardWidth - 10, 20).fill();
    doc.fontSize(8).font('Helvetica-Bold').fillColor(darkBg).text('BEST VALUE', priceX + 8, 143, { width: priceCardWidth - 16 });
  }

  // Name
  doc.fontSize(11).font('Helvetica-Bold').fillColor(comp.isWinner ? textColor : turquoise).text(comp.name, priceX + 8, 170, { width: priceCardWidth - 16 });

  // Price
  doc.fontSize(18).font('Helvetica-Bold').fillColor(comp.isWinner ? textColor : turquoise).text('ZMW ' + comp.monthly.toLocaleString(), priceX + 8, 195, { width: priceCardWidth - 16 });
  doc.fontSize(8).font('Helvetica').fillColor(comp.isWinner ? textColor : turquoise).text('/month', priceX + 8, 220, { width: priceCardWidth - 16 });

  // Details
  doc.fontSize(8).font('Helvetica').fillColor(comp.isWinner ? textColor : white).text('Annual: ZMW ' + (comp.annual / 1000).toFixed(0) + 'k', priceX + 8, 235, { width: priceCardWidth - 16 });
  doc.fontSize(8).font('Helvetica').fillColor(comp.isWinner ? textColor : white).text('Setup: ZMW ' + (comp.setup / 1000).toFixed(0) + 'k', priceX + 8, 250, { width: priceCardWidth - 16 });
  doc.fontSize(8).font('Helvetica').fillColor(comp.isWinner ? textColor : white).text('Year 1: ZMW ' + ((comp.annual + comp.setup) / 1000).toFixed(0) + 'k', priceX + 8, 265, { width: priceCardWidth - 16 });

  // Savings badge
  if (!comp.isWinner) {
    const savings = (comp.annual + comp.setup) - (competitors[0].annual + competitors[0].setup);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(accent).text('Save ZMW ' + (savings / 1000).toFixed(0) + 'k', priceX + 8, 310, { width: priceCardWidth - 16 });
  }

  priceX += priceCardWidth + 8;
});

// Key features comparison
doc.moveDown(30);
doc.fontSize(12).font('Helvetica-Bold').fillColor(turquoise).text('What You Get:', 50, doc.y);
doc.moveDown(0.3);

const keyFeatures = [
  { feat: 'All 6 Core Modules', zaiflow: true, zamtech: false, africaflow: true, smartbiz: true },
  { feat: '24/7 Support', zaiflow: true, zamtech: false, africaflow: true, smartbiz: false },
  { feat: 'Mobile App', zaiflow: true, zamtech: false, africaflow: true, smartbiz: true },
  { feat: 'Custom Reports', zaiflow: true, zamtech: true, africaflow: true, smartbiz: false },
  { feat: 'API Access', zaiflow: true, zamtech: false, africaflow: false, smartbiz: false }
];

let featureTableY = doc.y;
keyFeatures.forEach(kf => {
  doc.fontSize(9).font('Helvetica').fillColor(white).text(kf.feat, 50, featureTableY);

  let checkX = 250;
  [kf.zaiflow, kf.zamtech, kf.africaflow, kf.smartbiz].forEach(has => {
    if (has) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor(turquoise).text('Yes', checkX, featureTableY);
    } else {
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#666').text('No', checkX, featureTableY);
    }
    checkX += 75;
  });

  featureTableY += 18;
});

// ===== PAGE 4: PRICING PLANS =====
newPage();

doc.fillColor(darkBg).rect(0, 0, 595, 842).fill();

// Header
doc.fillColor(turquoise).rect(0, 0, 595, 70).fill();
doc.fontSize(32).font('Helvetica-Bold').fillColor(darkBg).text('Flexible Plans for Every Business', 50, 18);

doc.moveDown(2);

// Plans
const plans = [
  {
    name: 'STARTER',
    price: 5000,
    users: 2,
    features: ['Basic modules', 'Email support', 'Cloud hosting', 'Monthly backups'],
    color: purple
  },
  {
    name: 'PROFESSIONAL',
    price: 15000,
    users: 10,
    features: ['All modules', 'Priority support', 'Custom reports', 'API access', 'Mobile app', 'Training included'],
    color: turquoise,
    badge: 'POPULAR'
  },
  {
    name: 'ENTERPRISE',
    price: 45000,
    users: 999,
    features: ['Everything', '24/7 support', 'Dedicated manager', 'On-site training', 'Custom development', 'White-label'],
    color: gold
  }
];

let planX = 50;
const planWidth = 170;

plans.forEach(plan => {
  // Card background
  doc.fillColor(plan.color).fillOpacity(0.15).rect(planX, 110, planWidth, 350).fill();
  doc.strokeColor(plan.color).lineWidth(2).rect(planX, 110, planWidth, 350).stroke();
  doc.fillOpacity(1);

  // Badge
  if (plan.badge) {
    doc.fillColor(gold).rect(planX + 5, 120, planWidth - 10, 18).fill();
    doc.fontSize(7).font('Helvetica-Bold').fillColor(darkBg).text(plan.badge, planX + 8, 122, { width: planWidth - 16 });
  }

  const badgeOffset = plan.badge ? 28 : 8;

  // Name
  doc.fontSize(13).font('Helvetica-Bold').fillColor(plan.color).text(plan.name, planX + 8, 120 + badgeOffset, { width: planWidth - 16 });

  // Price
  doc.fontSize(18).font('Helvetica-Bold').fillColor(plan.color).text('ZMW ' + plan.price.toLocaleString(), planX + 8, 155 + badgeOffset, { width: planWidth - 16 });
  doc.fontSize(8).font('Helvetica').fillColor(white).text('/month', planX + 8, 180 + badgeOffset);

  // Users
  doc.fontSize(8).font('Helvetica').fillColor(turquoise).text('Up to ' + plan.users + ' users', planX + 8, 195 + badgeOffset);

  // Features
  let featY = 215 + badgeOffset;
  plan.features.forEach(feat => {
    doc.fontSize(8).font('Helvetica').fillColor(white).text('- ' + feat, planX + 8, featY, { width: planWidth - 16 });
    featY += 15;
  });

  planX += planWidth + 10;
});

// ===== PAGE 5: CONTACT & CTA =====
newPage();

doc.fillColor(darkBg).rect(0, 0, 595, 842).fill();

// Gradient background
doc.fillOpacity(0.1).fillColor(turquoise).circle(50, 100, 300).fill();
doc.fillOpacity(0.1).fillColor(purple).circle(550, 600, 350).fill();
doc.fillOpacity(1);

// Main heading
doc.fontSize(44).font('Helvetica-Bold').fillColor(turquoise).text('Ready to Transform', 50, 100, { width: 495 });
doc.fontSize(44).font('Helvetica-Bold').fillColor(white).text('Your Business?', 50, 160, { width: 495 });

doc.moveDown(2);

// Contact cards - NO SPECIAL SYMBOLS
const contactCards = [
  { label: 'Email', value: contact.email },
  { label: 'Phone', value: contact.phone },
  { label: 'Website', value: contact.website }
];

let contactY = 250;
contactCards.forEach(card => {
  // Card
  doc.fillColor(turquoise).fillOpacity(0.1).rect(50, contactY, 495, 60).fill();
  doc.strokeColor(turquoise).lineWidth(1).rect(50, contactY, 495, 60).stroke();
  doc.fillOpacity(1);

  // Content
  doc.fontSize(11).font('Helvetica-Bold').fillColor(turquoise).text(card.label, 65, contactY + 12);
  doc.fontSize(11).font('Helvetica').fillColor(white).text(card.value, 65, contactY + 32);

  contactY += 75;
});

doc.moveDown(3);

// Main CTA
doc.fillColor(turquoise).rect(50, 520, 495, 60).fill();
doc.fontSize(16).font('Helvetica-Bold').fillColor(darkBg).text('START YOUR 30-DAY FREE TRIAL', 65, 535);
doc.fontSize(10).font('Helvetica').fillColor(darkBg).text('No credit card required | Full access to all features | Local Zambian support', 65, 560);

// Footer benefits
doc.moveDown(8);
doc.fontSize(11).font('Helvetica-Bold').fillColor(turquoise).text('Why Choose ZAI FLOW?');
doc.moveDown(0.5);

const whyChoose = [
  '- 50% cheaper than competitors',
  '- 2-week quick start',
  '- Local Zambian team',
  '- No contracts, cancel anytime',
  '- 30-day money-back guarantee'
];

whyChoose.forEach(reason => {
  doc.fontSize(10).font('Helvetica').fillColor(white).text(reason);
});

// Footer
doc.fontSize(9).font('Helvetica').fillColor('#666').text('ZAI FLOW 2.0 - Enterprise Resource Planning for Zambia | Made by ZAI Digital Studio', 50, 780, { align: 'center', width: 495 });

// Add page numbers
const pages = doc.bufferedPageRange().count;
for (let i = 1; i <= pages; i++) {
  doc.switchToPage(i - 1);
  doc.fontSize(9).font('Helvetica').fillColor('#666').text(
    `Page ${i} of ${pages}`,
    50,
    doc.page.height - 30,
    { align: 'right', width: 495 }
  );
}

doc.end();

console.log(`✅ Clean Brochure (no special symbols) generated: ${filename}`);
