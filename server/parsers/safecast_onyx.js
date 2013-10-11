// A parser for the SafeCast Onyx.
//
// Only works on the current devel branch with json-compliant
// serial output.

var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort;

module.exports = {
    
    // Set a reference to the socket.io socket and port
    socket: null,
    port: null,
    uidrequested: false,
    
    setPortRef: function(s) {
        this.port = s;
    },
    setSocketRef: function(s) {
        this.socket = s;
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
            parser: serialport.parsers.readline(),
    },
    
    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    // This particular device does not support this concept, so we
    // always return the same
    sendUniqueID: function() {
        this.uidrequested = true;
        this.port.write(this.output('{ "get": "guid" }'));
    },

    
    format: function(data) {
        //console.log('Onyx - format output');
        var cmd = data.split('\n\r\n')[0];
       if (cmd == "LOGXFER") {
           // The result should be data in JSON format: attempt to parse right now
           // and transfer as a log rather than raw:
           try {
               var log = JSON.parse(data.substring(cmd.length+3) );
               this.socket.emit('serialEvent', log);
           } catch (err) {
               console.log("Could not parse log packet");
           }
        } else {
           // Some commands now return JSON
           try {
               var response = JSON.parse(data);
               if (this.uidrequested && response.guid != undefined) {
                   this.socket.emit('uniqueID',response.guid);
               }
                    this.socket.emit('serialEvent', response);
           } catch (err) {
               console.log('Not able to parse JSON');
           }
        }
    },
    
    output: function(data) {
        return data + '\n\n';
    }

};
