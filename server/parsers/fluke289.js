/*
 * Parser for the Fluke 289 multimeter
 *
 *
 *
 */

var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort;

module.exports = {
    
    // Let's make a small state machine
    state: { idle: 0,
             wait_ack: 1,
             wait_response: 2,
             error: 3
           },
    
    // Name of previous command
    pendingCommand : "CMD",
    answerReceived: false,
    currentState: null,
    errorCount: 0,
    
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
            parser: serialport.parsers.readline('\r'),
    },
    
    // format should return a JSON structure.
    format: function(data) {
        console.log('Fluke 289 - format output\n' + data);
        // Fluke 289 ASCII protocol is CSV separated.
        // We use the previous command name to undserstand what
        // we should be expecting.
        var response = {};
        if (this.currentState == this.state.wait_ack) {
            switch (data) {
                    case "0": // OK
                        this.currentState = this.state.wait_response;
                        break;
                    case "1": // Syntax Error
                        this.currentState = this.state.error;
                        break;
                    case "2": // Execution Error
                        this.currentSate = this.state.error;
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
                return { "error":true };
            }
            return { "error": false};
        } else if (this.currentState == this.state.wait_response) {
            var fields = data.split(',');
            switch (this.pendingCommand) {
                    case "ID": // Short Identification of meter
                        response.model = fields[0];
                        response.version = fields[1];
                        response.serial = fields[2];
                        break;
                    case "QM": // Query Measurement: READING_VALUE, UNIT, STATE, ATTRIBUTE 
                        response.value = Number(fields[0]);
                        response.unit = fields[1];
                        response.state = fields[2];
                        response.attribute = fields[3];
                        break;
                    case "QBL": // Query battery life
                        response.battery = data;
                        break;
                    default:
                        break;
            }
            this.currentState = this.state.idle;
            
        } else {
            this.currentState = this.state.idle;
            return { "error":true };
        }
        return response;
    },
    
    // output should return a string, and is used to format
    // the data that is sent on the serial port, coming from the
    // HTML interface.
    output: function(data) {
        if (this.currentState == null)
            this.currentState = this.state.idle;
        
        if (this.currentState != this.state.idle) {
            this.errorCount++;
            // Don't accept new commands when waiting for
            // an aswer from the DMM.
            // TODO: create a queuing system ?
            console.log("WARNING: waiting for command response!");
            if (this.errorCount > 2) {
                this.currentState = this.state.idle; // What the hell just forget about it for now...
                this.errorCount = 0;
            }
            return "";
        }
        // We need to save the previous command name because the meter does
        // not echo the command we send
        this.pendingCommand = data;
        console.log("Sending command " + data );
        this.currentState = this.state.wait_ack;
        return data + '\r\n';
    }

    
    
}