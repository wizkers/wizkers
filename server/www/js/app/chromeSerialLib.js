/**
 * This serial lib simulates the behaviour of the node server socket
 * in the case of a chrome application.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 *
 * Work in progress.
 */


var chromeSerialLib = function() {

    // Public methods
    
    // Same API as for the socket object... pretty basic implementation, I know
   this.emit = function(cmd, args) {
       switch (cmd) {
               case 'portstatus':
                portStatus(args);
                break;
               case 'openport':
                openPort(args);
                break;
               case 'closeport':
                closePort(args);
                break;
               case 'controllerCommand':
                controllerCommand(args);
                break;
               default:
                break;
       }
   };
    
    // Private methods / properties:
    
    
   var Debug = true;
    
   var portOpen = false;
   var self = this;
   var connectionId = -1;
    
   var data = ""; // Our reading buffer
        
    // From chrome developer API:
    function ab2str(buf) {
        return String.fromCharCode.apply(null, new Uint8Array(buf));
    }

    // Convert string to ArrayBuffer
    var str2ab=function(str) {
        var buf=new ArrayBuffer(str.length);
        var bufView=new Uint8Array(buf);
        for (var i=0; i<str.length; i++) {
            bufView[i]=str.charCodeAt(i);
        }
        return buf;
    }    
    

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
	
    
    /*
      -------------------------------------
      */
    
    
   function portStatus() {
       console.log("chromeSerialLib: portStatus");
       self.trigger('status', {portopen: self.portOpen});
   };
    
   function openPort(port) {
       console.log("chromeSerialLib: openPort");
       chrome.serial.open(port, { bitrate: 115200}, onOpen);
   };
    
    function serialEvent(data) {
       var cmd = data.split('\n\r\n')[0];
       if (Debug) console.log('Raw input:\n' + dump(data));
       if (cmd == "LOGXFER") {
           // The result should be data in JSON format: attempt to parse right now
           // and transfer as a log rather than raw:
           try {
              //data  = data.replace(/\r$/gm,'');
              //data  = data.replace(/\n$/gm,'');
               var log = JSON.parse(data.substring(cmd.length+3));
               self.trigger('serialEvent', log);
           } catch (err) {
               console.log("Could not parse log packet\n" + err.message);
           }
       } else {
           var rawdata = data.substring(cmd.length+3);
           rawdata  = rawdata.replace(/\r\n$/gm,'');
           var raw = { cmd: cmd, raw: rawdata };
           self.trigger('serialEvent', raw);
       }
    
    }

    function onRead(readInfo) {
        if (readInfo.bytesRead == 0) {
            // Delay next attempt to read in order to avoid a fast loop
            setTimeout(function() {
                chrome.serial.read(connectionId, 256, onRead);
            }, 10);
            return;
        }
        // Inspired by Node's serialport library, why reinvent the wheel:
        data += ab2str(readInfo.data);
        // Split collected data by delimiter
        var parts = data.split('\r\n>')
        data = parts.pop();
        parts.forEach(function (part, i, array) {
            serialEvent(part);
        });
        // Keep on reading.
        chrome.serial.read(connectionId, 256, onRead);
    };

    
    function onOpen(openInfo) {
      connectionId = openInfo.connectionId;
      if (connectionId == -1) {
        self.portOpen = false;
        console.log('Could not open');
        return;
      }
      console.log("chromeSerialLib: Connected");
      self.portOpen = true;
      self.trigger('status', {portopen: true} );
      chrome.serial.read(connectionId, 256, onRead);
    };
    
    function closePort(port) {
       console.log("chromeSerialLib: closePort");
       if (connectionId == -1) {
           console.log('Port not open');
           return;
       }
       chrome.serial.close(connectionId, function(result) {
           if (result) {
               self.portOpen = false;
               portStatus();
           }
           
       });
    };
    
    
    function controllerCommand(cmd) {
        console.log("chromeSerialLib: sending command: " + cmd);
        if (connectionId == -1) {
            console.log("Trying to write on a closed port");
            self.portOpen = false;
            return;
        }
        chrome.serial.write(connectionId,str2ab(cmd + "\n"), function(writeInfo) {
        });
    };
            
    
    // Initialize the library:
    this.on('portstatus', portStatus);
    this.on('openport', openPort);
    this.on('closeport', closePort);
    this.on('controllercommand', controllerCommand);

    
}


// Add event management to our serial lib, from the Backbone.Events class:
_.extend(chromeSerialLib.prototype, Backbone.Events);
