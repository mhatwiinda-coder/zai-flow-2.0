// Supabase authentication - Direct client-side auth
async function login() {
  const errorDiv = document.getElementById("error");
  errorDiv.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    errorDiv.textContent = "Email and password are required";
    return;
  }

  try {
    // Sign in with Supabase Auth
    const { data, error } = await window.supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      throw new Error(error.message || "Invalid email or password");
    }

    if (!data.user) {
      throw new Error("Login failed - no user returned");
    }

    console.log("✅ Supabase Auth successful:", data.user.email);

    // Get user profile from database using auth_id
    const { data: profile, error: profileError } = await window.supabase
      .from('users')
      .select('id, name, email, role, business_id')
      .eq('auth_id', data.user.id)
      .single();

    if (profileError) {
      console.error("❌ Profile fetch error:", profileError.message);
      throw new Error("User profile not found. Please contact administrator.");
    }

    console.log("✅ Profile found:", {id: profile.id, name: profile.name, business_id: profile.business_id});

    // Fetch user's assigned branches from user_branch_access
    const { data: branches, error: branchError } = await window.supabase
      .from('user_branch_access')
      .select(`
        branch_id,
        branches(id, name, business_id, business_entities(id, name)),
        is_primary_branch,
        role
      `)
      .eq('user_id', profile.id)
      .eq('status', 'ACTIVE');

    if (branchError) {
      console.error("❌ Branches fetch error:", branchError.message);
    }

    console.log("✅ Branches fetched:", branches?.length || 0, "branches");

    // Find primary branch, or default to first branch
    let primaryBranch = branches?.find(b => b.is_primary_branch);
    if (!primaryBranch && branches?.length > 0) {
      primaryBranch = branches[0];
    }

    if (!primaryBranch) {
      console.error("❌ No branches assigned to user");
      throw new Error("No branches assigned to your account. Please contact administrator.");
    }

    // Format branches array for branch-context
    const branchesArray = branches.map(b => ({
      branch_id: b.branch_id,
      branch_name: b.branches?.name || 'Unknown',
      business_id: b.branches?.business_id,
      business_name: b.branches?.business_entities?.name || 'Unknown',
      role: b.role,
      is_primary: b.is_primary_branch
    }));

    // Store user info in localStorage with branch context
    const userInfo = {
      id: profile.id,
      auth_id: data.user.id,
      email: data.user.email,
      name: profile.name || email.split('@')[0],
      role: profile.role || 'user',
      business_id: profile.business_id,
      current_branch_id: primaryBranch.branch_id,
      current_business_id: primaryBranch.branches.business_id,
      branches: branchesArray,
      auth_session: data.session
    };

    localStorage.setItem("user", JSON.stringify(userInfo));
    localStorage.setItem("token", data.session.access_token);

    console.log("✅ User logged in:", userInfo.email);
    console.log("✅ Primary branch set:", {
      branch_id: primaryBranch.branch_id,
      branch_name: primaryBranch.branches.name,
      business_id: primaryBranch.branches.business_id,
      business_name: primaryBranch.branches.business_entities.name
    });

    // Redirect to employee landing page
    window.location.href = "employee-landing.html";
  } catch (err) {
    errorDiv.textContent = err.message || "Login failed. Please try again.";
    console.error("❌ Login error:", err);
  }
}

// Logout function
async function logout() {
  try {
    await window.supabase.auth.signOut();
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "login.html";
  } catch (err) {
    console.error("Logout error:", err);
  }
}

// Check if user is logged in
function isLoggedIn() {
  return localStorage.getItem("user") !== null;
}

// Get current user
function getCurrentUser() {
  const userJson = localStorage.getItem("user");
  return userJson ? JSON.parse(userJson) : null;
}
