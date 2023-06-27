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
app.use('/views', viewsRouter)

const PORT = 3000
const httpServer = app.listen(PORT, () => {
    console.log(`Listen to PORT: ${PORT}`);
})

/* WEBSOCKET */
const infoMensajes = []
const socketServer = new Server(httpServer)

socketServer.on('connection', socket => {
    console.log(`User connected: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    }) 
     
    socket.on('mensaje', info =>{
        infoMensajes.push(info)
        socketServer.emit('chat', infoMensajes)
    })

    socket.on('usuarioNuevo', usuario => {
        socket.broadcast.emit('broadcast', usuario)
    })
})