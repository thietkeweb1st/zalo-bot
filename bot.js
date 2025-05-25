// File: bot.js (PHIÊN BẢN ĐỂ HIỂN THỊ TRÌNH DUYỆT TRONG DOCKER, ĐĂNG NHẬP/XỬ LÝ DIALOG THỦ CÔNG)
const { chromium } = require('playwright');
const path = require('path');
const http = require('http'); 
const config = require('./config.json'); 
const axios = require('axios'); 

let globalPage; 

async function detectAndHandleDaHieuDialog(page) {
  const selectorsToTry = [
    { type: 'role', role: 'button', name: 'Đã hiểu', description: 'getByRole("button", { name: "Đã hiểu" })' },
    { type: 'text', text: 'Đã hiểu', exact: true, description: 'getByText("Đã hiểu", { exact: true })' },
    { type: 'css', selector: 'button:has-text("Đã hiểu")', description: 'CSS selector "button:has-text(\\"Đã hiểu\\")"' },
    // Bạn có thể thêm các selector cụ thể hơn bạn tìm được ở đây sau khi inspect
  ];

  for (const attempt of selectorsToTry) {
    try {
      console.log(`ℹ️ (Debug) Đang thử tìm nút "Đã hiểu" bằng: ${attempt.description}`);
      let locator;
      switch (attempt.type) {
        case 'role': locator = page.getByRole(attempt.role, { name: attempt.name }); break;
        case 'text': locator = page.getByText(attempt.text, { exact: attempt.exact }); break;
        case 'css': locator = page.locator(attempt.selector); break;
        default: continue;
      }
      await locator.waitFor({ state: 'visible', timeout: 7000 }); 
      console.log(`✅✅✅ (Debug) PHÁT HIỆN DIALOG "ĐỔI THIẾT BỊ" (bằng: ${attempt.description})!`);
      console.log('   Bây giờ bạn có thể dùng Chrome DevTools (kết nối tới http://localhost:9222) để "Inspect Element"');
      console.log('   và tìm selector CHÍNH XÁC cho nút "Đã hiểu", hoặc tự tay nhấp vào nút đó.');
      console.log('   Bot sẽ chờ ở đây 5 phút. Sau khi bạn thao tác xong, hãy Ctrl+C để dừng bot nếu cần.');
      
      // ***** PHẦN TỰ ĐỘNG CLICK SẼ ĐƯỢC BỎ COMMENT VÀ CẬP NHẬT SELECTOR SAU KHI BẠN DEBUG *****
      // const correctDaHieuSelector = "YOUR_CORRECT_SELECTOR_HERE"; // << THAY THẾ SAU KHI DEBUG
      // await page.locator(correctDaHieuSelector).click({ timeout: 5000 }); 
      // console.log('   (Đã thử click bằng selector đúng)');
      // await page.waitForTimeout(3000); 
      // return true; 
      // ***************************************************************************************

      await page.waitForTimeout(300000); // Chờ 5 phút để bạn inspect/click thủ công
      return true; 

    } catch (error) {
      // Bỏ qua lỗi nếu không tìm thấy bằng selector này, thử cách khác
    }
  }
  console.log('🤔 (Debug) Không phát hiện được dialog "Đổi thiết bị" bằng các selector thử nghiệm, hoặc dialog không xuất hiện trong 7 giây cho mỗi selector.');
  return false; 
}

async function main() {
  console.log('🚀 Bot Zalo đang khởi động (CHẾ ĐỘ HIỂN THỊ TRÌNH DUYỆT ĐỂ THEO DÕI/ĐĂNG NHẬP)...');
  let browserContext;

  try {
    console.log('⏳ Khởi tạo browser context (có giao diện, mở port debug)...');
    browserContext = await chromium.launchPersistentContext(path.resolve('./session'), {
      headless: false, 
      args: [
        '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
        '--disable-gpu', '--window-size=1280,800',
        '--remote-debugging-port=9222',
        '--remote-debugging-address=0.0.0.0'
      ],
      viewport: { width: 1280, height: 800 } 
    });
    console.log('✅ Browser context đã sẵn sàng.');

    globalPage = browserContext.pages().length ? browserContext.pages()[0] : await browserContext.newPage();
    
    const pages = browserContext.pages(); 
    const zaloPageFromSession = pages.find(p => p.url().includes('chat.zalo.me') && !p.isClosed());

    if (zaloPageFromSession) {
      console.log('ℹ️ Sử dụng lại trang Zalo đã mở từ session.');
      globalPage = zaloPageFromSession;
      await globalPage.bringToFront();
      try {
        console.log('⏳ Đang làm mới trang Zalo từ session...');
        await globalPage.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }); 
      } catch (reloadError) {
        console.warn(`⚠️ Không thể reload trang Zalo: ${reloadError.message}.`);
      }
    } else {
      console.log('ℹ️ Tạo trang mới.');
    }

    if (!globalPage.url().includes('chat.zalo.me')) {
        console.log('⏳ Đang điều hướng đến Zalo Web: https://chat.zalo.me');
        await globalPage.goto('https://chat.zalo.me', { waitUntil: 'domcontentloaded', timeout: 90000 }); 
    }
    
    console.log(`✅ Đã tải trang Zalo ban đầu: ${globalPage.url()}`);
    console.log('👉 HÃY KẾT NỐI CHROME DEVTOOLS TỚI http://localhost:9222 NGAY BÂY GIỜ!');
    console.log('   Nếu được yêu cầu đăng nhập, hãy đăng nhập.');
    console.log('   Nếu thấy dialog "Đổi thiết bị", hãy tự tay nhấp "Đã hiểu" hoặc dùng DevTools để tìm selector của nó.');

    await detectAndHandleDaHieuDialog(globalPage);
    
    try {
      console.log('⏳ Đang chờ vào giao diện chính của Zalo (div.ConvList, tối đa 2 phút)...');
      await globalPage.waitForSelector('div.ConvList', { timeout: 120000 }); 
      console.log('✅ Đã vào giao diện chính của Zalo!');
      console.log('   Bây giờ bạn có thể theo dõi hoặc bot có thể bắt đầu các tác vụ khác.');
      console.log('   Bot sẽ tiếp tục chạy và log định kỳ. Nhấn Ctrl+C để dừng và lưu session.');
    } catch (e) {
      console.error('❌ Không vào được giao diện chính của Zalo (không tìm thấy "div.ConvList").');
      console.error('   Lý do: Chưa đăng nhập, session hết hạn, hoặc dialog "Đổi thiết bị" chưa được xử lý.');
      try {
        const screenshotPath = path.resolve(process.env.NODE_ENV === 'production' ? '/app/error_login_debug_mode.png' : 'error_login_debug_mode.png');
        await globalPage.screenshot({ path: screenshotPath }); 
        console.log(`📷 Ảnh chụp màn hình lỗi đã lưu tại: ${screenshotPath}`);
      } catch (screenshotError) {
        console.error('❌ Không thể chụp ảnh màn hình lỗi:', screenshotError.message);
      }
      console.log('   Bot sẽ chờ ở đây. Nhấn Ctrl+C để dừng và lưu session.');
      await globalPage.waitForTimeout(300000); 
    }
    
    while (true) {
      console.log(`[${new Date().toLocaleString()}] Trình duyệt của bot đang hiển thị (kết nối qua http://localhost:9222). Nhấn Ctrl+C để dừng và lưu session.`);
      await globalPage.waitForTimeout(config.zalo_poll_interval_ms || 60000); 
    }

  } catch (error) {
    console.error('❌ Lỗi nghiêm trọng (CHẾ ĐỘ HIỂN THỊ):', error.message);
    if (error.stack) {
        console.error(error.stack);
    }
  } finally {
    if (browserContext) {
      console.log('🏁 Đang đóng browser context để lưu session...');
      try {
        await browserContext.close();
        console.log('✅ Browser context đã được đóng, session đã được lưu.');
      } catch (closeError) {
        console.error('❌ Lỗi khi đóng browser context:', closeError.message);
      }
    }
    console.log('👋 Bot Zalo (CHẾ ĐỘ HIỂN THỊ) đã kết thúc.');
  }
}

main();
