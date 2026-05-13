const express = require('express');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public')); // тут лежат index.html и др

// === БД ===
const db = new sqlite3.Database('./cuberpulse.db');
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    verify_code TEXT,
    is_verified INTEGER DEFAULT 0,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active'
)`);
db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT,
    price_usd REAL,
    img TEXT,
    description TEXT
)`);
// Добавим тестовый товар, если пусто
db.get("SELECT COUNT(*) as cnt FROM products", (err, row) => {
    if(row.cnt === 0) {
        db.run("INSERT INTO products (name, price_usd, img, description) VALUES (?,?,?,?)", ['Flipper Zero', 169, '🐬', 'Пентест-устройство']);
        db.run("INSERT INTO products (name, price_usd, img, description) VALUES (?,?,?,?)", ['HackRF One', 299, '📡', 'SDR трансивер']);
    }
});

// === НАСТРОЙКА ПОЧТЫ (замени на свои SMTP) ===
const transporter = nodemailer.createTransport({
    service: 'gmail', // или yandex, mail.ru
    auth: { user: 'your_email@gmail.com', pass: 'your_app_password' }
});

// === Регистрация с отправкой кода ===
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPass = await bcrypt.hash(password, 10);
    
    db.run("INSERT OR REPLACE INTO users (email, password, verify_code) VALUES (?,?,?)", [email, hashedPass, code], (err) => {
        if(err) return res.status(400).json({error: 'Email занят'});
        // Отправка письма
        transporter.sendMail({
            from: 'CuberPulse <noreply@cuberpulse.com>',
            to: email,
            subject: 'Код подтверждения CuberPulse',
            text: `Ваш код для входа: ${code}. Никому не сообщайте.`
        });
        res.json({message: 'Код отправлен на почту'});
    });
});

// === Вход с проверкой кода ===
app.post('/api/verify', (req, res) => {
    const { email, code } = req.body;
    db.get("SELECT * FROM users WHERE email = ? AND verify_code = ?", [email, code], async (err, user) => {
        if(!user) return res.status(401).json({error: 'Неверный код'});
        db.run("UPDATE users SET is_verified = 1 WHERE id = ?", user.id);
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, 'hacker_secret_key');
        res.json({token, role: user.role});
    });
});

// === Получение каталога (для админки) ===
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", (err, rows) => res.json(rows));
});

// === АДМИН ПАНЕЛЬ: изменение товаров, просмотр клиентов ===
const authAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if(!token) return res.status(401).json({error: 'Нет токена'});
    jwt.verify(token, 'hacker_secret_key', (err, decoded) => {
        if(err || decoded.role !== 'admin') return res.status(403).json({error: 'Нет прав'});
        req.user = decoded;
        next();
    });
};

app.put('/api/admin/product/:id', authAdmin, (req, res) => {
    const { name, price_usd, img, description } = req.body;
    db.run("UPDATE products SET name=?, price_usd=?, img=?, description=? WHERE id=?", [name, price_usd, img, description, req.params.id], (err) => {
        if(err) return res.status(500).json({error: 'Ошибка'});
        res.json({message: 'Обновлено'});
    });
});

app.get('/api/admin/users', authAdmin, (req, res) => {
    db.all("SELECT id, email, status, role FROM users", (err, rows) => res.json(rows));
});

app.post('/api/admin/change-status', authAdmin, (req, res) => {
    const { userId, status } = req.body;
    db.run("UPDATE users SET status = ? WHERE id = ?", [status, userId]);
    res.json({message: 'Статус изменен'});
});

// === Отслеживание заказа (статус товара) ===
app.get('/api/order-status/:userId', (req, res) => {
    // Для демо просто заглушка
    res.json({ status: 'В обработке', tracking: 'TRK-1234' });
});

app.listen(3000, () => console.log('CuberPulse сервер запущен на http://localhost:3000'));