const puppeteer = require("puppeteer");
const axios = require("axios");

const URL = "https://store.dji.com/cn/product/osmo-pocket-4";

const PUSH_TOKEN = process.env.PUSH_TOKEN;

async function sendNotification() {
    await axios.get("https://www.pushplus.plus/send", {
        params: {
            token: PUSH_TOKEN,
            title: "🔥 DJI Pocket 4 有货了！",
            content: `<a href="${URL}">点击立即购买</a>`
        }
    });
}

async function checkStock(page) {
    await page.goto(URL, { waitUntil: "networkidle2" });

    await page.waitForTimeout(4000);

    return await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        return buttons.some(b =>
            b.innerText.includes("加入购物车") ||
            b.innerText.includes("立即购买")
        );
    });
}

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    console.log("🚀 监控启动...");

    while (true) {
        try {
            const inStock = await checkStock(page);

            if (inStock) {
                console.log("🔥 有货！");
                await sendNotification();
                break;
            } else {
                console.log("⏳ 无货");
            }
        } catch (e) {
            console.log("❌ 错误，重试");
        }

        await new Promise(r => setTimeout(r, 10000));
    }

    await browser.close();
})();
process.on("uncaughtException", (err) => {
    console.log("❌ 未捕获错误:", err);
    process.exit(1);
});

process.on("unhandledRejection", (err) => {
    console.log("❌ Promise错误:", err);
    process.exit(1);
});
console.log("💓 monitor alive -", new Date().toISOString());
const express = require("express");
const app = express();

let state = {
    running: true,
    lastCheck: null,
    inStock: false
};

app.get("/", (req, res) => {
    res.json(state);
});

app.get("/status", (req, res) => {
    res.send(`
        <h2>DJI Monitor Status</h2>
        <p>Running: ${state.running}</p>
        <p>Last Check: ${state.lastCheck}</p>
        <p>In Stock: ${state.inStock}</p>
    `);
});

app.listen(process.env.PORT || 3000, () => {
    console.log("📊 status panel running");
});
state.lastCheck = new Date().toISOString();
state.inStock = inStock;