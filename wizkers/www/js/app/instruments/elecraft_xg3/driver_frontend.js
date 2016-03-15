/**
 * (c) 2016 Edouard Lafargue, ed@lafargue.name
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

        var kxpa100 = false; // Keep track of the presence of an amplifier


        //////
        //  Standard API:
        // All link managers need this function:
        //////
        this.getBackendDriverName = function () {
            return 'elecraft_xg3';
        }

        //////
        // End of standard API
        //////

        // All commands below are fully free and depend on
        // the instrument's capabilities

        this.setVFO = function (f, vfo) {
            var freq = ("00000000000" + (parseInt(f * 1e6).toString())).slice(-11); // Nifty, eh ?
            if (freq.indexOf("N") > -1) { // detect "NaN" in the string
                console.log("Invalid VFO spec");
                lm.sendCommand((vfo == 'A' ||  vfo == 'a') ? 'FA;' : 'FB;');
            } else {
                console.log("VFO" + vfo + ": " + freq);
                lm.sendCommand(((vfo == 'A' ||  vfo == 'a') ? 'FA' : 'FB') + freq + ';');
            }
            lm.sendCommand('BN;'); // Refresh band number (radio does not send it automatically)
        }

        this.setBand = function (band) {
            // We use a band number in meters (with a "m"), this function translates into the XG3 values:
            var bands = {
                "160": "00",
                "80": "01",
                "60": "02",
                "40": "03",
                "30": "04",
                "20": "05",
                "17": "06",
                "15": "07",
                "12": "08",
                "10": "09",
                "6": "10",
                "2": "11"
            };
            var bandcode = bands[band];
            if (typeof (bandcode) != 'undefined') {
                lm.sendCommand('C,' + bandcode + ';');
            }
        }

        this.setLevel = function (band) {
            // We use a band number in meters (with a "m"), this function translates into the XG3 values:
            var bands = {
                "107": "03",
                "73": "02",
                "33": "01",
                "0": "00",
            };
            var bandcode = bands[band];
            if (typeof (bandcode) != 'undefined') {
                lm.sendCommand('L,' + bandcode + ';');
            }
        }

        console.log('Started Elecraft XG3 front-end driver..');

    };

});