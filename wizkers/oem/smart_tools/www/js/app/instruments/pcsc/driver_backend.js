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
 * Browser-side Parser for PCSC readers)
 *
 * Used for both browser side and server side.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

// This detects whether we are in a server situation and act accordingly:
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
    var vizapp = { type: 'server'},
    events = require('events'),
    abutils = require('app/lib/abutils'),
    dbs = require('pouch-config');
}

define(function (require) {
    "use strict";

    var utils = require('app/utils'),
        storageCommands = require('app/instruments/pcsc/commands_storage'),
        pcscConnection = require('connections/pcsc');

    var parser = function (socket) {

        /////////////
        // Private methods
        /////////////

        var socket = socket;

        var self = this,
            port = null,
            instrumentid = null,
            port_close_requested = false,
            port_open_requested = false,
            isopen = false;

        var portSettings = function () {
            return {};
        };

        var readers = [];
        var myReader = ''; // Currently selected reader

        // Command processing
        var commandQueue = [],
        queue_busy = false,
        wd = null;
        
    

        // Format can act on incoming data from the PC/CS layer, and then
        // forwards the data to the app
        var format = function (data) {
            clearTimeout(wd);
            console.info('Done with command', commandQueue.shift());
            // Transform the data into a hex string (it's a buffer when it comes in)
            var datastr = abutils.ui8tohex(new Uint8Array(data.resp))
            self.trigger('data', { data: datastr} );
            queue_busy = false;
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
                self.trigger('data', resp);
                return;
            }

            if (stat.portopen)
                isopen = stat.portopen;

            if (isopen)
                handleReaderStatus(stat);
            else {
                // We remove the listener so that the serial port can be GC'ed
                if (port_close_requested) {
                    if (port.off)
                        port.off('status', stat);
                    else
                        port.removeListener('status', status);
                    port_close_requested = false;
                }
            }
        };

        /**
         * Handle PC/SC specific status messages
         */
        var handleReaderStatus = function(stat) {
            console.log('PC/SC Status message');
            if (stat.device) {
                // PCSC device detected
                if (readers.indexOf(stat.device) == -1)
                    readers.push(stat.device);
            }
            self.trigger('data', stat);
        }

        /**
         * Format a json APDU into a hex string
         */
        var apdu2str = function(apdu) {
            return apdu.cla + apdu.ins + apdu.p1 + apdu.p2 +
                      apdu.lc + apdu.data + apdu.le;
        }

        var openPort_server = function(insid) {
            dbs.instruments.get(insid, function(err,item) {
                port = new pcscConnection(item.port, portSettings());
                port.on('data', format);
                port.on('status', status);
                port.open();
            });
        };

        var openPort_app = function(insid) {
            var ins = instrumentManager.getInstrument();
            // We now support serial over TCP/IP sockets: if we detect
            // that the port is "TCP/IP", then create the right type of
            // tcp port:
            var p = ins.get('port');
            if (p == 'TCP/IP') {
                // Note: we just use the parser info from portSettings()
                port = new tcpConnection(ins.get('tcpip'), portSettings().parser);
            } else if (p == 'Wizkers Netlink') {
                port = new tcpConnection(ins.get('netlink'), portSettings().parser);
                proto = new Protocol();
                proto.on('data', onProtoData);
            } else {
                port = new pcscConnection(ins.get('port'), portSettings());
            }
            port.on('data', format);
            port.on('status', status);
            port.open();
        }

        // Process the latest command in the queue.
        //
        // Queue contains Objects with:
        //  - command: the command name
        //  - arg    : (optional) the command argument as a hex string
        var processQueue = function() {
            if (commandQueue.length == 0)
                return;
            var cmd = commandQueue[0]; // Get the oldest command

            if (queue_busy)
                return;
            queue_busy = true;

            var data = {};
            data.reader = cmd.reader;

            switch(cmd.command) {
                case 'getUID':
                    data.command = 'transmit';
                    var t = storageCommands.getUID();
                    data.apdu = apdu2str(t.apdu);
                    cmd.errors = t.errors; // Add error messages if we have any
                    break;
                case 'getATS':
                    data.command = 'transmit';
                    var t = storageCommands.getATS();
                    data.apdu = apdu2str(t.apdu);
                    cmd.errors = t.errors;
                    break;
                case 'transmit':
                    data.command = cmd.command;
                    data.apdu = cmd.apdu;
                    break;
                case 'connect':
                case 'disconnect':
                    commandQueue.shift(); // Those commands don't reply on the 'format' channel
                    queue_busy = false;
                default:
                    data.command = cmd.command;
                    break;
            }

            console.info('Sending command', data);
            if (data.command == 'transmit') {
                // Do a bit of reformatting
                data.apdu = [].slice.call(abutils.hextoab(data.apdu)); // Make it an array of bytes
            }
            port.write(data);

            if (queue_busy) {
                wd = setTimeout(function() {
                    queue_busy = false;
                    commandQueue.shift();
                });
            }
            
            // We don't shift the queue at this stage, we wait to
            // receive & process the response

        }


        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid) {
            port_open_requested = true;
            instrumentid = insid;
            if (vizapp.type == 'server') {
                openPort_server(insid);
            } else {
                openPort_app(insid);
            }
        };

        this.closePort = function (data) {
            // We need to remove all listeners otherwise the serial port
            // will never be GC'ed
            if (port.off)
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

        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        this.sendUniqueID = function () {
            // We cheat a bit here this is used to send
            // the list of existing readers
             for (var i =0; i < readers.length; i++) {
                self.trigger('data', { device: readers[i], action: 'added'});
            }
        };

        this.isStreaming = function () {
            return true;
        };

        // period in seconds
        this.startLiveStream = function (period) {
        };

        this.stopLiveStream = function (args) {};

        // output should return a string, and is used to format
        // the data that is sent on the serial port, coming from the
        // HTML interface.
        this.output = function (data) {
            if (data == "TAG") {
                self.trigger('data', {
                    devicetag: 'Not supported'
                });
            }

            commandQueue.push(data);
            processQueue();

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