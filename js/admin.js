// Load header and footer
    fetch('../components/header.html')
      .then(res => res.text())
      .then(data => {
        document.querySelector("#header-placeholder").innerHTML = data;
        const script = document.createElement("script");
        script.src = "../components/header.js";
        document.body.appendChild(script);
      });


// Global variables
let currentStoryPage = 1;
let currentAdPage = 1;
const itemsPerPage = 10;
let token = localStorage.getItem('authToken');

const api_URL = 'http://192.168.11.198:3001'; 

// Navigation functions
function showSection(sectionId) {
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.nav-item1').forEach(item => {
        item.classList.remove('active');
    });
    
    document.getElementById(sectionId).classList.add('active');
    event.target.classList.add('active');
    
    if (sectionId === 'dashboard') {
        loadDashboardStats();
    } else if (sectionId === 'stories') {
        loadStories();
    } else if (sectionId === 'ads') {
        loadAds();
    } else if (sectionId === 'users') {
        loadUsers();
    } else if (sectionId === 'feedback') {
        loadFeedbacks();  // 
    }
}

// Modal functions
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showAddStoryModal() {
    document.getElementById('addStoryModal').style.display = 'block';
}

function showAddAdModal() {
    document.getElementById('addAdModal').style.display = 'block';
}

// Dashboard functions
function loadDashboardStats() {
    fetch(`${api_URL}/api/admin/dashboard/stats`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.querySelector('#dashboard .stat-card:nth-child(1) .stat-number').textContent = data.data.totalBooks;
            document.querySelector('#dashboard .stat-card:nth-child(2) .stat-number').textContent = data.data.totalUsers;
            document.querySelector('#dashboard .stat-card:nth-child(3) .stat-number').textContent = data.data.totalViews;
            document.querySelector('#dashboard .stat-card:nth-child(4) .stat-number').textContent = data.data.todayComments;
        } else {
            console.error('Error loading dashboard stats:', data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function loadFeedbacks() {
    fetch(`${api_URL}/api/admin/feedbacks`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const tbody = document.getElementById('feedbackTableBody');
            tbody.innerHTML = '';
            
            data.data.forEach(feedback => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${feedback.username || 'Khách'}</td>
                    <td>${feedback.email || 'N/A'}</td>
                    <td>${feedback.type || 'Khác'}</td>
                    <td>${feedback.title || 'Không có tiêu đề'}</td>
                    <td>${feedback.content}</td>
                    <td>${new Date(feedback.submitted_at).toLocaleString('vi-VN')}</td>
                `;
                tbody.appendChild(row);
            });
        } else {
            console.error('Error loading feedbacks:', data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

// Stories functions
function loadStories(search = '') {
    fetch(`${api_URL}/api/admin/books?page=${currentStoryPage}&limit=${itemsPerPage}&search=${search}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const tbody = document.getElementById('storiesTableBody');
            tbody.innerHTML = '';
            
            data.data.forEach(book => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><a href="#" onclick="showStoryDetail(${book.book_id})" style="color: var(--avocado-green); text-decoration: none;">${book.title}</a></td>
                    <td>${book.author}</td>
                    <td>${book.tags.join(', ')}</td>
                    <td>${book.chapter_count}</td>
                    <td>${new Date(book.created_at).toLocaleDateString('vi-VN')}</td>
                    <td>${new Date(book.updated_at).toLocaleDateString('vi-VN')}</td>
                    <td>
                        <div class="rating">
                            ${'★'.repeat(Math.floor(book.average_rating))}${'☆'.repeat(5-Math.floor(book.average_rating))} 
                            ${book.average_rating.toFixed(1)}
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-small btn-info" onclick="editStory(${book.book_id})">Sửa</button>
                            <button class="btn btn-small btn-warning" onclick="addChapter(${book.book_id})">+ Chương</button>
                            <button class="btn btn-small btn-danger" onclick="deleteStory(${book.book_id})">Xóa</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            generateStoriesPagination(data.pagination.totalRecords);
        } else {
            console.error('Error loading stories:', data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function filterStories(searchTerm) {
    currentStoryPage = 1;
    loadStories(searchTerm);
}

function generateStoriesPagination(totalRecords) {
    const totalPages = Math.ceil(totalRecords / itemsPerPage);
    const pagination = document.getElementById('storiesPagination');
    pagination.innerHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentStoryPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => {
            currentStoryPage = i;
            loadStories();
        };
        pagination.appendChild(btn);
    }
}

// Ads functions
function loadAds(search = '', position = '', status = '', type = '') {
    let url = `${api_URL}/api/admin/ads?page=${currentAdPage}&limit=${itemsPerPage}`;
    if (search) url += `&search=${search}`;
    if (position) url += `&position=${position}`;
    if (status) url += `&status=${status}`;
    if (type) url += `&type=${type}`;
    
    fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const tbody = document.getElementById('adsTableBody');
            tbody.innerHTML = '';
            
            data.data.ads.forEach(ad => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${ad.title}</td>
                    <td><span class="status-badge status-${ad.position}">${getPositionText(ad.position)}</span></td>
                    <td><span class="status-badge status-${ad.type}">${getTypeText(ad.type)}</span></td>
                    <td>
                        <select class="inline-edit" onchange="updateAdStatus(${ad.ad_id}, this.value)">
                            <option value="active" ${ad.status === 'active' ? 'selected' : ''}>Hoạt động</option>
                            <option value="paused" ${ad.status === 'paused' ? 'selected' : ''}>Tạm dừng</option>
                            <option value="expired" ${ad.status === 'expired' ? 'selected' : ''}>Hết hạn</option>
                        </select>
                    </td>
                    <td><a href="${ad.target_url}" target="_blank" style="color: var(--avocado-green);">${ad.target_url}</a></td>
                    <td>${ad.display_duration > 0 ? ad.display_duration + 's' : 'Ngay lập tức'}</td>
                    <td>${getFrequencyText(ad.frequency)}</td>
                    <td>${new Date(ad.start_date).toLocaleDateString('vi-VN')}</td>
                    <td>${new Date(ad.end_date).toLocaleDateString('vi-VN')}</td>
                    <td>${ad.click_count}</td>
                    <td>${new Date(ad.updated_at).toLocaleDateString('vi-VN')}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-small btn-info" onclick="editAd(${ad.ad_id})">Sửa</button>
                            <button class="btn btn-small btn-secondary" onclick="previewAd(${ad.ad_id})">Xem trước</button>
                            <button class="btn btn-small ${ad.status === 'active' ? 'btn-warning' : 'btn-info'}" onclick="toggleAdStatus(${ad.ad_id})">
                                ${ad.status === 'active' ? 'Tạm dừng' : 'Kích hoạt'}
                            </button>
                            <button class="btn btn-small btn-danger" onclick="deleteAd(${ad.ad_id})">Xóa</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            generateAdsPagination(data.data.pagination.totalRecords);
        } else {
            console.error('Error loading ads:', data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function filterAds(searchTerm) {
    currentAdPage = 1;
    loadAds(searchTerm);
}

function filterAdsByPosition(position) {
    currentAdPage = 1;
    loadAds('', position);
}

function filterAdsByStatus(status) {
    currentAdPage = 1;
    loadAds('', '', status);
}

function filterAdsByType(type) {
    currentAdPage = 1;
    loadAds('', '', '', type);
}

function generateAdsPagination(totalRecords) {
    const totalPages = Math.ceil(totalRecords / itemsPerPage);
    const pagination = document.getElementById('adsPagination');
    pagination.innerHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentAdPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => {
            currentAdPage = i;
            loadAds();
        };
        pagination.appendChild(btn);
    }
}

// Users functions
function loadUsers(search = '') {
    fetch(`${api_URL}/api/admin/users?search=${search}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const tbody = document.getElementById('usersTableBody');
            tbody.innerHTML = '';
            
            data.data.forEach(user => {
                const row = document.createElement('tr');
                // Thêm data-user-id attribute
                row.setAttribute('data-user-id', user.user_id);
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td>
                        <select class="inline-edit" onchange="updateUserRole(${user.user_id}, this.value)">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </td>
                    <td>${new Date(user.created_at).toLocaleDateString('vi-VN')}</td>
                    <td>
                        <select class="inline-edit" onchange="updateUserStatus(${user.user_id}, this.value)">
                            <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="banned" ${user.status === 'banned' ? 'selected' : ''}>Banned</option>
                        </select>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-small btn-primary" onclick="saveUser(${user.user_id})">Lưu</button>
                            <button class="btn btn-small btn-danger" onclick="deleteUser(${user.user_id})">Xóa</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } else {
            console.error('Error loading users:', data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function filterUsers(searchTerm) {
    loadUsers(searchTerm);
}

// Helper functions
function getPositionText(position) {
    const positions = {
        'header': 'Header',
        'sidebar': 'Sidebar', 
        'content': 'Content',
        'footer': 'Footer',
        'popup': 'Popup'
    };
    return positions[position] || position;
}

function getTypeText(type) {
    const types = {
        'banner': 'Banner ảnh',
        'popup': 'Popup',
        'video': 'Video ngắn',
        'html': 'HTML tùy chỉnh'
    };
    return types[type] || type;
}

function getFrequencyText(frequency) {
    const frequencies = {
        'session': 'Mỗi phiên truy cập',
        'daily': 'Sau 24 giờ',
        'once': 'Chỉ 1 lần/cookie',
        'always': 'Luôn hiển thị'
    };
    return frequencies[frequency] || frequency;
}

function updateBookInfo(bookId, data) {
    return fetch(`${api_URL}/api/admin/books/${bookId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(responseData => {
        if (responseData.message !== 'Cập nhật truyện thành công') {
            throw new Error(responseData.message || 'Unknown error');
        }
        return responseData;
    });
}

// Action functions
function showStoryDetail(storyId) {
    fetch(`${api_URL}/api/admin/books/${storyId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const story = data.data;
            document.getElementById('storyDetailContent').innerHTML = `
                <div class="story-detail">
                    <div class="story-cover">
                        ${story.cover_image ? `<img src="${story.cover_image}" style="max-width:100%; max-height:100%;">` : 'Ảnh bìa'}
                    </div>
                    <div class="story-info">
                        <h3>${story.title}</h3>
                        <p><strong>Tác giả:</strong> ${story.author}</p>
                        <p><strong>Thể loại:</strong> ${story.tags.join(', ')}</p>
                        <p><strong>Số chương:</strong> ${story.chapter_count}</p>
                        <div class="rating">Rating: ${'★'.repeat(Math.floor(story.rating))} ${story.rating.toFixed(1)}/5</div>
                        <p><strong>Trạng thái:</strong> ${story.status}</p>
                        <p><strong>Ngày đăng:</strong> ${new Date(story.created_at).toLocaleDateString('vi-VN')}</p>
                        <p><strong>Cập nhật cuối:</strong> ${new Date(story.updated_at).toLocaleDateString('vi-VN')}</p>
                    </div>
                </div>
                <div class="chapters-list">
                    <h4>Danh sách chương</h4>
                    ${story.chapters && story.chapters.length > 0 ? 
                        story.chapters.map(chapter => 
                            `<div class="chapter-item">
                                <span>Chương ${chapter.chapter_order}: ${chapter.title}</span>
                                <button class="btn btn-small" onclick="editChapter(${chapter.chapter_id})">Sửa</button>
                            </div>`
                        ).join('') : 
                        '<p>Chưa có chương nào</p>'
                    }
                </div>
            `;
            document.getElementById('storyModal').style.display = 'block';
        } else {
            console.error('Error loading story details:', data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function editStory(bookId) {
    console.log('Editing story with ID:', bookId); // Debug log
    
    fetch(`${api_URL}/api/admin/books/${bookId}`, {
        method: 'GET', 
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        console.log('Response status:', response.status); // Debug log
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Received data:', data); // Debug log
        
        if (data.success) {
            const book = data.data;
            
            // Kiểm tra các elements có tồn tại không
            const titleElement = document.getElementById('editTitle');
            const authorElement = document.getElementById('editAuthor');
            const statusElement = document.getElementById('editStatus');
            const descriptionElement = document.getElementById('editDescription');
            
            if (!titleElement || !authorElement || !statusElement || !descriptionElement) {
                console.error('Không tìm thấy các element trong form edit');
                alert('Lỗi: Không tìm thấy form edit. Vui lòng kiểm tra lại HTML.');
                return;
            }
            
            // Điền dữ liệu vào form
            titleElement.value = book.title || '';
            authorElement.value = book.author || '';
            statusElement.value = book.status || 'Đang tiến hành';
            descriptionElement.value = book.description || '';
            
            // Xử lý checkbox thể loại
            document.querySelectorAll('#editStoryForm input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = book.tags && book.tags.includes(checkbox.value);
            });
            
            // Lưu bookId vào form
            const editForm = document.getElementById('editStoryForm');
            if (editForm) {
                editForm.dataset.bookId = bookId;
                console.log('BookId saved to form:', bookId); // Debug log
            } else {
                console.error('Không tìm thấy editStoryForm');
            }
            
            // Hiển thị modal
            const modal = document.getElementById('editStoryModal');
            if (modal) {
                modal.style.display = 'block';
                console.log('Modal displayed'); // Debug log
            } else {
                console.error('Không tìm thấy editStoryModal');
            }
        } else {
            console.error('API returned error:', data);
            alert('Lỗi khi tải thông tin truyện: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error in editStory:', error);
        alert('Lỗi khi tải thông tin truyện: ' + error.message);
    });
}

function addChapter(bookId) {
    document.getElementById('addChapterForm').dataset.bookId = bookId;
    document.getElementById('addChapterModal').style.display = 'block';
}

function editChapter(chapterId) {
    fetch(`${api_URL}/api/admin/chapters/${chapterId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        const chapter = data.data;

        const form = document.getElementById('editChapterForm');
        form.querySelector('[name="chapterId"]').value = chapterId;
        form.querySelector('[name="chapterTitle"]').value = chapter.title;
        form.querySelector('[name="chapterContent"]').value = chapter.content;
        form.querySelector('[name="chapterOrder"]').value = chapter.chapter_order;

        document.getElementById('editChapterModal').style.display = 'block';
    })
    .catch(err => {
        console.error('Lỗi khi tải chương:', err);
        alert('Không thể tải chương');
    });
}


function deleteStory(bookId) {
    if (confirm('Bạn có chắc chắn muốn xóa truyện này?')) {
        fetch(`${api_URL}/api/admin/books/${bookId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Xóa truyện thành công');
                loadStories();
            } else {
                alert('Lỗi khi xóa truyện: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Lỗi khi xóa truyện');
        });
    }
}

function editAd(adId) {
    fetch(`${api_URL}/api/admin/ads/${adId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const ad = data.data;
            document.getElementById('editAdName').value = ad.title;
            document.getElementById('editAdPosition').value = ad.position;
            document.getElementById('editAdType').value = ad.type;
            document.getElementById('editAdStatus').value = ad.status;
            document.getElementById('editAdTargetUrl').value = ad.target_url;
            document.getElementById('editAdDisplayTime').value = ad.display_duration;
            document.getElementById('editAdFrequency').value = ad.frequency;
            document.getElementById('editAdStartDate').value = ad.start_date.split('T')[0];
            document.getElementById('editAdEndDate').value = ad.end_date.split('T')[0];
            document.getElementById('editAdContent').value = ad.html_content || '';
            
            // LƯU ADId VÀO FORM ĐỂ SỬ DỤNG KHI SUBMIT
            document.getElementById('editAdForm').dataset.adId = adId;
            
            document.getElementById('editAdModal').style.display = 'block';
        } else {
            console.error('Error loading ad for edit:', data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function previewAd(adId) {
    fetch(`${api_URL}/api/admin/ads/${adId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const ad = data.data;
            document.getElementById('previewAdContent').innerHTML = `
                <h4>${ad.title}</h4>
                <p><strong>Vị trí:</strong> ${getPositionText(ad.position)}</p>
                <p><strong>Loại:</strong> ${getTypeText(ad.type)}</p>
                <p><strong>URL đích:</strong> <a href="${ad.target_url}" target="_blank">${ad.target_url}</a></p>
                <div style="border: 1px solid var(--border-light); padding: 20px; margin: 10px 0; background: var(--avocado-bg);">
                    ${ad.html_content || '[Nội dung quảng cáo sẽ hiển thị ở đây]'}
                </div>
            `;
            document.getElementById('previewAdModal').style.display = 'block';
        } else {
            console.error('Error loading ad for preview:', data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function toggleAdStatus(adId) {
    fetch(`${api_URL}/api/admin/ads/${adId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const currentStatus = data.data.status;
            const newStatus = currentStatus === 'active' ? 'paused' : 'active';
            
            updateAdStatus(adId, newStatus);
        } else {
            console.error('Error loading ad for status toggle:', data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function updateAdStatus(adId, status) {
    fetch(`${api_URL}/api/admin/ads/${adId}/status`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadAds();
        } else {
            console.error('Error updating ad status:', data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function deleteAd(adId) {
    if (confirm('Bạn có chắc chắn muốn xóa quảng cáo này?')) {
        fetch(`${api_URL}/api/admin/ads/${adId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Xóa quảng cáo thành công');
                loadAds();
            } else {
                alert('Lỗi khi xóa quảng cáo: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Lỗi khi xóa quảng cáo');
        });
    }
}

function updateUserRole(userId, role) {
    // Lưu trữ tạm thời trong data attribute
    const row = document.querySelector(`tr[data-user-id="${userId}"]`);
    if (row) {
        row.setAttribute('data-pending-role', role);
        console.log(`Updated role for user ${userId} to ${role}`); // Debug log
    } else {
        console.error(`Row not found for user ${userId}`); // Debug log
    }
}

function updateUserStatus(userId, status) {
    // Lưu trữ tạm thời trong data attribute
    const row = document.querySelector(`tr[data-user-id="${userId}"]`);
    if (row) {
        row.setAttribute('data-pending-status', status);
        console.log(`Updated status for user ${userId} to ${status}`); // Debug log
    } else {
        console.error(`Row not found for user ${userId}`); // Debug log
    }
}

function saveUser(userId) {
    const row = document.querySelector(`tr[data-user-id="${userId}"]`);
    if (!row) {
        console.error(`Row not found for user ${userId}`);
        alert('Không tìm thấy thông tin người dùng');
        return;
    }
    
    // Lấy giá trị từ data attributes hoặc từ select elements
    const pendingRole = row.getAttribute('data-pending-role');
    const pendingStatus = row.getAttribute('data-pending-status');
    
    const roleSelect = row.querySelector(`select[onchange*="updateUserRole(${userId}"]`);
    const statusSelect = row.querySelector(`select[onchange*="updateUserStatus(${userId}"]`);
    
    const role = pendingRole || (roleSelect ? roleSelect.value : 'user');
    const status = pendingStatus || (statusSelect ? statusSelect.value : 'active');
    
    console.log(`Saving user ${userId}: role=${role}, status=${status}`); // Debug log
    
    fetch(`${api_URL}/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role, status })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Cập nhật người dùng thành công');
            // Xóa pending data sau khi lưu thành công
            row.removeAttribute('data-pending-role');
            row.removeAttribute('data-pending-status');
            loadUsers(); // Reload để đảm bảo data đồng bộ
        } else {
            alert('Lỗi khi cập nhật người dùng: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Lỗi khi cập nhật người dùng');
    });
}

function deleteUser(userId) {
    if (confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) {
        fetch(`${api_URL}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Xóa người dùng thành công');
                loadUsers();
            } else {
                alert('Lỗi khi xóa người dùng: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Lỗi khi xóa người dùng');
        });
    }
}

// Form submissions
document.getElementById('addStoryForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const genres = formData.getAll('genre');

    const data = {
        title: formData.get('title'),
        author: formData.get('author'),
        tags: genres,
        status: formData.get('status'),
        description: formData.get('description')
    };

    // Handle file upload
    const coverImageFile = formData.get('coverImageFile');
    if (coverImageFile && coverImageFile.size > 0) {
        // If file is uploaded, we need to send as FormData
        const fileFormData = new FormData();
        fileFormData.append('cover_image', coverImageFile);
        fileFormData.append('title', data.title);
        fileFormData.append('author', data.author);
        fileFormData.append('status', data.status);
        fileFormData.append('description', data.description);
        fileFormData.append('tags', JSON.stringify(data.tags));

        fetch(`${api_URL}/api/admin/books`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: fileFormData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Thêm truyện mới thành công');
                closeModal('addStoryModal');
                this.reset();
                loadStories();
            } else {
                alert('Lỗi khi thêm truyện: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Lỗi khi thêm truyện');
        });
    } else {
        // No file upload, send as JSON
        fetch(`${api_URL}/api/admin/books`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Thêm truyện mới thành công');
                closeModal('addStoryModal');
                this.reset();
                loadStories();
            } else {
                alert('Lỗi khi thêm truyện: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Lỗi khi thêm truyện');
        });
    }
});

document.getElementById('addChapterForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const bookId = this.dataset.bookId;
    const formData = new FormData(this);

    const data = {
        title: formData.get('chapterTitle'),
        content: formData.get('chapterContent'),
        chapter_order: formData.get('chapterNote') // Assuming chapter_order is from note field
    };

    fetch(`${api_URL}/api/admin/books/${bookId}/chapters`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.message === 'Đã thêm chương thành công') {
            alert('Thêm chương mới thành công');
            closeModal('addChapterModal');
            this.reset();
            showStoryDetail(bookId);
        } else {
            alert('Lỗi khi thêm chương: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Lỗi khi thêm chương');
    });
});

document.getElementById('editChapterForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const form = e.target;
    const chapterId = form.querySelector('[name="chapterId"]').value;
    const title = form.querySelector('[name="chapterTitle"]').value;
    const content = form.querySelector('[name="chapterContent"]').value;
    const chapter_order = form.querySelector('[name="chapterOrder"]').value;

    fetch(`${api_URL}/api/admin/chapters/${chapterId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, content, chapter_order })
    })
    .then(res => res.json())
    .then(data => {
        if (data.message) {
            alert('Đã cập nhật chương thành công');
            document.getElementById('editChapterModal').style.display = 'none';

            const currentBookId = document.getElementById('editStoryForm')?.dataset.bookId;
            if (currentBookId) showStoryDetail(currentBookId);
        } else {
            alert('Lỗi khi cập nhật chương');
        }
    })
    .catch(err => {
        console.error('Lỗi khi cập nhật chương:', err);
        alert('Không thể cập nhật chương');
    });
});


document.getElementById('editStoryForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const bookId = this.dataset.bookId;
    console.log('Submitting edit form for bookId:', bookId); // Debug log
    
    if (!bookId) {
        alert('Lỗi: Không tìm thấy ID truyện');
        return;
    }
    
    const formData = new FormData(this);
    const genres = formData.getAll('genre');

    const data = {
        title: formData.get('title'),
        author: formData.get('author'),
        tags: genres,
        status: formData.get('status'),
        description: formData.get('description')
    };
    
    console.log('Sending data:', data); // Debug log

    // Xử lý file upload nếu có
    const coverImageFile = formData.get('coverImageFile');
    
    if (coverImageFile && coverImageFile.size > 0) {
        // Upload cover image trước
        const fileFormData = new FormData();
        fileFormData.append('cover_image', coverImageFile);

        fetch(`${api_URL}/api/admin/books/${bookId}/upload-cover`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: fileFormData
        })
        .then(response => response.json())
        .then(uploadData => {
            if (uploadData.message === 'Upload cover image thành công') {
                // Cập nhật thông tin truyện với URL ảnh mới
                data.cover_image = uploadData.cover_image_url;
                return updateBookInfo(bookId, data);
            } else {
                throw new Error('Lỗi upload ảnh: ' + uploadData.message);
            }
        })
        .then(() => {
            alert('Cập nhật truyện thành công');
            closeModal('editStoryModal');
            loadStories();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Lỗi khi cập nhật truyện: ' + error.message);
        });
    } else {
        // Không có ảnh mới, chỉ cập nhật thông tin
        updateBookInfo(bookId, data)
        .then(() => {
            alert('Cập nhật truyện thành công');
            closeModal('editStoryModal');
            loadStories();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Lỗi khi cập nhật truyện: ' + error.message);
        });
    }
});

document.getElementById('addAdForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);

    const data = {
        title: formData.get('adName'),
        position: formData.get('position'),
        type: formData.get('adType'),
        status: formData.get('status'),
        target_url: formData.get('targetUrl'),
        display_duration: formData.get('displayTime'),
        frequency: formData.get('frequency'),
        start_date: formData.get('startDate'),
        end_date: formData.get('endDate'),
        html_content: formData.get('adContent')
    };

    fetch(`${api_URL}/api/admin/ads`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Thêm quảng cáo mới thành công');
            closeModal('addAdModal');
            this.reset();
            loadAds();
        } else {
            alert('Lỗi khi thêm quảng cáo: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Lỗi khi thêm quảng cáo');
    });
});

document.getElementById('editAdForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // LẤY ADId TỪ DATASET CỦA FORM
    const adId = this.dataset.adId;
    
    if (!adId) {
        alert('Không tìm thấy ID quảng cáo');
        return;
    }
    
    const formData = new FormData(this);

    const data = {
        title: formData.get('adName'),
        position: formData.get('position'),
        type: formData.get('adType'),
        status: formData.get('status'),
        target_url: formData.get('targetUrl'),
        display_duration: formData.get('displayTime'),
        frequency: formData.get('frequency'),
        start_date: formData.get('startDate'),
        end_date: formData.get('endDate'),
        html_content: formData.get('adContent')
    };

    fetch(`${api_URL}/api/admin/ads/${adId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Cập nhật quảng cáo thành công');
            closeModal('editAdModal');
            loadAds();
        } else {
            alert('Lỗi khi cập nhật quảng cáo: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Lỗi khi cập nhật quảng cáo');
    });
});

// Close modals when clicking outside
window.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});

// Cover image preview
document.getElementById('coverImageFile').addEventListener('change', function (e) {
    const file = e.target.files[0];
    const preview = document.getElementById('previewCoverImage');

    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            preview.src = event.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        preview.src = '';
        preview.style.display = 'none';
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in and is admin
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    
    // Verify token and admin status
    fetch(`${api_URL}/api/admin/dashboard/stats`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/login.html';
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            loadDashboardStats();
            loadStories();
        } else {
            window.location.href = '/login.html';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        window.location.href = '/login.html';
    });
});