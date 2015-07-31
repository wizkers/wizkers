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
        var id = data.id;
        if ( id != undefined) {
            troop[id].sendCommand(data.command);
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