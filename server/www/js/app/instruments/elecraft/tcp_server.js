/*
 * Rigctl emulation in Chrome
 *
 * Inspiration from https://github.com/GoogleChrome/chrome-app-samples/blob/master/samples/tcpserver/tcp-server.js
 Copyright 2012 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Author: Renato Mangini (mangini@chromium.org)
 * 
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
    var Rigctld = function() {
        
        console.log("Starting Rigctld server");
        this.addr = "127.0.0.1";
        this.port = 4532;
        this.maxConnections = 5;
        
        // Chrome requires a bunch of callbacks with their TCP Server stack
        this.callbacks = {
            listen: null,       // Listening
            connect: null,      // Socket connected
            disconnect: null,   // Socket disconnected
            recv: null,         // Data received
            sent: null,         // Data sent
        }
        
        // Sockets open
        this.openSockets=[];

        // server socket (one server connection, accepts and opens one socket per client)
        this.serverSocketId = null;
        
        
        /**
         * Connects to the TCP socket, and creates an open socket.
         *
         * @see https://developer.chrome.com/apps/sockets_tcpServer#method-create
         * @param {Function} callback The function to call on connection
         */
        this.listen =  function(callback) {
            // Register connect callback.
            this.callbacks.connect = callback;
            tcps.create({}, this._onCreate.bind(this));
        };
        
        /**
         * Disconnects from the remote side
         *
         * @see https://developer.chrome.com/apps/sockets_tcpServer#method-disconnect
         */
        this.disconnect = function() {
            if (this.serverSocketId) {
              tcps.onAccept.removeListener(this._onAccept);
              tcps.onAcceptError.removeListener(this._onAcceptError);
              tcps.close(this.serverSocketId);
            }
            for (var i=0; i<this.openSockets.length; i++) {
              try {
                this.openSockets[i].close();
              } catch (ex) {
                console.log(ex);
              }
            }
            this.openSockets=[];
            this.serverSocketId=0;
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
        this._onCreate = function(createInfo) {
            this.serverSocketId = createInfo.socketId;
            if (this.serverSocketId > 0) {
              tcps.onAccept.addListener(this._onAccept);
              tcps.onAcceptError.addListener(this._onAcceptError);
              tcps.listen(this.serverSocketId, this.addr, this.port, 50,
                this._onListenComplete.bind(this));
              this.isListening = true;
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
          this._onListenComplete = function(resultCode) {
            if (resultCode !==0) {
              error('Unable to listen to socket. Resultcode='+resultCode);
            }
          }

          this._onAccept = function (info) {
            if (info.socketId != this.serverSocketId)
              return;

            if (this.openSockets.length >= this.maxConnections) {
              this._onNoMoreConnectionsAvailable(info.clientSocketId);
              return;
            }

            var tcpConnection = new TcpConnection(info.clientSocketId);
            this.openSockets.push(tcpConnection);

            tcpConnection.requestSocketInfo(this._onSocketInfo.bind(this));
            log('[TCP Server] Incoming connection handled.');

          }

          this._onAcceptError = function(info) {
            if (info.socketId != this.serverSocketId)
              return;

            error('[TCP Server] Unable to accept incoming connection. Error code=' + info.resultCode);
          }
          
          this._onAccept = this._onAccept.bind(this);
          this._onAcceptError = this._onAcceptError.bind(this);


          this._onNoMoreConnectionsAvailable = function(socketId) {
            var msg="No more connections available. Try again later\n";
            _stringToArrayBuffer(msg, function(arrayBuffer) {
              chrome.sockets.tcp.send(socketId, arrayBuffer,
                function() {
                  chrome.sockets.tcp.close(socketId);
                });
            });
          }

        this._onSocketInfo = function(tcpConnection, socketInfo) {
            if (this.callbacks.connect) {
              this.callbacks.connect(tcpConnection, socketInfo);
            }
          }
        
        
    }

    /**
   * Holds a connection to a client
   *
   * @param {number} socketId The ID of the server<->client socket
   */
  function TcpConnection(socketId) {
    this.socketId = socketId;
    this.socketInfo = null;

    // Callback functions.
    this.callbacks = {
      disconnect: null, // Called when socket is disconnected.
      recv: null,       // Called when client receives data from server.
      sent: null        // Called when client sends data to server.
    };

    log('Established client connection. Listening...');

  };

  TcpConnection.prototype.setSocketInfo = function(socketInfo) {
    this.socketInfo = socketInfo;
  };

  TcpConnection.prototype.requestSocketInfo = function(callback) {
    chrome.sockets.tcp.getInfo(this.socketId,
      this._onSocketInfo.bind(this, callback));
  };

  /**
   * Add receive listeners for when a message is received
   *
   * @param {Function} callback The function to call when a message has arrived
   */
  TcpConnection.prototype.startListening = function(callback) {
    this.callbacks.recv = callback;

    // Add receive listeners.
    this._onReceive = this._onReceive.bind(this);
    this._onReceiveError = this._onReceiveError.bind(this);
    chrome.sockets.tcp.onReceive.addListener(this._onReceive);
    chrome.sockets.tcp.onReceiveError.addListener(this._onReceiveError);

    chrome.sockets.tcp.setPaused(this.socketId, false);
  };

  /**
   * Sets the callback for when a message is received
   *
   * @param {Function} callback The function to call when a message has arrived
   */
  TcpConnection.prototype.addDataReceivedListener = function(callback) {
    // If this is the first time a callback is set, start listening for incoming data.
    if (!this.callbacks.recv) {
      this.startListening(callback);
    } else {
      this.callbacks.recv = callback;
    }
  };


  /**
   * Sends a message down the wire to the remote side
   *
   * @see https://developer.chrome.com/apps/sockets_tcp#method-send
   * @param {String} msg The message to send
   * @param {Function} callback The function to call when the message has sent
   */
  TcpConnection.prototype.sendMessage = function(msg, callback) {
    _stringToArrayBuffer(msg, function(arrayBuffer) {
      chrome.sockets.tcp.send(this.socketId, arrayBuffer, this._onWriteComplete.bind(this));
    }.bind(this));

    // Register sent callback.
    this.callbacks.sent = callback;
  };


  /**
   * Disconnects from the remote side
   *
   * @see https://developer.chrome.com/apps/sockets_tcp#method-close
   */
  TcpConnection.prototype.close = function() {
    if (this.socketId) {
      chrome.sockets.tcp.onReceive.removeListener(this._onReceive);
      chrome.sockets.tcp.onReceiveError.removeListener(this._onReceiveError);
      chrome.sockets.tcp.close(this.socketId);
    }
  };


  /**
   * Callback function for when socket details (socketInfo) is received.
   * Stores the socketInfo for future reference and pass it to the
   * callback sent in its parameter.
   *
   * @private
   */
  TcpConnection.prototype._onSocketInfo = function(callback, socketInfo) {
    if (callback && typeof(callback)!='function') {
      throw "Illegal value for callback: "+callback;
    }
    this.socketInfo = socketInfo;
    callback(this, socketInfo);
  }

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
  TcpConnection.prototype._onReceive = function(info) {
    if (this.socketId != info.socketId)
      return;

    // Call received callback if there's data in the response.
    if (this.callbacks.recv) {
      // Convert ArrayBuffer to string.
      _arrayBufferToString(info.data, this.callbacks.recv.bind(this));
    }
  };

  TcpConnection.prototype._onReceiveError = function (info) {
    if (this.socketId != info.socketId)
      return;
    this.close();
  };

  /**
   * Callback for when data has been successfully
   * written to the socket.
   *
   * @private
   * @param {Object} writeInfo The outgoing message
   */
  TcpConnection.prototype._onWriteComplete = function(writeInfo) {
    //log('onWriteComplete');
    // Call sent callback.
    if (this.callbacks.sent) {
      this.callbacks.sent(writeInfo);
    }
  };
    
    return {
        server: Rigctld,
        connection: TcpConnection
    }
});
        
        
        
