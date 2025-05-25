// File: bot.js (PHIÊN BẢN CHẠY HEADLESS TRONG DOCKER)
const { chromium } = require('playwright');
const path = require('path');
const config = require('./config.json'); // Sẽ dùng sau cho URL webhook
// const axios = require('axios'); // Sẽ dùng sau khi gửi tin đến n8n

async function main() {
  console.log('🚀 Bot Zalo cá nhân đang khởi động (chế độ headless)...');
  let browserContext;

  try {
    console.log('⏳ Khởi tạo browser context...');
    browserContext = await chromium.launchPersistentContext(path.resolve('./session'), {
      headless: true, // QUAN TRỌNG: Chạy không giao diện
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu', // Cần thiết cho môi trường server/headless
        '--window-size=1280,800'
      ],
      viewport: { width: 1280, height: 800 } // Vẫn nên giữ viewport để đảm bảo layout nhất quán
    });
    console.log('✅ Browser context đã sẵn sàng.');

    let page;
    const pages = browserContext.pages();
    // Cố gắng tìm trang Zalo đã có từ session
    const zaloPageFromSession = pages.find(p => p.url().includes('chat.zalo.me') && !p.isClosed());

    if (zaloPageFromSession) {
      console.log('ℹ️ Sử dụng lại trang Zalo đã mở từ session.');
      page = zaloPageFromSession;
      await page.bringToFront();
      // Có thể cần reload nhẹ để đảm bảo trang được "đánh thức" đúng cách trong môi trường mới
      try {
        console.log('⏳ Đang làm mới trang Zalo từ session...');
        await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
      } catch (reloadError) {
        console.warn(`⚠️ Không thể reload trang Zalo từ session: ${reloadError.message}. Tiếp tục với trang hiện tại.`);
      }
    } else {
      console.log('ℹ️ Tạo trang mới và điều hướng đến Zalo.');
      page = await browserContext.newPage();
    }

    // Nếu URL hiện tại không phải Zalo chat, hoặc là trang mới, thì điều hướng
    if (!page.url().includes('chat.zalo.me')) {
        console.log('⏳ Đang điều hướng đến Zalo Web: https://chat.zalo.me');
        await page.goto('https://chat.zalo.me', { waitUntil: 'networkidle', timeout: 60000 });
    }
    
    console.log(`✅ Đã tải trang Zalo ban đầu: ${page.url()}`);

    // ===== XỬ LÝ DIALOG "ĐỔI THIẾT BỊ" (NẾU CÓ) =====
    try {
      // ⬇️⬇️⬇️ QUAN TRỌNG: Đảm bảo selector này chính xác cho nút "Đã hiểu" ⬇️⬇️⬇️
      // Bạn có thể đã tìm được selector này ở bước trước khi xử lý lỗi timeout.
      const daHieuButtonSelector = 'button:has-text("Đã hiểu")'; // HOẶC SELECTOR CHÍNH XÁC BẠN TÌM ĐƯỢC
      
      console.log('ℹ️ Đang kiểm tra dialog "Đổi thiết bị" (chờ tối đa 15 giây)...');
      await page.waitForSelector(daHieuButtonSelector, { timeout: 15000 }); 
      console.log('✅ Phát hiện dialog "Đổi thiết bị". Đang nhấp "Đã hiểu"...');
      await page.locator(daHieuButtonSelector).click();
      console.log('👍 Đã nhấp "Đã hiểu".');
      await page.waitForTimeout(3000); // Chờ dialog biến mất
    } catch (dialogError) {
      console.log('🤔 Không tìm thấy dialog "Đổi thiết bị" hoặc đã hết thời gian chờ (điều này có thể bình thường nếu session vẫn tốt).');
    }
    // ===== KẾT THÚC XỬ LÝ DIALOG =====
    
    // Chờ giao diện chính của Zalo load xong
    try {
      await page.waitForSelector('div.ConvList', { timeout: 60000 }); 
      console.log('✅ Zalo đã tải xong và sẵn sàng (đã vào giao diện chính).');
    } catch (e) {
      console.error('❌ Không thể vào được giao diện chính của Zalo (không tìm thấy "div.ConvList").');
      console.error('   Lý do có thể là: Session không hợp lệ, Zalo yêu cầu đăng nhập/xác minh lại, hoặc selector "div.ConvList" đã thay đổi.');
      await page.screenshot({ path: 'error_main_interface_load.png' }); 
      console.log('📷 Ảnh chụp màn hình lỗi đã lưu tại error_main_interface_load.png (trong thư mục ./app của container).');
      throw e; // Ném lỗi ra ngoài để dừng bot nếu không vào được
    }
    
    console.log('🤖 Zalo Bot bắt đầu vòng lặp hoạt động...');

    // Vòng lặp chính của bot (hiện tại chỉ là log, sẽ thêm chức năng sau)
    while (true) {
      try {
        console.log(`[${new Date().toLocaleString()}] Bot đang hoạt động... (Sẽ thêm logic đọc tin nhắn ở đây)`);
        
        // ===== NƠI THÊM LOGIC ĐỌC TIN NHẮN VÀ GỬI ĐẾN N8N =====
        // Ví dụ:
        // const unreadMessages = await readUnreadMessages(page);
        // if (unreadMessages.length > 0) {
        //   await sendToN8N(unreadMessages);
        // }
        // ======================================================

        // Chờ một khoảng thời gian trước khi kiểm tra lại
        await page.waitForTimeout(config.zalo_poll_interval_ms || 10000); 

      } catch (loopError) {
        console.error('❌ Lỗi trong vòng lặp chính của bot:', loopError.message);
        // Cân nhắc việc chụp ảnh màn hình hoặc xử lý lỗi cụ thể ở đây
        // Để tránh dừng bot hoàn toàn, có thể chỉ log lỗi và tiếp tục
        if (page.isClosed() || !browserContext.isConnected()) {
            console.error("❌ Trang hoặc browser context đã bị đóng! Khởi động lại bot có thể cần thiết.");
            throw loopError; // Ném lỗi ra ngoài để restart policy của Docker xử lý
        }
        await page.waitForTimeout(15000); // Chờ một chút trước khi thử lại vòng lặp
      }
    }

  } catch (error) {
    console.error('❌ Lỗi nghiêm trọng ở tầng ngoài cùng:', error);
    // Lỗi ở đây thường sẽ khiến container dừng và được restart theo policy (nếu có)
  } finally {
    if (browserContext) {
      console.log('🏁 Đang đóng browser context...');
      await browserContext.close();
      console.log('✅ Browser context đã được đóng.');
    }
    console.log('👋 Bot Zalo đã kết thúc phiên này.');
    // Trong Docker, nếu script kết thúc, container sẽ dừng (và có thể restart).
  }
}

main();