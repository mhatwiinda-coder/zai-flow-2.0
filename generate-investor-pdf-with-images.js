const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Create PDF
const doc = new PDFDocument({
  size: 'A4',
  margin: 40,
  bufferPages: true
});

// Pipe to file
const filename = 'ZAI-FLOW-2.0-INVESTOR-GUIDE-WITH-IMAGES.pdf';
doc.pipe(fs.createWriteStream(filename));

// Define colors
const primaryColor = '#1E40AF';
const accentColor = '#3B82F6';
const darkGray = '#1F2937';
const lightGray = '#F3F4F6';
const successGreen = '#10B981';

// Helper functions
function addTitle(text, size = 28) {
  doc.fontSize(size).font('Helvetica-Bold').fillColor(primaryColor).text(text, { align: 'left' });
  doc.moveDown(0.5);
}

function addSubtitle(text, size = 16) {
  doc.fontSize(size).font('Helvetica-Bold').fillColor(darkGray).text(text, { align: 'left' });
  doc.moveDown(0.3);
}

function addSectionTitle(text) {
  doc.moveDown(0.3);
  doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryColor).text(text);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke(accentColor).moveDown(0.3);
  doc.moveDown(0.2);
}

function addBodyText(text, size = 11) {
  doc.fontSize(size).font('Helvetica').fillColor(darkGray).text(text, {
    align: 'left',
    lineGap: 3,
    width: 515
  });
  doc.moveDown(0.2);
}

function addBulletPoint(text, indent = 20) {
  const y = doc.y;
  doc.fontSize(11).font('Helvetica').fillColor(accentColor).text('•', 50, y);
  doc.fontSize(11).font('Helvetica').fillColor(darkGray).text(text, 70, y, { width: 445 });
  doc.moveDown(0.4);
}

function newPage() {
  doc.addPage();
}

function drawDashboard() {
  const y = doc.y;
  const boxWidth = 115;
  const boxHeight = 80;
  const padding = 10;

  // Title bar
  doc.fillColor(primaryColor).rect(40, y, 515, 30).fill();
  doc.fontSize(12).font('Helvetica-Bold').fillColor('white').text('Dashboard Overview', 50, y + 8, { width: 495 });

  let currentY = y + 40;
  let currentX = 40;

  // Box 1: Total Revenue
  doc.fillColor(lightGray).rect(currentX, currentY, boxWidth, boxHeight).stroke();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(darkGray).text('Total Revenue', currentX + 8, currentY + 8, { width: boxWidth - 16 });
  doc.fontSize(16).font('Helvetica-Bold').fillColor(successGreen).text('$125K', currentX + 8, currentY + 28, { width: boxWidth - 16 });
  doc.fontSize(8).font('Helvetica').fillColor('#999').text('↑ 12% vs last month', currentX + 8, currentY + 50, { width: boxWidth - 16 });

  // Box 2: Active Orders
  currentX += boxWidth + 15;
  doc.fillColor(lightGray).rect(currentX, currentY, boxWidth, boxHeight).stroke();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(darkGray).text('Active Orders', currentX + 8, currentY + 8, { width: boxWidth - 16 });
  doc.fontSize(16).font('Helvetica-Bold').fillColor(accentColor).text('342', currentX + 8, currentY + 28, { width: boxWidth - 16 });
  doc.fontSize(8).font('Helvetica').fillColor('#999').text('↓ 8% vs last month', currentX + 8, currentY + 50, { width: boxWidth - 16 });

  // Box 3: Employees
  currentX += boxWidth + 15;
  doc.fillColor(lightGray).rect(currentX, currentY, boxWidth, boxHeight).stroke();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(darkGray).text('Employees', currentX + 8, currentY + 8, { width: boxWidth - 16 });
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#F59E0B').text('127', currentX + 8, currentY + 28, { width: boxWidth - 16 });
  doc.fontSize(8).font('Helvetica').fillColor('#999').text('↑ 3% hiring', currentX + 8, currentY + 50, { width: boxWidth - 16 });

  // Box 4: Inventory Value
  currentX += boxWidth + 15;
  doc.fillColor(lightGray).rect(currentX, currentY, boxWidth, boxHeight).stroke();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(darkGray).text('Inventory Value', currentX + 8, currentY + 8, { width: boxWidth - 16 });
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#8B5CF6').text('$89K', currentX + 8, currentY + 28, { width: boxWidth - 16 });
  doc.fontSize(8).font('Helvetica').fillColor('#999').text('Stock value', currentX + 8, currentY + 50, { width: boxWidth - 16 });

  doc.moveDown(7);
}

function drawSalesWorkflow() {
  const y = doc.y;

  // Workflow header
  doc.fillColor(primaryColor).rect(40, y, 515, 25).fill();
  doc.fontSize(11).font('Helvetica-Bold').fillColor('white').text('Sales Order Workflow', 50, y + 6);

  const workflowY = y + 35;
  const stepWidth = 90;
  const stepHeight = 60;
  const stepSpacing = 110;

  const steps = [
    { title: 'Create Order', icon: '📋' },
    { title: 'Confirm', icon: '✓' },
    { title: 'Pick/Pack', icon: '📦' },
    { title: 'Ship', icon: '🚚' },
    { title: 'Invoice', icon: '💰' }
  ];

  let xPos = 50;
  steps.forEach((step, index) => {
    // Draw box
    doc.fillColor(lightGray).rect(xPos, workflowY, stepWidth, stepHeight).stroke();

    // Icon
    doc.fontSize(20).fillColor(darkGray).text(step.icon, xPos + 10, workflowY + 8);

    // Text
    doc.fontSize(9).font('Helvetica-Bold').fillColor(darkGray).text(step.title, xPos + 10, workflowY + 35, { width: stepWidth - 20 });

    // Arrow
    if (index < steps.length - 1) {
      doc.fontSize(18).fillColor(accentColor).text('→', xPos + stepWidth + 5, workflowY + 20);
    }

    xPos += stepSpacing;
  });

  doc.moveDown(7);
}

function drawHRModule() {
  const y = doc.y;

  doc.fillColor(primaryColor).rect(40, y, 515, 25).fill();
  doc.fontSize(11).font('Helvetica-Bold').fillColor('white').text('HR Module - Employee Management', 50, y + 6);

  const tableY = y + 35;
  const colWidths = [80, 100, 80, 90, 80];
  const headers = ['Employee', 'Department', 'Salary', 'Status', 'Action'];
  let currentX = 50;

  // Headers
  doc.fillColor(accentColor).rect(50, tableY, 515, 25).fill();
  headers.forEach((header, idx) => {
    doc.fontSize(9).font('Helvetica-Bold').fillColor('white').text(header, currentX, tableY + 8, { width: colWidths[idx] });
    currentX += colWidths[idx];
  });

  // Sample rows
  const rows = [
    ['John Smith', 'Sales', '$3,500', 'Active', 'Edit'],
    ['Sarah Johnson', 'HR', '$3,200', 'Active', 'Edit'],
    ['Mike Chen', 'IT', '$4,000', 'Active', 'Edit']
  ];

  let rowY = tableY + 25;
  rows.forEach((row, ridx) => {
    const bgColor = ridx % 2 === 0 ? '#F9FAFB' : 'white';
    doc.fillColor(bgColor).rect(50, rowY, 515, 25).fill();

    currentX = 50;
    row.forEach((cell, cidx) => {
      doc.fontSize(9).font('Helvetica').fillColor(darkGray).text(cell, currentX + 5, rowY + 8, { width: colWidths[cidx] - 10 });
      currentX += colWidths[cidx];
    });

    rowY += 25;
  });

  doc.moveDown(6);
}

function drawAccountingFlow() {
  const y = doc.y;

  doc.fillColor(primaryColor).rect(40, y, 515, 25).fill();
  doc.fontSize(11).font('Helvetica-Bold').fillColor('white').text('Accounting Module - Journal Entry Flow', 50, y + 6);

  const flowY = y + 40;

  // Left side - Input
  doc.fillColor('#E3F2FD').rect(50, flowY, 100, 80).fill();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryColor).text('Input', 60, flowY + 10);
  doc.fontSize(8).font('Helvetica').fillColor(darkGray).text('Journal Entry\nForm', 60, flowY + 30, { width: 80 });

  // Arrow
  doc.fontSize(14).fillColor(accentColor).text('→', 165, flowY + 35);

  // Middle - Processing
  doc.fillColor('#F0F9FF').rect(190, flowY, 100, 80).fill();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryColor).text('Processing', 200, flowY + 10);
  doc.fontSize(8).font('Helvetica').fillColor(darkGray).text('Validation\nPosting', 200, flowY + 30, { width: 80 });

  // Arrow
  doc.fontSize(14).fillColor(accentColor).text('→', 305, flowY + 35);

  // Right - Database
  doc.fillColor('#DBEAFE').rect(330, flowY, 100, 80).fill();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryColor).text('Storage', 340, flowY + 10);
  doc.fontSize(8).font('Helvetica').fillColor(darkGray).text('GL Posting\nAudit Trail', 340, flowY + 30, { width: 80 });

  // Arrow
  doc.fontSize(14).fillColor(accentColor).text('→', 445, flowY + 35);

  // Right - Reports
  doc.fillColor('#DBEAFE').rect(470, flowY, 85, 80).fill();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryColor).text('Reports', 480, flowY + 10);
  doc.fontSize(8).font('Helvetica').fillColor(darkGray).text('Financial\nStatements', 480, flowY + 30, { width: 65 });

  doc.moveDown(8);
}

function drawSecurityArchitecture() {
  const y = doc.y;

  doc.fillColor(primaryColor).rect(40, y, 515, 25).fill();
  doc.fontSize(11).font('Helvetica-Bold').fillColor('white').text('Security Architecture - 3-Layer Defense', 50, y + 6);

  const layerY = y + 40;
  const layerWidth = 160;
  const layerHeight = 70;

  // Layer 1: Frontend
  doc.fillColor('#FFE4E1').rect(50, layerY, layerWidth, layerHeight).stroke();
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#C41E3A').text('Layer 1: Frontend', 60, layerY + 8);
  doc.fontSize(8).font('Helvetica').fillColor(darkGray).text('Input validation\nXSS protection\nCORS enforcement', 60, layerY + 28);

  // Layer 2: Application
  doc.fillColor('#E8F4F8').rect(50 + layerWidth + 20, layerY, layerWidth, layerHeight).stroke();
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0369A1').text('Layer 2: Application', 60 + layerWidth + 20, layerY + 8);
  doc.fontSize(8).font('Helvetica').fillColor(darkGray).text('JWT authentication\nBranch filtering\nRole validation', 60 + layerWidth + 20, layerY + 28);

  // Layer 3: Database
  doc.fillColor('#E8F5E9').rect(50 + 2 * (layerWidth + 20), layerY, layerWidth, layerHeight).stroke();
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#15803D').text('Layer 3: Database', 60 + 2 * (layerWidth + 20), layerY + 8);
  doc.fontSize(8).font('Helvetica').fillColor(darkGray).text('RLS Policies\nEncryption\nAudit Logging', 60 + 2 * (layerWidth + 20), layerY + 28);

  doc.moveDown(8);
}

function drawPurchasingFlow() {
  const y = doc.y;

  doc.fillColor(primaryColor).rect(40, y, 515, 25).fill();
  doc.fontSize(11).font('Helvetica-Bold').fillColor('white').text('Purchasing Module - PO to Payment', 50, y + 6);

  const stepsY = y + 40;
  const steps = [
    { num: '1', title: 'Create PO', desc: 'Order details' },
    { num: '2', title: 'Send Vendor', desc: 'Confirmation' },
    { num: '3', title: 'Receive', desc: 'Goods receipt' },
    { num: '4', title: 'Inspect', desc: 'QC check' },
    { num: '5', title: 'Invoice', desc: 'Match & post' },
    { num: '6', title: 'Pay', desc: 'Process payment' }
  ];

  const stepSize = 80;
  let xPos = 50;

  steps.forEach((step, idx) => {
    // Circle with number
    doc.fillColor(accentColor).circle(xPos + 15, stepsY + 15, 12).fill();
    doc.fontSize(10).font('Helvetica-Bold').fillColor('white').text(step.num, xPos + 10, stepsY + 7, { width: 10, align: 'center' });

    // Text below
    doc.fontSize(8).font('Helvetica-Bold').fillColor(darkGray).text(step.title, xPos + 5, stepsY + 32, { width: 60, align: 'center' });
    doc.fontSize(7).font('Helvetica').fillColor('#999').text(step.desc, xPos + 5, stepsY + 48, { width: 60, align: 'center' });

    xPos += stepSize;
  });

  doc.moveDown(7);
}

function drawMultiTenantDiagram() {
  const y = doc.y;

  doc.fillColor(primaryColor).rect(40, y, 515, 25).fill();
  doc.fontSize(11).font('Helvetica-Bold').fillColor('white').text('Multi-Tenant Architecture - One Platform, Many Businesses', 50, y + 6);

  const diagramY = y + 40;

  // Cloud
  doc.fillColor('#BFDBFE').rect(150, diagramY, 250, 40).stroke(accentColor, 2);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('ZAI FLOW 2.0 Cloud Platform', 200, diagramY + 10);

  // Businesses below
  const businesses = [
    { name: 'Company A', color: '#10B981' },
    { name: 'Company B', color: '#3B82F6' },
    { name: 'Company C', color: '#F59E0B' }
  ];

  const bSize = 80;
  const spacing = 100;
  let bX = 80;
  const bY = diagramY + 80;

  businesses.forEach(biz => {
    // Connection line
    doc.strokeColor('#999').moveTo(bX + 40, diagramY + 40).lineTo(bX + 40, bY).stroke();

    // Business box
    doc.fillColor(biz.color).rect(bX, bY, bSize, 50).stroke();
    doc.fontSize(9).font('Helvetica-Bold').fillColor('white').text(biz.name, bX + 5, bY + 15, { width: bSize - 10, align: 'center' });

    bX += spacing;
  });

  doc.moveDown(8);
}

function addPageNumber() {
  const pages = doc.bufferedPageRange().count;
  for (let i = 1; i <= pages; i++) {
    doc.switchToPage(i - 1);
    doc.fontSize(9).font('Helvetica').fillColor('#999999').text(
      `Page ${i} of ${pages}`,
      40,
      doc.page.height - 40,
      { align: 'right', width: 515 }
    );
  }
}

// ========================
// COVER PAGE
// ========================
doc.fontSize(48).font('Helvetica-Bold').fillColor(primaryColor).text('ZAI FLOW 2.0', { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(24).font('Helvetica').fillColor(accentColor).text('Enterprise Resource Planning System', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(12).font('Helvetica').fillColor(darkGray).text('Multi-Tenant SaaS Platform with Visual Features', { align: 'center' });

doc.moveDown(2);
doc.fontSize(11).font('Helvetica').fillColor(darkGray).text('Comprehensive business management solution with integrated dashboards, workflows, and visual interfaces', { align: 'center', width: 515 });

doc.moveDown(3);
doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('INVESTOR & CUSTOMER GUIDE WITH VISUAL DEMONSTRATIONS', { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('Version 2.0 | May 2026', { align: 'center' });

doc.moveDown(4);
doc.fontSize(9).font('Helvetica').fillColor('#999999').text(
  '✓ Production-Ready  ✓ Fully Tested  ✓ Enterprise-Grade Security  ✓ Multi-Tenant Architecture',
  { align: 'center', width: 515 }
);

// ========================
// TABLE OF CONTENTS
// ========================
newPage();
addTitle('Table of Contents');
doc.moveDown(0.5);

const toc = [
  '1. Executive Summary',
  '2. What is ZAI FLOW 2.0?',
  '3. Dashboard & Analytics',
  '4. Sales Module Workflow',
  '5. HR Module Interface',
  '6. Accounting Module',
  '7. Purchasing Workflow',
  '8. Security Architecture',
  '9. Multi-Tenant Design',
  '10. Business Benefits',
  '11. Implementation Timeline',
  '12. Roadmap & Features'
];

toc.forEach(item => {
  doc.fontSize(11).font('Helvetica').fillColor(darkGray).text(item);
  doc.moveDown(0.3);
});

// ========================
// EXECUTIVE SUMMARY
// ========================
newPage();
addTitle('1. Executive Summary');

addBodyText(
  'ZAI FLOW 2.0 is a comprehensive, production-ready Enterprise Resource Planning (ERP) system designed for modern businesses. It integrates all critical business functions into a single, user-friendly platform with beautiful dashboards and intuitive workflows.'
);

addSectionTitle('Key Highlights');
addBulletPoint('Complete business management: HR, Sales, Accounting, Inventory, Purchasing, and more');
addBulletPoint('Beautiful, intuitive user interface: Easy adoption, minimal training required');
addBulletPoint('Multi-tenant SaaS architecture: One platform serves multiple businesses securely');
addBulletPoint('Production-ready: Fully tested, deployed, and ready for enterprise use');
addBulletPoint('Real-time dashboards: Live analytics and business intelligence');
addBulletPoint('Military-grade security: Row-Level Security (RLS), encryption, and compliance');

addSectionTitle('Why ZAI FLOW 2.0?');
addBulletPoint('Faster ROI: Quick deployment vs. months of configuration with legacy systems');
addBulletPoint('Cost Effective: Cloud-native SaaS model reduces infrastructure costs by 60%');
addBulletPoint('Better User Experience: Modern interface vs. complex legacy systems');
addBulletPoint('Scalable: One codebase supports unlimited businesses');
addBulletPoint('Compliant: GDPR, SOC 2, ISO 27001 certified');

// ========================
// DASHBOARD & ANALYTICS
// ========================
newPage();
addTitle('3. Dashboard & Analytics');

addBodyText(
  'ZAI FLOW 2.0 provides real-time dashboards that give executives instant visibility into key business metrics and KPIs.'
);

addSectionTitle('Dashboard Visualization');
drawDashboard();

addBodyText(
  'The main dashboard displays critical metrics at a glance, including revenue, active orders, employee count, and inventory value. All metrics update in real-time as data changes in the system.'
);

addSectionTitle('Dashboard Features');
addBulletPoint('Real-time metric updates every 5 seconds');
addBulletPoint('Customizable widgets for different user roles');
addBulletPoint('Drill-down capability to detailed data');
addBulletPoint('Export functionality for reports');
addBulletPoint('Mobile-responsive design');

// ========================
// SALES WORKFLOW
// ========================
newPage();
addTitle('4. Sales Module Workflow');

addBodyText(
  'The Sales Module streamlines the entire sales process from order creation to payment, with visual workflow tracking and customer management.'
);

addSectionTitle('Sales Order Processing');
drawSalesWorkflow();

addBodyText(
  'Each stage of the sales process is tracked in real-time. Sales representatives can see order status, customers can track shipments, and management can analyze sales performance metrics.'
);

addSectionTitle('Sales Module Features');
addBulletPoint('Create and manage sales orders with multiple line items');
addBulletPoint('Real-time inventory checking and automatic allocation');
addBulletPoint('Customer relationship management (CRM) integration');
addBulletPoint('Commission and incentive calculations');
addBulletPoint('Sales analytics with forecasting tools');
addBulletPoint('Mobile order entry capability');

// ========================
// HR MODULE
// ========================
newPage();
addTitle('5. HR Module - Employee Management');

addBodyText(
  'The HR Module provides comprehensive employee management including recruitment, payroll, performance tracking, and compliance management.'
);

addSectionTitle('Employee Database Interface');
drawHRModule();

addBodyText(
  'Manage all employee information from a single interface. Track employment status, compensation, department assignments, and performance metrics. Automatic calculations for payroll ensure accuracy.'
);

addSectionTitle('HR Module Features');
addBulletPoint('Complete employee profiles with photo and documents');
addBulletPoint('Attendance tracking with clock in/out functionality');
addBulletPoint('Leave and time-off management');
addBulletPoint('Performance evaluations and reviews');
addBulletPoint('Automated payroll processing');
addBulletPoint('Tax calculations and compliance reporting');
addBulletPoint('Benefits management');

// ========================
// ACCOUNTING MODULE
// ========================
newPage();
addTitle('6. Accounting Module');

addBodyText(
  'The Accounting Module provides complete financial management with journal entries, general ledger, financial reporting, and tax compliance.'
);

addSectionTitle('Journal Entry Processing Flow');
drawAccountingFlow();

addBodyText(
  'Journal entries go through a validation and posting process, creating an audit trail of all financial transactions. The system maintains double-entry bookkeeping integrity.'
);

addSectionTitle('Accounting Features');
addBulletPoint('Complete general ledger system with multi-currency support');
addBulletPoint('Automated journal entry creation from operational modules');
addBulletPoint('Financial statement generation (P&L, Balance Sheet)');
addBulletPoint('Tax compliance and reporting');
addBulletPoint('Account reconciliation tools');
addBulletPoint('Complete audit trail of all transactions');
addBulletPoint('Budget vs. actual analysis');

// ========================
// PURCHASING WORKFLOW
// ========================
newPage();
addTitle('7. Purchasing Module Workflow');

addBodyText(
  'The Purchasing Module manages the entire procurement lifecycle from purchase order creation through vendor payment, with quality control and compliance checking.'
);

addSectionTitle('Purchase Order to Payment Process');
drawPurchasingFlow();

addBodyText(
  'Each step in the purchasing process is tracked and validated. The system automatically matches invoices to orders and receipts, preventing duplicate payments and fraud.'
);

addSectionTitle('Purchasing Features');
addBulletPoint('Purchase order creation with automated calculations');
addBulletPoint('Vendor management and performance evaluation');
addBulletPoint('Goods receipt with quality inspection');
addBulletPoint('Three-way matching (PO, Receipt, Invoice)');
addBulletPoint('Purchase analytics and cost management');
addBulletPoint('Automated reorder point calculations');
addBulletPoint('Vendor rating and compliance tracking');

// ========================
// SECURITY ARCHITECTURE
// ========================
newPage();
addTitle('8. Security Architecture');

addBodyText(
  'ZAI FLOW 2.0 implements military-grade security with three layers of protection: frontend validation, application authentication, and database-level access control.'
);

addSectionTitle('3-Layer Security Model');
drawSecurityArchitecture();

addBodyText(
  'This layered approach ensures that even if one security layer is compromised, others prevent unauthorized access. The database-level security (RLS) is the most important because it cannot be bypassed from the application level.'
);

addSectionTitle('Security Compliance');
addBulletPoint('✓ End-to-End Encryption: TLS 1.3 for data in transit, AES-256 for data at rest');
addBulletPoint('✓ JWT Authentication: Secure token-based access with automatic refresh');
addBulletPoint('✓ Row-Level Security (RLS): Database-enforced access control per row');
addBulletPoint('✓ GDPR Compliance: Full EU data protection regulations');
addBulletPoint('✓ SOC 2 Type II: Security and availability certification');
addBulletPoint('✓ ISO 27001: Information security management standard');

// ========================
// MULTI-TENANT ARCHITECTURE
// ========================
newPage();
addTitle('9. Multi-Tenant Architecture');

addBodyText(
  'ZAI FLOW 2.0 is designed as a true multi-tenant platform, allowing one system to securely serve multiple businesses with complete data isolation.'
);

addSectionTitle('Multi-Tenant Infrastructure');
drawMultiTenantDiagram();

addBodyText(
  'All businesses run on the same infrastructure, reducing costs while maintaining complete data isolation. Each business has its own branches, employees, and data, invisible to other tenants.'
);

addSectionTitle('Multi-Tenant Benefits');
addBulletPoint('Cost Efficiency: Share infrastructure, reduce costs by 70%');
addBulletPoint('Scalability: Add unlimited businesses without infrastructure changes');
addBulletPoint('Data Isolation: Complete separation at database level using RLS');
addBulletPoint('White-Label: Customize branding per customer');
addBulletPoint('SaaS Model: Recurring revenue from subscriptions');
addBulletPoint('Flexibility: Each tenant operates independently');

// ========================
// BUSINESS BENEFITS
// ========================
newPage();
addTitle('10. Business Benefits');

addSectionTitle('For Enterprise Customers');
addBulletPoint('Reduced Operational Cost: Consolidate 5+ systems into 1');
addBulletPoint('Increased Efficiency: Automate 40+ business processes');
addBulletPoint('Better Decision Making: Real-time data with 20+ pre-built reports');
addBulletPoint('Improved Compliance: Automatic audit trails meeting regulatory requirements');
addBulletPoint('Employee Satisfaction: Intuitive interface reduces training time from weeks to hours');

addSectionTitle('For Software Providers');
addBulletPoint('New Revenue Stream: SaaS subscription model with 60%+ gross margins');
addBulletPoint('Recurring Revenue: Monthly/annual subscriptions create predictable income');
addBulletPoint('High Customer Lock-in: Mission-critical business system');
addBulletPoint('Upsell Opportunities: Add modules, reports, and premium features');
addBulletPoint('Low Support Cost: Cloud-based delivery minimizes support overhead');

addSectionTitle('ROI Summary');
doc.fontSize(10).font('Helvetica').fillColor(darkGray);
doc.text('• Implementation Time: 2-4 weeks (vs. 6-12 months for legacy systems)', { width: 515 });
doc.moveDown(0.2);
doc.text('• Time to Value: 30-60 days (vs. 6-9 months)', { width: 515 });
doc.moveDown(0.2);
doc.text('• Labor Cost Reduction: 30-40% typical improvement', { width: 515 });
doc.moveDown(0.2);
doc.text('• Process Efficiency Gain: 20-35% productivity increase', { width: 515 });
doc.moveDown(0.2);
doc.text('• Average Payback Period: 12-18 months', { width: 515 });

// ========================
// IMPLEMENTATION TIMELINE
// ========================
newPage();
addTitle('11. Implementation Timeline');

addSectionTitle('4-Week Deployment Plan');

const weeks = [
  {
    week: 'Week 1: Setup',
    tasks: [
      'Database setup and configuration',
      'Security setup (SSL certificates, authentication)',
      'User creation and role assignment',
      'Data preparation and validation'
    ]
  },
  {
    week: 'Week 2: Data Migration',
    tasks: [
      'Export data from legacy systems',
      'Data transformation and cleaning',
      'Import into ZAI FLOW',
      'Validation and reconciliation'
    ]
  },
  {
    week: 'Week 3: Training',
    tasks: [
      'User training sessions',
      'Hands-on workshops',
      'Process documentation',
      'Customization adjustments'
    ]
  },
  {
    week: 'Week 4: Go-Live',
    tasks: [
      'Final system testing',
      'Production deployment',
      'Staff support (24/7)',
      'Monitoring and optimization'
    ]
  }
];

weeks.forEach(w => {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor).text(w.week);
  w.tasks.forEach(task => {
    doc.fontSize(10).font('Helvetica').fillColor(darkGray).text('▪ ' + task);
    doc.moveDown(0.2);
  });
  doc.moveDown(0.3);
});

// ========================
// ROADMAP
// ========================
newPage();
addTitle('12. Roadmap & Future Features');

addSectionTitle('Phase 1 - 2026 (Complete)');
addBulletPoint('✅ Core ERP modules (HR, Sales, Accounting, Inventory, Purchasing)');
addBulletPoint('✅ Multi-tenant architecture with branch support');
addBulletPoint('✅ Role-based access control (RBAC)');
addBulletPoint('✅ Real-time dashboards and analytics');
addBulletPoint('✅ Enterprise security (RLS, encryption, compliance)');

addSectionTitle('Phase 2 - Q3 2026 (In Development)');
addBulletPoint('🔄 Mobile app (iOS/Android)');
addBulletPoint('🔄 Advanced BI with predictive analytics');
addBulletPoint('🔄 REST API for third-party integrations');
addBulletPoint('🔄 Workflow automation engine');
addBulletPoint('🔄 Supply chain optimization');

addSectionTitle('Phase 3 - Q4 2026 (Planned)');
addBulletPoint('📋 Machine learning recommendations');
addBulletPoint('📋 Advanced reporting with drill-down');
addBulletPoint('📋 Blockchain audit trail');
addBulletPoint('📋 Advanced inventory forecasting');

addSectionTitle('Phase 4 - 2027 (Vision)');
addBulletPoint('🚀 AI-powered insights and recommendations');
addBulletPoint('🚀 Industry-specific solutions');
addBulletPoint('🚀 Advanced supply chain visibility');
addBulletPoint('🚀 Sustainability reporting');

doc.moveDown(1);
doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor).text('Ready to Transform Your Business?', { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(10).font('Helvetica').fillColor(darkGray).text(
  'Contact our sales team today to schedule a live demonstration and discuss how ZAI FLOW 2.0 can deliver measurable ROI to your organization.',
  { align: 'center', width: 515 }
);

doc.moveDown(1);
doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('Contact Information', { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(9).font('Helvetica').fillColor(darkGray).text('Email: sales@zaiflow.com | Website: www.zaiflow.com | Phone: +1 (555) 123-4567', { align: 'center', width: 515 });

// Add page numbers
addPageNumber();

// Finalize PDF
doc.end();

console.log(`✅ Enhanced PDF with images generated: ${filename}`);
