// A parser for the Fried Circuits OLED Backpack


// This object contains two entries:
//  - The low level parser for the serial port driver
//  - The high level parser for incoming serial port data

var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort;

module.exports = {

    // Should be a parser that is compliant with the type of parsers
    // expected by serialport.    
    parser:  serialport.parsers.readline('\n'),
    
    // format should return a JSON structure.
    format: function(data) {
        console.log('FC Oled Backpack - format output');
        // Remove any carriage return
        data = data.replace('\n','');
        var fields = data.split(':');
        // Format is :V:A:
        return { "v": fields[3], "a": fields[4] };
    },
    
    // output should return a string, and is used to format
    // the data that is sent on the serial port, coming from the
    // HTML interface.
    output: function(data) {
        return data + '\n';
    }

};
