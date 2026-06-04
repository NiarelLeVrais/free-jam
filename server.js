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
        if (path.endsWith('.js')) res.setHeader('Cache-Control', 'no-cache')
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

// Renvoie une instance Spotify prête (token rafraîchi), ou null si non connecté
async function ensureToken(sess) {
    if (!sess.refreshToken) return null // pas connecté
    const api = makeSpotify(sess)

    if (!sess.tokenExpiry || Date.now() >= sess.tokenExpiry) {
        const data = await api.refreshAccessToken()
        sess.accessToken = data.body['access_token']
        sess.tokenExpiry = Date.now() + data.body['expires_in'] * 1000
        api.setAccessToken(sess.accessToken)
    }
    return api
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

// Démarrer le serveur
const PORT = process.env.PORT || 4102
app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`)
})
