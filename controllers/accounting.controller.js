const db = require("../data/db");

/* ===============================
   GET ACCOUNT ID BY CODE
=============================== */
exports.getAccountIdByCode = (code) => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id FROM chart_of_accounts WHERE account_code = ?`,
      [code],
      (err, row) => {
        if (err)  return reject(err);
        if (!row) return reject(new Error("Account not found: " + code));
        resolve(row.id);
      }
    );
  });
};


/* ===============================
   POST JOURNAL (double-entry)
=============================== */
exports.postJournal = (reference, description, lines) => {
  return new Promise((resolve, reject) => {

    const totalDebit  = lines.reduce((s, l) => s + (l.debit  || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return reject(new Error("Journal not balanced"));
    }

    db.run(
      `INSERT INTO journal_entries (reference, description) VALUES (?, ?)`,
      [reference, description],
      function (err) {
        if (err) return reject(err);

        const journalId = this.lastID;

        lines.forEach(line => {
          db.run(
            `INSERT INTO journal_lines (journal_id, account_id, debit, credit) VALUES (?, ?, ?, ?)`,
            [journalId, line.account_id, line.debit || 0, line.credit || 0]
          );
        });

        resolve(journalId);
      }
    );
  });
};


/* ===============================
   PROFIT & LOSS
=============================== */
exports.profitAndLoss = (req, res) => {
  db.get(`
    SELECT
      SUM(CASE WHEN a.account_type = 'REVENUE'
               THEN j.credit - j.debit ELSE 0 END) AS revenue,
      SUM(CASE WHEN a.account_type = 'EXPENSE'
               THEN j.debit - j.credit ELSE 0 END) AS expenses
    FROM journal_lines j
    JOIN chart_of_accounts a ON a.id = j.account_id
  `, [], (err, row) => {
    if (err) return res.status(500).json(err);
    const revenue  = row.revenue  || 0;
    const expenses = row.expenses || 0;
    res.json({ revenue, expenses, net_profit: revenue - expenses });
  });
};


/* ===============================
   ALL ACCOUNTS
=============================== */
exports.getAllAccounts = (req, res) => {
  db.all(
    `SELECT * FROM chart_of_accounts ORDER BY account_code ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
};


/* ===============================
   TRIAL BALANCE
=============================== */
exports.trialBalance = (req, res) => {
  db.all(`
    SELECT
      a.account_code,
      a.account_name,
      a.account_type,
      SUM(j.debit)  AS total_debit,
      SUM(j.credit) AS total_credit
    FROM journal_lines j
    JOIN chart_of_accounts a ON a.id = j.account_id
    GROUP BY a.id, a.account_code, a.account_name, a.account_type
    ORDER BY a.account_code ASC
  `, [], (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
};


/* ===============================
   GENERAL LEDGER
=============================== */
exports.generalLedger = (req, res) => {
  db.all(`
    SELECT
      e.reference,
      e.description,
      e.created_at,
      a.account_name,
      j.debit,
      j.credit
    FROM journal_lines j
    JOIN journal_entries     e ON e.id = j.journal_id
    JOIN chart_of_accounts   a ON a.id = j.account_id
    ORDER BY e.created_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
};


/* ===============================
   EXPORT: TRIAL BALANCE (Excel)
=============================== */
const ExcelJS = require("exceljs");

exports.exportTrialBalance = async (req, res) => {

  const workbook = new ExcelJS.Workbook();
  const sheet    = workbook.addWorksheet("Trial Balance");

  sheet.columns = [
    { header: "Code",    key: "account_code"  },
    { header: "Account", key: "account_name"  },
    { header: "Type",    key: "account_type"  },
    { header: "Debit",   key: "total_debit"   },
    { header: "Credit",  key: "total_credit"  }
  ];

  db.all(`
    SELECT
      a.account_code,
      a.account_name,
      a.account_type,
      SUM(j.debit)  AS total_debit,
      SUM(j.credit) AS total_credit
    FROM journal_lines j
    JOIN chart_of_accounts a ON a.id = j.account_id
    GROUP BY a.id, a.account_code, a.account_name, a.account_type
  `, [], async (err, rows) => {
    if (err)              return res.status(500).json({ error: "Failed to generate report" });
    if (!rows?.length)    return res.status(404).json({ error: "No data found" });

    rows.forEach(r => sheet.addRow(r));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=trial_balance.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  });
};


/* ===============================
   EXPORT: GENERAL LEDGER (Excel)
=============================== */
exports.exportLedger = async (req, res) => {

  const workbook = new ExcelJS.Workbook();
  const sheet    = workbook.addWorksheet("General Ledger");

  sheet.columns = [
    { header: "Date",        key: "created_at"   },
    { header: "Reference",   key: "reference"    },
    { header: "Description", key: "description"  },
    { header: "Account",     key: "account_name" },
    { header: "Debit",       key: "debit"        },
    { header: "Credit",      key: "credit"       }
  ];

  db.all(`
    SELECT
      e.reference,
      e.description,
      e.created_at,
      a.account_name,
      j.debit,
      j.credit
    FROM journal_lines j
    JOIN journal_entries   e ON e.id = j.journal_id
    JOIN chart_of_accounts a ON a.id = j.account_id
    ORDER BY e.created_at DESC
  `, [], async (err, rows) => {
    if (err || !rows) return res.status(500).json({ error: "Failed" });

    rows.forEach(r => sheet.addRow(r));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=general_ledger.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  });
};
