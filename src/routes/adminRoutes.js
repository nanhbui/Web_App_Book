const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Lấy thống kê dashboard
router.get('/dashboard/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    // Lấy tổng số books
    const [totalBooksResult] = await db.query('SELECT COUNT(*) as total_books FROM books');
    const totalBooks = totalBooksResult[0].total_books;

    // Lấy tổng số tài khoản
    const [totalUsersResult] = await db.query('SELECT COUNT(*) as total_users FROM users');
    const totalUsers = totalUsersResult[0].total_users;

    // Lấy tổng số views từ tất cả các truyện
    const [totalViewsResult] = await db.query('SELECT SUM(views) as total_views FROM books');
    const totalViews = totalViewsResult[0].total_views || 0;

    // Lấy tổng số comment của ngày hiện tại
    const [todayCommentsResult] = await db.query(
      'SELECT COUNT(*) as today_comments FROM comments WHERE DATE(created_at) = CURDATE()'
    );
    const todayComments = todayCommentsResult[0].today_comments;

    res.json({
      success: true,
      data: {
        totalBooks,
        totalUsers,
        totalViews,
        todayComments,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Lỗi khi lấy thống kê dashboard:', err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi lấy thống kê dashboard' 
    });
  }
});

// API lấy danh sách truyện với phân trang và tìm kiếm
router.get('/books', verifyToken, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    let queryParams = [];

    if (search) {
      whereClause = 'WHERE b.title LIKE ? OR b.author LIKE ?';
      queryParams = [`%${search}%`, `%${search}%`];
    }

    // Query chính với DISTINCT tags
    const query = `
      SELECT 
        b.book_id,
        b.title,
        b.author,
        b.description,
        b.status,
        b.cover_image,
        b.average_rating,
        b.created_at,
        b.updated_at,
        GROUP_CONCAT(DISTINCT t.name) as tags,
        COUNT(DISTINCT c.chapter_id) as chapter_count
      FROM books b
      LEFT JOIN book_tags bt ON b.book_id = bt.book_id
      LEFT JOIN tags t ON bt.tag_id = t.tag_id
      LEFT JOIN chapters c ON b.book_id = c.book_id
      ${whereClause}
      GROUP BY b.book_id
      ORDER BY b.updated_at DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(limit, offset);

    const [rows] = await db.query(query, queryParams);

    // Xử lý tags cho từng truyện
    const books = rows.map(book => {
      let tags = [];
      if (book.tags) {
        tags = book.tags.split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0);
        
        // Loại bỏ duplicate tags
        tags = [...new Set(tags)];
      }

      return {
        ...book,
        tags: tags // Array không duplicate
      };
    });

    // Count total records for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT b.book_id) as total
      FROM books b
      LEFT JOIN book_tags bt ON b.book_id = bt.book_id
      LEFT JOIN tags t ON bt.tag_id = t.tag_id
      ${whereClause}
    `;

    const [countRows] = await db.query(countQuery, search ? [`%${search}%`, `%${search}%`] : []);
    const totalRecords = countRows[0].total;


    res.json({
      success: true,
      data: books,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalRecords / limit),
        totalRecords: totalRecords,
        limit: limit
      }
    });

  } catch (err) {
    console.error('Error getting books:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi lấy danh sách truyện' 
    });
  }
});

// Multer cấu hình lưu file cho cover image
const coverStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/covers');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = `cover_${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const uploadCover = multer({
  storage: coverStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cho cover image
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Chỉ hỗ trợ ảnh JPG, PNG, WEBP'));
    }
    cb(null, true);
  },
});

router.get('/books/:bookId', verifyToken, isAdmin, async (req, res) => {
  const { bookId } = req.params;

  try {
    // Query chính để lấy thông tin truyện với DISTINCT tags
    const [bookRows] = await db.query(`
      SELECT 
        b.book_id,
        b.title,
        b.author,
        b.description,
        b.status,
        b.cover_image,
        b.average_rating,
        b.created_at,
        b.updated_at,
        GROUP_CONCAT(DISTINCT t.name) as tags,
        COUNT(DISTINCT c.chapter_id) as chapter_count
      FROM books b
      LEFT JOIN book_tags bt ON b.book_id = bt.book_id
      LEFT JOIN tags t ON bt.tag_id = t.tag_id
      LEFT JOIN chapters c ON b.book_id = c.book_id
      WHERE b.book_id = ?
      GROUP BY b.book_id
    `, [bookId]);

    if (bookRows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy truyện' });
    }

    const book = bookRows[0];

    // Lấy danh sách chapters riêng biệt
    const [chapterRows] = await db.query(`
      SELECT chapter_id, title, chapter_order, created_at
      FROM chapters
      WHERE book_id = ?
      ORDER BY chapter_order ASC
    `, [bookId]);

    // Xử lý tags - đảm bảo không duplicate
    let tags = [];
    if (book.tags) {
      tags = book.tags.split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      // Loại bỏ duplicate tags
      tags = [...new Set(tags)];
    }

    const result = {
      book_id: book.book_id,
      title: book.title,
      author: book.author,
      description: book.description,
      status: book.status,
      cover_image: book.cover_image,
      rating: book.average_rating,
      created_at: book.created_at,
      updated_at: book.updated_at,
      tags: tags, // Array không duplicate
      chapter_count: book.chapter_count,
      chapters: chapterRows
    };


    res.json({ 
      success: true, 
      data: result 
    });

  } catch (err) {
    console.error('Error getting book details:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi lấy thông tin truyện' 
    });
  }
});

// API thêm truyện mới với upload cover image
router.post('/books', verifyToken, isAdmin, uploadCover.single('cover_image'), async (req, res) => {
  let { title, author, description, status, tags = [] } = req.body;

  // Validate required fields
  if (!title || !author) {
    return res.status(400).json({ message: 'Thiếu tiêu đề hoặc tác giả' });
  }

  // Validate status
  if (status && !['Đang tiến hành', 'Hoàn thành', 'Tạm dừng'].includes(status)) {
    return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
  }

  // Xử lý tags từ JSON string hoặc array
  console.log('Raw req.body.tags:', req.body.tags);
  console.log('Type of tags:', typeof req.body.tags);

  if (typeof tags === 'string') {
    try {
      // Nếu là JSON string, parse nó
      tags = JSON.parse(tags);
    } catch (e) {
      // Nếu không parse được, coi như chuỗi đơn và split bằng dấu phay
      tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
  }
  
  // Đảm bảo tags là array
  if (!Array.isArray(tags)) {
    tags = [];
  }

  // Lọc bỏ các tag rỗng và trim whitespace
  tags = tags.filter(tag => tag && typeof tag === 'string' && tag.trim()).map(tag => tag.trim());

  console.log('Processed tags:', tags);

  // Xử lý cover image
  let coverImageUrl = null;
  if (req.file) {
    coverImageUrl = `${req.protocol}://${req.get('host')}/uploads/covers/${req.file.filename}`;
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // Insert book
    const [result] = await conn.query(
      'INSERT INTO books (title, author, cover_image, description, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [title, author, coverImageUrl, description || null, status || 'Đang tiến hành']
    );
    const bookId = result.insertId;

    // Xử lý tags nếu có
    for (const tagName of tags) {
      if (tagName && tagName.trim()) {
        const trimmedTagName = tagName.trim();
        
        console.log(`Processing tag: "${trimmedTagName}"`);
        
        // Tìm tag existing (case-insensitive và trim whitespace)
        let [tagRows] = await conn.query(
          'SELECT tag_id, name FROM tags WHERE LOWER(TRIM(name)) = LOWER(?)', 
          [trimmedTagName]
        );
        
        console.log(`Found ${tagRows.length} matching tags for "${trimmedTagName}":`, tagRows);
        
        let tagId;
        if (tagRows.length === 0) {
          // Tạo tag mới
          console.log(`Creating new tag: "${trimmedTagName}"`);
          const [tagResult] = await conn.query('INSERT INTO tags (name) VALUES (?)', [trimmedTagName]);
          tagId = tagResult.insertId;
        } else {
          // Sử dụng tag có sẵn
          console.log(`Using existing tag ID: ${tagRows[0].tag_id} for "${tagRows[0].name}"`);
          tagId = tagRows[0].tag_id;
        }
        
        // Kiểm tra xem book_tags đã tồn tại chưa để tránh duplicate
        const [existingBookTag] = await conn.query(
          'SELECT * FROM book_tags WHERE book_id = ? AND tag_id = ?', 
          [bookId, tagId]
        );
        
        if (existingBookTag.length === 0) {
          await conn.query('INSERT INTO book_tags (book_id, tag_id) VALUES (?, ?)', [bookId, tagId]);
          console.log(`Added book_tag relation: book_id=${bookId}, tag_id=${tagId}`);
        } else {
          console.log(`Book_tag relation already exists: book_id=${bookId}, tag_id=${tagId}`);
        }
      }
    }

    await conn.commit();
    
    console.log(`Successfully created book with ID: ${bookId}`);
    
    res.status(201).json({ 
      success: true,
      message: 'Thêm truyện thành công', 
      bookId,
      cover_image_url: coverImageUrl 
    });
    
  } catch (err) {
    await conn.rollback();
    
    // Xóa file đã upload nếu có lỗi
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', 'covers', req.file.filename);
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.warn('Không thể xóa file cover:', unlinkErr.message);
      });
    }
    
    console.error('Error creating book:', err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi thêm truyện',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
    
  } finally {
    conn.release();
  }
});

// API cập nhật cover image cho truyện đã có
router.post('/books/:bookId/upload-cover', verifyToken, isAdmin, uploadCover.single('cover_image'), async (req, res) => {
  const bookId = req.params.bookId;

  if (!req.file) {
    return res.status(400).json({ message: 'Không có file được upload' });
  }

  const coverImageUrl = `${req.protocol}://${req.get('host')}/uploads/covers/${req.file.filename}`;

  try {
    // Lấy cover image cũ
    const [books] = await db.query('SELECT cover_image FROM books WHERE book_id = ?', [bookId]);
    
    if (books.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy truyện' });
    }

    const oldCoverImage = books[0]?.cover_image;

    // Xóa file cũ nếu tồn tại
    if (oldCoverImage && oldCoverImage.includes('/uploads/covers/')) {
      const oldPath = path.join(__dirname, '..', oldCoverImage.split('/uploads/')[1]);
      fs.unlink(oldPath, (err) => {
        if (err) console.warn('Không thể xóa cover image cũ:', err.message);
      });
    }

    // Cập nhật DB
    await db.query('UPDATE books SET cover_image = ? WHERE book_id = ?', [coverImageUrl, bookId]);
    
    res.json({ 
      message: 'Upload cover image thành công', 
      cover_image_url: coverImageUrl 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi upload cover image' });
  }
});

// Sửa truyện 
router.put('/books/:bookId', verifyToken, isAdmin, async (req, res) => {
  const bookId = req.params.bookId;
  const { title, author, cover_image, description, status, tags = [] } = req.body;

  if (status && !['Đang tiến hành', 'Hoàn thành','Tạm dừng'].includes(status)) {
    return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    const [result] = await conn.query(
      'UPDATE books SET title = ?, author = ?, cover_image = ?, description = ?, status = ? WHERE book_id = ?',
      [title, author, cover_image, description, status || 'Đang tiến hành', bookId]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy truyện' });
    }

    await conn.query('DELETE FROM book_tags WHERE book_id = ?', [bookId]);

    for (const tagName of tags) {
      let [tagRows] = await conn.query('SELECT tag_id FROM tags WHERE name = ?', [tagName]);
      let tagId;
      if (tagRows.length === 0) {
        const [tagResult] = await conn.query('INSERT INTO tags (name) VALUES (?)', [tagName]);
        tagId = tagResult.insertId;
      } else {
        tagId = tagRows[0].tag_id;
      }
      await conn.query('INSERT INTO book_tags (book_id, tag_id) VALUES (?, ?)', [bookId, tagId]);
    }

    await conn.commit();
    res.json({ message: 'Cập nhật truyện thành công' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi cập nhật truyện' });
  } finally {
    conn.release();
  }
});

// Xoá truyện
router.delete('/books/:bookId', verifyToken, isAdmin, async (req, res) => {
  const bookId = req.params.bookId;
  try {
    const [result] = await db.query('DELETE FROM books WHERE book_id = ?', [bookId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Không tìm thấy truyện' });
    }
    res.json({ message: 'Xoá truyện thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi xoá truyện' });
  }
});

// Thêm chương mới cho truyện
router.post('/books/:bookId/chapters', verifyToken, isAdmin, async (req, res) => {
  const { bookId } = req.params;
  const { title, content, chapter_order } = req.body;

  if (!title || !content || !chapter_order) {
    return res.status(400).json({ message: 'Thiếu tiêu đề, nội dung hoặc thứ tự chương' });
  }

  try {
    await db.query(
      'INSERT INTO chapters ( book_id, title, content, chapter_order) VALUES (?, ?, ?, ?)',
      [bookId, title, content, chapter_order]
    );
    res.json({ message: 'Đã thêm chương thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi thêm chương' });
  }
});

// Lấy thông tin 1 chương
router.get('/chapters/:chapterId', verifyToken, isAdmin, async (req, res) => {
  const { chapterId } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM chapters WHERE chapter_id = ?', [chapterId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy chương' });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi lấy chương' });
  }
});

// Sửa chương theo chapterId
router.put('/chapters/:chapterId', verifyToken, isAdmin, async (req, res) => {
  const { chapterId } = req.params;
  const { title, content, chapter_order } = req.body;

  // Kiểm tra dữ liệu đầu vào
  if (!title || !content || !chapter_order) {
    return res.status(400).json({ message: 'Thiếu tiêu đề, nội dung hoặc thứ tự chương' });
  }

  try {
    // Kiểm tra chương tồn tại trước khi cập nhật
    const [existing] = await db.query('SELECT chapter_id FROM chapters WHERE chapter_id = ?', [chapterId]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy chương' });
    }
  
    // Cập nhật chương
    await db.query(
      'UPDATE chapters SET title = ?, content = ?, chapter_order = ? WHERE chapter_id = ?',
      [title, content, chapter_order, chapterId]
    );

    res.json({ message: 'Đã cập nhật chương thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi cập nhật chương' });
  }
});

// Lấy danh sách người dùng
router.get('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const search = req.query.search || '';
    
    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    
    if (search) {
      whereClause += ' AND (username LIKE ? OR email LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }
    
    const [users] = await db.query(`
      SELECT user_id, username, email, role, status, created_at 
      FROM users ${whereClause}
      ORDER BY created_at DESC
    `, queryParams);
    
    res.json({
      success: true,
      data: users
    });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách người dùng:', err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi lấy danh sách người dùng' 
    });
  }
});

// API cập nhật người dùng theo user_id
router.put('/users/:userId', verifyToken, isAdmin, async (req, res) => {
  const { userId } = req.params;
  const { role, status } = req.body;

  if (!role || !status) {
    return res.status(400).json({ 
      success: false,
      message: 'Thiếu role hoặc status' 
    });
  }

  try {
    const [result] = await db.query(
      'UPDATE users SET role = ?, status = ? WHERE user_id = ?',
      [role, status, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy người dùng' 
      });
    }

    res.json({ 
      success: true,
      message: 'Cập nhật người dùng thành công' 
    });
  } catch (err) {
    console.error('Lỗi khi cập nhật người dùng:', err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi cập nhật người dùng' 
    });
  }
});

// API xóa người dùng theo user_id  
router.delete('/users/:userId', verifyToken, isAdmin, async (req, res) => {
  const { userId } = req.params;

  try {
    const [result] = await db.query('DELETE FROM users WHERE user_id = ?', [userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy người dùng' 
      });
    }

    res.json({ 
      success: true,
      message: 'Xóa người dùng thành công' 
    });
  } catch (err) {
    console.error('Lỗi khi xóa người dùng:', err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi xóa người dùng' 
    });
  }
});

// ===== QUẢN LÝ QUẢNG CÁO =====

// Lấy danh sách quảng cáo với phân trang và filter
router.get('/ads', verifyToken, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
    
    const { search, position, status, type } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    
    // Thêm điều kiện tìm kiếm
    if (search) {
      whereClause += ' AND title LIKE ?';
      queryParams.push(`%${search}%`);
    }
    
    if (position) {
      whereClause += ' AND position = ?';
      queryParams.push(position);
    }
    
    if (status) {
      whereClause += ' AND status = ?';
      queryParams.push(status);
    }
    
    if (type) {
      whereClause += ' AND type = ?';
      queryParams.push(type);
    }
    
    // Lấy tổng số records
    const [countResult] = await db.query(`
      SELECT COUNT(*) as total FROM ads ${whereClause}
    `, queryParams);
    const total = countResult[0].total;
    
    // Lấy dữ liệu với phân trang
    const [ads] = await db.query(`
      SELECT 
        ad_id,
        title,
        position,
        type,
        status,
        target_url,
        display_duration,
        frequency,
        start_date,
        end_date,
        image_url,
        video_url,
        click_count,
        view_count,
        created_at,
        updated_at
      FROM ads 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);
    
    res.json({
      success: true,
      data: {
        ads,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          limit
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi lấy danh sách quảng cáo' 
    });
  }
});

// Thêm quảng cáo mới
router.post('/ads', verifyToken, isAdmin, async (req, res) => {
  const { 
    title, 
    position, 
    type, 
    status = 'active', 
    target_url, 
    display_duration, 
    frequency, 
    start_date, 
    end_date,
    image_url,
    video_url,
    html_content
  } = req.body;

  // Validate required fields
  if (!title || !position || !type || !start_date || !end_date) {
    return res.status(400).json({ 
      success: false,
      message: 'Thiếu thông tin bắt buộc: title, position, type, start_date, end_date' 
    });
  }

  // Validate enum values
  const validPositions = ['header', 'sidebar', 'content', 'footer', 'popup'];
  const validTypes = ['banner', 'popup', 'video', 'html'];
  const validStatuses = ['active', 'paused', 'expired'];

  if (!validPositions.includes(position)) {
    return res.status(400).json({ 
      success: false,
      message: 'Vị trí không hợp lệ' 
    });
  }

  if (!validTypes.includes(type)) {
    return res.status(400).json({ 
      success: false,
      message: 'Loại quảng cáo không hợp lệ' 
    });
  }

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false,
      message: 'Trạng thái không hợp lệ' 
    });
  }

  try {
    const [result] = await db.query(`
      INSERT INTO ads (
        title, position, type, status, target_url, display_duration, 
        frequency, start_date, end_date, image_url, video_url, html_content
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title, position, type, status, target_url, display_duration, 
      frequency, start_date, end_date, image_url, video_url, html_content
    ]);

    res.status(201).json({ 
      success: true,
      message: 'Thêm quảng cáo thành công', 
      adId: result.insertId 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi thêm quảng cáo' 
    });
  }
});

// Lấy thông tin chi tiết một quảng cáo
router.get('/ads/:adId', verifyToken, isAdmin, async (req, res) => {
  const { adId } = req.params;

  try {
    const [ads] = await db.query(`
      SELECT * FROM ads WHERE ad_id = ?
    `, [adId]);

    if (ads.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy quảng cáo' 
      });
    }

    res.json({
      success: true,
      data: ads[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi lấy thông tin quảng cáo' 
    });
  }
});

// Cập nhật quảng cáo
router.put('/ads/:adId', verifyToken, isAdmin, async (req, res) => {
  const { adId } = req.params;
  const { 
    title, 
    position, 
    type, 
    status, 
    target_url, 
    display_duration, 
    frequency, 
    start_date, 
    end_date,
    image_url,
    video_url,
    html_content
  } = req.body;

  // Validate enum values if provided
  const validPositions = ['header', 'sidebar', 'content', 'footer', 'popup'];
  const validTypes = ['banner', 'popup', 'video', 'html'];
  const validStatuses = ['active', 'paused', 'expired'];

  if (position && !validPositions.includes(position)) {
    return res.status(400).json({ 
      success: false,
      message: 'Vị trí không hợp lệ' 
    });
  }

  if (type && !validTypes.includes(type)) {
    return res.status(400).json({ 
      success: false,
      message: 'Loại quảng cáo không hợp lệ' 
    });
  }

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false,
      message: 'Trạng thái không hợp lệ' 
    });
  }

  try {
    const [result] = await db.query(`
      UPDATE ads 
      SET title = ?, position = ?, type = ?, status = ?, target_url = ?, 
          display_duration = ?, frequency = ?, start_date = ?, end_date = ?,
          image_url = ?, video_url = ?, html_content = ?
      WHERE ad_id = ?
    `, [
      title, position, type, status, target_url, display_duration, 
      frequency, start_date, end_date, image_url, video_url, html_content, adId
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy quảng cáo' 
      });
    }

    res.json({ 
      success: true,
      message: 'Cập nhật quảng cáo thành công' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi cập nhật quảng cáo' 
    });
  }
});

// Xóa quảng cáo
router.delete('/ads/:adId', verifyToken, isAdmin, async (req, res) => {
  const { adId } = req.params;

  try {
    const [result] = await db.query('DELETE FROM ads WHERE ad_id = ?', [adId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy quảng cáo' 
      });
    }

    res.json({ 
      success: true,
      message: 'Xóa quảng cáo thành công' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi xóa quảng cáo' 
    });
  }
});

// Cập nhật trạng thái quảng cáo
router.patch('/ads/:adId/status', verifyToken, isAdmin, async (req, res) => {
  const { adId } = req.params;
  const { status } = req.body;

  if (!['active', 'paused', 'expired'].includes(status)) {
    return res.status(400).json({ 
      success: false,
      message: 'Trạng thái không hợp lệ' 
    });
  }

  try {
    const [result] = await db.query(
      'UPDATE ads SET status = ? WHERE ad_id = ?',
      [status, adId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy quảng cáo' 
      });
    }

    const statusText = {
      'active': 'kích hoạt',
      'paused': 'tạm dừng', 
      'expired': 'đặt hết hạn'
    };

    res.json({ 
      success: true,
      message: `Đã ${statusText[status]} quảng cáo thành công` 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi cập nhật trạng thái quảng cáo' 
    });
  }
});

// API public để lấy quảng cáo hiển thị (không cần admin)
router.get('/public/ads/active', async (req, res) => {
  const { position } = req.query;
  
  try {
    let query = `
      SELECT ad_id, title, position, type, target_url, display_duration, 
             frequency, image_url, video_url, html_content
      FROM ads 
      WHERE status = 'active' 
        AND start_date <= CURDATE() 
        AND end_date >= CURDATE()
    `;
    
    const params = [];
    
    if (position) {
      query += ' AND position = ?';
      params.push(position);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [ads] = await db.query(query, params);
    
    // Tăng view count cho các quảng cáo được lấy
    if (ads.length > 0) {
      const adIds = ads.map(ad => ad.ad_id);
      await db.query(
        `UPDATE ads SET view_count = view_count + 1 WHERE ad_id IN (${adIds.map(() => '?').join(',')})`,
        adIds
      );
    }
    
    res.json({
      success: true,
      data: ads
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi lấy quảng cáo' 
    });
  }
});

// API để track click quảng cáo
router.post('/public/ads/:adId/click', async (req, res) => {
  const { adId } = req.params;
  
  try {
    await db.query(
      'UPDATE ads SET click_count = click_count + 1 WHERE ad_id = ?',
      [adId]
    );
    
    res.json({
      success: true,
      message: 'Click tracked successfully'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi track click' 
    });
  }
});

// Lấy thống kê quảng cáo
router.get('/ads/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const [totalStats] = await db.query(`
      SELECT 
        COUNT(*) as total_ads,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_ads,
        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused_ads,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_ads,
        SUM(view_count) as total_views,
        SUM(click_count) as total_clicks
      FROM ads
    `);

    const [positionStats] = await db.query(`
      SELECT position, COUNT(*) as count
      FROM ads 
      GROUP BY position
    `);

    const [typeStats] = await db.query(`
      SELECT type, COUNT(*) as count
      FROM ads 
      GROUP BY type
    `);

    res.json({
      success: true,
      data: {
        overview: totalStats[0],
        byPosition: positionStats,
        byType: typeStats
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi lấy thống kê quảng cáo' 
    });
  }
});

// API lấy danh sách feedback
router.get('/feedbacks', verifyToken, isAdmin, async (req, res) => {
  try {
    const [feedbacks] = await db.query(`
      SELECT 
        feedback_id,
        user_id,
        username,
        email,
        submitted_at,
        content,
        type,
        title
      FROM feedback
      ORDER BY submitted_at DESC
    `);

    res.json({
      success: true,
      data: feedbacks
    });
  } catch (err) {
    console.error('Lỗi khi lấy feedback:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách feedback'
    });
  }
});

module.exports = router;
