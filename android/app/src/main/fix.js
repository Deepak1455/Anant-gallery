const fs = require('fs');
const path = require('path');

const LIVE_URL = 'https://anant-gallery.vercel.app';

// 1. index.html से stray '==' और npm वाला टेक्स्ट हटाएं
let htmlPath = path.join(__dirname, 'index.html');
if (fs.existsSync(htmlPath)) {
    let content = fs.readFileSync(htmlPath, 'utf8');
    content = content.replace(/==/g, '');
    content = content.replace(/npm\s+install[\s\S]*?@capacitor\/android/gi, '');
    content = content.replace(/npm\s+install[^\n<]*/gi, '');
    content = content.replace(/@capacitor\/core[^\n<]*/gi, '');
    content = content.replace(/@capacitor\/cli[^\n<]*/gi, '');
    content = content.replace(/@capacitor\/android[^\n<]*/gi, '');
    fs.writeFileSync(htmlPath, content);
    console.log('✅ index.html cleaned (stray text & == removed)!');
}

// 2. app-screen.js से "Install App" बैनर हमेशा के लिए बंद करें
let appScreenPath = path.join(__dirname, 'app-screen.js');
if (fs.existsSync(appScreenPath)) {
    let content = fs.readFileSync(appScreenPath, 'utf8');
    content = content.replace(/==/g, '');
    content = content.replace(
        /export function checkAndRenderPWAInstallBanner\(\) \{[\s\S]*?\n\}/,
        'export function checkAndRenderPWAInstallBanner() { return; }'
    );
    fs.writeFileSync(appScreenPath, content);
    console.log('✅ app-screen.js updated (Install banner disabled)!');
}

// 3. albums.js से '==' हटाएं और एल्बम कवर्स ठीक करें
let albPath = path.join(__dirname, 'albums.js');
if (fs.existsSync(albPath)) {
    let content = fs.readFileSync(albPath, 'utf8');
    content = content.replace(/==/g, '');
    content = content.replace(/<img src="\${cover}"/g, `<img src="\${(cover && cover.startsWith('/api/')) ? '${LIVE_URL}' + cover : cover}"`);
    content = content.replace(/<img src="\${coverImage}"/g, `<img src="\${(coverImage && coverImage.startsWith('/api/')) ? '${LIVE_URL}' + coverImage : coverImage}"`);
    fs.writeFileSync(albPath, content);
    console.log('✅ albums.js updated (covers fixed)!');
}

// 4. telegram-photo.js से '==' हटाएं
let tgPath = path.join(__dirname, 'telegram-photo.js');
if (fs.existsSync(tgPath)) {
    let content = fs.readFileSync(tgPath, 'utf8');
    content = content.replace(/==/g, '');
    content = content.replace(/const UPLOAD_API_ENDPOINT\s*=\s*["'][^"']+["']/g, `const UPLOAD_API_ENDPOINT = "${LIVE_URL}/api/upload"`);
    content = content.replace(/\/api\/upload\?file_id=/g, `${LIVE_URL}/api/upload?file_id=`);
    fs.writeFileSync(tgPath, content);
    console.log('✅ telegram-photo.js verified!');
}

// 5. gallery-card.js से '==' हटाएं
let gcPath = path.join(__dirname, 'gallery-card.js');
if (fs.existsSync(gcPath)) {
    let content = fs.readFileSync(gcPath, 'utf8');
    content = content.replace(/==/g, '');
    content = content.replace(/<img src="\${data\.image}"/g, `<img src="\${(data.image && data.image.startsWith('/api/')) ? '${LIVE_URL}' + data.image : data.image}"`);
    content = content.replace(/imgEl\.src = `\/api\/upload/g, `imgEl.src = \`${LIVE_URL}/api/upload`);
    content = content.replace(/\/api\/upload\?file_id=/g, `${LIVE_URL}/api/upload?file_id=`);
    fs.writeFileSync(gcPath, content);
    console.log('✅ gallery-card.js verified!');
}

// 6. app.js और style.css से '==' हटाएं
['app.js', 'style.css'].forEach(file => {
    let p = path.join(__dirname, file);
    if (fs.existsSync(p)) {
        let c = fs.readFileSync(p, 'utf8').replace(/==/g, '');
        fs.writeFileSync(p, c);
    }
});

console.log('🎉 ALL SCREENS CLEANED & FIXED!');