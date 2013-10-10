// A parser for the Fried Circuits OLED Backpack


// This object contains two entries:
//  - The low level parser for the serial port driver
//  - The high level parser for incoming serial port data

var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort;

module.exports = {
    
    // Set a reference to the socket.io socket and port
    socket: null,
    
    setPortRef: function(s) {
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
            parser: serialport.parsers.readline('\n'),
    },
        
    // format should return a JSON structure.
    format: function(data) {
        // console.log('FC Oled Backpack - format output');
        // Remove any carriage return
        data = data.replace('\n','');
        var fields = data.split(':');
        // Format is :Vbus:Abus:Vload:Aload:
        // We only return the load values:
        var res = { "v": fields[3], "a": fields[4] };
        this.socket.emit('serialEvent',res);
    },
    
    // output should return a string, and is used to format
    // the data that is sent on the serial port, coming from the
    // HTML interface.
    output: function(data) {
        return data + '\n';
    }

};
