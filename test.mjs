import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => {
        console.log('BROWSER_LOG:', msg.text());
    });
    
    page.on('pageerror', err => {
        console.error('BROWSER_ERROR:', err);
    });

    try {
        await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });
    } catch (e) {
        console.log('Nav error:', e);
    }
    
    await browser.close();
    process.exit(0);
})();
