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
    } else {
        document.getElementById('name').textContent = 'Non connecté'
        document.getElementById('login').style.display = 'inline'
        document.getElementById('iscon').textContent = "Disconected"
    }
}
checkAuth()