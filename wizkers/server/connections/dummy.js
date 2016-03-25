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
 *  Dummy port connection
 *
 * Opens at create, sends random 'data' events,
 * and 'status' events.
 *
 * Supports a "write" method.
 *
 * At this point, this is just a simple wrapper around
 * serialport, it just gives us a bit of abstraction in
 * case we want to implement other kinds of connections/drivers
 * later on.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    debug = require('debug')('wizkers:connections:dummy');

var Debug = false;

//////////////////
// Serial port interface:
//////////////////
var DummyConnection = function(path, settings) {
    
    EventEmitter.call(this);
    var self = this,
        time = null;

    debug("Opening dummy device at " + path);  
    
    this.write = function(data) {
        debug('Port dummy write' + data);
    }
    
    this.close = function() {
        debug('Port dummy close');
        if (timer) {
           clearInterval(timer);
           timer = null;
        }
        this.emit('status', { portopen: false, error: false});
    }
    
    this.open = function () {
        // Confirm the port is open:
        this.emit('status', {portopen: true, error: false});        
        // Start  a timer and send a random value between 0 and 100 every second
        timer = setInterval(output_random_data, 1000);
    }
    

    var output_random_data = function() {
        self.emit('data',
            { value: Math.random()*100 });
    };
    
    
    
    return this;
}

util.inherits(DummyConnection, EventEmitter);

module.exports = DummyConnection;

