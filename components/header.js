// Load user data from localStorage
    const current_user = JSON.parse(localStorage.getItem("user") || '{}');
    const accountLink = document.getElementById("account-link");
 
    if (current_user && current_user.username) {
      accountLink.innerHTML = `<span>👤</span><span>${current_user.username}</span>`;
    }

    function logout() {
      if (typeof(Storage) !== "undefined") {
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
      }
      
      alert("Đã đăng xuất thành công!");
      window.location.href = "login.html";
      console.log("Logout clicked - User logged out");
    }

    // Search functionality
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let searchTimeout;
    let isSearching = false;

    // API base URL
    const API_BASE_URL = 'http://192.168.11.198:3001/api/books'; 

    searchInput.addEventListener('input', function() {
      const query = this.value.trim();
      
      if (query.length === 0) {
        hideSearchResults();
        this.style.borderColor = 'var(--avocado-light)';
        return;
      }

      this.style.borderColor = 'var(--avocado-green)';

      // Debounce search - chờ 300ms sau khi user ngừng gõ
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        performSearch(query);
      }, 300);
    });

    // Ẩn kết quả khi click ra ngoài
    document.addEventListener('click', function(event) {
      if (!searchInput.contains(event.target) && !searchResults.contains(event.target)) {
        hideSearchResults();
      }
    });

    // Hiển thị kết quả khi focus vào search box (nếu có text)
    searchInput.addEventListener('focus', function() {
      if (this.value.trim().length > 0 && searchResults.children.length > 0) {
        showSearchResults();
      }
    });

    async function performSearch(query) {
      if (isSearching) return;
      
      isSearching = true;
      showLoadingState();

      try {
        const response = await fetch(`${API_BASE_URL}/search?query=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
          throw new Error('Lỗi khi tìm kiếm');
        }

        const books = await response.json();
        displaySearchResults(books);
      } catch (error) {
        console.error('Search error:', error);
        showErrorState();
      } finally {
        isSearching = false;
      }
    }

    function showLoadingState() {
      searchResults.innerHTML = `
        <div class="search-loading">
          <div class="loading-spinner"></div>
          Đang tìm kiếm...
        </div>
      `;
      showSearchResults();
    }

    function showErrorState() {
      searchResults.innerHTML = `
        <div class="search-no-results">
          ❌ Có lỗi xảy ra. Vui lòng thử lại.
        </div>
      `;
      showSearchResults();
    }

    function displaySearchResults(books) {
      if (books.length === 0) {
        searchResults.innerHTML = `
          <div class="search-no-results">
            Không tìm thấy truyện nào phù hợp
          </div>
        `;
      } else {
        searchResults.innerHTML = books.map(book => `
          <div class="search-result-item" onclick="goToBook(${book.book_id})">
            <img 
              src="${book.cover_image || 'default-cover.jpg'}" 
              alt="${book.title}"
              class="search-result-cover"
              
            >
            <div class="search-result-info">
              <div class="search-result-title">${escapeHtml(book.title)}</div>
              <div class="search-result-author">Tác giả: ${escapeHtml(book.author)}</div>
            </div>
          </div>
        `).join('');
      }
      
      showSearchResults();
    }

    function showSearchResults() {
      searchResults.style.display = 'block';
    }

    function hideSearchResults() {
      searchResults.style.display = 'none';
    }

    function goToBook(bookId) {
      // Chuyển hướng đến trang chi tiết truyện
      window.location.href = `detail.html?id=${bookId}`;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Account dropdown functionality
    const accountNavItem = document.querySelector('.nav-item');
    const dropdown = accountNavItem.querySelector('.dropdown');
    let dropdownVisible = false;

    accountLink.addEventListener('click', (e) => {
      e.preventDefault();
      dropdownVisible = !dropdownVisible;
      dropdown.style.display = dropdownVisible ? 'block' : 'none';
    });

    // Ẩn dropdown khi click ra ngoài
    document.addEventListener('click', function(e) {
      if (!accountNavItem.contains(e.target)) {
        dropdown.style.display = 'none';
        dropdownVisible = false;
      }
    });