const socketClient = io()

const tituloUsuario = document.getElementById('usuario')
const formulario = document.getElementById('formulario')
const inputMensaje = document.getElementById('mensaje')
const divChat = document.getElementById('chat')
const scrollBottomBtn = document.getElementById('scrollBottomBtn')
const usersCount = document.getElementById('usersCount')
const usersList = document.getElementById('usersList')

let usuario
let forceScrollToBottom = false
let hasJoinedChat = false
const BLOCKED_LITERALS = new Set(['null', 'undefined'])

const clearChatView = () => {
    divChat.innerHTML = ''
    scrollBottomBtn.hidden = true
}

clearChatView()
inputMensaje.disabled = true
const isNearBottom = () => {
    const threshold = 80
    return (divChat.scrollHeight - divChat.scrollTop - divChat.clientHeight) < threshold
}

const scrollToBottom = () => {
    divChat.scrollTop = divChat.scrollHeight
}

const formatTime = (createdAt) => {
    if (!createdAt) return ''
    const date = new Date(createdAt)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const updateScrollButtonVisibility = () => {
    scrollBottomBtn.hidden = isNearBottom()
}

const isBlockedLiteral = (value) => {
    return typeof value === 'string' && BLOCKED_LITERALS.has(value.trim().toLowerCase())
}

const usernameStartsWithDigit = (value) => {
    return typeof value === 'string' && /^\d/.test(value.trim())
}

const sortUsersWithSelfFirst = (lista = []) => {
    if (!usuario) return [...lista]
    return [...lista].sort((a, b) => {
        if (a === usuario) return -1
        if (b === usuario) return 1
        return a.localeCompare(b, 'es', { sensitivity: 'base' })
    })
}

const renderConnectedUsers = (usuarios = []) => {
    usersCount.innerText = 'Usuarios conectados'
    usersList.innerHTML = ''

    if (usuarios.length === 0) {
        const empty = document.createElement('p')
        empty.className = 'users-empty'
        empty.innerText = 'Sin usuarios activos'
        usersList.appendChild(empty)
        return
    }

    const ordenados = sortUsersWithSelfFirst(usuarios)
    ordenados.forEach(nombre => {
        const item = document.createElement('span')
        item.className = 'user-chip'
        item.innerText = nombre === usuario ? `${nombre} (tu)` : nombre
        usersList.appendChild(item)
    })
}

const createMessageNode = (payload) => {
    const nombre = typeof payload?.nombre === 'string' ? payload.nombre : 'Anonimo'
    const mensaje = typeof payload?.mensaje === 'string' ? payload.mensaje : ''
    const createdAt = payload?.createdAt
    const isOwnMessage = nombre === usuario
    const wrapper = document.createElement('article')
    const nombreSpan = document.createElement('span')
    const mensajeSpan = document.createElement('p')
    const horaSpan = document.createElement('span')

    wrapper.className = `message-row ${isOwnMessage ? 'message-own' : 'message-other'}`
    nombreSpan.className = 'chat-user'
    mensajeSpan.className = 'chat-text'
    horaSpan.className = 'chat-time'

    nombreSpan.innerText = nombre
    mensajeSpan.innerText = mensaje
    horaSpan.innerText = formatTime(createdAt)

    wrapper.appendChild(nombreSpan)
    wrapper.appendChild(mensajeSpan)
    wrapper.appendChild(horaSpan)
    return wrapper
}

const requestUsername = () => {
    Swal.fire({
        title: 'Chat WebSocket',
        text: 'Ingresa tu nombre de usuario para continuar',
        input: 'text',
        inputValidator: value => {
            if (!value || isBlockedLiteral(value)) {
                return ('Debes ingresar un usuario')
            }
            if (usernameStartsWithDigit(value)) {
                return 'El usuario no puede empezar por un numero'
            }
        }
    }).then(username => {
        clearChatView()
        usuario = username?.value?.trim()
        if (!usuario || isBlockedLiteral(usuario) || usernameStartsWithDigit(usuario)) {
            Toastify({
                text: 'Debes ingresar un usuario valido para usar el chat',
                duration: 5000,
                gravity: "top",
                position: "right",
                style: {
                    background: "linear-gradient(to right, #ff5f6d, #ffc371)",
                },
            }).showToast()
            inputMensaje.disabled = true
            return
        }
        hasJoinedChat = true
        tituloUsuario.innerText = usuario
        inputMensaje.disabled = false
        inputMensaje.focus()
        /* evento ingreso user */
        socketClient.emit('usuarioNuevo', usuario)
        socketClient.emit('solicitarUsuarios')
        inputMensaje.value = ''
    })
}

/* Ingresar al chat */
requestUsername()

/* mensajes */
formulario.onsubmit = (e) => {
    e.preventDefault()
    if (!usuario) return
    const mensaje = inputMensaje.value.trim()
    if (!mensaje || isBlockedLiteral(mensaje)) {
        inputMensaje.value = ''
        return
    }
    const info = {
        nombre: usuario,
        mensaje
    }
    forceScrollToBottom = true
    socketClient.emit('mensaje', info, (res) => {
        if (res?.ok) {
            inputMensaje.value = ''
            inputMensaje.focus()
            return
        }
        forceScrollToBottom = false
        if (res?.reason) {
            Toastify({
                text: res.reason,
                duration: 4000,
                gravity: 'top',
                position: 'right',
                style: {
                    background: 'linear-gradient(to right, #ff5f6d, #ffc371)',
                },
            }).showToast()
        }
    })
}

/* CHAT */
socketClient.on('chat', mensaje => {
    if (!hasJoinedChat) return
    const shouldStickToBottom = forceScrollToBottom || isNearBottom()
    if (!mensaje) return

    // Compatibilidad: si llega un array viejo, solo se agrega el ultimo.
    const normalizedMessage = Array.isArray(mensaje) ? mensaje[mensaje.length - 1] : mensaje
    if (!normalizedMessage) return

    divChat.appendChild(createMessageNode(normalizedMessage))
    if (shouldStickToBottom) {
        scrollToBottom()
    }
    forceScrollToBottom = false
    updateScrollButtonVisibility()
})

/* Notificación Usuario Conectado */
socketClient.on('broadcast', usuario => {
    Toastify({
        text: `${usuario} se unió al chat`,
        duration: 6000,
        gravity: "top",
        position: "right",
        style: {background: "linear-gradient(to right, #00b09b, #96c93d)",
        },
      }).showToast();
})

socketClient.on('usuariosConectados', usuarios => {
    if (!Array.isArray(usuarios)) return
    renderConnectedUsers(usuarios)
})

socketClient.on('usuarioError', errorMessage => {
    hasJoinedChat = false
    usuario = ''
    tituloUsuario.innerText = ''
    inputMensaje.disabled = true
    clearChatView()
    renderConnectedUsers([])

    Toastify({
        text: errorMessage || 'No fue posible ingresar con ese usuario',
        duration: 5000,
        gravity: "top",
        position: "right",
        style: {
            background: "linear-gradient(to right, #ff5f6d, #ffc371)",
        },
    }).showToast()

    requestUsername()
})

divChat.addEventListener('scroll', updateScrollButtonVisibility)
scrollBottomBtn.addEventListener('click', () => {
    scrollToBottom()
    updateScrollButtonVisibility()
})