async function curentSongPlayed() {

    const res = await fetch('/curent')
    const data = await res.json()

    const track = document.getElementById('track')

    if (data.playing) {
        track.style.display = 'flex'
        document.getElementById('trackname').textContent = data.name
        document.getElementById('trackimg').src = data.image
    } else {
        // Rien en lecture : feedback au lieu de clic muet
        track.style.display = 'flex'
        document.getElementById('trackname').textContent = 'Rien en lecture'
        document.getElementById('trackimg').removeAttribute('src')
    }
}

async function getQueu() {
    const res = await fetch('/queue');
    const data = await res.json();

    if (!data.queue) return; // pas connecté / rien à afficher

    const list = document.getElementById('file');

    list.innerHTML = '' // vide avant de remplir, sinon doublons à chaque clic

    for (let i = 0; i < data.queue.length; i++) {

        let nextSong = document.createElement("div")
        let nextSong_Name = document.createElement("div")
        let nextSong_Img = document.createElement("img")

        nextSong.className = 'songList';
        nextSong_Name.textContent = data.queue[i].name
        nextSong_Img.src = data.queue[i].image
        nextSong_Img.width = 80

        nextSong.appendChild(nextSong_Name);
        nextSong.appendChild(nextSong_Img);
        list.appendChild(nextSong);
    }

}

async function checkAuth() {
    const res = await fetch('/api/me')
    const data = await res.json()

    const landing = document.getElementById('landing')
    const appView = document.getElementById('appView')
    const jamView = document.getElementById('jamView')

    if (data.connected) {
        // Connecté → vue app
        document.getElementById('name').textContent = 'Name : ' + data.name
        document.getElementById('iscon').textContent = "Conected"
        document.getElementById('profileimage').src = data.images[0].url

        landing.classList.add('hidden')
        jamView.classList.add('hidden')
        appView.classList.remove('hidden')

        curentSongPlayed()
        getQueu()
    } else {
        // Déconnecté → vue landing
        landing.classList.remove('hidden')
        jamView.classList.add('hidden')
        appView.classList.add('hidden')
    }
}
playEntranceReveal(); // découvre la page si on arrive d'une transition de navigation
checkAuth();

checkBut = document.getElementById("curentbouton")

checkBut.addEventListener("click", function() {
    curentSongPlayed()
})

listBut = document.getElementById("listbutton")

listBut.addEventListener("click", function() {
    getQueu()
})

// ===== Transition iris : disque plein puis trou transparent =====
function floodTransition(color, x, y, onCovered) {
    const flood = document.getElementById('flood')
    const cutter = document.getElementById('cutter')

    // Origine = point de clic (centre par défaut)
    if (x == null) x = window.innerWidth / 2
    if (y == null) y = window.innerHeight / 2

    flood.style.left = cutter.style.left = x + 'px'
    flood.style.top = cutter.style.top = y + 'px'
    flood.style.background = color
    cutter.style.boxShadow = '0 0 0 300vmax ' + color // même couleur = raccord invisible

    // Reset cutter
    cutter.classList.remove('active')
    cutter.style.opacity = 0

    // Phase 1 : disque plein de couleur grandit depuis le clic
    flood.classList.remove('active')
    void flood.offsetWidth // force le redémarrage de l'animation
    flood.classList.add('active')

    setTimeout(function() {
        onCovered() // bascule la page pile quand l'écran est couvert (couleur pleine)

        // HOLD : on garde l'écran tout coloré un instant pendant le changement
        setTimeout(function() {
            // Phase 2 : trou transparent découpe la couleur → révèle la page
            cutter.classList.add('active') // démarre plein (trou = 0), même couleur

            // On cache le flood SEULEMENT une fois le cutter peint (évite le flash)
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
        }, 260) // durée du maintien couleur
    }, 500)
}

// Récupère une couleur de la palette CSS
function paletteColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// Transition pour une VRAIE navigation (changement d'URL).
// On couvre l'écran de couleur, on mémorise, puis on navigue.
// Le reveal sera rejoué au chargement de la nouvelle page → la transition enjambe la navigation.
function floodNavigate(color, x, y, url) {
    const flood = document.getElementById('flood')
    if (x == null) x = window.innerWidth / 2
    if (y == null) y = window.innerHeight / 2

    flood.style.left = x + 'px'
    flood.style.top = y + 'px'
    flood.style.background = color

    flood.classList.remove('active')
    void flood.offsetWidth
    flood.classList.add('active')

    sessionStorage.setItem('freejamReveal', color) // mémorise pour la page suivante
    setTimeout(function() { window.location.href = url }, 520)
}

// Au chargement : si on vient d'une navigation avec transition, on découvre la page.
function playEntranceReveal() {
    const color = sessionStorage.getItem('freejamReveal')
    if (!color) return
    sessionStorage.removeItem('freejamReveal')

    const cutter = document.getElementById('cutter')
    cutter.style.left = '50%'
    cutter.style.top = '50%'
    cutter.style.boxShadow = '0 0 0 300vmax ' + color
    cutter.classList.add('active') // écran plein couleur → trou s'ouvre → page révélée

    setTimeout(function() {
        cutter.classList.remove('active')
        cutter.style.opacity = 0
    }, 520)
}

function showView(id) {
    ['landing', 'jamView', 'appView'].forEach(function(v) {
        document.getElementById(v).classList.toggle('hidden', v !== id)
    })
    buildSideShapes() // formes neuves à chaque page
}

// Bouton Spotify : couvre puis navigue (reveal rejoué au retour)
document.getElementById('login').addEventListener('click', function(e) {
    e.preventDefault()
    floodNavigate(paletteColor('--lime'), e.clientX, e.clientY, '/login')
})

// Bouton Jam : flood magenta puis vue Jam
document.getElementById('joinJam').addEventListener('click', function(e) {
    e.preventDefault()
    floodTransition(paletteColor('--magenta'), e.clientX, e.clientY,
        function() { showView('jamView') })
})

// Retour landing depuis Jam
document.getElementById('jamBack').addEventListener('click', function(e) {
    floodTransition(paletteColor('--blue'), e.clientX, e.clientY,
        function() { showView('landing') })
})

// Rejoindre un Jam (stub — à câbler plus tard)
document.getElementById('jamJoinBtn').addEventListener('click', function() {
    const code = document.getElementById('jamCode').value.trim()
    if (!code) return
    alert('Jam "' + code + '" — fonctionnalité à venir')
})

// ===== Colonnes de formes Wrapped (côtés PC) =====
function buildSideShapes() {
    const SHAPES = ['sq', 'circle', 'half', 'triUp', 'triDown', 'diamond', 'pent', 'chevron', 'peanut', 'star']
    const COLORS = ['#f0524a', '#ff8ad8', '#ffa64d', '#6f6cf0', '#6fae6f', '#ff3d9a']

    // Génère un clip-path d'étoile/burst
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

        // Un set de formes (assez haut pour dépasser l'écran)
        const set = []
        for (let i = 0; i < 11; i++) set.push(makeShape())
        // Set + sa copie → translateY(-50%) reboucle sans coupure
        set.forEach(function(s) { col.appendChild(s) })
        set.forEach(function(s) { col.appendChild(s.cloneNode(true)) })
        return col
    }

    const sides = document.querySelectorAll('.sideShapes')
    sides.forEach(function(side, sideIdx) {
        side.innerHTML = '' // vide avant de regénérer (formes neuves à chaque page)
        const cols = parseInt(side.dataset.cols || '3', 10)
        for (let c = 0; c < cols; c++) {
            const dir = (c + sideIdx) % 2 === 0 ? 'up' : 'down' // alterne haut/bas
            const dur = 22 + c * 6 + sideIdx * 3 // vitesses désynchronisées
            side.appendChild(buildColumn(dir, dur))
        }
    })
}

buildSideShapes() // construction initiale

// --- Recherche + ajout à la queue ---

async function searchTracks() {
    const q = document.getElementById('searchInput').value
    if (!q.trim()) return

    const res = await fetch('/search?q=' + encodeURIComponent(q))
    const data = await res.json()

    const box = document.getElementById('searchResults')
    box.innerHTML = ''

    for (let i = 0; i < data.results.length; i++) {
        const t = data.results[i]

        const row = document.createElement('div')
        row.className = 'songList'

        const img = document.createElement('img')
        img.src = t.image
        img.width = 48

        const info = document.createElement('div')
        info.textContent = t.name + ' — ' + t.artists.join(', ')

        const addBtn = document.createElement('button')
        addBtn.textContent = '+'
        addBtn.className = 'addBtn'
        addBtn.addEventListener('click', function() {
            addToQueue(t.uri, addBtn)
        })

        row.appendChild(img)
        row.appendChild(info)
        row.appendChild(addBtn)
        box.appendChild(row)
    }
}

async function addToQueue(uri, btn) {
    const res = await fetch('/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri })
    })
    const data = await res.json()

    if (data.ok) {
        btn.textContent = '✓' // feedback ajouté
        getQueu() // rafraîchit la file
        document.getElementById('searchResults').innerHTML = ""
    } else {
        btn.textContent = '✗' // échec (pas de device actif ?)
    }
}

const searchButton = document.getElementById('searchButton')
searchButton.addEventListener('click', searchTracks)

// Entrée clavier = lance la recherche
document.getElementById('searchInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') searchTracks()
})

//NEWS