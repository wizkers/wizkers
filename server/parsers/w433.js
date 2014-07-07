/*
 * A parser for my W433 Weather receiver. Totally custom design,
 * but very important to me.
 *
 * Supports the TX3 sensors.
 *
 *
 * This object contains two entries:
 *  - The low level parser for the serial port driver
 *  - The high level parser for incoming serial port data
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

var serialport = require('serialport');

module.exports = {
    
    name: "w433",
    
    // Set a reference to the socket.io socket and port
    socket: null,
    recorder: null,
    instrument: null,
    streaming: false,
    
    setPortRef: function(s) {
    },
    setSocketRef: function(s) {
        this.socket = s;
    },
    setRecorderRef: function(s) {
        this.recorder = s;
    },
    setInstrumentRef: function(i) {
        this.instrument = i;
        console.log("W433: instrument reference passed, instrument data is: ");
        console.log(i.metadata);
	if (this.instrument.metadata == null)
		this.instrument.metadata = {};
    },

    
    lastStamp: new Date().getTime(),
    prevRes: [],
    
    sensor_types_tx3: ['temperature', '1', '2', '3', '4', '5', '6',
                        '7', '8', '9', '10', '11', '12', '13','humidity', '15'],

    
    setPortRef: function(s) {
    },
    setSocketRef: function(s) {
        this.socket = s;
    },


    // How the device is connected on the serial port            
    portSettings: function() {
        return  {
            baudRate: 9600,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            parser: serialport.parsers.readline('\n'),
        }
    },
    
    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    // This particular device does not support this concept, so we
    // always return the same ID
    sendUniqueID: function() {
        this.socket.emit('uniqueID','00000000 (n.a.)');
    },

    isStreaming: function() {
        return this.streaming;
    },
    
    // period is in seconds
    // The sensor sends data by itself, so those functions are empty...
    startLiveStream: function(period) {
        this.streaming = true;
    },
    
    stopLiveStream: function(period) {
        this.streaming = false;
    },

        
    // format should emit a JSON structure.
    format: function(data, recording) {
        // Remove any carriage return
        data = data.replace('\n','');
        var res = {};
        var valid = false;
        
        res.raw = data;

        if (data.length == 12) {
            if (this.check_ok_tx3(data)) {
                valid = true;
                res.reading_type = this.sensor_types_tx3[parseInt(data.substr(3,1),16)];
                res.sensor_address = parseInt(data.substr(4,2),16) & 0xFE;
                switch (res.reading_type) {
                    case 'temperature':
                        res.value = Math.round(data.substr(6,3)-500)/10;
                        res.unit = '°C';
                        break;
                    case 'humidity':
                        res.value = Math.round((data.substr(6,3)/10));
                        res.unit = '%RH';
                        break;
                }
            }
        } else if (data.length == 14) {
            if (this.check_ok_tx19(data) ) {
                valid = true;
                res.reading_type = parseInt(data.substr(3,1),16);
                res.sensor_address = parseInt(data.substr(4,2),16);
                var sensor_model = parseInt(data.substr(2,1),16);

                switch (res.reading_type) {
                        case 0:
                        case 4:
                            // Temperature - TX19 Supposed to measure -29.9 to +69.9 according to the doc
                            // Current formula is therefore possibly wrong...
                            if (sensor_model == 6 ) { res.value = Math.round(data.substr(8,3)-400)/10; }
                            if (sensor_model == 9 ) { res.value = Math.round(data.substr(8,3)-300)/10; }
                            res.reading_type = 'temperature';
                            res.unit = '°C';
                            break;
                        case 1:
                        case 5:
                            //Humidity
                            if (sensor_model == 6 ) { res.value = data.substr(8,3)/10; }
                            if (sensor_model == 9 ) { res.value = data.substr(8,2); }
                            res.reading_type = 'humidity';
                            res.unit = '%RH';
                        break;
                        case 3:
                        case 7:
                            // Wind -> we have two values here, so the result is a json structure
                            var direction = parseInt(data.substr(10,1),16)*22.5;
                            var speed = parseInt(data.substr(8,2),16)*.1943; // Sensor speed is in m/s, convert to knt
                            res.reading_type = 'wind';
                            res.value = { dir: direction, speed: speed};
                            res.unit = { dir: '°', speed:'knot'};
                        break;
                        case 0xb:
                        case 0xf:
                            // Wind - gust -> we have two values again
                            var dir = parseInt(data.substr(10,1),16)*22.5;
                            var speed= parseInt(data.substr(8,2),16)/10;
                            res.reading_type = 'wind-gust';
                            res.value = { dir: direction, speed: speed};
                            res.unit = { dir: '°', speed:'knot'};
                            /**
                            $direction = (hex substr $i,10,1)*22.5;
                            $type_txt = "wind-gust-dir";
                            $speed = (hex substr $i,8,2)/10;
                            $type_txt = "wind-gust";
                            **/
                        break;
                        case 2:
                        case 6:
                            // Rain - Unit is still unknown, mm probably ?
                            /**
                            $mmrain = hex substr $i,8,3;
                            $type_txt = "rain";
                            check_sensor_known($sensor_address,$type_txt);
                            $updatesensor_query->execute($mmrain,$sensor_address,$type_txt);
                            print " ($type_txt) - $mmrain";
                            **/
                        break;
                }                
            }
        }
        
        if (!valid) return; // No need to waste time if our data was invalid!
        
        // Sensors send data multiple times, so we are going to dedupe:
        // if we got exactly the same reading less than 1.5 second ago, then
        // discard it.
        var stamp = new Date().getTime();
        if ( (stamp-this.prevStamp) < 1500 ) {            
            // Loop in the last four measurements:
            for (var i = 0; i < this.prevRes.length; i++) {
                if ((stamp - this.prevRes[i].stamp) < 1500 &&
                    res.sensor_address == this.prevRes[i].res.sensor_address &&
                    res.sensor_type == this.prevRes[i].res.sensor_type
                   ) {
                    if (res.value == this.prevRes[i].res.value)
                        return;
                    if ((typeof(res.value) == "object") && (typeof(this.prevRes[i]) == "object")) {
                        console.log(res.value);
                        if ((res.value.dir == this.prevRes[i].value.dir) && (res.value.speed == this.prevRes[i].speed))
                            return;
                    }   
                }
            }
        }
        
        // We have some sensors that interleave their burst: temp / humidity then temp/humidity
        // therefore we are going to keep the last six stamps
        this.prevRes.push({ stamp: stamp, res: res});
        if (this.prevRes.length > 6)
            this.prevRes = this.prevRes.slice(1);

        this.prevStamp = stamp;
        
        // Now: sensor addresses are all nice, but what we really want, is a sensor name: look up in our current
        // instrument whether we have a name for the sensor. If no name, use the address as the name.
        var name = this.instrument.metadata[res.sensor_address];
        if (name != undefined) {
            res.sensor_name = name;
        } else {
            this.instrument.metadata[res.sensor_address] = res.sensor_address;
            this.instrument.markModified('metadata');
            res.sensor_name = res.sensor_address;
            this.instrument.save();
        }
        
        // Last: smart detection of battery replacement. When a sensor gets a new battery, it will
        // send its data every 10 seconds for a while, so we can detect this. In the mean time, we can
        // also track a sensor that has gone stale for more than X minutes. If we have both a new sensor
        // within the last 5 minutes, and a sensor we have not seen for more than 5 minutes, then we will assume
        // that this sensor's battery got replaced, and we will rename it automatically.
        // Note: there is a chance that the new sensor gets the address of an existing
        // sensor, but there is nothing we can do about this, it is a shortcoming of the Lacross sensors.
        
        // TODO :-)
        
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
        // console.log(chk + " - " + sum%16);
        return (parseInt(chk,16) == sum%16) &&
            (data.substr(6,2) == data.substr(9,2));        
    },
    
    check_ok_tx19: function(data) {
        var sum = 0;
        var s = data.split('');
        var chk = s.pop();
        var add = function(element) {
            sum += parseInt(element,16);
        }
        s.forEach(add);
        var v1 = parseInt(data.substr(8,2),16);
        var v2 = ~(parseInt(data.substr(11,2),16))  & 0xff;
        return (parseInt(chk,16) == sum%16) &&
            (v1 == v2);
    },

};
