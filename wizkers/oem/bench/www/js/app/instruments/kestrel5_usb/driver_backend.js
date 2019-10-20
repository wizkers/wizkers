/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT) with extension
 *  Copyright (c) 2018 Edouard Lafargue, ed@wizkers.io
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
 * 2. All Kestrel® communication protocol commands are used under license from
 * Nielsen-Kellerman Co. Do not use for any purpose other than connecting a
 * Kestrel® instrument to the Wizkers framework without permission.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


/**
 *  Low level driver for Kestrel devices. This is the iLink over USB HID
 * infrared cable version.
 *
 * Note: eventually, more of this driver should move towards the iLink library,
 * so that there is less code overlap between the USB/Serial and BLE drivers.
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
        LinkProto = require('app/instruments/kestrel5/kestrel_link'),
        usbConnection = require('connections/usbhid');

    var parser = function (socket) {

        var self = this,
            socket = socket,
            instrumentid = null,
            streaming = true,
            port = null,
            port_close_requested = false,
            port_open_requested = false,
            linkProto = new LinkProto(this),
            live_poller = null,
            isopen = false;

        // Command processing
        var commandQueue = [],
            queue_busy = false;

        // We want a callback reference for whoever is sending the commands/
        // Typically:
        // - If no callback reference, then just trigger a 'data' event to
        //   forward the data to the frontend
        // - If a callback reference exists, then send the data to it. An example
        //   is the "log download" command that does a series of low level commands
        //   and does not forward all of those to the front-end.
        var data_callback = null;

        /////////////
        // Private methods
        /////////////

        // Info required at port creation.
        // This vendorId/productId pair is the official Kestrel IR to USB
        // interface.
        var portSettings = function () {
            return {
                vendorId: 4292,
                productId: 2194,
            }
        };

        // Format acts on incoming data from the device, and then
        // forwards the data to the app through a 'data' event.
        var format = function (data) {
            if (!data.value) {
                console.log('No value received');
                return;
            }
            // On the infrared port, we only speak the link protocol
            linkProto.processProtocol(data);
        };

        // Right now we assume a Kestrel 5500
        var CMD_DATA_SNAPSHOT = 0,
            CMD_GET_LOG_COUNT_AT  =  3,
            CMD_GET_LOG_DATA_AT   =  5,
            CMD_GET_SERIAL_NUMBER =  6,
            CMD_END_OF_DATA       = 18,
            CMD_TOTAL_RECORDS_WRITTEN = 0x38;

        var startLogDownload = function() {
            // Three steps:
            // 1. ask Kestrel for overall # of records
            // 2. ask Kestrel for # of records on current log
            // 3. ask Kestrel for log structure
            // 4. Request log packets until finished

            // Reset the queue
            self.shiftQueue();

            self.output({command: 'get_total_records'});

        }

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
            // If we are asked to process a ACK, this means our last
            // command was successful and we can shift the queue
            // and set busy to false.
            // One exception: if the ACK is a 0xffff then it means we're just
            // an intermediate ACK and the command is not finished yet
            if (cmd.command == 'ack') {
                commandQueue.shift(); // Remove the ACK command from the queue
                packet = linkProto.makeAck(cmd.arg);
                if (cmd.arg != 0xffff) {
                    // We end up here when we are ACK'ing the END_OF_DATA command
                    // at the end of a data transfer.
                    self.shiftQueue();
                }
            } else {
                if (queue_busy)
                    return;
                queue_busy = true;
                switch(cmd.command) {
                    case 'get_data_snapshot':
                        packet = linkProto.makeCommand( CMD_DATA_SNAPSHOT, null);
                        break;
                    case 'get_total_records':
                        packet = linkProto.makeCommand( CMD_TOTAL_RECORDS_WRITTEN, null);
                        break;
                    case 'get_log_size':
                        console.info('get_log_size');
                        packet = linkProto.makeCommand(CMD_GET_LOG_COUNT_AT, '0000000000000000');
                        //packet = abutils.hextoab('7e00000a000300000000000000000054d57e');
                        break;
                    case 'get_log_data':
                        console.info('get_log_data');
                        packet = linkProto.makeCommand(CMD_GET_LOG_DATA_AT,'0000000000000000' );
                        // packet = abutils.hextoab('7e00000a0005000000000000000000863d7e');
                        break;
                    case 'generic_nack':

                        break;
                    default:
                        console.warn('Error, received a command we don\'t know how to process', cmd.command);
                        commandQueue.shift();
                        queue_busy = false;
                        break;
                }
            }
            console.info('Sending packet', packet);

            // The Kestrel USB to IR cable HID protocol requires appending the
            // length of the packet as the first byte - this is actually the report
            // number, but the Silabs converter considers report number 0x00 to 0x3f to be
            // data transfers, with the report number being the number of bytes to transfer.
            var hidpacket = new Uint8Array(packet.byteLength +1 );
            hidpacket[0] = packet.byteLength;
            hidpacket.set(packet,1);
            port.write(hidpacket, function(e){});
            // We don't shift the queue at this stage, we wait to
            // receive & process the response

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
            if (isopen ) {
                initIRCable();
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
                port = new usbConnection(insport ? insport : ins.get('port'), portSettings());
            port.open();
            port.on('data', format);
            port.on('status', status);
        };

        var openPort_server = function(insid) {
            dbs.instruments.get(insid, function(err,item) {
                if (port == null) {
                    port = new usbConnection(item.port, portSettings());
                } else {
                    console.log("Already have a driver, reusing it.");
                }
                port.on('data', format);
                port.on('status', status);
                port.open();
            });
        };

        /**
         * Configure the Infrared cable for speaking to the Kestrel.
         *
         * The Kestrel infrared cable is apparently a Silabs HID
         * to UART converter. It needs to be configured before being
         * about to speak to the Kestrel.
         *
         * See Silabs app note AN434 for details.
         *
         * The config steps are:
         *   - Enable UART (report 0x41, data: 0x01)
         *   - Set UART config to 38400 Baud, no parity, 8 bits, no flow control
         */
        var initIRCable = function() {

            // Enable UART
            port.sendFeatureReport([0x41, 0x01]);

            // 38400, 8, N, 1
            port.sendFeatureReport([0x50, 0x00, 0x00, 0x96, 0x00, 0x00, 0x00, 0x03  ]);

        }

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
            if (port) {
                // Send a couple of bytes to wake up the Kestrel.
                port.write([0x03, 0x0a, 0x0a, 0x0a]);

                live_poller = setInterval( function() {
                    self.output({command: 'get_data_snapshot'});
                }, 1000);
            }
        };


        this.stopLiveStream = function (args) {
            if (live_poller)
                clearInterval(live_poller);
        };

        // This is where we receive commands from the front-end
        // So far we are not sending anything, since we are subscribing
        // to the Kestrel readings upon link establishment.
        //
        // We are getting simple commands here, not raw packets
        this.output = function (data) {
            if (data.command == undefined) {
                console.error('[Kestrel driver] Missing command in output request');
                return;
            }
            if (data.command == 'download_log') {
                startLogDownload();
            } else {
                commandQueue.push(data);
                processQueue();
            }
        };

    }

    // On server side, we use the Node eventing system, whereas on the
    // browser/app side, we use Bacbone's API:
    if (vizapp.type != 'server') {
        // Add event management to our parser, from the Backbone.Events class:
        _.extend(parser.prototype, Backbone.Events);
    } else {
        parser.prototype.__proto__ = events.EventEmitter.prototype;
        parser.prototype.trigger = parser.prototype.emit;
    }
    return parser;
});
