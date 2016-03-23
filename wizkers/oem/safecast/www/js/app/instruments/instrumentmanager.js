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
 * This is the Safecast Drive version
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
            "bgeigie": {
                name: 'Safecast bGeigie',
                type: 'app/instruments/bgeigie/bgeigie',
                settings: 'app/instruments/bgeigie/settings',
                connectionsettings: 'app/views/instrument/bluetooth'
            },
            "onyx": {
                name: "Safecast Onyx",
                type: 'app/instruments/onyx/onyx',
                settings: null,
                connectionsettings: 'app/views/instrument/serialport'
            },
            'blue_onyx': {
                name: 'Medcom Blue Onyx',
                type: 'app/instruments/blue_onyx/blue_onyx',
                settings: 'app/instruments/blue_onyx/settings',
                connectionsettings: 'app/views/instrument/bluetooth'
            }
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

        this.clear = function () {
            current_instrument = null;
        }

        this.setInstrument = function (instrument, cb) {
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
                        cb();
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