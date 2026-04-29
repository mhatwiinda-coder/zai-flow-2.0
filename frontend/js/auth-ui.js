// GLOBAL logout (must be outside DOMContentLoaded)
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  if (!user || !token) {
    window.location.href = "login.html";
    return;
  }

  if (user.role !== "admin") {
    const acc = document.querySelector("a[href='accounting.html']");
    if (acc) acc.style.display = "none";
  }

  if (user.role !== "inventory" && user.role !== "admin") {
    const inv = document.querySelector("a[href='inventory.html']");
    if (inv) inv.style.display = "none";
  }

  if (user.role !== "cashier" && user.role !== "admin") {
    const sales = document.querySelector("a[href='sales.html']");
    if (sales) sales.style.display = "none";
  }

});