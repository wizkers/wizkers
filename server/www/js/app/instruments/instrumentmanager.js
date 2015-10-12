/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 *
 * The Instrument manager handles all interactions with the various instruments.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {

    "use strict";

    var _ = require('underscore'),
        Backbone = require('backbone'),
        Instrument = require(['app/models/instrument']);

    var InstrumentManager = function () {

        // current_instrument is a Backbone Model instance
        var current_instrument = null; // The instrument currently in use

        // Instruments supported in all runmodes:
        this.supportedInstruments = {
            "onyx": {
                name: "SafeCast Onyx",
                type: 'app/instruments/onyx/onyx',
                settings: null,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "fcoledv1": {
                name: "Fried Circuits OLED backpack",
                type: 'app/instruments/fcoledv1/fcoled',
                settings: null,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "elecraft": {
                name: "Elecraft KX3",
                type: 'app/instruments/elecraft/elecraft',
                settings: 'app/instruments/elecraft/settings',
                connectionsettings: 'app/views/instrument/serialport'
            },
            "usbgeiger": {
                name: "USB Geiger",
                type: 'app/instruments/usbgeiger/usb_geiger',
                settings: null,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "fluke28x": {
                name: "Fluke 287/289 Series multimeter",
                type: 'app/instruments/fluke28x/fluke',
                settings: null,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "simple_serial": {
                name: "Simple serial terminal",
                type: 'app/instruments/simple_serial/simple_serial',
                settings: 'app/instruments/simple_serial/settings',
                connectionsettings: 'app/views/instrument/serialport'
            },
            "sigma25": {
                name: "Kromek Sigma25",
                type: 'app/instruments/sigma25/sigma25',
                settings: null,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "powerlog_1": {
                name: "PowerCost Monitor",
                type: 'app/instruments/powerlog_1/powerlog_1',
                settings: null,
                connectionsettings: 'app/views/instrument/serialport'
            }
        };

        // The instruments below are only supported in Server runmode:
        if (vizapp.type == "server") {
            this.supportedInstruments["w433"] = {
                name: "Aerodynes W433 Weather receiver",
                type: 'app/instruments/w433/w433',
                settings: 'app/instruments/w433/settings',
                connectionsettings: 'app/views/instrument/serialport'
            };
            this.supportedInstruments["heliumgeiger"] = {
                name: "Radius Hawk (Helium)",
                type: 'app/instruments/heliumgeiger/heliumgeiger',
                settings: null,
                connectionsettings: 'app/views/instrument/helium'
            };
            this.supportedInstruments["hawknest"] = {
                name: "Hawk Nest (Pinocc.io)",
                type: 'app/instruments/hawknest/hawknest',
                settings: null,
                connectionsettings: 'app/views/instrument/pinoccio'
            };
        }

        // The instruments below are supported in both Chrome and Cordova mode
        if (vizapp.type == 'chrome' || vizapp.type == 'cordova') {
            this.supportedInstruments['blue_onyx'] = {
                name: 'Medcom Blue Onyx',
                type: 'app/instruments/blue_onyx/blue_onyx',
                settings: null,
                connectionsettings: 'app/views/instrument/bluetooth'
            };
            this.supportedInstruments['fcbtusbv1'] = {
                name: 'Fried Circuits Bluetooth backpack',
                type: 'app/instruments/fcbtusbv1/fcbtusbv1',
                settings: null,
                connectionsettings: 'app/views/instrument/bluetooth'
            };
            this.supportedInstruments['bgeigie'] = {
                name: 'Safecast bGeigie',
                type: 'app/instruments/bgeigie/bgeigie',
                settings: null,
                connectionsettings: 'app/views/instrument/bluetooth'
            };
        }

        // The instruments below are only supported in Chrome runmode:
        if (vizapp.type == 'chrome') {
            this.supportedInstruments['sark110'] = {
                name: 'Sark110 Antenna Analyzer',
                type: 'app/instruments/sark110/sark110',
                settings: 'app/instruments/sark110/settings',
                connectionsettings: 'app/views/instrument/usbhid'
            };
            this.supportedInstruments['elecraft_remote'] = {
                name: 'Remote Elecraft KX3',
                type: 'app/instruments/elecraft_remote/elecraft_remote',
                settings: 'app/instruments/elecraft_remote/settings',
                connectionsettings: 'app/views/instrument/webrtc'
            };
        }

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

        this.clear = function () {
            current_instrument = null;
        }

        this.setInstrument = function (instrument) {
            var self = this;
            var type = instrument.get('type');
            for (var ins in this.supportedInstruments) {
                if (ins == type) {
                    current_instrument = instrument;
                    // Dynamically load the instrument:
                    require([this.supportedInstruments[ins].type], function (instrumentObject) {
                        // Nifty: we extend our instrument manager with the methods of our instrument.
                        // (since all instruments support the same API, a change of instrument
                        // overrides the methods)
                        _.extend(self, new instrumentObject());
                        linkManager.setDriver(self.getDriver());
                        self.trigger('instrumentChanged'); // Tell views who rely on the instrument manager...
                    });
                }
            }
        }

        this.startUploader = function () {
            linkManager.setUploader(this.getUploader());
        }

        this.stopUploader = function () {
            linkManager.setDriver(this.getDriver());
        };

        // Get the currently loaded instrument
        this.getInstrument = function () {
            return current_instrument;
        }

    };

    _.extend(InstrumentManager.prototype, Backbone.Events);

    return InstrumentManager;

});