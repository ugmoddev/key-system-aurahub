// backend/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config();

// ================================================================
// 📌 CÀI ĐẶT (Settings)
// ================================================================
const SETTINGS = {
    EXPIRE_TIME_MINUTES: 100,
    WHITELIST_IPS: ['14.162.99.92'],
    KEY_PREFIX: 'AuraHub',
    ACCESS_KEY_PREFIX: 'AuraHub-Access',
    MAX_LOGS: null,
    ONE_KEY_PER_IP: true,
    DEBUG: true,
    API_SECRET_KEY: process.env.API_SECRET_KEY || 'default-secret-key-change-me',
    SERVE_HTML: true,
    ALLOWED_REFERRERS: [
        'https://onthitracnghiem.com'
    ],
    ALLOWED_DOMAIN: 'https://key-system-aurahub.onrender.com/'
};

// ================================================================
// KHỞI TẠO TỪ SETTINGS
// ================================================================
const EXPIRE_TIME = SETTINGS.EXPIRE_TIME_MINUTES * 60 * 1000;
const WHITELIST_IPS = SETTINGS.WHITELIST_IPS;
const KEY_PREFIX = SETTINGS.KEY_PREFIX;
const ACCESS_KEY_PREFIX = SETTINGS.ACCESS_KEY_PREFIX;
const MAX_LOGS = SETTINGS.MAX_LOGS;
const ONE_KEY_PER_IP = SETTINGS.ONE_KEY_PER_IP;
const DEBUG = SETTINGS.DEBUG;
const API_SECRET = SETTINGS.API_SECRET_KEY;
const SERVE_HTML = SETTINGS.SERVE_HTML;
const ALLOWED_REFERRERS = SETTINGS.ALLOWED_REFERRERS;
const ALLOWED_DOMAIN = SETTINGS.ALLOWED_DOMAIN;

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ================================================================
// CORS CONFIG
// ================================================================
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (origin === ALLOWED_DOMAIN || 
            origin === 'https://key-system-aurahub.onrender.com' ||
            origin === 'http://localhost:3000' || 
            origin === 'http://localhost:5500' ||
            origin === 'http://127.0.0.1:5500') {
            callback(null, true);
        } else {
            if (DEBUG) console.log(`⛔ CORS blocked: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json());

// ================================================================
// HÀM KIỂM TRA IP WHITELIST
// ================================================================
function isWhitelisted(ip) {
    return WHITELIST_IPS.includes(ip);
}

// ================================================================
// PHỤC VỤ FILE HTML
// ================================================================
if (SERVE_HTML) {
    const frontendPath = path.join(__dirname, '../frontend');
    
    function checkHtmlReferrer(req, res, next) {
        if (req.path.startsWith('/api/')) {
            return next();
        }
        return next();
    }
    
    app.use(checkHtmlReferrer);
    
    if (fs.existsSync(frontendPath)) {
        app.use(express.static(frontendPath));
        
        app.get('/index.html', (req, res) => {
            const indexPath = path.join(frontendPath, 'index.html');
            if (fs.existsSync(indexPath)) {
                res.sendFile(indexPath);
            } else {
                res.status(404).json({ 
                    success: false, 
                    message: 'index.html not found' 
                });
            }
        });
        
        app.get('/admin.html', (req, res) => {
            const adminPath = path.join(frontendPath, 'admin.html');
            if (fs.existsSync(adminPath)) {
                res.sendFile(adminPath);
            } else {
                res.status(404).json({ 
                    success: false, 
                    message: 'admin.html not found' 
                });
            }
        });
        
        app.get('/', (req, res) => {
            const indexPath = path.join(frontendPath, 'index.html');
            if (fs.existsSync(indexPath)) {
                res.sendFile(indexPath);
            } else {
                res.json({
                    message: '🚀 API Key Manager is running!',
                    version: '1.0.0',
                    status: 'online',
                    environment: NODE_ENV,
                    config: {
                        expire_time: `${EXPIRE_TIME/60000} minutes`,
                        max_logs: MAX_LOGS || 'unlimited',
                        one_key_per_ip: ONE_KEY_PER_IP,
                        key_format: `${KEY_PREFIX}-xxxxxxxxxxxxxxxx`,
                        access_key_format: `${ACCESS_KEY_PREFIX}-[80 ký tự hỗn hợp + timestamp]`
                    },
                    endpoints: {
                        root: '/',
                        health: '/api/health',
                        logs: '/api/logs',
                        keys: '/api/keys',
                        access: '/api/access (GET)',
                        request: '/api/request (GET - cần access key)',
                        stats: '/api/stats',
                        html: '/index.html',
                        admin: '/admin.html',
                        dashboard: '/dashboard',
                        checkBrowser: '/api/check-browser',
                        howtouse: '/howtouse'
                    },
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        if (DEBUG) console.log(`📁 Phục vụ file HTML từ: ${frontendPath}`);
    } else {
        if (DEBUG) console.log(`⚠️ Thư mục frontend không tồn tại: ${frontendPath}`);
        
        app.get('/', (req, res) => {
            res.json({
                message: '🚀 API Key Manager is running!',
                version: '1.0.0',
                status: 'online',
                environment: NODE_ENV,
                config: {
                    expire_time: `${EXPIRE_TIME/60000} minutes`,
                    max_logs: MAX_LOGS || 'unlimited',
                    one_key_per_ip: ONE_KEY_PER_IP,
                    key_format: `${KEY_PREFIX}-xxxxxxxxxxxxxxxx`,
                    access_key_format: `${ACCESS_KEY_PREFIX}-[80 ký tự hỗn hợp + timestamp]`
                },
                endpoints: {
                    root: '/',
                    health: '/api/health',
                    logs: '/api/logs',
                    keys: '/api/keys',
                    access: '/api/access (GET)',
                    request: '/api/request (GET - cần access key)',
                    stats: '/api/stats',
                    checkBrowser: '/api/check-browser',
                    howtouse: '/howtouse'
                },
                note: 'Frontend folder not found. Please add frontend/index.html',
                timestamp: new Date().toISOString()
            });
        });
    }
}

// ================================================================
// DASHBOARD - Trang thống kê chi tiết (CHỈ WHITELIST IP)
// ================================================================
app.get('/dashboard', (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     '0.0.0.0';
    
    const cleanIP = clientIP.replace('::ffff:', '').replace('::1', '127.0.0.1').split(',')[0].trim();
    
    if (!isWhitelisted(cleanIP)) {
        if (DEBUG) console.log(`⛔ IP ${cleanIP} bị từ chối truy cập /dashboard`);
        return res.status(403).json({
            success: false,
            message: 'Forbidden: Access denied. Only whitelisted IPs can access dashboard.'
        });
    }
    
    const dashboardPath = path.join(__dirname, '../frontend/dashboard.html');
    if (fs.existsSync(dashboardPath)) {
        res.sendFile(dashboardPath);
    } else {
        res.status(404).json({
            success: false,
            message: 'dashboard.html not found'
        });
    }
});

// ================================================================
// HOW TO USE - Hướng dẫn sử dụng API (CHỈ WHITELIST IP) - JSON
// ================================================================
app.get('/howtouse', (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     '0.0.0.0';
    
    const cleanIP = clientIP.replace('::ffff:', '').replace('::1', '127.0.0.1').split(',')[0].trim();
    
    if (!isWhitelisted(cleanIP)) {
        if (DEBUG) console.log(`⛔ IP ${cleanIP} bị từ chối truy cập /howtouse`);
        return res.status(403).json({
            success: false,
            message: 'Forbidden: Access denied. Only whitelisted IPs can access this page.'
        });
    }
    
    if (DEBUG) console.log(`✅ IP ${cleanIP} (whitelist) truy cập /howtouse`);
    
    res.json({
        success: true,
        message: '📖 API Key Manager - Hướng dẫn sử dụng',
        version: '1.0.0',
        server: 'https://key-system-aurahub.onrender.com',
        documentation: {
            overview: {
                title: 'Tổng quan',
                description: 'Hệ thống quản lý key API với tính năng bảo mật whitelist IP, browser fingerprint và cooldown 99 phút.',
                features: [
                    '🔐 Bảo mật whitelist IP',
                    '🖥️ Browser fingerprint - mỗi browser 1 key / 99 phút',
                    '⏱ Custom expire time (admin: tối đa 90 ngày, user: tối đa 7 ngày)',
                    '📊 Dashboard thống kê chi tiết',
                    '🔑 Tạo key tự động với access key'
                ]
            },
            endpoints: {
                health: {
                    method: 'GET',
                    url: '/api/health',
                    description: 'Kiểm tra trạng thái server',
                    example: 'curl https://key-system-aurahub.onrender.com/api/health'
                },
                access: {
                    method: 'GET',
                    url: '/api/access',
                    description: 'Lấy access key (dùng 1 lần, hết hạn sau 100 phút)',
                    example: 'curl https://key-system-aurahub.onrender.com/api/access'
                },
                request: {
                    method: 'GET',
                    url: '/api/request?access_key=YOUR_ACCESS_KEY&email=your@email.com&expire_minutes=10080&browser_id=BROWSER-xxxxx',
                    description: 'Tạo key mới (cần access key, hỗ trợ custom expire, browser cooldown)',
                    params: {
                        access_key: 'required - Access key lấy từ /api/access',
                        email: 'optional - Email người dùng (mặc định: guest@example.com)',
                        expire_minutes: 'optional - Thời gian hết hạn (phút, admin: tối đa 129600 = 90 ngày, user: tối đa 10080 = 7 ngày)',
                        browser_id: 'optional - Browser ID để áp dụng cooldown 99 phút (chỉ cho user)'
                    },
                    example: 'curl "https://key-system-aurahub.onrender.com/api/request?access_key=YOUR_ACCESS_KEY&email=test@test.com&expire_minutes=10080&browser_id=BROWSER-xxxxx"'
                },
                logs: {
                    method: 'GET',
                    url: '/api/logs',
                    description: 'Xem logs (CHỈ WHITELIST IP)',
                    example: 'curl https://key-system-aurahub.onrender.com/api/logs'
                },
                keys: {
                    method: 'GET',
                    url: '/api/keys',
                    description: 'Xem danh sách key (CHỈ WHITELIST IP)',
                    example: 'curl https://key-system-aurahub.onrender.com/api/keys'
                },
                stats: {
                    method: 'GET',
                    url: '/api/stats',
                    description: 'Xem thống kê (CHỈ WHITELIST IP)',
                    example: 'curl https://key-system-aurahub.onrender.com/api/stats'
                },
                checkBrowser: {
                    method: 'GET',
                    url: '/api/check-browser?browser_id=BROWSER-xxxxx',
                    description: 'Kiểm tra browser đã có key chưa',
                    example: 'curl "https://key-system-aurahub.onrender.com/api/check-browser?browser_id=BROWSER-xxxxx"'
                },
                dashboard: {
                    method: 'GET',
                    url: '/dashboard',
                    description: 'Dashboard thống kê (CHỈ WHITELIST IP)',
                    example: 'https://key-system-aurahub.onrender.com/dashboard'
                },
                admin: {
                    method: 'GET',
                    url: '/admin.html',
                    description: 'Trang quản trị (CHỈ WHITELIST IP) - Admin có thể tạo key lên đến 90 ngày',
                    example: 'https://key-system-aurahub.onrender.com/admin.html'
                },
                howtouse: {
                    method: 'GET',
                    url: '/howtouse',
                    description: 'Hướng dẫn sử dụng API (CHỈ WHITELIST IP)',
                    example: 'https://key-system-aurahub.onrender.com/howtouse'
                },
                deleteLogs: {
                    method: 'DELETE',
                    url: '/api/logs',
                    description: 'Xóa tất cả logs (cần Admin Key)',
                    headers: { 'X-Admin-Key': 'your-secret-key' },
                    example: 'curl -X DELETE https://key-system-aurahub.onrender.com/api/logs -H "X-Admin-Key: your-secret-key"'
                }
            },
            browser_cooldown: {
                enabled: true,
                duration: '99 phút',
                description: 'Mỗi browser chỉ được tạo 1 key trong vòng 99 phút (CHỈ CHO USER, ADMIN KHÔNG BỊ GIỚI HẠN)',
                how_it_works: 'Browser fingerprint được tạo từ User Agent, Screen, Timezone, Platform, WebGL, Fonts...',
                storage: 'Browser ID được lưu trong sessionStorage',
                admin_exception: 'Admin (whitelist IP) không bị giới hạn browser cooldown'
            },
            expire_options: {
                default: '100 phút',
                max_for_admin: '90 ngày (129600 phút)',
                max_for_user: '7 ngày (10080 phút)',
                min: '1 phút',
                note: 'Admin (whitelist IP) có thể tạo key lên đến 90 ngày, user tối đa 7 ngày'
            },
            admin_privileges: {
                unlimited_keys: 'Admin KHÔNG bị giới hạn 1 key/IP',
                no_browser_cooldown: 'Admin KHÔNG bị giới hạn browser cooldown 99 phút',
                max_expire: 'Admin có thể tạo key lên đến 90 ngày',
                access: 'Admin có quyền truy cập /admin.html, /dashboard, /howtouse, /api/logs, /api/keys'
            },
            security: {
                whitelist_ips: WHITELIST_IPS,
                cors: 'Chỉ cho phép các domain được cấu hình',
                admin_key: 'Required for DELETE operations',
                browser_fingerprint: 'Enabled - Mỗi browser 1 key / 99 phút (chỉ cho user)'
            },
            web_ui: {
                url: 'https://key-system-aurahub.onrender.com',
                admin: 'https://key-system-aurahub.onrender.com/admin.html',
                dashboard: 'https://key-system-aurahub.onrender.com/dashboard',
                description: 'Giao diện web để tạo và quản lý key'
            },
            example_workflow: {
                step1: 'Lấy access key: GET /api/access',
                step2: 'Tạo key: GET /api/request?access_key=YOUR_ACCESS_KEY&email=your@email.com&expire_minutes=10080',
                step3: 'Kiểm tra key: GET /api/logs (whitelist only)',
                step4: 'Xem dashboard: GET /dashboard (whitelist only)'
            }
        },
        timestamp: new Date().toISOString()
    });
});

// ================================================================
// API CHECK BROWSER - Kiểm tra browser đã tạo key chưa
// ================================================================
app.get('/api/check-browser', (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     '0.0.0.0';
    
    const cleanIP = clientIP.replace('::ffff:', '').replace('::1', '127.0.0.1').split(',')[0].trim();
    const browserId = req.query.browser_id || req.headers['x-browser-id'];
    
    if (!browserId) {
        return res.status(400).json({
            success: false,
            message: 'Browser ID required'
        });
    }
    
    const logs = cleanExpiredLogs();
    const now = Date.now();
    
    const browserLog = logs.find(log => {
        return log.browserId === browserId;
    });
    
    if (browserLog) {
        let expireTime;
        if (browserLog.customExpire) {
            expireTime = browserLog.customExpire;
        } else {
            const logTime = new Date(browserLog.timestamp).getTime();
            expireTime = logTime + EXPIRE_TIME;
        }
        
        const timeRemaining = expireTime - now;
        const minutesRemaining = Math.floor(timeRemaining / 60000);
        const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);
        
        if (timeRemaining > 0) {
            return res.json({
                success: true,
                hasKey: true,
                key: browserLog.key,
                expires_in: `${minutesRemaining} phút ${secondsRemaining} giây`,
                expires_at: new Date(expireTime).toISOString(),
                remaining_minutes: minutesRemaining,
                is_admin: isWhitelisted(cleanIP)
            });
        } else {
            return res.json({
                success: true,
                hasKey: false,
                message: 'Key expired, you can create a new one',
                expired: true
            });
        }
    }
    
    res.json({
        success: true,
        hasKey: false,
        message: 'No key found for this browser'
    });
});

// ================================================================
// FILE OPERATIONS
// ================================================================
const LOG_FILE = path.join(__dirname, 'ip-logs.json');
const ACCESS_FILE = path.join(__dirname, 'access-keys.json');

function readLogs() {
    try {
        if (fs.existsSync(LOG_FILE)) {
            const data = fs.readFileSync(LOG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Lỗi đọc log:', error);
    }
    return [];
}

function writeLogs(logs) {
    try {
        if (MAX_LOGS && logs.length > MAX_LOGS) {
            logs = logs.slice(0, MAX_LOGS);
        }
        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
        if (DEBUG) console.log(`✅ Đã ghi ${logs.length} logs`);
    } catch (error) {
        console.error('Lỗi ghi log:', error);
    }
}

function readAccessKeys() {
    try {
        if (fs.existsSync(ACCESS_FILE)) {
            const data = fs.readFileSync(ACCESS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Lỗi đọc access keys:', error);
    }
    return [];
}

function writeAccessKeys(keys) {
    try {
        fs.writeFileSync(ACCESS_FILE, JSON.stringify(keys, null, 2));
        if (DEBUG) console.log(`✅ Đã ghi ${keys.length} access keys`);
    } catch (error) {
        console.error('Lỗi ghi access keys:', error);
    }
}

// ================================================================
// HÀM TỰ ĐỘNG XÓA
// ================================================================
function cleanExpiredLogs() {
    const logs = readLogs();
    const now = Date.now();
    
    const validLogs = logs.filter(log => {
        if (log.customExpire) {
            return log.customExpire > now;
        }
        const logTime = new Date(log.timestamp).getTime();
        return (now - logTime) <= EXPIRE_TIME;
    });
    
    const expiredCount = logs.length - validLogs.length;
    if (expiredCount > 0) {
        writeLogs(validLogs);
        if (DEBUG) console.log(`🧹 Đã xóa ${expiredCount} IP hết hạn`);
    }
    
    return validLogs;
}

function cleanExpiredAccessKeys() {
    const keys = readAccessKeys();
    const now = Date.now();
    
    const validKeys = keys.filter(key => {
        const keyTime = new Date(key.timestamp).getTime();
        return (now - keyTime) <= EXPIRE_TIME;
    });
    
    const expiredCount = keys.length - validKeys.length;
    if (expiredCount > 0) {
        writeAccessKeys(validKeys);
        if (DEBUG) console.log(`🧹 Đã xóa ${expiredCount} access key hết hạn`);
    }
    
    return validKeys;
}

// ================================================================
// HÀM TÌM KEY THEO IP
// ================================================================
function findKeyByIP(ip) {
    const logs = readLogs();
    const now = Date.now();
    
    const validLog = logs.find(log => {
        if (log.ip !== ip) return false;
        if (log.customExpire) {
            return log.customExpire > now;
        }
        const logTime = new Date(log.timestamp).getTime();
        return (now - logTime) <= EXPIRE_TIME;
    });
    
    return validLog || null;
}

// ================================================================
// HÀM TẠO KEY
// ================================================================
function generateKey(prefix = KEY_PREFIX) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomStr = '';
    for (let i = 0; i < 16; i++) {
        randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix + '-' + randomStr;
}

// ================================================================
// HÀM TẠO ACCESS KEY
// ================================================================
function generateAccessKey() {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const specials = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
    const allChars = upper + lower + digits + specials;
    
    let randomStr = '';
    for (let i = 0; i < 80; i++) {
        if (i < 15) {
            const source = upper + digits;
            randomStr += source.charAt(Math.floor(Math.random() * source.length));
        } else if (i < 30) {
            const source = lower + digits;
            randomStr += source.charAt(Math.floor(Math.random() * source.length));
        } else if (i < 45) {
            const source = specials + digits;
            randomStr += source.charAt(Math.floor(Math.random() * source.length));
        } else {
            randomStr += allChars.charAt(Math.floor(Math.random() * allChars.length));
        }
    }
    
    const timestamp = Date.now().toString(36);
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    
    return ACCESS_KEY_PREFIX + '-' + randomStr + timestamp + randomSuffix;
}

// ================================================================
// API HEALTH
// ================================================================
app.get('/api/health', (req, res) => {
    cleanExpiredLogs();
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'API Key Manager',
        version: '1.0.0',
        environment: NODE_ENV,
        uptime: Math.floor(process.uptime()),
        config: {
            expire_time: `${EXPIRE_TIME/60000} minutes`,
            one_key_per_ip: ONE_KEY_PER_IP,
            key_format: `${KEY_PREFIX}-xxxxxxxxxxxxxxxx`,
            access_key_format: `${ACCESS_KEY_PREFIX}-[80 ký tự hỗn hợp + timestamp]`,
            max_logs: MAX_LOGS || 'unlimited',
            whitelist_ips: WHITELIST_IPS,
            serve_html: SERVE_HTML,
            allowed_domain: ALLOWED_DOMAIN,
            max_expire_days_admin: 90,
            max_expire_days_user: 7,
            browser_cooldown: '99 phút (chỉ cho user)'
        }
    });
});

// ================================================================
// API LOGS - CHỈ WHITELIST IP
// ================================================================
app.get('/api/logs', (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     '0.0.0.0';
    
    const cleanIP = clientIP.replace('::ffff:', '').replace('::1', '127.0.0.1').split(',')[0].trim();
    
    if (!isWhitelisted(cleanIP)) {
        if (DEBUG) console.log(`⛔ IP ${cleanIP} bị từ chối truy cập /api/logs`);
        return res.status(403).json({
            success: false,
            message: 'Forbidden: Access denied. Only whitelisted IPs can access logs.'
        });
    }
    
    if (DEBUG) console.log(`✅ IP ${cleanIP} (whitelist) truy cập /api/logs`);
    
    const logs = cleanExpiredLogs();
    const limit = parseInt(req.query.limit) || 50;
    const now = Date.now();
    
    const sanitizedLogs = logs.slice(0, limit).map(log => {
        let expireTime;
        let expireMinutes;
        
        if (log.customExpire) {
            expireTime = log.customExpire;
            expireMinutes = log.expireMinutes || 100;
            if (DEBUG) console.log(`✅ Key ${log.key} dùng customExpire: ${expireMinutes} phút`);
        } else {
            const logTime = new Date(log.timestamp).getTime();
            expireTime = logTime + EXPIRE_TIME;
            expireMinutes = SETTINGS.EXPIRE_TIME_MINUTES;
            if (DEBUG) console.log(`⚠️ Key ${log.key} dùng default: ${expireMinutes} phút`);
        }
        
        const timeRemaining = expireTime - now;
        const minutesRemaining = Math.floor(timeRemaining / 60000);
        const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);
        const hoursRemaining = Math.floor(minutesRemaining / 60);
        const daysRemaining = Math.floor(hoursRemaining / 24);
        
        let expireDisplay;
        if (timeRemaining <= 0) {
            expireDisplay = 'Hết hạn';
        } else if (daysRemaining > 0) {
            expireDisplay = `${daysRemaining} ngày ${hoursRemaining % 24} giờ ${minutesRemaining % 60} phút`;
        } else if (hoursRemaining > 0) {
            expireDisplay = `${hoursRemaining} giờ ${minutesRemaining % 60} phút ${secondsRemaining} giây`;
        } else {
            expireDisplay = `${minutesRemaining} phút ${secondsRemaining} giây`;
        }
        
        return {
            id: log.id,
            ip: log.ip,
            email: log.email || 'guest@example.com',
            action: log.action,
            key: log.key,
            timestamp: log.timestamp,
            method: log.method || 'GET',
            source: log.source || 'browser',
            browserId: log.browserId || null,
            is_admin: log.isAdmin || isWhitelisted(log.ip) || false,
            access_key_used: log.access_key_used ? log.access_key_used.substring(0, 30) + '...' : null,
            expires_at: new Date(expireTime).toISOString(),
            expire_minutes: expireMinutes,
            expires_in: expireDisplay,
            is_expired: timeRemaining <= 0
        };
    });
    
    res.json({
        success: true,
        data: sanitizedLogs,
        total: logs.length,
        limit: limit,
        max_logs: MAX_LOGS || 'unlimited',
        default_expire_time: `${EXPIRE_TIME/60000} minutes`,
        max_expire_days_admin: 90,
        max_expire_days_user: 7,
        browser_cooldown: '99 phút (chỉ cho user)',
        note: `Admin có thể tạo key lên đến 90 ngày, user tối đa 7 ngày`
    });
});

// ================================================================
// API KEYS (CHỈ WHITELIST IP)
// ================================================================
app.get('/api/keys', (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     '0.0.0.0';
    
    const cleanIP = clientIP.replace('::ffff:', '').replace('::1', '127.0.0.1').split(',')[0].trim();
    
    if (!isWhitelisted(cleanIP)) {
        return res.status(403).json({
            success: false,
            message: 'Forbidden: Access denied'
        });
    }
    
    const logs = cleanExpiredLogs();
    const ipKeyMap = {};
    logs.forEach(log => {
        if (!ipKeyMap[log.ip] || new Date(log.timestamp) > new Date(ipKeyMap[log.ip].timestamp)) {
            ipKeyMap[log.ip] = {
                ip: log.ip,
                key: log.key,
                timestamp: log.timestamp,
                email: log.email || 'guest@example.com',
                action: log.action,
                method: log.method || 'GET',
                source: log.source || 'browser',
                browserId: log.browserId || null,
                is_admin: log.isAdmin || isWhitelisted(log.ip) || false,
                customExpire: log.customExpire || null,
                expireMinutes: log.expireMinutes || SETTINGS.EXPIRE_TIME_MINUTES
            };
        }
    });
    
    const ipKeys = Object.values(ipKeyMap).sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    res.json({
        success: true,
        message: 'List of all IPs and their keys',
        total: ipKeys.length,
        max_logs: MAX_LOGS || 'unlimited',
        default_expire_time: `${EXPIRE_TIME/60000} minutes`,
        max_expire_days_admin: 90,
        max_expire_days_user: 7,
        browser_cooldown: '99 phút (chỉ cho user)',
        data: ipKeys
    });
});

// ================================================================
// API ACCESS
// ================================================================
app.get('/api/access', (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     '0.0.0.0';
    
    const cleanIP = clientIP.replace('::ffff:', '').replace('::1', '127.0.0.1').split(',')[0].trim();
    
    const accessKey = generateAccessKey();
    const timestamp = new Date().toISOString();
    
    const accessEntry = {
        key: accessKey,
        ip: cleanIP,
        timestamp: timestamp,
        used: false,
        expires_at: new Date(Date.now() + EXPIRE_TIME).toISOString()
    };
    
    const accessKeys = readAccessKeys();
    accessKeys.unshift(accessEntry);
    writeAccessKeys(accessKeys);
    
    if (DEBUG) console.log(`🔑 IP ${cleanIP} tạo access key: ${accessKey.substring(0, 40)}...`);
    
    res.json({
        success: true,
        message: 'Access key created successfully',
        data: {
            access_key: accessKey,
            expires_in: `${EXPIRE_TIME/60000} minutes`,
            expires_at: accessEntry.expires_at,
            note: `Access key có hiệu lực ${EXPIRE_TIME/60000} phút, dùng 1 lần để lấy key chính`,
            format: `${ACCESS_KEY_PREFIX}-[80 ký tự hỗn hợp + timestamp]`
        }
    });
});

// ================================================================
// API REQUEST (GET) - HỖ TRỢ CUSTOM EXPIRE & BROWSER ID
// ================================================================
app.get('/api/request', (req, res) => {
    const accessKey = req.query.access_key || req.headers['x-access-key'];
    
    if (!accessKey) {
        return res.status(401).json({
            success: false,
            message: 'Access key required',
            error: 'Vui lòng cung cấp access_key trong URL hoặc header X-Access-Key',
            how_to_get: 'Truy cập /api/access để lấy access key'
        });
    }
    
    const accessKeys = cleanExpiredAccessKeys();
    const validAccess = accessKeys.find(k => k.key === accessKey && !k.used);
    
    if (!validAccess) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired access key',
            error: 'Access key không hợp lệ hoặc đã được sử dụng',
            note: `Mỗi access key chỉ được sử dụng 1 lần và có hiệu lực ${EXPIRE_TIME/60000} phút`
        });
    }
    
    validAccess.used = true;
    validAccess.used_at = new Date().toISOString();
    writeAccessKeys(accessKeys);
    
    const clientIP = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     '0.0.0.0';
    
    const cleanIP = clientIP.replace('::ffff:', '').replace('::1', '127.0.0.1').split(',')[0].trim();
    cleanExpiredLogs();
    
    const isAdmin = isWhitelisted(cleanIP);
    
    // ===== LẤY CUSTOM EXPIRE TIME TỪ REQUEST =====
    let customExpireMinutes = parseInt(req.query.expire_minutes) || SETTINGS.EXPIRE_TIME_MINUTES;
    
    // Admin: tối đa 90 ngày (129600 phút), User: tối đa 7 ngày (10080 phút)
    if (isAdmin) {
        if (customExpireMinutes > 129600) customExpireMinutes = 129600;
    } else {
        if (customExpireMinutes > 10080) customExpireMinutes = 10080;
    }
    if (customExpireMinutes < 1) customExpireMinutes = 1;
    const customExpireMs = customExpireMinutes * 60 * 1000;
    
    // ===== LẤY BROWSER ID =====
    const browserId = req.query.browser_id || req.headers['x-browser-id'] || null;
    
    // ===== KIỂM TRA ONE_KEY_PER_IP - CHỈ CHO USER (KHÔNG CHO ADMIN) =====
    if (ONE_KEY_PER_IP && !isAdmin) {
        const existingLog = findKeyByIP(cleanIP);
        if (existingLog) {
            let expireTime;
            if (existingLog.customExpire) {
                expireTime = existingLog.customExpire;
            } else {
                const logTime = new Date(existingLog.timestamp).getTime();
                expireTime = logTime + EXPIRE_TIME;
            }
            const timeRemaining = expireTime - Date.now();
            const minutesRemaining = Math.floor(timeRemaining / 60000);
            const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);
            
            if (DEBUG) console.log(`⛔ IP ${cleanIP} đã có key, từ chối tạo mới`);
            
            return res.json({
                success: true,
                message: 'Key already exists for this IP',
                data: {
                    ip: cleanIP,
                    key: existingLog.key,
                    timestamp: existingLog.timestamp,
                    expires_in: `${minutesRemaining} phút ${secondsRemaining} giây`,
                    note: `Key này còn hiệu lực ${minutesRemaining} phút nữa`
                }
            });
        }
    }
    
    // ===== KIỂM TRA BROWSER COOLDOWN - CHỈ CHO USER (KHÔNG CHO ADMIN) =====
    if (!isAdmin && browserId) {
        const logs = readLogs();
        const now = Date.now();
        const existingBrowserLog = logs.find(log => {
            if (log.browserId !== browserId) return false;
            if (log.customExpire) {
                return log.customExpire > now;
            }
            const logTime = new Date(log.timestamp).getTime();
            return (now - logTime) <= EXPIRE_TIME;
        });
        
        if (existingBrowserLog) {
            let expireTime;
            if (existingBrowserLog.customExpire) {
                expireTime = existingBrowserLog.customExpire;
            } else {
                const logTime = new Date(existingBrowserLog.timestamp).getTime();
                expireTime = logTime + EXPIRE_TIME;
            }
            const timeRemaining = expireTime - now;
            const minutesRemaining = Math.floor(timeRemaining / 60000);
            
            if (DEBUG) console.log(`⛔ Browser ${browserId} đã có key, từ chối tạo mới`);
            
            return res.status(429).json({
                success: false,
                message: 'Browser already has a key',
                error: 'Mỗi browser chỉ được tạo 1 key mỗi 99 phút',
                data: {
                    key: existingBrowserLog.key,
                    expires_in: `${minutesRemaining} phút`,
                    remaining_minutes: minutesRemaining,
                    cooldown: '99 phút'
                }
            });
        }
    }
    
    // ===== TẠO KEY MỚI =====
    const newKey = generateKey();
    const timestamp = new Date().toISOString();
    const email = req.query.email || 'guest@example.com';
    const hwid = req.query.hwid || null;
    
    // ===== LƯU LOG =====
    const logEntry = {
        id: Date.now(),
        ip: cleanIP,
        email: email,
        hwid: hwid,
        browserId: browserId,
        action: isAdmin ? 'admin_generate' : 'auto_generate',
        key: newKey,
        timestamp: timestamp,
        userAgent: req.headers['user-agent'] || 'Unknown',
        method: 'GET',
        source: isAdmin ? 'admin' : 'browser',
        access_key_used: accessKey,
        customExpire: Date.now() + customExpireMs,
        expireMinutes: customExpireMinutes,
        isAdmin: isAdmin
    };
    
    const logs = readLogs();
    logs.unshift(logEntry);
    writeLogs(logs);
    
    if (DEBUG) console.log(`✅ Tạo key mới cho IP ${cleanIP}: ${newKey} (expire: ${customExpireMinutes} phút, admin: ${isAdmin})`);
    
    const responseData = {
        ip: cleanIP,
        key: newKey,
        email: email,
        timestamp: timestamp,
        expire_after: `${customExpireMinutes} minutes`,
        expire_minutes: customExpireMinutes,
        note: isAdmin 
            ? `🔑 Admin: Key có hiệu lực ${customExpireMinutes} phút (${Math.floor(customExpireMinutes/60)} giờ) - KHÔNG giới hạn 1 key/IP` 
            : `Key sẽ tự động xóa sau ${customExpireMinutes} phút (${Math.floor(customExpireMinutes/60)} giờ)`,
        access_key_used: accessKey.substring(0, 20) + '...',
        browser_id: browserId,
        is_admin: isAdmin
    };
    
    if (hwid) {
        responseData.hwid = hwid;
    }
    
    if (isAdmin) {
        responseData.whitelisted = true;
        responseData.max_expire_days = 90;
    } else {
        responseData.max_expire_days = 7;
    }
    
    res.json({
        success: true,
        message: isAdmin ? 'Key generated by Admin successfully' : 'Key generated successfully',
        data: responseData
    });
});

// ================================================================
// API REQUEST (POST) - HỖ TRỢ CUSTOM EXPIRE & BROWSER ID
// ================================================================
app.post('/api/request', (req, res) => {
    const { email, action, custom_ip, access_key, expire_minutes, hwid, browser_id } = req.body;
    
    if (!access_key) {
        return res.status(401).json({
            success: false,
            message: 'Access key required',
            error: 'Vui lòng cung cấp access_key trong body'
        });
    }
    
    const accessKeys = cleanExpiredAccessKeys();
    const validAccess = accessKeys.find(k => k.key === access_key && !k.used);
    
    if (!validAccess) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired access key'
        });
    }
    
    validAccess.used = true;
    validAccess.used_at = new Date().toISOString();
    writeAccessKeys(accessKeys);
    
    let clientIP = custom_ip || req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     '0.0.0.0';
    
    const cleanIP = clientIP.replace('::ffff:', '').replace('::1', '127.0.0.1').split(',')[0].trim();
    cleanExpiredLogs();
    
    if (email && (!email.includes('@') || !email.includes('.'))) {
        return res.status(400).json({
            success: false,
            message: 'Invalid email format'
        });
    }
    
    const isAdmin = isWhitelisted(cleanIP);
    
    // ===== LẤY CUSTOM EXPIRE TIME TỪ REQUEST =====
    let customExpireMinutes = parseInt(expire_minutes) || SETTINGS.EXPIRE_TIME_MINUTES;
    if (isAdmin) {
        if (customExpireMinutes > 129600) customExpireMinutes = 129600;
    } else {
        if (customExpireMinutes > 10080) customExpireMinutes = 10080;
    }
    if (customExpireMinutes < 1) customExpireMinutes = 1;
    const customExpireMs = customExpireMinutes * 60 * 1000;
    
    const browserId = browser_id || null;
    
    // ===== KIỂM TRA ONE_KEY_PER_IP - CHỈ CHO USER =====
    if (ONE_KEY_PER_IP && !isAdmin) {
        const existingLog = findKeyByIP(cleanIP);
        if (existingLog) {
            let expireTime;
            if (existingLog.customExpire) {
                expireTime = existingLog.customExpire;
            } else {
                const logTime = new Date(existingLog.timestamp).getTime();
                expireTime = logTime + EXPIRE_TIME;
            }
            const timeRemaining = expireTime - Date.now();
            const minutesRemaining = Math.floor(timeRemaining / 60000);
            
            if (DEBUG) console.log(`⛔ IP ${cleanIP} đã có key (POST), từ chối tạo mới`);
            
            return res.json({
                success: true,
                message: 'Key already exists for this IP',
                data: {
                    ip: cleanIP,
                    key: existingLog.key,
                    timestamp: existingLog.timestamp,
                    expires_in: `${minutesRemaining} phút`,
                    note: `Key này còn hiệu lực ${minutesRemaining} phút nữa`
                }
            });
        }
    }
    
    // ===== KIỂM TRA BROWSER COOLDOWN - CHỈ CHO USER =====
    if (!isAdmin && browserId) {
        const logs = readLogs();
        const now = Date.now();
        const existingBrowserLog = logs.find(log => {
            if (log.browserId !== browserId) return false;
            if (log.customExpire) {
                return log.customExpire > now;
            }
            const logTime = new Date(log.timestamp).getTime();
            return (now - logTime) <= EXPIRE_TIME;
        });
        
        if (existingBrowserLog) {
            let expireTime;
            if (existingBrowserLog.customExpire) {
                expireTime = existingBrowserLog.customExpire;
            } else {
                const logTime = new Date(existingBrowserLog.timestamp).getTime();
                expireTime = logTime + EXPIRE_TIME;
            }
            const timeRemaining = expireTime - now;
            const minutesRemaining = Math.floor(timeRemaining / 60000);
            
            if (DEBUG) console.log(`⛔ Browser ${browserId} đã có key (POST), từ chối tạo mới`);
            
            return res.status(429).json({
                success: false,
                message: 'Browser already has a key',
                error: 'Mỗi browser chỉ được tạo 1 key mỗi 99 phút',
                data: {
                    key: existingBrowserLog.key,
                    expires_in: `${minutesRemaining} phút`,
                    remaining_minutes: minutesRemaining,
                    cooldown: '99 phút'
                }
            });
        }
    }
    
    const newKey = generateKey();
    const timestamp = new Date().toISOString();
    const userEmail = email || 'api_request@example.com';
    
    const logEntry = {
        id: Date.now(),
        ip: cleanIP,
        email: userEmail,
        hwid: hwid || null,
        browserId: browserId,
        action: action || (isAdmin ? 'admin_generate' : 'api_generate'),
        key: newKey,
        timestamp: timestamp,
        userAgent: req.headers['user-agent'] || 'API-Client',
        method: 'POST',
        source: isAdmin ? 'admin' : 'api',
        access_key_used: access_key,
        customExpire: Date.now() + customExpireMs,
        expireMinutes: customExpireMinutes,
        isAdmin: isAdmin
    };
    
    const logs = readLogs();
    logs.unshift(logEntry);
    writeLogs(logs);
    
    if (DEBUG) console.log(`📡 API Request: ${cleanIP} | ${userEmail} | ${newKey} (expire: ${customExpireMinutes} phút, admin: ${isAdmin})`);
    
    const responseData = {
        ip: cleanIP,
        key: newKey,
        email: userEmail,
        timestamp: timestamp,
        expire_after: `${customExpireMinutes} minutes`,
        expire_minutes: customExpireMinutes,
        source: isAdmin ? 'admin' : 'api',
        browser_id: browserId,
        is_admin: isAdmin
    };
    
    if (hwid) {
        responseData.hwid = hwid;
    }
    
    if (isAdmin) {
        responseData.whitelisted = true;
        responseData.note = `🔑 Admin: Key có hiệu lực ${customExpireMinutes} phút - KHÔNG giới hạn 1 key/IP`;
        responseData.max_expire_days = 90;
    } else {
        responseData.max_expire_days = 7;
    }
    
    res.json({
        success: true,
        message: isAdmin ? 'Key generated by Admin via API' : 'Key generated via API successfully',
        data: responseData
    });
});

// ================================================================
// API EXTERNAL
// ================================================================
app.post('/api/external', (req, res) => {
    const { api_key, email, action, custom_ip, access_key, expire_minutes, browser_id } = req.body;
    
    if (!api_key || api_key !== API_SECRET) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Invalid API key'
        });
    }
    
    let clientIP = custom_ip || req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     '0.0.0.0';
    
    const cleanIP = clientIP.replace('::ffff:', '').replace('::1', '127.0.0.1').split(',')[0].trim();
    cleanExpiredLogs();
    
    if (email && (!email.includes('@') || !email.includes('.'))) {
        return res.status(400).json({
            success: false,
            message: 'Invalid email format'
        });
    }
    
    const isAdmin = isWhitelisted(cleanIP);
    
    let customExpireMinutes = parseInt(expire_minutes) || SETTINGS.EXPIRE_TIME_MINUTES;
    if (isAdmin) {
        if (customExpireMinutes > 129600) customExpireMinutes = 129600;
    } else {
        if (customExpireMinutes > 10080) customExpireMinutes = 10080;
    }
    if (customExpireMinutes < 1) customExpireMinutes = 1;
    const customExpireMs = customExpireMinutes * 60 * 1000;
    
    const browserId = browser_id || null;
    
    const newKey = generateKey();
    const timestamp = new Date().toISOString();
    const userEmail = email || 'external_request@example.com';
    
    const logEntry = {
        id: Date.now(),
        ip: cleanIP,
        email: userEmail,
        browserId: browserId,
        action: action || (isAdmin ? 'admin_external' : 'external_generate'),
        key: newKey,
        timestamp: timestamp,
        userAgent: req.headers['user-agent'] || 'External-Client',
        method: 'POST',
        source: isAdmin ? 'admin' : 'external',
        external_api_key: true,
        access_key_used: access_key || null,
        customExpire: Date.now() + customExpireMs,
        expireMinutes: customExpireMinutes,
        isAdmin: isAdmin
    };
    
    const logs = readLogs();
    logs.unshift(logEntry);
    writeLogs(logs);
    
    if (DEBUG) console.log(`🔗 External Request: ${cleanIP} | ${userEmail} | ${newKey} (expire: ${customExpireMinutes} phút, admin: ${isAdmin})`);
    
    const responseData = {
        ip: cleanIP,
        key: newKey,
        email: userEmail,
        timestamp: timestamp,
        expire_after: `${customExpireMinutes} minutes`,
        expire_minutes: customExpireMinutes,
        source: isAdmin ? 'admin' : 'external',
        browser_id: browserId,
        is_admin: isAdmin
    };
    
    if (isAdmin) {
        responseData.whitelisted = true;
        responseData.note = `🔑 Admin: Key có hiệu lực ${customExpireMinutes} phút - KHÔNG giới hạn 1 key/IP`;
        responseData.max_expire_days = 90;
    } else {
        responseData.max_expire_days = 7;
    }
    
    res.json({
        success: true,
        message: isAdmin ? 'Key generated by Admin via external API' : 'Key generated via external API',
        data: responseData,
        source: isAdmin ? 'admin' : 'external'
    });
});

// ================================================================
// API STATS
// ================================================================
app.get('/api/stats', (req, res) => {
    const logs = cleanExpiredLogs();
    const accessKeys = readAccessKeys();
    
    const uniqueBrowsers = new Set();
    let adminCount = 0;
    logs.forEach(log => {
        if (log.browserId) {
            uniqueBrowsers.add(log.browserId);
        }
        if (log.isAdmin || isWhitelisted(log.ip)) {
            adminCount++;
        }
    });
    
    const stats = {
        totalRequests: logs.length,
        uniqueIPs: [...new Set(logs.map(l => l.ip))].length,
        uniqueBrowsers: uniqueBrowsers.size,
        adminRequests: adminCount,
        actions: logs.reduce((acc, log) => {
            acc[log.action] = (acc[log.action] || 0) + 1;
            return acc;
        }, {}),
        sources: logs.reduce((acc, log) => {
            const source = log.source || 'browser';
            acc[source] = (acc[source] || 0) + 1;
            return acc;
        }, {}),
        accessKeys: {
            total: accessKeys.length,
            used: accessKeys.filter(k => k.used).length,
            unused: accessKeys.filter(k => !k.used).length,
            expired: accessKeys.filter(k => {
                const keyTime = new Date(k.timestamp).getTime();
                return (Date.now() - keyTime) > EXPIRE_TIME;
            }).length
        },
        lastRequest: logs.length > 0 ? logs[0].timestamp : null,
        default_expire_time: `${EXPIRE_TIME/60000} minutes`,
        max_expire_days_admin: 90,
        max_expire_days_user: 7,
        browser_cooldown: '99 phút (chỉ cho user)',
        one_key_per_ip: ONE_KEY_PER_IP,
        key_format: `${KEY_PREFIX}-xxxxxxxxxxxxxxxx`,
        access_key_format: `${ACCESS_KEY_PREFIX}-[80 ký tự hỗn hợp + timestamp]`,
        max_logs: MAX_LOGS || 'unlimited',
        whitelist_ips: WHITELIST_IPS,
        serve_html: SERVE_HTML,
        allowed_domain: ALLOWED_DOMAIN
    };
    
    res.json({
        success: true,
        data: stats
    });
});

// ================================================================
// DELETE LOGS
// ================================================================
app.delete('/api/logs', (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    
    if (!adminKey || adminKey !== API_SECRET) {
        return res.status(403).json({
            success: false,
            message: 'Forbidden: Invalid admin key'
        });
    }
    
    writeLogs([]);
    res.json({
        success: true,
        message: 'All logs deleted successfully'
    });
});

// ================================================================
// ROUTE MẶC ĐỊNH
// ================================================================
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({
            success: false,
            message: 'API route not found',
            available_endpoints: {
                root: '/',
                health: '/api/health',
                logs: '/api/logs (WHITELIST ONLY)',
                keys: '/api/keys',
                access: '/api/access',
                request: '/api/request (cần access key)',
                stats: '/api/stats',
                checkBrowser: '/api/check-browser'
            }
        });
    } else if (SERVE_HTML) {
        const indexPath = path.join(__dirname, '../frontend/index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).json({
                success: false,
                message: 'Page not found'
            });
        }
    } else {
        res.status(404).json({
            success: false,
            message: 'Page not found'
        });
    }
});

// ================================================================
// ERROR HANDLING
// ================================================================
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        ...(NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ================================================================
// START SERVER
// ================================================================
app.listen(PORT, () => {
    console.log(`\n✅ API Server đang chạy trên cổng ${PORT}`);
    console.log(`📝 Environment: ${NODE_ENV}`);
    console.log(`📋 Log file: ${LOG_FILE}`);
    console.log(`📋 Access key file: ${ACCESS_FILE}`);
    console.log(`\n📌 Cấu hình hiện tại:`);
    console.log(`   ⏰ Thời gian hết hạn mặc định: ${EXPIRE_TIME/60000} phút`);
    console.log(`   ⏰ Admin: tối đa 90 ngày (129600 phút)`);
    console.log(`   ⏰ User: tối đa 7 ngày (10080 phút)`);
    console.log(`   🔑 Giới hạn 1 key/IP: ${ONE_KEY_PER_IP ? 'BẬT (chỉ cho user)' : 'TẮT'}`);
    console.log(`   🖥️ Browser cooldown: 99 phút (chỉ cho user)`);
    console.log(`   🌟 Whitelist IP: ${WHITELIST_IPS.join(', ') || 'Không có'}`);
    console.log(`   📊 Giới hạn logs: ${MAX_LOGS || 'Không giới hạn'}`);
    console.log(`   🔑 Prefix key: ${KEY_PREFIX}`);
    console.log(`   🔑 Prefix access key: ${ACCESS_KEY_PREFIX}`);
    console.log(`   🔒 /api/logs: CHỈ WHITELIST IP`);
    console.log(`   🌐 Allowed domain: ${ALLOWED_DOMAIN}`);
    console.log(`   📁 Phục vụ HTML: ${SERVE_HTML ? 'BẬT' : 'TẮT'}`);
    console.log(`\n📡 Endpoints:`);
    console.log(`   🌐 Trang chủ: http://localhost:${PORT}/`);
    console.log(`   🌐 Production: https://key-system-aurahub.onrender.com/`);
    console.log(`   🔒 /api/logs (WHITELIST ONLY)`);
    console.log(`   🔑 /api/access`);
    console.log(`   🔑 /api/request (hỗ trợ expire_minutes & browser_id)`);
    console.log(`   🖥️ /api/check-browser (kiểm tra browser đã có key)`);
    console.log(`   📊 /api/stats`);
    console.log(`   📋 /api/keys`);
    console.log(`   📁 /admin.html (WHITELIST ONLY - Admin có thể tạo key 90 ngày)`);
    console.log(`   📊 /dashboard (WHITELIST ONLY)`);
    console.log(`   📖 /howtouse (WHITELIST ONLY - JSON)\n`);
    
    cleanExpiredLogs();
    cleanExpiredAccessKeys();
});

// Tự động clean mỗi 15 phút
setInterval(() => {
    if (DEBUG) console.log('🔄 Tự động kiểm tra và xóa IP hết hạn...');
    cleanExpiredLogs();
    cleanExpiredAccessKeys();
}, 15 * 60 * 1000);

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});
