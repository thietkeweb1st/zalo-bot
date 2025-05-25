# Sử dụng image Playwright chính thức, khớp với phiên bản bạn dùng
FROM mcr.microsoft.com/playwright:v1.52.0-jammy
# Bạn có thể thay v1.42.1-jammy bằng tag phiên bản Playwright mới hơn nếu muốn, 
# ví dụ v1.52.0-jammy hoặc một phiên bản LTS ổn định gần nhất.
# Quan trọng là nó phải khớp với phiên bản playwright trong package.json sau khi cài đặt.

WORKDIR /app

# Sao chép package.json và package-lock.json (nếu có)
COPY package*.json ./

# Cài đặt dependencies
# Sử dụng npm ci nếu có package-lock.json để build nhất quán
# Hoặc npm install nếu không có package-lock ban đầu
RUN if [ -f package-lock.json ]; then npm ci --only=production; else npm install --only=production; fi

# Sao chép toàn bộ code ứng dụng còn lại
COPY . .

# Lệnh để chạy ứng dụng khi container khởi động
CMD ["node", "bot.js"]