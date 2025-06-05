const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../controllers/authController');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const verifyToken = require('../middleware/auth');

router.post('/register', auth.register);
router.post('/login', auth.login);
router.get('/me', verifyToken, auth.getMe); 

// Đổi mật khẩu
router.post('/change-password', verifyToken, async (req, res) => {
  const user_id = req.user.user_id;
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'Thiếu mật khẩu hiện tại hoặc mật khẩu mới' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE user_id = ?', [user_id]);
    const user = users[0];

    if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại' });

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = ? WHERE user_id = ?', [hashedPassword, user_id]);

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi đổi mật khẩu' });
  }
});

// Cập nhật profile (username, email)
router.put('/profile', verifyToken, async (req, res) => {
  const user_id = req.user.user_id;
  const { username, email } = req.body;

  if (!username && !email) {
    return res.status(400).json({ message: 'Không có thông tin nào để cập nhật' });
  }

  try {
    let updateFields = [];
    let values = [];

    if (username) {
      updateFields.push('username = ?');
      values.push(username);
    }

    if (email) {
      updateFields.push('email = ?');
      values.push(email);
    }

    values.push(user_id);

    const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`;
    await db.query(sql, values);

    res.json({ message: 'Cập nhật thông tin thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi cập nhật thông tin' });
  }
});

// Multer cấu hình lưu file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = `avatar_${Date.now()}${ext}`;
    cb(null, filename);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Chỉ hỗ trợ ảnh JPG, PNG, WEBP'));
    }
    cb(null, true);
  },
});

//  Upload avatar + xoá avatar cũ nếu có
router.post('/upload-avatar', verifyToken, upload.single('avatar'), async (req, res) => {
  const user_id = req.user.user_id;

  if (!req.file) return res.status(400).json({ message: 'Không có file được upload' });

  const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;

  try {
    // Lấy avatar cũ
    const [users] = await db.query('SELECT avatar_url FROM users WHERE user_id = ?', [user_id]);
    const oldAvatar = users[0]?.avatar_url;

    // Xoá file cũ nếu tồn tại
    if (oldAvatar && oldAvatar.includes('/uploads/avatars/')) {
      const filename = oldAvatar.split('/').pop(); // Lấy tên file
      const oldPath = path.join(__dirname, '..', 'uploads', 'avatars', filename);
      
      // Kiểm tra file tồn tại trước khi xóa
      if (fs.existsSync(oldPath)) {
        fs.unlink(oldPath, (err) => {
          if (err) console.warn('Không thể xoá avatar cũ:', err.message);
          else console.log('Đã xoá avatar cũ thành công');
        });
      } else {
        console.log('Avatar cũ không tồn tại, bỏ qua việc xóa');
      }
    }

    // Cập nhật DB
    await db.query('UPDATE users SET avatar_url = ? WHERE user_id = ?', [avatarUrl, user_id]);
    res.json({ message: 'Upload avatar thành công', avatar_url: avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi upload avatar' });
  }
});

// Xoá avatar thủ công
router.delete('/avatar', verifyToken, async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const [users] = await db.query('SELECT avatar_url FROM users WHERE user_id = ?', [user_id]);
    const avatarUrl = users[0]?.avatar_url;

    if (!avatarUrl) {
      return res.status(400).json({ message: 'Người dùng chưa có avatar' });
    }

    // Xoá file vật lý
    if (avatarUrl.includes('/uploads/avatars/')) {
      const filePath = path.join(__dirname, '..', avatarUrl.split('/uploads/')[1]);
      fs.unlink(filePath, (err) => {
        if (err) console.warn('Không thể xoá avatar:', err.message);
      });
    }

    // Xoá URL trong DB
    await db.query('UPDATE users SET avatar_url = NULL WHERE user_id = ?', [user_id]);
    res.json({ message: 'Đã xoá avatar thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi xoá avatar' });
  }
});

// Gửi feedback
router.post('/feedback', verifyToken, async (req, res) => {
  const user_id = req.user.user_id;
  const { username, email, type, content, title } = req.body;

  // Kiểm tra dữ liệu đầu vào
  if (!username || !email || !type || !content || !title) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp đầy đủ username, email, type và content'
    });
  }

  // Các loại hợp lệ
  const allowedTypes = [
    'báo lỗi truyện/chương truyện',
    'báo lỗi giao diện',
    'đề xuất',
    'đóng góp trải nghiệm',
    'khác'
  ];

  if (!allowedTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Loại phản hồi không hợp lệ'
    });
  }

  try {
    await db.query(
      `INSERT INTO feedback (user_id, username, email, type, content, title) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, username, email, type, content, title]
    );

    res.status(201).json({
      success: true,
      message: 'Gửi phản hồi thành công'
    });
  } catch (err) {
    console.error('Lỗi khi gửi feedback:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi phản hồi'
    });
  }
});

module.exports = router;
