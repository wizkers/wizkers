/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
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
                port.removeListener('status', status);
                port_close_requested = false;
            }
            if (stat.error) {
                // The port closed by itself, we need to unregister
                // all our callbacks
                port.removeListener('status', status);
                port.removeListener('data', format);
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
        port.removeListener('data', format);
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