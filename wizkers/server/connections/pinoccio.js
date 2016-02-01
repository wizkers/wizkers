/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
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