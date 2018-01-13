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
 *  HID over USB connection
 *
 * Opens at create, sends 'data' events,
 * and 'status' events.
 *
 * Supports a "write" method.
 *
 * (c) 2018 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var HID = require('node-hid'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    debug = require('debug')('wizkers:connections:usbhid');

var Debug = false;

//////////////////
// Serial port interface:
//////////////////
var HIDConnection = function(path, settings) {

    EventEmitter.call(this);
    var portOpen = false;
    var self = this;
    var myPort;


    /**
     * Open the device.
     * 
     *  Right now we open by vendorId / productId
     * Pro: no explicit choice by user required, the device just autoconnects
     * Con: we can only support _one_ device at a time
     */
    this.open = function() {
        debug("Opening HID device with " , settings);
        var devices = HID.devices();
        var myDev = devices.find( function(d) {
            return  d.vendorId===settings.vendorId && d.productId===settings.productId;
        });
        debug('Found those devices', myDev);
        if (myDev == undefined) {
            debug('Error: too many or too few USB/IR adapters found!', myDev.length);
            self.emit('status', {
                portopen: false,
                openerror: true,
                reason: 'Port open error',
                description: myDev.length ? 'More than one adapter found, we only support one at a time' : 'No USB/IR adapter found'
            });
            return;
        }

        myPort = new HID.HID(myDev.path);
        // Open is synchronous on this library:
        portOpen = true;
        debug('Port open');
        self.emit('status', {portopen: portOpen});

        // listen for new serial data:
        myPort.on('data', function (data) {
                debug('Received data', data);
                self.emit('data',data);
        });

        myPort.on('error', function(err) {
            debug("USB HID error: "  + err);
            portOpen = false;
            self.emit('status', {portopen: portOpen, error: true});
        });

    };

    this.write = function(data) {
        try {
            myPort.write(data);
            debug('Wrote', data);
        } catch (err) {
            debug('Port write error! ' + err);
        }
    }

    this.close = function() {
        myPort.close();
        debug('Port closing');
        portOpen = false;
        self.emit('status', {portopen: portOpen});
    }

    return this;
}

util.inherits(HIDConnection, EventEmitter);

module.exports = HIDConnection;

