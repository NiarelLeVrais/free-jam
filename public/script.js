async function checkAuth() {
    const res = await fetch('/api/me')
    const data = await res.json()

    if (data.connected) {
        document.getElementById('name').textContent = 'Name : ' + data.name
        document.getElementById('login').style.display = 'none'
    } else {
        document.getElementById('name').textContent = 'Non connecté'
        document.getElementById('login').style.display = 'inline'
    }
}
checkAuth()