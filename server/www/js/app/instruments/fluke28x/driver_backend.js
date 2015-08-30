/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * Browser-side Parser for Fluke multimeters.
 *
 * Differences with server-side parser:
 *   - 'socket' uses "trigger" to emit events, not "emit"
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var Serialport = require('serialport'),
        crcCalc = require('app/lib/crc_calc'),
        abu = require('app/lib/abutils'),
        pako = require('lib/pako'),
        serialConnection = require('connections_serial'),
        Bitmap = require('app/lib/bitmap');

    var parser = function (socket) {

        var self = this,
            socket = socket;
        var livePoller = null; // Reference to the live streaming poller
        var streaming = false;
        var uidrequested = false;
        var isopen = false;
        var port = null,
            port_open_requested = false,
            port_close_requested = false;

        ////////////////////////////
        // Public API:
        ////////////////////////////

        this.openPort = function (insid) {
            port_open_requested = true;
            var ins = instrumentManager.getInstrument();
            port = new serialConnection(ins.get('port'), portSettings());
            port.open();
            port.on('data', format);
            port.on('status', status);

        };

        this.closePort = function (data) {
            // We need to remove all listeners otherwise the serial port
            // will never be GC'ed
            this.stopLiveStream();
            port.off('data', format);
            port_close_requested = true;
            port.close();
        }

        this.isOpen = function () {
            return isopen;
        }

        this.isOpenPending = function() {
            return port_open_requested;
        }

        this.isStreaming = function () {
            return streaming;
        };


        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        // Returns the Radio serial number.
        this.sendUniqueID = function () {
            debug("[fluke289] Asking for serial number for UID request");
            uidrequested = true;
            this.output('QSN');
        };


        this.startLiveStream = function (period) {
            if (!streaming) {
                console.log("[fluke289] Starting live data stream");
                this.output('QBL');
                livePoller = setInterval(queryMeasurementFull.bind(this), (period) ? period * 1000 : 1000);
                streaming = true;
            }
        };

        this.stopLiveStream = function (period) {
            if (streaming) {
                console.log("[fluke289] Stopping live data stream");
                clearInterval(livePoller);
                streaming = false;
            }
        };

        // output is used to format
        // the data that is sent on the serial port, coming from the
        // HTML interface.
        this.output = function (data) {

            // before being able to send commands, we need to ask to open
            // the link by sending status byte 0x03:
            if (currentLinkstate == linkstate.closed) {
                currentLinkstate = linkstate.wantconnect;
                var buf = abu.hextoab("1002031003a28e");
                commandQueue.push(data);
                debug("Link closed: requested link open, queued command (" + data + ")");
                port.write(buf);
            }
            if (currentLinkstate == linkstate.wantconnect) {
                debug("Waiting for link to open, queue command (" + data + ")");
                commandQueue.push(data);
                return;
            }

            if (currentState == null)
                currentState = state.idle;

            if (currentState != state.idle) {
                // We are working on a command, so queue this one
                commandQueue.push(data);
                debug("Waiting for command response, queuing command instead - " + data);
                return;
            }

            // If our commandQueue is not empty, first send the oldest
            // command, so that we keep the order:
            if (commandQueue.length) {
                debug("output: command queue not empty, queuing " + data + " and sending oldest command in queue");
                commandQueue.push(data);
                data = commandQueue.shift();
            }

            // We need to save the previous command name because the meter does
            // not echo the command we send
            pendingCommand = data.split(" ")[0];
            pendingCommandArgument = data.split(" ")[1];
            debug("Sending command " + data);
            currentState = state.wait_ack;
            // We'll wait for 300ms for a response, otherwise we reset.
            timeoutTimer = setTimeout(waitTimeout, 300, this);

            // Now frame our data with protocol bytes:

            var tmp = new Uint8Array(data.length + 5);
            tmp.set(abu.str2ui8(data), 3); // Copy our command at the right place
            var dv = new DataView(tmp.buffer);
            dv.setUint16(0, 0x1002); // tmp.writeUInt16BE(0x1002,0);
            dv.setUint8(2, currentStatusByte); // tmp.writeUInt8(this.currentStatusByte,2);            
            dv.setUint16(tmp.byteLength - 2, 0x1003); // tmp.writeUInt16BE(0x1003,tmp.length-2);

            var crc = crcCalc.fluke_crc(tmp);
            var finalBuffer = new Uint8Array(tmp.length + 2);
            finalBuffer.set(tmp, 0);
            dv = new DataView(finalBuffer.buffer);
            dv.setUint16(finalBuffer.length - 2, crc, true); // We want Low Endian
            // debug(finalBuffer);
            port.write(finalBuffer.buffer);
        };

        ////////////////////////////////////
        // Private methods and variables
        ////////////////////////////////////

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

            isopen = stat.portopen;

            if (isopen) {
                // Should run any "onOpen" initialization routine here if
                // necessary.
            } else {
                // We remove the listener so that the serial port can be GC'ed
                if (port_close_requested) {
                    port.off('status', stat);
                    resetState(); // Clear everything
                    port_close_requested = false;
                }
            }
        };


        var portSettings = function () {
            return {
                baudRate: 115200,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                dtr: false,
                flowControl: false,
                // We get non-printable characters on some outputs, so
                // we have to make sure we use "binary" encoding below,
                // otherwise the parser will assume Unicode and mess up the
                // values.
                parser: Serialport.parsers.raw,
            }
        };


        // Format acts on incoming data from the device, and then
        // forwards the data to the app through a 'data' event.

        // For the Fluke289 and its complex binary protocol, this implements
        // Link layer protocol management: receives raw data from
        // the serial port, saves it and as soon as a complete data packet
        // is received, forward it to the upper layer.
        //
        // data is a buffer        
        var format = function (data) {
            if (data) { // we sometimes get called without data, to further process the
                // existing buffer
                // First of all, append the incoming data to our input buffer:
                console.log("LLP: Received new serial data, appended at index " + ibIdx);
                inputBuffer.set(new Uint8Array(data), ibIdx);
                ibIdx += data.byteLength;
            }
            var start = -1,
                stop = -1;
            if (currentProtoState == protostate.stx) {
                start = sync(inputBuffer, ibIdx);
                //debug("Found STX: " + start);
                if (start > -1) {
                    currentProtoState = protostate.etx;
                    // Realign our buffer (we can copy over overlapping regions):
                    inputBuffer.set(inputBuffer.subarray(start));
                    ibIdx -= start;
                } else {
                    return;
                }
            }
            if (currentProtoState == protostate.etx) {
                stop = etx(inputBuffer, ibIdx);
                //debug("Found ETX: " + stop);
                currentProtoState = protostate.stx;
            }
            if (stop == -1) {
                // We are receiving a packet but have not reached the end of it yet
                return;
            }

            // We have reached the end of the packet: copy the packet to a new buffer
            // for processing, and realign the input buffer:
            var controlByte = inputBuffer[2];
            debug("Control byte: " + controlByte.toString(16));

            // Check for control byte value:
            // I was not able to fully understand the logic of this byte...
            switch (controlByte) {
            case 0x05: // CRC Error
                console.log("LLP: CRC Error on packet coming from computer");
                break;
            case 0x07: // Response to link open request
                console.log("LLP: Link open");
                currentLinkstate = linkstate.open;
                // Now that our link is open, request a few basic infos that
                // we will need to decode binary logs:
                commandQueue.push("QEMAP readingID");
                commandQueue.push("QEMAP primFunction");
                commandQueue.push("QEMAP secFunction");
                commandQueue.push("QEMAP autoRange");
                commandQueue.push("QEMAP state");
                commandQueue.push("QEMAP unit");
                commandQueue.push("QEMAP attribute");
                commandQueue.push("QEMAP recordType");
                commandQueue.push("QEMAP isStableFlag");
                commandQueue.push("QEMAP bolt");
                commandQueue.push("QEMAP mode");
                break;
            case 0x0b: // Busy ? (?)
                console.log("LLP: Device busy, retrying after timeout.");
                // Do nothing, the current command will timeout and
                // we are rescheduling it just here:
                commandQueue.unshift(pendingCommand + (pendingCommandArgument ? ' ' + pendingCommandArgument : ''));
                break;
            case 0x01: // Command reception acknowledge
            case 0x41:
                console.log("LLP: Command ACK received");
                break;
            case 0x20: // Need to send an Acknowledge
                // Send packet with 0x21
                // - just send the prepackaged data...
                console.log("LLP: Sending ACK");
                try {
                    port.write(abu.hextoab("10022110032138"));
                } catch (err) {
                    console.log("Error on serial port while writing : " + err);
                }
                currentStatusByte = 0x40;
                break;
            case 0x60:
                // Send packet with 0x61
                // - just send the prepackaged data...
                debug("LLP: Sending ACK");
                try {
                    port.write(abu.hextoab("1002611003573e"));
                } catch (err) {
                    console.log("Error on serial port while writing : " + err);
                }
                currentStatusByte = 0x00;
                break;
            }

            var response = '';
            // Process the packet if it contains a payload
            if (stop > 7) {

                var escapedPacket = inputBuffer.subarray(3, stop - 4);

                // One last thing before the packet is ready: 0x10 is escaped,
                // so we need to replace any instance of 0x10 0x10 in the buffer
                // by a single 0x10
                var packet = unescape(escapedPacket);
                console.log("LLP: New packet ready:");
                // debug(packet);
                response = processPacket(packet);
            } else if (controlByte == 0x07) {
                response = processPacket();
            }

            inputBuffer.set(inputBuffer.subarray(stop));
            ibIdx -= stop;

            if (ibIdx > stop) {
                sendData(response);
                format(); // We still have data to process, so we call ourselves recursively
                return;
            }

            sendData(response);
        };



        function debug(txt) {
            console.log(txt);
        };

        // Session layer. Whenever a command is sent, the DMM
        // replies first with a response code ('ACK' below) then
        // the actual response if needed.
        var state = {
            idle: 0, // session is idle
            wait_ack: 1, // command send, expecting ACK code
            wait_response: 2, // ACK received, waiting for command response
            error: 3
        };

        // Low level parsing of incoming binary data
        var protostate = {
            stx: 0, // Looking for 'STX' sequence
            etx: 1, // Looking for 'ETX' sequence
        };

        // Link layer protocol: state of the link layer
        var linkstate = {
            closed: 0, // Link closed
            wantconnect: 1, // Link open request is sent by computer
            open: 2 // Link open
        };

        // Tables that contain the mapping of various fields in binary structures:
        var mapReadingID = [];
        var mapUnit = [];
        var mapState = [];
        var mapAttribute = [];
        var mapRecordType = [];
        var mapIsStableFlag = [];
        var mapPrimFunction = [];
        var mapSecFunction = [];
        var mapAutoRange = [];
        var mapBolt = [];
        var mapMode = [];

        // We keep track of the last sent command for which we are
        // expecting a response, to enable parsing of the response:
        var pendingCommand = "";
        var pendingCommandArgument = "";
        // Some commands don't send a reply except the ACK code
        var noReplyCommands = ["LEDT", "PRESS", "MPQ", "SAVNAME", "MP"];

        // We manage a command queue on the link, as well as a
        // command timeout:
        var commandQueue = [];
        var timeoutTimer = null;

        // See 'state' above. This is session level
        var currentState = 0;

        // Link state handling
        var currentLinkstate = 0; // see linkstate above
        var currentStatusByte = 0x00; // TODO: fully clarify how this one works...

        // Binary buffer handling:
        var currentProtoState = 0; // see protostate above
        var inputBuffer = new Uint8Array(2048); // meter never sends more than 1024 bytes anyway
        var ibIdx = 0;

        // Special handling of the bitmap download case: we get the whole
        // bitmap in several calls, so the variable below stores the parts
        var tmpBitmap = [];
        var tmpBitmapIndex = 0;

        function resetState() {
            currentLinkstate = 0;
            currentStatusByte = 0x00;
            currentProtoState = 0;
            ibIdx = 0;
            tmpBitmapIndex = 0;
            commandQueue = [];
            currentState = 0;
            pendingCommand = "";
        };

        // Returns starting index of 0x10 0x02
        function sync(buffer, maxIndex) {
            for (var i = 0; i < maxIndex - 1; i++) {
                if (buffer[i] == 0x10 && buffer[i + 1] == 0x10)
                    i += 2;
                if (buffer[i] == 0x10 && buffer[i + 1] == 0x02) {
                    return i;
                }
            }
            return -1;
        };

        function etx(buffer, maxIndex) {
            for (var i = 0; i < maxIndex - 3; i++) {
                if (buffer[i] == 0x10 && buffer[i + 1] == 0x10)
                    i += 2;
                if (buffer[i] == 0x10 && buffer[i + 1] == 0x03) {
                    return i + 4; // Include CRC
                }
            }
            return -1;
        };

        // Unescapes character 0x10:
        function unescape(buffer) {
            var readIdx = 0;
            var writeIdx = 0;
            var tmpBuffer = new Uint8Array(buffer.length);
            while (readIdx < buffer.length) {
                tmpBuffer[writeIdx] = buffer[readIdx];
                if (buffer[readIdx] == 0x10)
                    readIdx++;
                writeIdx++;
                readIdx++;
            }
            // Now generate a recut buffer of the right size:
            var retBuffer = new Uint8Array(tmpBuffer.buffer, 0, writeIdx);
            return retBuffer;
        };

        function queryMeasurementFull() {
            this.output('QDDA');
            // Query battery level every minute
            if (new Date().getSeconds() == 0) {
                this.output('QBL');
            }
        };

        // processPacket is called by format once a packet is received, for actual
        // processing and sending over the socket.io pipe
        function processPacket(buffer) {
            console.log('Fluke 289 - Packet received - expecting it to be a response to ' + pendingCommand);
            if (timeoutTimer) { // Disarm watchdog
                clearTimeout(timeoutTimer);
                timeoutTimer = null;
            }

            // We process in two stages:
            // 1. Check the response code
            // 2. Parse the response data
            //  Response data parsing is split in two:
            //    2.1 If expected response is binary, parse it
            //    2.2 If expected response is ASCII, parse it        
            var response = {};
            if (currentState == state.wait_ack) {
                // Get the response code from the buffer: in case the response
                // is binary, data[1] as a string is not what we want, but we'll
                // address this in time
                var data = abu.ab2str(buffer).split('\x0d');
                switch (data[0]) {
                case "0": // OK
                    // Some commands don't return anything else than an ACK, identify them here
                    // for performance reasons (skips all the processing below...)
                    if (noReplyCommands.indexOf(pendingCommand) != -1) {
                        currentState = state.idle;
                    } else {
                        currentState = state.wait_response;
                    }
                    break;
                case "1": // Syntax Error
                    currentState = state.error;
                    break;
                case "2": // Execution Error
                    currentState = state.error;
                    break;
                case "5": // No data available
                    currentState = state.idle;
                    break;
                default:
                    currentState = state.error;
                    break;
                }
                if (currentState == state.error) {
                    currentState = state.idle;
                    response = {
                        "error": true
                    };
                } else {
                    response = {
                        "error": false
                    };
                }
            }

            if (currentState == state.wait_response) {
                var commandProcessed = false;
                //////////////////
                // First, process binary replies
                //////////////////
                switch (pendingCommand) {
                case "QLCDBM":
                    commandProcessed = true;
                    // The meter only returns data in chunks of 1024 bytes
                    // so we need to request two QLCDBM commands to get
                    // everything
                    debug("Processing screenshot part 1");
                    tmpBitmap.push(buffer);
                    // Find start of data (after #0)
                    var idx = 0;
                    while (idx < buffer.length) {
                        if (buffer[idx] == 0x23 && buffer[idx + 1] == 0x30)
                            break;
                        idx++;
                    }
                    tmpBitmapIndex += buffer.length - (idx + 2);
                    debug("Received " + buffer.length + " bytes of Bitmap data");
                    // if we got a full buffer (1024 bytes), then we are not at the end
                    // of our bitmap
                    if (buffer.length == 1024) {
                        debug("Requesting more bitmap data");
                        // Bitmap processing is asynchronous...
                        commandQueue.push("QLCDBM " + tmpBitmapIndex);
                    } else {
                        // Got less than a full buffer, this means we have the
                        // complete bitmap:
                        processBitmap();
                        debug("Bitmap processing requested");
                    }
                    break;
                case "QSMR":
                    commandProcessed = true;
                    // Query Saved Measurement Reading
                    //console.log(Hexdump.dump(buffer.toString('binary')));
                    break;
                case "QRSI":
                    commandProcessed = true;
                    // Query Recording Summary Information
                    commandProcessed = true;
                    response = processRecordingSummary(buffer);
                    response.recordingID = pendingCommandArgument;
                    break;
                case "QSRR":
                    commandProcessed = true;
                    // Query Saved Recording Record (??? :) )
                    response = processRecordingEntry(buffer);
                    response.recordingID = pendingCommandArgument;
                    break;
                case "QMMSI":
                    commandProcessed = true;
                    response = processMinMaxRecording(buffer);
                    response.minmaxRecordingID = pendingCommandArgument;
                    //console.log(Hexdump.dump(buffer.toString('binary')));
                    break;
                case "QPSI":
                    commandProcessed = true;
                    //console.log(Hexdump.dump(buffer.toString('binary')));
                    break;
                default:
                    commandProcessed = false;
                    break;
                }

                //////////////////
                // Then process ASCII replies
                //////////////////
                if (!commandProcessed && !(data[1] == undefined)) {
                    // Below are ASCII replies, so it's time to
                    // do the split on CSV fields:
                    var fields = data[1].split(',');
                    switch (pendingCommand) {
                    case "ID": // Short Identification of meter
                        response.model = fields[0];
                        response.version = fields[1];
                        response.serial = fields[2];
                        break;
                    case "IM": // Long identification of meter
                        response.model = fields[0];
                        response.version = fields[1];
                        response.serial = fields[2]
                        response.mspversion = fields[3];
                        response.buildbranch = fields[4];
                        response.buildrevision = fields[5];
                        response.boardid = fields[6];
                        break;
                    case "QM": // Query Measurement: READING_VALUE, UNIT, STATE, ATTRIBUTE 
                        response.value = Number(fields[0]);
                        response.unit = fields[1];
                        response.readingState = fields[2];
                        response.attribute = fields[3];
                        break;
                    case "QCCV": // Calibration counter
                        response.calcounter = data[1];
                        break;
                    case "QCVN": // Calibration version
                        response.calversion = data[1];
                        break;
                    case "QBL": // Query battery life
                        response.battery = data[1];
                        break;
                    case "QMPQ": // Query Meter asset properties
                        // Remove single quotes:
                        data[1] = data[1].replace(/'/g, '');
                        switch (pendingCommandArgument) {
                        case 'operator':
                            response.operator = data[1];
                            break;
                        case 'company':
                            response.company = data[1];
                            break;
                        case 'site':
                            response.site = data[1];
                            break;
                        case 'contact':
                            response.contact = data[1];
                            break;
                        }
                        break;
                    case "QMEMLEVEL":
                        response.memlevel = data[1];
                        break;
                    case "QSN":
                        response.serial = data[1];
                        if (uidrequested) {
                            console.log("Sending uniqueID message");
                            self.trigger('data', {
                                uniqueID: '' + data[1]
                            });
                            uidrequested = false;
                        }
                        break;
                    case "QSAVNAME":
                        response.savname = {
                            id: pendingCommandArgument,
                            value: data[1]
                        };
                        break;
                    case "QSLS": // TODO: confirm this ?
                        response.savedlogs = {
                            record: fields[0], // This is a log session
                            minmax: fields[1],
                            peak: fields[2],
                            measurement: fields[3]
                        };
                        break;
                    case "QDDA": // Extended version of meter value reading
                        response = processQDDA(data[1]);
                        response.error = false;
                        break;

                    case "QEMAP": // Property mapping
                        response = processEmap(data[1]);
                        response.error = false;
                        break;
                    default:
                        // We don't know what we received, just
                        // pass it on:
                        response.raw = data[1];
                        break;
                    }
                }
                if (data[1] == undefined) {
                    console.log("WARNING: no return value for " + pendingCommand + ", you should add it to the noReplyCommands list");
                }
                currentState = state.idle;
            }

            // If we have more commands in the queue, now is the time to process them
            if (commandQueue.length && currentState == state.idle) {
                var cmd = commandQueue.shift();
                debug("Command queue: dequeuing command " + cmd);
                try { 
                    self.output(cmd);
                } catch (err) {
                    console.log("Error on serial port while writing : " + err);
                }
            }
            debug("Sending response ");
            debug(response);
            return response;
        };

        // Sends back a JSON-formatted structure describing the complete meter reading.
        // This is also what can/should be recorded in logs
        // { primaryFunction:   ,
        //   secondaryFunction: ,
        //   rangeData: { autoRangeState:,
        //                baseUnit: ,
        //                rangeNumber: ,
        //                rangeMultiplier:
        //              },
        //    lightningBold: boolean,
        //    minMaxStartTime: number of milliseconds since January 1 1970
        //    measurementModes: [ 'measurementMode' ],  // Array of measurement modes, can be empty
        //    readingData: [
        //           reading1
        //           ...
        //           readingN
        //           ],
        //   }
        function processQDDA(data) {
            var fields = data.split(',');
            var res = {};
            res.primaryFunction = fields[0];
            res.secondaryFunction = fields[1];
            res.rangeData = {
                autoRangeState: fields[2],
                baseUnit: fields[3],
                rangeNumber: Number(fields[4]),
                rangeMultiplier: Number(fields[5])
            };
            res.lightningBolt = (fields[6] == "OFF") ? false : true;
            res.minMaxStartTime = fields[7] * 1000;
            res.measurementModes = [];
            var i = 0;
            while (i < fields[8]) {
                res.measurementModes.push(fields[9 + i++]);
            }
            // Now decode the readings:
            var numberOfReadings = fields[9 + i];
            res.readings = [];
            var j = 0;
            while (j < numberOfReadings) {
                res.readings.push(decodeReading(fields.slice(10 + i + j * 9, 19 + i + j * 9)));
                j++;
            }
            return {
                reading: res
            };
        };

        function decodeReading(reading) {
            var res = {};
            res.readingID = reading[0];
            res.readingValue = Number(reading[1]);
            res.baseUnit = reading[2];
            res.unitMultiplier = Number(reading[3]);
            res.decimalPlaces = Number(reading[4]);
            res.displayDigits = Number(reading[5]);
            res.readingState = reading[6];
            res.readingAttribute = reading[7];
            res.timeStamp = reading[8] * 1000;
            return res;
        };

        function sendData(data) {
            if (data) {
                self.trigger('data', data);
            }
        };

        function waitTimeout(self) {
            console.log("***********  Timeout waiting for command response *************** ");
            sendData({
                error: true
            }, false);
            currentState = state.idle;
            // We timed out waiting for a command, process the next one in the queue if there is one
            if (commandQueue.length) {
                var cmd = commandQueue.shift();
                console.log("Command queue: dequeuing command " + cmd);
                try {
                    self.output(cmd);
                } catch (err) {
                    console.log("Error on serial port while writing : " + err);
                }
            }
        };

        // We now have a gzipped BMP contained in those two buffers
        // we need to decompress it, turn it into a structure that is intelligible
        // to a browser.
        function processBitmap() {
            var self = this;
            var bmBuffers = [];
            // First of all, we need to remove the remaining framing:
            for (var i = 0; i < tmpBitmap.length; i++) {
                // Find start of data (after #0)
                var idx = 0;
                while (idx < tmpBitmap[i].length) {
                    if (tmpBitmap[i][idx] == 0x23 && tmpBitmap[i][idx + 1] == 0x30)
                        break;
                    idx++;
                }
                var bmBuffer = new Uint8Array(tmpBitmap[i].subarray(idx + 2));
                bmBuffers.push(bmBuffer);
            }


            // Flush our temp buffer
            tmpBitmap = [];
            tmpBitmapIndex = 0;

            // Now assemble buffers & dezip:
            var tlength = 0;
            for (var i = 0; i < bmBuffers.length; i++) {
                tlength += bmBuffers[i].length;
            }
            var bmBuffer = new Uint8Array(tlength);
            tlength = 0;
            for (var i = 0; i < bmBuffers.length; i++) {
                bmBuffer.set(bmBuffers[i], tlength);
                tlength += bmBuffers[i].length;
            }
            debug("Compressed bitmap data is " + bmBuffer.length + " bytes long.");
            //debug(Hexdump.dump(bmBuffer.toString("binary")));

            try {
                var bitmap = pako.inflate(bmBuffer);
                debug("Decompress successful, bitmap data length is " + bitmap.length);
                // Package the BMP bitmap into an RGBA image to send
                // to a canvas element:
                var bm = new Bitmap(bitmap);
                bm.init();
                var data = bm.getData();
                debug("Sending bitmap to application");
                sendData({
                    screenshot: data,
                    width: bm.getWidth(),
                    height: bm.getHeight()
                }, false);
            } catch (err) {
                debug("Something went wrong during bitmap decoding, data was probably corrupted ?\n" + err);
            }
        };

        function syncBuffer(buffer) {
            var idx = 0;

            while (idx < buffer.length) {
                if (buffer[idx] == 0x23 && buffer[idx + 1] == 0x30)
                    break;
                idx++;
            }
            idx += 2; // Now idx is at the start of our data:        
            return idx;
        };

        function processMinMaxRecording(buffer) {
            // Find start of data (after #0)
            var idx = syncBuffer(buffer);
            var dv = new DataView(buffer.buffer);
            var summary = {
                address0: dv.getUint32(idx, true),
                // We use Unix timestamps for our stamps:
                startTime: Math.floor(decodeFloat(buffer, idx += 4) * 1000),
                endTime: Math.floor(decodeFloat(buffer, idx += 8) * 1000),
            };

            var ret = decodeBinaryReading(buffer, idx += 8);
            summary.reading = ret[0];
            idx = ret[1];
            summary.recordingName =  String.fromCharCode.apply(null, new Uint8Array(buffer.buffer, idx));
            return summary;

        };

        function processMeasurementRecording(buffer) {};


        // Decode a Trendlog recording summary
        function processRecordingSummary(buffer) {

            // Find start of data (after #0)
            var idx = syncBuffer(buffer);
            // We remap the buffer's underlying ArrayBuffer to a dataview to read all
            // the data as various binary types:
            var dv = new DataView(buffer.buffer);
            var summary = {
                address0: dv.getUint32(idx,true),
                // We use Unix timestamps for our stamps:
                startTime: Math.floor(decodeFloat(buffer, idx += 4) * 1000),
                endTime: Math.floor(decodeFloat(buffer, idx += 8) * 1000),
                interval: decodeFloat(buffer, idx += 8),
                evtThreshold: decodeFloat(buffer, idx += 8),
                recordingAddress: dv.getUint32(idx += 8, true),
                numberOfRecords: dv.getUint32(idx += 4, true),
            };

            var ret = decodeBinaryReading(buffer, idx += 4);
            summary.reading = ret[0];
            idx = ret[1];
            summary.recordingName = String.fromCharCode.apply(null, new Uint8Array(buffer.buffer, idx));
            debug(summary);
            return summary;
        };

        // A Reading contains range info and primary/secondary functions,
        // then all the readingIDs.
        // idx needs to be the starting offset of the structure
        // returns an object containing the decoded reading + the updated index.
        function decodeBinaryReading(buffer, idx) {
            var dv = new DataView(buffer.buffer);
            var reading = {
                primaryFunction: mapPrimFunction[dv.getUint16(idx, true)],
                secondaryFunction: mapSecFunction[dv.getUint16(idx += 2, true)],
                rangeData: {
                    autoRangeState: mapAutoRange[dv.getUint16(idx += 2, true)],
                    baseUnit: mapUnit[dv.getUint16(idx += 2,true)],
                    rangeNumber: decodeFloat(buffer, idx += 2),
                    rangeMultiplier: dv.getInt16(idx += 8, true)
                },
                lightningBolt: mapBolt[dv.getUint16(idx += 2, true)],
                minMaxStartTime: Math.floor(decodeFloat(buffer, idx += 2) * 1000),
                // TODO: not 100% sure about the below !
                measurementMode1: mapMode[dv.getUint16(idx += 8, true)],
                measurementMode2: dv.getUint16(idx += 2, true),
            };

            var numberOfReadings = dv.getUint16(idx += 2, true);
            // Now decode the readings:
            idx += 2;

            var readings = [];
            for (var i = 0; i < numberOfReadings; i++) {
                readings.push(decodeBinaryReadingId(buffer, idx));
                idx += 30;
            }
            reading.readings = readings;

            return [reading, idx];
        };

        // Decode a readingId located at offset idx in the buffer
        function decodeBinaryReadingId(buffer, idx) {
            var dv = new DataView(buffer.buffer);
            var reading = {
                readingID: mapReadingID[dv.getUint16(idx, true)],
                readingValue: decodeFloat(buffer, idx += 2),
                baseUnit: mapUnit[dv.getUint16(idx += 8, true)],
                unitMultiplier: dv.getInt16(idx += 2, true),
                decimalPlaces: dv.getUint16(idx += 2, true),
                displayDigits: dv.getUint16(idx += 2, true),
                readingState: mapState[dv.getUint16(idx += 2, true)],
                readingAttribute: mapAttribute[dv.getUint16(idx += 2, true)],
                timeStamp: Math.floor(decodeFloat(buffer, idx += 2) * 1000)
            };
            //console.log(reading);
            return reading;
        };

        function decodeFloat(buffer, idx) {
            // Unless I missed something, data is packed as 32bit little endian
            // integers, so the 64bit floats have to be reassembled as two separate
            // reversed buffers to be put back in order. Strange...
            var b2 = new Uint8Array(8);
            var dv = new DataView(buffer.buffer);
            var dv2 = new DataView(b2.buffer);
            var v1 = dv.getUint32(idx + 0, true);
            var v2 = dv.getUint32(idx + 4, true);
            dv2.setUint32(0, v1);
            dv2.setUint32(4, v2);
            //console.log(b2);
            return dv2.getFloat64(0);

        };

        // Decode a Trendlog entry:
        function processRecordingEntry(buffer) {
            //console.log(Hexdump.dump(buffer.toString('binary')));

            // Find start of data (after #0)
            var idx = syncBuffer(buffer);
            var dv = new DataView(buffer.buffer);
            var record = {
                startTime: Math.floor(decodeFloat(buffer, idx) * 1000),
                endTime: Math.floor(decodeFloat(buffer, idx += 8) * 1000),
                maxReading: decodeBinaryReadingId(buffer, idx += 8),
                minReading: decodeBinaryReadingId(buffer, idx += 30),
                averageReading: decodeBinaryReadingId(buffer, idx += 30),
                averageSamples: dv.getUint32(idx += 30, true),
                primaryReading: decodeBinaryReadingId(buffer, idx += 4),
                recordType: mapRecordType[dv.getUint16(idx += 30, true)],
                isStableFlag: mapIsStableFlag[dv.getUint16(idx += 2, true)],
                otherFlag: dv.getUint16(idx += 2, true),
            };
            console.log(record);
            // Now package the trendlog record
            return {
                record: record
            };

        };

        // Transform a comma-separated list of props into a JSON object
        // and also catches any interesting proplist for our own use.
        function processEmap(data) {
            var fields = data.split(',');
            debug(fields);
            var emap = [];
            for (var i = 1; i < fields.length; i++) {
                // Note: some prop fields have very high indexes, but...
                emap[fields[i++]] = fields[i];
            }
            debug(emap);
            switch (pendingCommandArgument) {
            case "unit":
                mapUnit = emap;
                break;
            case "readingID":
                mapReadingID = emap;
                break;
            case "state":
                mapState = emap;
                break;
            case "attribute":
                mapAttribute = emap;
                break;
            case "isStableFlag":
                mapIsStableFlag = emap;
                break;
            case "recordType":
                mapRecordType = emap;
                break;
            case "primFunction":
                mapPrimFunction = emap;
                break;
            case "secFunction":
                mapSecFunction = emap;
                break;
            case "autoRange":
                mapAutoRange = emap;
                break;
            case "bolt":
                mapBolt = emap;
                break;
            case "mode":
                mapMode = emap;
                break;
            }
            return {
                emap: {
                    id: pendingCommandArgument,
                    props: emap
                }
            };
        };

    }

    _.extend(parser.prototype, Backbone.Events);
    return parser;
});