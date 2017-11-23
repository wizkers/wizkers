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
        var KESTREL_SERVICE_UUID  = '12630000-cc25-497d-9854-9b6c02c77054';
        var KESTREL_LOG_SERVICE = '85920000-0338-4b83-ae4a-ac1d217adb03';
        var KESTREL_LOG_CMD     = '85920200-0338-4b83-ae4a-ac1d217adb03';
        var KESTREL_LOG_RSP     = '85920100-0338-4b83-ae4a-ac1d217adb03';

        var sensor_uuids = {
            temperature: '12630001-cc25-497d-9854-9b6c02c77054',
            rel_humidity: '12630002-cc25-497d-9854-9b6c02c77054',
            heat_index: '12630003-cc25-497d-9854-9b6c02c77054',
            dew_point: '12630004-cc25-497d-9854-9b6c02c77054',
            wetbulb: '12630005-cc25-497d-9854-9b6c02c77054',
            pressure: '12630007-cc25-497d-9854-9b6c02c77054',
            barometer: '12630008-cc25-497d-9854-9b6c02c77054',
            dens_altitude: '1263000a-cc25-497d-9854-9b6c02c77054'
        };

        // The Kestrel Drop sends its readings over many characteristics.
        // We store them all in one object and only send the complete object
        // when receiving the last characteristic update

        // TODO: this is hardcoded to the Drop D3
        var readings = {
            temperature: 0,
            unit: {
                temperature: 'celsius',
                rel_humidity: '%',
                pressure: 'mb',
                altitude: 'm',
                dens_altitude: 'm',
                barometer: 'mb',
                dew_point: 'celsius',
                heat_index: 'celsius',
                wetbulb: 'celsius',
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
                characteristic_uuid: sensor_uuids.temperature
            }
        };

        // It looks like we don't really need those since
        // unsupported characteristics don't send notifications
        // anyway
        var checkSensorSupport = function(uuid, val) {
            // console.log('Sensor', uuid, 'support state:', val);
            if ( !(val & 0x01) ) {
                console.log('Sensor', uuid, 'not supported on this Drop');
                port.unsubscribe({
                    service_uuid: KESTREL_SERVICE_UUID,
                    characteristic_uuid: [ uuid ]
                });
            }
        };

        // Hardcoded to Little endian
        var getInt24 = function(buf, offset) {
            var val = buf[offset+2] << 16;
            val |= buf[offset+1] << 8;
            val |= buf[offset];
            var n = val & 0x800000;
            if (!n)
                return val;
            return (0xffffff - val + 1) * -1;
        }

        // Format acts on incoming data from the device, and then
        // forwards the data to the app through a 'data' event.
        var format = function (data) {
            if (!data.value || !data.characteristic) {
                console.log('No value or characteristic uuid received');
                return;
            }
            var dv = new DataView(vizapp.type === 'cordova' ? data.value.buffer : data.value);

            // Every characteristic in the DROP sends its data the same way, and tells us
            // whether the sensor is supported as well in the first byte.
            // If we receive the info that the sensor is not supported, we unsubscribe to it.

            if (utils.sameUUID(data.characteristic, sensor_uuids.barometer)) {
                // checkSensorSupport(data.characteristic, dv.getUint8(0));
                readings.barometer = dv.getUint16(1,true) / 10; // mb
            } else if (utils.sameUUID(data.characteristic, sensor_uuids.dens_altitude)) {
                // This is a 24 bit signed integer, no standard JS support for that
                // checkSensorSupport(data.characteristic, dv.getUint8(0));
                var b = [dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)];
                readings.dens_altitude = getInt24(b, 0) / 100; // m
            } else if (utils.sameUUID(data.characteristic, sensor_uuids.dew_point)) {
                // checkSensorSupport(data.characteristic, dv.getUint8(0));
                readings.dew_point = dv.getInt16(1,true) / 100;
            } else if (utils.sameUUID(data.characteristic, sensor_uuids.heat_index)) {
                // checkSensorSupport(data.characteristic, dv.getUint8(0));
                readings.heat_index = dv.getInt16(1,true) / 100;
            } else if (utils.sameUUID(data.characteristic, sensor_uuids.pressure)) {
                // checkSensorSupport(data.characteristic, dv.getUint8(0));
                readings.pressure = dv.getUint16(1,true) / 10;
            } else if (utils.sameUUID(data.characteristic, sensor_uuids.rel_humidity)) {
                // checkSensorSupport(data.characteristic, dv.getUint8(0));
                readings.rel_humidity = dv.getUint16(1,true) / 100;
            } else if (utils.sameUUID(data.characteristic, sensor_uuids.temperature)) {
                // checkSensorSupport(data.characteristic, dv.getUint8(0));
                readings.temperature = dv.getInt16(1,true) / 100;
            } else if (utils.sameUUID(data.characteristic, sensor_uuids.wetbulb)) {
                // checkSensorSupport(data.characteristic, dv.getUint8(0));
                readings.wetbulb = dv.getInt16(1,true) / 100;
            }
            // We are receiving a serial protocol response
            if (utils.sameUUID(data.characteristic, KESTREL_LOG_RSP)) {
                linkProto.processProtocol(data);
            } else if (utils.sameUUID(data.characteristic, sensor_uuids.temperature)) {
                // We only send an update once we get the temperature (present on every Kestrel
                // Drop), so that we limit the number of redundant messages.
                self.trigger('data', readings);
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
            port.subscribe({
                service_uuid: KESTREL_LOG_SERVICE,
                characteristic_uuid: [ KESTREL_LOG_RSP ]
            });
            setTimeout( function() {
                self.output({command: 'get_total_records'});
            }, 3000);

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

        /**
         * Called from the status() function when we get notified that the port
         * is open and our services are available.
         *  We subscribe to every possible sensor the DROP family can support,
         *  and in format() we will decide if we unsubscribe if the DROP tells
         *  us the sensor is not supported.
         */
        var dropQueryAndSubscribe = function() {
            port.subscribe({
                service_uuid: KESTREL_SERVICE_UUID,
                characteristic_uuid: [ sensor_uuids.temperature,
                                       sensor_uuids.barometer,
                                       sensor_uuids.dens_altitude,
                                       sensor_uuids.dew_point,
                                       sensor_uuids.heat_index,
                                       sensor_uuids.pressure,
                                       sensor_uuids.rel_humidity,
                                       sensor_uuids.wetbulb ]
            });

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
                dropQueryAndSubscribe();
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
        this.startLiveStream = function (period) {};

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