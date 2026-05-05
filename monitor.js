// monitor.js - DJI Pocket 4 标准套装中国站终极稳定版
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const axios = require("axios");
const express = require("express");
const fs = require("fs");
const path = require("path");

const PRODUCT = {
    name: "Pocket 4 标准套装",
    url: "https://store.dji.com/cn/product/osmo-pocket-4"
};

const PUSH_TOKEN = process.env.PUSH_TOKEN; // 必填：PushPlus token
const PORT = process.env.PORT || 3000;
const CHECK_INTERVAL_MS = 1000; // 1秒循环

// --------------------------
// 状态面板
// --------------------------
const app = express();
let state = {
    name: PRODUCT.name,
    url: PRODUCT.url,
    inStock: false,
    lastCheck: null
};

app.get("/", (req, res) => res.json(state));
app.get("/status", (req, res) => {
    res.send(`
        <h2>DJI Pocket 4 标准套装监控状态</h2>
        <p>运行中: true</p>
        <p>最后检测: ${state.lastCheck}</p>
        <p>有货状态: ${state.inStock}</p>
    `);
});
app.listen(PORT, () => console.log(`📊 状态面板启动端口: ${PORT}`));

// --------------------------
// 异常守护
// --------------------------
process.on("uncaughtException", (err) => {
    console.log("❌ 未捕获错误:", err);
    process.exit(1);
});
process.on("unhandledRejection", (err) => {
    console.log("❌ Promise 错误:", err);
    process.exit(1);
});

// --------------------------
// 微信推送
// --------------------------
async function sendPushPlusNotification(title, content) {
    if (!PUSH_TOKEN) return;
    try {
        await axios.get("https://www.pushplus.plus/send", {
            params: { token: PUSH_TOKEN, title, content }
        });
        console.log("📲 PushPlus 已发送:", title);
    } catch (e) {
        console.log("❌ PushPlus 发送失败:", e.message);
    }
}

// --------------------------
// Puppeteer 检测函数
// --------------------------
async function checkStock(page) {
    try {
        await page.goto(PRODUCT.url, { waitUntil: "networkidle2" });
        await page.waitForTimeout(2000);

        const inStock = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll("button"));
            return buttons.some(b =>
                b.innerText.includes("加入购物车") || b.innerText.includes("立即购买")
            );
        });

        // 更新状态
        state.inStock = inStock;
        state.lastCheck = new Date().toISOString();

        // 有货时通知
        if (inStock) {
            console.log(`🔥 有货: ${PRODUCT.name}`);
            await sendPushPlusNotification(`🔥 ${PRODUCT.name} 有货`, `<a href="${PRODUCT.url}">点击购买</a>`);

            // 截图记录库存状态
            const screenshotPath = path.join(__dirname, `${PRODUCT.name.replace(/ /g,"_")}_${Date.now()}.png`);
            await page.screenshot({ path: screenshotPath });
            console.log("📷 已截图:", screenshotPath);
        } else {
            console.log(`⏳ 无货 - ${state.lastCheck}`);
        }

        return inStock;
    } catch (e) {
        console.log("⚠️ 检测失败:", e.message);
        return false;
    }
}

// --------------------------
// 主函数
// --------------------------
(async () => {
    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: "new"
    });

    const page = await browser.newPage();
    console.log("🚀 DJI Pocket 4 标准套装监控启动...");

    const delay = ms => new Promise(r => setTimeout(r, ms));

    while (true) {
        const start = Date.now();
        await checkStock(page);
        const elapsed = Date.now() - start;
        await delay(Math.max(CHECK_INTERVAL_MS - elapsed, 0));
        console.log("💓 心跳 -", new Date().toISOString());
    }
})();