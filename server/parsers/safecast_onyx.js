// A parser for the SafeCast Onyx.
//
// Only works on the current devel branch with json-compliant
// serial output.

var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort;

module.exports = {
    
    name: "onyx",
    
    // Set a reference to the socket.io socket and port
    socket: null,
    port: null,
    recorder: null,
    uidrequested: false,
    
    setPortRef: function(s) {
        this.port = s;
    },
    setSocketRef: function(s) {
        this.socket = s;
    },
    setRecorderRef: function(s) {
        console.log("Setting recorder reference.");
        this.recorder = s;
    },
    setInstrumentRef: function(i) {
    },



        
    // How the device is connected on the serial port            
    portSettings: function() {
        return  {
            baudRate: 115200,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            // simply pass each line to our JSON streaming parser
            // Note: the Onyx outputs json with \n at the end, so
            // the default readline parser works fine (it separates on \r)
            parser: serialport.parsers.readline(),
        }
    },
    
    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    // This particular device does not support this concept, so we
    // always return the same
    sendUniqueID: function() {
        this.uidrequested = true;
        this.port.write(this.output('{ "get": "guid" }'));
    },

    
    format: function(data, recording) {
        // All commands now return JSON
        try {
            //console.log(Hexdump.dump(data.substr(0,5)));
            if (data.substr(0,2) == "\n>")
                return;
            if (data.length < 2)
                return;
            var response = JSON.parse(data);
            if (this.uidrequested && response.guid != undefined) {
                this.socket.emit('uniqueID',response.guid);
                this.uidrequested = false;
            } else {
                this.socket.emit('serialEvent', response);
                this.recorder.record(response);
            }
        } catch (err) {
            console.log('Not able to parse JSON response from device:\n' + data);
        }
    },
    
    output: function(data) {
        return data + '\n\n';
    }

};
