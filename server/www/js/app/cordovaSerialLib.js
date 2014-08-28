/**
 * This serial lib simulates the behaviour of the node server socket
 * in the case of a Cordova application.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 * One of the roles of this lib is also to act as a middleman for the
 * instrument driver: it receives data from the serial port, passes it to
 * the instrument driver parser, and whenever the parser sends data back, it
 * passes it to the intrument driver 'format' command.
 */

define(function(require) {
    
    "use strict";
    
    var Backbone = require('backbone');
    var Serialport = require('serialport');

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
                   case 'outputs':
                     setOutputs(args);
                     break;                    
                   default:
                    break;
            }
        };

        // Trick: 
        this.connect = function() {return this; };

        // Needs to be public (defined with this.) because
        // it is called from a callback
        this.driver = null;
        this.portOpen = false;
        this.portSettings  = null;

        // Private methods / properties:
        var Debug = true;
        var self = this;
        // Parser does not need to be public...
        var parser = null;

        // This is where we hook up the serial parser - cordova version
        function setDriver(driver) {
            console.log("Setting driver - should be " + driver);
            // We can use our instrumentManager to ask for the right driver
            // (in server-side mode, "driver" is passed as the driver name, we
            //  don't need it here!)
            instrumentManager.getBackendDriver(self, function(dr) {
                self.driver = dr;
                self.portSettings = self.driver.portSettings();
                parser = self.portSettings.parser;
            });
        }
        
        function setOutputs(outputs) {
            console.warn("[cordovaSerialLib] TODO: implement chrome-side output plugins");
        }


        // We support only one default port, the serial adapter
        // connected to the OTG cable.
        function getPorts() {
            self.trigger('ports', ["OTG Serial"]);
        }

        function portStatus() {
           self.trigger('status', {portopen: self.portOpen});
        };

        function openPort(port) {
            console.log("cordovaSerialLib: openPort");
            serial.requestPermission(
                function(success) {
                    serial.open(
                                {"baudRate": "" + self.portSettings.baudRate,
                                 "dataBits": "" + self.portSettings.dataBits,
                                 "dtr": self.portSettings.dtr }, // pay attention to capital R and lowercase b ...
                                onOpen,
                                function(error) { alert("serial.open error: " + error); }
                               );
                },
                function(error) {
                    alert("cordovaSerialLib: requestPermission error: " + error);
                }
            );        
        };

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
            
            // Pass this over to the parser.
            // the parser will trigger a "data" even when it is ready
            parser(self,readInfo);
            
            // Keep on reading.
            serial.read(onRead);
        };
        
        // Called by the parser whenever data is ready to be formatted
        // by our instrument driver
        function onDataReady(data) {
            self.driver.format(data);
        }

        function onOpen(openInfo) {
            self.portOpen = true;
            self.trigger('status', {portopen: true} );
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
                serial.write(self.driver.output(cmd));
        };
        
        // Now hook up our own event listeners:
        
        this.on('data', onDataReady);

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(serialLib.prototype, Backbone.Events);    
    return new serialLib;
    
});