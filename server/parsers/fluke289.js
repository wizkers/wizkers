/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * Parser for the Fluke 289 multimeter
 *
 * This parser implements the Fluke binary link layer protocol
 * and is pretty robust. You send it data coming from the serial port
 * by calling "format" and you send it commands to send to the serial port
 * by calling "output".
 *
 * This driver is partially asynchronous, and it takes care or sending
 * results on the socket after parsing incoming data. Results are output
 * in json format.
 *
 * Due to the nature of the Fluke protocol, a lot of commands have to be
 * explicitly defined and handled within the driver.
 * 
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */

"use strict";

var serialport = require('serialport'),
    crcCalc = require('./lib/crc-calc.js'),
    dbs = require('../pouch-config'),
    zlib = require('zlib'),
    events = require('events'),
    serialconnection = require('../connections/serial'),
    debug = require('debug')('wizkers:parsers:fluke289');

var Hexdump = require('../hexdump.js'),
    Bitmap = require('./lib/bitmap.js'),
    fs = require('fs');


var Fluke289 = function() {
    
    // Init the EventEmitter
    events.EventEmitter.call(this);

    /////////
    // Public variables
    /////////
    this.name = "fluke28x";

    /////////
    // Private variables
    /////////

    // We have a lot of internal variables to manage
    // the link protocol:
    
    // Session layer. Whenever a command is sent, the DMM
    // replies first with a response code ('ACK' below) then
    // the actual response if needed.
    var state = { idle: 0,            // session is idle
             wait_ack: 1,        // command send, expecting ACK code
             wait_response: 2,   // ACK received, waiting for command response
             error: 3
           };
    
    // Low level parsing of incoming binary data
    var protostate = { stx:0,         // Looking for 'STX' sequence
                  etx: 1,        // Looking for 'ETX' sequence
                };
    
    // Link layer protocol: state of the link layer
    var linkstate = {  closed:0,       // Link closed
                  wantconnect: 1, // Link open request is sent by computer
                  open: 2         // Link open
               };
    
    // Tables that contain the mapping of various fields in binary structures:
    var mapReadingID = [],
        mapUnit = [],
        mapState = [],
        mapAttribute = [],
        mapRecordType = [],
        mapIsStableFlag = [],
        mapPrimFunction = [],
        mapSecFunction = [],
        mapAutoRange = [],
        mapBolt = [],
        mapMode = [],
    // We keep track of the last sent command for which we are
    // expecting a response, to enable parsing of the response:
        pendingCommand = "",
        pendingCommandArgument = "",
        noReplyCommands = [ "LEDT", "PRESS", "MPQ", "SAVNAME", "MP" ], // Some commands don't send a reply except the ACK code
    // We manage a command queue on the link, as well as a
    // command timeout:
        commandQueue = [],
        timeoutTimer = null,
    // See 'state' above. This is session level
        currentState = 0;

    // Pointer to the serial port & socket, since we need to handle it directly for
    // some protocol link layer operations and command queue management
    var port = null,
        uidrequested = false,
        instrumentid = null,
        isopen = false,
        recording = false,     // to call the main app in case we need to record readings
        streaming = false,
        livePoller = null,
        port_close_requested = false,
        self = this,

    
    // Link state handling
        currentLinkstate = 0,     // see linkstate above
        currentStatusByte = 0x00, // TODO: fully clarify how this one works...
    
    // Binary buffer handling:
        currentProtoState=  0,          // see protostate above
        inputBuffer = new Buffer(2048), // meter never sends more than 1024 bytes anyway
        ibIdx =0,
    
    // Special handling of the bitmap download case: we get the whole
    // bitmap in several calls, so the variable below stores the parts
        tmpBitmap = [],
        tmpBitmapIndex = 0;
    
    /////////
    // Private methods
    /////////

    var status = function(stat) {
        debug('Port status change', stat);
        isopen = stat.portopen;
        
        if (isopen) {
            // Should run any "onOpen" initialization routine here if
            // necessary.
        } else {
            // We remove the listener so that the serial port can be GC'ed
            if (port_close_requested) {
                port.removeListener('status', status);
                port_close_requested = false;
            }
        }
    };

// How the device is connected on the serial port            
    var portSettings = function() {
        return  {
            baudRate: 115200,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            parser: serialport.parsers.raw,
        }
    };
    
    
    var resetState = function() {
        currentLinkstate = 0;
        currentStatusByte = 0x00;
        currentProtoState = 0;
        ibIdx = 0;
        tmpBitmapIndex = 0;
        commandQueue = [];
        currentState = 0;
        pendingCommand = "";
    };
    
    var sendData = function(data) {
        if (data) {
            self.emit('data',data);
        }
    };
    
    // Returns starting index of 0x10 0x02
     var sync = function(buffer, maxIndex) {
        for (var i= 0; i < maxIndex-1; i++) {
            if (buffer[i] == 0x10 && buffer[i+1] == 0x10)
                i += 2;
            if (buffer[i] == 0x10 && buffer[i+1] == 0x02) {
                return i;
            }
        }
        return -1;
    };

    var etx = function(buffer, maxIndex) {
        for (var i= 0; i < maxIndex-3; i++) {
            if (buffer[i] == 0x10 && buffer[i+1] == 0x10)
                i += 2;
            if (buffer[i] == 0x10 && buffer[i+1] == 0x03) {
                return i+4; // Include CRC
            }
        }
        return -1;
    };
    
    // Unescapes character 0x10:
    var unescape = function(buffer) {
        var readIdx = 0;
        var writeIdx = 0;
        var tmpBuffer = new Buffer(buffer.length);
        while (readIdx < buffer.length) {
            tmpBuffer[writeIdx] = buffer[readIdx];
            if (buffer[readIdx] == 0x10)
                readIdx++;
            writeIdx++;
            readIdx++;
        }
        // Now generate a recut buffer of the right size:
        var retBuffer = new Buffer(writeIdx);
        tmpBuffer.copy(retBuffer,0,0,writeIdx);
        return retBuffer;
    };

    var queryMeasurementFull = function() {
        self.output("QDDA");        
    };
    
    // Link layer protocol management: receives raw data from
    // the serial port, saves it and as soon as a complete data packet
    // is received, forward it to the upper layer.
    //
    // data is a buffer
    var format = function(data) {
        
        if (data) { // we sometimes get called without data, to further process the
                    // existing buffer
            // First of all, append the incoming data to our input buffer:
            debug("LLP: Received new serial data, appended at index " + ibIdx);
            data.copy(inputBuffer,ibIdx);
            ibIdx += data.length;
        }
        var start=-1, stop=-1;
        if (currentProtoState == protostate.stx) {
            start = sync(inputBuffer, ibIdx);      
            debug("Found STX: " + start);
            if (start > -1) {
                currentProtoState = protostate.etx;
                // Realign our buffer (we can copy over overlapping regions):
                inputBuffer.copy(inputBuffer,0,start);
                ibIdx -= start;
            } else {
                return;
            }
        }
        if (currentProtoState == protostate.etx) {
            stop = etx(inputBuffer, ibIdx);
            debug("Found ETX: " + stop);
            currentProtoState = protostate.stx;
        }
        if (stop == -1) {
            // We are receiving a packet but have not reached the end yet
            return;
        }
        // We have reached the end of the packet: copy the packet to a new buffer
        // for processing, and realign the input buffer:
        var controlByte = inputBuffer[2];
        debug("Control byte: " + controlByte.toString(16));
        
        // Check for control byte value:
        // I was not able to fully understand the logic of this byte...
        switch(controlByte) {
            case 0x05: // CRC Error
                debug("LLP: CRC Error on packet coming from computer");
                break;
            case 0x07: // Response to link open request
                debug("LLP: Link open");
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
            case 0x0b: // Error (?)
                debug("LLP: Link closed - error (resetting LLP)");
                resetState(); // Reset our state, we have lost our sync...
                currentLinkstate = linkstate.closed;
                break;
            case 0x01: // Command reception acknowledge
            case 0x41:
                debug("LLP: Command ACK received");
                break;
            case 0x20: // Need to send an Acknowledge
                // Send packet with 0x21
                // - just send the prepackaged data...
                debug("LLP: Sending ACK");
                try {port.write(Buffer("10022110032138","hex")); }catch (err) {
                        debug("Error on serial port while writing : " + err);
                }
                currentStatusByte = 0x40;
                break;
            case 0x60:
                // Send packet with 0x61
                // - just send the prepackaged data...
                debug("LLP: Sending ACK");
                try { port.write(Buffer("1002611003573e","hex")); }catch (err) {
                        debug("Error on serial port while writing : " + err);
                }
                currentStatusByte = 0x00;
                break;
        }

        var response = '';
        // Process the packet if it contains a payload
        if (stop > 7) {
            var escapedPacket = new Buffer(stop-7);
            inputBuffer.copy(escapedPacket,0,3,stop-4);
            // One last thing before the packet is ready: 0x10 is escaped,
            // so we need to replace any instance of 0x10 0x10 in the buffer
            // by a single 0x10
            var packet = unescape(escapedPacket);
            debug("LLP: New packet ready:");
            debug(packet);
            response = processPacket(packet);
        } else if (controlByte == 0x07) {
            response = processPacket();
        }

        inputBuffer.copy(inputBuffer,0,stop);
        ibIdx -= stop;

        if (ibIdx > stop) {
            sendData(response);
            format(); // We still have data to process, so we call ourselves recursively
            return;
        }

        sendData(response);
    };

    // processPacket is called by format once a packet is received, for actual
    // processing and sending over the socket.io pipe
    var processPacket = function(buffer) {    
        debug('Fluke 289 - Packet received - execting it to be a response to ' + pendingCommand);
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
            var data = buffer.toString().split('\x0d');
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
                response = { "error":true };
            } else {
                response = { "error": false};
            }
        }
        
        if (currentState == state.wait_response) {
            var commandProcessed = false;
            //////////////////
            // First, process binary replies
            //////////////////
            switch(pendingCommand) {
                    case "QLCDBM":
                        commandProcessed = true;
                        // The meter only returns data in chunks of 1024 bytes
                        // so we need to request two QLCDBM commands to get
                        // everything
                            debug("Processing screenshot part 1");
                            tmpBitmap.push(buffer);
                            // Find start of data (after #0)
                            var idx = 0;
                            while(idx < buffer.length) {
                                if (buffer[idx]==0x23 && buffer[idx+1] == 0x30)
                                    break;
                                idx++;
                            }
                            tmpBitmapIndex += buffer.length-(idx+2);
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
                        debug(Hexdump.dump(buffer.toString('binary')));
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
                        debug(Hexdump.dump(buffer.toString('binary')));
                        break;
                    case "QPSI":
                        commandProcessed = true;
                        debug(Hexdump.dump(buffer.toString('binary')));
                        break;
                    default:
                        commandProcessed = false;
                        break;
            }

            //////////////////
            // Then process ASCII replies
            //////////////////
            if (!commandProcessed && ! (data[1] == undefined)) {
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
                            response.model   = fields[0];
                            response.version = fields[1];
                            response.serial  = fields[2]
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
                            data[1] = data[1].replace(/'/g,'');
                            switch(pendingCommandArgument) {
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
                                debug("Sending uniqueID message");
                                self.emit('data', {uniqueID: data[1]});
                                uidrequested = false;
                            }
                            break;
                        case "QSAVNAME":
                            response.savname = { id: pendingCommandArgument, value:data[1] };
                            break;
                        case "QSLS": // TODO: confirm this ?
                            response.savedlogs = {
                                record: fields[0],  // This is a log session
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
                    debug("WARNING: no return value for " + pendingCommand + ", you should add it to the noReplyCommands list");
            }
            currentState = state.idle;
        }
        
        // If we have more commands in the queue, now is the time to process them
        if (commandQueue.length && currentState == state.idle) {
            var cmd = commandQueue.pop();
            debug("Command queue: dequeuing command " + cmd );
            self.output(cmd);
        }
        debug("Sending response ");
        debug(response);
        // TODO: move sending on socket in here
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
    var processQDDA = function(data) {
        var fields = data.split(',');
        var res = {};
        res.primaryFunction = fields[0];
        res.secondaryFunction = fields[1];
        res.rangeData = { autoRangeState: fields[2],
                          baseUnit: fields[3],
                          rangeNumber: Number(fields[4]),
                          rangeMultiplier: Number(fields[5])
                        };
        res.lightningBolt = (fields[6] == "OFF") ? false: true;
        res.minMaxStartTime = fields[7]*1000;
        res.measurementModes = [];
        var i = 0;
        while (i < fields[8]) {
            res.measurementModes.push(fields[9+i++]);
        }
        // Now decode the readings:
        var numberOfReadings = fields[9+i];
        res.readings = [];
        var j = 0;
        while (j < numberOfReadings) {
            res.readings.push(decodeReading(fields.slice(10+i+j*9, 19+i+j*9)));
            j++;
        }
        return { reading:res };
    };
    
    var decodeReading = function(reading) {
        var res = {};
        res.readingID = reading[0];
        res.readingValue = Number(reading[1]);
        res.baseUnit = reading[2];
        res.unitMultiplier = Number(reading[3]);
        res.decimalPlaces = Number(reading[4]);
        res.displayDigits = Number(reading[5]);
        res.readingState = reading[6];
        res.readingAttribute = reading[7];
        res.timeStamp = reading[8]*1000;
        return res;
    };
        
    var waitTimeout = function() {
        debug("Timeout waiting for command response");
        sendData({error:true});
        currentState = state.idle;
        // We timed out waiting for a command, process the next one in the queue if there is one
        if (commandQueue.length) {
            var cmd = commandQueue.pop();
            debug("Command queue: dequeuing command " + cmd );
            self.output(cmd);
        }        
    };

    // We now have a gzipped BMP contained in those two buffers
    // we need to decompress it, turn it into a structure that is intelligible
    // to a browser.
    var processBitmap = function() {
        var bmBuffers = [];
        // First of all, we need to remove the remaining framing:
        for (var i=0; i < tmpBitmap.length; i++) {
            // Find start of data (after #0)
            var idx = 0;
            while(idx < tmpBitmap[i].length) {
                if (tmpBitmap[i][idx]== 0x23 && tmpBitmap[i][idx+1] == 0x30)
                    break;
                idx++;
            }
            var bmBuffer = new Buffer(tmpBitmap[i].length-(idx+2));
            tmpBitmap[i].copy(bmBuffer,0,idx+2);
            bmBuffers.push(bmBuffer);
            //this.debug("GZipped data buffer length is " + bmBuffer.length);
            //this.debug(Hexdump.dump(bmBuffer2.toString("binary")));
        }

        // Flush our temp buffer
        tmpBitmap = [];
        tmpBitmapIndex = 0;
        
        // Now assemble buffers & dezip:
        var bmBuffer = Buffer.concat(bmBuffers);
        debug("Compressed bitmap data is " + bmBuffer.length + " bytes long.");
        //this.debug(Hexdump.dump(bmBuffer.toString("binary")));
        
        zlib.unzip(bmBuffer, function(err, buffer) {
            if (!err) {
                // Also copy the result to a temporary file:
                var stream = fs.createWriteStream('screenshot.bmp');
                stream.write(buffer);
                stream.end();
                debug("Decompress successful, bitmap data length is " + buffer.length);
                try {
                    // Package the BMP bitmap into an RGBA image to send
                    // to a canvas element:
                    var bm = new Bitmap(buffer);
                    bm.init();
                    var data = bm.getData();
                    debug("Sending bitmap to application");
                    debug(data);
                    sendData({screenshot: data, width:bm.getWidth(), height: bm.getHeight()});
                } catch (err) {
                    debug("Something went wrong during bitmap decoding, data was probably corrupted ?\n" +err);
                }
            }    
        });
    };
    
    var syncBuffer = function(buffer) {
        var idx = 0;

        while(idx < buffer.length) {
            if (buffer[idx]==0x23 && buffer[idx+1] == 0x30)
                break;
            idx++;
        }
        idx += 2; // Now idx is at the start of our data:
        return idx;  
    };
    
    var processMinMaxRecording = function(buffer) {
        // Find start of data (after #0)
        var idx = syncBuffer(buffer);

        var summary = {
            address0:  buffer.readUInt32LE(idx),
            // We use Unix timestamps for our stamps:
            startTime: Math.floor(decodeFloat(buffer,idx +=4)*1000),
            endTime: Math.floor(decodeFloat(buffer,idx += 8)*1000),            
        };
        
        var ret = decodeBinaryReading(buffer, idx += 8);
        summary.reading = ret[0];
        idx = ret[1];
        summary.recordingName = buffer.toString('ascii',idx);
        return summary;
    };
    
    var processMeasurementRecording = function(buffer) {
      // To be implemented...  
    };

    
    // Decode a Trendlog recording summary
    var processRecordingSummary = function(buffer) {
        
        // Find start of data (after #0)
        var idx =  syncBuffer(buffer);
        
        var summary = {
            address0:  buffer.readUInt32LE(idx),
            // We use Unix timestamps for our stamps:
            startTime: Math.floor(decodeFloat(buffer,idx +=4)*1000),
            endTime: Math.floor(decodeFloat(buffer,idx += 8)*1000),
            interval : decodeFloat(buffer,idx +=8),
            evtThreshold: decodeFloat(buffer,idx +=8),
            recordingAddress: buffer.readUInt32LE(idx +=8),
            numberOfRecords: buffer.readUInt32LE(idx +=4),
        };

        var ret = decodeBinaryReading(buffer, idx +=4);
        summary.reading = ret[0];
        idx = ret[1];
        
        summary.recordingName = buffer.toString('ascii',idx);
        
        debug(summary);
        return summary;
    };
    
    // A Reading contains range info and primary/secondary functions,
    // then all the readingIDs.
    // idx needs to be the starting offset of the structure
    // returns an object containing the decoded reading + the updated index.
    var decodeBinaryReading = function(buffer, idx) {
        
        var reading = {
            primaryFunction: mapPrimFunction[buffer.readUInt16LE(idx)],
            secondaryFunction: mapSecFunction[buffer.readUInt16LE(idx += 2)] ,
            rangeData: {
                autoRangeState: mapAutoRange[buffer.readUInt16LE(idx += 2)],
                baseUnit: mapUnit[buffer.readUInt16LE(idx += 2)],
                rangeNumber: decodeFloat(buffer, idx +=2),
                rangeMultiplier: buffer.readInt16LE(idx +=8)
            },
            lightningBolt: mapBolt[buffer.readUInt16LE(idx +=2)],
            minMaxStartTime: Math.floor(decodeFloat(buffer, idx += 2)*1000),
            // TODO: not 100% sure about the below !
            measurementMode1: mapMode[buffer.readUInt16LE(idx +=8)],
            measurementMode2: buffer.readUInt16LE(idx +=2),
        };
        
        var numberOfReadings = buffer.readUInt16LE( idx +=2);
        // Now decode the readings:
        idx += 2;
        
        var readings = [];
        for (var i = 0; i < numberOfReadings; i++) {
            readings.push(decodeBinaryReadingId(buffer,idx));
            idx += 30;
        }
        reading.readings = readings;
        return [reading, idx];
    };
    
    
    // Decode a readingId located at offset idx in the buffer
    var decodeBinaryReadingId = function(buffer,idx) {
        var reading = {
            readingID: mapReadingID[buffer.readUInt16LE(idx)],
            readingValue: decodeFloat(buffer, idx += 2),
            baseUnit: mapUnit[buffer.readUInt16LE(idx +=8)],
            unitMultiplier: buffer.readInt16LE(idx +=2),
            decimalPlaces: buffer.readUInt16LE(idx +=2),
            displayDigits: buffer.readUInt16LE(idx +=2),
            readingState: mapState[buffer.readUInt16LE(idx +=2)],
            readingAttribute: mapAttribute[buffer.readUInt16LE(idx +=2)],
            timeStamp: Math.floor(decodeFloat(buffer,idx+=2)*1000)
        };
        //console.log(reading);
        return reading;
    };
    
    var decodeFloat = function(buffer,idx) {
        // Unless I missed something, data is packed as 32bit little endian
        // integers, so the 64bit floats have to be reassembled as two separate
        // reversed buffers to be put back in order. Strange...
        var b2 = new Buffer(8);
        var v1 = buffer.readUInt32LE(idx+0);
        var v2 = buffer.readUInt32LE(idx+4);
        b2.writeUInt32BE(v1,0);
        b2.writeUInt32BE(v2,4);
        //console.log(b2);
        return b2.readDoubleBE(0);        
    };
    
    // Decode a Trendlog entry:
    var processRecordingEntry = function(buffer) {
        console.log(Hexdump.dump(buffer.toString('binary')));
        // Find start of data (after #0)
        var idx =  syncBuffer(buffer);
        
        var record = {
            startTime: Math.floor(decodeFloat(buffer,idx)*1000),
            endTime: Math.floor(decodeFloat(buffer,idx +=8)*1000),
            maxReading: decodeBinaryReadingId(buffer, idx +=8),
            minReading: decodeBinaryReadingId(buffer, idx +=30),
            averageReading: decodeBinaryReadingId(buffer, idx +=30),
            averageSamples: buffer.readUInt32LE(idx +=30),
            primaryReading: decodeBinaryReadingId(buffer, idx +=4),
            recordType: mapRecordType[buffer.readUInt16LE(idx +=30)],
            isStableFlag: mapIsStableFlag[buffer.readUInt16LE(idx +=2)],
            otherFlag: buffer.readUInt16LE(idx +=2),
        };
        
        console.log(record);
        // Now package the trendlog record
        return { record: record};
    };
    
    
    // Transform a comma-separated list of props into a JSON object
    // and also catches any interesting proplist for our own use.
    var processEmap = function(data) {
        var fields = data.split(',');
        debug(fields);
        var emap = [];
        for (var i=1; i < fields.length; i++) {
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
        return { emap : {id: pendingCommandArgument, props: emap }};
    }   

    
    /////////
    // Public API
    /////////
    
    // Creates and opens the connection to the instrument.
    // for all practical purposes, this is really the init method of the
    // driver
    
    this.openPort = function(id) {
        instrumentid = id;
        dbs.instruments.get(id, function(err,item) {
            port = new serialconnection(item.port, portSettings());
            port.on('data', format);
            port.on('status', status);
        });
    }

    
    this.closePort = function(data) {
        // We need to remove all listeners otherwise the serial port
        // will never be GC'ed
        this.stopLiveStream();
        port.removeListener('data', format);
        port_close_requested = true;
        port.close();
    }

    this.isOpen = function() {
        return isopen;
    }

    this.getInstrumentId = function(format) {
        return instrumentid;
    };

    
    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    // For the Fluke, the UID is the serial number, so this is
    // what we will request, but we will return it inside a special
    // message.
    this.sendUniqueID = function() {
        debug("[fluke289] Asking for serial number for UID request");
        uidrequested = true;
        this.output("QSN");
    };
        
    this.isStreaming = function() {
        return streaming;
    };
    
    // period is in seconds
    this.startLiveStream = function(period) {
        if (!streaming) {
            debug("Starting live data stream");
            livePoller = setInterval(queryMeasurementFull.bind(this), (period) ? period*1000: 1000);
            streaming = true;
        }
    };
    
    this.stopLiveStream = function(period) {
        if (streaming) {
            debug("[fluke289] Stopping live data stream");
            clearInterval(livePoller);
            this.streaming = false;
        }
    };

    // output takes data and sends it to the port after
    // protocol encapsulation. For this driver, this is fairly
    // complex because we have a queue of commands, etc...
    this.output = function(data) {
        
        // before being able to send commands, we need to ask to open
        // the link by sending status byte 0x03:
        if (currentLinkstate == linkstate.closed) {
            currentLinkstate = linkstate.wantconnect;
            var buf = new Buffer("1002031003a28e","hex");
            commandQueue.push(data);
            debug("Link closed: requested link open, queued command (" + data + ")");
            port.write(buf);
            return;
        }
        if (currentLinkstate == linkstate.wantconnect) {
            debug("Waiting for link to open, queue command");
            commandQueue.push(data);
            return;
        }

        if (currentState == null)
            currentState = state.idle;
        
        if (currentState != state.idle) {
            // We are working on a command, so queue this one
            commandQueue.push(data);
            debug("Waiting for command response, queuing command - " + data);
            return;
        }
        // We need to save the previous command name because the meter does
        // not echo the command we send
        pendingCommand = data.split(" ")[0];
        pendingCommandArgument = data.split(" ")[1];
        debug("Sending command " + data );
        currentState = state.wait_ack;
        // We'll wait for 300ms for a response, otherwise we reset.
        timeoutTimer = setTimeout(waitTimeout, 300);

        var cmdToBuffer = new Buffer(data,'ascii'); // Turn our command to a buffer
        var tmp = new Buffer(cmdToBuffer.length+5);
        tmp.writeUInt16BE(0x1002,0);
        tmp.writeUInt8(currentStatusByte,2);
        cmdToBuffer.copy(tmp,3);
        tmp.writeUInt16BE(0x1003,tmp.length-2);

        var crc = crcCalc.fluke_crc(tmp);
        //console.log('crc: ' + crc.toString(16));
        var finalBuffer = new Buffer(tmp.length+2);
        tmp.copy(finalBuffer,0);
        finalBuffer.writeUInt16LE(crc,finalBuffer.length-2);
        debug(finalBuffer);
        
        try {
            port.write(finalBuffer);
        } catch (err) {
            debug("Error on serial port while writing data : " + err);
        }
    };

}

Fluke289.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Fluke289;
