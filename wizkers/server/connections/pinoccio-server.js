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
 *  Connection to Pinocc.io devices connected directly to Wizkers
 *
 * Opens at create, sends 'data' events,
 * and 'status' events.
 *
 *
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var net = require('net'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    Scout = require('./pinoccio/scout'),
    debug = require('debug')('wizkers:connections:pinoccio');


//////////////////
// Pinocc.io server emulation:
//////////////////

/**
 * Connection to Pinocc.io scouts through Server emulation.
 * You will need to setup each scout to talk to the Wizkers instance directly
 * by giving them a 'hq.setaddress("YOUR_IP_ADDRESS"); wifi.dhcp; wifi.reassociate;'
 * command.
 * @param   {Object}   path JSON object with {token: "pinocc.io API token"}
 * @returns {Function} the connection function
 */
var PinoConnection = function (path) {

    EventEmitter.call(this);
    var portOpen = false,
        self = this,
        server = null,
        troop = {},
        port = 22756;

    debug("Creating Pinocc.io object with the following info:");
    debug(path);

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

    var addScout = function(scoutID) {
        debug('Scout ID ' + scoutID + ' is ready',this);
        troop[scoutID]= this;
    }

    this.open = function () {
        debug("Listening to data stream");

        server = net.createServer(function (sock) {
            var scout = new Scout(sock);
            // Forward all the data streaming in from the Troop
            scout.on('data', forwardData);
            scout.on('error', handleError);
            scout.on('ready', addScout);

            // TODO: there might be a memory leak here, with scout objects not garbage
            // collected properly upon socket closing.

        });

        server.listen(port, function (err) {
            debug('local pinoccio server listening on ', this.address());
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
     * Write to a scout - Only scoutscript commands for now.
     * @param {Object} data is the data to send. Needs to contain a "id" string
     *                      to indicate which board we want to talk to, and a
     *                      "command" key which contains the command.
     */
    this.write = function (data) {
        var token = data.token;
        if ( token != undefined) {
            troop[token].sendCommand(data.command);
        }
    }

    this.close = function () {
        for (scout in troop) {
            troop[scout].removeListener('data', forwardData);
            troop[scout].removeListener('error', handleError);
            troop[scout].removeListener('ready', addScout);
            delete troop[scout];
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

util.inherits(PinoConnection, EventEmitter);
module.exports = PinoConnection;