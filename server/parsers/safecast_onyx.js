// A parser for the SafeCast Onyx.


// This object contains two entries:
//  - The low level parser for the serial port driver
//  - The high level parser for incoming serial port data

var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort;

module.exports = {
    
    parser:  serialport.parsers.readline(),
    
    format: function(data) {
        console.log('Onyx - format output');
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
