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

function isEmpty (str) {
  return str.replace(/^\s+|\s+$/gm, '').length === 0
}

function sendCoub (socket, room, joined) {
  io.sockets
    .in(room)
    .emit(
      'gotCoub',
      roomdata.get(socket, 'loadedCoubs')[
        roomdata.get(socket, 'coubIndex')
      ]
    )
  if (!joined) {
    roomdata.set(socket, 'coubCount', roomdata.get(socket, 'coubCount') + 1)
  }
  io.in(room).emit('coubCount', roomdata.get(socket, 'coubCount'))
}
io.on('connection', function (socket) {
  console.log(socket.id)

  socket.on('room', function (room) {
    io.sockets.in(room).emit('notification', {
      text: 'User ' + socket.id + ' joined',
      type: 'info'
    })

    socket.on('message', (message) => {
      sendMessage(room, message)
    })

    roomdata.joinRoom(socket, room)
    try {
      if (io.sockets.adapter.rooms[room] && Object.keys(io.sockets.adapter.rooms[room].sockets).length < 2) { // FIXME Proper user handle
        resetRoom()
        roomdata.set(socket, 'coubCount', 0)
        roomdata.set(socket, 'roomOwner', socket.id)
      } else {
        if (roomdata.get(socket, 'loadedCoubs') != null) {
          sendCoub(socket, room, true)
        }
      }
    } catch (error) {
      console.log(error)
      roomdata.clearRoom(room)
    }
    function resetRoom () {
      roomdata.set(socket, 'coubIndex', 0)
      roomdata.set(socket, 'currentCoubPage', 1)
    }

    function sendMessage (room, message) {
      io.sockets.in(room).emit('gotMessage', message)
    }

    const getLatest = (object) => {
      roomdata.set(socket, 'timeline', object)
      sendMessage(room, { from: 'System', message: object.category + ' sorted by ' + object.sort + ' /: ' + roomdata.get(socket, 'currentCoubPage'), time: new Date().toLocaleTimeString() })
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
                sendCoub(socket, room)
                try {
                  sendMessage(room, { from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].title, time: new Date().toLocaleTimeString() })
                } catch (error) {
                  console.log(error)
                }
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
                sendCoub(socket, room)

                try {
                  sendMessage(room, { from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].title, time: new Date().toLocaleTimeString() })
                } catch (error) {
                  console.log(error)
                }
              }

              if (!error) {
                resolve('Stuff worked!')
              } else {
                reject(Error('It broke'))
              }
            }
          )
        } else if (object.category === 'channel') {
          if (!isEmpty(object.channel)) {
            request(
              {
                url: `http://coub.com/api/v2/timeline/channel/${object.channel}?order_by=${object.sort}?page=${roomdata.get(
                  socket,
                  'currentCoubPage'
                )}&per_page=${pageSize}`,
                json: true
              },
              function (error, response, body) {
                if (!error && response.statusCode === 200) {
                  roomdata.set(socket, 'loadedCoubs', body['coubs'])
                  sendCoub(socket, room)
                  try {
                    sendMessage(room, { from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].title, time: new Date().toLocaleTimeString() })
                    sendMessage(room, { from: 'System', message: object.channel, time: new Date().toLocaleTimeString() })
                  } catch (error) {
                    console.log(error)
                  }
                } else {
                  io.sockets
                    .in(room)
                    .emit('notification', { text: 'Bad username', type: 'error' })
                }

                if (!error) {
                  resolve('Stuff worked!')
                } else {
                  reject(Error('It broke'))
                }
              }
            )
          }
        } else if (object.category === 'hashtag') {
          if (!isEmpty(object.hashtag)) {
            request(
              {
                url: `http://coub.com/api/v2/timeline/tag/${object.hashtag}?order_by=${object.sort}?page=${roomdata.get(
                  socket,
                  'currentCoubPage'
                )}&per_page=${pageSize}`,
                json: true
              },
              function (error, response, body) {
                if (!error && response.statusCode === 200) {
                  roomdata.set(socket, 'loadedCoubs', body['coubs'])
                  sendCoub(socket, room)
                  try {
                    sendMessage(room, { from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].title, time: new Date().toLocaleTimeString() })
                    sendMessage(room, { from: 'System', message: object.hashtag, time: new Date().toLocaleTimeString() })
                  } catch (error) {
                    console.log(error)
                  }
                } else {
                  io.sockets
                    .in(room)
                    .emit('notification', { text: 'Bad hashtag', type: 'error' })
                }

                if (!error) {
                  resolve('Stuff worked!')
                } else {
                  reject(Error('It broke'))
                }
              }
            )
          }
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

          sendCoub(socket, room)
          try {
            sendMessage(room, { from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].title, time: new Date().toLocaleTimeString() })
          } catch (error) {
            console.log(error)
          }
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
          sendCoub(socket, room)
          try {
            sendMessage(room, { from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'coubIndex')].title, time: new Date().toLocaleTimeString() })
          } catch (error) {
            console.log(error)
          }
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
      try {
        roomdata.leaveRoom(socket)
      } catch (error) {
        console.log(error)
      }
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
