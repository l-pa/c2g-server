var app = require('express')()
var http = require('http').createServer(app)
var request = require('request')
var io = require('socket.io')(http)

var compression = require('compression')
var helmet = require('helmet')

var port = process.env.PORT || 8080
const path = require('path')

var roomdata = require('roomdata')

const pageSizeCoub = 5

const pageSizeTikTok = 50

var os = require('os')

var tiktok = require('tiktok-scraper')

// roomdata.leaveRoom(socket); // you will have to replace your socket.leave with this line

app.use(compression())
app.use(helmet())

app.get('/', function (req, res) {
  res.status(403).send("...")
})

app.get('/blog', function (req, res) {
  res.sendFile(path.join(__dirname, './public', 'blog.html'))
})

function isEmpty(str) {
  return str.replace(/^\s+|\s+$/gm, '').length === 0
}

function sendMessage(room, message) {
  io.sockets.in(room).emit('gotMessage', message)
}

function sendCoub(socket, room, joined) {
  io.sockets
    .in(room)
    .emit(
      'gotCoub',
      roomdata.get(socket, 'loadedCoubs')[
      roomdata.get(socket, 'videoIndex')
      ]
    )
  if (!joined) {
    roomdata.set(socket, 'coubCount', roomdata.get(socket, 'coubCount') + 1)
  }
  io.in(room).emit('coubCount', roomdata.get(socket, 'coubCount'))
}

function sendTiktok(socket, room, joined) {
  io.sockets
    .in(room)
    .emit(
      'gotTiktok',
      roomdata.get(socket, 'loadedTiktoks')[
      roomdata.get(socket, 'videoIndex')
      ]
    )
  if (!joined) {
    // roomdata.set(socket, 'coubCount', roomdata.get(socket, 'coubCount') + 1)
  }
  // io.in(room).emit('coubCount', roomdata.get(socket, 'coubCount'))
}

function handleUsers(socket, room) { // TODO
  var promise1 = new Promise(function (resolve, reject) {
    resolve(Object.values(io.sockets.sockets).map((user) => {
      if (room === user.roomdata_room) {
        if (socket.id === roomdata.get(socket, 'roomOwner')) {
          roomdata.set(socket, 'roomOwner', user.id)
        }
        if (!user.username || user.username === 'undefined') {
          return { id: user.id, username: user.id, joined: new Date(), owner: user.id === roomdata.get(socket, 'roomOwner') }
        } else {
          return { id: user.id, username: user.username, joined: new Date(), owner: user.id === roomdata.get(socket, 'roomOwner') }
        }
      }
    }))
  })

  promise1.then((users) => {
    console.log(users)
    io.sockets.in(room).emit('users', users)
  })
}

io.on('connection', function (socket) {
  socket.on('room', function (room) {
    io.sockets.in(room).emit('notification', {
      text: 'User ' + socket.id + ' joined',
      type: 'info'
    })

    socket.on('username', (username) => {
      //   roomdata.get(socket, 'roomMembers').push({ id: socket.id, username: username })
      socket.username = username
      handleUsers(socket, room)

      sendMessage(room, { userId: 'System', from: 'Debug', time: new Date(), message: 'User joined', id: socket.id, username: socket.username, joined: new Date(), owner: socket.id === roomdata.get(socket, 'roomOwner') })

      //  console.log(io.sockets.adapter.rooms[room])
      //  console.log(Object.values(io.sockets.sockets))

      // roomdata.set(socket, 'roomMembers', roomdata.get(socket, 'roomMembers'))
    })

    socket.on('lock', () => {
      roomdata.set(socket, 'lock', !roomdata.get(socket, 'lock'))
      console.log(roomdata.get(socket, 'lock'))
    })

    socket.on('message', (message) => {
      sendMessage(room, message)
    })

    socket.on("sendVideo", (obj) => {
      io.sockets
      .in(room)
      .emit(
        'gotVideo', obj.video
      )
    })

    socket.on("pauseVideo", (obj) => {
      socket.emit('gotMessage', { userId: 'System', from: 'Debug', time: new Date(), message: obj.from + ' paused the video' })

      socket.to(room).emit('pauseVideo', "pause");
    })

    socket.on("playVideo", (obj) => {
      socket.emit('gotMessage', { userId: 'System', from: 'Debug', time: new Date(), message: obj.from + ' grame' })

      socket.to(room).emit('playVideo', "play");
    })

    socket.on("seek", (obj) => {
      socket.emit('gotMessage', { userId: 'System', from: 'Debug', time: new Date(), message: obj.from + ' -> ' + obj.to })

      socket.to(room).emit('seek', obj.to);
    })


    roomdata.joinRoom(socket, room)
    socket.emit('gotMessage', { userId: 'System', from: 'System', time: new Date(), message: 'Connected to :' + os.hostname() })
    try {
      if (io.sockets.adapter.rooms[room] && Object.keys(io.sockets.adapter.rooms[room].sockets).length < 2) { // FIXME Proper user handle
        resetRoom()
        roomdata.set(socket, 'coubCount', 0)
        roomdata.set(socket, 'roomOwner', socket.id)
        roomdata.set(socket, 'lock', false)
      } else {
        if (roomdata.get(socket, 'loadedCoubs') != null) {
          sendCoub(socket, room, true)
        }
      }
    } catch (error) {
      console.log(error)
      roomdata.clearRoom(room)
    }
    function resetRoom(object = { platform: "coub" }) {
      roomdata.set(socket, 'platform', object.platform)
      roomdata.set(socket, 'videoIndex', 0)
      roomdata.set(socket, 'currentVideoPage', 1)
      roomdata.set(socket, 'roomMembers', [])

    }

    const getVideo = (obj) => {
      sendMessage(room, { userId: 'System', from: 'System', message: 'Switch to video', time: new Date().toLocaleTimeString() })
      roomdata.set(socket, 'platform', 'video')

      io.sockets
        .in(room)
        .emit(
          'gotVideo', 'https://www.w3schools.com/html/mov_bbb.mp4'
        )

    }

    const getTikToks = (object) => {
      sendMessage(room, { userId: 'System', from: 'System', message: 'idk' + ' sorted by ' + 'sort' + ' /: ' + roomdata.get(socket, 'currentVideoPage'), time: new Date().toLocaleTimeString() })

      if (!object) {
        tiktok.trend("discover_user", { number: pageSizeTikTok, proxy: '', timeout: 0, download: false, filepath: process.cwd(), filepath: 'na' }).then((res) => {
          if (!roomdata.get(socket, 'tiktokSignature')) {
            console.log('new signature');
            roomdata.set(socket, 'tiktokSignature', res.signature)
          }
          roomdata.set(socket, 'loadedTiktoks', res.collector); sendTiktok(socket, room)
        })
      } else {
        tiktok.trend("discover_user", { number: pageSizeTikTok, proxy: '', timeout: 0, download: false, filepath: process.cwd(), filepath: 'na', signature: object }).then((res) => {
          roomdata.set(socket, 'loadedTiktoks', res.collector); sendTiktok(socket, room)
        })
      }

    }

    const getLatestCoubs = (object) => {
      roomdata.set(socket, 'timeline', object)
      sendMessage(room, { userId: 'System', from: 'System', message: object.category + ' sorted by ' + object.sort + ' /: ' + roomdata.get(socket, 'currentVideoPage'), time: new Date().toLocaleTimeString() })
      return new Promise((resolve, reject) => {
        if (object.category === 'hot') {
          request(
            {
              url: `http://coub.com/api/v2/timeline/hot?page=${roomdata.get(
                socket,
                'currentVideoPage'
              )}&per_page=${pageSizeCoub}&order_by=${object.sort}`,
              json: true
            },
            function (error, response, body) {
              if (!error && response.statusCode === 200) {
                roomdata.set(socket, 'loadedCoubs', body['coubs'])
                sendCoub(socket, room)
                try {
                  sendMessage(room, { userId: 'System', from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].title, time: new Date().toLocaleTimeString() })
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
                'currentVideoPage'
              )}&per_page=${pageSizeCoub}`,
              json: true
            },
            function (error, response, body) {
              if (!error && response.statusCode === 200) {
                roomdata.set(socket, 'loadedCoubs', body['coubs'])
                sendCoub(socket, room)

                try {
                  sendMessage(room, { userId: 'System', from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].title, time: new Date().toLocaleTimeString() })
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
                  'currentVideoPage'
                )}&per_page=${pageSizeCoub}`,
                json: true
              },
              function (error, response, body) {
                if (!error && response.statusCode === 200) {
                  roomdata.set(socket, 'loadedCoubs', body['coubs'])
                  sendCoub(socket, room)
                  try {
                    sendMessage(room, { userId: 'System', from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].title, time: new Date().toLocaleTimeString() })
                    sendMessage(room, { userId: 'System', from: 'System', message: object.channel, time: new Date().toLocaleTimeString() })
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
                  'currentVideoPage'
                )}&per_page=${pageSizeCoub}`,
                json: true
              },
              function (error, response, body) {
                if (!error && response.statusCode === 200) {
                  roomdata.set(socket, 'loadedCoubs', body['coubs'])
                  sendCoub(socket, room)
                  try {
                    sendMessage(room, { userId: 'System', from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].title, time: new Date().toLocaleTimeString() })
                    sendMessage(room, { userId: 'System', from: 'System', message: '#' + object.hashtag, time: new Date().toLocaleTimeString() })
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
      resetRoom(object)
      io.sockets
      .in(room)
      .emit(
        'changeCategory', object.platform
      )

      switch (object.platform) {
        case 'coub':
          getLatestCoubs(object)

        case 'tiktok':
          getTikToks()
          break

        case 'video':
          getVideo()
          break
      }
    })

    socket.on('reqPrev', function () {

      switch (roomdata.get(socket, 'platform')) {
        case 'coub':
          if (roomdata.get(socket, 'loadedCoubs') != null) {
            if (roomdata.get(socket, 'videoIndex') > 0) {
              roomdata.set(
                socket,
                'videoIndex',
                roomdata.get(socket, 'videoIndex') - 1
              )

              sendCoub(socket, room)
              try {
                sendMessage(room, { userId: 'System', from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].title, time: new Date().toLocaleTimeString() })
              } catch (error) {
                console.log(error)
              }
            } else {
              if (roomdata.get(socket, 'currentVideoPage') > 1) {
                roomdata.set(
                  socket,
                  'currentVideoPage',
                  roomdata.get(socket, 'currentVideoPage') - 1
                )
                roomdata.set(socket, 'videoIndex', pageSizeCoub - 1)
                getLatestCoubs(roomdata.get(socket, 'timeline'))
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
          break

        case 'tiktok':
          if (roomdata.get(socket, 'loadedTiktoks') != null) {
            if (roomdata.get(socket, 'videoIndex') > 0) {
              roomdata.set(
                socket,
                'videoIndex',
                roomdata.get(socket, 'videoIndex') - 1
              )

              sendTiktok(socket, room)
              try {
                //     sendMessage(room, { userId: 'System', from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].title, time: new Date().toLocaleTimeString() })
              } catch (error) {
                console.log(error)
              }
            } else {
              // if (roomdata.get(socket, 'currentVideoPage') > 1) {
              //   roomdata.set(
              //     socket,
              //     'currentVideoPage',
              //     roomdata.get(socket, 'currentVideoPage') - 1
              //   )
              //   roomdata.set(socket, 'videoIndex', pageSizeCoub - 1)
              //   getLatestCoubs(roomdata.get(socket, 'timeline'))
              // } else {
              //   io.sockets
              //     .in(room)
              //     .emit('notification', { text: 'start', type: 'error' })
              // }
            }
          } else {
            io.sockets
              .in(room)
              .emit('notification', { text: 'Select source', type: 'warning' })
          }
          break;
      }

    })

    socket.on('reqNext', function () {

      switch (roomdata.get(socket, 'platform')) {
        case 'coub':
          if (roomdata.get(socket, 'loadedCoubs') != null) {
            if (roomdata.get(socket, 'videoIndex') < pageSizeCoub - 1) {
              roomdata.set(
                socket,
                'videoIndex',
                roomdata.get(socket, 'videoIndex') + 1
              )
              sendCoub(socket, room)
              try {
                sendMessage(room, { userId: 'System', from: 'Coub', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].title, time: new Date().toLocaleTimeString() })
              } catch (error) {
                console.log(error)
              }
            } else {
              roomdata.set(socket, 'videoIndex', 0)
              roomdata.set(
                socket,
                'currentVideoPage',
                roomdata.get(socket, 'currentVideoPage') + 1
              )
              getLatestCoubs(roomdata.get(socket, 'timeline')).then(() => {
              })
            }
          } else {
            io.sockets
              .in(room)
              .emit('notification', { text: 'Select source', type: 'warning' })
          }
          break

        case 'tiktok':
          if (roomdata.get(socket, 'loadedTiktoks') != null) {
            if (roomdata.get(socket, 'videoIndex') < pageSizeTikTok - 1) {
              roomdata.set(
                socket,
                'videoIndex',
                roomdata.get(socket, 'videoIndex') + 1
              )
              sendTiktok(socket, room)
              try {
                //    sendMessage(room, { userId: 'System', from: 'Tiktok', thumbnail: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].image_versions.template, link: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].permalink, message: roomdata.get(socket, 'loadedCoubs')[roomdata.get(socket, 'videoIndex')].title, time: new Date().toLocaleTimeString() })
              } catch (error) {
                console.log(error)
              }
            }
            else {
              roomdata.set(socket, 'videoIndex', 0)
              roomdata.set(
                socket,
                'currentVideoPage',
                roomdata.get(socket, 'currentVideoPage') + 1
              )
              getTikToks(roomdata.get(socket, 'tiktokSignature'))
            }
          } else {
            io.sockets
              .in(room)
              .emit('notification', { text: 'Error', type: 'warning' })
          }
          break
      }

    }
    )
    socket.on('disconnect', function () {
      console.log('user left ', socket.username)
      sendMessage(room, { userId: 'System', from: 'Debug', time: new Date(), message: 'User left', id: socket.id, username: socket.username, joined: new Date(), owner: socket.id === roomdata.get(socket, 'roomOwner') })

      try {
        handleUsers(socket, room)
        roomdata.leaveRoom(socket)
      } catch (error) {
        console.log(error)
      }
      io.sockets.in(room).emit('notification', {
        text: 'User ' + socket.username + ' left',
        type: 'info'
      })
    })
  })
})

http.listen(port, function () {
  console.log('listening on *:' + port)
})
