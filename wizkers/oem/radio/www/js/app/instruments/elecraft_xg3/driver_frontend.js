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

        this.getSweepMem = function(mem) {
            lm.sendCommand('Q,' + mem + ';');
        }

        this.setSweep = function(start,stop,step,time,repeat) {
            // At the moment, we just use Sweep memory 1 to do the sweeps (the UI only
            // lets up program one sweep set).
            lm.sendCommand('Q,1,' + start + ',' + stop + ',' + step + ',' + time + ',' + repeat + ';');
            this.doSweep();
        }

        this.doSweep = function() {
            lm.sendCommand('PF,01,00;S,01;');
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

        this.setWPM = function(wpm) {
            lm.sendCommand('WP,' + wpm + ';');
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

        this.outputEnable = function(enable) {
            lm.sendCommand('O,' + (enable ? '1' : '0') + ';');
        }

        this.setBandDirect = function(num) {
            if (num > 11)
                return;
            lm.sendCommand('C,' + ("00" + num).slice(-2) + ';');
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

        this.setLevelDirect = function(num) {
            if (num > 4)
                return;
            lm.sendCommand('L,' + ("00" + num).slice(-2) + ';');
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