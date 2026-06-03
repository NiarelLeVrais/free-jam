require('dotenv').config()
const express = require('express')
const axios = require('axios')
const app = express()

// Config Spotify (depuis .env)
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI

// Tokens stockés en mémoire (suffit pour commencer)
let spotifyToken = null
let refreshToken = null
let tokenExpiry = null

// Permet de lire le JSON dans les requêtes
app.use(express.json())

// Sert les fichiers statiques du dossier public
app.use(express.static('public'))

// Une route GET simple
app.get('/api/hello', (req, res) => {
    res.json({ message: 'Bonjour !' })
})

// Une route POST
app.post('/api/data', (req, res) => {
    const body = req.body // ce que le client envoie
    console.log(body)
    res.json({ recu: true })
})



app.get('/callback', async(req, res) => {
    const code = req.query.code
    const error = req.query.error

    if (error) return res.status(400).send('Spotify a refusé : ' + error)
    if (!code) return res.status(400).send('Pas de code dans le callback')

    try {
        const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        const resp = await axios.post(
            'https://accounts.spotify.com/api/token',
            new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI
            }), {
                headers: {
                    'Authorization': 'Basic ' + auth,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        )

        spotifyToken = resp.data.access_token
        refreshToken = resp.data.refresh_token
        tokenExpiry = Date.now() + resp.data.expires_in * 1000

        res.redirect('/')
    } catch (err) {
        console.error('Échange token échoué :', err.response ? .data || err.message)
        res.status(500).send('Échange du token échoué')
    }
})

// Statut connexion + nom utilisateur
app.get('/api/me', async(req, res) => {
    // Pas de token, ou expiré → pas connecté
    if (!spotifyToken || Date.now() >= tokenExpiry) {
        return res.json({ connected: false })
    }

    try {
        const resp = await axios.get('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': 'Bearer ' + spotifyToken }
        })
        res.json({
            connected: true,
            name: resp.data.display_name,
            id: resp.data.id
        })
    } catch (err) {
        console.error('Récup profil échouée :', err.response ? .data || err.message)

        res.json({ connected: false })
    }
})

app.get('/login', (req, res) => {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: 'user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing'
    })

    res.redirect('https://accounts.spotify.com/authorize?' + params)
})

// Démarrer le serveur
const PORT = process.env.PORT || 4102
app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`)
})