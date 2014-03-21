/**
 * This serial lib simulates the behaviour of the node server socket
 * in the case of a Cordova application.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 *
 * Work in progress.
 */

define(function(require) {
    
    "use strict";
    
    var Backbone = require('backbone');

    var serialLib = function() {

        // Public methods

        // Same API as for the socket object... pretty basic implementation, I know
       this.emit = function(cmd, args) {
           switch (cmd) {
                   case 'portstatus':
                    portStatus(args);
                    break;
                   case 'openinstrument':
                    openPort(args);
                    break;
                   case 'closeinstrument':
                    closePort(args);
                    break;
                   case 'controllerCommand':
                    controllerCommand(args);
                    break;
                   case 'ports':
                    getPorts(args);
                    break;
                   case 'driver':
                    setDriver(args);
                    break;
                   default:
                    break;
           }
       };

       // Trick: 
       this.connect = function() {return this; };
        
        // Private methods / properties:

       var Debug = true;

       var portOpen = false;
       var self = this;
       var connectionId = -1;

       var data = ""; // Our reading buffer

        // From chrome developer API:
        function ab2str(buf) {
            return String.fromCharCode.apply(null, new Uint8Array(buf));
        };

        // Convert string to ArrayBuffer
        var str2ab=function(str) {
            var buf=new ArrayBuffer(str.length);
            var bufView=new Uint8Array(buf);
            for (var i=0; i<str.length; i++) {
                bufView[i]=str.charCodeAt(i);
            }
            return buf;
        };
        
        
    /*
        ---------- Hexdump utility for debugging ------------
    */
	function to_hex( number ) {
		var r = number.toString(16);
		if( r.length < 2 ) {
			return "0" + r;
		} else {
			return r;
		}
	};
	
	function dump_chunk( chunk ) {
		var dumped = "";
		
		for( var i = 0; i < 4; i++ ) {
			if( i < chunk.length ) {
				dumped += to_hex( chunk.charCodeAt( i ) );
			} else {
				dumped += "..";
			}
		}
		
		return dumped;
	};
	
	function dump_block( block ) {
		var dumped = "";
		
		var chunks = block.match( /[\s\S.]{1,4}/g );
		for( var i = 0; i < 4; i++ ) {
			if( i < chunks.length ) {
				dumped += dump_chunk( chunks[i] );
			} else {
				dumped += "........";
			}
			dumped += " ";
		}
		
		dumped += "    " + block.replace( /[\x00-\x1F]/g, "." );
		
		return dumped;
	};
	
	function dump( s ) {
		var dumped = "";
		
		var blocks = s.match( /[\s\S.]{1,16}/g );
		for( var block in blocks ) {
			dumped += dump_block( blocks[block] ) + "\n";
		}
		
		return dumped;
	};
        
    /*************************** End of utils ******************/
        
        
        
        // This is where we will hook up the serial parser - cordova version
        function setDriver(driver) {
            
        }
        
        function getPorts() {
            self.trigger('ports', ["OTG Serial"]);
        }
        
        function portStatus() {
           self.trigger('status', {portopen: self.portOpen});
       };

        function openPort(port) {
            console.log("chromeSerialLib: openPort");
            serial.requestPermission(
                function(success) {
                    serial.open(
                                {"baudRate": 38400}, // pay attention to capital R and lowercase b ...
                                onOpen,
                                function(error) { alert("serial.open error: " + error); }
                               );
                },
                function(error) {
                    alert("chromeSerialLib: requestPermission error: " + error);
                }
            );        
       };

        function serialEvent(data) {
           // console.log('Raw input:\n' + data);
           self.trigger('serialEvent', data);
        }

        // Our Cordova serial plugin is not event-driven (yet), which means
        // that we have to call read continously, which is pretty ugly and bad for
        // battery life...
        function onRead(readInfo) {
            // readInfo is an ArrayBuffer
            if (readInfo.byteLength == 0) {
                // Delay next attempt to read in order to avoid a fast loop
                setTimeout(function() {
                    serial.read(onRead);
                }, 100);
                return;
            }
            // Inspired by Node's serialport library, why reinvent the wheel:
            data += ab2str(readInfo);
            // Split collected data by delimiter
            var parts = data.split(';')
            data = parts.pop();
            parts.forEach(function (part, i, array) {
                serialEvent(part);
            });
            // Keep on reading.
            serial.read(onRead);
        };

        function onOpen(openInfo) {
            self.portOpen = true;
            self.trigger('status', {portopen: true} );
            // OK, so this is horrible: the Cordova serial plugin is not
            // event-driven, so we have to run a polling loop...
            //
            // Note that the plugin has a built-in 1000ms timeout on serial
            // reads
            serial.read(onRead);
        };

        function closePort(port) {
           console.log("cordovaSerialLib: closePort");
            serial.close( function(success) {
                self.portOpen = false;
                self.trigger('status', {portopen: false} );
                console.log("cordovaSerialLib: closePort success");
               }, function(error) {
                console.log("cordovaSerialLib: closePort error - " + error);
               }
                );
        };

        function controllerCommand(cmd) {
            if (self.portOpen)
                serial.write(cmd);
        };

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(serialLib.prototype, Backbone.Events);
    
    return new serialLib;
});
