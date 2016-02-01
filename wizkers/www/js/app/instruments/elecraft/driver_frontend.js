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
            return 'elecraft';
        }

        //////
        // End of standard API
        //////

        // All commands below are fully free and depend on
        // the instrument's capabilities
        this.startTextStream = function () {
            this.textPoller = setInterval(this.queryTB.bind(this), 700);
            return true;
        }

        this.stopTextStream = function () {
            if (typeof this.textPoller != 'undefined') {
                clearInterval(this.textPoller);
            }
            return true;
        }

        this.sendText = function (text) {
            lm.sendCommand('KY ' + text + ';');
        }

        this.queryTB = function () {
            lm.sendCommand('TB;');
        }


        this.screen = function (n) {
            lm.sendCommand('S:' + n);
        }

        this.getRequestedPower = function () {
            lm.sendCommand('PC;');
        }

        this.getMode = function () {
            lm.sendCommand('MD;');
        }

        this.setMode = function (code) {
            lm.sendCommand('MD' + code + ';');
        }

        this.setSubmode = function (submode) {
            var submodes = {
                "DATA A": "0",
                "AFSK A": "1",
                "FSK D": "2",
                "PSK D": "3"
            };
            lm.sendCommand('DT' + submodes[submode] + ';');
        }

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

        this.setPower = function (p) {
            var pwr = ("000" + (parseInt(p).toString())).slice(-3); // Nifty, eh ?
            if (pwr.indexOf("N") > -1) { // detect "NaN" in the pwr
                lm.sendCommand('PC;');
            } else {
                console.log('PC' + pwr + ';');
                lm.sendCommand('PC' + pwr + ';');
            }
        }

        this.setCP = function (cmp) {
            var cp = ("000" + cmp).slice(-3);
            lm.sendCommand('CP' + cp + ';');
        }

        this.setAG = function (ag) {
            var gain = ("000" + ag).slice(-3);
            lm.sendCommand('AG' + gain + ';');
        }


        this.setMG = function (mg) {
            var gain = ("000" + mg).slice(-3);
            lm.sendCommand('MG' + gain + ';');
        }

        this.setRG = function (rg) {
            // Need to translate "-60 to 0" into "190 to 250"
            lm.sendCommand('RG' + (rg + 250) + ';');
        }

        this.setBW = function (bw) { // Bandwidth in kHz (0 to 4.0)
            var bandwidth = ("0000" + Math.floor(bw * 100)).slice(-4);
            lm.sendCommand('BW' + bandwidth + ';');
        }

        this.setCT = function (ct) { // Center frequency
            var center = ("0000" + Math.floor(ct * 1000)).slice(-4);
            lm.sendCommand('IS ' + center + ';'); // Note the space!
        }

        this.setBand = function (band) {
            // We use a band number in meters (with a "m"), this function translates into the KX3 values:
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
                "2": "16"
            };
            var bandcode = bands[band];
            if (typeof (bandcode) != 'undefined') {
                lm.sendCommand('BN' + bandcode + ';');
            }
        }

        console.log('Started Elecraft link manager driver..');

    };

});