/*
 * XMP-RPC server in Chrome
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

    // Rigctld server emulation:
    var rigctlServer = null;
    var serverSocketId = null;

    // Make our life easier by defining a shortcut
    var tcps = chrome.sockets.tcpServer;
    
    /**
   * Converts an array buffer to a string
   *
   * @private
   * @param {ArrayBuffer} buf The buffer to convert
   * @param {Function} callback The function to call when conversion is complete
   */
  function _arrayBufferToString(buf, callback) {
    var bb = new Blob([new Uint8Array(buf)]);
    var f = new FileReader();
    f.onload = function(e) {
      callback(e.target.result);
    };
    f.readAsText(bb);
  }

  /**
   * Converts a string to an array buffer
   *
   * @private
   * @param {String} str The string to convert
   * @param {Function} callback The function to call when conversion is complete
   */
  function _stringToArrayBuffer(str, callback) {
    var bb = new Blob([str]);
    var f = new FileReader();
    f.onload = function(e) {
        callback(e.target.result);
    };
    f.readAsArrayBuffer(bb);
  }


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
     * A rigctl emulator.
     *
     *  port is a reference to the serial port
     *  channel is the communication channel with the app (equiv to socket.io)
     */
    var Rigctld = function(ipaddr, tcpport) {
        
        console.log("Starting XML-RPC server on port 12345");
        var addr = ipaddr;
        var port = tcpport;
        var maxConnections = 10;
        var isListening = false;
        
        // Chrome requires a bunch of callbacks with their TCP Server stack
        var callbacks = {
            listen: null,       // Listening
            connect: null,      // Socket connected
            disconnect: null,   // Socket disconnected
            recv: null,         // Data received
            sent: null,         // Data sent
        }
        
        // Sockets open
        var openSockets=[];

        // server socket (one server connection, accepts and opens one socket per client)
        var serverSocketId = null;
        
        
        /**
         * Connects to the TCP socket, and creates an open socket.
         *
         * @see https://developer.chrome.com/apps/sockets_tcpServer#method-create
         * @param {Function} callback The function to call on connection
         */
        this.start =  function(callback) {
            // Register connect callback.
            callbacks.connect = callback;
            tcps.create({}, onCreate);
        };
        
        /**
         * Disconnects from the remote side
         *
         * @see https://developer.chrome.com/apps/sockets_tcpServer#method-disconnect
         */
        this.disconnect = function() {
            if (serverSocketId) {
              tcps.onAccept.removeListener(onAccept);
              tcps.onAcceptError.removeListener(onAcceptError);
              tcps.close(serverSocketId);
            }
            for (var i=0; i< openSockets.length; i++) {
              try {
                openSockets[i].close();
              } catch (ex) {
                console.log(ex);
              }
            }
            openSockets = [];
            serverSocketId = 0;
        };

        /**
           * The callback function used for when we attempt to have Chrome
           * create a socket. If the socket is successfully created
           * we go ahead and start listening for incoming connections.
           *
           * @private
           * @see https://developer.chrome.com/apps/sockets_tcpServer#method-listen
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

            tcpConnection.requestSocketInfo(onSocketInfo);
            log('[TCP Server] Incoming connection handled.');

          }

          var onAcceptError = function(info) {
            if (info.socketId != serverSocketId)
              return;

            error('[TCP Server] Unable to accept incoming connection. Error code=' + info.resultCode);
          }
          
          var onNoMoreConnectionsAvailable = function(socketId) {
            var msg="No more connections available. Try again later\n";
            _stringToArrayBuffer(msg, function(arrayBuffer) {
              chrome.sockets.tcp.send(socketId, arrayBuffer,
                function() {
                  chrome.sockets.tcp.close(socketId);
                });
            });
          }

        var onSocketInfo = function(tcpConnection, socketInfo) {
            if (callbacks.connect) {
              callbacks.connect(tcpConnection, socketInfo);
            }
          }
        
        
    }

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
      disconnect: null, // Called when socket is disconnected.
      recv: null,       // Called when client receives data from server.
      sent: null        // Called when client sends data to server.
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
          _arrayBufferToString(info.data, callbacks.recv);
        }
      };

      /**
       * Sets the callback for when a message is received
       *
       * @param {Function} callback The function to call when a message has arrived
       */
      this.addDataReceivedListener = function(callback) {
        // If this is the first time a callback is set, start listening for incoming data.
        if (!callbacks.recv) {
          startListening(callback);
        } else {
          callbacks.recv = callback;
        }
      };

      /**
       * Sends a message down the wire to the remote side
       *
       * @see https://developer.chrome.com/apps/sockets_tcp#method-send
       * @param {String} msg The message to send
       * @param {Function} callback The function to call once the message is sent
       */
      this.sendMessage = function(msg, callback) {
        _stringToArrayBuffer(msg, function(arrayBuffer) {
              // Register sent callback.
              callbacks.sent = callback;
              chrome.sockets.tcp.send(socketId, arrayBuffer, onWriteComplete);
          }
        );
      };
      
     var onReceiveError = function (info) {
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
        chrome.sockets.tcp.onReceive.removeListener(onReceive);
        chrome.sockets.tcp.onReceiveError.removeListener(onReceiveError);
        chrome.sockets.tcp.close(socketId);
      }
    };
    
  };
    
  return {
      server: Rigctld,
      connection: TcpConnection
  }
});
        
        
        
