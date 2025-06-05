const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashed]
    );
    res.status(201).json({ message: 'Registered successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });

    const user = rows[0];

    // Kiểm tra nếu bị ban
    if (user.status === 'banned') {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });

    const token = jwt.sign(
      { user_id: user.user_id, role: user.role, status: user.status },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy lại thông tin người dùng từ token
exports.getMe = async (req, res) => {
  try {
    const { user_id } = req.user;

    // Lấy thông tin người dùng, bao gồm created_at (chỉ lấy ngày)
    const [users] = await pool.execute(
      `SELECT user_id, username, email, avatar_url, role, status, DATE(created_at) AS created_at 
       FROM users 
       WHERE user_id = ?`,
      [user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const user = users[0];

    // Lấy số lượng sách yêu thích (favorites)
    const [favCountResult] = await pool.execute(
      'SELECT COUNT(*) AS favorite_count FROM favorites WHERE user_id = ?',
      [user_id]
    );

    const favorite_count = favCountResult[0].favorite_count;

    // Trả về cả thông tin người dùng và số lượng favorites
    res.json({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url,
      role: user.role,
      status: user.status,
      created_at: user.created_at, // thêm created_at đã định dạng ngày
      favorite_count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi lấy thông tin người dùng' });
  }
};


