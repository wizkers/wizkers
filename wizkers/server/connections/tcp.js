/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2019 Edouard Lafargue, ed@wizkers.io
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
 *  TCP client connection
 *
 */

var net = require('net'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    debug = require('debug')('wizkers:connections:tcp-client');

var Debug = false;

/**
 * TCP/IP interface
 * path is in the form of: { host: 'radiostation', port: '2947', proto: 'tcp' }
 */
var TCPClient = function(path, parser) {

    EventEmitter.call(this);
    var self = this,
        client = null;

    debug("Opening device at", path);

    this.write = function(data) {
        debug('Port write' + data);
        try {
            client.write(data);
        } catch (err) {
            debug('Port write error! ' + err);
        }
    };

    this.close = function() {
        debug('Port close');
        client.end();
    };

    this.open = function () {
        client = net.connect({ port: path.port, host: path.host }, function() {
            debug('TCP connection established with', path.host, 'on port', path.port);
            // Confirm the port is open:
            self.emit('status', {portopen: true, openerror: false});
        });

        client.on('error', function(err) {
            debug("oops, error connecting", err);
            self.emit('status', { portopen: false, openerror: true});
            client.end();
        });

        // If we passed a parser, use it:
        if (parser) {
            debug('Piping to parser');
            client.pipe(parser);
            parser.on('data', function (data) {
                    self.emit('data',data);
            });
        } else {
            // listen for new serial data:
            client.on('data', function (data) {
                    self.emit('data',data);
            });
        }

        client.on('close', function() {
            debug('Port closing');
            portOpen = false;
            self.emit('status', { portopen: false, error: false});
        });
    }

    return this;
}

util.inherits(TCPClient, EventEmitter);

module.exports = TCPClient;
