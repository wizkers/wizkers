//
// A parser for my W433 Weather receiver. Totally custom design,
// but very important to me.


// This object contains two entries:
//  - The low level parser for the serial port driver
//  - The high level parser for incoming serial port data

var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort;

module.exports = {
    
    name: "w433",
    
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
    
    lastStamp: new Date().getTime(),
    prevRes: null,
    
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
                        res.value = (data.substr(6,3)/10-50).toFixed(1);
                        break;
                    case 'humidity':
                        res.value = (data.substr(6,3)/10).toFixed(0);
                        break;
                }
            }
        }
        // Sensors send data multiple times, so we are going to dedupe:
        // if we got exactly the same reading less than one second ago, then
        // discard it.
        if ( (new Date().getTime()-this.prevStamp) < 1000 && (JSON.stringify(res) == JSON.stringify(this.prevRes)))
            return;
        
        console.log(res);
        this.prevRes = res;
        this.prevStamp = new Date().getTime();
        
        this.recorder.record(res);
        this.socket.emit('serialEvent',res);
    },
    
    // output should return a string, and is used to format
    // the data that is sent on the serial port, coming from the
    // HTML interface.
    output: function(data) {
        return data + '\n';
    },
    
    
    /**
     * The following two subroutines check two things
     * 1) Checksum OK (simple sum of bytes in packet)
     * 2) Redundant information OK within packet (different in
     *    TX3 and TX19 sensors)
     **/
    
    check_ok_tx3: function(data) {
        var sum = 0;
        var s = data.split('');
        var chk = s.pop();
        var add = function(element) {
            sum += parseInt(element,16);
        }
        s.forEach(add);
        console.log(chk + " - " + sum%16);
        return (parseInt(chk,16) == sum%16) &&
            (data.substr(6,2) == data.substr(9,2));
        
        return true;
    },
    
    check_ok_tx19: function(data) {
        /**
           my $input = shift(@_);
   my $sum = 0;
   $chk = hex (chop $input);
   for( split(//,$input) ) { $sum += hex($_);}
   $sum=$sum%16;
   $v1 = hex substr $input,8,2;
   $v2 =  ~( hex substr $input,11,2) & 0xFF;
   return ($sum==$chk) && ($v1==$v2);

**/
        return true;
    },

};
