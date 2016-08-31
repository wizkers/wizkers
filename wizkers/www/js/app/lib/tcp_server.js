/*
 * Generic TCP server in Chrome
 *
 * Inspiration from https://github.com/GoogleChrome/chrome-app-samples/blob/master/samples/tcpserver/tcp-server.js
 * Copyright 2012 Google Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License attempt
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Author: Renato Mangini (mangini@chromium.org)
 */

define(function(require) {
    "use strict";

    var abu = require('app/lib/abutils');

    // Rigctld server emulation:
    var rigctlServer = null;
    var serverSocketId = null;

    // Make our life easier by defining a shortcut
    var tcps = chrome.sockets.tcpServer;


  /**
   * Wrapper function for logging
   */
  var  log = function(msg) {
    console.log(msg);
  }

  /**
   * Wrapper function for error logging
   */
  var error = function(msg) {
    console.error(msg);
  }


    /**
     *
     *  port is a reference to the serial port
     *
     */
    var Rigctld = function(ipaddr, tcpport) {

        console.log("Starting TCP server on port". tcpport);
        var addr = ipaddr;
        var port = tcpport;
        var isListening = false;

        // Chrome requires a bunch of callbacks with their TCP Server stack
        var callbacks = {
            listen: null,       // Listening
            connect: null,      // Socket connected
            recv: null,         // Data received
            sent: null,         // Data sent
        }

        // Sockets open
        var openSockets=[];

        // server socket (one server connection, accepts and opens one socket per client)
        var serverSocketId = null;


        /**
         * Connects to the TCP server, and creates an open socket.
         *
         * @see https://developer.chrome.com/apps/sockets_tcpServer#method-create
         * @param {Function} callback The function to call on connection
         */
        this.start =  function(connect_callback) {
            // Register connect callback.
            callbacks.connect = connect_callback;
            tcps.create({}, onCreate);
        };

        /**
         * Shutdown the TCP Server and disconnects all its sockets
         */
        this.disconnect = function() {
            for (var i=0; i< openSockets.length; i++) {
              try {
                openSockets[i].close();
              } catch (ex) {
                console.log(ex);
              }
            }
            if (serverSocketId) {
              tcps.onAccept.removeListener(onAccept);
              tcps.onAcceptError.removeListener(onAcceptError);
              tcps.close(serverSocketId);
            }
            openSockets = [];
            serverSocketId = 0;
        };

        /**
           * The callback function used for when we attempt to have Chrome
           * create a socket. If the socket is successfully created
           * we go ahead and start listening for incoming connections.
           *
           * @param {Object} createInfo The socket details
           */
        var onCreate = function(createInfo) {
            serverSocketId = createInfo.socketId;
            if (serverSocketId > 0) {
              tcps.listen(serverSocketId, addr, port, 50,
                onListenComplete);
              isListening = true;
            } else {
              error('Unable to create socket');
            }
          };

        /**
         * The callback function used for when we attempt to have Chrome
         * connect to the remote side. If a successful connection is
         * made then we accept it by opening it in a new socket (accept method)
         *
         * @private
         */
        var onListenComplete = function(resultCode) {
          if (resultCode !==0) {
            error('Unable to listen to socket. Resultcode='+resultCode);
          }
          tcps.onAccept.addListener(onAccept);
          tcps.onAcceptError.addListener(onAcceptError);
        }

        var onAccept = function (info) {
          if (info.socketId != serverSocketId)
            return;

          var tcpConnection = new TcpConnection(info.clientSocketId);
          openSockets.push(tcpConnection);
          console.info('We now have', openSockets.length, 'clients connected');
          tcpConnection.requestSocketInfo(onSocketInfo);
          console.log('[TCP Server] Incoming connection handled for socket', info.clientSocketId);

        }

        var onAcceptError = function(info) {
          if (info.socketId != serverSocketId)
            return;
          error('[TCP Server] Unable to accept incoming connection. Error code=' + info.resultCode);
        }

        var onNoMoreConnectionsAvailable = function(socketId) {
          var msg="No more connections available. Try again later\n";
          chrome.sockets.tcp.send(socketId, abu.str2ab(msg),
              function() {
                chrome.sockets.tcp.close(socketId);
          });
        }

        /**
         * Called by onAccept once the socket is open, so that the server's
         * "connect" callback is told about the new connection and given a handled
         * to the tcp socket object.
         */
        var onSocketInfo = function(tcpConnection, socketInfo) {
            if (callbacks.connect) {
              callbacks.connect(tcpConnection, socketInfo);
            }
            tcpConnection.addSocketClosedListener(onSocketClose);
        }

        /**
         * We need to track when a socket closes too
         */
        var onSocketClose = function(tcpConnection) {
          console.log('TCP Server notified of socket closing');
          var i = openSockets.indexOf(tcpConnection);
          openSockets.splice(i,1);
          console.info('We still have', openSockets.length, 'sockets open.');
        }

      };


  /**
   * Holds a connection to a client
   *
   * @param {number} socketId The ID of the server<->client socket
   */
  function TcpConnection(socketId) {
    var self = this;
    var socketId = socketId;
    var socketInfo = null;

    // Callback functions.
    var callbacks = {
      disconnect: [], // Called when socket is disconnected.
      recv: null,          // Called when client receives data from server.
      sent: null           // Called when client sends data to server.
    };

    log('Established client connection. Listening...');

    var setSocketInfo = function(sInfo) {
      socketInfo = sInfo;
    };

    this.requestSocketInfo = function(callback) {
        chrome.sockets.tcp.getInfo(socketId, function (socketInfo) {
          onSocketInfo(callback, socketInfo); });
    };

    /**
     * Callback function for when socket details (socketInfo) is received.
     * Stores the socketInfo for future reference and pass it to the
     * callback sent in its parameter.
     *
     * @private
     */
    var onSocketInfo = function(callback, socketInfo) {
      if (callback && typeof(callback)!='function') {
        throw "Illegal value for callback: " + callback;
      }
      console.info("TCP Connection: received socket info", socketInfo);
      socketInfo = socketInfo;
      callback(self, socketInfo);
    }


    /**
     * Add receive listeners for when a message is received
     *
     * @param {Function} callback The function to call when a message has arrived
     */
    var startListening = function(callback) {
      callbacks.recv = callback;

      // Add receive listeners.
      chrome.sockets.tcp.onReceive.addListener(onReceive);
      chrome.sockets.tcp.onReceiveError.addListener(onReceiveError);

      chrome.sockets.tcp.setPaused(socketId, false);
    };

    /**
     * Callback function for when data has been read from the socket.
     * Converts the array buffer that is read in to a string
     * and sends it on for further processing by passing it to
     * the previously assigned callback function.
     *
     * @private
     * @see TcpConnection.prototype.addDataReceivedListener
     * @param {Object} readInfo The incoming message
     */
    var onReceive = function(info) {
      if (socketId != info.socketId)
        return;

      // Call received callback if there's data in the response.
      if (callbacks.recv) {
        // Convert ArrayBuffer to string.
        callbacks.recv(abu.ab2str(info.data));
      }
    };

    /**
     * Sets the callback for when a message is received - one listener maximum
     *
     * @param {Function} callback The function to call when a message has arrived
     */
    this.addDataReceivedListener = function(callback, onError) {
      // If this is the first time a callback is set, start listening for incoming data.
      if (!callbacks.recv) {
        startListening(callback);
      } else {
        callbacks.recv = callback;
      }
      callbacks.disconnect.push(onError);
    };

    this.addSocketClosedListener = function(callback) {
      callbacks.disconnect.push(callback);
    }

    var lastMessage = '';

    /**
     * Sends a message down the wire to the remote side
     *
     * @see https://developer.chrome.com/apps/sockets_tcp#method-send
     * @param {String or ArrayBuffer} msg The message to send
     * @param {Function} callback The function to call once the message is sent
     */
    this.sendMessage = function(msg, callback) {
      lastMessage = msg;
      // Register sent callback.
      callbacks.sent = callback;
      chrome.sockets.tcp.send(socketId, abu.str2ab(msg), onWriteComplete);
    };

     var onReceiveError = function (info) {
       console.log("TCP receive error", info, '(we are socket' + socketId + ')');
        if (socketId != info.socketId)
          return;
        self.close();
      };

    /**
     * Callback for when data has been successfully
     * written to the socket.
     *
     * @private
     * @param {Object} writeInfo The outgoing message
     */
    var onWriteComplete = function(writeInfo) {
      //log('onWriteComplete');
      if (chrome.runtime && chrome.runtime.lastError) {
        console.log("Error while writing a packet", socketId, chrome.runtime.lastError, writeInfo);
        console.log("Messaqge not sent:", lastMessage);
      }
      // Call sent callback.
      if (callbacks.sent) {
        callbacks.sent(writeInfo);
      }
    };

    /**
     * Disconnects from the remote side
     *
     * @see https://developer.chrome.com/apps/sockets_tcp#method-close
     */
    this.close = function() {
      if (socketId) {
        console.info("Closing socket", socketId);
        chrome.sockets.tcp.onReceive.removeListener(onReceive);
        chrome.sockets.tcp.onReceiveError.removeListener(onReceiveError);
        if (callbacks.disconnect.length) {
          for (let i=0; i < callbacks.disconnect.length; i++) {
            callbacks.disconnect[i](this);
          }
        }
        chrome.sockets.tcp.close(socketId);
      }
    };

};

  return {
      server: Rigctld,
      connection: TcpConnection
  }
});



