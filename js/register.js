const API_BASE_URL = 'http://192.168.11.198:3001'; 
        
        const form = document.querySelector('.register-form');
        const username = document.getElementById('username');
        const email = document.getElementById('email');
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirm-password');
        const strengthBar = document.getElementById('strength-bar');
        const registerBtn = document.getElementById('registerBtn');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const btnText = document.getElementById('btnText');
        const serverError = document.getElementById('serverError');

        // Kiểm tra độ mạnh mật khẩu
        password.addEventListener('input', function() {
            const value = this.value;
            const strength = getPasswordStrength(value);
            
            strengthBar.className = 'password-strength-bar';
            if (value.length > 0) {
                if (strength < 3) strengthBar.classList.add('strength-weak');
                else if (strength < 5) strengthBar.classList.add('strength-medium');
                else strengthBar.classList.add('strength-strong');
            }
        });

        function getPasswordStrength(password) {
            let strength = 0;
            if (password.length >= 6) strength++;
            if (password.length >= 8) strength++;
            if (/[a-z]/.test(password)) strength++;
            if (/[A-Z]/.test(password)) strength++;
            if (/[0-9]/.test(password)) strength++;
            if (/[^A-Za-z0-9]/.test(password)) strength++;
            return strength;
        }

        // Xác thực form
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

        username.addEventListener('blur', function() {
            validateField(this, this.value.length >= 3, 'username-error');
        });

        email.addEventListener('blur', function() {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            validateField(this, emailRegex.test(this.value), 'email-error');
        });

        password.addEventListener('blur', function() {
            validateField(this, this.value.length >= 6, 'password-error');
        });

        confirmPassword.addEventListener('blur', function() {
            validateField(this, this.value === password.value, 'confirm-error');
        });

        // Ẩn thông báo lỗi server khi người dùng bắt đầu nhập
        [username, email, password, confirmPassword].forEach(input => {
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
                registerBtn.disabled = true;
                loadingSpinner.style.display = 'inline-block';
                btnText.textContent = 'Đang xử lý...';
            } else {
                registerBtn.disabled = false;
                loadingSpinner.style.display = 'none';
                btnText.textContent = 'Đăng ký';
            }
        }

        // Xử lý submit form
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Validate tất cả các trường
            const isUsernameValid = validateField(username, username.value.length >= 3, 'username-error');
            const isEmailValid = validateField(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value), 'email-error');
            const isPasswordValid = validateField(password, password.value.length >= 6, 'password-error');
            const isConfirmValid = validateField(confirmPassword, confirmPassword.value === password.value, 'confirm-error');
            
            if (!isUsernameValid || !isEmailValid || !isPasswordValid || !isConfirmValid) {
                return;
            }

            // Gửi request đến server
            setLoading(true);
            hideServerError();

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: username.value.trim(),
                        email: email.value.trim(),
                        password: password.value
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    // Đăng ký thành công
                    showSuccessModal();
                } else {
                    // Đăng ký thất bại
                    throw new Error(data.error || 'Đăng ký thất bại');
                }
            } catch (error) {
                console.error('Registration error:', error);
                
                let errorMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại sau.';
                
                if (error.message.includes('username')) {
                    errorMessage = 'Tên đăng nhập đã được sử dụng.';
                } else if (error.message.includes('email')) {
                    errorMessage = 'Email đã được đăng ký.';
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
        function showSuccessModal() {
            const modal = document.getElementById('successModal');
            const countdownElement = document.getElementById('countdown');
            
            modal.style.display = 'flex';
            
            let countdown = 3;
            const countdownInterval = setInterval(() => {
                countdown--;
                countdownElement.textContent = countdown;
                
                if (countdown === 0) {
                    clearInterval(countdownInterval);
                    window.location.href = 'login.html';
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

        // Đóng modal lỗi
        function closeErrorModal() {
            const modal = document.getElementById('errorModal');
            modal.style.display = 'none';
        }

        // Đóng modal khi click outside
        document.getElementById('errorModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeErrorModal();
            }
        });