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
 * The controller communication manager:
 *  - provides API to the backend device to use by views
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";


    // linkManager is a reference to the parent link manager
    return function () {

        var self = this;
        var lm = linkManager;
        var streaming = false;
        var streamingText = false;
        var livePoller = null; // Reference to the timer for live streaming
        var textPoller = null; // This is a poller to read from the radio TB buffer.

        //////
        //  Standard API:
        // All link managers need this function:
        //////
        this.getBackendDriverName = function () {
            return 'yaesu';
        }

        //////
        // End of standard API
        //////

        //////
        // Common Radio instrument API
        /////

        // Should accept both a number in MHz or a 11-digit
        // frequency formatted string in Hz.
        // This helps because Javascript's floats have IEEE precision
        // issues leading to rounding errors...
        this.setVFO = function (f, vfo) {
            lm.sendCommand({ command: 'set_frequency',
                             arg: f});
        };

        this.getMode = this.getVFO = function() {
            lm.sendCommand({ command: 'get_frequency'
                             });
        };

        this.setMode = function(mode) {
            lm.sendCommand({ command: 'set_mode',
                              arg: mode});
        };

        /**
         * Returns a list of all modes supported by the radio
         */
        this.getModes = function() {
            return [ "LSB", "USB", "CW", "CWR", "AM", "WFM", "FM", "DIG", "PKT" ];
        };

        /**
         * if key = true, they transmit
         */
        this.ptt = function(key) {
            lm.sendCommand({ command: 'ptt',
                                arg: key});
        };

        this.getSmeter = function() {
            // S-Meter data is in the response of that one
            lm.sendCommand({ command: 'txrx_status'});
        }

        // All commands below are fully free and depend on
        // the instrument's capabilities

        this.toggleVFO = function () {
            lm.sendCommand({ command: 'toggle_vfo',
            });
        };

        this.lock = function (state) {
            lm.sendCommand({ command: 'lock',
                             arg: state}
                             );
        }

        this.power = function(state) {
            lm.sendCommand({ command: 'power',
                             arg: state}
                            );
        }


        console.log('Started Elecraft link manager driver..');

    };

});