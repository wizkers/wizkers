/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/*
 * Driver for Environmental Monitor.
 *  This is a composite driver: it will in turn require
 *   a Radiation sensor driver, and a Weather station driver
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

// This detects whether we are in a server situation and act accordingly:
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
    var vizapp = { type: 'server'},
        events = require('events'),
        dbs = require('pouch-config');
}

define(function (require) {
    "use strict";

    var parser = function (socket) {

        /////////////
        // Private methods
        /////////////

        var socket = socket;

        var self = this,
            port_close_requested = false,
            port_open_requested = false,
            isopen = false;

        // Drivers for the GeigerLink and the RM Young wind monitor
        var gl  = null,
            rmy = null;

        var wind = {};

        // Format is receiving JSON objects from the GeigerLink and the
        // Wind monitor
        // Notes: we aggregate everything and rate-limit based on the
        //        GeigerLink data which is slower
        var format = function (data) {
            if (data.wind) {
                wind = data.wind;
                return;
            }
            if (data.cpm) {
                data.wind = wind;
                // We enrich the data with more details
                // on the sensors.
                // TODO: should maybe move this to instrument
                // settings to let people pick the channel
                // they want for each probe type?
                data.cpm.unit = "CPM";
                data.cpm.name = "Gamma - EC"

                if (data.cpm2) {
                    data.cpm2.unit = "CPM";
                    data.cpm2.name = "Beta/Gamma"
                }
                self.trigger('data', data);
            }
        };

        // Status returns an object that is concatenated with the
        // global server status
        var status = function (stat) {
            port_open_requested = false;
            console.log('C10 Probe - Port status change', stat);
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

            isopen = stat.portopen;

            if (isopen) {
                // Should run any "onOpen" initialization routine here if
                // necessary.
            } else {
                // We remove the listener so that the serial port can be GC'ed
                if (port_close_requested) {
                    if (port.off)
                        port.off('status', stat);
                    else
                        port.removeListener('status', status);
                    port_close_requested = false;
                }
            }
        };

        var openPort_server = function(insid) {
            dbs.instruments.get(insid, function(err,item) {

                // TODO: refactor this please!!!!
                // Note: we can't require the ConnectionManager upon
                // creation because it requires this driver_backend.js file,
                var ConnectionManager = require('connectionmanager');
                var connectionManager = new ConnectionManager();

                dbs.instruments.get(item.geigerlink, function(err,item2) {
                    dbs.instruments.get(item.windmonitor, function(err,item3) {
                        // Instanciate the two lower level drivers:
                        if (gl == null) {
                            gl = connectionManager.getDriver(item2.type);
                        } else {
                            // TODO: if user changes driver/instrument type, we will not
                            // reflect this properly!
                            console.log("Already have a driver for Radiation monitor");
                        }
                        gl.on('data', format);
                        // gl.on('status', status);
                        gl.openPort(item.geigerlink);

                        if (rmy == null) {
                            rmy = connectionManager.getDriver(item3.type);
                        } else {
                            console.log("Already have a driver for Wind monitor");
                        }
                        rmy.on('data', format);
                        // rmy.on('status', status);
                        rmy.openPort(item.windmonitor);

                    });
                });
            });
        };

        var openPort_app = function(insid) {
            // Note: we do not support C10 probes in app mode for now,
            // only in server mode.
        }

        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid) {
            port_open_requested = true;
            if (vizapp.type == 'server') {
                openPort_server(insid);
            } else {
                openPort_app(insid);
            }
        };

        this.closePort = function (data) {
            // We need to remove all listeners otherwise tons of stuff
            // will never be GC'ed
            debug('Requesting to close the two backend instruments');

            port_close_requested = true;

            if (gl) {
                gl.removeListener('data', format);
                gl.closePort();
            }

            if (rmy) {
                rmy.removeListener('data', format)
                rmy.closePort();
            }

        }

        this.isOpen = function () {
            if (gl && rmy)
                return gl.isOpen() && rmy.isOpen();

            return false;
        }

        this.isOpenPending = function () {
            return port_open_requested;
        }

        this.getInstrumentId = function (arg) {};

        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        // Returns the Geiger counter GUID.
        this.sendUniqueID = function () {
            self.trigger('data', {
                uniqueID: '00000000 (n.a.)'
            });
        };

        this.isStreaming = function () {
            return true;
        };


        // period in seconds
        this.startLiveStream = function (period) {};

        this.stopLiveStream = function (args) {};

        // output should return a string, and is used to format
        // the data that is sent on the serial port, coming from the
        // HTML interface.
        this.output = function (data) {
            if (data == "TAG") {
                self.trigger('data', {
                    devicetag: 'Not supported'
                });
            }
            port.write(data + '\n');
        };

    }

    // On server side, we use the Node eventing system, whereas on the
    // browser/app side, we use Bacbone's API:
    if (vizapp.type != 'server') {
        // Add event management to our parser, from the Backbone.Events class:
        _.extend(parser.prototype, Backbone.Events);
    } else {
        parser.prototype.__proto__ = events.EventEmitter.prototype;
        parser.prototype.trigger = parser.prototype.emit;
    }

    return parser;
});