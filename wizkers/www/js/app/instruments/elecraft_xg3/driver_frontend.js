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

        this.setVFO = function (f) {
            var freq = ("00000000000" + (parseInt(f * 1e6).toString())).slice(-11); // Nifty, eh ?
            if (freq.indexOf("N") > -1) { // detect "NaN" in the string
                console.log("Invalid VFO spec");
            } else {
                lm.sendCommand('F,' + freq + ';');
            }
        }
        
        this.getMems = function() {
            lm.sendCommand('M,00;M,01;M,02;M,03;M,04;M,05;M,06;M,07;M,08;M,09;M,10;M,11;');
        }
        
        this.setMEM = function( band, f) {
            var freq = ("00000000000" + (parseInt(f * 1e6).toString())).slice(-11); // Nifty, eh ?
            if (freq.indexOf("N") > -1) { // detect "NaN" in the string
                console.log("Invalid VFO spec");
            } else {
                lm.sendCommand('M,' + band + ',' + freq + ';');
            }
        }
        
        this.sendCW = function(s) {
            if( s != '')
                lm.sendCommand('W,' + s + ';');
        }
        
        this.sendBeacon = function(s) {
            // Note: reprograms Sweep1 function
            lm.sendCommand('PF,01,01;S,01;');
        }
        this.sendRTTY = function(s) {
            lm.sendCommand('RT,' + s + ';');
        }

        this.setBeacon = function (s) {
            lm.sendCommand('WM,' + s + ';');
        }
        
        this.setWPM = function(wpm) {
            lm.sendCommand('WP,' + wpm + ';');
        }

        this.getWPM = function(wpm) {
            lm.sendCommand('WP;');
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