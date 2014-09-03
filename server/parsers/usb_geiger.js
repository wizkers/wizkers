/*
 * A parser for the Medcom USB Geiger dongle
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort,
    recorder = require('../recorder.js'),
    outputmanager = require('../outputs/outputmanager.js');

module.exports = {
    
    name: "usbgeiger",
    
    // Set a reference to the socket.io socket and port
    socket: null,
    port: null,
    uidrequested: false,
    streaming: true,  // The dongle always streams data
    livePoller: null,
    
    setPortRef: function(s) {
        this.port = s;
    },
    setSocketRef: function(s) {
        this.socket = s;
    },
    setRecorderRef: function(s) {
        console.log("DELETE THIS Setting recorder reference.");
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
            parser: serialport.parsers.readline('\r\n'),
        }
    },
    
    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    // This particular device does not support this concept, so we
    // always return the same
    sendUniqueID: function() {
        this.uidrequested = true;
        
        // TODO: implement serial number query here
        this.socket.emit('uniqueID','00000000 (n.a.)');

    },
    
    isStreaming: function() {
        return this.streaming;
    },
    
    // This dongle always outputs CPM value on the serial port
    startLiveStream: function(period) {
        this.streaming = true;
    },
    
    // Even though we ask to stop streaming, the dongle will still
    // stream.
    stopLiveStream: function(period) {
        this.streaming = true;
    },
    
    format: function(data, recording) {
        // All commands now return JSON
        try {
            //console.log(Hexdump.dump(data.substr(0,5)));
            if (data.length < 2)
                return;
            
            // We are going to format the output in a manner similar
            // to the Onyx data output format, so that we can reuse the
            // same visualisation plugins for both.
            var resp = data.split(':');
            var jsresp = {};
            if (resp[0] == "CPM") {
                jsresp.cpm = { value: resp[1] };
            } else {
                jsresp.raw = data;
            }
            
            // Send the response to the front-end
            this.socket.emit('serialEvent', jsresp);
            // Send our response to the recorder and the output manager
            // as well
            recorder.record(jsresp);
            outputmanager.output(jsresp);
        } catch (err) {
            console.log('Not able to parse data from device:\n' + data);
            console.log('Error code: ' + err);
        }
    },
    
    output: function(data) {
        return data + '\n\n';
    }

};
