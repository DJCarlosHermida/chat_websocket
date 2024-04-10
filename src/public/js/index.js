const socketClient = io()

const tituloUsuario = document.getElementById('usuario')
const formulario = document.getElementById('formulario')
const inputMensaje = document.getElementById('mensaje')
const divChat = document.getElementById('chat')

let usuario

/* Ingresar al chat */
Swal.fire({
    title: 'Welcome to me',
    text: 'Please enter your name user to continue',
    input: 'text',
    inputValidator: value => {
        if (!value) {
            return ('you need enter a user')
        }
    }
}).then(username => {
    usuario = username.value
    tituloUsuario.innerText = usuario
    /* evento ingreso user */
    socketClient.emit('usuarioNuevo', usuario)
    inputMensaje.reset = ' '
})

/* mensajes */
formulario.onsubmit = (e) => {
    e.preventDefault()
    const info = {
        nombre: usuario,
        mensaje: inputMensaje.value
    }
    socketClient.emit('mensaje', info)
}

/* CHAT */
socketClient.on('chat', mensajes => {
    console.log(mensajes);

    const chatParrafo = mensajes.map(obj => {
        return `<p><span style="color: red">${obj.nombre}</span>: <span>${obj.mensaje}</span></p>`
    }).join(' ')

    divChat.innerHTML = chatParrafo
})

/* Notificación Usuario Conectado */
socketClient.on('broadcast', usuario => {
    Toastify({
        text: `${usuario} se unió al chat`,
        duration: 6000,
        gravity: "top",
        position: "right",
        style: {
          background: "linear-gradient(to right, #00b09b, #96c93d)",
        },
      }).showToast();
})