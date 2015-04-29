/** (c) 2015 Edouard Lafargue, ed@lafargue.name
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
 * The connection manager is used only in Chrome or Cordova mode. It is a
 * client-side implementation of the same Connection Manager that is used
 * in server mode.
 */

define(function (require) {

    "use strict";

    var ConnectionManager = function (s) {

        /////
        // Private variables
        /////
        var openinstruments = {};
        var socket = s;

        /////
        // Public methods
        /////

        /**
         * Opens an instrument and sets up the instrument driver.
         * @param {String}   instrumentid The Instrument ID
         * @param {Function} callback     Callback with the driver reference
         * @param {Boolean}  uploader     'true' if we want to the firmware uploader, not the regular driver
         */
        this.openInstrument = function (instrumentid, callback, uploader) {
            console.log('Instrument open request for instrument ID ' + instrumentid);
            if (openinstruments.hasOwnProperty(instrumentid)) {
                console.log('That instrument is already loaded');
                var driver = openinstruments[instrumentid];
                // Maybe the instrument is loaded but the port is closed: test
                // and act accordingly
                if (!driver.isOpen()) {
                    driver.openPort(instrumentid);
                }
                // Return a pointer to the instrument's existing driver:
                callback(driver);
            } else {
                // Create the relevant driver for the instrument, and ask to
                // open it:
                var open_cb = function (driver) {
                    if (driver == undefined) {
                        // Something is very wrong here!
                        debug('Was asked to open an instrument with unknown driver');
                        return;
                    }
                    openinstruments[instrumentid] = driver;
                    // Now ask the instrument to open its port
                    driver.openPort(instrumentid);
                    console.log('Instrument is opening');
                    callback(driver);
                };

                if (uploader) {
                    instrumentManager.getBackendUploaderDriver(socket, open_cb);
                } else {
                    instrumentManager.getBackendDriver(socket, open_cb);
                }
            }
        }


        /**
         * Check if an instrument is open
         */
        this.isOpen = function () {
            return openinstruments.hasOwnProperty(instrumentid);
        };

        /**
         * Close an instrument.
         *
         * Question: shall it use a callback object called after successful instrument
         * closure ?
         */
        this.closeInstrument = function (instrumentid) {
            var driver = openinstruments[instrumentid];

            if (driver == undefined || driver == null) {
                // Still, we want to remove the key
                if (openinstruments.hasOwnProperty(instrumentid))
                    delete openinstruments[instrumentid];
                return;
            }
            // Ask the driver to close its port:
            driver.closePort();
            delete openinstruments[instrumentid];
        }

    }

    return ConnectionManager;

});