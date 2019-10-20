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
 *  Low level driver for Kestrel devices.
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
        btleConnection = require('connections/btle');

    var parser = function (socket) {

        var self = this,
            socket = socket,
            instrumentid = null,
            streaming = true,
            port = null,
            port_close_requested = false,
            port_open_requested = false,
            linkProto = new LinkProto(this),
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
        var KESTREL_SERVICE_UUID  = '03290000-eab4-dea1-b24e-44ec023874db';
        var WX1_UUID     = '03290310-eab4-dea1-b24e-44ec023874db';
        var WX2_UUID     = '03290320-eab4-dea1-b24e-44ec023874db';
        var WX3_UUID     = '03290330-eab4-dea1-b24e-44ec023874db';

        var KESTREL_LOG_SERVICE = '85920000-0338-4b83-ae4a-ac1d217adb03';
        var KESTREL_LOG_CMD     = '85920200-0338-4b83-ae4a-ac1d217adb03';
        var KESTREL_LOG_RSP     = '85920100-0338-4b83-ae4a-ac1d217adb03';

        // The Kestrel 5500 sends its readings over three characteristics.
        // We store them all in one object and only send the complete object
        // when receiving the last characteristic update - WX3_UUID

        // TODO: this is hardcoded to the Kestrel 5500
        var readings = {
            temperature: 0,
            rel_humidity: 0,
            pressure: 0,
            compass_mag: 0,
            wind: { dir: 0, speed: 0},
            compass_true: 0,
            altitude: 0,
            dens_altitude: 0,
            barometer: 0,
            crosswind: 0,
            headwind: 0,
            dew_point: 0,
            heat_index: 0,
            wetbulb: 0,
            wind_chill: 0,
            unit: {
                temperature: 'celsius',
                rel_humidity: '%',
                pressure: 'mb',
                compass_mag: 'degree',
                wind: { dir: 'degree', speed: 'knots'},
                compass_true: 'degree',
                altitude: 'm',
                dens_altitude: 'm',
                barometer: 'mb',
                crosswind: 'm/s',
                headwind: 'm/s',
                dew_point: 'celsius',
                heat_index: 'celsius',
                wetbulb: 'celsius',
                wind_chill: 'celsius'
            }
        };

        /////////////
        // Private methods
        /////////////

        // Info required at port creating. Really only used by the
        // Web Bluetooth driver, other drivers are not demanding at this
        // stage
        var portSettings = function () {
            return {
                service_uuid: [ KESTREL_SERVICE_UUID],
                optional_services: [ KESTREL_LOG_SERVICE], // This is a service we need, but is
                                                           // not advertised by the device. WebBTLE needs this.
                characteristic_uuid: WX1_UUID
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

            // Only send one response every 3 packets with all
            // readings in one go.
            if (utils.sameUUID(data.characteristic, WX1_UUID)) {
                readings.wind.speed = dv.getInt16(0, true)*1.94384/1000; // Convert to knots
                readings.temperature = dv.getInt16(2, true)/100;
                readings.rel_humidity = dv.getInt16(6, true)/100;
                readings.pressure = dv.getInt16(8,true)/10;
                readings.compass_mag = dv.getInt16(10,true);
                return;
            }

            if (utils.sameUUID(data.characteristic, WX2_UUID)) {
                readings.compass_true = dv.getInt16(0, true);
                readings.wind.dir = readings.compass_true;
                readings.altitude = dv.getInt16(4, true)/10; // TODO: Actually an Int24
                readings.barometer = dv.getInt16(7, true)/10;
                readings.crosswind = dv.getInt16(9, true)/1000;
                readings.headwind = dv.getInt16(11, true)/1000;
                readings.dens_altitude = dv.getInt16(14, true)/10;
                return;
            }

            if (utils.sameUUID(data.characteristic, WX3_UUID)) {
                readings.dew_point = dv.getInt16(0, true)/100;
                readings.heat_index = dv.getInt16(2, true)/100; // TODO: Actually Int24
                readings.wetbulb = dv.getInt16(16, true)/100;
                readings.wind_chill = dv.getInt16(18, true)/100;

                self.trigger('data', readings);
                return;
            }

            // We are receiving a serial protocol response
            if (utils.sameUUID(data.characteristic, KESTREL_LOG_RSP)) {
                linkProto.processProtocol(data);
            }
        };

        // Right now we assume a Kestrel 5500
        var CMD_GET_LOG_COUNT_AT  =  3,
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

            var ctr = 0;
            port.on('unsubscribed', function unsub(uuid) {
                ctr++
                if (ctr == 3) {
                    console.log('Unsubscribed from all');
                    if (port.off)
                        port.off('unsubscribed');
                    else
                        port.removeListener('unsubscribed', unsub);
                    port.once('subscribed', function(uuid) {
                        console.info('Received notification success for uuid', uuid);
                        // In case of Cordova: due to bugs on the Cordova BLE driver,
                        // we need to wait before sending the first command, otherwise we
                        // will miss the first bytes.
                        if (vizapp.type == 'cordova') {
                            setTimeout(function() {
                                self.output({command: 'get_total_records'});
                            }, 2000);
                        } else
                            self.output({command: 'get_total_records'});
                    });

                    console.log('Subscribing');
                    port.subscribe({
                        service_uuid: KESTREL_LOG_SERVICE,
                        characteristic_uuid: [ KESTREL_LOG_RSP ]
                    });
                    }
            });

            // First of all stop listening for data packets
            port.unsubscribe({
                service_uuid: KESTREL_SERVICE_UUID,
                characteristic_uuid: [ WX1_UUID, WX2_UUID, WX3_UUID ]
            });

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
            port.write(packet, {service_uuid: KESTREL_LOG_SERVICE, characteristic_uuid: KESTREL_LOG_CMD }, function(e){});
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
                    service_uuid: KESTREL_SERVICE_UUID,
                    characteristic_uuid: [ WX1_UUID, WX2_UUID, WX3_UUID ]
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
