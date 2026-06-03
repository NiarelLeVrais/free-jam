const express = require('express')
const app = express()

// Une variable globale suffit pour commencer
let tokenExpiry = null
let spotifyTokenid = "4aa3940d8b844dc6b9c3ec360d57ebe6"

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



app.get('/callback', (req, res) => {
    // Spotify renvoie un code ici
    // Tu l'échanges contre un token et tu le stockes
    spotifyToken = tokenRécupéréDepuisSpotify
    res.redirect('/')
})

app.get('/login', (req, res) => {
    const params = new URLSearchParams({
        client_id: "4aa3940d8b844dc6b9c3ec360d57ebe6",
        response_type: 'code',
        redirect_uri: '*https://free-jam.atlastheone.xyz/callback',
        scope: 'user-read-playback-state user-modify-playback-state user-read-currently-playing'
    })

    res.redirect('https://accounts.spotify.com/authorize?' + params)
})

// Démarrer le serveur
const PORT = process.env.PORT || 4102
app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`)
})