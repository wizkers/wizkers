/*
 * Parser for the Fluke 289 multimeter
 *
 * ASCII Protocol only for now.
 *
 */

var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort,
    crcCalc = require('../crc-calc.js');

var Hexdump = require('../hexdump.js');


module.exports = {
    
    // Let's make a small state machine
    state: { idle: 0,
             wait_ack: 1,
             wait_response: 2,
             error: 3
           },
    protostate: { stx:0,
                  etx: 1,
                 packetready: 2,
                },
    linkstate: {  closed:0,
                  wantconnect: 1,
                  open: 2
               },
    
    // Name of previous command
    pendingCommand : "CMD",
    pendingCommandArgument: "",
    commandQueue: [],
    answerReceived: false,
    currentState: 0,
    errorCount: 0,
    noReplyCommands: [ "LEDT", "PRESS"  ],
    port: null,
    timeoutTimer: null,
    
    // Link state handling
    currentLinkstate: 0,
    currentStatusByte: 0x00,
    
    // Binary buffer handling:
    currentProtoState: 0,
    inputBuffer: new Buffer(2048),
    ibIdx:0,
    
    // Set a reference to the serial port, used for the command
    // queue.
    setPortRef: function(s) {
        console.log("Setting port reference: " + s);
        this.port = s;
    },
    
    // How the device is connected on the serial port            
    portSettings: {
            baudRate: 115200,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            // simply pass each line to our JSON streaming parser
            // Note: the Onyx outputs json with \n at the end, so
            // the default readline parser works fine (it separates on \r)
            //parser: serialport.parsers.readline('\r'),
            //parser: flukePacketParser(),
            parser: serialport.parsers.raw,
    },
    
    // Returns starting index of 0x10 0x02
     sync: function(buffer, maxIndex) {
        for (var i= 0; i < maxIndex-1; i++) {
            if (buffer[i] == 0x10 && buffer[i+1] == 0x02) {
                return i;
            }
        }
        return -1;
    },
        
    etx : function(buffer, maxIndex) {
        for (var i= 0; i < maxIndex-3; i++) {
            if (buffer[i] == 0x10 && buffer[i+1] == 0x03) {
                return i+4; // Include CRC
            }
        }
        return -1;
    },

    
    // format should return a JSON structure.
    // data is a buffer:
    format: function(data) {
        if (data) {
            // First of all, append the incoming data to our input buffer:
            console.log("--- received new data --- appended at index " + this.ibIdx);
            console.log(data);
            console.log("---");        
            data.copy(this.inputBuffer,this.ibIdx);
            this.ibIdx += data.length;
        }
        console.log("--- input buffer is now:");
        console.log(this.inputBuffer);
        var start=-1, stop=-1;
        if (this.currentProtoState == this.protostate.stx) {
            start = this.sync(this.inputBuffer, this.ibIdx);      
            console.log("Found STX: " + start);
            this.currentProtoState = this.protostate.etx;
            // Realign our buffer (we can copy over overlapping regions):
            this.inputBuffer.copy(this.inputBuffer,0,start);
            this.ibIdx -= start;
        }
        if (this.currentProtoState == this.protostate.etx) {
            stop = this.etx(this.inputBuffer, this.ibIdx);
            console.log("Found ETX: " + stop);
            this.currentProtoState = this.protostate.stx;
        }
        if (stop == -1) {
            // We are receiving a packet but have not reached the end yet
            return ['', false];
        }
        // We have reached the end of the packet: copy the packet to a new buffer
        // for processing, and realign the input buffer:
        var controlByte = this.inputBuffer[2];
        
        // Check for control byte value:
        switch(controlByte) {
            case 0x07: // Response to link open request
                console.log("Link open ***");
                this.currentLinkstate = this.linkstate.open;
                break;
            case 0x0b: // Error (?)
                console.log("Link closed - error **");
                this.currentLinkstate = this.linkstate.closed;
                break;
            case 0x01: // Command reception acknowledge
            case 0x41:
                console.log("Command ACK received...");
                break;
            case 0x20:
                // Send packet with 0x21
                this.port.write(Buffer("10022110032138","hex"));
                this.currentStatusByte = 0x40;
                break;
            case 0x60:
                this.port.write(Buffer("1002611003573e","hex"));
                this.currentStatusByte = 0x00;
                break;
        }

        var response = '';
        // Placeholder: process the packet if it contains a payload
        if (stop > 7) {
            var packet = new Buffer(stop-7);
            this.inputBuffer.copy(packet,0,3,stop-4);
            console.log("New packet ready:");
            console.log(packet);
            console.log("We would process the payload here");
            response = this.processPacket(packet);
        }

        this.inputBuffer.copy(this.inputBuffer,0,stop);
        this.ibIdx -= stop;

        
        
        if (this.ibIdx > stop)
            return [response,true];
        return [response, false];
        //
    },
        
    processPacket: function(buffer) {    
        console.log('Fluke 289 - Packet received - ');
        if (this.timeoutTimer) { // Disarm watchdog
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }

        // For now, assume that all return values are ASCII        
        var data = buffer.toString().split('\x0d');
        console.log("Data: \n" + data);
        
        // Fluke 289 ASCII protocol is CSV separated.
        // We use the previous command name to undserstand what
        // we should be expecting.
        var response = {};
        if (this.currentState == this.state.wait_ack) {
            switch (data[0]) {
                    case "0": // OK
                        // Some commands don't return anything else than an ACK, identify them here
                        if (this.noReplyCommands.indexOf(this.pendingCommand) != -1) {
                            this.currentState = this.state.idle;
                        } else {
                            this.currentState = this.state.wait_response;
                        }
                        break;
                    case "1": // Syntax Error
                        this.currentState = this.state.error;
                        break;
                    case "2": // Execution Error
                        this.currentState = this.state.error;
                        break;
                    case "5": // No data available
                        this.currentState = this.state.idle;
                        break;
                    default:
                        this.currentState = this.state.error;
                        break;
            }
            if (this.currentState == this.state.error) {
                this.currentState = this.state.idle;
                response = { "error":true };
            } else {
                response = { "error": false};
            }
        }
        
        if (this.currentState == this.state.wait_response) {
            var fields = data[1].split(',');
            switch (this.pendingCommand) {
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
                        response.state = fields[2];
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
                        switch(this.pendingCommandArgument) {
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
                    default:
                        // We don't know what we received, just
                        // pass it on:
                        response.raw = data[1];
                        break;
            }
            this.currentState = this.state.idle;
            
        } else {
            this.currentState = this.state.idle;
            response = { "error":true };
        }
        // If we have more commands in the queue, now is the time to process them
        if (this.commandQueue.length && this.currentState == this.state.idle) {
            var cmd = this.commandQueue.pop();
            console.log("Command queue: dequeuing command " + cmd );
            this.port.write(this.output(cmd));
        }
        return response;
    },
    
    waitTimeout: function(self) {
        console.log("Timeout waiting for command response");
        self.currentState = self.state.idle;
        // We timed out waiting for a command, process the next one in the queue if there is one
        if (self.commandQueue.length) {
            var cmd = self.commandQueue.pop();
            console.log("Command queue: dequeuing command " + cmd );
            self.port.write(self.output(cmd, self));
        }
        
    },
    
    // output should return a string, and is used to format
    // the data that is sent on the serial port, coming from the
    // HTML interface.
    output: function(data, context) {
        var self = this;
        if (context != undefined)
            self = context;
        
        // before being able to send commands, we need to ask to open
        // the link by sending status byte 0x03:
        if (this.currentLinkstate == this.linkstate.closed) {
            this.currentLinkstate = this.linkstate.wantconnect;
            var buf = new Buffer("1002031003a28e","hex");
            self.commandQueue.push(data);
            return buf;
        }
        if (this.currentLinkstate == this.linkstate.wantconnect) {
            console.log("Waiting for link to open");
            self.commandQueue.push(data);
            return '';
        }

        if (self.currentState == null)
            self.currentState = self.state.idle;
        
        if (self.currentState != self.state.idle) {
            // We are working on a command, so queue this one
            self.commandQueue.push(data);
            console.log("WARNING: waiting for command response, queuing command - " + data);
            return "";
        }
        // We need to save the previous command name because the meter does
        // not echo the command we send
        self.pendingCommand = data.split(" ")[0];
        self.pendingCommandArgument = data.split(" ")[1];
        console.log("Sending command " + data );
        self.currentState = self.state.wait_ack;
        // We'll wait for 300ms for a response, otherwise we reset.
        self.timeoutTimer = setTimeout(self.waitTimeout, 300, self);


        //var tmp = new Buffer("1002407172736920341003","hex");
        var cmdToBuffer = new Buffer(data,'ascii'); // Turn our command to a buffer
        var tmp = new Buffer(cmdToBuffer.length+5);
        tmp.writeUInt16BE(0x1002,0);
        tmp.writeUInt8(this.currentStatusByte,2);
        cmdToBuffer.copy(tmp,3);
        tmp.writeUInt16BE(0x1003,tmp.length-2);
        
        //tmp = new Buffer("1002031003","hex");
        var crc = crcCalc.fluke_crc(tmp);
        console.log('crc: ' + crc.toString(16));
        var finalBuffer = new Buffer(tmp.length+2);
        tmp.copy(finalBuffer,0);
        finalBuffer.writeUInt16LE(crc,finalBuffer.length-2);
        console.log(finalBuffer);
        
        return finalBuffer;
        //return data + '\r\n';
    }

    
    
}