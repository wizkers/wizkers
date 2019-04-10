/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT) with extension
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * 1. The above copyright notice and this permission notice shall be included in
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
 *  Low level driver for Cairn XL devices.
 */


// This detects whether we are in a server situation and act accordingly:
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
    var vizapp = { type: 'server'},
    DataView = require('buffer-dataview'), // Important for compatibility
    events = require('events'),
    dbs = require('pouch-config');
}

define(function (require) {
    "use strict";

    var abutils = require('app/lib/abutils'),
        utils = require('app/utils'),
        crc_calc = require('app/lib/crc_calc'),
        btleConnection = require('connections/btle');

    var parser = function (socket) {

        var self = this,
            socket = socket,
            instrumentid = null,
            streaming = true,
            port = null,
            port_close_requested = false,
            port_open_requested = false,
            isopen = false;

        // Command processing
        var commandQueue = [],
            queue_busy = false;

        // We want a callback reference for whoever is sending the commands/
        // Typically:
        // - If no callback reference, then just trigger a 'data' event to
        //   forward the data to the frontend
        // - If a callback reference exit, then send the data to it. An example
        //   is the "log download" command that does a series of low level commands
        //   and does not forward all of those to the front-end.
        var data_callback = null;

        // We have to have those in lowercase
        var CAIRNXL_SERVICE_UUID  = '69400001-b5a3-f393-e0a9-e50e24dcca99';
        var CAIRNXL_WRITE_CHAR    = '69400002-b5a3-f393-e0a9-e50e24dcca99';
        var CAIRNXL_NOTIFY_CHAR   = '69400003-b5a3-f393-e0a9-e50e24dcca99';

        /////////////
        // Private methods
        /////////////

        // Info required at port creating. Really only used by the
        // Web Bluetooth driver, other drivers are not demanding at this
        // stage
        var portSettings = function () {
            return {
                service_uuid: [ CAIRNXL_SERVICE_UUID],
                characteristic_uuid: CAIRNXL_NOTIFY_CHAR
            }
        };

        // Format acts on incoming data from the device, and then
        // forwards the data to the app through a 'data' event.
        var format = function (data) {
            if (!data.value || !data.characteristic) {
                console.log('No value or characteristic uuid received');
                return;
            }

            var dv = new DataView(vizapp.type === 'cordova' ? data.value.buffer : data.value);

            // Since we have a CRC, check it
            var dataArray = new Uint8Array(data.value);
            var crc = crc_calc.crc8_crc(dataArray.subarray(0,dataArray.length-1));
            if (crc != dataArray[dataArray.length-1]) {
                console.log("Invalid CRC on data packet, discarding");
                return;
            }

            if (dataArray[0] != 170 && dataArray[1] != 85) {
                console.log("Invalid packet header, discarding");
                return;
            }

            var l = dataArray[2];
            if (dataArray.length != l + 3) {
                console.log("Invalid packet length, discarding");
                return;
            }
            var response = {raw: dataArray};
            var cmd = dataArray[3];

            switch (cmd) {
                case 0x12: // Brightness
                    response.brightness = dataArray[4];
                    break;
                default:
                    response.hex = abutils.ui8tohex(dataArray);
            }

            self.trigger('data', response);

        };

        this.shiftQueue = function() {
            // Note: if we get ACKed for the get log data command,
            // we should really wait until we get a END_OF_DATA command
            // to shift/clear the queue.
            console.info('Done with command', commandQueue.shift());
            queue_busy = false;
        }

        // Process the latest command in the queue.
        //
        // Queue contains Objects with:
        //  - command: the command name
        //  - arg    : (optional) the command argument as a hex string
        var processQueue = function() {
            if (commandQueue.length == 0)
                return;
            var packet;
            var cmd = commandQueue[0]; // Get the oldest command

            if (queue_busy)
                return;
            queue_busy = true;
            var buf = "AA55";
            switch(cmd.command) {
                case 'raw':
                    buf += ("00" + (cmd.arg.length/2 + 1).toString(16)).slice(-2) + cmd.arg;
                    break;
                case 'power':
                    buf += "0301" + (cmd.arg ? "01" : "02");
                    break;
                case 'color':
                    var r = ("00" + (Math.floor(parseInt(cmd.arg.substr(1,2),16)*100/255).toString(16))).slice(-2);
                    var g = ("00" + (Math.floor(parseInt(cmd.arg.substr(3,2),16)*100/255).toString(16))).slice(-2);
                    var b = ("00" + (Math.floor(parseInt(cmd.arg.substr(5,2),16)*100/255).toString(16))).slice(-2);
                    // The RGB values are rescaled on a 1-100 scale for some reason
                    buf += "0603" + g + r + b + "10";
                    // ToDo: we can have an extra byte afterwards, but no idea what that byte
                    // means
                    break;
                case 'brightness':
                    var b = ("00" + Math.floor(cmd.arg).toString(16)).slice(-2);
                    buf += "0302" + b;
                    break;
                case 'strobe':
                    buf += "030401"; // Enable strobe
                    break;
                default:
                    console.warn('Error, received a command we don\'t know how to process', cmd.command);
                    commandQueue.shift();
                    queue_busy = false;
                    break;
            }
            var regexp = /^[0-9a-fA-F]+$/;
            // Check that the buffer is valid hex, just in case
            if (regexp.test(buf)) {
                buf += ("00" + crc_calc.crc8_crc(abutils.hextoab(buf)).toString(16)).slice(-2);
                console.log("Packet to send", buf);
                packet = abutils.hextoab(buf);
                port.write(packet, {service_uuid: CAIRNXL_SERVICE_UUID, characteristic_uuid: CAIRNXL_WRITE_CHAR }, function(e){});    
            } else {
                console.log("Packet invalid, the incoming arguments were corrupt");
            }
            commandQueue.shift();
            queue_busy = false;
        }

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
                self.trigger('data', resp);
                // We need to unsubscribe from data/status messages now
                // since the port never opened.
                if (port.off) { // If we're running on NodeJS, then we've gotta use removeListener
                    port.off('status', status);
                    port.off('data', format);
                }  else {
                    port.removeListener('status', status);
                    port.removeListener('data', format);
                }
                return;
            }
            if (stat.reconnecting != undefined) {
                // Forward the message to front-end
                self.trigger('data', {reconnecting:stat.reconnecting});
                return;
            }
            isopen = stat.portopen;
            if (isopen && stat.services) {
                // Should run any "onOpen" initialization routine here if
                // necessary.
                console.log('We found those services', stat.services);
                self.startLiveStream();
            }

            // We remove the listener so that the serial port can be GC'ed
            if (port_close_requested) {
                if (port.off)
                    port.off('status', status);
                else
                    port.removeListener('status', status);
                port_close_requested = false;
            }
        };

        var openPort_app = function (insid, insport) {
            port_open_requested = true;
            var ins = instrumentManager.getInstrument();
            if (port == null)
                port = new btleConnection(insport ? insport : ins.get('port'), portSettings());
            port.open();
            port.on('data', format);
            port.on('status', status);
        };

        var openPort_server = function(insid) {
            dbs.instruments.get(insid, function(err,item) {
                if (port == null) {
                    port = new btleConnection(item.port, portSettings());
                } else {
                    console.log("Already have a driver, reusing it.");
                }
                port.on('data', format);
                port.on('status', status);
                port.open();
            });
        };

        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid, insport) {
            instrumentid = insid;
            port_open_requested = true;
            if (vizapp.type == 'server') {
                openPort_server(insid);
            } else {
                openPort_app(insid, insport);
            }
        };

        this.closePort = function (data) {
            if (port == null) {
                return;
            }
            // We need to remove all listeners otherwise the serial port
            // will never be GC'ed
            if (port && port.off)
                port.off('data', format);
            else
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
        // TODO: Returns the instrument GUID.
        this.sendUniqueID = function () {};

        // period in seconds
        this.startLiveStream = function (period) {
            if (port)
                port.subscribe({
                    service_uuid: CAIRNXL_SERVICE_UUID,
                    characteristic_uuid: [ CAIRNXL_NOTIFY_CHAR ]
                });
        };

        this.stopLiveStream = function (args) {};

        // This is where we receive commands from the front-end
        // So far we are not sending anything, since we are subscribing
        // to the Kestrel readings upon link establishment.
        //
        // We are getting simple commands here, not raw packets
        this.output = function (data) {
            if (data.command == undefined) {
                console.error('[Cairn XL driver] Missing command in output request');
                return;
            }

            commandQueue.push(data);
            processQueue();
        };

    }

    // On server side, we use the Node eventing system, whereas on the
    // browser/app side, we use Backbone's API:
    if (vizapp.type != 'server') {
        // Add event management to our parser, from the Backbone.Events class:
        _.extend(parser.prototype, Backbone.Events);
    } else {
        parser.prototype.__proto__ = events.EventEmitter.prototype;
        parser.prototype.trigger = parser.prototype.emit;
    }
    return parser;
});
