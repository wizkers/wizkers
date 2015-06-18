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
 *  Class for a pinoccio Scout
 *
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var net = require('net'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    debug = require('debug')('wizkers:connections:pinoccio:scout');


//////////////////
// Pinocc.io scout
//////////////////

/**
 * Connection to Pinocc.io scouts through Server emulation.
 * 
 * @param   {Object}   sock the server socket
 */
var Scout = function (sock) {

    EventEmitter.call(this);

    debug("Creating Pinocc.io scout with the following info:");
    debug(sock);
    
    var self = this,
        serial = 0;
    
    sock.on('data', function(data) {
        var strdata = data.toString().split('\n');
        for (idx in strdata) {
            try {
                jsdata = JSON.parse(strdata[idx]);
            } catch (e) {
                debug(data[idx]);
                return;
            }

            debug(jsdata);
            self.emit('data', jsdata);
        }
    });

    /**
     * The main role of this is to respawn the stream which
     * sometimes dies on us.
     * @param {String} error the error message
     */
    var handleError = function (error) {
        debug('Error on stream');
        debug(error);
    }

    return this;
}

util.inherits(Scout, EventEmitter);
module.exports = Scout;