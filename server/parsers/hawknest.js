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
 * A parser for the Medcom Hawk Nest Pinocc.io-based modules
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */

"use strict";

var events = require('events'),
    pinoconnection = require('../connections/pinoccio-server'),
    dbs = require('../pouch-config'),
    debug = require('debug')('wizkers:parsers:hawknest');


var HawkNest = function () {

    // Driver initialization
    events.EventEmitter.call(this);

    /////////
    // Private variables
    /////////
    var port = null;
    var isopen = false;
    var port_close_requested = false;
    var self = this;
    var instrumentid;
    var pinoccio_info;

    /////////
    // Private methods
    /////////

    var status = function (stat) {
        debug('Network status change', stat);
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

    /**
     * format receives incoming data, and formats it before sending to the
     * front-end. Usually, the recorder, outputmanager and the server will
     * listen for 'data' events emitted by 'format'
     * Format is called as a callback by the serial port, so 'this' is
     * the serial object, not this driver!
     * @param {Object} data the data
     */
    var format = function (data) {
        var jsresp;
        debug(data);

        // Now extract what we really are interested into:
        if (data.report && data.report.type == 'Hawk') {
            var val = data.report;
            jsresp = {
                cpm: {
                    value: val.ch1,
                    valid: true
                },
                cpm2: {
                    value: val.ch2,
                    valid: true
                },
                probeid: data.from,
                timestamp: data.at

            }
        } 
        if (jsresp !== undefined)
            self.emit('data', jsresp);
    };

    /////////
    // Public variables
    /////////
    this.name = "hawknest";

    /////////
    // Public API
    /////////

    // Creates and opens the connection to the instrument.
    // for all practical purposes, this is really the init method of the
    // driver
    this.openPort = function (id) {
        instrumentid = id;
        dbs.instruments.get(id, function (err, item) {
            pinoccio_info = item.pinoccio; // Save for later use (close esp.)
            port = new pinoconnection(item.pinoccio);
            port.on('data', format);
            port.on('status', status);
            port.open();
        });
    }

    this.closePort = function (data) {
        if (!isopen)
            return;
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
    this.sendUniqueID = function () {
        this.emit('data', {
            uniqueID: '00000000 (n.a.)'
        });
    };

    this.isStreaming = function () {
        return true;
    };

    // This dongle always outputs CPM value on the serial port
    this.startLiveStream = function (period) {};

    // Even though we ask to stop streaming, the dongle will still
    // stream.
    this.stopLiveStream = function (period) {};


    this.output = function (data) {
        debug("Command sent to Pinoccio: " + data);
        if (data == "TAG") {
            this.emit('data', {
                devicetag: 'Not supported'
            });
            return '\n';
        }
        port.write(data + '\n');
    }

};

HawkNest.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = HawkNest;