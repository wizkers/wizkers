/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2018 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 *  TCP Server waiting for devices to connect.
 *
 * Opens at create, sends 'data' events,
 * and 'status' events whenever others connect and send
 * data.
 *
 *
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var net = require('net'),
    EventEmitter = require('events').EventEmitter,
    Client = require('./tcpclient/client'),
    util = require('util'),
    debug = require('debug')('wizkers:connections:tcp-server');


//////////////////
// Simple TCP server:
//////////////////

/**
 * Incoming connection from a TCP client
 * @param   {Object}   config JSON object with {port: tcp port}
 * @returns {Function} the connection function
 */
var TcpConnection = function (config) {

    EventEmitter.call(this);
    var portOpen = false,
        self = this,
        server = null,
        clients = {},
        port = 22756;

    debug('Creating TCP Connection object');

    var forwardData = function (data) {
        self.emit('data', jsdata);
    };

    /**
     * The main role of this is to respawn the stream which
     * sometimes dies on us.
     * @param {String} error the error message
     */
    var handleError = function (error) {
        debug('Error on stream');
        debug(error);
        // Close the stream, and reopen it
        server.end();
        server.destroy();
        self.open();
    }

    var addClient = function(clientID) {
        debug('Client ID ' + clientID + ' is ready',this);
        clients[clientID]= this;
    }

    this.open = function () {
        debug("Listening to data stream");

        server = net.createServer(function (sock) {
            var client = new Client(sock);
            // Forward all the data streaming in from the Troop
            client.on('data', forwardData);
            client.on('error', handleError);
            client.on('ready', addClient);

            // TODO: there might be a memory leak here, with client objects not garbage
            // collected properly upon socket closing.

        });

        server.listen(port, function (err) {
            debug('local TCP server listening on ', this.address());
            portOpen = true;
            debug('Port open');
            self.emit('status', {
                portopen: portOpen
            });
        }).on('error', function(err) {
            debug('Could not start the server: ', err);
        });
    };

    /**
     * Write to a client -
     * @param {Object} data is the data to send. Needs to contain a "id" string
     *                      to indicate which board we want to talk to, and a
     *                      "command" key which contains the command.
     */
    this.write = function (data) {
        var token = data.token;
        if ( token != undefined) {
            clients[token].sendCommand(data.command);
        }
    }

    this.close = function () {
        for (client in clients) {
            clients[client].removeListener('data', forwardData);
            clients[client].removeListener('error', handleError);
            clients[client].removeListener('ready', addClient);
            delete clients[client];
        }
        server.close(function (cb) {
            portOpen = false;
            self.emit('status', {
                portopen: portOpen
            });
        });
    }

    return this;
}

util.inherits(TcpConnection, EventEmitter);
module.exports = TcpConnection;