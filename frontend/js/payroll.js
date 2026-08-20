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

      // Get branch context
      const context = getBranchContext();
      if (!context) {
        throw new Error('No branch context available - please log in again');
      }

      // Call RPC function to process payroll
      const { data, error } = await window.supabase.rpc('process_payroll', {
        p_branch_id: context.branch_id,
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

      const context = getBranchContext();
      if (!context) {
        throw new Error('No branch context available - please log in again');
      }

      // Get payroll run
      const { data: payrollRuns, error: runError } = await window.supabase
        .from('payroll_runs')
        .select('*')
        .eq('branch_id', context.branch_id)
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
      const { data: deductions, error: dedError } = await window.supabase
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
            <td>${formatMoney(ded.napsa_contribution || 0)}</td>
            <td>${formatMoney(ded.health_insurance || 0)}</td>
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
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Arial', sans-serif; background: #f5f5f5; padding: 20px; color: #333; }
            .no-print { text-align: center; margin-bottom: 20px; padding: 10px; }
            .no-print button { padding: 12px 24px; margin: 0 5px; background: #2c5aa0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; }
            .no-print button:hover { background: #1e3f5a; }
            .payslip-container { max-width: 900px; margin: 0 auto; background: white; border: 3px solid #333; position: relative; }
            .confidential { position: absolute; top: 20px; right: 20px; background: #90EE90; padding: 8px 12px; font-weight: bold; font-size: 14px; border: 2px solid #333; transform: rotate(-15deg); opacity: 0.9; }
            .header { text-align: center; padding: 20px; border-bottom: 2px solid #333; }
            .company-name { font-size: 28px; font-weight: bold; color: #2c5aa0; margin-bottom: 5px; }
            .payslip-title { font-size: 16px; font-weight: bold; color: #333; }
            .pay-period { font-size: 12px; color: #666; margin-top: 5px; }
            .employee-info { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; padding: 20px; border-bottom: 2px solid #ddd; }
            .info-column { font-size: 13px; line-height: 1.8; }
            .info-label { font-weight: bold; display: inline-block; width: 120px; }
            .info-value { display: inline-block; color: #333; }
            .table-header { display: grid; grid-template-columns: 1fr 1fr 1fr; background: #4a7c3b; color: white; font-weight: bold; padding: 12px 10px; font-size: 13px; margin-bottom: 10px; }
            .earnings-deductions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; border: 1px solid #ddd; margin-bottom: 20px; }
            .column { border-right: 1px solid #ddd; padding: 10px; min-height: 100px; }
            .column:last-child { border-right: none; }
            .item { display: grid; grid-template-columns: 1fr auto; gap: 10px; padding: 8px 0; font-size: 12px; border-bottom: 1px solid #eee; }
            .item:last-child { border-bottom: none; }
            .amount { text-align: right; min-width: 80px; font-weight: 500; }
            .totals { display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid #333; border-top: 2px solid #333; background: #f0f0f0; font-weight: bold; font-size: 13px; }
            .total { padding: 12px 10px; border-right: 1px solid #333; text-align: left; }
            .total:last-child { border-right: none; }
            .net-pay { background: #4a7c3b; color: white; padding: 15px; margin: 20px 0; text-align: center; }
            .net-label { font-weight: bold; font-size: 14px; margin-bottom: 5px; }
            .net-amount { font-size: 24px; font-weight: bold; }
            .in-words { text-align: center; font-size: 11px; color: #666; padding: 10px 0; font-style: italic; }
            .footer { border-top: 2px solid #ddd; padding: 15px 20px; background: #f9f9f9; font-size: 11px; color: #666; text-align: center; }
            .footer p { margin: 5px 0; }
            .content { padding: 20px; }
            @media print { body { margin: 0; padding: 0; background: white; } .no-print { display: none !important; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()">🖨️ Print Payslip</button>
            <button onclick="window.close()">❌ Close</button>
          </div>

          <div class="payslip-container">
            <div class="confidential">CONFIDENTIAL</div>
            <div class="header">
              <div class="company-name">ZAI FLOW</div>
              <div class="payslip-title">PAY SLIP</div>
              <div class="pay-period">For the month of ${monthYear}</div>
            </div>

            <div class="employee-info">
              <div class="info-column">
                <div><span class="info-label">Name</span><span class="info-value">: ${emp.first_name} ${emp.last_name}</span></div>
                <div><span class="info-label">Employee ID</span><span class="info-value">: ${emp.employee_code}</span></div>
              </div>
              <div class="info-column">
                <div><span class="info-label">Title</span><span class="info-value">: ${emp.position || 'N/A'}</span></div>
                <div><span class="info-label">Pay Period</span><span class="info-value">: ${monthYear}</span></div>
              </div>
            </div>

            <div class="content">
              <div class="table-header">
                <div>Description</div>
                <div>Earnings</div>
                <div>Deductions</div>
              </div>

              <div class="earnings-deductions">
                <div class="column">
                  <div class="item">
                    <span>Basic Salary</span>
                    <span class="amount">${formatMoney(ded.gross_salary)}</span>
                  </div>
                </div>
                <div style="border-right: 1px solid #ddd;"></div>
                <div class="column" style="border-right: none;">
                  <div class="item">
                    <span>PAYE Tax (Progressive)</span>
                    <span class="amount">${formatMoney(ded.paye_tax)}</span>
                  </div>
                  <div class="item">
                    <span>NAPSA (5%)</span>
                    <span class="amount">${formatMoney(ded.napsa_contribution || 0)}</span>
                  </div>
                  <div class="item">
                    <span>Health Insurance (1%)</span>
                    <span class="amount">${formatMoney(ded.health_insurance || 0)}</span>
                  </div>
                  ${ded.other_deductions > 0 ? `<div class="item"><span>Other Deductions</span><span class="amount">${formatMoney(ded.other_deductions)}</span></div>` : ''}
                </div>
              </div>

              <div class="totals">
                <div class="total">Total</div>
                <div class="total"><span style="float: right;">${formatMoney(ded.gross_salary)}</span></div>
                <div class="total"><span style="float: right;">${formatMoney((ded.paye_tax || 0) + (ded.napsa_contribution || 0) + (ded.health_insurance || 0) + (ded.other_deductions || 0))}</span></div>
              </div>

              <div class="net-pay">
                <div class="net-label">NET PAY</div>
                <div class="net-amount">${formatMoney(ded.net_salary)}</div>
              </div>

              <div class="in-words">
                Kwacha: ${formatMoney(ded.net_salary)}
              </div>
            </div>

            <div class="footer">
              <p>This is an electronically generated payslip. For queries, contact Human Resources.</p>
              <p>ZAI FLOW © 2026 - Confidential and Proprietary</p>
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

      const context = getBranchContext();
      if (!context) {
        alert('No branch context available - please log in again');
        return;
      }

      // Get payroll run ID
      const { data: payrollRuns } = await window.supabase
        .from('payroll_runs')
        .select('id')
        .eq('branch_id', context.branch_id)
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
