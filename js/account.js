 // Global variables
        let userData = {};
        let readingHistory = [];
        let favorites = [];
        const itemsPerPage = 8;
        
        const api_URL = 'http://192.168.11.198:3001'; 

        // Load header and footer
        document.addEventListener('DOMContentLoaded', function() {
            fetch('../components/headeracc.html')
            .then(res => res.text())
            .then(data => {
                document.querySelector("#header-placeholder").innerHTML = data;

                // Thêm script sau khi DOM đã gắn xong
                const script = document.createElement("script");
                script.src = "../components/headeracc.js";
                document.body.appendChild(script);
            });
     
            
            fetch('../components/footeracc.html')
                .then(response => response.text())
                .then(data => {
                    document.getElementById('footer-placeholder').innerHTML = data;
                })
                .catch(error => console.error('Error loading footer:', error));

            // Check authentication and load user data
            checkAuthAndLoadData();

            // Navigation
            document.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    const section = this.dataset.section;
                    showSection(section);
                    
                    // Update active nav item
                    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                    this.classList.add('active');
                });
            });
        });

        // Check authentication and load user data
        function checkAuthAndLoadData() {
            const token = localStorage.getItem('authToken');
            if (!token) {
                window.location.href = 'login.html';
                return;
            }
            fetch(`${api_URL}/api/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Không thể lấy thông tin người dùng');
                }
                return response.json();
            })
            .then(data => {
                userData = data;
                loadUserData();
                loadReadingHistory();
                loadFavorites();
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
                window.location.href = 'login.html';
            });
        }

        // Load user data into UI
        function loadUserData() {
            document.getElementById('sidebarUsername').textContent = userData.username;
            document.getElementById('mainUsername').textContent = userData.username;
            document.getElementById('userEmail').textContent = userData.email;
            document.getElementById('sidebarJoinDate').textContent = `Thành viên từ: ${new Date(userData.created_at).toLocaleDateString('vi-VN')}`;
            
            
            // Set avatar if exists
            if (userData.avatar_url) {
                document.getElementById('sidebarAvatar').src = userData.avatar_url;
                document.getElementById('mainAvatar').src = userData.avatar_url;
            }
            
            // Set form values
            document.getElementById('editUsername').value = userData.username;
            document.getElementById('editEmail').value = userData.email;
            
            // Show/hide admin button based on user role
            if (userData.role === 'admin') {
                document.getElementById('adminBtn').style.display = 'block';
            }
        }

        // Load reading history
        function loadReadingHistory() {
            const token = localStorage.getItem('authToken');
            
            fetch(`${api_URL}/api/books/reading-history`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => response.json())
            .then(data => {
                readingHistory = data;
                renderReadingHistory();
            })
            .catch(error => {
                console.error('Error loading reading history:', error);
                document.getElementById('historyGrid').innerHTML = '<p>Lỗi khi tải lịch sử đọc</p>';
            });
        }

        // Load favorites
        function loadFavorites() {
            const token = localStorage.getItem('authToken');
            
            fetch(`${api_URL}/api/books/favorites`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => response.json())
            .then(data => {
                favorites = data;
                document.getElementById('favoriteCount').textContent = favorites.length;
                renderFavorites();
            })
            .catch(error => {
                console.error('Error loading favorites:', error);
                document.getElementById('favoritesGrid').innerHTML = '<p>Lỗi khi tải truyện yêu thích</p>';
            });
        }

        // Render reading history
        function renderReadingHistory(page = 1) {
            const grid = document.getElementById('historyGrid');
            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const pageItems = readingHistory.slice(startIndex, endIndex);
            
            if (readingHistory.length === 0) {
                grid.innerHTML = '<p>Bạn chưa đọc truyện nào</p>';
                document.getElementById('historyPagination').innerHTML = '';
                return;
            }
            
            grid.innerHTML = pageItems.map(story => `
                <div class="story-card">
                    <img src="${story.cover_image || 'https://via.placeholder.com/200x200/6B8E23/FFFFFF?text=No+Cover'}" alt="${story.title}" class="story-image">
                    <div class="story-info">
                        <div class="story-title">${story.title}</div>
                        <p style="color: var(--text-muted); margin-bottom: 10px;">${story.chapter_title}</p>
                        <div class="story-actions">
                            <button class="btn" onclick="continueReading(${story.book_id}, ${story.chapter_id})">Đọc tiếp</button>
                        </div>
                    </div>
                </div>
            `).join('');
            
            renderPagination(readingHistory.length, page, 'historyPagination', renderReadingHistory);
        }

        // Render favorites
        function renderFavorites(page = 1) {
            const grid = document.getElementById('favoritesGrid');
            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const pageItems = favorites.slice(startIndex, endIndex);
            
            if (favorites.length === 0) {
                grid.innerHTML = '<p>Bạn chưa có truyện yêu thích nào</p>';
                document.getElementById('favoritesPagination').innerHTML = '';
                return;
            }
            
            grid.innerHTML = pageItems.map(story => `
                <div class="story-card">
                    <img src="${story.cover_image || 'https://via.placeholder.com/200x200/9ACD32/FFFFFF?text=No+Cover'}" alt="${story.title}" class="story-image">
                    <div class="story-info">
                        <div class="story-title">${story.title}</div>
                        <p style="color: var(--text-muted); margin-bottom: 10px;">${story.author || 'Tác giả chưa rõ'}</p>
                        <div class="story-actions">
                            <button class="btn" onclick="readStory(${story.book_id})">Đọc ngay</button>
                            <button class="btn btn-danger" onclick="removeFavorite(${story.book_id})">Bỏ yêu thích</button>
                        </div>
                    </div>
                </div>
            `).join('');
            
            renderPagination(favorites.length, page, 'favoritesPagination', renderFavorites);
        }

        // Render pagination
        function renderPagination(totalItems, currentPage, containerId, renderFunction) {
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            const container = document.getElementById(containerId);
            
            if (totalPages <= 1) {
                container.innerHTML = '';
                return;
            }
            
            let paginationHTML = '';
            
            // Previous button
            if (currentPage > 1) {
                paginationHTML += `<button class="page-btn" onclick="${renderFunction.name}(${currentPage - 1})">‹</button>`;
            }
            
            // Page numbers
            for (let i = 1; i <= totalPages; i++) {
                if (i === currentPage) {
                    paginationHTML += `<button class="page-btn active">${i}</button>`;
                } else {
                    paginationHTML += `<button class="page-btn" onclick="${renderFunction.name}(${i})">${i}</button>`;
                }
            }
            
            // Next button
            if (currentPage < totalPages) {
                paginationHTML += `<button class="page-btn" onclick="${renderFunction.name}(${currentPage + 1})">›</button>`;
            }
            
            container.innerHTML = paginationHTML;
        }

        // Show section
        function showSection(sectionId) {
            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(sectionId).classList.add('active');
        }

        // Open edit profile modal
        function openEditProfile() {
            document.getElementById('editProfileModal').classList.add('active');
        }

        // Close edit profile modal
        function closeEditProfile() {
            document.getElementById('editProfileModal').classList.remove('active');
        }

        // Continue reading
        function continueReading(bookId, chapterId) {
            window.location.href = `read.html?book_id=${bookId}&chapter_id=${chapterId}`;
        }

        // Read story
        function readStory(bookId) {
            window.location.href = `detail.html?id=${bookId}`;
        }

        // Remove favorite
        function removeFavorite(bookId) {
            if (confirm('Bạn có chắc muốn bỏ truyện này khỏi danh sách yêu thích?')) {
                const token = localStorage.getItem('authToken');
                
                fetch(`${api_URL}/api/books/favorites/${bookId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Lỗi khi xóa khỏi yêu thích');
                    }
                    return response.json();
                })
                .then(() => {
                    // Remove from local array and re-render
                    const index = favorites.findIndex(story => story.book_id === bookId);
                    if (index > -1) {
                        favorites.splice(index, 1);
                        document.getElementById('favoriteCount').textContent = favorites.length;
                        renderFavorites();
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Lỗi khi xóa khỏi yêu thích');
                });
            }
        }

        // Go to admin panel
        function goToAdmin() {
            if (userData.role === 'admin') {
                window.location.href = 'admin.html';
            }
        }

        // Form submissions
        document.getElementById('editProfileForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const token = localStorage.getItem('authToken');
            const newUsername = document.getElementById('editUsername').value;
            const newEmail = document.getElementById('editEmail').value;
            const avatarFile = document.getElementById('avatarFile').files[0];
            
            // First update username and email
            fetch(`${api_URL}/api/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    username: newUsername,
                    email: newEmail
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Lỗi khi cập nhật thông tin');
                }
                return response.json();
            })
            .then(() => {
                // If avatar file is selected, upload it
                if (avatarFile) {
                    const formData = new FormData();
                    formData.append('avatar', avatarFile);
                    
                    return fetch(`${api_URL}/api/auth/upload-avatar`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });
                }
                return Promise.resolve();
            })
            .then(() => {
                // Reload user data
                return fetch(`${api_URL}/api/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            })
            .then(response => response.json())
            .then(data => {
                userData = data;
                loadUserData();
                closeEditProfile();
                alert('Thông tin đã được cập nhật!');
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Lỗi khi cập nhật thông tin: ' + error.message);
            });
        });

        // Change password form
        document.getElementById('passwordForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const token = localStorage.getItem('authToken');
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (newPassword !== confirmPassword) {
                alert('Mật khẩu xác nhận không khớp!');
                return;
            }
            
            if (newPassword.length < 6) {
                alert('Mật khẩu mới phải có ít nhất 6 ký tự!');
                return;
            }
            
            fetch(`${api_URL}/api/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.message || 'Lỗi khi đổi mật khẩu');
                    });
                }
                return response.json();
            })
            .then(data => {
                alert(data.message || 'Mật khẩu đã được thay đổi thành công!');
                this.reset();
            })
            .catch(error => {
                console.error('Error:', error);
                alert(error.message || 'Lỗi khi đổi mật khẩu');
            });
        });