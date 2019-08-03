var app = require('express')()
var http = require('http').createServer(app)
var request = require('request')
var io = require('socket.io')(http)

var compression = require('compression')
var helmet = require('helmet')

var port = process.env.PORT || 8080

var roomdata = require('roomdata')

const pageSize = 25

// roomdata.leaveRoom(socket); // you will have to replace your socket.leave with this line

app.use(compression())
app.use(helmet())

app.get('/', function (req, res) {
  res.send('<h1>C2G server API</h1>')
})

io.on('connection', function (socket) {
  console.log(socket.id)

  socket.on('room', function (room) {
    io.sockets.in(room).emit('notification', {
      text: 'User ' + socket.id + ' joined',
      type: 'info'
    })

    socket.on('message', (message) => {
      io.sockets.in(room).emit('gotMessage', message)
    })

    roomdata.joinRoom(socket, room)
    if (io.sockets.adapter.rooms[room] && Object.keys(io.sockets.adapter.rooms[room].sockets).length < 2) { // FIXME Proper user handle
      resetRoom()
      roomdata.set(socket, 'roomOwner', socket.id)
    } else {
      if (roomdata.get(socket, 'loadedCoubs') != null) {
        io.in(room).emit(
          'gotCoub',
          roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')]
        )
      }
    }
    function resetRoom () {
      roomdata.set(socket, 'coubIndex', 0)
      roomdata.set(socket, 'currentCoubPage', 1)
    }

    const getLatest = (object) => {
      roomdata.set(socket, 'timeline', object)
      io.sockets.in(room).emit('gotMessage', { from: 'System', message: object.category + ' sorted by ' + object.sort + ' /: ' + roomdata.get(socket, 'currentCoubPage'), time: new Date().toLocaleTimeString() })
      return new Promise((resolve, reject) => {
        if (object.category === 'hot') {
          request(
            {
              url: `http://coub.com/api/v2/timeline/hot?page=${roomdata.get(
                socket,
                'currentCoubPage'
              )}&per_page=${pageSize}&order_by=${object.sort}`,
              json: true
            },
            function (error, response, body) {
              if (!error && response.statusCode === 200) {
                roomdata.set(socket, 'loadedCoubs', body['coubs'])
                io.sockets
                  .in(room)
                  .emit(
                    'gotCoub',
                    roomdata.get(socket, 'loadedCoubs')[
                      roomdata.get(socket, 'coubIndex')
                    ]
                  )             
                io.sockets.in(room).emit('gotMessage', { from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].title, time: new Date().toLocaleTimeString() })
              }

              if (!error) {
                resolve('Stuff worked!')
              } else {
                reject(Error('It broke'))
              }
            }
          )
        } else if (object.category === 'explore') {
          request(
            {
              url: `http://coub.com/api/v2/timeline/explore/${object.sort}?page=${roomdata.get(
                socket,
                'currentCoubPage'
              )}&per_page=${pageSize}`,
              json: true
            },
            function (error, response, body) {
              if (!error && response.statusCode === 200) {
                roomdata.set(socket, 'loadedCoubs', body['coubs'])
                io.sockets
                  .in(room)
                  .emit(
                    'gotCoub',
                    roomdata.get(socket, 'loadedCoubs')[
                      roomdata.get(socket, 'coubIndex')
                    ]
                  )
                io.sockets.in(room).emit('gotMessage', { from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].title, time: new Date().toLocaleTimeString() })
              }

              if (!error) {
                resolve('Stuff worked!')
              } else {
                reject(Error('It broke'))
              }
            }
          )
        }
      })
    }

    socket.on('category', (object) => {
      resetRoom()
      getLatest(object)
    })

    socket.on('reqPrev', function () {
      if (roomdata.get(socket, 'loadedCoubs') != null) {
        if (roomdata.get(socket, 'coubIndex') > 0) {
          roomdata.set(
            socket,
            'coubIndex',
            roomdata.get(socket, 'coubIndex') - 1
          )

          io.sockets
            .in(room)
            .emit(
              'gotCoub',
              roomdata.get(socket, 'loadedCoubs')[
                roomdata.get(socket, 'coubIndex')
              ]
            )
            io.sockets.in(room).emit('gotMessage', { from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].title, time: new Date().toLocaleTimeString() })
        } else {
          if (roomdata.get(socket, 'currentCoubPage') > 1) {
            roomdata.set(
              socket,
              'currentCoubPage',
              roomdata.get(socket, 'currentCoubPage') - 1
            )
            roomdata.set(socket, 'coubIndex', pageSize - 1)
            getLatest(roomdata.get(socket, 'timeline'))
          } else {
            io.sockets
              .in(room)
              .emit('notification', { text: 'start', type: 'error' })
          }
        }
      } else {
        io.sockets
          .in(room)
          .emit('notification', { text: 'Select source', type: 'warning' })
      }
    })

    socket.on('reqNext', function () {
      if (roomdata.get(socket, 'loadedCoubs') != null) {
        if (roomdata.get(socket, 'coubIndex') < pageSize - 1) {
          roomdata.set(
            socket,
            'coubIndex',
            roomdata.get(socket, 'coubIndex') + 1
          )
          io.sockets
            .in(room)
            .emit(
              'gotCoub',
              roomdata.get(socket, 'loadedCoubs')[
                roomdata.get(socket, 'coubIndex')
              ]
            )
            io.sockets.in(room).emit('gotMessage', { from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].title, time: new Date().toLocaleTimeString() })
        } else {
          roomdata.set(socket, 'coubIndex', 0)
          roomdata.set(
            socket,
            'currentCoubPage',
            roomdata.get(socket, 'currentCoubPage') + 1
          )
          getLatest(roomdata.get(socket, 'timeline')).then(() => {
          })
        }
      } else {
        io.sockets
          .in(room)
          .emit('notification', { text: 'Select source', type: 'warning' })
      }
    })
    socket.on('disconnect', function () {
      console.log('user left ', socket.id)

      roomdata.leaveRoom(socket)
      io.sockets.in(room).emit('notification', {
        text: 'User ' + socket.id + ' left',
        type: 'info'
      })
    })
  })
})

http.listen(port, function () {
  console.log('listening on *:' + port)
})
