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

"use strict"

var serialport = require('serialport'),
    dbs = require('../pouch-config'),
    events = require('events'),
    recorder = require('../recorder.js'),
    debug = require('debug')('wizkers:parsers:w433'),
    outputmanager = require('../outputs/outputmanager.js');

var W433 = function() {
    
    // Driver initialization
    events.EventEmitter.call(this);

    /////////
    // Public variables
    /////////

    this.name = "w433";
    
    /////////
    // Private variables
    /////////
    
    var port = null;
    var isopen = false;
    var instrumentid = null;
    var port_close_requested = false;
    var self = this;
    
    var instrument = null;
    var lastStamp = new Date().getTime();
    var prevRes = [];
    var sensor_types_tx3 = ['temperature', '1', '2', '3', '4', '5', '6',
                        '7', '8', '9', '10', '11', '12', '13','humidity', '15'];

    /////////
    // Private methods
    /////////

    var status = function(stat) {
        debug('Port status change', stat);
        isopen = stat.portopen;
        
        if (isopen) {
            // Should run any "onOpen" initialization routine here if
            // necessary.
        } else {
            // We remove the listener so that the serial port can be GC'ed
            if (port_close_requested) {
                port.removeListener('status', status);
                port_close_requested = false;
            }
        }
    };
    
    // How the device is connected on the serial port            
    var portSettings = function() {
        return  {
            baudRate: 9600,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            parser: serialport.parsers.readline('\n'),
        }
    };
    
    // format should emit a JSON structure.
    var format = function(data) {
        // Remove any carriage return
        data = data.replace('\n','');
        var res = {};
        var valid = false;
        
        res.raw = data;

        if (data.length == 12) {
            if (check_ok_tx3(data)) {
                valid = true;
                res.reading_type = sensor_types_tx3[parseInt(data.substr(3,1),16)];
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
            if (check_ok_tx19(data) ) {
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
                            var speed= parseInt(data.substr(8,2),16)*.1943;
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
        if ( (stamp-prevStamp) < 1500 ) {            
            // Loop in the last four measurements:
            for (var i = 0; i < prevRes.length; i++) {
                if ((stamp - prevRes[i].stamp) < 1500 &&
                    res.sensor_address == prevRes[i].res.sensor_address &&
                    res.sensor_type == prevRes[i].res.sensor_type &&
                    ((res.value == prevRes[i].res.value) || 
                     ((typeof(res.value) == "object") && (typeof(prevRes[i].value) == "object") &&
                       (res.value.dir == prevRes[i].value.dir) && (res.value.speed == prevRes[i].value.speed)
                     ))
                   )
                    return;
            }
        }
        
        // We have some sensors that interleave their burst: temp / humidity then temp/humidity
        // therefore we are going to keep the last six stamps
        prevRes.push({ stamp: stamp, res: res});
        if (prevRes.length > 6)
            prevRes = prevRes.slice(1);

        prevStamp = stamp;
        
        // Now: sensor addresses are all nice, but what we really want, is a sensor name: look up in our current
        // instrument whether we have a name for the sensor. If no name, use the address as the name.
        var name = instrument.metadata[res.sensor_address];
	    debug("Sensor name: " + name);
        if (name != undefined) {
            res.sensor_name = name;
        } else {
            instrument.metadata[res.sensor_address] = res.sensor_address;
            res.sensor_name = res.sensor_address;
	    dbs.instruments.get(instrument._id, function(err,result) {
		if (err) {
			debug("Error updating sensor name: " + err);
		}
		result.metadata[res.sensor_address] = res.sensor_address;
                dbs.instruments.put(result, function(err, result) {
			if (err)
				debug(err);
		});
	  });
        }
        
        // Last: smart detection of battery replacement. When a sensor gets a new battery, it will
        // send its data every 10 seconds for a while, so we can detect this. In the mean time, we can
        // also track a sensor that has gone stale for more than X minutes. If we have both a new sensor
        // within the last 5 minutes, and a sensor we have not seen for more than 5 minutes, then we will assume
        // that this sensor's battery got replaced, and we will rename it automatically.
        // Note: there is a chance that the new sensor gets the address of an existing
        // sensor, but there is nothing we can do about this, it is a shortcoming of the Lacross sensors.
        
        // TODO :-)
        
        // Send our response to the recorder and the output manager
        // as well (careful to use 'self' because we are called as a
        // callback from the serial port object, so we need to get the
        // scope from the closure, not the 'this' that will be the serial
        // port.
        self.emit('data',res);
        // Send our response to the recorder and the output manager
        // as well
        recorder.record(data);
        outputmanager.output(data);

    };
    
        /**
     * The following two subroutines check two things
     * 1) Checksum OK (simple sum of bytes in packet)
     * 2) Redundant information OK within packet (different in
     *    TX3 and TX19 sensors)
     **/
    
    var check_ok_tx3 = function(data) {
        var sum = 0;
        var s = data.split('');
        var chk = s.pop();
        var add = function(element) {
            sum += parseInt(element,16);
        }
        s.forEach(add);
        // debug(chk + " - " + sum%16);
        return (parseInt(chk,16) == sum%16) &&
            (data.substr(6,2) == data.substr(9,2));        
    };
    
    var check_ok_tx19 = function(data) {
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
    };



    /////////
    // Public API
    /////////
    
    // Creates and opens the connection to the instrument.
    // for all practical purposes, this is really the init method of the
    // driver
    this.openPort = function(id) {
        instrumentid = id;
        dbs.instruments.get(id, function(err,item) {
            port = new serialconnection(item.port, portSettings());
            port.on('data', format);
            port.on('status', status);
            // Save instrument contents:
            instrument = item;
            // Get the instrument's metadata too:
            if (instrument.metadata == null)
		          instrument.metadata = {};
        });
    }
    
    this.closePort = function(data) {
        // We need to remove all listeners otherwise the serial port
        // will never be GC'ed
        port.removeListener('data', format);
        port_close_requested = true;
        port.close();
    }
    
    this.isOpen = function() {
        return isopen;
    }

    this.getInstrumentId = function(format) {
        return instrumentid;
    };
    
    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    // This particular device does not support this concept, so we
    // always return the same ID
    this.sendUniqueID = function() {
        this.emit('data',{ uniqueID:'00000000 (n.a.)'});
    };

    this.isStreaming = function() {
        return true;
    };
    
    // period is in seconds
    // The sensor sends data by itself, so those functions are empty...
    this.startLiveStream = function(period) {
    };
    
    this.stopLiveStream = function(period) {
    };
        
    
    // output writes the data to
    // the port. For W433, it is not used since
    // our receivers don't listen to commands.
    this.output = function(data) {
        port.write(data + '\n');
    };
    
    
};

W433.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = W433;