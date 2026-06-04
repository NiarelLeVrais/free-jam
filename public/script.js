async function curentSongPlayed() {

    const res = await fetch('/curent')
    const data = await res.json()

    if (data.playing) {
        document.getElementById('track').style.display = 'inline'
        document.getElementById('trackname').textContent = data.name
        document.getElementById('trackimg').src = data.image
    }
}

async function checkAuth() {
    const res = await fetch('/api/me')
    const data = await res.json()

    document.getElementById('disconect').style.display = 'none'

    if (data.connected) {
        document.getElementById('name').textContent = 'Name : ' + data.name
        document.getElementById('login').style.display = 'none'
        document.getElementById('disconect').style.display = 'inline'
        document.getElementById('iscon').textContent = "Conected"
        document.getElementById('profileimage').src = data.images[0].url

        curentSongPlayed()
    } else {
        document.getElementById('name').textContent = 'Non connecté'
        document.getElementById('login').style.display = 'inline'
        document.getElementById('iscon').textContent = "Disconected"
        document.getElementById('track').style.display = 'none'
    }
}
checkAuth();

checkBut = document.getElementById("curentbouton")

checkBut.addEventListener("click", function() {
    curentSongPlayed()
})

//NEWS