/**
 * This serial lib simulates the behaviour of the node server socket
 * in the case of a Chrome packaged application.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 * One of the roles of this lib is also to act as a middleman for the
 * instrument driver: it receives data from the serial port, passes it to
 * the instrument driver parser, and whenever the parser sends data back, it
 * passes it to the intrument driver 'format' command.
 */

define(function(require) {
    
    "use strict";
    
    var Backbone = require('backbone');
    var Serialport = require('serialport');
    var DeviceLog = require('app/models/devicelog');

    var serialLib = function() {

        // Public methods

        // Same API as for the socket object... pretty basic implementation, I know
        this.emit = function(cmd, args) {
            switch (cmd) {
                   case 'portstatus':
                    portStatus(args);
                    break;
                   case 'uniqueID':
                    uniqueID(args);
                    break;
                   case 'openinstrument':
                    openInstrument(args);
                    break;
                   case 'closeinstrument':
                    closeInstrument(args);
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
                   case 'startrecording':
                    startRecording(args);
                    break;
                   case 'stoprecording':
                    stopRecording(args);
                    break;
                   case 'startlivestream':
                    startLiveStream(args);
                    break;
                   case 'stoplivestream':
                    stopLiveStream(args);
                    break;
                   default:
                    break;
            }
        };

        // Trick: 
        this.connect = function() {return this; };
        
        /////////////
        // Recorder API (public)
        /////////////
        this.record = function(data) {
            // console.log("Recording " + data);
            var entry = new DeviceLog.LogEntry({
                timestamp: new Date().getTime(),
                logsessionid: currentLog.id,
                data: data
            });
            currentLog.entries.add(entry);
            entry.save();
        }

        // Needs to be public (defined with this.) because
        // it is called from a callback
        this.driver = null;
        this.portOpen = false;
        this.portSettings  = null;
        this.connectionId = null;

        // Private methods / properties:
        var Debug = true;
        var recording = false;
        var currentLog = null;
        var self = this;
        // Parser does not need to be public...
        var parser = null;
        
        // Utility function (chrome serial wants array buffers for sending)
        // Convert string to ArrayBuffer
        function str2ab(str) {
            var buf=new ArrayBuffer(str.length);
            var bufView=new Uint8Array(buf);
            for (var i=0; i<str.length; i++) {
                bufView[i]=str.charCodeAt(i);
            }
            return buf;
        };

        function ab2str(buf) {
            return String.fromCharCode.apply(null, new Uint8Array(buf));
        };
        
        
        //////////////
        //
        //   Implementation of socket API
        //
        //////////////
        
        // We defer to our instrument driver for the actual live streaming
        // method:
        function startLiveStream(args) {
            if (self.driver.startLiveStream)
                self.driver.startLiveStream(args);            
        };
        
        function stopLiveStream(args) {
            if (self.driver.stopLiveStream)
                self.driver.stopLiveStream(args);            
        };
        
        function portStatus() {
           self.trigger('status', {portopen: self.portOpen, recording: recording, streaming: self.driver ? self.driver.isStreaming() : false});
        };
        
        function uniqueID() {
            console.log('[chromeSerialLib] Requesting UniqueID to device driver');
            self.driver.sendUniqueID();
        };

        // This is where we hook up the serial parser - Chrome version
        function setDriver(driver) {
            console.log("[chromeSerialLib] Setting driver - should be " + driver);
            
            // We can use our instrumentManager to ask for the right driver
            // (in server-side mode, "driver" is passed as the driver name, we
            //  don't need it here)
            instrumentManager.getBackendDriver(self, function(dr) {
                self.driver = dr;
                self.portSettings = self.driver.portSettings();
                parser = self.portSettings.parser;
            });
        }
        
        function setOutputs(outputs) {
            // Pass on to the output manager who knows best
            outputManager.enableOutputs(outputs);
        }
        
        function openInstrument(port) {
            console.log("[chromeSerialLib] chromeSerialLib: openInstrument");
            var path = instrumentManager.getInstrument().get("port");
            // TODO: support other data bit and stop bit lengths 
            chrome.serial.connect(path, { bitrate: self.portSettings.baudRate,
                                        },
                                  onOpen
                                 );        
        };

        function closeInstrument(port) {
           console.log("[chromeSerialLib] chromeSerialLib: closeInstrument");
            if (!self.portOpen)
                return;
            
            // Important: remove the listener that gets incoming data, otherwise
            // at the next open we'll add a new listener and it will mess everything
            // up.
            //
            // Moreover: we have to remove the listener before closing the device, because
            // on the Mac (2014.06) this causes a hard reboot about 50% of the time, whenever
            // serial data arrives after disconnect - not 100% clean on origin.
            chrome.serial.onReceive.removeListener(onRead);

            stopRecording();
            stopLiveStream();
            chrome.serial.disconnect( self.connectionId, function(success) {
                self.portOpen = false;
                portStatus();
                if (self.driver.onClose) {
                    self.driver.onClose();
                }
                console.log("[chromeSerialLib] chromeSerialLib: closePort success");
               }
            );
        };

        function controllerCommand(cmd) {
            if (!self.portOpen || cmd == '')
                return;
            chrome.serial.send(self.connectionId, str2ab(self.driver.output(cmd)), function() {});
        };

        // We support only one default port, the serial adapter
        // connected to the OTG cable.
        function getPorts() {
            chrome.serial.getDevices(onGetDevices);
        }
        
        
        // When called, id refers to a new log that got created by the home view
        // just before.
        function startRecording(id) {
            console.log("[chromeSerialLib] In-browser implementation of start recording");
            currentLog = instrumentManager.getInstrument().logs.get(id);
            currentLog.fetch({success: function(){
                recording = true;
            } });
        }
        
        function stopRecording() {
            console.log("[chromeSerialLib] In-browser implementation of stop recording");
            recording = false;
        }
                
        /////////////
        //   Callbacks below
        /////////////
        
        function onGetDevices(ports) {
            var portlist = [];
            for (var i=0; i< ports.length; i++) {
                portlist.push(ports[i].path);
            }
            self.trigger('ports', portlist);
        }

        // This gets called whenever something is ready on the serial port
        function onRead(readInfo) {
            if (readInfo.connectionId == self.connectionId && readInfo.data) {
                // Pass this over to the parser.
                // the parser will trigger a "data" even when it is ready
                //console.log("R: " + ab2str(readInfo.data));
                parser(self,readInfo.data);
            }
        };
        
        // Called by the parser whenever data is ready to be formatted
        // by our instrument driver
        function onDataReady(data) {            
            // 'format' triggers a serialEvent when ready
            self.driver.format(data, recording);
        }

        function onOpen(openInfo) {
            if (!openInfo) {
                console.log("[chromeSerialLib] Open Failed");
                return;
            }
            self.portOpen = true;
            self.connectionId = openInfo.connectionId;
            portStatus();
            chrome.serial.onReceive.addListener(onRead);

        };
        
        // Now hook up our own event listeners:
        this.on('data', onDataReady);
        
        console.log("[chromeSerialLib] ***********************  Chrome Serial Library loaded **********************");

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(serialLib.prototype, Backbone.Events);    
    return new serialLib;
    f
});