require('dotenv').config()
const express = require('express')
const session = require('express-session')
const SpotifyWebApi = require('spotify-web-api-node')
const app = express()

// Config Spotify (depuis .env)
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI

// Scopes demandés (tableau, requis par createAuthorizeURL)
const SCOPES = [
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing'
]

// Permet de lire le JSON dans les requêtes
app.use(express.json())

// Sessions : chaque visiteur a son propre cookie => son propre token Spotify.
// Si le serveur dédié est derrière HTTPS, mets cookie.secure = true + trust proxy.
app.set('trust proxy', 1)
app.use(session({
    secret: process.env.SESSION_SECRET || 'change-moi-en-prod',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
        secure: false // mets true si HTTPS
    }
}))

// Sert les fichiers statiques du dossier public (pas de cache sur les .js)
app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) res.setHeader('Cache-Control', 'no-store')
    }
}))

// Crée une instance Spotify pour CETTE session (tokens propres au visiteur)
function makeSpotify(sess) {
    const api = new SpotifyWebApi({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: REDIRECT_URI
    })
    if (sess.accessToken) api.setAccessToken(sess.accessToken)
    if (sess.refreshToken) api.setRefreshToken(sess.refreshToken)
    return api
}

// Renvoie une instance Spotify prête (token rafraîchi) pour N'IMPORTE QUEL
// porteur de token : une session OU un jam (mêmes champs accessToken/refreshToken/tokenExpiry).
async function ensureTokenFor(holder) {
    if (!holder.refreshToken) return null // pas connecté
    const api = new SpotifyWebApi({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri: REDIRECT_URI })
    api.setAccessToken(holder.accessToken)
    api.setRefreshToken(holder.refreshToken)

    if (!holder.tokenExpiry || Date.now() >= holder.tokenExpiry) {
        const data = await api.refreshAccessToken()
        holder.accessToken = data.body['access_token']
        holder.tokenExpiry = Date.now() + data.body['expires_in'] * 1000
        api.setAccessToken(holder.accessToken)
    }
    return api
}

// Raccourci session
function ensureToken(sess) {
    return ensureTokenFor(sess)
}

// ---------- JAM ----------
// Store en mémoire : code -> { hostId, hostName, tokens du host, members, createdAt }
const jams = new Map()

// Durée de vie d'un Jam non stoppé : 3 heures
const JAM_MAX_AGE = 3 * 60 * 60 * 1000

// Un Jam est expiré s'il a plus de 3h
function isExpired(jam) {
    return Date.now() - jam.createdAt > JAM_MAX_AGE
}

// Cherche un Jam encore valide créé par ce compte Spotify (réattache après reconnexion)
function findJamByHost(spotifyId) {
    for (const jam of jams.values()) {
        if (isExpired(jam)) { jams.delete(jam.code); continue }
        if (jam.hostId === spotifyId) return jam
    }
    return null
}

// Nettoyage périodique des Jams expirés (libère la mémoire)
setInterval(function() {
    for (const jam of jams.values()) {
        if (isExpired(jam)) jams.delete(jam.code)
    }
}, 30 * 60 * 1000)

// Génère un code court unique (sans caractères ambigus)
function makeJamCode() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    let code
    do {
        code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    } while (jams.has(code))
    return code
}

// Récupère le jam lié à la session (ou null si stoppé/absent/expiré)
function getJam(sess) {
    if (!sess.jam || !sess.jam.code) return null
    const jam = jams.get(sess.jam.code)
    if (!jam) return null
    if (isExpired(jam)) { jams.delete(jam.code); return null }
    return jam
}

function isHost(sess) {
    return sess.jam && sess.jam.role === 'host' && jams.has(sess.jam.code)
}

// Renvoie { jam, api } prêt (token du host rafraîchi), ou répond une erreur et null
async function jamApi(req, res) {
    const jam = getJam(req.session)
    if (!jam) {
        res.status(404).json({ error: 'Pas dans un Jam' })
        return null
    }
    const api = await ensureTokenFor(jam)
    if (!api) {
        res.status(500).json({ error: 'Token host invalide' })
        return null
    }
    return { jam, api }
}

// ---------- SPOTIFY ----------

app.get('/login', (req, res) => {
    const state = Math.random().toString(36).slice(2)
    req.session.state = state // anti-CSRF, vérifié au callback
    const api = makeSpotify(req.session)
    res.redirect(api.createAuthorizeURL(SCOPES, state))
})

app.get('/callback', async(req, res) => {
    const code = req.query.code
    const error = req.query.error

    if (error) return res.status(400).send('Spotify a refusé : ' + error)
    if (!code) return res.status(400).send('Pas de code dans le callback')
    if (req.query.state !== req.session.state) {
        return res.status(400).send('State invalide')
    }

    try {
        const api = makeSpotify(req.session)
        const data = await api.authorizationCodeGrant(code)
        req.session.accessToken = data.body['access_token']
        req.session.refreshToken = data.body['refresh_token']
        req.session.tokenExpiry = Date.now() + data.body['expires_in'] * 1000
        res.redirect('/')
    } catch (err) {
        console.error('Échange token échoué :', err.body || err.message)
        res.status(500).send('Échange du token échoué')
    }
})

// Statut connexion + profil utilisateur
app.get('/api/me', async(req, res) => {
    try {
        const api = await ensureToken(req.session)
        if (!api) return res.json({ connected: false })

        const data = await api.getMe()
        res.json({
            connected: true,
            name: data.body.display_name,
            id: data.body.id,
            images: data.body.images
        })
    } catch (err) {
        console.error('Récup profil échouée :', err.body || err.message)
        res.json({ connected: false })
    }
})

app.get('/disconect', (req, res) => {
    // Détruit uniquement LA session de ce visiteur
    req.session.destroy(() => res.redirect('/'))
})

app.get('/curent', async(req, res) => {
    try {
        const api = await ensureToken(req.session)
        if (!api) return res.json({ connected: false })

        const data = await api.getMyCurrentPlayingTrack()

        // Rien en lecture : Spotify renvoie un corps vide (204)
        if (!data.body || !data.body.item) {
            return res.json({ playing: false })
        }

        const track = data.body.item
        res.json({
            playing: true,
            name: track.name,
            artists: track.artists.map(a => a.name),
            album: track.album.name,
            image: track.album.images[0] && track.album.images[0].url
        })
    } catch (err) {
        console.error('Lecture en cours échouée :', err.body || err.message)
        res.status(500).json({ error: 'Lecture échouée' })
    }
})

// File d'attente : musiques qui vont arriver
app.get('/queue', async(req, res) => {
    try {
        const api = await ensureToken(req.session)
        if (!api) return res.json({ connected: false })

        // Appel direct : la lib ne wrappe pas /me/player/queue
        const r = await fetch('https://api.spotify.com/v1/me/player/queue', {
            headers: { Authorization: 'Bearer ' + api.getAccessToken() }
        })

        // 204 = rien en lecture
        if (r.status === 204) return res.json({ queue: [] })
        if (!r.ok) throw new Error('Spotify ' + r.status)

        const data = await r.json()
        const queue = (data.queue || []).map(track => ({
            name: track.name,
            artists: (track.artists || []).map(a => a.name), // épisode = pas d'artists
            album: track.album ? track.album.name : (track.show && track.show.name),
            image: ((track.album || track.show || {}).images || [])[0] &&
                ((track.album || track.show || {}).images || [])[0].url
        }))

        res.json({ queue })
    } catch (err) {
        console.error('Récup file échouée :', err.body || err.message)
        res.status(500).json({ error: 'File échouée' })
    }
})

// Recherche de musiques
app.get('/search', async(req, res) => {
    try {
        const api = await ensureToken(req.session)
        if (!api) return res.json({ connected: false })

        const q = (req.query.q || '').trim()
        if (!q) return res.json({ results: [] })

        const data = await api.searchTracks(q, { limit: 10 })
        const results = (data.body.tracks.items || []).map(track => ({
            uri: track.uri, // identifiant Spotify, requis pour ajouter à la queue
            name: track.name,
            artists: track.artists.map(a => a.name),
            album: track.album.name,
            image: track.album.images[0] && track.album.images[0].url
        }))

        res.json({ results })
    } catch (err) {
        console.error('Recherche échouée :', err.body || err.message)
        res.status(500).json({ error: 'Recherche échouée' })
    }
})

// Ajout d'une musique à la queue
app.post('/add', async(req, res) => {
    try {
        const api = await ensureToken(req.session)
        if (!api) return res.json({ connected: false })

        const uri = req.body.uri
        if (!uri) return res.status(400).json({ error: 'uri manquant' })

        await api.addToQueue(uri) // nécessite scope user-modify-playback-state + device actif
        res.json({ ok: true })
    } catch (err) {
        console.error('Ajout queue échoué :', err.body || err.message)
        // 404 = pas de device actif sur Spotify
        res.status(500).json({ error: 'Ajout échoué (device actif ?)' })
    }
})

// ---------- ROUTES JAM ----------

// Créer un Jam (host = doit être connecté à Spotify)
app.post('/jam/create', async(req, res) => {
    try {
        if (!req.session.refreshToken) {
            return res.status(401).json({ error: 'Connecte-toi à Spotify d\'abord' })
        }
        const api = await ensureToken(req.session)
        const me = await api.getMe()

        const code = makeJamCode()
        jams.set(code, {
            code,
            hostId: me.body.id, // identifie le host par son compte Spotify
            hostName: me.body.display_name,
            // Copie des tokens du host : les invités jouent sur SON Spotify
            accessToken: req.session.accessToken,
            refreshToken: req.session.refreshToken,
            tokenExpiry: req.session.tokenExpiry,
            members: 0,
            createdAt: Date.now()
        })
        req.session.jam = { code, role: 'host' }
        res.json({ ok: true, code, role: 'host' })
    } catch (err) {
        console.error('Création Jam échouée :', err.body || err.message)
        res.status(500).json({ error: 'Création Jam échouée' })
    }
})

// Rejoindre un Jam (invité, pas besoin de Spotify)
app.post('/jam/join', (req, res) => {
    const code = (req.body.code || '').trim().toUpperCase()
    const jam = jams.get(code)
    if (!jam) return res.status(404).json({ error: 'Jam introuvable' })

    req.session.jam = { code, role: 'guest' }
    jam.members++
    res.json({ ok: true, code, role: 'guest', hostName: jam.hostName })
})

// Quitter le Jam
app.post('/jam/leave', (req, res) => {
    const jam = getJam(req.session)
    if (jam && req.session.jam.role === 'guest' && jam.members > 0) jam.members--
    req.session.jam = null
    res.json({ ok: true })
})

// Arrêter le Jam (host uniquement) → supprime le Jam pour tout le monde
app.post('/jam/stop', (req, res) => {
    if (!isHost(req.session)) return res.status(403).json({ error: 'Host uniquement' })
    jams.delete(req.session.jam.code)
    req.session.jam = null
    res.json({ ok: true })
})

// État du Jam pour cette session → le front choisit la vue
app.get('/jam/state', async(req, res) => {
    const sj = req.session.jam

    if (sj) {
        const jam = getJam(req.session)
        if (!jam) {
            req.session.jam = null // Jam stoppé ou expiré
            return res.json({ inJam: false, ended: true })
        }
        return res.json({ inJam: true, code: jam.code, role: sj.role, hostName: jam.hostName, members: jam.members })
    }

    // Pas de Jam en session : si connecté à Spotify, on réattache un Jam <3h créé par ce compte
    if (req.session.refreshToken) {
        try {
            const api = await ensureToken(req.session)
            const me = await api.getMe()
            const jam = findJamByHost(me.body.id)
            if (jam) {
                // Rafraîchit les tokens du Jam avec ceux du host reconnecté
                jam.accessToken = req.session.accessToken
                jam.refreshToken = req.session.refreshToken
                jam.tokenExpiry = req.session.tokenExpiry
                req.session.jam = { code: jam.code, role: 'host' }
                return res.json({ inJam: true, code: jam.code, role: 'host', hostName: jam.hostName, members: jam.members, restored: true })
            }
        } catch (err) {
            console.error('Réattache Jam échouée :', err.body || err.message)
        }
    }

    res.json({ inJam: false })
})

// Lecture en cours du Jam (token host)
app.get('/jam/current', async(req, res) => {
    const j = await jamApi(req, res); if (!j) return
    try {
        const data = await j.api.getMyCurrentPlayingTrack()
        if (!data.body || !data.body.item) return res.json({ playing: false })
        const track = data.body.item
        res.json({
            playing: data.body.is_playing,
            name: track.name,
            artists: track.artists.map(a => a.name),
            album: track.album.name,
            image: track.album.images[0] && track.album.images[0].url
        })
    } catch (err) {
        console.error('Jam current échoué :', err.body || err.message)
        res.status(500).json({ error: 'Lecture échouée' })
    }
})

// File du Jam (token host)
app.get('/jam/queue', async(req, res) => {
    const j = await jamApi(req, res); if (!j) return
    try {
        const r = await fetch('https://api.spotify.com/v1/me/player/queue', {
            headers: { Authorization: 'Bearer ' + j.api.getAccessToken() }
        })
        if (r.status === 204) return res.json({ queue: [] })
        if (!r.ok) throw new Error('Spotify ' + r.status)

        const data = await r.json()
        const queue = (data.queue || []).map(track => ({
            name: track.name,
            artists: (track.artists || []).map(a => a.name),
            album: track.album ? track.album.name : (track.show && track.show.name),
            image: ((track.album || track.show || {}).images || [])[0] &&
                ((track.album || track.show || {}).images || [])[0].url
        }))
        res.json({ queue })
    } catch (err) {
        console.error('Jam queue échoué :', err.body || err.message)
        res.status(500).json({ error: 'File échouée' })
    }
})

// Recherche dans le Jam (host token, autorisé à tous les membres)
app.get('/jam/search', async(req, res) => {
    const j = await jamApi(req, res); if (!j) return
    try {
        const q = (req.query.q || '').trim()
        if (!q) return res.json({ results: [] })

        const data = await j.api.searchTracks(q, { limit: 10 })
        const results = (data.body.tracks.items || []).map(track => ({
            uri: track.uri,
            name: track.name,
            artists: track.artists.map(a => a.name),
            album: track.album.name,
            image: track.album.images[0] && track.album.images[0].url
        }))
        res.json({ results })
    } catch (err) {
        console.error('Jam search échoué :', err.body || err.message)
        res.status(500).json({ error: 'Recherche échouée' })
    }
})

// Ajout à la file du Jam (tous les membres)
app.post('/jam/add', async(req, res) => {
    const j = await jamApi(req, res); if (!j) return
    try {
        const uri = req.body.uri
        if (!uri) return res.status(400).json({ error: 'uri manquant' })
        await j.api.addToQueue(uri)
        res.json({ ok: true })
    } catch (err) {
        console.error('Jam add échoué :', err.body || err.message)
        res.status(500).json({ error: 'Ajout échoué (device actif ?)' })
    }
})

// Passer à la suivante (host uniquement)
app.post('/jam/skip', async(req, res) => {
    if (!isHost(req.session)) return res.status(403).json({ error: 'Host uniquement' })
    const j = await jamApi(req, res); if (!j) return
    try {
        await j.api.skipToNext()
        res.json({ ok: true })
    } catch (err) {
        console.error('Jam skip échoué :', err.body || err.message)
        res.status(500).json({ error: 'Skip échoué (device actif ?)' })
    }
})

// Play/Pause (host uniquement) → bascule selon l'état courant
app.post('/jam/playpause', async(req, res) => {
    if (!isHost(req.session)) return res.status(403).json({ error: 'Host uniquement' })
    const j = await jamApi(req, res); if (!j) return
    try {
        const state = await j.api.getMyCurrentPlaybackState()
        if (state.body && state.body.is_playing) {
            await j.api.pause()
            res.json({ ok: true, playing: false })
        } else {
            await j.api.play()
            res.json({ ok: true, playing: true })
        }
    } catch (err) {
        console.error('Jam play/pause échoué :', err.body || err.message)
        res.status(500).json({ error: 'Play/pause échoué (device actif ?)' })
    }
})

// Démarrer le serveur
const PORT = process.env.PORT || 4102
app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`)
})
