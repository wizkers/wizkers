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