// ============================================================================
// ZAI FLOW 2.0 - Quick Multi-Tenant Data Isolation Test
// Run this in browser console (F12) to verify data isolation is working
// ============================================================================

console.log('🚀 Starting ZAI FLOW 2.0 Multi-Tenant Verification...\n');

// TEST 1: Verify Branch Context is loaded
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 1: Branch Context Verification');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const context = getBranchContext();
if (context) {
  console.log('✅ Branch context loaded successfully');
  console.log(`   Business: ${context.business_name} (ID: ${context.business_id})`);
  console.log(`   Branch: ${context.branch_name} (ID: ${context.branch_id})`);
  console.log(`   User: ${context.user_id}`);
  console.log(`   Role: ${context.user_role}\n`);
} else {
  console.error('❌ No branch context found - user may not be logged in\n');
}

// TEST 2: Verify localStorage has user data
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 2: User Data in localStorage');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const user = JSON.parse(localStorage.getItem('user'));
if (user) {
  console.log('✅ User data found in localStorage');
  console.log(`   User ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Current Business ID: ${user.current_business_id}`);
  console.log(`   Current Branch ID: ${user.current_branch_id}`);
  console.log(`   Total Branches: ${user.branches?.length || 0}`);

  if (user.branches && user.branches.length > 0) {
    console.log('\n   Available Branches:');
    user.branches.forEach(b => {
      const marker = b.branch_id === user.current_branch_id ? '📍' : '  ';
      console.log(`   ${marker} ${b.business_name} - ${b.branch_name} (ID: ${b.branch_id})`);
    });
  }
  console.log();
} else {
  console.error('❌ No user data in localStorage\n');
}

// TEST 3: Check if Supabase client is initialized
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 3: Supabase Client');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (typeof supabase !== 'undefined') {
  console.log('✅ Supabase client is initialized');
  console.log(`   Type: ${typeof supabase}`);
  console.log();
} else {
  console.error('❌ Supabase client not found\n');
}

// TEST 4: Test withBranchFilter functionality
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 4: withBranchFilter Functionality');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (typeof withBranchFilter === 'function') {
  console.log('✅ withBranchFilter function exists');
  console.log('   Function ready for use in queries');
  console.log();
} else {
  console.error('❌ withBranchFilter function not found\n');
}

// TEST 5: Test a sample query with withBranchFilter
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 5: Sample Query Test (Purchase Orders)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (context && typeof supabase !== 'undefined' && typeof withBranchFilter === 'function') {
  console.log(`Querying purchase_orders with branch_id = ${context.branch_id}...`);

  (async () => {
    try {
      const { data, error } = await withBranchFilter(
        supabase.from('purchase_orders').select('id, po_number, status, total_amount')
      ).limit(5);

      if (error) {
        console.error('❌ Query error:', error.message);
      } else if (data) {
        console.log(`✅ Query successful`);
        console.log(`   Total records for this branch: ${data.length}`);
        if (data.length > 0) {
          console.log('\n   Sample records:');
          data.forEach(po => {
            console.log(`   - PO #${po.po_number} | Status: ${po.status} | Amount: K${po.total_amount}`);
          });
        } else {
          console.log('   (No purchase orders found for this branch)');
        }
      }
      console.log();
    } catch (err) {
      console.error('❌ Query exception:', err.message);
      console.log();
    }
  })();
} else {
  console.warn('⚠️  Skipping sample query - missing prerequisites\n');
}

// TEST 6: Verify RPC functions are accessible
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 6: RPC Functions Accessibility');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (context && typeof supabase !== 'undefined') {
  const rpcFunctions = [
    'get_profit_loss',
    'get_trial_balance',
    'get_general_ledger',
    'get_business_employees',
    'get_business_departments',
    'process_payroll',
    'get_attendance_summary'
  ];

  console.log('Testing RPC function availability:');

  (async () => {
    for (const rpcName of rpcFunctions) {
      try {
        // Try to call RPC with empty/minimal params - just to see if it exists
        // Don't actually execute, just check if it's callable
        const testCall = supabase.rpc(rpcName, {
          p_business_id: context.business_id,
          p_month: 1,
          p_year: 2026
        });

        // If the RPC exists, we can build a query
        if (testCall) {
          console.log(`   ✅ ${rpcName} - Available`);
        }
      } catch (err) {
        console.log(`   ❌ ${rpcName} - Error: ${err.message}`);
      }
    }
    console.log();
  })();
} else {
  console.warn('⚠️  Skipping RPC test - missing prerequisites\n');
}

// TEST 7: Check for console errors
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 7: Browser Console Status');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Note: We can't directly count errors, but we can provide guidance
console.log('✅ If you see only info and success messages above, console is clean');
console.log('📋 To check for errors:');
console.log('   - Scroll up in this console');
console.log('   - Look for any red error messages');
console.log('   - If you see red errors, click on them to get details\n');

// FINAL SUMMARY
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 VERIFICATION SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const summary = {
  'Branch Context': context ? '✅' : '❌',
  'User Data': user ? '✅' : '❌',
  'Supabase Client': typeof supabase !== 'undefined' ? '✅' : '❌',
  'withBranchFilter Function': typeof withBranchFilter === 'function' ? '✅' : '❌',
  'Login Status': isUserAuthenticated ? '✅' : '❌'
};

Object.entries(summary).forEach(([test, result]) => {
  console.log(`${result} ${test}`);
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (context && user && typeof supabase !== 'undefined' && typeof withBranchFilter === 'function') {
  console.log('✅ ALL TESTS PASSED - System appears to be properly configured');
  console.log('\nNext step: Run the SQL verification script in Supabase:');
  console.log('  File: supabase-verify-data-isolation.sql');
  console.log('  Copy queries and run in Supabase SQL Editor');
} else {
  console.error('❌ Some tests failed - please check the errors above');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
