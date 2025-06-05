const express = require('express');
const router = express.Router();
const db = require('../db'); 
const verifyToken = require('../middleware/auth'); 

// API cho index.html 
router.get('/homepage/books', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8; // Số truyện mỗi trang
    const offset = (page - 1) * limit;
    const mode = req.query.mode; // 'new' hoặc 'completed'

    let books = [];
    let totalBooks = 0;

    // Các field cần thiết cho trang chủ - thêm prefix b. cho tất cả
    const selectFields = `
      b.book_id, b.title, b.author, b.cover_image, b.views, b.likes, 
      b.average_rating, b.rating_count, b.status, b.created_at
    `;

    if (mode === 'completed') {
      // Truyện đã hoàn thành
      const [[{ totalBooks: count }]] = await db.query(`
        SELECT COUNT(*) AS totalBooks FROM books WHERE status = 'Hoàn thành'
      `);
      totalBooks = count;

      [books] = await db.query(`
        SELECT ${selectFields}
        FROM books b
        WHERE b.status = 'Hoàn thành'
        ORDER BY b.created_at DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);

    } else {
      // Mặc định: truyện mới cập nhật (có chapter mới nhất)
      const [[{ totalBooks: count }]] = await db.query(`
        SELECT COUNT(DISTINCT b.book_id) AS totalBooks
        FROM books b
        JOIN chapters c ON b.book_id = c.book_id
      `);
      totalBooks = count;

      [books] = await db.query(`
        SELECT DISTINCT ${selectFields}, 
               MAX(c.created_at) as latest_chapter_date,
               MAX(c.chapter_order) as latest_chapter_order
        FROM books b
        JOIN chapters c ON b.book_id = c.book_id
        GROUP BY b.book_id
        ORDER BY latest_chapter_date DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);
    }

    // Nếu không có truyện nào, trả về response rỗng
    if (books.length === 0) {
      return res.json({
        books: [],
        currentPage: page,
        totalPages: 0,
        totalBooks: 0,
        mode: mode || 'new'
      });
    }

    // Lấy tags cho từng truyện
    const bookIds = books.map(book => book.book_id);
    const placeholders = bookIds.map(() => '?').join(',');
    
    const [tagRows] = await db.query(`
      SELECT bt.book_id, t.name 
      FROM book_tags bt 
      JOIN tags t ON bt.tag_id = t.tag_id
      WHERE bt.book_id IN (${placeholders})
      ORDER BY t.name
    `, bookIds);

    // Lấy thông tin chapter mới nhất cho từng truyện (chỉ cho truyện mới cập nhật)
    let chapterRows = [];
    if (mode !== 'completed') {
      [chapterRows] = await db.query(`
        SELECT c1.book_id, c1.chapter_order, c1.title as chapter_title, c1.created_at
        FROM chapters c1
        INNER JOIN (
          SELECT book_id, MAX(created_at) as max_date
          FROM chapters 
          WHERE book_id IN (${placeholders})
          GROUP BY book_id
        ) c2 ON c1.book_id = c2.book_id AND c1.created_at = c2.max_date
      `, bookIds);
    }

    // Kết hợp dữ liệu
    const booksWithDetails = books.map(book => {
      // Lấy tags
      const tags = tagRows
        .filter(tag => tag.book_id === book.book_id)
        .map(tag => tag.name);
      
      // Lấy thông tin chapter mới nhất
      const latestChapter = chapterRows.find(ch => ch.book_id === book.book_id);

      // Format dữ liệu trả về
      const result = {
        book_id: book.book_id,
        title: book.title,
        author: book.author,
        cover_image: book.cover_image,
        views: parseInt(book.views) || 0,
        likes: parseInt(book.likes) || 0,
        average_rating: parseFloat(book.average_rating) || 0,
        rating_count: parseInt(book.rating_count) || 0,
        status: book.status,
        tags: tags,
        created_at: book.created_at
      };

      // Thêm thông tin chapter mới nhất nếu có - FIXED
      if (latestChapter) {
        result.latest_chapter = {
          chapter_order: latestChapter.chapter_order, // ✅ FIXED: Sử dụng đúng field name
          title: latestChapter.chapter_title,
          updated_at: latestChapter.created_at
        };
      }

      return result;
    });

    res.json({
      success: true,
      books: booksWithDetails,
      currentPage: page,
      totalPages: Math.ceil(totalBooks / limit),
      totalBooks: totalBooks,
      mode: mode || 'new'
    });

  } catch (err) {
    console.error('Error in /homepage/books endpoint:', err);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi lấy danh sách truyện cho trang chủ',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// Hiển thị truyện genres.html
router.get('/books', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const offset = (page - 1) * limit;

    const mode = req.query.mode; // 'new' hoặc 'completed'
    const tags = req.query.tags ? req.query.tags.split(',') : [];
    const statusFilter = req.query.status; // 'ongoing' hoặc 'completed'
    const sort = req.query.sort; // 'az' | 'views' | 'rating'

    let books = [];
    let totalBooks = 0;

    // QUAN TRỌNG: Thêm đầy đủ các field cần thiết
    const selectFields = `book_id, title, author, description, status, cover_image, views, likes, average_rating, rating_count, created_at`;

    if (mode === 'new') {
      // Truyện mới cập nhật: dựa trên chapter.created_at
      const [[{ totalBooks: count }]] = await db.query(`
        SELECT COUNT(DISTINCT b.book_id) AS totalBooks
        FROM books b
        JOIN chapters c ON b.book_id = c.book_id
      `);
      totalBooks = count;

      [books] = await db.query(`
        SELECT DISTINCT b.${selectFields}
        FROM books b
        JOIN chapters c ON b.book_id = c.book_id
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);

    } else if (mode === 'completed') {
      const [[{ totalBooks: count }]] = await db.query(`
        SELECT COUNT(*) AS totalBooks FROM books WHERE status = 'Hoàn thành'
      `);
      totalBooks = count;

      [books] = await db.query(`
        SELECT ${selectFields}
        FROM books
        WHERE status = 'Hoàn thành'
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);

    } else if (tags.length > 0) {
      // Lọc theo tag, có thể nhiều tag
      const placeholders = tags.map(() => '?').join(',');
      const [bookIdsResult] = await db.query(`
        SELECT bt.book_id
        FROM book_tags bt
        JOIN tags t ON bt.tag_id = t.tag_id
        WHERE t.name IN (${placeholders})
        GROUP BY bt.book_id
        HAVING COUNT(DISTINCT t.name) = ?
      `, [...tags, tags.length]);

      const bookIds = bookIdsResult.map(row => row.book_id);
      if (bookIds.length === 0) {
        return res.json({
          books: [],
          currentPage: page,
          totalPages: 0,
          totalBooks: 0,
        });
      }

      let whereClauses = [`book_id IN (${bookIds.map(() => '?').join(',')})`];
      let queryParams = [...bookIds];
      let orderClause = 'ORDER BY created_at DESC';

      // Xử lý filter status
      if (statusFilter === 'completed') {
        whereClauses.push(`status = 'Hoàn thành'`);
      } else if (statusFilter === 'ongoing') {
        whereClauses.push(`status = 'Đang tiến hành'`);
      } else if (statusFilter === 'paused'){
        whereClauses.push(`status = 'Tạm dừng'`);
      }

      // Xử lý sort
      if (sort === 'az') orderClause = 'ORDER BY title ASC';
      else if (sort === 'views') orderClause = 'ORDER BY views DESC';
      else if (sort === 'rating') orderClause = 'ORDER BY average_rating DESC';
      else if (sort === 'new') orderClause = 'ORDER BY created_at DESC';

      const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

      // Count total books với điều kiện
      const [[{ totalBooks: count }]] = await db.query(`
        SELECT COUNT(*) AS totalBooks FROM books ${whereSql}
      `, queryParams);
      totalBooks = count;

      // Lấy books với đầy đủ thông tin
      [books] = await db.query(`
        SELECT ${selectFields}
        FROM books
        ${whereSql}
        ${orderClause}
        LIMIT ? OFFSET ?
      `, [...queryParams, limit, offset]);

    } else {
      // Trường hợp mặc định: tất cả truyện, mới nhất
      const [[{ totalBooks: count }]] = await db.query(`SELECT COUNT(*) AS totalBooks FROM books`);
      totalBooks = count;

      [books] = await db.query(`
        SELECT ${selectFields}
        FROM books
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);
    }

    // Gắn tags cho từng truyện
    const bookIds = books.map(book => book.book_id);
    let tagRows = [];
    
    if (bookIds.length > 0) {
      const placeholders = bookIds.map(() => '?').join(',');
      [tagRows] = await db.query(`
        SELECT bt.book_id, t.tag_id, t.name 
        FROM book_tags bt 
        JOIN tags t ON bt.tag_id = t.tag_id
        WHERE bt.book_id IN (${placeholders})
      `, bookIds);
    }

    // QUAN TRỌNG: Giữ lại book_id và gắn tags
    const booksWithTags = books.map(book => {
      const tags = tagRows
        .filter(tag => tag.book_id === book.book_id)
        .map(tag => tag.name);
      
      return { 
        ...book, // Giữ nguyên tất cả thông tin, bao gồm book_id
        tags 
      };
    });

    res.json({
      books: booksWithTags,
      currentPage: page,
      totalPages: Math.ceil(totalBooks / limit),
      totalBooks,
    });

  } catch (err) {
    console.error('Error in /books endpoint:', err);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách truyện' });
  }
});

// Hiển thị chi tiết 1 truyện + các chương
router.get('/books/:bookId',verifyToken, async (req, res) => {
  const bookId = req.params.bookId;

  try {
    // Tăng view lên 1
    await db.query('UPDATE books SET views = views + 1 WHERE book_id = ?', [bookId]);

    // Lấy thông tin truyện với đầy đủ field
    const [book] = await db.query(
      `SELECT book_id, title, author, cover_image, description, views, likes, average_rating, rating_count, status, DATE(created_at) AS created_at
       FROM books WHERE book_id = ?`,
      [bookId]
    );

    if (book.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy truyện' });
    }

    // Lấy danh sách chương
    const [chapters] = await db.query(
      'SELECT chapter_id, title, chapter_order, DATE(created_at) AS created_at FROM chapters WHERE book_id = ? ORDER BY chapter_order ASC',
      [bookId]
    );

    const chapterCount = chapters.length;

    // Lấy tag của truyện
    const [tags] = await db.query(
      `SELECT t.tag_id, t.name 
       FROM book_tags bt 
       JOIN tags t ON bt.tag_id = t.tag_id 
       WHERE bt.book_id = ?`,
      [bookId]
    );

    // Hiển thị đã like chưa:
    let liked = false;
    let userRating = null;
    let favorited = false;

    if (req.user) {
       const userId = req.user.user_id;

  // Kiểm tra đã like/rate chưa
       const [likeCheck] = await db.query(
       'SELECT * FROM book_likes WHERE user_id = ? AND book_id = ?',
       [userId, bookId]
     );
     liked = likeCheck.length > 0;

        const [favoriteCheck] = await db.query(
        'SELECT * FROM favorites WHERE user_id = ? AND book_id = ?',
        [userId, bookId]
     );
     favorited = favoriteCheck.length > 0;

  // Kiểm tra đã đánh giá chưa
     const [ratingCheck] = await db.query(
    'SELECT ratings FROM book_ratings WHERE user_id = ? AND book_id = ?',
    [userId, bookId]
  );
  if (ratingCheck.length > 0) {
    userRating = ratingCheck[0].ratings;
  }
}
    res.json({
       book: { ...book[0], chapter_count: chapterCount, liked, user_rating: userRating, favorited },
       tags,
       chapters
});


  } catch (err) {
    console.error('Error in /books/:bookId endpoint:', err);
    res.status(500).json({ message: 'Lỗi khi lấy chi tiết truyện' });
  }
});

// Đọc từ đầu:
// GET /books/:bookId/chapters/first
router.get('/books/:bookId/chapters/first', async (req, res) => {
  const { bookId } = req.params;

  try {
    // Lấy chương đầu tiên
    const [chapterRows] = await db.query(
      `SELECT chapter_id, book_id, title, content, chapter_order 
       FROM chapters 
       WHERE book_id = ? 
       ORDER BY chapter_order ASC LIMIT 1`,
      [bookId]
    );

    if (chapterRows.length === 0) {
      return res.status(404).json({ message: 'Chưa có chương nào trong truyện này' });
    }

    const chapter = chapterRows[0];
    const { chapter_id, chapter_order } = chapter;

    // Lấy danh sách tất cả các chương
    const [allChapters] = await db.query(
      `SELECT chapter_id, title, chapter_order 
       FROM chapters 
       WHERE book_id = ? 
       ORDER BY chapter_order ASC`,
      [bookId]
    );

    // Không có chương trước
    const prevChapterId = null;

    // Lấy chương tiếp theo
    const [next] = await db.query(
      `SELECT chapter_id FROM chapters 
       WHERE book_id = ? AND chapter_order > ? 
       ORDER BY chapter_order ASC LIMIT 1`,
      [bookId, chapter_order]
    );

    res.json({
      title: chapter.title,
      content: chapter.content,
      chapterId: chapter.chapter_id,
      chapterOrder: chapter.chapter_order,
      book_id: chapter.book_id,
      prevChapterId,
      nextChapterId: next.length > 0 ? next[0].chapter_id : null,
      allChapters
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi đọc chương đầu tiên' });
  }
});

//Đọc mới nhất:
// GET /books/:bookId/chapters/latest
router.get('/books/:bookId/chapters/latest', async (req, res) => {
  const { bookId } = req.params;

  try {
    // Lấy chương mới nhất
    const [chapterRows] = await db.query(
      `SELECT chapter_id, book_id, title, content, chapter_order 
       FROM chapters 
       WHERE book_id = ? 
       ORDER BY chapter_order DESC LIMIT 1`,
      [bookId]
    );

    if (chapterRows.length === 0) {
      return res.status(404).json({ message: 'Chưa có chương nào trong truyện này' });
    }

    const chapter = chapterRows[0];
    const { chapter_id, chapter_order } = chapter;

    // Lấy danh sách tất cả các chương
    const [allChapters] = await db.query(
      `SELECT chapter_id, title, chapter_order 
       FROM chapters 
       WHERE book_id = ? 
       ORDER BY chapter_order ASC`,
      [bookId]
    );

    // Lấy chương trước
    const [prev] = await db.query(
      `SELECT chapter_id FROM chapters 
       WHERE book_id = ? AND chapter_order < ? 
       ORDER BY chapter_order DESC LIMIT 1`,
      [bookId, chapter_order]
    );

    // Không có chương sau
    const nextChapterId = null;

    res.json({
      title: chapter.title,
      content: chapter.content,
      chapterId: chapter.chapter_id,
      chapterOrder: chapter.chapter_order,
      book_id: chapter.book_id,
      prevChapterId: prev.length > 0 ? prev[0].chapter_id : null,
      nextChapterId,
      allChapters
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi đọc chương mới nhất' });
  }
});

// Toggle like truyện (like nếu chưa, unlike nếu đã)
router.post('/books/:bookId/like', verifyToken, async (req, res) => {
  const { bookId } = req.params;
  const userId = req.user.user_id;

  try {
    // Kiểm tra người dùng đã like chưa
    const [check] = await db.query(
      'SELECT * FROM book_likes WHERE user_id = ? AND book_id = ?',
      [userId, bookId]
    );

    if (check.length > 0) {
      // Đã like rồi → unlike
      await db.query('DELETE FROM book_likes WHERE user_id = ? AND book_id = ?', [userId, bookId]);
      await db.query('UPDATE books SET likes = GREATEST(likes - 1, 0) WHERE book_id = ?', [bookId]);
      return res.json({ message: 'Đã bỏ thích truyện', liked: false });
    } else {
      // Chưa like → like
      await db.query('INSERT INTO book_likes (user_id, book_id) VALUES (?, ?)', [userId, bookId]);
      await db.query('UPDATE books SET likes = likes + 1 WHERE book_id = ?', [bookId]);
      return res.json({ message: 'Đã thích truyện', liked: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi xử lý like' });
  }
});

//Rating
router.post('/books/:bookId/rate', verifyToken, async (req, res) => {
  const userId = req.user.user_id;
  const { bookId } = req.params;
  const { rating } = req.body;

  if (![1, 2, 3, 4, 5].includes(rating)) {
    return res.status(400).json({ message: 'Rating phải từ 1 đến 5 sao' });
  }

  try {
    // Kiểm tra đã từng đánh giá chưa
    const [existing] = await db.query(
      'SELECT * FROM book_ratings WHERE user_id = ? AND book_id = ?',
      [userId, bookId]
    );

    if (existing.length > 0) {
      // Cập nhật đánh giá cũ
      await db.query(
        'UPDATE book_ratings SET ratings = ?, updated_at = NOW() WHERE user_id = ? AND book_id = ?',
        [rating, userId, bookId]
      );
    } else {
      // Thêm đánh giá mới
      await db.query(
        'INSERT INTO book_ratings (user_id, book_id, ratings) VALUES (?, ?, ?)',
        [userId, bookId, rating]
      );
    }

    // Tính lại trung bình và số lượng đánh giá
    const [[{ avg, count }]] = await db.query(
      'SELECT AVG(ratings) AS avg, COUNT(*) AS count FROM book_ratings WHERE book_id = ?',
      [bookId]
    );

    await db.query(
      'UPDATE books SET average_rating = ?, rating_count = ? WHERE book_id = ?',
      [avg, count, bookId]
    );

    res.json({
      message: 'Đánh giá thành công',
      average_rating: avg,
      rating_count: count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi xử lý đánh giá' });
  }
});

// Hiển thị nội dung một chương cụ thể + prev/next + danh sách tất cả các chương trong truyện
router.get('/chapters/:chapterId', async (req, res) => {
  const chapterId = req.params.chapterId;

  try {
    // Lấy chương hiện tại
    const [chapterResult] = await db.query(
      'SELECT chapter_id, book_id, title, content, chapter_order FROM chapters WHERE chapter_id = ?',
      [chapterId]
    );
    if (chapterResult.length === 0) return res.status(404).json({ message: 'Không tìm thấy chương' });

    const chapter = chapterResult[0];
    const { book_id, chapter_order } = chapter;

    // Lấy danh sách tất cả các chương trong truyện
    const [allChapters] = await db.query(
      `SELECT chapter_id, title, chapter_order 
       FROM chapters 
       WHERE book_id = ? 
       ORDER BY chapter_order ASC`,
      [book_id]
    );

    // Tìm chương trước
    const [prev] = await db.query(
      `SELECT chapter_id FROM chapters 
       WHERE book_id = ? AND chapter_order < ?
       ORDER BY chapter_order DESC LIMIT 1`,
      [book_id, chapter_order]
    );

    // Tìm chương sau
    const [next] = await db.query(
      `SELECT chapter_id FROM chapters 
       WHERE book_id = ? AND chapter_order > ?
       ORDER BY chapter_order ASC LIMIT 1`,
      [book_id, chapter_order]
    );

    res.json({
      title: chapter.title,
      content: chapter.content,
      chapterId: chapter.chapter_id,
      chapterOrder: chapter.chapter_order,
      book_id: chapter.book_id,
      prevChapterId: prev.length > 0 ? prev[0].chapter_id : null,
      nextChapterId: next.length > 0 ? next[0].chapter_id : null,
      allChapters: allChapters // Dùng để đổ vào dropdown
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi lấy nội dung chương' });
  }
});

// Lưu vị trí đọc cuối
router.post('/reading-history', verifyToken, async (req, res) => {
  const userId = req.user.user_id;
  const { book_id, chapter_id } = req.body;

  if (!book_id || !chapter_id) {
    return res.status(400).json({ message: 'Thiếu book_id hoặc chapter_id' });
  }

  try {
    // Kiểm tra xem đã có dòng lịch sử chưa
    const [exist] = await db.query(
      'SELECT * FROM reading_history WHERE user_id = ? AND book_id = ?',
      [userId, book_id]
    );

    if (exist.length > 0) {
      // Cập nhật
      await db.query(
        'UPDATE reading_history SET chapter_id = ?, last_read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND book_id = ?',
        [chapter_id, userId, book_id]
      );
    } else {
      // Thêm mới
      await db.query(
        'INSERT INTO reading_history (user_id, book_id, chapter_id) VALUES (?, ?, ?)',
        [userId, book_id, chapter_id]
      );
    }

    res.json({ message: 'Đã lưu vị trí đọc' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lưu vị trí đọc' });
  }
});

// Hiển thị danh sách truyện đã đọc và chương cuối cùng đang đọc đến
router.get('/reading-history', verifyToken, async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const [rows] = await db.query(`
      SELECT 
        b.book_id,
        b.title,
        b.cover_image,
        c.chapter_id,
        c.title AS chapter_title,
        rh.last_read_at
      FROM reading_history rh
      JOIN books b ON rh.book_id = b.book_id
      JOIN chapters c ON rh.chapter_id = c.chapter_id
      WHERE rh.user_id = ?
      ORDER BY rh.last_read_at DESC
    `, [user_id]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi lấy lịch sử đọc' });
  }
});

// Thêm truyện vào danh sách yêu thích
router.post('/favorites', verifyToken, async (req, res) => {
  const user_id = req.user.user_id;
  const { book_id } = req.body;

  if (!book_id) {
    return res.status(400).json({ message: 'Thiếu book_id' });
  }

  try {
    const [exist] = await db.query(
      'SELECT * FROM favorites WHERE user_id = ? AND book_id = ?',
      [user_id, book_id]
    );

    if (exist.length > 0) {
      return res.status(400).json({ message: 'Truyện đã có trong yêu thích' });
    }

    await db.query(
      'INSERT INTO favorites (user_id, book_id) VALUES (?, ?)',
      [user_id, book_id]
    );

    res.json({ message: 'Đã thêm vào danh sách yêu thích' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi thêm yêu thích' });
  }
});

// Hiển thị danh sách truyện yêu thích của người dùng
router.get('/favorites', verifyToken, async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const [rows] = await db.query(
      `SELECT b.book_id, b.title, b.cover_image, b.author, f.created_at
       FROM favorites f
       JOIN books b ON f.book_id = b.book_id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [user_id]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách yêu thích' });
  }
});

// Xoá truyện khỏi danh sách yêu thích
router.delete('/favorites/:book_id', verifyToken, async (req, res) => {
  const user_id = req.user.user_id;
  const book_id = req.params.book_id;

  try {
    await db.query(
      'DELETE FROM favorites WHERE user_id = ? AND book_id = ?',
      [user_id, book_id]
    );

    res.json({ message: 'Đã xoá khỏi danh sách yêu thích' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi xoá khỏi yêu thích' });
  }
});

// Comment:
router.post('/comments', verifyToken, async (req, res) => {
  const user_id = req.user.user_id;
  const { book_id, chapter_id, content } = req.body;

  if (!book_id || !content) {
    return res.status(400).json({ message: 'Thiếu book_id hoặc nội dung bình luận' });
  }

  try {
    // Kiểm tra book có tồn tại không
    const [bookCheck] = await db.query('SELECT book_id FROM books WHERE book_id = ?', [book_id]);
    if (bookCheck.length === 0) {
      return res.status(404).json({ message: 'Truyện không tồn tại' });
    }

    // Nếu có chapter_id, kiểm tra nó thuộc book không
    if (chapter_id) {
      const [chapterCheck] = await db.query(
        'SELECT chapter_id FROM chapters WHERE chapter_id = ? AND book_id = ?',
        [chapter_id, book_id]
      );
      if (chapterCheck.length === 0) {
        return res.status(400).json({ message: 'Chương không hợp lệ hoặc không thuộc truyện' });
      }
    }

    // Thêm bình luận
    await db.query(
      'INSERT INTO comments (user_id, book_id, chapter_id, content) VALUES (?, ?, ?, ?)',
      [user_id, book_id, chapter_id || null, content]
    );

    res.json({ message: 'Đã bình luận thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi thêm bình luận' });
  }
});

//Hiển thị danh sách bình luận của một truyện (hoặc chương cụ thể)
router.get('/comments', async (req, res) => {
  const { book_id, chapter_id } = req.query;

  if (!book_id) {
    return res.status(400).json({ message: 'Thiếu book_id' });
  }

  try {
    // Kiểm tra truyện có tồn tại không
    const [bookCheck] = await db.query('SELECT book_id FROM books WHERE book_id = ?', [book_id]);
    if (bookCheck.length === 0) {
      return res.status(404).json({ message: 'Truyện không tồn tại' });
    }

    // Nếu có chapter_id, kiểm tra chương có tồn tại và thuộc truyện không
    if (chapter_id) {
      const [chapterCheck] = await db.query(
        'SELECT chapter_id FROM chapters WHERE chapter_id = ? AND book_id = ?',
        [chapter_id, book_id]
      );
      if (chapterCheck.length === 0) {
        return res.status(400).json({ message: 'Chương không hợp lệ hoặc không thuộc truyện' });
      }
    }

    // Truy vấn bình luận với thông tin chương (nếu có)
    let sql = `
      SELECT 
        c.comment_id, 
        c.content, 
        c.created_at, 
        u.username, 
        u.avatar_url,
        c.chapter_id,
        ch.title as chapter_title,
        ch.chapter_order as chapterOrder
      FROM comments c
      JOIN users u ON c.user_id = u.user_id
      LEFT JOIN chapters ch ON c.chapter_id = ch.chapter_id
      WHERE c.book_id = ?
    `;
    const params = [book_id];

    if (chapter_id) {
      sql += ' AND c.chapter_id = ?';
      params.push(chapter_id);
    }

    sql += ' ORDER BY c.created_at DESC';

    const [rows] = await db.query(sql, params);
    
    // Format dữ liệu trả về để phù hợp với frontend
    const formattedComments = rows.map(row => ({
      comment_id: row.comment_id,
      content: row.content,
      created_at: row.created_at,
      username: row.username,
      avatar_url: row.avatar_url,
      chapter_id: row.chapter_id,
      chapter_title: row.chapter_title,
      chapter_order: row.chapter_order
    }));

    res.json(formattedComments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi lấy bình luận' });
  }
});

// Tìm kiếm truyện theo tiêu đề hoặc tác giả
router.get('/search', async (req, res) => {
  const query = req.query.query;

  if (!query) {
    return res.status(400).json({ message: 'Thiếu từ khóa tìm kiếm' });
  }

  try {
    const [rows] = await db.query(
      `SELECT * FROM books 
       WHERE title LIKE ? OR author LIKE ?
       ORDER BY created_at DESC`,
      [`${query}%`, `${query}%`]
    );

    // Làm sạch dữ liệu
    const cleanedRows = rows.map(row => ({
      ...row,
      title: row.title.replace(/[<>]/g, '').trim(), // Bỏ ký tự < >
      author: row.author.replace(/[<>]/g, '').trim()
    }));

    res.json(cleanedRows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi tìm kiếm truyện' });
  }
});

// Hiển thị danh sách tag kèm số lượng truyện sử dụng tag đó
router.get('/tags/with-count', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT t.tag_id, t.name, COUNT(bt.book_id) AS book_count
      FROM tags t
      LEFT JOIN book_tags bt ON t.tag_id = bt.tag_id
      GROUP BY t.tag_id, t.name
      ORDER BY book_count DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách tag' });
  }
});

// Lấy thông tin cơ bản của một cuốn sách
router.get('/basic/:bookId', async (req, res) => {
  const bookId = req.params.bookId;

  try {
    const [rows] = await db.query(
      'SELECT book_id, title, author, description, cover_image FROM books WHERE book_id = ?',
      [bookId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy truyện' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi lấy thông tin truyện' });
  }
});
module.exports = router;