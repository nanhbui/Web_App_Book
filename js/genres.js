const api_URL = 'http://192.168.11.198:3001'; 

function logout() {
      window.location.href = "login.html";
    }

    // State management
    let selectedTags = [];
    let filteredStories = [];
    let currentPage = 1;
    const storiesPerPage = 16;

    // DOM elements
    const genreGrid = document.getElementById("genre-grid");
    const storyList = document.getElementById("story-list");
    const filtersSection = document.getElementById("filters-section");
    const filteredStoriesSection = document.getElementById("filtered-stories");
    const emptyState = document.getElementById("empty-state");
    const loadingState = document.getElementById("loading-state");
    const resultsCount = document.getElementById("results-count");
    const pagination = document.getElementById("pagination");

    // Initialize
    async function init() {
      await fetchTags();
      setupEventListeners();
    }

    // Fetch tags from API
    async function fetchTags() {
      try {
        showLoading();
        const response = await fetch(`${api_URL}/api/books/tags/with-count`);
        const tags = await response.json();
        renderTags(tags);
        hideLoading();
      } catch (err) {
        console.error('Error fetching tags:', err);
        hideLoading();
      }
    }

    // Render tag cards
    function renderTags(tags) {
      genreGrid.innerHTML = "";
      tags.forEach(tag => {
        const card = document.createElement("div");
        card.className = "genre-card";
        card.innerHTML = `
          <div class="genre-name">${tag.name}</div>
          <div class="genre-count">${tag.book_count} truyện</div>
        `;
        card.onclick = () => toggleTag(card, tag.name);
        genreGrid.appendChild(card);
      });
    }

    // Toggle tag selection
    function toggleTag(card, tagName) {
      card.classList.toggle("selected");
      if (selectedTags.includes(tagName)) {
        selectedTags = selectedTags.filter(t => t !== tagName);
      } else {
        selectedTags.push(tagName);
      }
      
      if (selectedTags.length > 0) {
        showFiltersAndResults();
        filterAndDisplayStories();
      } else {
        hideFiltersAndResults();
      }
    }

    // Show filters and results sections
    function showFiltersAndResults() {
      filtersSection.style.display = "block";
      filteredStoriesSection.style.display = "block";
      emptyState.style.display = "none";
    }

    // Hide filters and results sections
    function hideFiltersAndResults() {
      filtersSection.style.display = "none";
      filteredStoriesSection.style.display = "none";
      emptyState.style.display = "none";
    }

    // Filter and display stories
    async function filterAndDisplayStories() {
      showLoading();
      
      try {
        // Get filter values
        const statusFilter = document.getElementById("status-filter").value;
        const sortFilter = document.getElementById("sort-filter").value;
        
        // Build query parameters
        const params = new URLSearchParams();
        params.append('page', currentPage);
        
        if (selectedTags.length > 0) {
          params.append('tags', selectedTags.join(','));
        }
        
        if (statusFilter) {
          params.append('status', statusFilter);
        }
        
        if (sortFilter) {
          params.append('sort', sortFilter === 'az' ? 'az' : 
                          sortFilter === 'views' ? 'views' : 
                          sortFilter === 'rating' ? 'rating' : 'new');
        }

        const response = await fetch(`${api_URL}/api/books/books?${params.toString()}`);
        const data = await response.json();
        
        filteredStories = data.books || [];
        updateResultsDisplay();
        renderStoriesWithAnimation();
        renderPagination();
      } catch (err) {
        console.error('Error fetching stories:', err);
        filteredStories = [];
        updateResultsDisplay();
      } finally {
        hideLoading();
      }
    }

    // Update results display
    function updateResultsDisplay() {
      const count = filteredStories.length;
      resultsCount.innerHTML = `Tìm thấy <span class="count">${count}</span> truyện`;
      
      const selectedGenreTitle = document.getElementById("selected-genre-title");
      selectedGenreTitle.textContent = `${selectedTags.join(", ")}`;

      if (count === 0) {
        storyList.style.display = "none";
        pagination.style.display = "none";
        emptyState.style.display = "block";
      } else {
        storyList.style.display = "grid";
        pagination.style.display = "flex";
        emptyState.style.display = "none";
      }
    }

    // Render stories for current page
    function renderStoriesWithAnimation() {
      storyList.innerHTML = "";
      
      filteredStories.forEach((story, index) => {
        const card = document.createElement("div");
        card.className = "story-card";
        card.style.animationDelay = `${index * 0.1}s`;
        
        let statusClass = '';
        let statusText = '';

        if (story.status === 'Hoàn thành') {
           statusClass = 'status-completed';
           statusText = 'Hoàn thành';
        } else if (story.status === 'Tạm dừng') {
           statusClass = 'status-paused';
           statusText = 'Tạm dừng';
        } else {
           statusClass = 'status-ongoing';
           statusText = 'Đang tiến hành';
        }

        card.innerHTML = `
          <div class="story-image">
            <img src="${story.cover_image}" alt="${story.title}" />
            <div class="story-status ${statusClass}">${statusText}</div>
          </div>
          <div class="story-content">
            <h3 class="story-title">${story.title}</h3>
            <div class="story-author">👤 ${story.author || 'Không rõ'}</div>
            <p class="story-description">${story.description || 'Không có mô tả'}</p>
            
            <div class="story-tags">
              ${story.tags ? story.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
            </div>
            
            <div class="story-meta">
              <div class="story-stats">
                <div class="stat-item">
                  <img src="components/images/view.png" alt="logout" style="width: 16px; height: 16px; margin-right: 3px;">
                  <span>${formatNumber(story.views)}</span>
                </div>
                <div class="stat-item">
                  <img src="components/images/heart.png" alt="logout" style="width: 16px; height: 16px; margin-right: 3px;">
                  <span>${formatNumber(story.likes)}</span>
                </div>
              </div>
              <div class="story-rating">
                <img src="components/images/star.png" alt="logout" style="width: 16px; height: 16px; margin-right: 3px;">
                <span>${story.average_rating ? story.average_rating.toFixed(1) : 'N/A'}</span>
              </div>
            </div>
            
            <div class="story-action">
              <a href="detail.html?id=${story.book_id}" class="btn-read">
                Đọc truyện
              </a>
            </div>
          </div>
        `;
        
        storyList.appendChild(card);
      });
    }

    // Render pagination
    function renderPagination() {
      const totalPages = Math.ceil(filteredStories.length / storiesPerPage);
      
      if (totalPages <= 1) {
        pagination.style.display = "none";
        return;
      }
      pagination.style.display = "flex";
      pagination.innerHTML = "";

      // Previous button
      const prevBtn = document.createElement("button");
      prevBtn.innerHTML = "← Trước";
      prevBtn.disabled = currentPage === 1;
      prevBtn.onclick = () => goToPage(currentPage - 1);
      pagination.appendChild(prevBtn);

      // Page numbers
      const maxVisiblePages = 5;
      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      // First page and ellipsis
      if (startPage > 1) {
        const firstBtn = document.createElement("button");
        firstBtn.textContent = "1";
        firstBtn.onclick = () => goToPage(1);
        pagination.appendChild(firstBtn);

        if (startPage > 2) {
          const ellipsis = document.createElement("span");
          ellipsis.textContent = "...";
          ellipsis.style.padding = "0.75rem";
          ellipsis.style.color = "var(--text-secondary)";
          pagination.appendChild(ellipsis);
        }
      }

      // Page numbers
      for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement("button");
        pageBtn.textContent = i;
        pageBtn.className = i === currentPage ? "active" : "";
        pageBtn.onclick = () => goToPage(i);
        pagination.appendChild(pageBtn);
      }

      // Last page and ellipsis
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          const ellipsis = document.createElement("span");
          ellipsis.textContent = "...";
          ellipsis.style.padding = "0.75rem";
          ellipsis.style.color = "var(--text-secondary)";
          pagination.appendChild(ellipsis);
        }

        const lastBtn = document.createElement("button");
        lastBtn.textContent = totalPages;
        lastBtn.onclick = () => goToPage(totalPages);
        pagination.appendChild(lastBtn);
      }

      // Next button
      const nextBtn = document.createElement("button");
      nextBtn.innerHTML = "Sau →";
      nextBtn.disabled = currentPage === totalPages;
      nextBtn.onclick = () => goToPage(currentPage + 1);
      pagination.appendChild(nextBtn);

      // Page info
      const pageInfo = document.createElement("div");
      pageInfo.className = "pagination-info";
      pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;
      pagination.appendChild(pageInfo);
    }

    // Go to specific page
    function goToPage(page) {
      if (page >= 1 && page <= Math.ceil(filteredStories.length / storiesPerPage)) {
        currentPage = page;
        filterAndDisplayStories();
        
        // Scroll to top of results
        document.getElementById("filtered-stories").scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }

    // Format large numbers
    function formatNumber(num) {
      if (!num) return "0";
      if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + "M";
      } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + "K";
      }
      return num.toString();
    }

    // Show loading state
    function showLoading() {
      loadingState.style.display = "flex";
      storyList.style.display = "none";
      pagination.style.display = "none";
      emptyState.style.display = "none";
    }

    // Hide loading state
    function hideLoading() {
      loadingState.style.display = "none";
    }

    // Setup event listeners
    function setupEventListeners() {
      // Status filter change
      document.getElementById("status-filter").addEventListener("change", filterAndDisplayStories);
      
      // Sort filter change
      document.getElementById("sort-filter").addEventListener("change", filterAndDisplayStories);
    }

    document.addEventListener("DOMContentLoaded", init);
    
    // Load header and footer (no changes needed here)
    fetch('../components/header.html')
      .then(res => res.text())
      .then(data => {
        document.querySelector("#header-placeholder").innerHTML = data;
        const script = document.createElement("script");
        script.src = "../components/header.js";
        document.body.appendChild(script);
      });

    fetch('../components/footer.html')
      .then(res => res.text())
      .then(data => {
        document.querySelector("#footer-placeholder").innerHTML = data;
        const script = document.createElement("script");
        script.src = "../components/footer.js";
        document.body.appendChild(script);
      });