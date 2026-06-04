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
getQueu();

checkBut = document.getElementById("curentbouton")

checkBut.addEventListener("click", function() {
    curentSongPlayed()
})

//NEWS