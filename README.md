# Hệ thống điểm danh nhận diện khuôn mặt (FaceID)

Dự án này là một hệ thống điểm danh tự động thông qua nhận diện khuôn mặt, kết hợp với cơ sở dữ liệu trên đám mây để lưu trữ thông tin sinh viên và lịch sử điểm danh.

## Cấu trúc dự án
- \`backend/\`: Chứa file \`server.js\` khai báo và xử lý logic kết nối máy chủ / API.
- \`frontend/\`: Chứa giao diện website tĩnh (HTML, CSS, JavaScript, v.v).
- \`package.json\`: Khai báo các thư viện phụ thuộc (Node modules).
- \`.env\`: File chứa thông tin bảo mật và chuỗi kết nối cơ sở dữ liệu (không được đẩy lên Git).

## 🗄️ Thông tin Cơ sở dữ liệu (Database)
Dự án **KHÔNG GỒM FILE DB VẬT LÝ** ở máy cục bộ. Toàn bộ dữ liệu được quản lý trên máy chủ đám mây sử dụng hệ quản trị **PostgreSQL**.

### Tra cứu Database 
- **Dịch vụ Hosting:** [Neon Postgres](https://neon.tech/)
- **Project Database Name:** \`ep-billowing-tooth-addz2510\`
- **Database User:** \`neondb_owner\`

### Hướng dẫn kết nối Database
Để phần mềm chạy được, server cần biết vị trí của DB thông qua file \`.env\`:
1. Tạo một file \`.env\` đặt ở thư mục gốc (nếu chưa có).
2. Viết đường dẫn kết nối do chủ DB (trên trang chủ Neon) cung cấp vào file như sau:

\`\`\`env
# Cấu hình mẫu cho file .env
DATABASE_URL=postgresql://neondb_owner:<MẬT_KHẨU>@ep-billowing-tooth-addz2510-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
PORT=3000
\`\`\`

*(Lưu ý: Mật khẩu nằm trong đoạn text kết nối bị ẩn `<MẬT_KHẨU>`. Hãy hỏi người quản trị web hoặc vào Neon Copy nguyên dòng để sử dụng).*

---

## 🚀 Cài đặt và Khởi chạy hệ thống
Truy cập thư mục mã nguồn bằng Terminal và chạy các lệnh sau:

\`\`\`bash
# 1. Cài đặt các thư viện Node.js cần thiết
npm install

# 2. Khởi chạy máy chủ Node
npm start
\`\`\`

Sau khi hiện thông báo thành công, mở trình duyệt web và truy cập \`http://localhost:3000\` để sử dụng website.
