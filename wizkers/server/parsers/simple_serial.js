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