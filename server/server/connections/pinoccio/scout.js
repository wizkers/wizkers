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
        token = undefined,
        lead_scout_id = undefined;
        
    
    sock.on('data', function(data) {
        var strdata = data.toString().split('\n');
        for (idx in strdata) {
            try {
                jsdata = JSON.parse(strdata[idx]);
            } catch (e) {
                break;
            }

            debug(jsdata);
            
            if (jsdata.from) {
                lead_scout_id = jsdata.from;
            }
            
            if (jsdata.token) {
                token = jsdata.token;
                self.emit('ready', token);
            } else if (token != 0) {
                jsdata.id = token;
            }                
            
            self.emit('data', jsdata);
        }        
    });
    
    sock.on('close', function(data) {
        debug('Socket close', data);
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
    
    
    /**
     * Send a command to a Scout. won't work if we send it before we know
     * the lead scout ID and token. Note: with the current way we use Scouts (only on Wifi),
     * this won't cover situations where we have several scouts per troop, since it will only
     * send commands to the lead scout.
     * @param {[[Type]]} cmd [[Description]]
     * @param {[[Type]]} cb  [[Description]]
     */
    this.sendCommand = function(cmd) {
        if (lead_scout_id != undefined && token != undefined) {
            sock.write('{"type":"command", "to":' + lead_scout_id + ', "id":"' + token + '",  "command":"' + cmd + '"}\n');
        }
    };
    
    

    return this;
}

util.inherits(Scout, EventEmitter);
module.exports = Scout;