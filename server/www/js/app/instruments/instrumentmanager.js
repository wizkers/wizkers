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

    var OnyxInstrument = require('app/instruments/onyx/onyx'),
        OnyxSettingsView = require('app/instruments/onyx/settings');

    var FCOledInstrument = require('app/instruments/fcoledv1/fcoled'),
        FCOledSettingsView = require('app/instruments/fcoledv1/settings');

    var W433Instrument = require('app/instruments/w433/w433'),
        W433SettingsView = require('app/instruments/w433/settings');

    var ElecraftInstrument = require('app/instruments/elecraft/elecraft'),
        ElecraftSettingsView = require('app/instruments/elecraft/settings');

    var RemoteElecraftInstrument = require('app/instruments/elecraft_remote/elecraft_remote');

    var Fluke289Instrument = require('app/instruments/fluke28x/fluke'),
        Fluke289SettingsView = require('app/instruments/fluke28x/settings');

    var USBGeigerInstrument = require('app/instruments/usbgeiger/usb_geiger'),
        USBGeigerSettingsView = require('app/instruments/usbgeiger/settings');

    var HeliumGeigerInstrument = require('app/instruments/heliumgeiger/heliumgeiger'),
        HeliumGeigerSettingsView = require('app/instruments/heliumgeiger/settings');

    var HawkNestInstrument = require('app/instruments/hawknest/hawknest'),
        HawkNestSettingsView = require('app/instruments/hawknest/settings');

    var SimpleSerialInstrument = require('app/instruments/simple_serial/simple_serial'),
        SimpleSerialSettingsView = require('app/instruments/simple_serial/settings');

    var Sark110Instrument = require('app/instruments/sark110/sark110'),
        Sark110SettingsView = require('app/instruments/sark110/settings');

    var Sigma25Instrument = require('app/instruments/sigma25/sigma25'),
        Sigma25SettingsView = require('app/instruments/sigma25/settings');

    var BlueOnyxInstrument = require('app/instruments/blue_onyx/blue_onyx'),
        BlueOnyxSettingsView = require('app/instruments/blue_onyx/settings');

    var FCBTInstrument = require('app/instruments/fcbtusbv1/fcbtusbv1'),
        FCBTSettingsView = require('app/instruments/fcbtusbv1/settings');


    var InstrumentManager = function () {

        // current_instrument is a Backbone Model instance
        var current_instrument = null; // The instrument currently in use

        // Instruments supported in all runmodes:
        this.supportedInstruments = {
            "onyx": {
                name: "SafeCast Onyx",
                type: OnyxInstrument,
                settings: OnyxSettingsView,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "fcoledv1": {
                name: "Fried Circuits OLED backpack",
                type: FCOledInstrument,
                settings: FCOledSettingsView,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "elecraft": {
                name: "Elecraft radios",
                type: ElecraftInstrument,
                settings: ElecraftSettingsView,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "usbgeiger": {
                name: "USB Geiger",
                type: USBGeigerInstrument,
                settings: USBGeigerSettingsView,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "fluke28x": {
                name: "Fluke 287/289 Series multimeter",
                type: Fluke289Instrument,
                settings: Fluke289SettingsView,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "simple_serial": {
                name: "Simple serial terminal",
                type: SimpleSerialInstrument,
                settings: SimpleSerialSettingsView,
                connectionsettings: 'app/views/instrument/serialport'
            },
            "sigma25": {
                name: "Kromek Sigma25",
                type: Sigma25Instrument,
                settings: Sigma25SettingsView,
                connectionsettings: 'app/views/instrument/serialport'
            },
        };

        // The instruments below are only supported in Server runmode:
        if (vizapp.type == "server") {
            this.supportedInstruments["w433"] = {
                name: "Aerodynes W433 Weather receiver",
                type: W433Instrument,
                settings: W433SettingsView,
                connectionsettings: 'app/views/instrument/serialport'
            };
            this.supportedInstruments["heliumgeiger"] = {
                name: "Radius Hawk (Helium)",
                type: HeliumGeigerInstrument,
                settings: HeliumGeigerSettingsView,
                connectionsettings: 'app/views/instrument/helium'
            };
            this.supportedInstruments["hawknest"] = {
                name: "Hawk Nest (Pinocc.io)",
                type: HawkNestInstrument,
                settings: HawkNestSettingsView,
                connectionsettings: 'app/views/instrument/pinoccio'
            };
        }

        // The instruments below are only supported in Chrome runmode:
        if (vizapp.type == "chrome") {
            this.supportedInstruments["sark110"] = {
                name: "Sark110 Antenna Analyzer",
                type: Sark110Instrument,
                settings: Sark110SettingsView,
                connectionsettings: 'app/views/instrument/usbhid'
            };
            this.supportedInstruments["blue_onyx"] = {
                name: "Medcom Blue Onyx",
                type: BlueOnyxInstrument,
                settings: BlueOnyxSettingsView,
                connectionsettings: 'app/views/instrument/bluetooth'
            };
            this.supportedInstruments["fcbtusbv1"] = {
                name: "Fried Circuits Bluetooth backpack",
                type: FCBTInstrument,
                settings: FCBTSettingsView,
                connectionsettings: 'app/views/instrument/bluetooth'
            };
            this.supportedInstruments["elecraft_remote"] = {
                name: "Remote Elecraft KX3",
                type: RemoteElecraftInstrument,
                settings: ElecraftSettingsView,
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
            var type = instrument.get('type');
            for (var ins in this.supportedInstruments) {
                if (ins == type) {
                    current_instrument = instrument;
                    // Nifty: we extend our instrument manager with the methods of our instrument.
                    // (since all instruments support the same API, a change of instrument
                    // overrides the methods)
                    var instrumentObject = new this.supportedInstruments[ins].type;
                    _.extend(this, instrumentObject);
                    linkManager.setDriver(this.getDriver());

                    this.trigger('instrumentChanged'); // Tell views who rely on the instrument manager...
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