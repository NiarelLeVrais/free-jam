require('dotenv').config()
const express = require('express')
const SpotifyWebApi = require('spotify-web-api-node')
const app = express()

// Config Spotify (depuis .env)
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI

const spotifyApi = new SpotifyWebApi({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI
})

// Scopes demandés (tableau, requis par createAuthorizeURL)
const SCOPES = [
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing'
]

// État connexion en mémoire (suffit pour commencer, mono-utilisateur)
let tokenExpiry = null // timestamp ms d'expiration de l'access token

// Permet de lire le JSON dans les requêtes
app.use(express.json())

// Sert les fichiers statiques du dossier public (pas de cache sur les .js)
app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) res.setHeader('Cache-Control', 'no-cache')
    }
}))

// Rafraîchit l'access token si expiré (utilise le refresh token stocké)
async function ensureToken() {
    if (!spotifyApi.getRefreshToken()) return false // pas connecté
    if (tokenExpiry && Date.now() < tokenExpiry) return true // encore valide

    const data = await spotifyApi.refreshAccessToken()
    spotifyApi.setAccessToken(data.body['access_token'])
    tokenExpiry = Date.now() + data.body['expires_in'] * 1000
    return true
}

// ---------- SPOTIFY ----------

app.get('/login', (req, res) => {
    const state = Math.random().toString(36).slice(2)
    const authorizeURL = spotifyApi.createAuthorizeURL(SCOPES, state)
    res.redirect(authorizeURL)
})

app.get('/callback', async(req, res) => {
    const code = req.query.code
    const error = req.query.error

    if (error) return res.status(400).send('Spotify a refusé : ' + error)
    if (!code) return res.status(400).send('Pas de code dans le callback')

    try {
        const data = await spotifyApi.authorizationCodeGrant(code)
        spotifyApi.setAccessToken(data.body['access_token'])
        spotifyApi.setRefreshToken(data.body['refresh_token'])
        tokenExpiry = Date.now() + data.body['expires_in'] * 1000
        res.redirect('/')
    } catch (err) {
        console.error('Échange token échoué :', err.body || err.message)
        res.status(500).send('Échange du token échoué')
    }
})

// Statut connexion + profil utilisateur
app.get('/api/me', async(req, res) => {
    try {
        const ok = await ensureToken()
        if (!ok) return res.json({ connected: false })

        const data = await spotifyApi.getMe()
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
    spotifyApi.resetAccessToken()
    spotifyApi.resetRefreshToken()
    tokenExpiry = null
    res.redirect('/')
})

app.get('/curent', async(req, res) => {
    try {
        const ok = await ensureToken()
        if (!ok) return res.json({ connected: false })

        const data = await spotifyApi.getMyCurrentPlayingTrack()

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