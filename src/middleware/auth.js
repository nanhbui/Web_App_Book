const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token không tồn tại' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Nếu token vẫn còn hợp lệ nhưng user bị banned
    if (decoded.status === 'banned') {
      return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa' });
    }

    req.user = decoded; // chứa user_id, role, status,...
    next();
  } catch (err) {
    res.status(403).json({ message: 'Token không hợp lệ' });
  }
};

module.exports = verifyToken;

