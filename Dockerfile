# Sử dụng image Playwright chính thức, đảm bảo phiên bản khớp với thư viện Playwright của bạn
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Đặt thư mục làm việc mặc định
WORKDIR /app

# Chuyển sang người dùng root để cài đặt gói và ban đầu là npm install
USER root

# Cài đặt xvfb 
RUN apt-get update && \
    apt-get install -y --no-install-recommends xvfb && \
    rm -rf /var/lib/apt/lists/* # Xóa cache để giảm kích thước image

# Sao chép package.json và package-lock.json (nếu có)
COPY package*.json ./

# Cài đặt các thư viện phụ thuộc của Node.js VỚI QUYỀN ROOT
# Thêm cờ --unsafe-perm để tránh các vấn đề quyền với các script của package
RUN if [ -f package-lock.json ]; then \
      npm ci --only=production --unsafe-perm; \
    else \
      npm install --only=production --unsafe-perm; \
    fi

# Sao chép toàn bộ mã nguồn còn lại của ứng dụng vào thư mục /app
COPY . .

# SAU KHI TẤT CẢ ĐÃ ĐƯỢC COPY VÀ CÀI ĐẶT:
# Thay đổi quyền sở hữu của toàn bộ thư mục /app cho người dùng pwuser
RUN chown -R pwuser:pwuser /app

# Chuyển sang người dùng pwuser để chạy ứng dụng
USER pwuser

# Lệnh mặc định để chạy ứng dụng
# Sử dụng xvfb-run để tạo một màn hình ảo cho trình duyệt khi chạy ở chế độ không headless (headless: false)
CMD ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1280x1024x24", "node", "bot.js"]
