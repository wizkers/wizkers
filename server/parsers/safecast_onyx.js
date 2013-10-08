// A parser for the SafeCast Onyx.
//
// Only works on the current devel branch with json-compliant
// serial output.

var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort;

module.exports = {
        
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
    
    format: function(data) {
        //console.log('Onyx - format output');
        var cmd = data.split('\n\r\n')[0];
       if (cmd == "LOGXFER") {
           // The result should be data in JSON format: attempt to parse right now
           // and transfer as a log rather than raw:
           try {
               var log = JSON.parse(data.substring(cmd.length+3) );
               return log;
           } catch (err) {
               console.log("Could not parse log packet");
           }
        } else {
           // Some commands now return JSON
           try {
                    return JSON.parse(data);
           } catch (err) {
               console.log('Not able to parse JSON');
               // Not JSON, return it anway:
               // var rawdata = data.substring(cmd.length+3);
               //rawdata  = rawdata.replace(/\r\n$/gm,'');
               //var raw = { cmd: cmd, raw: rawdata };
               //socket.emit('serialEvent', raw);
           }
        }
    },
    
    output: function(data) {
        return data + '\n\n';
    }

};
