/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
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

var server = require('pinoccio-server'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
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
    var portOpen = false;
    var self = this;

    debug("Creating Pinocc.io object with the following info:");
    debug(path);

    // Initialize the server (needs those, will be removed later on)
    var opts = {
        apiHost: 'pool.base.pinocc.io',
        apiPort: 22756
    };

    var forwardData = function (data) {
        debug(data);
        self.emit('data', data);
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
        sync.end();
        sync.destroy();
        sync = myPino.sync({
            stale: 1
        })
        self.open();
    }

    this.open = function () {
        debug("Listening to data stream");

        server(opts, function (troop) {
            // Log all the data streaming in from the Troop
            troop.on('data', forwardData);
            troop.on('error', handleError);

        }).on('listening', function () {
            debug('local pinoccio server listening on ', this.address());
            portOpen = true;
            debug('Port open');
            self.emit('status', {
                portopen: portOpen
            });
        });

    };

    this.write = function (data) {}

    this.close = function () {
        sync.removeListener('data', forwardData);
        sync.removeListener('error', handleError);
        portOpen = false;
        self.emit('status', {
            portopen: portOpen
        });
    }

    return this;
}

util.inherits(PinoConnection, EventEmitter);
module.exports = PinoConnection;