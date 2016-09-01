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
            timer = setInterval(output_random_data, 800);
            this.trigger('status', {
                    portopen: true
                });
        }

        ///////////
        // Private methods and variables
        ///////////
        var output_random_data = function() {
            self.trigger('data',
                { value: Math.random()*100,
                    value2: Math.random()*10
                 });
        };


        /////////////
        //   Callbacks
        /////////////

    };

    // Add event management to our serial lib, from the Backbone.Events class:
    _.extend(dummyConnection.prototype, Backbone.Events);
    return dummyConnection;
});