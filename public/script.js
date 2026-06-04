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
checkAuth();

checkBut = document.getElementById("curentbouton")

checkBut.addEventListener("click", function() {
    curentSongPlayed()
})

listBut = document.getElementById("listbutton")

listBut.addEventListener("click", function() {
    getQueu()
})

// ===== Transition Mario : la couleur inonde l'écran =====
function floodTransition(color, onCovered) {
    const flood = document.getElementById('flood')
    flood.style.background = color
    flood.classList.remove('out')
    flood.classList.add('active')

    // À mi-course l'écran est couvert → on bascule la page
    setTimeout(function() {
        onCovered()
        // Puis on retire le voile pour révéler la nouvelle page
        flood.classList.remove('active')
        flood.classList.add('out')
    }, 550)
}

function showView(id) {
    ['landing', 'jamView', 'appView'].forEach(function(v) {
        document.getElementById(v).classList.toggle('hidden', v !== id)
    })
}

// Bouton Spotify : flood lime puis redirection OAuth
document.getElementById('login').addEventListener('click', function(e) {
    e.preventDefault()
    floodTransition(getComputedStyle(document.documentElement).getPropertyValue('--lime'),
        function() { window.location.href = '/login' })
})

// Bouton Jam : flood magenta puis vue Jam
document.getElementById('joinJam').addEventListener('click', function(e) {
    e.preventDefault()
    floodTransition(getComputedStyle(document.documentElement).getPropertyValue('--magenta'),
        function() { showView('jamView') })
})

// Retour landing depuis Jam
document.getElementById('jamBack').addEventListener('click', function() {
    floodTransition(getComputedStyle(document.documentElement).getPropertyValue('--blue'),
        function() { showView('landing') })
})

// Rejoindre un Jam (stub — à câbler plus tard)
document.getElementById('jamJoinBtn').addEventListener('click', function() {
    const code = document.getElementById('jamCode').value.trim()
    if (!code) return
    alert('Jam "' + code + '" — fonctionnalité à venir')
})

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