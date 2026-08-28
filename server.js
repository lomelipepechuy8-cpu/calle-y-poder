/* ============================================
   CALLE Y PODER - BACKEND SERVER
   Express + Firebase + Nodemailer + RSS
   ============================================ */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const RssParser = require('rss-parser');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const https = require('https');

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

const rssParser = new RssParser({
    timeout: 12000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    requestOptions: {
        agent: httpsAgent,
        rejectUnauthorized: false
    }
});

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== FIREBASE ADMIN SETUP =====
let db = null;

function initFirebase() {
    try {
        const admin = require('firebase-admin');

        // Check if Firebase credentials are configured
        if (!process.env.FIREBASE_PROJECT_ID) {
            console.warn('⚠️  Firebase no configurado — usando almacenamiento local temporal.');
            return null;
        }

        const serviceAccount = {
            type: 'service_account',
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
        };

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        db = admin.firestore();
        console.log('✅ Firebase conectado exitosamente');
        return db;

    } catch (error) {
        console.warn('⚠️  Error inicializando Firebase:', error.message);
        return null;
    }
}

db = initFirebase();

// ===== NODEMAILER SETUP =====
let emailTransporter = null;

function initEmail() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️  Email no configurado — los correos no se enviarán.');
        return null;
    }

    try {
        emailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS // App Password de Gmail
            }
        });

        // Verificar conexión
        emailTransporter.verify((error) => {
            if (error) {
                console.warn('⚠️  Error verificando email:', error.message);
            } else {
                console.log('✅ Email configurado: ' + process.env.EMAIL_USER);
            }
        });

        return emailTransporter;
    } catch (error) {
        console.warn('⚠️  Error configurando email:', error.message);
        return null;
    }
}

initEmail();

// ===== ALMACENAMIENTO LOCAL (FALLBACK) =====
// Se usa cuando Firebase y Google Sheets no están configurados
const localStore = {
    subscribers: [],
    suggestions: []
};

// ===== GOOGLE SHEETS WEBHOOK =====
async function saveToGoogleSheets(type, data) {
    const webhookUrl = process.env.SHEETS_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn('⚠️  Google Sheets webhook no configurado (SHEETS_WEBHOOK_URL)');
        return false;
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, ...data }),
            redirect: 'follow'
        });
        const result = await response.json();
        if (result.status === 'ok') {
            console.log(`✅ Guardado en Google Sheets (${type})`);
            return true;
        } else {
            console.warn('⚠️  Error de Google Sheets:', result.message);
            return false;
        }
    } catch (error) {
        console.warn('⚠️  Error enviando a Google Sheets:', error.message);
        return false;
    }
}


/* ============================================
   API ROUTES
   ============================================ */

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        firebase: db ? 'connected' : 'not configured',
        email: emailTransporter ? 'configured' : 'not configured',
        sheets: process.env.SHEETS_WEBHOOK_URL ? 'configured' : 'not configured',
        timestamp: new Date().toISOString()
    });
});


// ===== RSS NEWS PROXY =====
const RSS_FEEDS = {
    izquierda: [
        { name: 'La Jornada', url: 'https://www.jornada.com.mx/rss/edicion.xml' },
        { name: 'El País México', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/mexico/portada' }
    ],
    derecha: [
        { name: 'El Economista', url: 'https://www.eleconomista.com.mx/rss/ultimas-noticias' },
        { name: 'Expansión', url: 'https://expansion.mx/rss' }
    ]
};

// Cache de noticias (5 minutos)
const newsCache = {
    izquierda: { data: null, timestamp: 0 },
    derecha: { data: null, timestamp: 0 }
};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

app.get('/api/news/:side', async (req, res) => {
    const { side } = req.params;

    if (!RSS_FEEDS[side]) {
        return res.status(400).json({ error: 'Side must be "izquierda" or "derecha"' });
    }

    // Verificar cache
    const now = Date.now();
    if (newsCache[side].data && (now - newsCache[side].timestamp) < CACHE_DURATION) {
        return res.json({ items: newsCache[side].data, cached: true });
    }

    try {
        const feeds = RSS_FEEDS[side];
        const allItems = [];

        for (const feed of feeds) {
            try {
                const parsed = await rssParser.parseURL(feed.url);
                const items = (parsed.items || []).slice(0, 6).map(item => ({
                    title: item.title || 'Sin título',
                    link: item.link || '#',
                    source: feed.name,
                    date: item.pubDate || item.isoDate || new Date().toISOString(),
                    description: (item.contentSnippet || item.content || '')
                        .replace(/<[^>]*>/g, '')
                        .substring(0, 150)
                }));
                allItems.push(...items);
            } catch (feedError) {
                console.warn(`⚠️  Error en feed ${feed.name}:`, feedError.message);
            }
        }

        // Ordenar por fecha descendente
        allItems.sort((a, b) => new Date(b.date) - new Date(a.date));
        const topItems = allItems.slice(0, 10);

        // Guardar en cache
        newsCache[side] = { data: topItems, timestamp: now };

        res.json({ items: topItems, cached: false });

    } catch (error) {
        console.error('Error cargando noticias:', error.message);
        res.status(500).json({ error: 'Error cargando noticias', details: error.message });
    }
});


// ===== SUSCRIPCIÓN =====
app.post('/api/subscribe', async (req, res) => {
    const { name, email, interests } = req.body;

    // Validación
    if (!name || !email) {
        return res.status(400).json({ error: 'Nombre y email son requeridos' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
    }

    try {
        const subscriberData = {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            interests: interests || [],
            subscribedAt: new Date().toISOString(),
            source: 'web',
            confirmed: false
        };

        // Guardar en Google Sheets (principal)
        await saveToGoogleSheets('subscribe', subscriberData);

        // Guardar también en Firebase o local (backup)
        if (db) {
            // Verificar si ya existe
            const existing = await db.collection('suscriptores')
                .where('email', '==', subscriberData.email)
                .get();

            if (!existing.empty) {
                return res.status(409).json({ error: 'Este email ya está suscrito' });
            }

            await db.collection('suscriptores').add(subscriberData);
            console.log(`✅ Suscriptor guardado en Firebase: ${name} (${email})`);
        } else {
            // Verificar duplicado local
            if (localStore.subscribers.find(s => s.email === subscriberData.email)) {
                return res.status(409).json({ error: 'Este email ya está suscrito' });
            }
            localStore.subscribers.push(subscriberData);
            console.log(`📋 Suscriptor guardado localmente: ${name} (${email})`);
        }

        // Enviar email de bienvenida
        if (emailTransporter) {
            try {
                await sendWelcomeEmail(name, email, interests);
                console.log(`📧 Email de bienvenida enviado a: ${email}`);
            } catch (emailError) {
                console.warn('⚠️  Error enviando email:', emailError.message);
                // No fallamos la suscripción si el email falla
            }
        }

        res.json({
            success: true,
            message: 'Suscripción exitosa',
            emailSent: !!emailTransporter
        });

    } catch (error) {
        console.error('Error en suscripción:', error);
        res.status(500).json({ error: 'Error procesando suscripción' });
    }
});


// ===== SUGERENCIAS =====
app.post('/api/suggest', async (req, res) => {
    const { name, topic, timing } = req.body;

    if (!topic) {
        return res.status(400).json({ error: 'El tema es requerido' });
    }

    try {
        const suggestionData = {
            name: (name || 'Anónimo').trim(),
            topic: topic.trim(),
            timing: timing || 'cualquier',
            submittedAt: new Date().toISOString()
        };

        // Guardar en Google Sheets (principal)
        await saveToGoogleSheets('suggest', suggestionData);

        // Backup en Firebase o local
        if (db) {
            await db.collection('sugerencias').add(suggestionData);
            console.log(`✅ Sugerencia guardada en Firebase: "${topic}" por ${suggestionData.name}`);
        } else {
            localStore.suggestions.push(suggestionData);
            console.log(`📋 Sugerencia guardada localmente: "${topic}" por ${suggestionData.name}`);
        }

        // Notificar al correo de Calle y Poder
        if (emailTransporter) {
            try {
                await emailTransporter.sendMail({
                    from: `"Calle y Poder Web" <${process.env.EMAIL_USER}>`,
                    to: process.env.EMAIL_USER,
                    subject: `💡 Nueva sugerencia de live: ${suggestionData.name}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; background: #111; color: #eee; padding: 24px; border-radius: 8px;">
                            <h2 style="color: #e01020;">💡 Nueva sugerencia para Live</h2>
                            <p><strong>De:</strong> ${suggestionData.name}</p>
                            <p><strong>Tema propuesto:</strong></p>
                            <blockquote style="background: #222; padding: 12px; border-left: 4px solid #e01020; font-size: 16px;">${suggestionData.topic}</blockquote>
                            <p><strong>Para:</strong> ${suggestionData.timing}</p>
                            <p style="color: #888; font-size: 12px;">Enviado el ${new Date().toLocaleString('es-MX')}</p>
                        </div>
                    `
                });
                console.log(`📧 Notificación de sugerencia enviada a admin`);
            } catch (err) {
                console.warn('⚠️  Error enviando notificación de sugerencia:', err.message);
            }
        }

        res.json({ success: true, message: 'Sugerencia recibida' });

    } catch (error) {
        console.error('Error en sugerencia:', error);
        res.status(500).json({ error: 'Error procesando sugerencia' });
    }
});


// ===== LISTAR SUSCRIPTORES (protegido con API key simple) =====
app.get('/api/subscribers', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    if (db) {
        db.collection('suscriptores')
            .orderBy('subscribedAt', 'desc')
            .get()
            .then(snapshot => {
                const subs = [];
                snapshot.forEach(doc => subs.push({ id: doc.id, ...doc.data() }));
                res.json({ count: subs.length, subscribers: subs });
            })
            .catch(err => res.status(500).json({ error: err.message }));
    } else {
        res.json({ count: localStore.subscribers.length, subscribers: localStore.subscribers });
    }
});

// ===== LISTAR SUGERENCIAS (protegido) =====
app.get('/api/suggestions', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    if (db) {
        db.collection('sugerencias')
            .orderBy('submittedAt', 'desc')
            .get()
            .then(snapshot => {
                const suggestions = [];
                snapshot.forEach(doc => suggestions.push({ id: doc.id, ...doc.data() }));
                res.json({ count: suggestions.length, suggestions });
            })
            .catch(err => res.status(500).json({ error: err.message }));
    } else {
        res.json({ count: localStore.suggestions.length, suggestions: localStore.suggestions });
    }
});


/* ============================================
   EMAIL TEMPLATES
   ============================================ */

async function sendWelcomeEmail(name, email, interests) {
    const interestLabels = {
        geopolitica: 'Geopolítica',
        politica: 'Política',
        economia: 'Economía',
        tecnologia: 'Tecnología',
        social: 'Social',
        denuncias: 'Denuncias'
    };

    const interestList = (interests || [])
        .map(i => interestLabels[i] || i)
        .join(', ') || 'Todos los temas';

    const htmlEmail = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { margin: 0; padding: 0; background: #0a0a0a; font-family: 'Segoe UI', Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; background: #111114; border: 1px solid #2a2a32; border-radius: 12px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #e01020, #a00c18); padding: 40px 32px; text-align: center; }
            .header h1 { color: #ffffff; font-size: 28px; margin: 0 0 8px; letter-spacing: 3px; }
            .header p { color: rgba(255,255,255,0.8); font-size: 14px; margin: 0; }
            .body { padding: 32px; }
            .greeting { color: #f5f5f8; font-size: 20px; margin: 0 0 16px; }
            .text { color: #a0a0b0; font-size: 15px; line-height: 1.7; margin: 0 0 20px; }
            .benefits { background: #18181c; border: 1px solid #2a2a32; border-radius: 8px; padding: 20px; margin: 24px 0; }
            .benefit { display: flex; align-items: center; gap: 12px; padding: 8px 0; color: #a0a0b0; font-size: 14px; }
            .benefit-icon { font-size: 20px; }
            .interests-badge { display: inline-block; background: rgba(224,16,32,0.12); border: 1px solid rgba(224,16,32,0.25); color: #ff2535; padding: 4px 12px; border-radius: 100px; font-size: 12px; margin: 2px; }
            .cta { text-align: center; margin: 32px 0; }
            .cta a { display: inline-block; background: #e01020; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; letter-spacing: 1px; }
            .footer { border-top: 1px solid #2a2a32; padding: 20px 32px; text-align: center; }
            .footer p { color: #6a6a75; font-size: 12px; margin: 4px 0; }
            .social-links { margin-top: 12px; }
            .social-links a { color: #e01020; text-decoration: none; margin: 0 8px; font-size: 13px; }
        </style>
    </head>
    <body>
        <div style="padding: 20px; background: #0a0a0a;">
            <div class="container">
                <div class="header">
                    <h1>CALLE Y PODER</h1>
                    <p>La información es poder 🔴</p>
                </div>
                <div class="body">
                    <h2 class="greeting">¡Bienvenido, ${name}! 🎉</h2>
                    <p class="text">
                        Gracias por unirte a la comunidad de <strong>Calle y Poder</strong>. 
                        A partir de ahora recibirás contenido exclusivo, alertas de nuevos lives 
                        y la gaceta diaria con la confrontación de medios.
                    </p>

                    <div class="benefits">
                        <div class="benefit"><span class="benefit-icon">📰</span> Gaceta diaria con síntesis de noticias</div>
                        <div class="benefit"><span class="benefit-icon">🔔</span> Alertas de nuevos lives y contenido</div>
                        <div class="benefit"><span class="benefit-icon">💬</span> Buzón de sugerencias para temas</div>
                        <div class="benefit"><span class="benefit-icon">🛍️</span> Acceso prioritario a la tienda de merch</div>
                        <div class="benefit"><span class="benefit-icon">🎯</span> Contenido exclusivo para suscriptores</div>
                    </div>

                    <p class="text"><strong>Tus temas de interés:</strong></p>
                    <p>${(interests || []).map(i => `<span class="interests-badge">${interestLabels[i] || i}</span>`).join(' ') || '<span class="interests-badge">Todos los temas</span>'}</p>

                    <div class="cta">
                        <a href="https://www.youtube.com/channel/UCsFD9Ry2DVGsbYjDSfdJ9-Q">Visitar Canal de YouTube</a>
                    </div>
                </div>
                <div class="footer">
                    <p>Calle y Poder © 2026 — La voz de la calle con poder de información</p>
                    <div class="social-links">
                        <a href="https://www.youtube.com/channel/UCsFD9Ry2DVGsbYjDSfdJ9-Q">YouTube</a>
                        <a href="https://www.facebook.com/profile.php?id=61590263294504">Facebook</a>
                    </div>
                    <p style="margin-top: 12px; font-size: 11px;">Si no solicitaste esta suscripción, puedes ignorar este correo.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    await emailTransporter.sendMail({
        from: `"Calle y Poder" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `¡Bienvenido a Calle y Poder, ${name}! 🔴`,
        html: htmlEmail
    });
}


/* ============================================
   CATCH-ALL: Serve index.html for SPA-like routes
   ============================================ */
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


/* ============================================
   START SERVER
   ============================================ */
app.listen(PORT, () => {
    console.log('');
    console.log('🔴 ═══════════════════════════════════════');
    console.log('   CALLE Y PODER — Servidor Activo');
    console.log(`   Puerto: ${PORT}`);
    console.log(`   Firebase: ${db ? '✅ Conectado' : '⚠️  No configurado'}`);
    console.log(`   Email: ${emailTransporter ? '✅ Configurado' : '⚠️  No configurado'}`);
    console.log('🔴 ═══════════════════════════════════════');
    console.log('');
});
