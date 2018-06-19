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

    var myReaders = {};


    this.open = function() {
        debug("Opening PCSC device at " + path);
        // The PCSC layer auto-opens, no callback
        portOpen = true;
        self.emit('status', {portopen: portOpen, error: false});

        myPort = new pcsc();

        // Callback once the port is actually open:
        myPort.on('reader', function (reader) {
            var state = 0;
            self.emit('status', {device: reader.name, action: 'added'});
            myReaders[reader.name] = { ref: reader };

            reader.on('status', function(status) {
                debug('Reader Status', status, ' State: 0x', status.state.toString(16));
                var changes = state ^ status.state;
                if (changes) {
                    if ((changes & this.SCARD_STATE_EMPTY) && (status.state & this.SCARD_STATE_EMPTY)) {
                        debug("card removed");/* card removed */
                        self.emit('status', {reader: reader.name, status: 'card_removed'});
                        reader.disconnect(pcsc.SCARD_UNPOWER_CARD, function(err) {
                            if (err)
                                debug('Error disconnecting', err);
                            myReaders[reader.name].protocol = -1;
                            self.emit('status', {reader: reader.name, status: 'disconnected' });    
                        });                
                    } else if ((changes & this.SCARD_STATE_PRESENT) && (status.state & this.SCARD_STATE_PRESENT)) {
                        debug("card inserted");
                        self.emit('status', {reader: reader.name, status: 'card_inserted', atr: status.atr});
                    } else if ((changes & this.SCARD_STATE_UNKNOWN) && (status.state & this.SCARD_STATE_UNKNOWN)) {
                        debug("Reader removed");
                        self.emit('status', {device: reader.name, action: 'removed' });
                        delete myReaders[reader.name];
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

    /**
     *  The Write command is not simply a buffer or string, but an object with
     * the command and arguments
     * @param {Object} data 
     */
    this.write = function(data) {
        debug('Data to write', data);
        switch (data.command) {
            case 'connect':
                connectReader(data.reader);
                break;
            case 'transmit':
                transmitAPDU(data.reader, data.apdu);
                break;
            case 'disconnect':
                disconnectReader(data.reader);
                break;
        }
    }

    this.close = function() {
        myPort.close();
    }

    var connectReader = function(reader) {
        if (!myReaders[reader]) {
            debug('Connect: Unknown reader');
            return;
        }
        var readerRef = myReaders[reader].ref;
        if (!readerRef)
            return;
        debug('PCSC Ref', pcsc.SCARD_SHARE_SHARED);
        readerRef.connect({ share_mode : pcsc.SCARD_SHARE_SHARED }, function(err, protocol) {
            if (err) {
                debug(err);
            } else {
                debug('Protocol(', readerRef.name, '):', protocol);
                myReaders[reader].protocol = protocol;
                self.emit('status', {reader: readerRef.name, status: 'connected' });
            }
        });
    }

    var disconnectReader = function(reader) {
        if (!myReaders[reader]) {
            debug('Disconnect: Unknown reader');
            return;
        }
        var readerRef = myReaders[reader].ref;
        if (!readerRef)
            return;
        debug('Closing reader', readerRef.name);
        readerRef.disconnect(pcsc.SCARD_UNPOWER_CARD, function(err) {
            if (err)
                debug('Error disconnecting', err);
            myReaders[reader].protocol = -1;
            self.emit('status', {reader: readerRef.name, status: 'disconnected' });    
        });
    }

    var transmitAPDU = function(reader, apdu) {
        if (!myReaders[reader]) {
            debug('transmitAPDU: Unknown reader');
            return;
        }
        var readerRef = myReaders[reader].ref;
        if (!readerRef)
            return;
        readerRef.transmit(new Buffer(apdu), 1024, myReaders[reader].protocol, function(err, data) {
            if (err) {
                debug(err);
            } else {
                debug('Data received', data);
                self.emit('data', { resp: data });                
            }
        });
    }

    return this;
}

util.inherits(PCSCConnection, EventEmitter);

module.exports = PCSCConnection;

