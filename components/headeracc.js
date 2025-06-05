// Chạy khi DOM đã sẵn sàng
window.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user") || '{}');
  const accountLink = document.getElementById("account-link");

  if (user && user.username) {
    accountLink.innerHTML = `<span>👤</span><span>${user.username}</span>`;
  }

  const searchBox = document.querySelector('.search-box');
  const accountNavItem = document.querySelector('.nav-item');
  const dropdown = accountNavItem ? accountNavItem.querySelector('.dropdown') : null;
  let dropdownVisible = false;

  if (accountLink && dropdown) {
    accountLink.addEventListener('click', (e) => {
      e.preventDefault();
      dropdownVisible = !dropdownVisible;
      dropdown.style.display = dropdownVisible ? 'block' : 'none';
    });

    document.addEventListener('click', function (e) {
      if (!accountNavItem.contains(e.target)) {
        dropdown.style.display = 'none';
        dropdownVisible = false;
      }
    });
  }

  const genreLink = document.querySelector('.nav-link[href="genres.html"]');
  if (genreLink) {
    genreLink.addEventListener('click', () => {
      window.location.href = 'genres.html';
    });
  }

  const logoutLink = document.querySelector('.logout-btn');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
});

function logout() {
      if (typeof(Storage) !== "undefined") {
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
      }
      
      alert("Đã đăng xuất thành công!");
      window.location.href = "login.html";
      console.log("Logout clicked - User logged out");
    }
