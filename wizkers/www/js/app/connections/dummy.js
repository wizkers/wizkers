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
 *  Dummy connection
 *
 * Opens at create, sends 'data' events,
 * and 'status' events.
 *
 * Supports a "write" method.
 */

define(function (require) {

    "use strict";

    var Backbone = require('backbone'),
        abu = require('app/lib/abutils');

    var dummyConnection = function (path, settings) {

        /////////
        // Initialization
        /////////

        var portOpen = false,
            self = this,
            timer = null;

        ///////////
        // Public methods
        ///////////

        /**
         * Send data to the serial port.
         * cmd has to be either a String or an ArrayBuffer
         * @param {ArrayBuffer} cmd The command, already formatted for sending.
         */
        this.write = function (cmd) {
        };


        this.close = function (port) {
            console.log("[dummyConnection] close");
            if (timer) {
                clearInterval(timer);
                timer = null;
            }

            this.trigger('status', {
                    portopen: false
                });
        };

        // We support only one default port, the serial adapter
        // connected to the OTG cable.
        this.getPorts = function () {
        }

        // Has to be called by the backend_driver to actually open the port.
        this.open = function () {
            timer = setInterval(output_random_data, 1000);
            this.trigger('status', {
                    portopen: true
                });
        }

        ///////////
        // Private methods and variables
        ///////////
        var output_random_data = function() {
            self.trigger('data',
                { value: Math.random()*100 });
        };
    

        /////////////
        //   Callbacks
        /////////////

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(dummyConnection.prototype, Backbone.Events);
    return dummyConnection;
});