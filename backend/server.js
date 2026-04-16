const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Database Setup (PostgreSQL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Create Tables (Dùng Promise-based async/await cho gọn)
const initDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS students (
            id SERIAL PRIMARY KEY,
            name TEXT,
            student_id TEXT UNIQUE,
            gender TEXT,
            role TEXT,
            descriptors TEXT,
            password TEXT DEFAULT '123456'
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS attendance (
            id SERIAL PRIMARY KEY,
            student_name TEXT,
            student_id TEXT,
            role TEXT,
            time TEXT,
            date TEXT,
            subject TEXT,
            period TEXT,
            status TEXT
        )`);
        console.log("✅ Database tables checked/created.");
    } catch (err) {
        console.error("❌ Database initialization error:", err);
    }
};
initDB();

// APIs
// 1. Get all students
app.get('/api/students', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM students");
        const data = result.rows.map(r => ({
            label: r.name,
            student_id: r.student_id,
            gender: r.gender,
            role: r.role,
            password: r.password,
            descriptors: r.descriptors ? JSON.parse(r.descriptors) : []
        }));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Save student
app.post('/api/students', async (req, res) => {
    const { name, student_id, gender, role, descriptors } = req.body;
    const descriptorsStr = JSON.stringify(descriptors);

    try {
        const query = `
            INSERT INTO students (name, student_id, gender, role, descriptors)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (student_id) DO UPDATE SET 
                name = EXCLUDED.name,
                gender = EXCLUDED.gender,
                role = EXCLUDED.role,
                descriptors = EXCLUDED.descriptors
            RETURNING id;
        `;
        const result = await pool.query(query, [name, student_id, gender, role, descriptorsStr]);
        res.json({ id: result.rows[0].id, message: 'Student saved successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Delete student
app.delete('/api/students/:name', async (req, res) => {
    const name = req.params.name;
    try {
        await pool.query("DELETE FROM students WHERE name = $1", [name]);
        res.json({ message: 'Student deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Save attendance
app.post('/api/attendance', async (req, res) => {
    const { name, student_id, role, time, date, subject, period, status } = req.body;

    // ĐẢM BẢO KHÔNG BỊ LỖI 500 DO UNDEFINED
    const s_id = student_id || "KHÔNG_CÓ_MÃ";
    const p_id = period || "Ca 1";

    try {
        // KIỂM TRA TRÙNG LẶP: 1 sinh viên - 1 ngày - 1 ca - 1 môn
        const checkResult = await pool.query(
            "SELECT id FROM attendance WHERE student_id = $1 AND date = $2 AND period = $3 AND subject = $4",
            [s_id, date, p_id, subject]
        );

        if (checkResult.rows.length > 0) {
            console.log(`⚠️ Từ chối điểm danh trùng lặp: ${name} [${s_id}] - ${p_id} - ${date}`);
            return res.status(409).json({ message: 'Bạn đã điểm danh môn này trong ca này rồi!' });
        }

        const result = await pool.query(
            "INSERT INTO attendance (student_name, student_id, role, time, date, subject, period, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
            [name, s_id, role, time, date, subject, p_id, status]
        );
        res.json({ id: result.rows[0].id, message: 'Attendance logged successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Get all attendance
app.get('/api/attendance', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM attendance ORDER BY id DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Clear only attendance
app.delete('/api/attendance', async (req, res) => {
    try {
        await pool.query("DELETE FROM attendance");
        res.json({ message: 'Attendance logs cleared successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Clear everything (Old)
app.delete('/api/clear-all', async (req, res) => {
    try {
        await pool.query("BEGIN");
        await pool.query("DELETE FROM students");
        await pool.query("DELETE FROM attendance");
        await pool.query("COMMIT");
        res.json({ message: 'All data cleared' });
    } catch (err) {
        await pool.query("ROLLBACK");
        res.status(500).json({ error: err.message });
    }
});

// 8. Forgot Password - Gửi mail thật
const otpStore = {}; // Lưu tạm mã OTP: { student_id: { otp, email, timestamp } }

app.post('/api/forgot-password', async (req, res) => {
    const { email, studentName, studentId } = req.body;

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return res.status(503).json({ message: 'Tính năng gửi Email chưa được cấu hình trên Server (Thiếu EMAIL_USER/PASS).' });
    }

    // Tạo mã OTP ngẫu nhiên 6 số
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Lưu vào bộ nhớ tạm (hết hạn sau 15 phút)
    otpStore[studentId] = {
        otp,
        email,
        timestamp: Date.now()
    };

    // Cấu hình dịch vụ gửi thư
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: `"Hệ thống FaceID PTIT" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `[PTIT FaceID] Mã xác thực OTP cho sinh viên ${studentName}`,
        html: `
            <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px; max-width: 600px;">
                <h2 style="color: #c8102e;">Học viện Công nghệ Bưu chính Viễn thông</h2>
                <p>Xin chào <strong>${studentName}</strong> (${studentId}),</p>
                <p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng sử dụng mã OTP bên dưới:</p>
                <div style="background: #f4f4f4; padding: 20px; border-left: 5px solid #c8102e; margin: 20px 0; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #666;">Mã xác thực (OTP):</p>
                    <h1 style="margin: 10px 0; color: #c8102e; letter-spacing: 10px; font-size: 32px;">${otp}</h1>
                    <p style="margin: 0; font-size: 12px; color: #999;">(Mã này có hiệu lực trong vòng 15 phút)</p>
                </div>
                <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
                <hr style="border: 0; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #888; text-align: center;">Hệ thống điểm danh thông minh AI - PTIT 2026</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ message: 'Email đã được gửi thành công!' });
    } catch (err) {
        console.error("❌ Mail error:", err);
        res.status(500).json({ message: 'Lỗi khi gửi email: ' + err.message });
    }
});

// API xác thực OTP
app.post('/api/verify-otp', async (req, res) => {
    const { studentId, otp } = req.body;
    const storedData = otpStore[studentId];

    if (!storedData) {
        return res.status(400).json({ message: 'Không tìm thấy yêu cầu khôi phục hoặc mã đã hết hạn.' });
    }

    // Kiểm tra thời gian hết hạn (15 phút = 900,000 ms)
    if (Date.now() - storedData.timestamp > 900000) {
        delete otpStore[studentId];
        return res.status(400).json({ message: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.' });
    }

    if (storedData.otp === otp) {
        // Nếu đúng mã, ở bản demo này mình sẽ trả về mật khẩu giả lập
        // Trong thực tế sẽ chuyển sang trang đổi mật khẩu mới
        delete otpStore[studentId];
        res.json({ 
            success: true, 
            message: 'Xác thực thành công!',
            tempPassword: studentId // Trả về mật khẩu tạm là mã sinh viên
        });
    } else {
        res.status(400).json({ message: 'Mã OTP không chính xác. Vui lòng thử lại.' });
    }
});

// 9. Đổi mật khẩu sinh viên
app.post('/api/change-password', async (req, res) => {
    const { studentId, oldPassword, newPassword } = req.body;

    try {
        // Kiểm tra mật khẩu cũ
        const user = await pool.query("SELECT password FROM students WHERE student_id = $1", [studentId]);
        
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy thông tin sinh viên.' });
        }

        if (user.rows[0].password !== oldPassword) {
            return res.status(401).json({ message: 'Mật khẩu cũ không chính xác.' });
        }

        // Cập nhật mật khẩu mới
        await pool.query("UPDATE students SET password = $1 WHERE student_id = $2", [newPassword, studentId]);
        res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

if (!process.env.DATABASE_URL) {
    console.error("❌ CRITICAL: DATABASE_URL is not set in environment variables!");
}

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

// Cho phép Vercel nhận diện app làm Serverless Function
module.exports = app;
