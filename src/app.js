import express from 'express'
import { __dirname } from './utils.js'
import handlebars from 'express-handlebars'
import { Server } from 'socket.io'
import viewsRouter from './routes/views.router.js'

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

/* Static File */
app.use(express.static(__dirname + '/public'))

/* Handlebars */
app.engine('handlebars', handlebars.engine())
app.set('views', __dirname + '/views')
app.set('view engine', 'handlebars')

/* ROUTES */
app.use('/', viewsRouter)

const PORT = 3000
const httpServer = app.listen(PORT, () => {
    console.log(`Listen to PORT: ${PORT}`);
})

/* WEBSOCKET */
const socketServer = new Server(httpServer)
const MAX_MESSAGE_LENGTH = 500
const MAX_USERNAME_LENGTH = 30
const connectedUsers = new Map()
const BLOCKED_LITERALS = new Set(['null', 'undefined'])

const normalizeText = (value, maxLength) => {
    if (typeof value !== 'string') return null
    const normalized = value.trim().replace(/\s+/g, ' ')
    if (!normalized) return null
    const sliced = normalized.slice(0, maxLength)
    if (BLOCKED_LITERALS.has(sliced.toLowerCase())) return null
    return sliced
}

const normalizeUsername = (value, maxLength) => {
    const base = normalizeText(value, maxLength)
    if (!base) return null
    if (/^\d/.test(base)) return null
    return base
}

const emitConnectedUsers = () => {
    socketServer.emit('usuariosConectados', Array.from(connectedUsers.values()))
}

const emitConnectedUsersToSocket = (socket) => {
    socket.emit('usuariosConectados', Array.from(connectedUsers.values()))
}

const hasDuplicateUsername = (socketId, username) => {
    const normalizedTarget = username.toLowerCase()
    for (const [id, value] of connectedUsers.entries()) {
        if (id !== socketId && value.toLowerCase() === normalizedTarget) {
            return true
        }
    }
    return false
}

const MIN_MS_BETWEEN_MESSAGES = 900
const SPAM_WINDOW_MS = 60_000
const MAX_MESSAGES_PER_WINDOW = 18

const pruneSpamWindow = (timestamps, now) => {
    const desde = now - SPAM_WINDOW_MS
    return timestamps.filter(t => t >= desde)
}

socketServer.on('connection', socket => {
    console.log(`User connected: ${socket.id}`);
    emitConnectedUsers()

    let lastMessageAt = 0
    let messageTimestamps = []

    socket.on('disconnect', () => {
        connectedUsers.delete(socket.id)
        emitConnectedUsers()
        console.log(`User disconnected: ${socket.id}`);
    }) 
     
    socket.on('mensaje', (info, ack) => {
        const reply = (payload) => {
            if (typeof ack === 'function') ack(payload)
        }

        const nombre = normalizeUsername(info?.nombre, MAX_USERNAME_LENGTH)
        const mensaje = normalizeText(info?.mensaje, MAX_MESSAGE_LENGTH)
        if (!nombre || !mensaje) {
            reply({ ok: false, reason: 'Mensaje no valido' })
            return
        }

        const now = Date.now()
        if (now - lastMessageAt < MIN_MS_BETWEEN_MESSAGES) {
            reply({ ok: false, reason: 'tranquilo teletubi, no hagas spam' })
            return
        }

        messageTimestamps = pruneSpamWindow(messageTimestamps, now)
        if (messageTimestamps.length >= MAX_MESSAGES_PER_WINDOW) {
            reply({ ok: false, reason: 'tranquilo teletubi, no hagas spam' })
            return
        }

        lastMessageAt = now
        messageTimestamps.push(now)

        const nuevoMensaje = {
            nombre,
            mensaje,
            createdAt: now
        }
        socketServer.emit('chat', nuevoMensaje)
        reply({ ok: true })
    })

    socket.on('usuarioNuevo', usuario => {
        const baseName = normalizeText(usuario, MAX_USERNAME_LENGTH)
        if (!baseName) {
            socket.emit('usuarioError', 'Ingresa un usuario valido')
            return
        }
        if (/^\d/.test(baseName)) {
            socket.emit('usuarioError', 'El usuario no puede empezar por un numero')
            return
        }
        const nombreUsuario = baseName
        if (hasDuplicateUsername(socket.id, nombreUsuario)) {
            socket.emit('usuarioError', 'Ese usuario ya esta en uso')
            return
        }
        connectedUsers.set(socket.id, nombreUsuario)
        emitConnectedUsers()
        socket.broadcast.emit('broadcast', nombreUsuario)
    })

    socket.on('solicitarUsuarios', () => {
        emitConnectedUsersToSocket(socket)
    })
})