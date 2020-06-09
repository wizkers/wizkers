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
 *  Low level driver for Weatherflow devices.
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
        wxutils = require('app/lib/wxutils'),
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
        var WEATHERFLOW_SERVICE_UUID  =  '6a223200-4f03-41b0-ce48-7b3880d357d6';
        var WX1_UUID     = '6a223201-4f03-41b0-ce48-7b3880d357d6';

        // The Weatherflow base station sends readings over several packets with
        // the same timestamp, starting with 0x52, 0x53 and 0x54 - merge them
        // into the same JSON structure and send to front-end after receiving 0x54

        // TODO: Weatherflow does not have all of those values - work out a way to
        // tag non-existing values to avoid displaying them
        var readings = {
            temperature: 0,
            rel_humidity: 0,
            pressure: 0,
            compass_mag: 0,
            wind: { dir: 0, speed: 0, gust: 0},
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
            brightness: 0,
            uv_index: 0,
            solar_radiation: 0,
            sensor_voltage: 0,
            unit: {
                temperature: 'celsius',
                rel_humidity: '%',
                pressure: 'mb',
                compass_mag: 'degree',
                wind: { dir: 'degree', speed: 'knots', gust: 'knots'},
                compass_true: 'degree',
                altitude: 'm',
                dens_altitude: 'm',
                barometer: 'mb',
                crosswind: 'm/s',
                headwind: 'm/s',
                dew_point: 'celsius',
                heat_index: 'celsius',
                wetbulb: 'celsius',
                wind_chill: 'celsius',
                brightness: 'lux',
                uv_index: '',
                solar_radiation: "W/m2",
                sensor_voltage: "V"
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
                service_uuid: [ WEATHERFLOW_SERVICE_UUID],
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

            try {
                // Only send one response every 3 packets with all
                // readings in one go.
                if (utils.sameUUID(data.characteristic, WX1_UUID)) {
                    parseWeatherFlowBLE(dv);
                    return;
                }
            } catch (e) {
                console.error('Data parsing error, skipping', e);
            }

        };

        // Parse a Weatherflow BLE packet, and send data to front-end if necessary
        var parseWeatherFlowBLE = function(dv) {
            var ptype = dv.getInt8(0);
            switch (ptype) {
                case 0x1a:
                    readings.sensor_voltage = dv.getInt16(17,true) / 1000;
                    break;
                case 0x52:
                    readings.brightness = dv.getUint32(7, true);
                    readings.uv_index = dv.getUint16(11, true) / 100;
                    readings.solar_radiation = dv.getUint16(17, true);
                    break;
                case 0x53:
                    readings.wind.speed_avg = Math.round(dv.getInt16(7, true) *1.94384)/100; // Convert to knots
                    readings.wind.dir_avg = dv.getInt16(9, true);
                    readings.wind.gust = Math.round(dv.getInt16(13,true) * 1.94384)/100;
                    readings.wind.other = dv.getInt16(15, true);
                    readings.wind.lull = Math.round(dv.getInt16(11,true) * 1.94384)/100;
                    readings.wind.avg_period = dv.getInt8(17);
                    break;
                case 0x54:
                    readings.temperature = dv.getInt16(7,true) / 100;
                    readings.rel_humidity = dv.getInt16(9,true) / 100;
                    readings.pressure = dv.getUint32(14,true) / 100;
                    readings.dew_point = Math.round(wxutils.dew_point(readings.temperature , readings.rel_humidity )*100)/100;
                    break;
                case 0x18:
                    readings.wind.speed  = Math.round(dv.getInt16(7, true)*1.94384)/100; // Instant wind direction
                    readings.wind.dir = dv.getInt16(9, true);
                    break;
                default:
                    break;

            }
            // TODO: we should be able to send partial updates to save on data
            if (ptype == 0x54 || ptype == 0x18)
                self.trigger('data', readings);

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
            if (queue_busy)
                return;
            queue_busy = true;
            switch(cmd.command) {
                case 'get_readings':
                    // Send 0x04
                    packet = abutils.hextoab('04');
                    break;
                case 'get_time':
                    // Send 0x01
                    console.info('get_time');
                    packet = abutils.hextoab('01');
                    //packet = abutils.hextoab('7e00000a000300000000000000000054d57e');
                    break;
                default:
                    console.warn('Error, received a command we don\'t know how to process', cmd.command);
                    commandQueue.shift();
                    queue_busy = false;
                    break;
            }

            console.info('Sending packet', packet);
            port.write(packet, {service_uuid: WEATHERFLOW_SERVICE_UUID, characteristic_uuid: WX1_UUID }, function(e){});
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
                    service_uuid: WEATHERFLOW_SERVICE_UUID,
                    characteristic_uuid: [ WX1_UUID ]
                });

            // TODO: send "0x04" to the port to start streaming
        };


        this.stopLiveStream = function (args) {
            // TODO: send ??? to stop streaming ?
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
