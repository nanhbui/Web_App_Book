
const api_URL = 'http://192.168.11.198:3001'; 
// Load header and footer
fetch('../components/header.html')
  .then(res => res.text())
  .then(data => {
    document.querySelector("#header-placeholder").innerHTML = data;
    const script = document.createElement("script");
    script.src = "../components/header.js";
    document.body.appendChild(script);
  })
  .catch(error => {
    console.error('Error loading header:', error);
    document.querySelector("#header-placeholder").innerHTML = '<nav>Navigation Placeholder</nav>';
  });

fetch('../components/footer.html')
  .then(res => res.text())
  .then(data => {
    document.querySelector("#footer-placeholder").innerHTML = data;
    const script = document.createElement("script");
    script.src = "../components/footer.js";
    document.body.appendChild(script);
  })
  .catch(error => {
    console.error('Error loading footer:', error);
    document.querySelector("#footer-placeholder").innerHTML = '<footer>Footer Placeholder</footer>';
  });

// Utility functions
function formatViews(views) {
  if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
  if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
  return views.toString();
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Hôm qua';
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

function getDefaultImage() {
  return 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop';
}

// Create story card HTML
function createStoryCard(book) {
  const tags = book.tags || [];
  const primaryTag = tags.length > 0 ? tags[0] : 'Truyện';
  const rating = book.average_rating || 0;
  const views = formatViews(book.views || 0);
  const imageUrl = book.cover_image || getDefaultImage();
  
  let chaptersHtml = '';
  if (book.latest_chapter) {
    chaptersHtml = `
      <div class="story-chapters">
        <div class="chapter-item" style="cursor:pointer;" onclick="readFromLatest('${book.book_id}')">
          <span class="chapter-title">Chương ${book.latest_chapter.chapter_order}: ${book.latest_chapter.title}</span>
          <span class="chapter-time">${formatDate(book.latest_chapter.updated_at)}</span>
        </div>
      </div>
    `;
}

  return `
    <div class="story-card">
      <a href="detail.html?id=${book.book_id}" style="text-decoration: none; color: inherit;">
        <div class="story-image">
          <img src="${imageUrl}" alt="${book.title}" loading="lazy" onerror="this.src='${getDefaultImage()}'">
          <span class="story-genre-tag">${primaryTag}</span>
        </div>
        <div class="story-content">
          <h3 class="story-title">${book.title}</h3>
          <div class="story-meta">
            <div class="story-rating">⭐ ${rating.toFixed(1)}</div>
            <span>👁️ ${views}</span>
            <span>❤️ ${book.likes || 0}</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            Tác giả: ${book.author || 'Đang cập nhật'}
          </div>
        </div>
      </a>
      ${chaptersHtml}
    </div>
  `;
}

// API functions

async function readFromLatest(bookId) {
    try {
        // Hiển thị loading state (tùy chọn)
        const chapterItem = event.target.closest('.chapter-item');
        if (chapterItem) {
            chapterItem.style.opacity = '0.6';
            chapterItem.style.pointerEvents = 'none';
        }

        const response = await fetch(`${api_URL}/api/books/books/${bookId}/chapters/latest`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Kiểm tra xem API có trả về chapterId không
        if (!data.chapterId) {
            throw new Error('Chapter ID not found in response');
        }
        
        // Redirect to read page with chapter_id
        window.location.href = `read.html?book_id=${bookId}&chapter_id=${data.chapterId}`;
        
    } catch (error) {
        console.error('Error fetching latest chapter:', error);
        
        // Khôi phục trạng thái UI nếu có lỗi
        const chapterItem = event.target.closest('.chapter-item');
        if (chapterItem) {
            chapterItem.style.opacity = '1';
            chapterItem.style.pointerEvents = 'auto';
        }
        
        // Hiển thị thông báo lỗi chi tiết hơn
        if (error.message.includes('401')) {
            alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            // Có thể redirect đến trang login
            window.location.href = 'login.html';
        } else if (error.message.includes('404')) {
            alert('Không tìm thấy chương mới nhất');
        } else {
            alert('Không thể đọc chương mới nhất. Vui lòng thử lại.');
        }
    }
}


async function fetchBooks(mode = 'new', page = 1) {
  try {
    const response = await fetch(`${api_URL}/api/books/homepage/books?mode=${mode}&page=${page}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Response is not JSON');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching books:', error);
    throw error;
  }
}

// Pagination class
class BooksPagination {
  constructor(mode, gridId, paginationId) {
    this.mode = mode;
    this.gridId = gridId;
    this.paginationId = paginationId;
    this.currentPage = 1;
    this.totalPages = 1;
    this.totalBooks = 0;
    this.isLoading = false;
  }

  async loadPage(page = 1) {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.currentPage = page;
    this.showLoading();
    
    try {
      const data = await fetchBooks(this.mode, page);
      this.totalPages = data.totalPages;
      this.totalBooks = data.totalBooks;
      this.renderBooks(data.books);
      this.renderPagination();
    } catch (error) {
      this.showError();
    } finally {
      this.isLoading = false;
    }
  }

  showLoading() {
    const grid = document.getElementById(this.gridId);
    if (grid) {
      grid.innerHTML = `
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Đang tải truyện...</p>
        </div>
      `;
    }
  }

  showError() {
    const grid = document.getElementById(this.gridId);
    if (grid) {
      grid.innerHTML = `
        <div class="error-message">
          <p>❌ Có lỗi xảy ra khi tải dữ liệu</p>
          <button onclick="${this.mode}Pagination.loadPage(${this.currentPage})" 
                  style="margin-top: 1rem; padding: 0.5rem 1rem; border: none; border-radius: 4px; background: var(--avocado-green); color: white; cursor: pointer;">
            Thử lại
          </button>
        </div>
      `;
    }
  }

  renderBooks(books) {
    const grid = document.getElementById(this.gridId);
    if (!grid) return;

    if (books.length === 0) {
      grid.innerHTML = `
        <div class="empty-message">
          <p>Chưa có truyện nào</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = books.map(createStoryCard).join('');
  }

  renderPagination() {
    const pagination = document.getElementById(this.paginationId);
    if (!pagination || this.totalPages <= 1) {
      if (pagination) pagination.innerHTML = '';
      return;
    }

    let html = '';
    
    html += `<button ${this.currentPage === 1 ? 'disabled' : ''} onclick="${this.mode}Pagination.loadPage(${this.currentPage - 1})">‹</button>`;
    
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(this.totalPages, this.currentPage + 2);
    
    if (startPage > 1) {
      html += `<button onclick="${this.mode}Pagination.loadPage(1)">1</button>`;
      if (startPage > 2) html += `<span style="padding: 0 0.5rem;">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="${this.mode}Pagination.loadPage(${i})">${i}</button>`;
    }
    
    if (endPage < this.totalPages) {
      if (endPage < this.totalPages - 1) html += `<span style="padding: 0 0.5rem;">...</span>`;
      html += `<button onclick="${this.mode}Pagination.loadPage(${this.totalPages})">${this.totalPages}</button>`;
    }
    
    html += `<button ${this.currentPage === this.totalPages ? 'disabled' : ''} onclick="${this.mode}Pagination.loadPage(${this.currentPage + 1})">›</button>`;
    
    html += `<div class="pagination-info">Trang ${this.currentPage}/${this.totalPages} (${this.totalBooks} truyện)</div>`;
    
    pagination.innerHTML = html;
  }
}

// Initialize pagination instances
let newPagination;
let completedPagination;

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', function() {
  newPagination = new BooksPagination('new', 'new-stories-grid', 'new-stories-pagination');
  completedPagination = new BooksPagination('completed', 'completed-stories-grid', 'completed-stories-pagination');
  
  newPagination.loadPage(1);
  completedPagination.loadPage(1);
  
  loadAndShowCornerAd();
});

// ===== CORNER AD FUNCTIONS =====

// Tạo corner ad container
function createCornerAdContainer() {
  // Kiểm tra xem đã có container chưa
  if (document.getElementById('cornerAdContainer')) {
    return document.getElementById('cornerAdContainer');
  }

  const container = document.createElement('div');
  container.id = 'cornerAdContainer';
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 300px;
    max-width: calc(100vw - 40px);
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 9999;
    font-family: 'Nunito', sans-serif;
    border: 1px solid #e0e0e0;
    overflow: hidden;
    transform: translateY(100px);
    opacity: 0;
    transition: all 0.3s ease;
  `;
  
  document.body.appendChild(container);
  return container;
}

// Hiển thị corner ad với animation
function showCornerAd(container) {
  setTimeout(() => {
    container.style.transform = 'translateY(0)';
    container.style.opacity = '1';
  }, 100);
}

// Ẩn corner ad với animation
function hideCornerAd(container, callback) {
  container.style.transform = 'translateY(100px)';
  container.style.opacity = '0';
  
  setTimeout(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    if (callback) callback();
  }, 300);
}

// Hàm để kiểm tra cookie
function checkAdCookie(adId) {
  const name = `ad_${adId}_closed`;
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === name && cookieValue === 'true') {
      return true;
    }
  }
  return false;
}

// Hàm để thiết lập cookie
function setAdCookie(adId, days = 7) { 
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "expires=" + date.toUTCString();
  document.cookie = `ad_${adId}_closed=true; ${expires}; path=/`;
}

// Hàm hiển thị corner ad

function displayCornerAd(ad) {
  const container = createCornerAdContainer();
  
  // Header với close button
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #f8f9fa;
    border-bottom: 1px solid #e0e0e0;
  `;
  
  const title = document.createElement('span');
  title.textContent = '📢 Quảng Cáo';
  title.style.cssText = `
    font-size: 12px;
    font-weight: 600;
    color: #666;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    border: none;
    background: none;
    font-size: 18px;
    cursor: pointer;
    color: #999;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
  `;
  
  closeBtn.onmouseover = () => {
    closeBtn.style.background = '#f0f0f0';
    closeBtn.style.color = '#333';
  };
  
  closeBtn.onmouseout = () => {
    closeBtn.style.background = 'none';
    closeBtn.style.color = '#999';
  };
  
  closeBtn.onclick = () => {
    hideCornerAd(container);
    setAdCookie(ad.ad_id);
  };
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // Content area
  const content = document.createElement('div');
  content.style.cssText = `
    padding: 12px;
  `;
  
  // Tạo nội dung dựa trên loại quảng cáo
  if (ad.type === 'banner' && ad.image_url) {
    content.innerHTML = `
      <a href="${ad.target_url || '#'}" target="_blank" style="display: block; text-decoration: none;">
        <img src="${ad.image_url}" alt="${ad.title || 'Advertisement'}" 
             style="width: 100%; height: auto; border-radius: 6px; margin-bottom: 8px;">
        <div style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 4px;">
          ${ad.title || 'Xem ngay'}
        </div>
        ${ad.description ? `<div style="font-size: 12px; color: #666; line-height: 1.4;">${ad.description}</div>` : ''}
      </a>
    `;
    
    // FIX: Thêm event listener cho link sau khi tạo HTML
    const adLink = content.querySelector('a');
    if (adLink) {
      adLink.addEventListener('click', function(e) {
        // Track click trước khi navigate
        trackAdClick(ad.ad_id);
        
        // Nếu có target_url, cho phép navigate
        if (ad.target_url && ad.target_url !== '#') {
          // Không preventDefault, để browser tự navigate
          return true;
        } else {
          // Nếu không có URL, ngăn không cho navigate
          e.preventDefault();
        }
      });
    }
    
  } else if (ad.type === 'html' && ad.html_content) {
    content.innerHTML = ad.html_content;
    
    // FIX: Xử lý tất cả links trong HTML content
    content.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', function(e) {
        trackAdClick(ad.ad_id);
        
        // Kiểm tra href của link
        const href = link.getAttribute('href');
        if (!href || href === '#' || href === '') {
          e.preventDefault();
        }
        // Nếu có href hợp lệ, để browser tự navigate
      });
      
      // Đảm bảo styling
      if (!link.style.textDecoration) {
        link.style.textDecoration = 'none';
      }
    });
    
  } else {
    // Text-based ad
    content.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 8px;">
          ${ad.title || 'Thông báo đặc biệt'}
        </div>
        ${ad.description ? `<div style="font-size: 13px; color: #666; line-height: 1.4; margin-bottom: 12px;">${ad.description}</div>` : ''}
        <a href="${ad.target_url || '#'}" target="_blank" 
           style="display: inline-block; background: #4CAF50; color: white; padding: 8px 16px; 
                  border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;
                  transition: background-color 0.2s ease;">
          Xem chi tiết
        </a>
      </div>
    `;
    
    // FIX: Thêm event listener cho button
    const ctaButton = content.querySelector('a');
    if (ctaButton) {
      ctaButton.addEventListener('click', function(e) {
        trackAdClick(ad.ad_id);
        
        if (!ad.target_url || ad.target_url === '#') {
          e.preventDefault();
        }
      });
    }
  }
  
  // Auto hide sau 15 giây
  const autoHideTimer = setTimeout(() => {
    if (container.parentNode) {
      hideCornerAd(container);
      setAdCookie(ad.ad_id);
    }
  }, 1500000);
  
  // Clear timer nếu user đóng manual
  const originalClose = closeBtn.onclick;
  closeBtn.onclick = () => {
    clearTimeout(autoHideTimer);
    originalClose();
  };
  
  // Pause auto-hide khi hover
  container.onmouseenter = () => clearTimeout(autoHideTimer);
  container.onmouseleave = () => {
    setTimeout(() => {
      if (container.parentNode) {
        hideCornerAd(container);
        setAdCookie(ad.ad_id);
      }
    }, 5000000); // 5 giây sau khi mouse leave
  };
  
  container.appendChild(header);
  container.appendChild(content);
  
  showCornerAd(container);
}

// FIX: Cải thiện hàm theo dõi click quảng cáo
function trackAdClick(adId) {
  
  fetch(`${api_URL}/api/admin/public/ads/${adId}/click`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    if (response.ok) {
      console.log('Ad click tracked successfully');
    } else {
      console.error('Failed to track ad click:', response.status);
    }
  })
  .catch(error => {
    console.error('Error tracking ad click:', error);
  });
}

// Hàm tải và hiển thị corner ad
function loadAndShowCornerAd() {
  fetch(`${api_URL}/api/admin/public/ads/active?position=popup`)
    .then(response => {
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Ad API endpoint not found');
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.log('Ad API response is not JSON');
        return null;
      }
      
      return response.json();
    })
    .then(data => {
      if (data && data.success && data.data && data.data.length > 0) {
        const cornerAd = data.data[0];
        
        if (!checkAdCookie(cornerAd.ad_id)) {
          // Hiển thị sau 60 giây
          setTimeout(() => {
            displayCornerAd(cornerAd);
          }, 60000);
        }
      }
    })
    .catch(error => {
      console.log('Corner ad loading failed:', error.message);
    });
}