/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

define(function (require) {
    "use strict";

    var Backbone = require('backbone'),
        Serialport = require('serialport'), // Used for parsing only
        abutils = require('app/lib/abutils'),
        btleConnection = require('connections_btle');


    var parser = function (socket) {

        var self = this,
            socket = socket,
            streaming = true,
            port = null,
            port_close_requested = false,
            port_open_requested = false,
            isopen = false,
            parser = Serialport.parsers.readline('\n');

        var CUSTOM_SERVICE_UUID = 'ef080d8c-c3be-41ff-bd3f-05a5f4795d7f';
        var SERIAL_PORT_UUID = 'A1E8F5B1-696B-4E4C-87C6-69DFE0B0093B';


        /////////////
        // Private methods
        /////////////

        var portSettings = function () {
            return {
                service_uuid: CUSTOM_SERVICE_UUID,
                characteristic_uuid: SERIAL_PORT_UUID
            }
        };

        // Format can act on incoming data from the device, and then
        // forwards the data to the app through a 'data' event.
        var format = function (data) {
            if (!data.value) {
                console.log('No value received');
                return;
            }
            parser(self, data.value);
        };

        // Status returns an object that is concatenated with the
        // global server status
        var status = function (stat) {
            port_open_requested = false;
            console.log('Port status change', stat);
            if (stat.openerror) {
                // We could not open the port: warn through
                // a 'data' messages
                var resp = {
                    openerror: true
                };
                if (stat.reason != undefined)
                    resp.reason = stat.reason;
                if (stat.description != undefined)
                    resp.description = stat.description;
                self.trigger('data', resp);
                return;
            }
            if (stat.reconnecting != undefined) {
                // Forward the message to front-end
                self.trigger('data', {reconnecting:stat.reconnecting});
                return;
            }                
            isopen = stat.portopen;
            if (isopen && stat.services) {
                // Should run any "onOpen" initialization routine here if
                // necessary.
                console.log('We found those services', stat.services);
                // ToDo: depending on the services we found, we can subscribe
                // to different service/characteristic UUIDs so that we can support
                // multiple versions of the Bluetooth module.
                port.subscribe({
                    service_uuid: CUSTOM_SERVICE_UUID,
                    characteristic_uuid: SERIAL_PORT_UUID
                });

            } else {
                // We remove the listener so that the serial port can be GC'ed
                if (port_close_requested) {
                    port.off('status', stat);
                    port_close_requested = false;
                }
            }
        };


        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid) {
            port_open_requested = true;
            var ins = instrumentManager.getInstrument();
            port = new btleConnection(ins.get('port'), portSettings());
            port.open();
            port.on('data', format);
            port.on('status', status);

        };

        this.closePort = function (data) {
            // We need to remove all listeners otherwise the serial port
            // will never be GC'ed
            port.off('data', format);
            port_close_requested = true;
            port.close();
        }

        this.isOpen = function () {
            return isopen;
        }

        this.isOpenPending = function () {
            return port_open_requested;
        }

        this.getInstrumentId = function (arg) {};

        this.isStreaming = function () {
            return streaming;
        };

        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        // TODO: Returns the instrument GUID.
        this.sendUniqueID = function () {};

        // period in seconds
        this.startLiveStream = function (period) {};

        this.stopLiveStream = function (args) {};

        // output should return a string, and is used to format
        // the data that is sent on the serial port, coming from the
        // HTML interface.
        this.output = function (data) {
            //console.log('TX', data);
            port.write(data);
        };

        /**
         *This is called by the serial parser (see 'format' above)
         * {
         *      "dev":"air001",
         *      "id":"00000001",
         *      "msg":"dat",
         *      "gps": {
         *           "date":"2016112T9:7:11Z",
         *           "lat":"34.48264974",
         *           "lon":"136.16315104",
         *           "alt":5.38,
         *           "spd":0.16,
         *           "ang":295.18,
         *           "fix":true,
         *           "num":8},
         *       "gas": [
     *              {
     *                  "type":"NO2",
     *                  "hdr":0,
     *                  "pos":0,
     *                  "wrk":0.05,
     *                  "aux":0.06,
     *                  "ppb":-8.63,
     *                  "ppbFlt":-10.02,
     *                  "ids": { "wrk'":0, "aux'":1, "ppb'":2, "ppbFlt'":3 }
     *               },
     *               {
     *                  "type":"O3",
     *                  "hdr":0,
     *                  "pos":1,
     *                  "wrk":0.34,
     *                  "aux":0.34,
     *                  "ppb":-20.33,
     *                  "ppbFlt":-21.14,
     *                  "ids":{"wrk'":4,"aux'":5,"ppb'":6,"ppbFlt'":7}
     *               },
     *               {
     *                  "type":"CO",
     *                  "hdr":0,
     *                  "pos":2,
     *                  "wrk":4.84,
     *                  "aux":0.70,
     *                  "ppb":10132.05,
     *                  "ppbFlt":7675.84,
     *                  "ids":{"wrk'":8,"aux'":9,"ppb'":10,"ppbFlt'":11}
     *                },
     *                {
     *                  "type":"NO2",
     *                  "hdr":1,
     *                  "pos":0,
     *                  "wrk":0.28,
     *                  "aux":0.30,
     *                  "ppb":-48.25,
     *                  "ppbFlt":-21.35,
     *                  "ids":{"wrk'":12,"aux'":13,"ppb'":14,"ppbFlt'":15}
     *                 },
     *                 {
     *                      "type":"O3",
     *                      "hdr":1,
     *                      "pos":1,
     *                      "wrk":0.35,
     *                      "aux":0.36,
     *                      "ppb":14.22,
     *                      "ppbFlt":-2.22,
     *                      "ids":{"wrk'":16,"aux'":17,"ppb'":18,"ppbFlt'":19}
     *                  },
     *              ],
     *              "tmp": [
     *                  {
     *                      "hdr":0,
     *                      "val":14.24,
     *                      "valFlt":10.75,
     *                      "ids":{"val":24,"valFlt":25}
     *                   },
     *                   {
     *                      "hdr":1,
     *                      "val":13.79,
     *                      "valFlt":10.35,
     *                      "ids":{"val":26,"valFlt":27}
     *                    }
     *              ],
     *              "pm": [ 
     *                  {
     *                "pos":"norm",
     *                "pm1":0.21,
     *                "pm2_5":0.37,
     *                "pm10":1.52,
     *                "rate":3.08,
     *                "dt":118.18,
     *                "mtof1":23,
     *                "mtof3":28,
     *                "mtof5":39,
     *                "mtof7":49,
     *                "cnt":[584,44,33,11,5,2,0,2,1,0,0,1,0,0,0,0],
     *                "ids":{"pm1":29,"pm2_5":30,"pm10":31,"rate":32,"dt":33,"mtof1":34,"mtof3":35,"mtof5":36,"mtof7":37,
     *                        "cnt":[38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53]}
     *                        }
     *               ]
     *               }
         * 
         * 
         */
        this.onDataReady = function (data) {
            var fields;
            
            // Remove any carriage return
            data = data.replace('\r\n', '');
            
            try {
                fields = JSON.parse(data);
            } catch (e) {
                console.log("Could not parse JSON data:", e);
                console.log(data);
                return;
            }
            self.trigger('data', fields);
        };
    }

    _.extend(parser.prototype, Backbone.Events);
    return parser;
});