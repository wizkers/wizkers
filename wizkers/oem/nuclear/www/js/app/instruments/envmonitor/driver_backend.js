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
        var temperature = null;
        var rel_humidity = null;

        // Format is receiving JSON objects from the radiation sensor and the
        // Wind monitor
        // Notes: we aggregate everything and rate-limit based on the
        //        Radiation data which is slower
        //
        // Note (2): since we are receiving data from sub-drivers, we are
        //           also going to receive their status messages here.
        var format = function (data) {
            if (data.wind) {
                wind = data.wind;
            }
            if (data.temperature) {
                // Note: WX sensors will normally send wind + temp + other
                // in the same packet.
                temperature = data.temperature;
            }
            if (data.rel_humidity) {
                rel_humidity = data.rel_humidity;
                return;
            }

            if (data.cpm) {
                data.wind = wind;
                if (temperature != null) data.temperature = temperature;
                if (rel_humidity != null) data.rel_humidity = rel_humidity;
                data.cpm.unit = "CPM";

                if (data.cpm2) {
                    data.cpm2.unit = "CPM";
                }
                self.trigger('data', data);
            } else {
                // If we are here, we just received mostly
                // either unexpected data packets, or status messages
                // (see Note 2 above). We want to forward those status
                // messages...
                if (data.openerror) {
                    // Got an open error on at least one of the two backend drivers: close everything
                    self.closePort();
                }

                self.trigger('data', data);
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

        // cb is important because ref is not passed by reference...
        var open_subDriver = function(ref, id, cb) {
            require(['app/models/instrument'], function (model) {
                var ins = new model.Instrument({
                    _id: id
                });
                ins.fetch({
                    success: function () {
                        instrumentManager.getBackendDriverFor(ins.get('type'), null , function(driver) {
                            ref = driver;
                            ref.on('data', format);
                            ref.openPort(id, ins.get('port'));
                            cb(ref);
                        });
                    }
                });
            });
        }

        var openPort_app = function(insid) {
            var ins = instrumentManager.getInstrument();
            var _gl = ins.get('geigerlink');
            var _wm = ins.get('windmonitor');
            open_subDriver(gl, _gl, function(ref) { gl = ref; });
            open_subDriver(rmy, _wm, function(ref) { rmy = ref;});
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
            console.log('Requesting to close the two backend instruments');

            port_close_requested = true;

            if (gl) {
                if (gl.off)
                    gl.off('data', format);
                else
                    gl.removeListener('data', format);
                gl.closePort();
            }

            if (rmy) {
                if (rmy.off)
                    rmy.off('data', format);
                else
                    rmy.removeListener('data', format)
                rmy.closePort();
            }

        }

        this.isOpen = function () {
            if (gl && rmy)
                return gl.isOpen() && rmy.isOpen();

            return false;
        }

        // We don't follow this for this driver, because we rely on two
        // underlying subdrivers and tracking is not that important.
        this.isOpenPending = function () {
            return false;
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