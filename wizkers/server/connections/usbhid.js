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
 * HID has a concept (with varying incompatible terminology) of
 *   "feature" reports usually for configuration, and "output" report,
 *   usually for data.
 *
 *   Most of the time, "feature" reports are output as "control" transfers,
 *   and "output" reports as "interrupt" transfers
 *
 * The "write" command for this driver does output/interrupt transfers.
 * The sendFeatureReport command does "feature/control" transfers.
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
            // debug('Received data', data);
            // The first byte is the data length, we need to
            // extract it, the upper level driver usually
            // is not interested
            self.emit('data',{
                        length: data.readUInt8(0),
                        value: data.slice(1,data.byteLength)
                     });
        });

        myPort.on('error', function(err) {
            debug("USB HID error: "  + err);
            portOpen = false;
            self.emit('status', {portopen: portOpen, error: true});
        });

    };

    /**
     *  Write to the HID device. Defaults to an "output" report,
     *  which is automatically translated into a control or interrupt transfer
     *  depending on how the HID device descriptors are configured (no need to worry
     *  about it).
     *
     *  Note: The first byte of 'data' has to the report number.
     *
     * @param {*Uint8Array} data
     */
    this.write = function(data) {
        try {
            // The node-hid library does not understand typed
            // arrays and just doesn't write anything if the type of 'data'
            // is not a straightforward Javascript array, hence the Array.from
            // below.
            myPort.write(Array.from(data));
            // debug('Wrote', data);
        } catch (err) {
            debug('Port write error! ' + err);
        }
    }

    /**
     * Write a feature report to the HID device.
     * This is usually translated into a control transfer (depends on the device
     * descriptors).
     *
     * Note: the first byte of 'data' has to be the report number
     * @param {*Buffer} data
     */
    this.sendFeatureReport = function(data) {
        try {
            myPort.sendFeatureReport(data);
            // debug('Wrote feature report', data);
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

