//
// A parser for my W433 Weather receiver. Totally custom design,
// but very important to me.


// This object contains two entries:
//  - The low level parser for the serial port driver
//  - The high level parser for incoming serial port data

var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort;

module.exports = {
    
    // Set a reference to the socket.io socket and port
    socket: null,
    recorder: null,
    
    setPortRef: function(s) {
    },
    setSocketRef: function(s) {
        this.socket = s;
    },
    setRecorderRef: function(s) {
        this.recorder = s;
    },


    
    sensor_types_tx3: ['temperature', '1', '2', '3', '4', '5', '6',
                        '7', '8', '9', '10', '11', '12', '13','humidity', '15'],

    
    setPortRef: function(s) {
    },
    setSocketRef: function(s) {
        this.socket = s;
    },


    // How the device is connected on the serial port            
    portSettings: {
            baudRate: 9600,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            parser: serialport.parsers.readline('\n'),
    },
    
    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    // This particular device does not support this concept, so we
    // always return the same ID
    sendUniqueID: function() {
        this.socket.emit('uniqueID','00000000 (n.a.)');
    },

        
    // format should emit a JSON structure.
    format: function(data, recording) {
        // Remove any carriage return
        data = data.replace('\n','');
        var res = {};
        
        res.raw = data;

        if (data.length == 12) {
            if (this.check_ok_tx3(data)) {
                res.reading_type = this.sensor_types_tx3[parseInt(data.substr(3,1),16)];
                res.sensor_address = parseInt(data.substr(4,2),16) & 0xFE;
                switch (res.reading_type) {
                    case 'temperature':
                        res.value = data.substr(6,3)/10-50;
                        break;
                    case 'humidity':
                        res.value = data.substr(6,3)/10;
                        break;
                }
            }
        }
        console.log(res);
        this.socket.emit('serialEvent',res);
    },
    
    // output should return a string, and is used to format
    // the data that is sent on the serial port, coming from the
    // HTML interface.
    output: function(data) {
        return data + '\n';
    },
    
    check_ok_tx3: function(data) {
        return true;
    },
    
    check_ok_tx19: function(data) {
        return true;
    },

};
