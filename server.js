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
        const payload = JSON.stringify({ type, ...data });
        
        // Paso 1: Enviar POST al webhook (Google redirige con 302)
        const initialResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            redirect: 'manual'  // No seguir redirect automáticamente
        });

        // Paso 2: Si hay redirect, re-enviar POST a la URL final
        if (initialResponse.status >= 300 && initialResponse.status < 400) {
            const redirectUrl = initialResponse.headers.get('location');
            if (redirectUrl) {
                const finalResponse = await fetch(redirectUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload,
                    redirect: 'follow'
                });
                const result = await finalResponse.json();
                if (result.status === 'ok') {
                    console.log(`✅ Guardado en Google Sheets (${type})`);
                    return true;
                } else {
                    console.warn('⚠️  Error de Google Sheets:', result.message);
                    return false;
                }
            }
        }

        // Si no hubo redirect, leer respuesta directa
        const result = await initialResponse.json();
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

        // Guardar backup local
        localStore.subscribers.push(subscriberData);
        console.log(`📋 Nuevo suscriptor: ${name} (${email})`);

        // Guardar en Google Sheets + enviar emails (en segundo plano, no bloquea)
        saveToGoogleSheets('subscribe', subscriberData).catch(err => {
            console.warn('⚠️  Error Google Sheets:', err.message);
        });

        // Responder inmediatamente al usuario
        res.json({
            success: true,
            message: 'Suscripción exitosa'
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

        // Guardar backup local
        localStore.suggestions.push(suggestionData);
        console.log(`📋 Nueva sugerencia: "${topic}" por ${suggestionData.name}`);

        // Guardar en Google Sheets + notificar por email (en segundo plano)
        saveToGoogleSheets('suggest', suggestionData).catch(err => {
            console.warn('⚠️  Error Google Sheets:', err.message);
        });

        // Responder inmediatamente al usuario
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
   CONFIRMATION ROUTE
   ============================================ */
app.get('/confirmar', async (req, res) => {
    const { token, email } = req.query;
    
    if (token && email) {
        // Enviar confirmación al webhook de Google Sheets
        saveToGoogleSheets('confirm', { token, email }).catch(err => {
            console.warn('⚠️ Error confirmando en Sheets:', err.message);
        });
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Suscripción Confirmada | Calle y Poder</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { background: #0a0a0a; color: #f5f5f8; font-family: 'Inter', Arial, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; text-align:center; }
            .card { background: #111114; border: 1px solid #2a2a32; border-radius: 16px; padding: 48px 32px; max-width: 480px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.7); }
            .icon { width: 72px; height: 72px; background: rgba(224,16,32,0.15); border: 2px solid #e01020; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 32px; color: #e01020; }
            h1 { font-family: 'Oswald', sans-serif; font-size: 28px; letter-spacing: 2px; margin-bottom: 8px; color: #fff; }
            h1 span { color: #e01020; }
            h2 { font-size: 20px; color: #22c55e; margin-bottom: 16px; }
            p { color: #a0a0b0; font-size: 15px; line-height: 1.6; margin-bottom: 32px; }
            .btn { display: inline-block; background: #e01020; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; letter-spacing: 1px; transition: background 0.2s; }
            .btn:hover { background: #c00e1c; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">&#10003;</div>
            <h1>CALLE <span>Y</span> PODER</h1>
            <h2>¡Suscripción Confirmada!</h2>
            <p>Tu cuenta ha sido activada con éxito. Ya eres parte de la comunidad oficial de Calle y Poder.</p>
            <a href="/" class="btn">Ir al Sitio Web</a>
        </div>
    </body>
    </html>
    `);
});

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
