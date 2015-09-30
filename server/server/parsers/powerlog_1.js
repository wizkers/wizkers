/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
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
 * Browser-side Parser for Arduino "PowerCost Monitor" from http://www.bluelineinnovations.com/
 *
 * This Browser-side parser is used when running as a Chrome or Cordova app.
 * @author Edouard Lafargue, ed@lafargue.name
 */

"use strict";

var serialport = require('serialport'),
    events = require('events'),
    serialconnection = require('../connections/serial'),
    dbs = require('../pouch-config'),
    debug = require('debug')('wizkers:parsers:powerlog_1');

var Powerlog = function () {

    // Driver initialization
    events.EventEmitter.call(this);


    var self = this,
        socket = socket,
        livePoller = null, // Reference to the live streaming poller
        streaming = true,
        port = null,
        instrumentid = null,
        port_close_requested = false,
        port_open_requested = false,
        isopen = false;

    /////////////
    // Private methods
    /////////////

    var portSettings = function () {
        return {
            baudRate: 115200,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            dtr: true,
            flowControl: false,
            parser: serialport.parsers.readline(),
        }
    };

    // Format can act on incoming data from the counter, and then
    // forwards the data to the app through a 'data' event.
    var format = function (data) {
        //console.log('RX', data);

        // All commands now return JSON
        try {
            var response = JSON.parse(data);
            self.emit('data', response);
        } catch (err) {
            debug('Not able to parse JSON response from device:\n' + data + '\n' + err);
        }
    };

    // Status returns an object that is concatenated with the
    // global server status
    var status = function (stat) {
        port_open_requested = false;
        console.log('Port status change', stat);
        if (stat.openerror) {
            // We could not open the port: warn through
            // a 'data' messages
            var resp = {
                openerror: true
            };
            if (stat.reason != undefined)
                resp.reason = stat.reason;
            if (stat.description != undefined)
                resp.description = stat.description;
            self.emit('data', resp);
            return;
        }
        isopen = stat.portopen;
        if (isopen) {
            // Should run any "onOpen" initialization routine here if
            // necessary.
        } else {
            // We remove the listener so that the serial port can be GC'ed
            if (port_close_requested) {
                port.off('status', status);
                port_close_requested = false;
            }
            if (stat.error) {
                // The port closed by itself, we need to unregister
                // all our callbacks
                port.off('status', status);
                port.off('data', format);
            }
        }
    };


    /////////////
    // Public methods
    /////////////

    this.openPort = function (id) {
        port_open_requested = true;
        instrumentid = id;
        dbs.instruments.get(id, function (err, item) {
            port = new serialconnection(item.port, portSettings());
            port.on('data', format);
            port.on('status', status);
        });
    }

    this.closePort = function (data) {
        // We need to remove all listeners otherwise the serial port
        // will never be GC'ed
        port.off('data', format);
        port_close_requested = true;
        port.close();
    }

    this.isOpen = function () {
        return isopen;
    }

    this.isOpenPending = function () {
        return port_open_requested;
    }

    this.getInstrumentId = function (arg) {
        return instrumentid;
    };

    this.isStreaming = function () {
        return streaming;
    };


    // Called when the app needs a unique identifier.
    // this is a standardized call across all drivers.
    //
    // Returns the Geiger counter GUID.
    this.sendUniqueID = function () {
        self.emit('data', {
            uniqueID: '00000000 (n.a.)'
        });
    };

    // The device always streams
    this.startLiveStream = function (period) {};

    this.stopLiveStream = function (args) {};

    // output should return a string, and is used to format
    // the data that is sent on the serial port, coming from the
    // HTML interface.
    this.output = function (data) {
        port.write(data + '\n');
    };


}

Powerlog.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Powerlog;