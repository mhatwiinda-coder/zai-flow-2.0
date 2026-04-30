// Payroll Processing Module
// Depends on: supabase-init.js, hr.js

/* =====================================================
   PAYROLL PROCESSING
===================================================== */
function runPayroll() {
  (async () => {
    try {
      const month = parseInt(document.getElementById("payrollMonth").value);
      const year = parseInt(document.getElementById("payrollYear").value);

      if (!confirm(`Are you sure you want to run payroll for ${new Date(year, month - 1).toLocaleDateString('en-ZM', { month: 'long', year: 'numeric' })}?`)) {
        return;
      }

      // Call RPC function to process payroll
      const { data, error } = await window.supabase.rpc('process_payroll', {
        p_month: month,
        p_year: year
      });

      if (error) throw error;

      alert(`✅ Payroll processed successfully!\n\nPayroll Run ID: ${data[0].payroll_run_id}\nTotal Net: K ${formatMoney(data[0].total_net)}`);

      // Load the summary
      setTimeout(() => {
        loadPayrollSummary();
      }, 1000);
    } catch (err) {
      console.error("Payroll processing error:", err);
      alert("Failed to process payroll: " + err.message);
    }
  })();
}

function loadPayrollSummary() {
  (async () => {
    try {
      const month = parseInt(document.getElementById("payrollMonth").value);
      const year = parseInt(document.getElementById("payrollYear").value);

      // Get payroll run
      const { data: payrollRuns, error: runError } = await window.supabase
        .from('payroll_runs')
        .select('*')
        .eq('month', month)
        .eq('year', year)
        .limit(1);

      if (runError) throw runError;

      if (!payrollRuns || payrollRuns.length === 0) {
        document.getElementById("payrollSummaryCard").style.display = 'none';
        document.getElementById("payrollTable").innerHTML = '';
        document.getElementById("noPayrollData").style.display = 'block';
        return;
      }

      const payrollRun = payrollRuns[0];

      // Display summary
      document.getElementById("payrollSummaryCard").style.display = 'block';
      document.getElementById("totalGross").innerText = formatMoney(payrollRun.total_gross);
      document.getElementById("totalDeductions").innerText = formatMoney(payrollRun.total_deductions);
      document.getElementById("totalNet").innerText = formatMoney(payrollRun.total_net);

      // Load payroll details
      const { data: deductions, error: dedError } = await supabase
        .from('payroll_deductions')
        .select('*, employees(employee_code, first_name, last_name)')
        .eq('payroll_run_id', payrollRun.id)
        .order('employee_id', { ascending: true });

      if (dedError) throw dedError;

      document.getElementById("employeeCount").innerText = deductions ? deductions.length : 0;

      if (!Array.isArray(deductions) || deductions.length === 0) {
        document.getElementById("noPayrollData").style.display = 'block';
        return;
      }

      document.getElementById("noPayrollData").style.display = 'none';
      let html = '';
      deductions.forEach(ded => {
        const empName = ded.employees ? `${ded.employees.first_name} ${ded.employees.last_name}` : 'N/A';
        const empCode = ded.employees ? ded.employees.employee_code : 'N/A';

        html += `
          <tr>
            <td><strong>${empCode}</strong></td>
            <td>${empName}</td>
            <td>${formatMoney(ded.gross_salary)}</td>
            <td>${formatMoney(ded.paye_tax)}</td>
            <td>${formatMoney(ded.pension_contribution)}</td>
            <td>${formatMoney(ded.other_deductions)}</td>
            <td><strong>${formatMoney(ded.net_salary)}</strong></td>
            <td>
              <button class="btn-view" onclick="generatePayslip(${ded.id}, ${ded.payroll_run_id})">Payslip</button>
            </td>
          </tr>
        `;
      });

      document.getElementById("payrollTable").innerHTML = html;
    } catch (err) {
      console.error("Load payroll summary error:", err);
      alert("Failed to load payroll summary: " + err.message);
    }
  })();
}

function generatePayslip(deductionId, payrollRunId) {
  (async () => {
    try {
      // Get payroll deduction details
      const { data: deductions, error: dedError } = await supabase
        .from('payroll_deductions')
        .select('*, employees(employee_code, first_name, last_name, position), payroll_runs(*)')
        .eq('id', deductionId)
        .limit(1);

      if (dedError) throw dedError;
      if (!deductions || deductions.length === 0) {
        alert("Payslip not found");
        return;
      }

      const ded = deductions[0];
      const emp = ded.employees;
      const payroll = ded.payroll_runs;

      // Format date
      const monthYear = new Date(payroll.year, payroll.month - 1).toLocaleDateString('en-ZM', {
        month: 'long',
        year: 'numeric'
      });

      // Create payslip HTML
      const payslipHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Payslip - ${emp.employee_code}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
              background: white;
            }
            .payslip-container {
              max-width: 800px;
              margin: 0 auto;
              border: 2px solid #333;
              padding: 30px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #f7c948;
            }
            .payslip-title {
              font-size: 18px;
              font-weight: bold;
              margin-top: 10px;
            }
            .employee-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
              padding: 15px;
              background: #f5f5f5;
              border-radius: 5px;
            }
            .info-row {
              display: grid;
              grid-template-columns: 120px 1fr;
              gap: 10px;
              margin-bottom: 8px;
            }
            .info-label {
              font-weight: bold;
              color: #666;
            }
            .info-value {
              color: #333;
            }
            .earnings-table,
            .deductions-table {
              width: 100%;
              margin-bottom: 30px;
              border-collapse: collapse;
            }
            .table-title {
              font-weight: bold;
              font-size: 14px;
              margin-top: 20px;
              margin-bottom: 10px;
              border-bottom: 2px solid #333;
              padding-bottom: 5px;
            }
            .earnings-table th,
            .deductions-table th {
              background: #f0f0f0;
              padding: 10px;
              text-align: left;
              border: 1px solid #ddd;
              font-weight: bold;
            }
            .earnings-table td,
            .deductions-table td {
              padding: 10px;
              border: 1px solid #ddd;
              text-align: right;
            }
            .earnings-table td:first-child,
            .deductions-table td:first-child {
              text-align: left;
            }
            .summary-row {
              display: grid;
              grid-template-columns: 1fr 200px;
              gap: 20px;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 2px solid #333;
            }
            .summary-item {
              display: grid;
              grid-template-columns: 150px 1fr;
              gap: 20px;
              padding: 10px 0;
              font-weight: bold;
              font-size: 16px;
            }
            .summary-label {
              text-align: right;
            }
            .summary-value {
              text-align: right;
              color: #f7c948;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
            }
            @media print {
              body { margin: 0; padding: 0; }
              .payslip-container { border: none; margin: 0; padding: 0; }
              .no-print { display: none; }
            }
            .no-print {
              text-align: center;
              margin-bottom: 20px;
            }
            .no-print button {
              padding: 10px 20px;
              font-size: 14px;
              background: #f7c948;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              margin: 0 5px;
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()">🖨️ Print</button>
            <button onclick="window.close()">❌ Close</button>
          </div>

          <div class="payslip-container">
            <div class="header">
              <div class="company-name">ZAI FLOW</div>
              <div class="payslip-title">PAYSLIP for ${monthYear}</div>
            </div>

            <div class="employee-info">
              <div>
                <div class="info-row">
                  <div class="info-label">Employee Code:</div>
                  <div class="info-value">${emp.employee_code}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Name:</div>
                  <div class="info-value">${emp.first_name} ${emp.last_name}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Position:</div>
                  <div class="info-value">${emp.position}</div>
                </div>
              </div>
              <div>
                <div class="info-row">
                  <div class="info-label">Pay Period:</div>
                  <div class="info-value">${monthYear}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Date Issued:</div>
                  <div class="info-value">${new Date().toLocaleDateString('en-ZM')}</div>
                </div>
              </div>
            </div>

            <div class="table-title">EARNINGS</div>
            <table class="earnings-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount (ZMW)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Gross Salary</td>
                  <td>${formatMoney(ded.gross_salary)}</td>
                </tr>
              </tbody>
            </table>

            <div class="table-title">DEDUCTIONS</div>
            <table class="deductions-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount (ZMW)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>PAYE Tax</td>
                  <td>${formatMoney(ded.paye_tax)}</td>
                </tr>
                <tr>
                  <td>Pension Contribution</td>
                  <td>${formatMoney(ded.pension_contribution)}</td>
                </tr>
                ${ded.other_deductions > 0 ? `
                <tr>
                  <td>Other Deductions</td>
                  <td>${formatMoney(ded.other_deductions)}</td>
                </tr>
                ` : ''}
                <tr style="background: #f0f0f0; font-weight: bold;">
                  <td>Total Deductions</td>
                  <td>${formatMoney(ded.paye_tax + ded.pension_contribution + ded.other_deductions)}</td>
                </tr>
              </tbody>
            </table>

            <div class="summary-row">
              <div></div>
              <div>
                <div class="summary-item">
                  <div class="summary-label">Net Pay:</div>
                  <div class="summary-value">${formatMoney(ded.net_salary)}</div>
                </div>
              </div>
            </div>

            <div class="footer">
              <p>This is an automatically generated payslip. For queries, contact HR.</p>
              <p>ZAI FLOW © 2026 - Confidential</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Open payslip in new window
      const payslipWindow = window.open();
      payslipWindow.document.write(payslipHTML);
      payslipWindow.document.close();
    } catch (err) {
      console.error("Generate payslip error:", err);
      alert("Failed to generate payslip: " + err.message);
    }
  })();
}

function reversePayroll() {
  (async () => {
    try {
      const month = parseInt(document.getElementById("payrollMonth").value);
      const year = parseInt(document.getElementById("payrollYear").value);

      // Get payroll run ID
      const { data: payrollRuns } = await supabase
        .from('payroll_runs')
        .select('id')
        .eq('month', month)
        .eq('year', year)
        .limit(1);

      if (!payrollRuns || payrollRuns.length === 0) {
        alert("No payroll run found for this month");
        return;
      }

      if (!confirm("Are you sure you want to reverse this payroll run? This action cannot be undone.")) {
        return;
      }

      const { data, error } = await window.supabase.rpc('reverse_payroll', {
        p_payroll_run_id: payrollRuns[0].id
      });

      if (error) throw error;

      alert("✅ Payroll reversed successfully");
      loadPayrollSummary();
    } catch (err) {
      console.error("Reverse payroll error:", err);
      alert("Failed to reverse payroll: " + err.message);
    }
  })();
}

/* =====================================================
   HELPER FUNCTIONS
===================================================== */
function formatMoney(value) {
  return "K " + Number(value || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
