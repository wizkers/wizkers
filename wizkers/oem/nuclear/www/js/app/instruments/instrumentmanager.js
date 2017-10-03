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

/**
 *
 * The Instrument manager handles all interactions with the various instruments.
 *
 * The same file is used client-side and server-side, but some of the API only
 * makes sense client-side. This is a bit of a juggling act to avoid using two 90% similar
 * files in client and server sides (see at bottom in particular)
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

    var _ = require('underscore');

    // This works because of the way node and commonJS use 'require'
    // differently...
    if (typeof events == 'undefined') {
        var Backbone = require('backbone');
    }

    var InstrumentManager = function () {

        // current_instrument is a Backbone Model instance
        var current_instrument = null; // The instrument currently in use

        // Instruments supported in all runmodes:
        this.supportedInstruments = {
            "onyx": {
                name: "SafeCast Onyx",
                type: 'app/instruments/onyx/onyx',
                path: 'app/instruments/onyx',
                settings: null,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "usbgeiger": {
                name: "Medcom GeigerLink",
                type: 'app/instruments/usbgeiger/usb_geiger',
                path: 'app/instruments/usbgeiger',
                settings: null,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "sigma25": {
                name: "Kromek Sigma25",
                type: 'app/instruments/sigma25/sigma25',
                path: 'app/instruments/sigma25',
                settings: null,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "gammarae": {
                name: "RAE GammaRAE II",
                type: 'app/instruments/gammarae/gammarae',
                path: 'app/instruments/gammarae',
                settings: null,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "rmyoung": {
                name: "RM Young wind sensor",
                type: 'app/instruments/rmyoung/rmyoung',
                path: 'app/instruments/rmyoung',
                settings: null,
                connectionsettings: 'app/views/instrument/serialport'
            },
            'kestrel5': {
                name: 'Kestrel 5 series',
                type: 'app/instruments/kestrel5/kestrel5',
                path: 'app/instruments/kestrel5',
                settings: 'app/instruments/kestrel5/settings',
                connectionsettings: 'app/views/instrument/bluetooth',
                connectionfilter: ['03290000-eab4-dea1-b24e-44ec023874db']
            },
            'kestreldrop': {
                name: 'Kestrel Drop',
                type: 'app/instruments/kestreldrop/kestreldrop',
                path: 'app/instruments/kestreldrop',
                settings: 'app/instruments/kestrel5/settings',
                connectionsettings: 'app/views/instrument/bluetooth',
                connectionfilter: ['12630000-cc25-497d-9854-9b6c02c77054']
            },
            'blue_onyx': {
                name: 'Medcom Blue Onyx',
                type: 'app/instruments/blue_onyx/blue_onyx',
                path: 'app/instruments/blue_onyx',
                settings: 'app/instruments/blue_onyx/settings',
                connectionsettings: 'app/views/instrument/bluetooth'
            },
            'inspector_ble': {
                name: 'Medcom Inspector BLE',
                type: 'app/instruments/inspector_ble/inspector_ble',
                path: 'app/instruments/inspector_ble',
                settings: null,
                connectionsettings: 'app/views/instrument/bluetooth',
                connectionfilter: [ '39b31fec-b63a-4ef7-b163-a7317872007f']
            },
            'bgeigie': {
                name: 'Safecast bGeigie',
                type: 'app/instruments/bgeigie/bgeigie',
                path: 'app/instruments/bgeigie',
                settings: 'app/instruments/bgeigie/settings',
                connectionsettings: 'app/views/instrument/bluetooth',
                connectionfilter: ['ef080d8c-c3be-41ff-bd3f-05a5f4795d7f', '067978ac-b59f-4ec9-9c09-2ab6e5bdad0b']
            },
            'envmonitor': {
                name: "Radiation/Weather monitoring Station",
                type: 'app/instruments/envmonitor/envmonitor',
                path: 'app/instruments/envmonitor',
                settings: 'app/instruments/envmonitor/settings',
                connectionsettings: null
            }
        };

        if (false) {
            this.supportedInstruments["sample_instrument"] = {
                name: "Test dummy instrument",
                type: 'app/instruments/sample_instrument/sample_instrument',
                settings: 'app/instruments/sample_instrument/settings',
                connectionsettings: 'app/views/instrument/dummy'
            };
        }

        // The instruments below are only supported in Server runmode:
        if (vizapp.type == "server") {
            this.supportedInstruments["pitemp"] = {
                name: "Raspberry Pi built-in temperature",
                type: 'app/instruments/pitemp/pitemp',
                settings: null,
                connectionsettings: null
            };
            this.supportedInstruments["w433"] = {
                name: "LaCrosse 433MHz weather sensors",
                type: 'app/instruments/w433/w433',
                settings: null,
                connectionsettings: 'app/views/instrument/serialport'
            };
        }

        // The instruments below are supported in both Chrome and Cordova mode
        if (vizapp.type == 'chrome' || vizapp.type == 'cordova') {
        }


        /**
         * Get a backend driver for a given instrument type
         */
        this.getBackendDriverFor = function (instrument, arg, callback) {
            require([this.supportedInstruments[instrument].path + '/driver_backend'], function (driver) {
                callback(new driver(arg));
            });
        };

        /**
         * Get a view that renders the instrument-specific port settings.
         * @param {String}   instrument The instrument type (see supportedInstruments above)
         * @param {Object}   arg        Argument for the view
         * @param {Function} callback   Callback
         */
        this.getConnectionSettingsFor = function (instrument, arg, callback) {
            require([this.supportedInstruments[instrument].connectionsettings], function (view) {
                callback(new view(arg));
            });
        }

        /**
         * The optional extra settings in the "Instrument Details" view. These are settings
         * that are required to connect to the instrument.
         * @param {String}   instrument The instrument type
         * @param {Object}   arg        Argument to be passed at view creation
         * @param {Function} callback   Callback once the view is created
         */
        this.getInstrumentSettings = function (instrument, arg, callback) {
            if (this.supportedInstruments[instrument].settings != null)
                require([this.supportedInstruments[instrument].settings], function (view) {
                    callback(new view(arg));
                });
        }

        /**
         * Get the type of connection for a given instrument type. This is used by chromeSocket
         * to understand what connection type to query for a port list.
         * @param   {String} instrument Instrument type (see supportedInstruments above)
         * @returns {String} Connection settings.
         */
        this.getConnectionTypeFor = function (instrument) {
            if (this.supportedInstruments[instrument] == undefined)
                return '';
            return this.supportedInstruments[instrument].connectionsettings;
        }

        this.getConnectionFilterFor = function (instrument) {
            if (this.supportedInstruments[instrument] == undefined)
                return '';
            return this.supportedInstruments[instrument].connectionfilter;

        }

        this.clear = function () {
            current_instrument = null;
        }

        /**
         * Updates the current instrument references
         * @instrument is a Backbone model (already fetched)
         * This method is called from router.js
         */
        this.setInstrument = function (instrument, cb) {
            var self = this;
            var type = instrument.get('type');
            console.warn('Switching to instrument', type);
            for (var ins in this.supportedInstruments) {
                if (ins == type) {
                    // Dynamically load the instrument:
                    require([this.supportedInstruments[ins].type], function (instrumentObject) {
                        // Nifty: we extend our instrument manager with the methods of our instrument.
                        // (since all instruments support the same API, a change of instrument
                        // overrides the methods)
                        _.extend(self, new instrumentObject());
                        self.getDriver(function(driver) {
                            linkManager.setDriver(driver);
                            // Don't set ref to current instrument before the rest of the
                            // instrument manager is initialized!
                            current_instrument = instrument;
                            console.warn('Trigger instrumentChanged');
                            self.trigger('instrumentChanged'); // Tell views who rely on the instrument manager...
                            cb();
                        }, instrument); // this second argurment is only used by the s_level monitor
                                        // because the instrument ref is not updated yet at that point.
                    });
                }
            }
        }

        this.startUploader = function () {
            this.getUploader(function (ul) {
                linkManager.setUploader(ul);
            });
        }

        this.stopUploader = function () {
            this.getDriver(function(driver) {
                linkManager.setDriver(driver);
            });
        };

        // Get the currently loaded instrument
        this.getInstrument = function () {
            return current_instrument;
        }

    };

    // On server side, we use the Node eventing system, whereas on the
    // browser/app side, we use Bacbone's API:
    // We cannot use vizapp.type here because we can be in a case
    // where vizapp.type == 'server' and still use this file on
    // client side!
    if (typeof events == 'undefined') {
        // Add event management to our parser, from the Backbone.Events class:
        _.extend(InstrumentManager.prototype, Backbone.Events);
    } else {
        InstrumentManager.prototype.__proto__ = events.EventEmitter.prototype;
        InstrumentManager.prototype.trigger = InstrumentManager.prototype.emit;
    }

    return InstrumentManager;

});