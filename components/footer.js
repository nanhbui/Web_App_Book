function openFeedbackModal() {
  const modal = document.getElementById('feedbackModal');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  console.log('Modal opened'); // Debug log
}

function closeFeedbackModal() {
  const modal = document.getElementById('feedbackModal');
  modal.classList.remove('active');
  document.body.style.overflow = 'auto';
  document.getElementById('feedbackForm').reset();
  console.log('Modal closed'); // Debug log
}

// Close modal when clicking outside
window.addEventListener('DOMContentLoaded', function() {
  document.getElementById('feedbackModal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeFeedbackModal();
    }
  });
});

// Handle form submission
document.getElementById('feedbackForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  // Get form data
  const formData = new FormData(this);
  const feedbackTypes = [];
  
  // Get all checked feedback types
  const checkboxes = document.querySelectorAll('input[name="feedbackType"]:checked');
  checkboxes.forEach(checkbox => {
    feedbackTypes.push(checkbox.value.toLowerCase()); // Convert to lowercase to match API
  });
  
  // Validate at least one feedback type is selected
  if (feedbackTypes.length === 0) {
    alert('Vui lòng chọn ít nhất một loại ý kiến!');
    return;
  }

  // Get token from localStorage (assuming it's stored there after login)
  const token = localStorage.getItem('authToken');
  if (!token) {
    alert('Vui lòng đăng nhập để gửi phản hồi');
    return;
  }

  // For each selected feedback type, send a separate request
  try {
    const requests = feedbackTypes.map(async (type) => {
      const feedbackData = {
        username: formData.get('userName'),
        email: formData.get('userEmail'),
        type: type,
        title: formData.get('feedbackTitle'),
        content: formData.get('feedbackContent')
      };

      const response = await fetch('http://192.168.11.198:3001/api/auth/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(feedbackData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    });

    // Wait for all requests to complete
    await Promise.all(requests);
    
    // Show success message
    alert('Cảm ơn bạn đã gửi ý kiến! Chúng tôi sẽ xem xét và phản hồi sớm nhất có thể.');
    
    // Close modal and reset form
    closeFeedbackModal();
  } catch (error) {
    console.error('Error submitting feedback:', error);
    alert('Có lỗi xảy ra khi gửi phản hồi. Vui lòng thử lại sau.');
  }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && document.getElementById('feedbackModal').classList.contains('active')) {
    closeFeedbackModal();
  }
});