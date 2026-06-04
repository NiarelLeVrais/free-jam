// ===== Helpers =====
function $(id) { return document.getElementById(id) }

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
    $('iscon').textContent = 'Connecté'
    if (me.images && me.images[0]) $('profileimage').src = me.images[0].url
}

// ===== Salle Jam (host + invité) =====
function enterJamRoom(state) {
    $('jamCodeLabel').textContent = state.code
    $('jamHostLabel').textContent = 'Host : ' + state.hostName
    $('jamMembers').textContent = state.members + ' invité(s)'

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
    await Promise.all([renderJamCurrent(), renderJamQueue()])
}

async function renderJamCurrent() {
    const data = await getJSON('/jam/current')
    const name = $('jamTrackName')
    const img = $('jamTrackImg')

    if (data.playing && data.name) {
        name.textContent = data.name + ' — ' + (data.artists || []).join(', ')
        if (data.image) img.src = data.image
    } else if (data.name) {
        // En pause mais une piste est chargée
        name.textContent = data.name + ' (pause)'
        if (data.image) img.src = data.image
    } else {
        name.textContent = 'Rien en lecture'
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
        info.textContent = track.name + ' — ' + (track.artists || []).join(', ')

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
    (data.results || []).forEach(function(t) {
        const row = document.createElement('div')
        row.className = 'songList'

        const img = document.createElement('img')
        if (t.image) img.src = t.image

        const info = document.createElement('div')
        info.textContent = t.name + ' — ' + t.artists.join(', ')

        const addBtn = document.createElement('button')
        addBtn.textContent = '+'
        addBtn.className = 'addBtn'
        addBtn.addEventListener('click', function() { jamAdd(t.uri, addBtn) })

        row.appendChild(img)
        row.appendChild(info)
        row.appendChild(addBtn)
        box.appendChild(row)
    })
}

async function jamAdd(uri, btn) {
    const r = await postJSON('/jam/add', { uri })
    if (r.data.ok) {
        btn.textContent = '✓'
        $('jamResults').innerHTML = ''
        $('jamSearchInput').value = ''
        renderJamQueue()
    } else {
        btn.textContent = '✗' // pas de device actif ?
    }
}

// ===== Actions Jam =====
async function createJam(e) {
    const r = await postJSON('/jam/create')
    if (r.status === 401) {
        alert('Connecte-toi à Spotify d\'abord')
        return
    }
    if (!r.data.ok) { alert('Création du Jam échouée'); return }
    floodTransition(paletteColor('--magenta'), e && e.clientX, e && e.clientY, routeView)
}

async function joinJam() {
    const code = $('jamCode').value.trim().toUpperCase()
    const err = $('jamJoinError')
    err.textContent = ''
    if (!code) return

    const r = await postJSON('/jam/join', { code })
    if (r.status === 404) { err.textContent = 'Jam introuvable'; return }
    if (!r.data.ok) { err.textContent = 'Impossible de rejoindre'; return }

    floodTransition(paletteColor('--magenta'), null, null, routeView)
}

async function leaveJam(e) {
    await postJSON('/jam/leave')
    clearInterval(jamPoll)
    floodTransition(paletteColor('--blue'), e && e.clientX, e && e.clientY, routeView)
}

async function stopJam(e) {
    if (!confirm('Arrêter le Jam pour tout le monde ?')) return
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
        btn.textContent = 'Lien copié !'
        setTimeout(function() { btn.textContent = 'Copier le lien d\'invitation' }, 1800)
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
    try { document.execCommand('copy'); done() } catch (e) { prompt('Copie ce lien :', text) }
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
    $('jamJoinError').textContent = 'Jam introuvable ou terminé'
    return true // on a déjà géré la vue
}

async function jamSkip() {
    const r = await postJSON('/jam/skip')
    if (!r.data.ok) { alert('Skip échoué (device actif ?)'); return }
    setTimeout(refreshJam, 400) // laisse Spotify changer de piste
}

async function jamPlayPause() {
    const r = await postJSON('/jam/playpause')
    if (!r.data.ok) { alert('Play/pause échoué (device actif ?)'); return }
    setPlayPauseIcon(r.data.playing)
}

// ===== Transition iris : disque plein puis trou transparent =====
function floodTransition(color, x, y, onCovered) {
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
    buildSideShapes() // formes neuves à chaque page
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

// ===== Colonnes de formes Wrapped (côtés PC) =====
function buildSideShapes() {
    const SHAPES = ['sq', 'circle', 'half', 'triUp', 'triDown', 'diamond', 'pent', 'chevron', 'peanut', 'star']
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
        if (type === 'peanut') el.style.setProperty('--peanut-color', color)
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

    document.querySelectorAll('.sideShapes').forEach(function(side, sideIdx) {
        side.innerHTML = ''
        const cols = parseInt(side.dataset.cols || '3', 10)
        for (let c = 0; c < cols; c++) {
            const dir = (c + sideIdx) % 2 === 0 ? 'up' : 'down'
            const dur = 22 + c * 6 + sideIdx * 3
            side.appendChild(buildColumn(dir, dur))
        }
    })
}

// ===== Démarrage =====
buildSideShapes()
playEntranceReveal()
;(async function start() {
    const handled = await handleInviteLink() // lien ?jam=CODE
    if (!handled) routeView()
})()