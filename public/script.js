// ===== Helpers =====
function $(id) { return document.getElementById(id) }

// ===== i18n (FR / EN) =====
const I18N = {
    fr: {
        loginSpotify: 'Se connecter avec Spotify',
        joinJam: 'Se connecter à un Jam',
        joinJamTitle: 'Rejoindre un Jam',
        jamCodeLabel: 'Code du Jam',
        jamCodePlaceholder: 'Code du Jam...',
        join: 'Rejoindre',
        back: 'Retour',
        disconnect: 'Se déconnecter',
        createJam: 'Créer un Jam',
        connected: 'Connecté',
        copyInvite: 'Copier le lien d\'invitation',
        linkCopied: 'Lien copié !',
        playPause: 'Lecture / Pause',
        next: 'Suivante',
        stopJam: 'Arrêter le Jam',
        nowPlaying: 'Lecture en cours',
        addMusic: 'Ajouter une musique',
        searchLabel: 'Rechercher une musique',
        searchPlaceholder: 'Titre, artiste...',
        search: 'Chercher',
        queue: 'File d\'attente',
        refresh: 'Rafraîchir',
        leaveJam: 'Quitter le Jam',
        cancel: 'Annuler',
        confirm: 'Confirmer',
        stopConfirm: 'Arrêter le Jam pour tout le monde ?',
        host: 'Host : {name}',
        members: '{n} invité(s)',
        nothingPlaying: 'Rien en lecture',
        pauseSuffix: ' (pause)',
        errConnectFirst: 'Connecte-toi à Spotify d\'abord',
        errCreateJam: 'Création du Jam échouée',
        errAdd: 'Ajout échoué (Spotify actif sur un appareil ?)',
        errSkip: 'Skip échoué (Spotify actif sur un appareil ?)',
        errPlayPause: 'Play/pause échoué (Spotify actif sur un appareil ?)',
        errJamNotFound: 'Jam introuvable',
        errJoin: 'Impossible de rejoindre',
        errJamGone: 'Jam introuvable ou terminé',
        copyPrompt: 'Copie ce lien :'
    },
    en: {
        loginSpotify: 'Log in with Spotify',
        joinJam: 'Join a Jam',
        joinJamTitle: 'Join a Jam',
        jamCodeLabel: 'Jam code',
        jamCodePlaceholder: 'Jam code...',
        join: 'Join',
        back: 'Back',
        disconnect: 'Log out',
        createJam: 'Create a Jam',
        connected: 'Connected',
        copyInvite: 'Copy invite link',
        linkCopied: 'Link copied!',
        playPause: 'Play / Pause',
        next: 'Next',
        stopJam: 'Stop the Jam',
        nowPlaying: 'Now playing',
        addMusic: 'Add a track',
        searchLabel: 'Search for a track',
        searchPlaceholder: 'Title, artist...',
        search: 'Search',
        queue: 'Queue',
        refresh: 'Refresh',
        leaveJam: 'Leave the Jam',
        cancel: 'Cancel',
        confirm: 'Confirm',
        stopConfirm: 'Stop the Jam for everyone?',
        host: 'Host: {name}',
        members: '{n} guest(s)',
        nothingPlaying: 'Nothing playing',
        pauseSuffix: ' (paused)',
        errConnectFirst: 'Log in with Spotify first',
        errCreateJam: 'Failed to create Jam',
        errAdd: 'Add failed (is Spotify active on a device?)',
        errSkip: 'Skip failed (is Spotify active on a device?)',
        errPlayPause: 'Play/pause failed (is Spotify active on a device?)',
        errJamNotFound: 'Jam not found',
        errJoin: 'Unable to join',
        errJamGone: 'Jam not found or ended',
        copyPrompt: 'Copy this link:'
    }
}

let currentLang = 'fr'

// Traduit une clé, avec interpolation {name} / {n}
function t(key, params) {
    let str = (I18N[currentLang] && I18N[currentLang][key]) || (I18N.fr[key]) || key
    if (params) {
        Object.keys(params).forEach(function(p) {
            str = str.replace('{' + p + '}', params[p])
        })
    }
    return str
}

// Applique les traductions à tous les éléments marqués data-i18n*
function applyI18n() {
    document.documentElement.lang = currentLang

    document.querySelectorAll('[data-i18n]').forEach(function(el) {
        el.textContent = t(el.getAttribute('data-i18n'))
    })
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'))
    })
    document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
        el.title = t(el.getAttribute('data-i18n-title'))
    })

    // État visuel du toggle
    const fr = $('langFr'), en = $('langEn')
    if (fr && en) {
        fr.classList.toggle('active', currentLang === 'fr')
        en.classList.toggle('active', currentLang === 'en')
    }
}

// Change la langue, persiste, re-rend la vue courante
function setLang(lang) {
    if (lang !== 'fr' && lang !== 'en') return
    currentLang = lang
    try { localStorage.setItem('freejamLang', lang) } catch (e) {}
    applyI18n()
    routeView() // re-rend les textes dynamiques (host, file, lecture) dans la nouvelle langue
}

// L'utilisateur préfère-t-il moins d'animations ?
function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Toast non bloquant (remplace alert)
function toast(message, type) {
    const box = $('toasts')
    if (!box) { return }
    const el = document.createElement('div')
    el.className = 'toast' + (type ? ' ' + type : '')
    el.setAttribute('role', type === 'error' ? 'alert' : 'status')
    el.textContent = message
    box.appendChild(el)

    setTimeout(function() {
        el.classList.add('out')
        setTimeout(function() { el.remove() }, 250)
    }, 3200)
}

// Confirm custom (remplace confirm() natif bloquant) → renvoie une Promise<boolean>
function confirmDialog(message) {
    return new Promise(function(resolve) {
        const overlay = $('confirmOverlay')
        $('confirmText').textContent = message
        overlay.classList.remove('hidden')

        function cleanup(result) {
            overlay.classList.add('hidden')
            $('confirmOk').removeEventListener('click', onOk)
            $('confirmCancel').removeEventListener('click', onCancel)
            overlay.removeEventListener('click', onBackdrop)
            document.removeEventListener('keydown', onKey)
            resolve(result)
        }
        function onOk() { cleanup(true) }
        function onCancel() { cleanup(false) }
        function onBackdrop(e) { if (e.target === overlay) cleanup(false) }
        function onKey(e) { if (e.key === 'Escape') cleanup(false) }

        $('confirmOk').addEventListener('click', onOk)
        $('confirmCancel').addEventListener('click', onCancel)
        overlay.addEventListener('click', onBackdrop)
        document.addEventListener('keydown', onKey)
    })
}

async function getJSON(url) {
    const res = await fetch(url)
    return res.json()
}

async function postJSON(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    })
    return { status: res.status, data: await res.json().catch(function() { return {} }) }
}

let jamPoll = null // timer de rafraîchissement de la salle Jam

// ===== Routing : quelle vue afficher ? =====
async function routeView() {
    const state = await getJSON('/jam/state')
    if (state.inJam) {
        enterJamRoom(state)
        return
    }
    // Pas dans un Jam → connecté (home) ou landing
    const me = await getJSON('/api/me')
    if (me.connected) {
        fillHome(me)
        showView('appView')
    } else {
        showView('landing')
    }
}

function fillHome(me) {
    $('name').textContent = me.name
    $('iscon').textContent = t('connected')
    if (me.images && me.images[0]) $('profileimage').src = me.images[0].url
}

// ===== Salle Jam (host + invité) =====
function enterJamRoom(state) {
    $('jamCodeLabel').textContent = state.code
    $('jamHostLabel').textContent = t('host', { name: state.hostName })
    $('jamMembers').textContent = t('members', { n: state.members })

    // Affiche les éléments selon le rôle
    const host = state.role === 'host'
    document.querySelectorAll('.hostOnly').forEach(function(el) { el.style.display = host ? '' : 'none' })
    document.querySelectorAll('.guestOnly').forEach(function(el) { el.style.display = host ? 'none' : '' })

    showView('jamRoom')
    refreshJam()

    // Polling régulier (lecture + file)
    clearInterval(jamPoll)
    jamPoll = setInterval(refreshJam, 6000)
}

async function refreshJam() {
    const btn = $('jamRefresh')
    btn.classList.add('spinning')
    try {
        await Promise.all([renderJamCurrent(), renderJamQueue()])
    } finally {
        btn.classList.remove('spinning')
    }
}

async function renderJamCurrent() {
    const data = await getJSON('/jam/current')
    const name = $('jamTrackName')
    const img = $('jamTrackImg')

    if (data.playing && data.name) {
        name.textContent = data.name + ' · ' + (data.artists || []).join(', ')
        if (data.image) img.src = data.image
    } else if (data.name) {
        // En pause mais une piste est chargée
        name.textContent = data.name + t('pauseSuffix')
        if (data.image) img.src = data.image
    } else {
        name.textContent = t('nothingPlaying')
        img.removeAttribute('src')
    }

    // Icône play/pause du host reflète l'état
    setPlayPauseIcon(data.playing)
}

// Icônes SVG centrées (pas d'emoji qui rend mal)
const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'
const ICON_PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'

function setPlayPauseIcon(playing) {
    const pp = $('jamPlayPause')
    if (pp) pp.innerHTML = playing ? ICON_PAUSE : ICON_PLAY
}

async function renderJamQueue() {
    const data = await getJSON('/jam/queue')
    const list = $('jamQueue')
    if (!data.queue) { list.innerHTML = ''; return }

    list.innerHTML = ''
    data.queue.forEach(function(track) {
        const row = document.createElement('div')
        row.className = 'songList'

        const img = document.createElement('img')
        if (track.image) img.src = track.image

        const info = document.createElement('div')
        info.textContent = track.name + ' · ' + (track.artists || []).join(', ')

        row.appendChild(img)
        row.appendChild(info)
        list.appendChild(row)
    })
}

// Recherche + ajout (tous les membres)
async function jamSearch() {
    const q = $('jamSearchInput').value
    if (!q.trim()) return

    const data = await getJSON('/jam/search?q=' + encodeURIComponent(q))
    const box = $('jamResults')
    box.innerHTML = ''

    ;
    (data.results || []).forEach(function(track) {
        const row = document.createElement('div')
        row.className = 'songList'

        const img = document.createElement('img')
        if (track.image) img.src = track.image

        const info = document.createElement('div')
        info.textContent = track.name + ' · ' + track.artists.join(', ')

        const addBtn = document.createElement('button')
        addBtn.className = 'addBtn'
        addBtn.setAttribute('aria-label', t('addMusic'))
        addBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>'
        addBtn.addEventListener('click', function() { jamAdd(track.uri, addBtn) })

        row.appendChild(img)
        row.appendChild(info)
        row.appendChild(addBtn)
        box.appendChild(row)
    })
}

async function jamAdd(uri, btn) {
    const r = await postJSON('/jam/add', { uri })
    if (r.data.ok) {
        $('jamResults').innerHTML = ''
        $('jamSearchInput').value = ''
        renderJamQueue()
    } else {
        // pas de device actif ?
        toast(t('errAdd'), 'error')
    }
}

// ===== Actions Jam =====
async function createJam(e) {
    const r = await postJSON('/jam/create')
    if (r.status === 401) {
        toast(t('errConnectFirst'), 'error')
        return
    }
    if (!r.data.ok) { toast(t('errCreateJam'), 'error'); return }
    floodTransition(paletteColor('--magenta'), e && e.clientX, e && e.clientY, routeView)
}

async function joinJam() {
    const code = $('jamCode').value.trim().toUpperCase()
    const err = $('jamJoinError')
    err.textContent = ''
    if (!code) return

    const r = await postJSON('/jam/join', { code })
    if (r.status === 404) { err.textContent = t('errJamNotFound'); return }
    if (!r.data.ok) { err.textContent = t('errJoin'); return }

    floodTransition(paletteColor('--magenta'), null, null, routeView)
}

async function leaveJam(e) {
    await postJSON('/jam/leave')
    clearInterval(jamPoll)
    floodTransition(paletteColor('--blue'), e && e.clientX, e && e.clientY, routeView)
}

async function stopJam(e) {
    if (!await confirmDialog(t('stopConfirm'))) return
    await postJSON('/jam/stop')
    clearInterval(jamPoll)
    floodTransition(paletteColor('--red'), e && e.clientX, e && e.clientY, routeView)
}

// Copie le lien d'invitation dans le presse-papier
function copyInvite() {
    const code = $('jamCodeLabel').textContent
    if (!code) return
    const url = location.origin + '/?jam=' + code
    const btn = $('jamInvite')

    function done() {
        btn.textContent = t('linkCopied')
        setTimeout(function() { btn.textContent = t('copyInvite') }, 1800)
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function() { fallbackCopy(url, done) })
    } else {
        fallbackCopy(url, done)
    }
}

// Fallback si l'API clipboard indispo (vieux navigateur / http)
function fallbackCopy(text, done) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy'); done() } catch (e) { prompt(t('copyPrompt'), text) }
    document.body.removeChild(ta)
}

// Auto-join si on arrive via un lien ?jam=CODE
async function handleInviteLink() {
    const code = new URLSearchParams(location.search).get('jam')
    if (!code) return false

    history.replaceState({}, '', location.pathname) // nettoie l'URL
    const r = await postJSON('/jam/join', { code: code.toUpperCase() })
    if (r.data.ok) return false // rejoint → routeView affichera la salle

    // Échec → vue saisie code préremplie
    showView('jamView')
    $('jamCode').value = code.toUpperCase()
    $('jamJoinError').textContent = t('errJamGone')
    return true // on a déjà géré la vue
}

async function jamSkip() {
    const r = await postJSON('/jam/skip')
    if (!r.data.ok) { toast(t('errSkip'), 'error'); return }
    setTimeout(refreshJam, 400) // laisse Spotify changer de piste
}

async function jamPlayPause() {
    const r = await postJSON('/jam/playpause')
    if (!r.data.ok) { toast(t('errPlayPause'), 'error'); return }
    setPlayPauseIcon(r.data.playing)
}

// ===== Transition iris : disque plein puis trou transparent =====
function floodTransition(color, x, y, onCovered) {
    // Reduced motion : bascule la vue sans animation iris
    if (prefersReducedMotion()) { onCovered(); return }

    const flood = $('flood')
    const cutter = $('cutter')

    if (x == null) x = window.innerWidth / 2
    if (y == null) y = window.innerHeight / 2

    flood.style.left = cutter.style.left = x + 'px'
    flood.style.top = cutter.style.top = y + 'px'
    flood.style.background = color
    cutter.style.boxShadow = '0 0 0 300vmax ' + color

    cutter.classList.remove('active')
    cutter.style.opacity = 0

    flood.classList.remove('active')
    void flood.offsetWidth
    flood.classList.add('active')

    setTimeout(function() {
        onCovered() // bascule la page pile quand l'écran est couvert

        setTimeout(function() {
            cutter.classList.add('active')

            // On cache le flood seulement une fois le cutter peint (évite le flash)
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    flood.classList.remove('active')
                    flood.style.opacity = 0
                })
            })

            setTimeout(function() {
                cutter.classList.remove('active')
                cutter.style.opacity = 0
            }, 500)
        }, 260)
    }, 500)
}

function paletteColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// Transition pour une vraie navigation (changement d'URL)
function floodNavigate(color, x, y, url) {
    // Reduced motion : navigue directement sans animation iris
    if (prefersReducedMotion()) { window.location.href = url; return }

    const flood = $('flood')
    if (x == null) x = window.innerWidth / 2
    if (y == null) y = window.innerHeight / 2

    flood.style.left = x + 'px'
    flood.style.top = y + 'px'
    flood.style.background = color

    flood.classList.remove('active')
    void flood.offsetWidth
    flood.classList.add('active')

    sessionStorage.setItem('freejamReveal', color)
    setTimeout(function() { window.location.href = url }, 520)
}

// Au chargement : découvre la page si on vient d'une transition de navigation
function playEntranceReveal() {
    const color = sessionStorage.getItem('freejamReveal')
    if (!color) return
    sessionStorage.removeItem('freejamReveal')

    if (prefersReducedMotion()) return // pas de reveal animé

    const cutter = $('cutter')
    cutter.style.left = '50%'
    cutter.style.top = '50%'
    cutter.style.boxShadow = '0 0 0 300vmax ' + color
    cutter.classList.add('active')

    setTimeout(function() {
        cutter.classList.remove('active')
        cutter.style.opacity = 0
    }, 520)
}

// ===== Vues =====
function showView(id) {
    clearInterval(jamPoll) // stoppe le polling en quittant la salle Jam
    ;
    ['landing', 'jamView', 'appView', 'jamRoom'].forEach(function(v) {
        $(v).classList.toggle('hidden', v !== id)
    })
    // formes de fond construites une seule fois au démarrage (pas à chaque vue)
}

// ===== Listeners =====
// Bouton Spotify : couvre puis navigue (reveal rejoué au retour)
$('login').addEventListener('click', function(e) {
    e.preventDefault()
    floodNavigate(paletteColor('--lime'), e.clientX, e.clientY, '/login')
})

// Bouton "Se connecter à un Jam" → vue saisie code
$('joinJam').addEventListener('click', function(e) {
    e.preventDefault()
    floodTransition(paletteColor('--magenta'), e.clientX, e.clientY, function() { showView('jamView') })
})

// Retour landing depuis la vue Jam
$('jamBack').addEventListener('click', function(e) {
    floodTransition(paletteColor('--blue'), e.clientX, e.clientY, function() { showView('landing') })
})

// Rejoindre un Jam
$('jamJoinBtn').addEventListener('click', joinJam)
$('jamCode').addEventListener('keydown', function(e) { if (e.key === 'Enter') joinJam() })

// Créer un Jam (home)
$('createJamBtn').addEventListener('click', createJam)

// Contrôles salle Jam
$('jamPlayPause').addEventListener('click', jamPlayPause)
$('jamSkip').addEventListener('click', jamSkip)
$('jamStop').addEventListener('click', stopJam)
$('jamLeave').addEventListener('click', leaveJam)
$('jamRefresh').addEventListener('click', refreshJam)
$('jamInvite').addEventListener('click', copyInvite)
$('jamSearchBtn').addEventListener('click', jamSearch)
$('jamSearchInput').addEventListener('keydown', function(e) { if (e.key === 'Enter') jamSearch() })

// Bascule langue FR / EN
$('langFr').addEventListener('click', function() { setLang('fr') })
$('langEn').addEventListener('click', function() { setLang('en') })

// Onglet caché : stoppe le polling (économie réseau). Visible : reprend si on est en salle Jam.
document.addEventListener('visibilitychange', function() {
    const inRoom = !$('jamRoom').classList.contains('hidden')
    if (document.hidden) {
        clearInterval(jamPoll)
    } else if (inRoom) {
        refreshJam()
        clearInterval(jamPoll)
        jamPoll = setInterval(refreshJam, 6000)
    }
})

// ===== Colonnes de formes Wrapped (côtés PC) =====
function buildSideShapes() {
    const SHAPES = ['sq', 'circle', 'half', 'triUp', 'triDown', 'diamond', 'pent', 'star']
    const COLORS = ['#f0524a', '#ff8ad8', '#ffa64d', '#6f6cf0', '#6fae6f', '#ff3d9a']

    function starClip(spikes, outer, inner) {
        const pts = []
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outer : inner
            const a = (Math.PI / spikes) * i - Math.PI / 2
            pts.push((50 + Math.cos(a) * r).toFixed(1) + '% ' + (50 + Math.sin(a) * r).toFixed(1) + '%')
        }
        return 'polygon(' + pts.join(',') + ')'
    }
    const STAR = starClip(12, 50, 32)

    function makeShape() {
        const type = SHAPES[Math.floor(Math.random() * SHAPES.length)]
        const color = COLORS[Math.floor(Math.random() * COLORS.length)]
        const el = document.createElement('span')
        el.className = 'shape ' + type
        el.style.background = color
        if (type === 'star') el.style.setProperty('--star-clip', STAR)
        return el
    }

    function buildColumn(dir, dur) {
        const col = document.createElement('div')
        col.className = 'shapeCol ' + dir
        col.style.animationDuration = dur + 's'

        const set = []
        for (let i = 0; i < 11; i++) set.push(makeShape())
        set.forEach(function(s) { col.appendChild(s) })
        set.forEach(function(s) { col.appendChild(s.cloneNode(true)) })
        return col
    }

    // Décalage pixel exact d'un set (formes de hauteurs variables) → boucle sans saut.
    // total(2 sets) = 2*setBlock + gap  ⇒  shift = setBlock + gap = (total + gap) / 2
    function setShift(col) {
        const gap = parseFloat(getComputedStyle(col).rowGap) || 0
        let sum = 0
        for (let i = 0; i < col.children.length; i++) sum += col.children[i].offsetHeight
        const total = sum + gap * (col.children.length - 1)
        col.style.setProperty('--shift', ((total + gap) / 2) + 'px')
    }

    document.querySelectorAll('.sideShapes').forEach(function(side, sideIdx) {
        side.innerHTML = ''
        const cols = parseInt(side.dataset.cols || '3', 10)
        for (let c = 0; c < cols; c++) {
            const dir = (c + sideIdx) % 2 === 0 ? 'up' : 'down'
            const dur = 22 + c * 6 + sideIdx * 3
            const col = buildColumn(dir, dur)
            side.appendChild(col)
            setShift(col) // mesure après insertion (offsetHeight dispo)
        }
    })
}

// ===== Démarrage =====
// Langue initiale : localStorage, sinon langue navigateur, sinon FR
(function initLang() {
    let saved
    try { saved = localStorage.getItem('freejamLang') } catch (e) {}
    if (saved === 'fr' || saved === 'en') currentLang = saved
    else if ((navigator.language || '').toLowerCase().slice(0, 2) === 'en') currentLang = 'en'
    applyI18n()
})()

buildSideShapes()
playEntranceReveal()
;(async function start() {
    const handled = await handleInviteLink() // lien ?jam=CODE
    if (!handled) routeView()
})()