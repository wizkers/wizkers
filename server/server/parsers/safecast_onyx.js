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

/*
 * A parser for the SafeCast Onyx.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 * Only works on the current devel branch with json-compliant
 * serial output.
 */

var serialport = require('serialport'),
    events = require('events'),
    dbs = require('../pouch-config'),
    debug = require('debug')('wizkers:parsers:onyx'),
    serialconnection = require('../connections/serial');

var Onyx = function () {

    // Init the EventEmitter
    events.EventEmitter.call(this);

    /////////
    // Public variables
    /////////    
    this.name = "onyx";

    /////////
    // Private variables
    /////////    
    var port = null;
    var isopen = false;
    var instrumentid = null;
    var port_close_requested = false;
    var self = this;

    var uidrequested = false;
    var streaming = false;
    var livePoller = null;

    /////////
    // Private methods
    /////////

    var status = function (stat) {
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
    var portSettings = function () {
        return {
            baudRate: 115200,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            // simply pass each line to our JSON streaming parser
            // Note: the Onyx outputs json with \n at the end, so
            // the default readline parser works fine (it separates on \r)
            parser: serialport.parsers.readline()
        }
    };

    var format = function (data) {
        // All commands now return JSON
        try {
            //debug(Hexdump.dump(data.substr(0,5)));
            if (data.substr(0, 2) == "\n>")
                return;
            if (data.length < 2)
                return;
            var response = JSON.parse(data);
            if (uidrequested && response.guid != undefined) {
                self.emit('data', {
                    uniqueID: response.guid
                });
                uidrequested = false;
            } else {
                // Send the response to the front-end
                self.emit('data', response);
            }
        } catch (err) {
            debug('Not able to parse JSON response from device:\n' + data);
            debug('Error code: ' + err);
        }
    };



    /////////
    // Public methods
    /////////

    // Creates and opens the connection to the instrument.
    // for all practical purposes, this is really the init method of the
    // driver
    this.openPort = function (id) {
        instrumentid = id;
        dbs.instruments.get(id, function (err, item) {
            port = new serialconnection(item.port, portSettings());
            port.on('data', format);
            port.on('status', status);
        });
    }

    this.closePort = function (data) {
        this.stopLiveStream();
        // We need to remove all listeners otherwise the serial port
        // will never be GC'ed
        port.removeListener('data', format);
        port_close_requested = true;
        port.close();
    }

    this.isOpen = function () {
        return isopen;
    }

    this.getInstrumentId = function (format) {
        return instrumentid;
    };

    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    // This particular device does not support this concept, so we
    // always return the same
    this.sendUniqueID = function () {
        uidrequested = true;
        port.write(this.output('{ "get": "guid" }'));
    };

    this.isStreaming = function () {
        return streaming;
    };

    this.startLiveStream = function (period) {
        if (!streaming) {
            debug("Starting live data stream");
            livePoller = setInterval(function () {
                self.output('GETCPM');
            }, (period) ? period * 1000 : 1000);
            streaming = true;
        }
    };

    this.stopLiveStream = function (period) {
        if (streaming) {
            debug("Stopping live data stream");
            clearInterval(livePoller);
            streaming = false;
        }
    };

    this.output = function (data) {
        port.write(data + '\n\n');
    };

};

Onyx.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Onyx;