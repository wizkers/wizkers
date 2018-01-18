/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2018 Edouard Lafargue, ed@wizkers.io
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

/**
 *  A PC/SC smart card / NFC driver.
 *
 * API is very specific to the PC/SC world, not a simple read/write like
 * most other instrument drivers.
 *
 *
 * (c) 2018 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var pcsc=require('pcsclite'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    debug = require('debug')('wizkers:connections:pcsc');

var Debug = false;

//////////////////
// PCSC Reader interface:
//////////////////
var PCSCConnection = function(path, settings) {

    EventEmitter.call(this);
    var self = this;
    var myPort;

    var myReaders = [];


    this.open = function() {
        debug("Opening PCSC device at " + path);
        // The PCSC layer auto-opens, no callback
        portOpen = true;
        self.emit('status', {portopen: portOpen, error: false});

        myPort = new pcsc();

        // Callback once the port is actually open:
        myPort.on('reader', function (reader) {
            var state = 0;
            self.emit('status', {device: reader.name});

            reader.on('status', function(status) {
                debug('Reader Status', status, ' State: 0x', status.state.toString(16));
                var changes = state ^ status.state;
                if (changes) {
                    if ((changes & this.SCARD_STATE_EMPTY) && (status.state & this.SCARD_STATE_EMPTY)) {
                        debug("card removed");/* card removed */
                        self.emit('status', {reader: reader.name, status: 'card_removed'});
                    } else if ((changes & this.SCARD_STATE_PRESENT) && (status.state & this.SCARD_STATE_PRESENT)) {
                        debug("card inserted");
                        self.emit('status', {reader: reader.name, status: 'card_inserted', atr: status.atr});
                    }
                }
            });

        });


        myPort.on('error', function(err) {
            debug("PCSC error: "  + err);
            portOpen = false;
            self.emit('status', {portopen: portOpen, error: true});
        });

    };

    this.write = function(data) {
    }

    this.close = function() {
        myPort.close();
    }

    return this;
}

util.inherits(PCSCConnection, EventEmitter);

module.exports = PCSCConnection;

