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
 * The connection manager is used only in Chrome or Cordova mode. It is a
 * client-side implementation of the same Connection Manager that is used
 * in server mode.
 */

define(function (require) {

    "use strict";
    var Backbone = require('backbone');

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


    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(ConnectionManager.prototype, Backbone.Events);
    return ConnectionManager;

});