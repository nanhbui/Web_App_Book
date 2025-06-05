  // Get book_id from URL query parameter
function getBookIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

const api_URL = 'http://192.168.11.198:3001'; 

// Fetch book details from API
async function fetchBookDetails() {
    const bookId = getBookIdFromUrl();
    if (!bookId) {
        console.error('No book_id found in URL');
        return;
    }

    try {
        const response = await fetch(`${api_URL}/api/books/books/${bookId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch book details');
        const data = await response.json();
        renderBookDetails(data);
    } catch (error) {
        console.error('Error fetching book details:', error);
    }
}

// Function to read from first chapter
async function readFromFirst(bookId) {
    try {
        const response = await fetch(`${api_URL}/api/books/books/${bookId}/chapters/first`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch first chapter');
        const data = await response.json();
        
        // Redirect to read page with chapter_id
        window.location.href = `read.html?book_id=${bookId}&chapter_id=${data.chapterId}`;
    } catch (error) {
        console.error('Error fetching first chapter:', error);
        alert('Không thể đọc chương đầu tiên');
    }
}

// Function to read from latest chapter
async function readFromLatest(bookId) {
    try {
        const response = await fetch(`${api_URL}/api/books/books/${bookId}/chapters/latest`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch latest chapter');
        const data = await response.json();
        
        // Redirect to read page with chapter_id
        window.location.href = `read.html?book_id=${bookId}&chapter_id=${data.chapterId}`;
    } catch (error) {
        console.error('Error fetching latest chapter:', error);
        alert('Không thể đọc chương mới nhất');
    }
}

// Render book details to the page
function renderBookDetails(data) {
    const { book, tags, chapters } = data;
    document.getElementById('page-title').textContent = book.title + " | Đọc truyện";
    
    // Render header section
    document.getElementById('story-header').innerHTML = `
        <img src="${book.cover_image || 'https://via.placeholder.com/200x280/6B8E23/FFFFFF?text=Story+Cover'}" 
             alt="Story Cover" class="story-cover">
        
        <div class="story-info">
            <h1 class="story-title">${book.title}</h1>
            
            <div class="story-meta">
                <span class="meta-label">Tác giả:</span>
                <span>${book.author}</span>
                
                <span class="meta-label">Thể loại:</span>
                <span>${tags.map(t => t.name).join(', ')}</span>
                
                <span class="meta-label">Trạng thái:</span>
                <span>${book.status}</span>
            </div>

            <div class="rating">
                <div class="stars">
                    ${Array(5).fill().map((_, i) => 
                        `<span class="star ${i < Math.round(book.average_rating) ? 'active' : ''}">★</span>`
                    ).join('')}
                </div>
                <span>${book.average_rating.toFixed(1)} (${book.rating_count} đánh giá)</span>
            </div>

            <div class="stats">
                <div class="stat">
                    <div class="stat-number">${book.views.toLocaleString()}</div>
                    <div class="stat-label">Lượt xem</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${book.likes.toLocaleString()}</div>
                    <div class="stat-label">Lượt thích</div>
                </div>
            </div>

            <div class="action-buttons">
                <button class="btn btn-primary" onclick="readFromFirst(${book.book_id})">Đọc từ đầu</button>
                <button class="btn btn-secondary" onclick="readFromLatest(${book.book_id})">Đọc mới nhất</button>
                <button class="btn btn-like ${book.liked ? 'liked' : ''}" 
                        onclick="toggleLike(this, ${book.book_id})">
                    ${book.liked ? '♥ Đã thích' : '♥ Thích'}
                </button>
                <button class="btn btn-favorite ${book.favorited ? 'favorited' : ''}" 
                        onclick="toggleFavorite(this, ${book.book_id})">
                    ${book.favorited ? '★ Đã thêm' : '☆ Thêm vào yêu thích'}
                </button>
            </div>
        </div>
    `;

    if (book.user_rating) {
        const stars = document.querySelectorAll('#user-rating .star');
        stars.forEach((star, index) => {
            if (index < book.user_rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }

    // Render description
    document.getElementById('story-description').textContent = book.description || 'Không có mô tả';

    // Render chapters
    document.getElementById('chapter-count').textContent = chapters.length;
    renderChapters(chapters, book.book_id);

    // Load comments
    fetchComments(book.book_id);
}

// Render chapters list
function renderChapters(chapters, bookId) {
    const container = document.getElementById('chapters-list');
    if (!chapters || chapters.length === 0) {
        container.innerHTML = '<p>Không có chương để hiển thị.</p>';
        return;
    }

    container.innerHTML = chapters.map(chapter => `
        <a href="read.html?book_id=${bookId}&chapter_id=${chapter.chapter_id}" style="text-decoration:none;">
            <div class="chapter-item">
                <div class="chapter-title">Chương ${chapter.chapter_order} - ${chapter.title}</div>
                <div class="chapter-date">${new Date(chapter.created_at).toLocaleDateString('vi-VN')}</div>
            </div>
        </a>
    `).join('');
}

// Fetch and render comments
async function fetchComments(bookId) {
    try {
        const response = await fetch(`${api_URL}/api/books/comments?book_id=${bookId}`);
        if (!response.ok) throw new Error('Failed to fetch comments');
        const comments = await response.json();
        renderComments(comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
    }
}

function formatTime(timestamp) {
    const now = new Date();
    const commentTime = new Date(timestamp);
    const diff = now - commentTime;

    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 60) return `${minutes} phút trước`;
 
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;

    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
}

function renderComments(comments) {
    const container = document.getElementById('comments-list');
    if (!comments || comments.length === 0) {
       container.innerHTML = '<p>Chưa có bình luận nào.</p>';
       return;
    }

    // Tạo một promise để lấy thông tin chương cho các comment có chapter_id
    const chapterPromises = comments
        .filter(comment => comment.chapter_id)
        .map(comment => 
            fetch(`${api_URL}/api/books/chapters/${comment.chapter_id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            })
                .then(res => {
                    if (!res.ok) throw new Error('Chapter not found');
                    return res.json();
                })
                .then(data => ({
                    chapterId: comment.chapter_id,
                    chapterTitle: data.title,
                    chapterOrder: data.chapterOrder
                }))
                .catch(error => {
                    console.error(`Error fetching chapter ${comment.chapter_id}:`, error);
                    return {
                        chapterId: comment.chapter_id,
                        chapterTitle: 'Không xác định',
                        chapterOrder: null
                    };
                })
        );

    Promise.all(chapterPromises).then(chapterInfos => {
        const chapterMap = {};
        chapterInfos.forEach(info => {
            chapterMap[info.chapterId] = {
                title: info.chapterTitle,
                order: info.chapterOrder
            };
        });

        container.innerHTML = comments.map(comment => `
            <div class="comment-item">
                   <div class="comment-header" style="display: flex; align-items: flex-start; gap: 12px;">
                       <div class="user-avatar" style="width: 30px; height: 30px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 2px solid var(--border-light);">
                         <img src="${comment.avatar_url || 'https://via.placeholder.com/40x40/6B8E23/FFFFFF?text=' + (comment.username.charAt(0).toUpperCase())}" 
                           alt="${comment.username}" 
                           style="width: 100%; height: 100%; object-fit: cover;"
                           onerror="this.src='https://via.placeholder.com/40x40/6B8E23/FFFFFF?text=${comment.username.charAt(0).toUpperCase()}'">
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: baseline;">
                            <span class="comment-user" style="font-weight: bold;">
                                ${comment.username}
                            </span>
                            <span class="comment-date">${formatTime(comment.created_at)}</span>
                        </div>
                        ${comment.chapter_id && chapterMap[comment.chapter_id] ? 
                            `<div style="color: var(--text-muted); font-size: 0.8em; margin-top: 1px;">
                                Chương ${chapterMap[comment.chapter_id].order || 'N/A'}- ${chapterMap[comment.chapter_id].title || 'Không xác định'}
                            </div>` : 
                            ''
                        }
                    </div>
                </div>
                <div class="comment-content" style="font-size: 12px; margin-left: 52px; margin-top: 2px;">${comment.content}</div>
            </div>
        `).join('');
    }).catch(error => {
        console.error('Error fetching chapter info:', error);
        // Fallback nếu có lỗi khi lấy thông tin chương
        container.innerHTML = comments.map(comment => `
            <div class="comment-item">
                <div class="comment-header" style="display: flex; align-items: center; gap: 12px;">
                    <div class="user-avatar" style="width: 20px; height: 20px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 2px solid var(--border-light);">
                        <img src="${comment.avatar_url || 'https://via.placeholder.com/40x40/6B8E23/FFFFFF?text=' + (comment.username.charAt(0).toUpperCase())}" 
                             alt="${comment.username}" 
                             style="width: 100%; height: 100%; object-fit: cover;"
                             onerror="this.src='https://via.placeholder.com/40x40/6B8E23/FFFFFF?text=${comment.username.charAt(0).toUpperCase()}'">
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: baseline;">
                            <span class="comment-user" style="font-weight: bold;">
                                ${comment.username}
                            </span>
                            <span class="comment-date">${formatTime(comment.created_at)}</span>
                        </div>
                    </div>
                </div>
                <div class="comment-content" style="font-size: 12px; margin-left: 52px;">${comment.content}</div>
            </div>
        `).join('');
    });
}

// Favorite/unfavorite functionality
async function toggleFavorite(btn, bookId) {
    const isFavorited = btn.classList.contains('favorited');
    
    try {
        let response;
        if (isFavorited) {
            // Nếu đã yêu thích thì gửi DELETE để xóa
            response = await fetch(`${api_URL}/api/books/favorites/${bookId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
        } else {
            // Nếu chưa yêu thích thì gửi POST để thêm
            response = await fetch(`${api_URL}/api/books/favorites`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ book_id: bookId })
            });
        }

        if (!response.ok) {
            if (response.status === 401) {
   -             alert('Vui lòng đăng nhập để thực hiện thao tác này');
                return;
            }
            throw new Error('Failed to toggle favorite');
        }

        // Cập nhật giao diện
        btn.classList.toggle('favorited');
        btn.innerHTML = isFavorited ? '☆ Thêm vào yêu thích' : '★ Đã thêm';
    } catch (error) {
        console.error('Error toggling favorite:', error);
    }
}

// Like/unlike functionality
async function toggleLike(btn, bookId) {
    try {
        const response = await fetch(`${api_URL}/api/books/books/${bookId}/like`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Vui lòng đăng nhập để thích truyện');
                return;
            }
            throw new Error('Failed to toggle like');
        }

        const data = await response.json();
        btn.classList.toggle('liked');
        btn.innerHTML = data.liked ? '♥ Đã thích' : '♥ Thích';
        
        // Update like count display
        const likeCountElement = document.querySelector('.stat-number:last-child');
        if (likeCountElement) {
            const currentLikes = parseInt(likeCountElement.textContent.replace(/,/g, ''));
            likeCountElement.textContent = (data.liked ? currentLikes + 1 : Math.max(0, currentLikes - 1)).toLocaleString();
        }
    } catch (error) {
        console.error('Error toggling like:', error);
    }
}

// Rating functionality
function setRating(rating) {
    const stars = document.querySelectorAll('#user-rating .star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });

    // Submit rating to server
    submitRating(rating);
}

async function submitRating(rating) {
    const bookId = getBookIdFromUrl();
    if (!bookId) return;

    try {
        const response = await fetch(`${api_URL}/api/books/books/${bookId}/rate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ rating })
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Vui lòng đăng nhập để đánh giá');
                return;
            }
            throw new Error('Failed to submit rating');
        }

        const data = await response.json();
        console.log('Rating submitted:', data);
    } catch (error) {
        console.error('Error submitting rating:', error);
    }
}

// Comment submission
async function submitComment() {
    const bookId = getBookIdFromUrl();
    const commentText = document.getElementById('comment-text').value.trim();
    
    if (!commentText) {
        alert('Vui lòng nhập nội dung bình luận');
        return;
    }

    try {
        const response = await fetch(`${api_URL}/api/books/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                book_id: bookId,
                content: commentText
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Vui lòng đăng nhập để bình luận');
                return;
            }
            throw new Error('Failed to submit comment');
        }

        document.getElementById('comment-text').value = '';
        fetchComments(bookId); // Refresh comments
    } catch (error) {
        console.error('Error submitting comment:', error);
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // Load header and footer
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

    // Load book details
    fetchBookDetails();
});