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
        crcCalc = require('app/lib/crc_calc'),
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

        // Log download protocol
        var log_totalRecords = 0;
        var log_logRecords = 0;
        // Binary buffer handling:
        var P_SYNC = 0;
        var P_IDLE = 3;
        var currentProtoState = P_IDLE; // see protostate above
        var inputBuffer = new Uint8Array(512); //  never sends more than 256 bytes
        var ibIdx = 0;
        var acked_cmd = -1; // Command that was last ACK'ed
        var packetList = [];   // All packets ready for processing


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
                processProtocol(data);
            }
        };

        // Returns starting index of 0x7e
        var sync = function(buffer, maxIndex, minIndex) {
            for (var i = minIndex; i < maxIndex; i++) {
                if (buffer[i] == 0x7e)
                    return i;
            }
            return -1;
        };

        // Process a response to a LiNK protocol packet
        var processProtocol = function(data) {

            ///////
            // Start of a simple state machine to process incoming log data
            ///////
            if (data) { // we sometimes get called without data, to further process the
                        // existing buffer
                // console.log('LLP: Received new data, appending at index', ibIdx);
                inputBuffer.set(new Uint8Array(data.value), ibIdx);
                ibIdx += data.value.byteLength;
                // console.log('I', abutils.hexdump(new Uint8Array(data.value)));
            }
            var start = -1,
                stop = -1;
            if (currentProtoState == P_IDLE) {
                start = sync(inputBuffer, ibIdx, 0);
                // console.info("Found Start at", start);
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
            ///////
            // End of state machine
            ///////
            console.info(abutils.hexdump(inputBuffer.subarray(0, stop+1))); // Display before escaping

            // We now have a complete packet: copy into a new buffer, and realign
            // our input buffer
            var escapedPacket = inputBuffer.subarray(0, stop+1);
            var packet = unescape(escapedPacket);

            // The CRC bytes can also be escaped, careful not to compute before
            // we unescape!
            // Now check our CRC (avoid creating a dataview just for this)
            var receivedCRC = packet[packet.length-3] + (packet[packet.length-2] << 8);

            // CRC is computed on the unescaped packet and includes everything but
            // the framing bytes and CRC itself (of course)
            var computedCRC = crcCalc.x25_crc(packet.subarray(1, packet.length-3));
            // TODO: if computedCRC != receivedCRC, then send a NACK packet
            if (receivedCRC != computedCRC) {
                console.error('CRC Mismatch! received/computed', receivedCRC, computedCRC);
                // TODO: should send a NACK at this stage?
                // console.info(abutils.hexdump(packet.subarray(0, packet.length)));
            } else {
                // console.info("New packet ready");
                packetList.push(packet);
                //setTimeout(processPacket, 0); // Make processing asynchronous
                processPacket();
            }

            // Realign our input buffer to remove what we just send to processing:
            inputBuffer.set(inputBuffer.subarray(stop+1));
            ibIdx -= stop+1;

            if (ibIdx > stop) {
                processProtocol(); // We still have data to process, so we call ourselves recursively
                return;
            }
            return;
        }

        // Right now we assume a Kestrel 5500
        var CMD_GET_LOG_COUNT_AT  =  3,
            CMD_GET_LOG_DATA_AT   =  5,
            CMD_GET_SERIAL_NUMBER =  6,
            CMD_END_OF_DATA       = 18,
            CMD_TOTAL_RECORDS_WRITTEN = 0x38;

        // Link level packets
        var PKT_COMMAND       =  0,
            PKT_METADATA      =  1,
            PKT_METADATA_CONT =  2,
            PKT_DATA          =  3,
            PKT_ACK           =  4,
            PKT_NACK          =  5;

        /**
         *  Process a Log protocol data packet once received.
         *  Note that we receive the complete frame including framing
         *  bytes.
         */
        var processPacket = function() {
            console.info('Process packet');
            var packet = packetList.shift();
            if (!packet)
                return;
            var dv = new DataView(packet.buffer);
            var pkt_type = dv.getUint16(1,true);
            var len = dv.getUint16(3,true);
            // Check that packet is complete
            if (packet.byteLength != (len + 8)) {
                console.error('Kestrel log protocol error, wrong packet length. Expected', len+8, 'got', packet.byteLength);
                return;
            }
            if (pkt_type == PKT_COMMAND) {
                var cmd_code = dv.getUint16(5, true);
                // we are receiving a command from the device
                if (cmd_code == CMD_END_OF_DATA ) { // end_of_data
                    // This is the last packet of the log, we need to close the
                    // protocol
                    commandQueue.shift();
                    queue_busy = false;
                    var packet = abutils.hextoab("7e04000200120074787e"); // Manual ACK
                    port.write(packet, {service_uuid: KESTREL_LOG_SERVICE, characteristic_uuid: KESTREL_LOG_CMD },
                        function(e){console.log("Log transfer closed");
                        // TODO: shall we unsubscribe to the characteristic ?
                            self.trigger('data', { 'log_xfer_done': true})
                    });
                }
            } else  if (pkt_type == PKT_ACK) {  // ACK
                var cmd_code = dv.getUint16(5, true); // Command that is being ack'ed
                acked_cmd = cmd_code; // We need to update this to understand the next packets we receive
                console.info('ACK for', cmd_code.toString(16));
            } else if (pkt_type == PKT_NACK) { // NACK
                console.error('NACK for', dv.getUint16(5,true));
                console.error('NACK reason is', dv.getUint16(7,true));
            } else if (pkt_type == PKT_DATA) { // Data
                switch (acked_cmd) {
                    case CMD_TOTAL_RECORDS_WRITTEN:
                        log_totalRecords = dv.getUint32(5, true); // We assume this is a Uint32 until proven otherwise
                        commandQueue[0].command = 'get_log_size'; // We replace to make sure this will be processed next
                        queue_busy = false;
                        break;
                    case CMD_GET_LOG_COUNT_AT:
                        log_logRecords = dv.getUint32(5, true);
                        setTimeout(function() {self.trigger('data', { 'log_size': log_logRecords})},0);
                        commandQueue[0].command = 'get_log_data';
                        queue_busy = false;
                        break;
                    case CMD_GET_LOG_DATA_AT:
                        parseLogPacket(packet);
                        queue_busy = false; // Do not pop the Command queue
                                            // because we gotta keep calling this
                                            // until the end of the log
                        break;
                    default:
                        console.error('Unknown data response', acked_cmd);
                }
            } else if (pkt_type == PKT_METADATA || pkt_type == PKT_METADATA_CONT) {
                if(acked_cmd == CMD_GET_LOG_DATA_AT) {
                    // Process log structure. Eventually.

                    // Acknowledge we got the data
                    commandQueue[0].command = 'generic_ack';
                    queue_busy = false;
                }
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
         *  Turn a log entry date blob into a Javascript date object
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
            var idx = 7;
            while (idx < (packet.byteLength-43)) { // 1 record is 41 bytes long
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
                idx += 2;

                var jsresp = { log: {
                        timestamp: date,
                        data: {
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
                    }
                };
                self.trigger('data', jsresp);
            }
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
                    // console.log('Escaping byte', buffer[readIdx+1]);
                    tmpBuffer[writeIdx] = buffer[readIdx+1] ^ 0x20;
                    readIdx++;
                }
                writeIdx++;
                readIdx++;
            }
            // Now generate a recut buffer of the right size:
            var retBuffer = new Uint8Array(tmpBuffer.buffer, 0, writeIdx);
            return retBuffer;
        }

        // Escapes character 0x7e and 0x7d:
        var escape = function(buffer) {
            var readIdx = 0;
            var writeIdx = 0;
            var tmpBuffer = new Uint8Array(buffer.length*2); // Worst case, everything has to be escaped!
            while (readIdx < buffer.length) {
                tmpBuffer[writeIdx] = buffer[readIdx];
                if (tmpBuffer[writeIdx] == 0x7d) {
                    tmpBuffer[++writeIdx] = 0x5d;
                } else if (tmpBuffer[writeIdx] == 0x7e) {
                    tmpBuffer[writeIdx++] = 0x7d;
                    tmpBuffer[writeIdx] = 0x5e;
                }
                readIdx++;
                writeIdx++
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
                    //packet = abutils.hextoab('7e0000020038009bb67e');
                    packet = makeCommand( CMD_TOTAL_RECORDS_WRITTEN, null);
                    break;
                case 'get_log_size':
                    console.info('get_log_size');
                    packet = makeCommand(CMD_GET_LOG_COUNT_AT, '0000000000000000');
                    //packet = abutils.hextoab('7e00000a000300000000000000000054d57e');
                    break;
                case 'get_log_data':
                    console.info('get_log_data');
                    packet = makeCommand(CMD_GET_LOG_DATA_AT,'0000000000000000' );
                    // packet = abutils.hextoab('7e00000a0005000000000000000000863d7e');
                    break;
                case 'generic_ack':
                    console.info('generic_ack');
                    packet = abutils.hextoab('7e04000200ffffed2e7e');
                    break;
                case 'generic_nack':

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

        /**
         *   Make a command packet (returns the framed command)
         * @param {*Number} cmd_code
         * @param {*String or Uint8Array} cmd_arg Hex string or Uint8Array
         */
        var makeCommand = function(cmd_code, cmd_arg) {
            if (cmd_arg) {
                if ( typeof cmd_arg == 'string') {
                    cmd_arg = abutils.hextoab(cmd_arg);
                }
             } else {
                cmd_arg = new Uint8Array(0);
            }
            var packet = new Uint8Array(cmd_arg.byteLength + 2);
            var dv = new DataView(packet.buffer);
            dv.setUint16(0, cmd_code, true);
            packet.set(cmd_arg, 2);
            console.info('Raw command', abutils.hexdump(packet));
            return framePacket(PKT_COMMAND, packet);
        }

        /**
         *   Returns a ready-to-send packet over the link
         * @param {*Number} pkt_type
         * @param {*Uint8Array} payload
         */
        var framePacket = function(pkt_type, payload) {
            var escaped = escape(payload);
            var packet = new Uint8Array(escaped.byteLength + 8);
            var dv = new DataView(packet.buffer);
            packet[0] = 0x7e;
            packet[packet.length-1] = 0x7e;
            dv.setUint16(1, pkt_type, true);
            dv.setUint16(3, escaped.byteLength, true);
            packet.set(escaped, 5);
            var crc = crcCalc.x25_crc(packet.subarray(1,packet.length-3));
            dv.setUint16(packet.length-3, crc, true);
            console.info('Framed packet', abutils.hexdump(packet));
            return packet;
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