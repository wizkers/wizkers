/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
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
 *  Connection to devices connected through the Pinoccio network
 *
 * Opens at create, sends 'data' events,
 * and 'status' events.
 *
 *
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var pinoccio = require('pinoccio'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    debug = require('debug')('wizkers:connections:pinoccio');


//////////////////
// Pinocc.io network interface:
//////////////////

/**
 * Connection to the Pinocc.io network
 * @param   {Object}   path JSON object with {token: "pinocc.io API token"}
 * @returns {Function} the connection function
 */
var PinoConnection = function(path) {

    EventEmitter.call(this);
    var portOpen = false;
    var self = this;

    debug("Creating Pinocc.io object with the following info:");
    debug(path);

    if (path.token === undefined)
        return;

    // Initialize the API with the API token
    var myPino = pinoccio(path.token);
    var sync = myPino.sync({stale:1});

    var forwardData = function(data) {
            debug(data);
            self.emit('data',data);
    };

    /**
     * The main role of this is to respawn the stream which
     * sometimes dies on us.
     * @param {String} error the error message
     */
    var handleError = function(error) {
        debug('Error on stream');
        debug(error);
        // Close the stream, and reopen it
        sync.end();
        sync.destroy();
        sync = myPino.sync({stale:1})
        self.open();
    }

    this.open = function() {
        debug("Listening to data stream");

        sync.on('data', forwardData);
        sync.on('error', handleError);
        portOpen = true;
        debug('Port open');
        this.emit('status', {portopen: portOpen});

    };

    this.write = function(data) {
    }

    this.close = function() {
        sync.removeListener('data', forwardData);
        sync.removeListener('error', handleError);
        portOpen = false;
        self.emit('status', {portopen: portOpen});
    }

    return this;
}

util.inherits(PinoConnection, EventEmitter);
module.exports = PinoConnection;