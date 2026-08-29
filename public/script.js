/* ============================================
   CALLE Y PODER - JAVASCRIPT PRINCIPAL
   ============================================ */

// ===== NAVBAR SCROLL =====
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// ===== HAMBURGER MENU =====
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');

hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    const spans = hamburger.querySelectorAll('span');
    if (navLinks.classList.contains('open')) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
    }
});

// Cerrar menú al hacer click en un link
navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        const spans = hamburger.querySelectorAll('span');
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
    });
});

// ===== ACTIVE NAV LINK ON SCROLL =====
const sections = document.querySelectorAll('section[id]');
const navLinksList = document.querySelectorAll('.nav-link');

function updateActiveLink() {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        if (window.scrollY >= sectionTop) {
            current = section.getAttribute('id');
        }
    });

    navLinksList.forEach(link => {
        link.style.color = '';
        if (link.getAttribute('href') === `#${current}`) {
            link.style.color = 'var(--red-light)';
        }
    });
}

window.addEventListener('scroll', updateActiveLink);

// ===== PARTÍCULAS HERO =====
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;

    const count = 25;
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');

        const size = Math.random() * 3 + 1;
        const x = Math.random() * 100;
        const duration = Math.random() * 12 + 8;
        const delay = Math.random() * 10;

        particle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${x}%;
            animation-duration: ${duration}s;
            animation-delay: -${delay}s;
            opacity: ${Math.random() * 0.6 + 0.2};
        `;

        container.appendChild(particle);
    }
}

createParticles();

// ===== REVEAL ON SCROLL =====
function setupReveal() {
    const elements = document.querySelectorAll(
        '.benefit-card, .value-item, .content-redirect-card, .news-column, .subscribe-form-card, .suggestions-card'
    );

    elements.forEach((el, i) => {
        el.classList.add('reveal');
        el.style.transitionDelay = `${(i % 4) * 0.08}s`;
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
    });

    elements.forEach(el => observer.observe(el));
}

setupReveal();

// ===== SMOOTH SCROLL CON OFFSET PARA NAVBAR =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            const offset = 80;
            const top = target.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
});

// ===== COUNTER ANIMATION =====
function animateCounters() {
    const statNumbers = document.querySelectorAll('.stat-number');

    const targets = {
        '13+': { end: 13, suffix: '+' },
        '50+': { end: 50, suffix: '+' },
        '100%': { end: 100, suffix: '%' },
    };

    statNumbers.forEach(el => {
        const text = el.textContent.trim();
        const config = targets[text];
        if (!config) return;

        const duration = 1500;
        const step = (timestamp) => {
            if (!step.startTime) step.startTime = timestamp;
            const progress = Math.min((timestamp - step.startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(eased * config.end);
            el.textContent = current + config.suffix;
            if (progress < 1) requestAnimationFrame(step);
        };

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                requestAnimationFrame(step);
                observer.disconnect();
            }
        }, { threshold: 0.5 });

        observer.observe(el);
    });
}

animateCounters();

// ===== TICKER PAUSE ON HOVER =====
const tickerContent = document.querySelector('.ticker-content');
if (tickerContent) {
    tickerContent.addEventListener('mouseenter', () => {
        tickerContent.style.animationPlayState = 'paused';
    });
    tickerContent.addEventListener('mouseleave', () => {
        tickerContent.style.animationPlayState = 'running';
    });
}

// ===== PARALLAX HERO LOGO =====
const heroLogoFloat = document.querySelector('.hero-logo-float');
if (heroLogoFloat) {
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        if (scrolled < window.innerHeight) {
            heroLogoFloat.style.transform = `translateY(calc(-50% + ${scrolled * 0.15}px))`;
        }
    });
}

// ===== TYPING EFFECT =====
function setupTypewriter() {
    const subtitle = document.querySelector('.hero-subtitle');
    if (!subtitle) return;

    const originalText = subtitle.textContent;
    subtitle.textContent = '';
    subtitle.style.borderRight = '2px solid var(--red)';

    let i = 0;
    const speed = 35;

    function typeChar() {
        if (i < originalText.length) {
            subtitle.textContent += originalText.charAt(i);
            i++;
            setTimeout(typeChar, speed);
        } else {
            setTimeout(() => {
                subtitle.style.borderRight = 'none';
            }, 1500);
        }
    }

    setTimeout(typeChar, 1000);
}

setupTypewriter();

// ===== CARD TILT EFFECT =====
function setupCardTilt() {
    const cards = document.querySelectorAll('.benefit-card, .merch-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -4;
            const rotateY = ((x - centerX) / centerX) * 4;

            card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
}

setupCardTilt();


/* ============================================
   NOTICIAS - CARGA DESDE BACKEND CON FALLBACK RSS
   ============================================ */

// Feeds RSS directos como fallback (si se abre en modo estático local o API offline)
const FALLBACK_FEEDS = {
    izquierda: [
        { name: 'La Jornada', url: 'https://www.jornada.com.mx/rss/edicion.xml' },
        { name: 'Sin Embargo', url: 'https://www.sinembargo.mx/feed/' }
    ],
    derecha: [
        { name: 'El Universal', url: 'https://www.eluniversal.com.mx/rss.xml' },
        { name: 'Milenio', url: 'https://www.milenio.com/rss' }
    ]
};

const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json?rss_url=';

// Cargar noticias intentando backend primero, luego rss2json
async function loadNewsSide(side, containerId) {
    let items = [];

    // Intento 1: Nuestro backend Express (/api/news/:side)
    try {
        const response = await fetch(`/api/news/${side}`);
        if (response.ok) {
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                items = data.items.map(item => ({
                    ...item,
                    date: new Date(item.date)
                }));
            }
        }
    } catch (e) {
        // Backend no disponible (modo static file:// o desarrollo sin server)
    }

    // Intento 2: Fallback directo a rss2json si el backend no dio resultados
    if (items.length === 0) {
        try {
            const feedPromises = (FALLBACK_FEEDS[side] || []).map(async (feed) => {
                try {
                    const res = await fetch(`${RSS2JSON_BASE}${encodeURIComponent(feed.url)}&count=4`);
                    if (!res.ok) return [];
                    const d = await res.json();
                    if (d.status === 'ok' && d.items) {
                        return d.items.map(it => ({
                            title: it.title,
                            link: it.link,
                            source: feed.name,
                            date: new Date(it.pubDate)
                        }));
                    }
                } catch (err) {
                    return [];
                }
                return [];
            });

            const results = await Promise.all(feedPromises);
            items = results.flat().sort((a, b) => b.date - a.date).slice(0, 8);
        } catch (err) {
            console.warn(`Fallback RSS error (${side}):`, err.message);
        }
    }

    renderNewsItems(containerId, items);
}

// Renderizar noticias en una columna
function renderNewsItems(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `
            <div class="news-error">
                <p>No se pudieron cargar las noticias en este momento.</p>
                <p>Visita las fuentes directamente:</p>
                ${containerId === 'feed-izquierda'
                    ? '<a href="https://www.jornada.com.mx" target="_blank" rel="noopener">La Jornada</a> · <a href="https://www.sinembargo.mx" target="_blank" rel="noopener">Sin Embargo</a>'
                    : '<a href="https://www.eluniversal.com.mx" target="_blank" rel="noopener">El Universal</a> · <a href="https://www.milenio.com" target="_blank" rel="noopener">Milenio</a>'
                }
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => `
        <a href="${item.link}" target="_blank" class="news-item" rel="noopener noreferrer">
            <div class="news-item-source">
                <span>${item.source}</span>
            </div>
            <h4 class="news-item-title">${item.title}</h4>
            <div class="news-item-date">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                ${formatTimeAgo(item.date)}
            </div>
        </a>
    `).join('');
}

// Formatear tiempo relativo
function formatTimeAgo(date) {
    if (!date || isNaN(date.getTime())) return 'Reciente';
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Hace un momento';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} días`;
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// Actualizar indicador de última actualización
function updateTimestamp() {
    const el = document.getElementById('news-updated');
    if (!el) return;
    const now = new Date();
    const time = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    el.innerHTML = `<span class="update-dot"></span> Actualizado a las ${time}`;
}

// Función principal para cargar todas las noticias
async function loadAllNews() {
    await Promise.all([
        loadNewsSide('izquierda', 'feed-izquierda'),
        loadNewsSide('derecha', 'feed-derecha')
    ]);
    updateTimestamp();
}

// Cargar noticias al iniciar
loadAllNews();

// Auto-refrescar noticias cada 10 minutos
setInterval(loadAllNews, 10 * 60 * 1000);


// ===== SUBSCRIBER GATE FOR CONFRONTACIÓN DE MEDIOS =====
function initSubscriberGate() {
    const lockOverlay = document.getElementById('newsLockOverlay');
    const btnAlreadySub = document.getElementById('btn-already-sub');
    const quickUnlockForm = document.getElementById('quickUnlockForm');
    const quickUnlockEmail = document.getElementById('quick-unlock-email');

    // Verificar si ya está suscrito
    const isSubscribed = localStorage.getItem('cyp_subscriber') === 'true' || 
                         window.location.search.includes('confirmed=true');

    if (isSubscribed && lockOverlay) {
        lockOverlay.classList.add('unlocked');
    }

    if (btnAlreadySub && quickUnlockForm) {
        btnAlreadySub.addEventListener('click', () => {
            if (quickUnlockForm.style.display === 'none') {
                quickUnlockForm.style.display = 'flex';
                quickUnlockEmail.focus();
            } else {
                quickUnlockForm.style.display = 'none';
            }
        });

        quickUnlockForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = quickUnlockEmail.value.trim();
            if (isValidEmail(email)) {
                localStorage.setItem('cyp_subscriber', 'true');
                localStorage.setItem('cyp_subscriber_email', email);
                if (lockOverlay) lockOverlay.classList.add('unlocked');
            } else {
                alert('Por favor ingresa un correo válido.');
            }
        });
    }
}

initSubscriberGate();


/* ============================================
   FORMULARIOS - SUSCRIPCIÓN Y SUGERENCIAS
   ============================================ */

// ===== FORMULARIO DE SUSCRIPCIÓN =====
const subscribeForm = document.getElementById('subscribeForm');
const subscribeSuccess = document.getElementById('subscribeSuccess');

if (subscribeForm) {
    subscribeForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('sub-name').value.trim();
        const email = document.getElementById('sub-email').value.trim();
        const interests = Array.from(
            subscribeForm.querySelectorAll('input[name="interests"]:checked')
        ).map(cb => cb.value);

        // Validación
        if (!name || !email) {
            showFormError(subscribeForm, 'Por favor completa todos los campos.');
            return;
        }

        if (!isValidEmail(email)) {
            showFormError(subscribeForm, 'Por favor ingresa un email válido.');
            return;
        }

        // Deshabilitar botón
        const btn = document.getElementById('btn-subscribe');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>Enviando...</span>';
        btn.disabled = true;

        try {
            let handled = false;

            // Intentar backend
            try {
                const response = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, interests })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Error en la suscripción');
                }

                handled = true;
            } catch (apiErr) {
                // Si el backend no responde (ej. modo offline local), fallback a localStorage
                if (apiErr.message && !apiErr.message.includes('Failed to fetch') && !apiErr.message.includes('NetworkError')) {
                    throw apiErr;
                }
                const subscribers = JSON.parse(localStorage.getItem('cyp_subscribers') || '[]');
                subscribers.push({ name, email, interests, date: new Date().toISOString() });
                localStorage.setItem('cyp_subscribers', JSON.stringify(subscribers));
                handled = true;
            }

            if (handled) {
                // Desbloquear sección de noticias automáticamente
                localStorage.setItem('cyp_subscriber', 'true');
                localStorage.setItem('cyp_subscriber_email', email);
                const lockOverlay = document.getElementById('newsLockOverlay');
                if (lockOverlay) lockOverlay.classList.add('unlocked');

                subscribeForm.style.display = 'none';
                subscribeSuccess.classList.add('show');
                console.log(`%c✅ Suscriptor registrado: ${name} (${email})`, 'color: #22c55e; font-weight: bold;');
            }

        } catch (error) {
            console.error('Error al suscribir:', error);
            showFormError(subscribeForm, error.message || 'Hubo un error. Intenta de nuevo.');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

// ===== FORMULARIO DE SUGERENCIAS =====
const suggestionsForm = document.getElementById('suggestionsForm');
const suggestSuccess = document.getElementById('suggestSuccess');

if (suggestionsForm) {
    suggestionsForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const sugName = document.getElementById('sug-name').value.trim() || 'Anónimo';
        const sugTopic = document.getElementById('sug-topic').value.trim();
        const sugWhen = document.getElementById('sug-when').value;

        if (!sugTopic) {
            showFormError(suggestionsForm, 'Por favor escribe tu sugerencia.');
            return;
        }

        const btn = document.getElementById('btn-suggest');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>Enviando...</span>';
        btn.disabled = true;

        try {
            let handled = false;

            try {
                const response = await fetch('/api/suggest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: sugName, topic: sugTopic, timing: sugWhen })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Error enviando sugerencia');
                }
                handled = true;
            } catch (apiErr) {
                if (apiErr.message && !apiErr.message.includes('Failed to fetch') && !apiErr.message.includes('NetworkError')) {
                    throw apiErr;
                }
                const suggestions = JSON.parse(localStorage.getItem('cyp_suggestions') || '[]');
                suggestions.push({ name: sugName, topic: sugTopic, timing: sugWhen, date: new Date().toISOString() });
                localStorage.setItem('cyp_suggestions', JSON.stringify(suggestions));
                handled = true;
            }

            if (handled) {
                suggestionsForm.style.display = 'none';
                suggestSuccess.classList.add('show');
                console.log(`%c💡 Sugerencia enviada: "${sugTopic}"`, 'color: #f0b932; font-weight: bold;');
            }

        } catch (error) {
            console.error('Error al enviar sugerencia:', error);
            showFormError(suggestionsForm, error.message || 'Hubo un error. Intenta de nuevo.');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

// ===== UTILIDADES DE FORMULARIO =====
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFormError(form, message) {
    const existing = form.querySelector('.form-error');
    if (existing) existing.remove();

    const errorEl = document.createElement('div');
    errorEl.className = 'form-error';
    errorEl.style.cssText = `
        color: #ff4444;
        font-size: 0.85rem;
        padding: 10px 16px;
        margin-bottom: 16px;
        background: rgba(255, 68, 68, 0.1);
        border: 1px solid rgba(255, 68, 68, 0.3);
        border-radius: 8px;
        text-align: center;
    `;
    errorEl.textContent = message;
    form.insertBefore(errorEl, form.firstChild);
    setTimeout(() => errorEl.remove(), 5000);
}


/* ============================================
   FLOATING SOCIAL BUTTONS - HIDE ON SCROLL TOP
   ============================================ */
const floatingSocial = document.getElementById('floating-social');
if (floatingSocial) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            floatingSocial.style.opacity = '1';
            floatingSocial.style.pointerEvents = 'auto';
        } else {
            floatingSocial.style.opacity = '0';
            floatingSocial.style.pointerEvents = 'none';
        }
    });
    floatingSocial.style.opacity = '0';
    floatingSocial.style.pointerEvents = 'none';
    floatingSocial.style.transition = 'opacity 0.3s ease';
}


// ===== CONSOLE BRANDING =====
console.log('%cCALLE Y PODER 🔴', 'color: #e01020; font-size: 24px; font-weight: bold; font-family: Oswald, sans-serif;');
console.log('%cSitio web oficial del canal de YouTube', 'color: #a0a0b0; font-size: 12px;');
console.log('%c📰 Backend activo | 📧 Suscripciones conectadas', 'color: #6a6a75; font-size: 11px;');
