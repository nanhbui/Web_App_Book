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
        
       const urlParams = new URLSearchParams(window.location.search);
       const chapterId = urlParams.get('chapter_id'); 

if (!chapterId) {
    alert("Không tìm thấy chương truyện. Vui lòng quay lại trang trước.");
    window.history.back();
}

// Global variables
let currentChapter = {};
let allChapters = [];
let bookId = null;
let comments = [];

const api_URL = 'http://192.168.11.198:3001';

// Initialize the page
async function initPage() {
    try {
        // Load chapter content
        const response = await fetch(`${api_URL}/api/books/chapters/${chapterId}`);
        if (!response.ok) throw new Error('Không tải được chương truyện');
        
        const chapterData = await response.json();
        
        // Set global variables
        currentChapter = {
            id: chapterData.chapterId,
            order: chapterData.chapterOrder,
            title: chapterData.title,
            content: chapterData.content,
            prevId: chapterData.prevChapterId,
            nextId: chapterData.nextChapterId
        };
        
        allChapters = chapterData.allChapters;
        bookId = chapterData.book_id;

        if (bookId) {
        const bookRes = await fetch(`${api_URL}/api/books/basic/${bookId}`);
        if (bookRes.ok) {
        const bookData = await bookRes.json();
        document.getElementById('storyTitle').textContent = bookData.title;
        }
        }

        document.getElementById('chapterTitle').textContent = currentChapter.title;
        document.getElementById('storyContent').innerHTML = currentChapter.content.replace(/\n/g, '<br><br>');
        
        // Populate ALL chapter selects (both top and bottom)
        const chapterSelects = document.querySelectorAll('.chapter-select-dropdown');
        const chapterOptions = allChapters.map(chapter => 
            `<option value="${chapter.chapter_id}" ${chapter.chapter_id === currentChapter.id ? 'selected' : ''}>
                Chương ${chapter.chapter_order}: ${chapter.title}
            </option>`
        ).join('');
        
        chapterSelects.forEach(select => {
            select.innerHTML = chapterOptions;
        });
        
        // Update ALL navigation buttons (both top and bottom)
        const prevButtons = document.querySelectorAll('.prev-chapter-btn');
        const nextButtons = document.querySelectorAll('.next-chapter-btn');
        
        prevButtons.forEach(btn => {
            btn.disabled = !currentChapter.prevId;
        });
        
        nextButtons.forEach(btn => {
            btn.disabled = !currentChapter.nextId;
        });
        
        // Kiểm tra và áp dụng theme khi tải trang
        const savedTheme = localStorage.getItem('theme') || 'light';
        applyTheme(savedTheme);

        // Load comments
        await loadComments();
        
        // Save reading progress if user is logged in
        if (localStorage.getItem('authToken') && bookId) {
            await saveReadingProgress();
        }
        
    } catch (error) {
        console.error('Error initializing page:', error);
        alert('Có lỗi khi tải dữ liệu chương truyện');
    }
}

// Load comments for current chapter
async function loadComments() {
    try {
        if (!bookId || !chapterId) return;
        
        const response = await fetch(`${api_URL}/api/books/comments?book_id=${bookId}&chapter_id=${chapterId}`);
        if (!response.ok) throw new Error('Không tải được bình luận');
        
        const commentsData = await response.json();
        comments = commentsData.map(comment => ({
            author: comment.username,
            time: formatTime(comment.created_at),
            text: comment.content
        }));
        
        renderComments();
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

// Format time for comments
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

// Render comments to the page
function renderComments() {
    const commentsList = document.getElementById('commentsList');
    commentsList.innerHTML = comments.map(comment => `
        <div class="comment-item">
            <div class="comment-author">${comment.author}</div>
            <div class="comment-time">${comment.time}</div>
            <div class="comment-text">${comment.text}</div>
        </div>
    `).join('');
}

// Save reading progress
async function saveReadingProgress() {
    try {
        const response = await fetch(`${api_URL}/api/books/reading-history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                book_id: bookId,
                chapter_id: chapterId
            })
        });
        
        if (!response.ok) throw new Error('Không lưu được lịch sử đọc');
    } catch (error) {
        console.error('Error saving reading progress:', error);
    }
}

// Submit new comment
async function submitComment() {
    const commentInput = document.getElementById('commentInput');
    const text = commentInput.value.trim();
    
    if (!text) {
        alert('Vui lòng nhập nội dung bình luận');
        return;
    }
    
    if (!localStorage.getItem('authToken')) {
        alert('Vui lòng đăng nhập để bình luận');
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
                chapter_id: chapterId,
                content: text
            })
        });
        
        if (!response.ok) throw new Error('Gửi bình luận thất bại');
        
        // Refresh comments
        await loadComments();
        commentInput.value = '';
    } catch (error) {
        console.error('Error submitting comment:', error);
        alert('Có lỗi khi gửi bình luận');
    }
}

// Navigate to chapter function
async function navigateToChapter(newChapterId) {
    if (!newChapterId) return;
    
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('chapter_id', newChapterId); 
    window.location.href = newUrl.toString(); 
}

// Function to apply theme
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update active button - get themeButtons at runtime
    const themeButtons = document.querySelectorAll('.theme-btn');
    themeButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === theme) {
            btn.classList.add('active');
        }
    });
}

// Event listeners for ALL navigation elements and settings
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements after DOM is loaded
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const overlay = document.getElementById('overlay');
    const fontSize = document.getElementById('fontSize');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const fontFamily = document.getElementById('fontFamily');
    const lineHeight = document.getElementById('lineHeight');
    const lineHeightValue = document.getElementById('lineHeightValue');
    const themeButtons = document.querySelectorAll('.theme-btn');

    // Settings functionality
    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.add('active');
        overlay.classList.add('active');
        settingsBtn.classList.add('hidden');
    });

    overlay.addEventListener('click', () => {
        settingsPanel.classList.remove('active');
        overlay.classList.remove('active');
        settingsBtn.classList.remove('hidden');
    });

    fontSize.addEventListener('input', (e) => {
        const value = e.target.value;
        document.documentElement.style.setProperty('--font-size', value + 'px');
        fontSizeValue.textContent = value + 'px';
        localStorage.setItem('fontSize', value);
    });

    fontFamily.addEventListener('change', (e) => {
        document.documentElement.style.setProperty('--font-family', e.target.value);
        localStorage.setItem('fontFamily', e.target.value);
    });

    lineHeight.addEventListener('input', (e) => {
        const value = e.target.value;
        document.documentElement.style.setProperty('--line-height', value);
        lineHeightValue.textContent = value;
        localStorage.setItem('lineHeight', value);
    });

    // Theme button event listeners
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            applyTheme(theme);
        });
    });

    // Load saved settings
    const savedFontSize = localStorage.getItem('fontSize') || '16';
    const savedFontFamily = localStorage.getItem('fontFamily') || 'Times New Roman';
    const savedLineHeight = localStorage.getItem('lineHeight') || '1.6';
    
    fontSize.value = savedFontSize;
    fontSizeValue.textContent = savedFontSize + 'px';
    document.documentElement.style.setProperty('--font-size', savedFontSize + 'px');
    
    fontFamily.value = savedFontFamily;
    document.documentElement.style.setProperty('--font-family', savedFontFamily);
    
    lineHeight.value = savedLineHeight;
    lineHeightValue.textContent = savedLineHeight;
    document.documentElement.style.setProperty('--line-height', savedLineHeight);

    // Previous chapter buttons
    document.querySelectorAll('.prev-chapter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateToChapter(currentChapter.prevId);
        });
    });

    // Next chapter buttons
    document.querySelectorAll('.next-chapter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateToChapter(currentChapter.nextId);
        });
    });

    // Chapter select dropdowns - sync all when one changes
    document.querySelectorAll('.chapter-select-dropdown').forEach(select => {
        select.addEventListener('change', (e) => {
            const selectedChapterId = e.target.value;
            if (selectedChapterId && selectedChapterId !== currentChapter.id) {
                // Sync all other dropdowns to the same value
                document.querySelectorAll('.chapter-select-dropdown').forEach(otherSelect => {
                    if (otherSelect !== e.target) {
                        otherSelect.value = selectedChapterId;
                    }
                });
                navigateToChapter(selectedChapterId);
            }
        });
    });

    // Comment submit button
    document.getElementById('commentSubmit').addEventListener('click', submitComment);
});

// Initialize the page
initPage();