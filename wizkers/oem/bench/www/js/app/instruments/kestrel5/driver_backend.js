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
        btleConnection = require('connections/btle');


    var parser = function (socket) {

        var self = this,
            socket = socket,
            streaming = true,
            port = null,
            port_close_requested = false,
            port_open_requested = false,
            isopen = false;

        // Command processing
        var commandQueue = [],
            queue_busy = false;

        // Log download protocol
        var log_totalRecords = 0;
        var log_logRecords = 0;
        // Binary buffer handling:
        var P_SYNC = 0;
        var P_IDLE = 3;
        var currentProtoState = P_IDLE; // see protostate above
        var inputBuffer = new Uint8Array(512); //  never sends more than 256 bytes
        var ibIdx = 0;
        var packetList = [];   // All packets ready for processing


        // We have to have those in lowercase
        var KESTREL_SERVICE_UUID  = '03290000-eab4-dea1-b24e-44ec023874db';
        var WX1_UUID     = '03290310-eab4-dea1-b24e-44ec023874db';
        var WX2_UUID     = '03290320-eab4-dea1-b24e-44ec023874db';
        var WX3_UUID     = '03290330-eab4-dea1-b24e-44ec023874db';

        var KESTREL_LOG_SERVICE = '85920000-0338-4b83-ae4a-ac1d217adb03';
        var KESTREL_LOG_CMD     = '85920200-0338-4b83-ae4a-ac1d217adb03';
        var KESTREL_LOG_RSP     = '85920100-0338-4b83-ae4a-ac1d217adb03';

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

        // Format can act on incoming data from the device, and then
        // forwards the data to the app through a 'data' event.
        var format = function (data) {
            if (!data.value || !data.characteristic) {
                console.log('No value or characteristic uuid received');
                return;
            }

            var dv = new DataView(vizapp.type === 'cordova' ? data.value.buffer : data.value);

            // TODO: only send one response every 3 packets with all
            // readins in one go.
            if (utils.sameUUID(data.characteristic, WX1_UUID)) {
                var windspeed = dv.getInt16(0, true);
                var temp = dv.getInt16(2, true);
                var rh = dv.getInt16(6, true);
                var pressure = dv.getInt16(8,true);
                var compass = dv.getInt16(10,true);

                var jsresp = {
                    temperature: temp/100,
                    rel_humidity: rh/100,
                    pressure: pressure/10,
                    compass_mag: compass,
                    wind: { dir: compass, speed: windspeed*1.94384/1000},
                    unit: {
                        temperature: 'celsius',
                        rel_humidity: '%',
                        pressure: 'mb',
                        compass_mag: 'degree',
                        wind: { dir: 'degree', speed: 'knots'}
                    }
                };

                // debug(jsresp);
                self.trigger('data', jsresp);
                return;
            }

            if (utils.sameUUID(data.characteristic, WX2_UUID)) {
                var compass2 = dv.getInt16(0, true);
                // Todo: byte 6 is probably part of altitude
                var altitude = dv.getInt16(4, true);
                var barometer = dv.getInt16(7, true);
                var dens_altitude = dv.getInt16(14, true);
                var xwind = dv.getInt16(9, true);
                var hwind = dv.getInt16(11, true);

                var jsresp = {
                    compass_true: compass2,
                    altitude: altitude/10,
                    dens_altitude: dens_altitude/10,
                    barometer: barometer /10,
                    crosswind: xwind/1000,
                    headwind: hwind/1000,
                    unit: {
                        compass_true: 'degree',
                        altitude: 'm',
                        dens_altitude: 'm',
                        barometer: 'mb',
                        crosswind: 'm/s',
                        headwind: 'm/s'
                    }
                };

                // debug(jsresp);
                self.trigger('data', jsresp);
                return;
            }

            if (utils.sameUUID(data.characteristic, WX3_UUID)) {
                var dew_point = dv.getInt16(0, true);
                var heat_index = dv.getInt16(2, true);
                var wetbulb = dv.getInt16(16, true);
                var chill = dv.getInt16(18, true);

                var jsresp = {
                    dew_point: dew_point/100,
                    heat_index: heat_index/100,
                    wetbulb: wetbulb/100,
                    wind_chill: chill/100,
                    unit: {
                        dew_point: 'celsius',
                        heat_index: 'celsius',
                        wetbulb: 'celsius',
                        wind_chill: 'celsius'

                    }
                };
                self.trigger('data', jsresp);
                return;
            }

            // We are receiving a log response
            if (utils.sameUUID(data.characteristic, KESTREL_LOG_RSP)) {
                processLogResponse(data);
            }
        };

        // Returns starting index of 0x7e
        var sync = function(buffer, maxIndex, minIndex) {
            for (var i = minIndex; i < maxIndex - 1; i++) {
                if (buffer[i] == 0x7e)
                    return i;
            }
            return -1;
        };

        // Process a response to a log service packet
        var processLogResponse = function(data) {
            if (data) { // we sometimes get called without data, to further process the
                        // existing buffer
                // console.log("LLP: Received new data, appended at index " + ibIdx);
                inputBuffer.set(new Uint8Array(data.value), ibIdx);
                ibIdx += data.value.byteLength;
            }

            var start = -1,
                stop = -1;
            if (currentProtoState == P_IDLE) {
                start = sync(inputBuffer, ibIdx, 0);
                // console.info("Found Start", start);
                if (start > -1) {
                    currentProtoState = P_SYNC;
                    // Realign our buffer (we can copy over overlapping regions):
                    inputBuffer.set(inputBuffer.subarray(start));
                    ibIdx -= start;
                } else {
                    return;
                }
            }
            if (currentProtoState == P_SYNC) {
                stop = sync(inputBuffer, ibIdx, 1);
                // console.info("Found End of packet: " + stop);
                currentProtoState = P_IDLE;
            }
            if (stop == -1)
                return; // We are receiving a packet but have not reached the end of it yet

            // We have a complete packet: copy into a new buffer, and realign
            // our input buffer
            var escapedPacket = inputBuffer.subarray(0, stop+1);
            var packet = unescape(escapedPacket);
            // console.info("New packet ready");
            packetList.push(packet);
            setTimeout(processPacket, 0); // Make the processing asynchronous

            inputBuffer.set(inputBuffer.subarray(stop+1));
            ibIdx -= stop+1;

            if (ibIdx > stop) {
                processLogResponse(); // We still have data to process, so we call ourselves recursively
                return;
            }
            return;
        }

        /**
         *  Process a Log protocol data packet
         */
        var processPacket = function() {
            var packet = packetList.shift();
            if (!packet)
                return;
            console.info(abutils.hexdump(packet));
            var dv = new DataView(packet.buffer);
            var cmd = dv.getUint16(1,true);
            var len = dv.getUint16(3,true);
            // Check that packet is complete
            if (packet.byteLength != (len + 8)) {
                console.error('Kestrel log protocol error, wrong packet length. Expected', len+8, 'got', packet.byteLength);
                return;
            }
            if (cmd == 0x03) {
                switch (commandQueue[0].command) {
                    case 'get_total_records':
                        log_totalRecords = dv.getUint32(5, true); // We assume this is a Uint32 until proven otherwise
                        console.info('This device as recorded', log_totalRecords, 'in its lifetime');
                        commandQueue[0].command = 'get_log_size'; // We replace to make sure this will be processed next
                        queue_busy = false;
                        break;
                    case 'get_log_size':
                        log_logRecords = dv.getUint32(5, true);
                        console.info('This log contains', log_logRecords, 'entries');
                        self.trigger('data', { 'log_size': log_logRecords});
                        commandQueue[0].command = 'get_log_structure';
                        queue_busy = false;
                        break;
                    case 'read_log_packet':
                        parseLogPacket(packet);
                        queue_busy = false; // Do not pop the Command queue
                                            // because we gotta keep calling this
                                            // until the end of the log
                        break;
                    default:
                        // ERROR !
                }
            } else if (cmd == 0x01 && commandQueue[0].command == 'get_log_structure') {
                // Process log structure. Eventually.
                commandQueue[0].command = 'read_log_packet';
                queue_busy = false;
            } else if ( cmd == 0x00 && commandQueue[0].command == 'read_log_packet') {
                // This is the last packet of the log, we need to close the
                // protocol
                commandQueue.shift();
                queue_busy = false;
                var packet = abutils.hextoab("7e04000200120074787e");
                port.write(packet, {service_uuid: KESTREL_LOG_SERVICE, characteristic_uuid: KESTREL_LOG_CMD }, function(e){console.log("Log transfer closed")});
            }

            if (packetList.length) {
                setTimeout(processPacket, 0);
            } else {
                processQueue();
            }
        }

        var monthNames = [ "January", "February", "March", "April", "May", "June", "July",
                       "August", "September", "October", "November", "December"];

        /**
         *
         * @param {*Uint8Array} buffer
         */
        var parseLogDate = function(buffer) {
            var ss = buffer[0];
            var mm = buffer[1];
            var hh = buffer[2];
            var dd = buffer[3];
            var MM = buffer[4]
            var YY = (buffer[6] << 8) + buffer[5]; // No need to create a DataView for just this;
            return new Date('' + hh + ':' + mm + ':' + ss + ' ' +
                            dd + ' ' + monthNames[MM-1] + ' ' + YY
                            );
        }

        // Parse a log packet. One packet can contain up to 6 log records.
        // So far, only complete log entries have been seen in those packets, waiting for
        // something to break in case we have more than three escaped 0x7e in the packet. No idea
        // whether the Kestrel will send fewer log entries or split a log entry over two packets.
        var parseLogPacket = function(packet) {
            var dv = new DataView(packet.buffer);
            var seq= dv.getUint16(5, true); // Packet sequence number
            // TODO: check that we didn't miss a sequence - could this actually happen??
            console.info('Log sequence #', seq);

            // Before anything else, we need to unescape the 0x7e escaped characters
            var idx = 7;
            var date = parseLogDate(packet.subarray(idx,idx+7));
            var compass_true = dv.getUint16(idx += 7, true);
            var windspeed = dv.getUint16(idx += 2, true);  // To be validated
            var wind2 = dv.getUint16(idx += 2, true);
            var wind3 = dv.getUint16(idx += 2, true);
            var temperature = dv.getUint16(idx += 3, true);
            var wind_chill = dv.getUint16(idx += 2, true);
            var rel_humidity = dv.getUint16( idx += 2, true);
            var heat_index = dv.getUint16( idx += 2, true);
            var dew_point = dv.getUint16( idx += 3, true);
            var wetbulb = dv.getUint16( idx += 2, true);
            var barometer = dv.getUint16( idx += 2, true); // TODO: check which is baro vs pressure
            var pressure = dv.getUint16( idx += 2, true);
            var altitude = dv.getUint16( idx += 2, true);  // TODO: account for 3rd byte
            var dens_altitude = dv.getUint16( idx += 3, true);
            var compass_mag = dv.getUint16( idx += 3, true);

            var jsresp = { log: {
                    timestamp: date,
                    dew_point: dew_point/100,
                    heat_index: heat_index/100,
                    wetbulb: wetbulb/100,
                    wind_chill: wind_chill/100,
                    compass_true: compass_true,
                    altitude: altitude/10,
                    dens_altitude: dens_altitude/10,
                    barometer: barometer /10,
                    // crosswind: xwind/1000,
                    // headwind: hwind/1000,
                    temperature: temperature/100,
                    rel_humidity: rel_humidity/100,
                    pressure: pressure/10,
                    compass_mag: compass_mag,
                    wind: { dir: compass_true,
                          speed: windspeed*1.94384/1000
                    }
                }
            };
            console.log(jsresp);
            self.trigger('data', jsresp);


        }

        // Unescapes character 0x7d:
        // My understanding so far:
        // - If we find a 0x7d, then look at next byte, if can be 0x5d or 0x5e
        //   which translates into 0x7d and 0x7e respectively. Kinda weird ?
        var unescape = function(buffer) {
            var readIdx = 0;
            var writeIdx = 0;
            var tmpBuffer = new Uint8Array(buffer.length);
            while (readIdx < buffer.length) {
                tmpBuffer[writeIdx] = buffer[readIdx];
                if (buffer[readIdx] == 0x7d) {
                    if (buffer[readIdx+1] == 0x5d) {
                        tmpBuffer[writeIdx] = 0x7d;
                    } else if (buffer[readIdx+1] == 0x5e) {
                        tmpBuffer[writeIdx] = 0x7e;
                    } else {
                        console.error('Unescape: got an unexpected escape situation:', buffer[readIdx+1]);
                    }
                    readIdx++;
                }
                writeIdx++;
                readIdx++;
            }
            // Now generate a recut buffer of the right size:
            var retBuffer = new Uint8Array(tmpBuffer.buffer, 0, writeIdx);
            return retBuffer;
        }


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
                commandQueue.shift();
                queue_busy = false;
                ibIdx = 0;
                self.output({command: 'get_total_records'});
            }, 3000);

        }

        /**
         * Verify the checksum on a received packet
         */
        var verifyChecksum = function(len) {
            // TODO: right now we are only sending three fixed commands, so we
            // are just skipping CRC calculations, sorry
            return true;
        };


        // Process the latest command in the queue.
        // Overkill right now since we only have one command :)
        var processQueue = function() {
            if (queue_busy || (commandQueue.length == 0))
                return;
            queue_busy = true;
            var packet;
            var cmd = commandQueue[0]; // Get the oldest command
            switch(cmd.command) {
                case 'download_log':
                    startLogDownload();
                    return;
                case 'get_total_records':
                    // Note: the method below is not optimal in terms of speed but
                    // much more readable
                    packet = abutils.hextoab('7e0000020038009bb67e');
                    break;
                case 'get_log_size':
                    console.info('get_log_size');
                    packet = abutils.hextoab('7e00000a000300000000000000000054d57e');
                    break;
                case 'get_log_structure':
                    console.info('get_log_structure');
                    packet = abutils.hextoab('7e00000a0005000000000000000000863d7e');
                    break;
                case 'read_log_packet':
                    console.info('read_log_packet');
                    packet = abutils.hextoab('7e04000200ffffed2e7e');
                    break;
                default:
                    console.warn('Error, received a command we don\'t know how to process', cmd.command);
                    commandQueue.shift();
                    queue_busy = false;
                    break;
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
                port.subscribe({
                    service_uuid: KESTREL_SERVICE_UUID,
                    characteristic_uuid: [ WX1_UUID, WX2_UUID, WX3_UUID ]
                });
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

        var openPort_app = function (insid) {
            port_open_requested = true;
            var ins = instrumentManager.getInstrument();
            if (port == null)
                port = new btleConnection(ins.get('port'), portSettings());
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

        this.openPort = function (insid) {
            port_open_requested = true;
            if (vizapp.type == 'server') {
                openPort_server(insid);
            } else {
                openPort_app(insid);
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

        this.getInstrumentId = function (arg) {};

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