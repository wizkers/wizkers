/*
 * Parser for Elecraft radios
 *
 * This parser implements elecraft serial commands for:
 *    - KXPA100
 *    - KX3
 * 
 * At this stage, I am not recording anything on those instruments, but I still
 * need to 
 * 
 * 
 *
 * 
 * 
 * 
 *
 */
var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort;

module.exports = {
    
    name: "elecraft",
    uidrequested: false,
    
    // Set a reference to the socket.io socket and port
    socket: null,
    recorder: null,
    port: null,
    
    setPortRef: function(s) {
        this.port = s;
    },
    setSocketRef: function(s) {
        this.socket = s;
    },
    setRecorderRef: function(s) {
        this.recorder = s;
    },
    setInstrumentRef: function(i) {
    },
        
    // How the device is connected on the serial port            
    portSettings: {
            baudRate: 38400,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            // simply pass each line to our JSON streaming parser
            // Note: the Onyx outputs json with \n at the end, so
            // the default readline parser works fine (it separates on \r)
            parser: serialport.parsers.readline(';'),
    },
    
    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    // 
    // TODO: should return the device serial number. If two devices are chained
    // will return all serial numbers, separated by a comma.
    sendUniqueID: function() {
        // Command to get serial number: "MN026;ds;MN255;"
        this.uidrequested = true;
        try {
            this.port.write("MN026;ds;MN255;");
        } catch (err) {
            console.log("Error on serial port while requesting Elecraft UID : " + err);
        }
    },

        
    // format should return a JSON structure.
    format: function(data, recording) {
        // console.log(Hexdump.dump(data));
        if (this.uidrequested && data.substr(0,5) == "DS@@@") {
            // We have a Unique ID
            console.log("Sending uniqueID message");
            this.socket.emit('uniqueID','' + data.substr(5,5));
            this.uidrequested = false;
            return;
        }
        
        this.socket.emit('serialEvent',data);
        //this.recorder.record(fields);
    },
    
    // output should return a string, and is used to format
    // the data that is sent on the serial port, coming from the
    // HTML interface.
    output: function(data) {
        return data;
    }

}