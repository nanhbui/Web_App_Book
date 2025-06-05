const API_BASE_URL = 'http://192.168.11.198:3001'; 
        
        const form = document.querySelector('.login-form');
        const email = document.getElementById('email');
        const password = document.getElementById('password');
        const loginBtn = document.getElementById('loginBtn');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const btnText = document.getElementById('btnText');
        const serverError = document.getElementById('serverError');

        // Validation functions
        function validateField(field, condition, errorId) {
            const errorElement = document.getElementById(errorId);
            if (!condition) {
                field.classList.add('error');
                errorElement.style.display = 'block';
                return false;
            } else {
                field.classList.remove('error');
                errorElement.style.display = 'none';
                return true;
            }
        }

        // Validation events
        email.addEventListener('blur', function() {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            validateField(this, emailRegex.test(this.value), 'email-error');
        });

        password.addEventListener('blur', function() {
            validateField(this, this.value.length > 0, 'password-error');
        });

        // Ẩn thông báo lỗi server khi người dùng bắt đầu nhập
        [email, password].forEach(input => {
            input.addEventListener('input', function() {
                hideServerError();
            });
        });

        function showServerError(message) {
            serverError.textContent = message;
            serverError.style.display = 'block';
        }

        function hideServerError() {
            serverError.style.display = 'none';
        }

        function setLoading(isLoading) {
            if (isLoading) {
                loginBtn.disabled = true;
                loadingSpinner.style.display = 'inline-block';
                btnText.textContent = 'Đang xử lý...';
            } else {
                loginBtn.disabled = false;
                loadingSpinner.style.display = 'none';
                btnText.textContent = 'Đăng nhập';
            }
        }

        // Hàm gọi API getMe để lấy thông tin người dùng
        async function fetchUserInfo(token) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const userData = await response.json();
                    
                    // Lưu thông tin người dùng vào localStorage
                    localStorage.setItem('userInfo', JSON.stringify(userData));
                    localStorage.setItem('username', userData.username);
                    localStorage.setItem('email', userData.email);
                    localStorage.setItem('userId', userData.user_id.toString());
                    localStorage.setItem('userRole', userData.role);
                    localStorage.setItem('userStatus', userData.status);
                    localStorage.setItem('favoriteCount', userData.favorite_count.toString());
                    
                    if (userData.avatar_url) {
                        localStorage.setItem('avatarUrl', userData.avatar_url);
                    }

                    console.log('User info loaded successfully:', userData);
                    return userData;
                } else {
                    console.warn('Failed to fetch user info:', response.status);
                    return null;
                }
            } catch (error) {
                console.error('Error fetching user info:', error);
                return null;
            }
        }

        // Xử lý submit form
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Validate các trường
            const isEmailValid = validateField(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value), 'email-error');
            const isPasswordValid = validateField(password, password.value.length > 0, 'password-error');
            
            if (!isEmailValid || !isPasswordValid) {
                return;
            }

            // Gửi request đến server
            setLoading(true);
            hideServerError();

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: email.value.trim(),
                        password: password.value
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    // Đăng nhập thành công
                    const token = data.token;
                    
                    // Lưu token vào localStorage
                    localStorage.setItem('authToken', token);
                    
                    // Decode token để lấy thông tin cơ bản
                    try {
                        const tokenData = JSON.parse(atob(token.split('.')[1]));
                        localStorage.setItem('userRole', tokenData.role);
                        localStorage.setItem('userId', tokenData.user_id.toString());
                        localStorage.setItem('userStatus', tokenData.status);
                    } catch (err) {
                        console.warn('Cannot decode token:', err);
                    }
                    
                    // Gọi API getMe để lấy thông tin đầy đủ của người dùng
                    console.log('Fetching user info...');
                    const userInfo = await fetchUserInfo(token);
                    
                    // Hiển thị modal thành công với tên người dùng (nếu có)
                    showSuccessModal(userInfo ? userInfo.username : null);
                } else {
                    // Xử lý các loại lỗi khác nhau
                    if (response.status === 403) {
                        // Tài khoản bị khóa
                        showBannedModal();
                    } else {
                        throw new Error(data.error || 'Đăng nhập thất bại');
                    }
                }
            } catch (error) {
                console.error('Login error:', error);
                
                let errorMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại sau.';
                
                if (error.message.includes('Email hoặc mật khẩu không đúng')) {
                    errorMessage = 'Email hoặc mật khẩu không đúng.';
                } else if (error.message.includes('network') || error.message.includes('fetch')) {
                    errorMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
                } else if (error.message) {
                    errorMessage = error.message;
                }

                showErrorModal(errorMessage);
            } finally {
                setLoading(false);
            }
        });

        // Hiển thị modal thành công và chuyển hướng
        function showSuccessModal(username = null) {
            const modal = document.getElementById('successModal');
            const countdownElement = document.getElementById('countdown');
            const welcomeMessage = document.getElementById('welcomeMessage');
            
            // Cập nhật thông điệp chào mừng với tên người dùng
            if (username) {
                welcomeMessage.textContent = `Chào mừng ${username} trở lại!`;
            } else {
                welcomeMessage.textContent = 'Chào mừng bạn trở lại!';
            }
            
            modal.style.display = 'flex';
            
            let countdown = 3; // Tăng thời gian để người dùng thấy được thông điệp
            const countdownInterval = setInterval(() => {
                countdown--;
                countdownElement.textContent = countdown;
                
                if (countdown === 0) {
                    clearInterval(countdownInterval);
                    // Chuyển hướng về trang chủ hoặc dashboard
                    window.location.href = 'index.html'; // Thay đổi URL này theo nhu cầu
                }
            }, 1000);
        }

        // Hiển thị modal lỗi
        function showErrorModal(message) {
            const modal = document.getElementById('errorModal');
            const messageElement = document.getElementById('errorMessage');
            
            messageElement.textContent = message;
            modal.style.display = 'flex';
        }

        // Hiển thị modal tài khoản bị khóa
        function showBannedModal() {
            const modal = document.getElementById('bannedModal');
            modal.style.display = 'flex';
        }

        // Đóng các modal
        function closeErrorModal() {
            const modal = document.getElementById('errorModal');
            modal.style.display = 'none';
        }

        function closeBannedModal() {
            const modal = document.getElementById('bannedModal');
            modal.style.display = 'none';
        }

        // Đóng modal khi click outside
        document.getElementById('errorModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeErrorModal();
            }
        });

        document.getElementById('bannedModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeBannedModal();
            }
        });

        // Xử lý quên mật khẩu
        function showForgotPassword() {
            alert('Tính năng quên mật khẩu đang được phát triển. Vui lòng liên hệ quản trị viên để được hỗ trợ.');
        }

        // Kiểm tra xem user đã đăng nhập chưa
        async function checkAuthStatus() {
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    // Thử gọi API getMe để kiểm tra token còn hiệu lực không
                    const userInfo = await fetchUserInfo(token);
                    if (userInfo) {
                        console.log('User already logged in, redirecting...');
                        // Nếu token còn hiệu lực thì chuyển hướng về trang chủ
                        // window.location.href = 'index.html';
                    } else {
                        // Token không hợp lệ, xóa khỏi localStorage
                        localStorage.clear();
                    }
                } catch (error) {
                    console.error('Auth check failed:', error);
                    localStorage.clear();
                }
            }
        }

        // Gọi khi trang load
        window.addEventListener('load', checkAuthStatus);