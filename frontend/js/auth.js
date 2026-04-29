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
    const { data, error } = await supabase.auth.signInWithPassword({
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

    // Get user profile from database
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, name, email, role, business_id, branch_id')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.warn("Profile fetch error:", profileError);
    }

    // Store user info in localStorage
    const userInfo = {
      id: data.user.id,
      email: data.user.email,
      name: profile?.name || data.user.user_metadata?.name || email.split('@')[0],
      role: profile?.role || 'user',
      business_id: profile?.business_id,
      branch_id: profile?.branch_id,
      auth_session: data.session
    };

    localStorage.setItem("user", JSON.stringify(userInfo));
    localStorage.setItem("token", data.session.access_token);

    console.log("✅ User logged in:", userInfo.email);

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
    await supabase.auth.signOut();
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
