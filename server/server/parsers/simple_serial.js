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

/*
 * A very straightforward serial device, mostly meant as an example
 * but can be useful to display simple serial devices
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

"use strict";

var serialport = require('serialport'),
    events = require('events'),
    serialconnection = require('../connections/serial'),
    debug = require('debug')('wizkers:parsers:simpleserial'),
    dbs = require('../pouch-config');

var SimpleSerial = function() {

    // Init the EventEmitter
    events.EventEmitter.call(this);

    /////////
    // Public variables
    /////////
    this.name = "simple_serial";

    /////////
    // Private variables
    /////////
    var port = null;
    var baudrate = 115200;
    var isopen = false;
    var instrumentid = null;
    var port_close_requested = false;
    var self = this;

    /////////
    // Private methods
    /////////

    var status = function(stat) {
        debug('Port status change', stat);
        isopen = stat.portopen;
        
        if (isopen) {
            // Should run any "onOpen" initialization routine here if
            // necessary.
        } else {
            // We remove the listener so that the serial port can be GC'ed
            if (port_close_requested) {
                port.removeListener('status', status);
                port_close_requested = false;
            }
        }
    };

    // How the device is connected on the serial port            
    var portSettings = function() {
        var ps =  {
            baudRate: baudrate,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            parser: serialport.parsers.raw,
        };
        
        return ps;
    };

    // format just sends the raw data back, nothing more, nothing less, but translated
    // into a string:
    var format = function(data) {
        self.emit('data',data.toString());
    };

    /////////
    // Public methods
    /////////

    // Creates and opens the connection to the instrument.
    // for all practical purposes, this is really the init method of the
    // driver
    this.openPort = function(id) {
        instrumentid = id;
        dbs.instruments.get(id, function(err,item) {
            if (item.metadata && item.metadata.baudrate) {
                debug('Baud rate: ' + item.metadata.baudrate);
                baudrate = item.metadata.baudrate;
            }
            port = new serialconnection(item.port, portSettings());
            port.on('data', format);
            port.on('status', status);
        });
    }

    this.closePort = function(data) {
        // We need to remove all listeners otherwise the serial port
        // will never be GC'ed
        port.removeListener('data', format);
        port_close_requested = true;
        port.close();
    }
    
    this.isOpen = function() {
        return isopen;
    }

    this.getInstrumentId = function(format) {
        return instrumentid;
    };

    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    // This particular device does not support this concept, so we
    // always return the same
    this.sendUniqueID = function() {
        this.emit('data',{ uniqueID:'00000000 (n.a.)'});
    };

    this.isStreaming = function() {
        return true;
    };

    // period is in seconds
    // The sensor sends data by itself, so those functions are empty...
    this.startLiveStream = function(period) {
    };

    this.stopLiveStream = function(period) {
    };

    // output should return a string, and is used to format
    // the data that is sent on the serial port, coming from the
    // HTML interface.
    this.output = function(data) {
        port.write(data);
    }
};


SimpleSerial.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = SimpleSerial;