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
                   case 'closeport':
                    closePort(args);
                    break;
                   case 'controllerCommand':
                    controllerCommand(args);
                    break;
                   case 'ports':
                    getPorts(args);
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
        
        function getPorts() {
            console.log("cordovaSerial: get list of ports");
            self.trigger('ports', ["simulated port"]);
        }        
        
        function portStatus() {
           console.log("chromeSerialLib: portStatus");
           self.trigger('status', {portopen: self.portOpen});
       };

        function openPort(port) {
            console.log("chromeSerialLib: openPort");
            serial.requestPermission(
                function(success) {
                    serial.open({baudrate: 38400},
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
                    // chrome.serial.read(connectionId, 256, onRead);
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
            // chrome.serial.read(connectionId, 256, onRead);
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
                console.log("cordovaSerialLib: closePort success");
               }, function(error) {
                console.log("cordovaSerialLib: closePort error - " + error);
               }
                );
        };

        function controllerCommand(cmd) {
            console.log("chromeSerialLib: sending command: " + cmd);
            if (connectionId == -1) {
                console.log("Trying to write on a closed port");
                self.portOpen = false;
                return;
            }
            // chrome.serial.write(connectionId,str2ab(cmd + "\n"), function(writeInfo) {
        };

        // Initialize the library:
        /*
            this.on('portstatus', portStatus);
            this.on('openport', openPort);
            this.on('closeport', closePort);
            this.on('ports', getPorts);
            this.on('controllercommand', controllerCommand);
        */

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(serialLib.prototype, Backbone.Events);
    
    return new serialLib;
});
