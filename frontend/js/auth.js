// Supabase login via RPC function
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
    // Call local login endpoint (uses Supabase SDK on server side)
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    if (!response.ok) {
      throw new Error("Login request failed");
    }

    const result = await response.json();
    console.log("RPC response:", result);

    // Result is now a single JSON object, not an array
    if (!result || typeof result !== 'object') {
      throw new Error("Invalid response from server");
    }

    const user = result;
    console.log("User data:", user);

    // Check if login was successful
    if (!user.success) {
      throw new Error(user.message || "Invalid email or password");
    }

    // Store user info (including branches for multi-tenant)
    const userInfo = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branches: user.branches || [],
      current_branch_id: user.current_branch_id,
      current_business_id: user.current_business_id
    };
    localStorage.setItem("user", JSON.stringify(userInfo));
    localStorage.setItem("token", user.id.toString());

    // Redirect ALL users to employee landing page based on their role
    // The employee landing page will load accessible modules based on user's role
    // and display role-specific dashboard with clock in/out, tasks, notifications
    window.location.href = "employee-landing.html";
  } catch (err) {
    errorDiv.textContent = err.message || "Login failed. Please try again.";
    console.error("Login error:", err);
  }
}
