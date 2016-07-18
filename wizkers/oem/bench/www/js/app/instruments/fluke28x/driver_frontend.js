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
 * The controller communication driver:
 *
 *  - provides API to the backend device to use by views
 *
 * @author Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    "use strict";

    // linkManager is a reference to the parent link manager
    return function() {

        var self = this;
        var lm = linkManager;
        this.battCheck = 0;
        this.ledState = "OFF";


        //////
        //  Standard API:
        // All link managers need this function:
        //////
        this.getBackendDriverName = function() {
            return 'fluke28x';
        }

        //////
        // End of standard API
        //////

        // All commands below are fully free and depend on
        // the instrument's capabilities


        // Query meter for software version & serial number
        this.version = function() {
            lm.sendCommand('IM');
            lm.sendCommand('QCCV');
            lm.sendCommand('QCVN');
        }

        // Queries the primary measurement only. Adds battery check
        // every 10 queries as a bonus.
        this.queryMeasurement = function() {
            self.battCheck = (self.battCheck+1)%10;
            if (self.battCheck == 0)
                lm.sendCommand('QBL');

            lm.sendCommand('QM');
        }

        // Extended version, queries all currently displayed
        // measurements on the meter.
        this.queryMeasurementFull = function() {
            self.battCheck = (self.battCheck+1)%10;
            if (self.battCheck == 0)
                lm.sendCommand('QBL');

            lm.sendCommand('QDDA');
        }

        this.getDevInfo = function() {
            var callQueue = [ 'QMPQ operator', 'QMPQ company', 'QMPQ site', 'QMPQ contact' ];
            var idx = 0;
            // Be nice to the device and stage the queries (our driver manages a command queue, so it
            // is not strictly necessary but hey, let's be cool).
            var caller = function() {
                lm.sendCommand(callQueue[idx++]);
                if (idx < callQueue.length)
                    setTimeout(caller,50);
            }
            caller();
        }

        this.setDevInfo = function(operator, company, site, contact) {
            // Remove double quotes
            operator = operator.replace(/"/g,'');
            company = company.replace(/"/g,'');
            site = site.replace(/"/g,'');
            contact = contact.replace(/"/g,'');
            if (operator != '')
                lm.sendCommand('MPQ operator,"' + operator + '"');
            if (company != '')
                lm.sendCommand('MPQ company,"' + company + '"');
            if (site != '')
                lm.sendCommand('MPQ site,"' + site + '"');
            if (contact != '')
                lm.sendCommand('MPQ contact,"' + contact + '"');
        };

        this.takeScreenshot = function() {
            lm.sendCommand('QLCDBM 0');
        }

        this.toggleLed = function() {
            (self.ledState == "OFF") ? self.ledState="ON":self.ledState="OFF";
            lm.sendCommand('LEDT ' + self.ledState);
            if (self.ledState == "ON")
                return true;
            return false;
        }

        this.off = function() {
            lm.sendCommand('OFF');
        }

        this.sendKeypress = function(key) {
            lm.sendCommand('PRESS ' + key);
        }


        // Sends several queries related to memory level.
        // Note: will fail if the meter is recording something.
        this.getMemInfo = function() {
            lm.sendCommand('QMEMLEVEL');
            lm.sendCommand('QSLS');
        }

        this.getTrendlogRecord = function(address,index) {
            lm.sendCommand( 'QSRR ' + address + ',' + index);
        }

        // Helper methods to format output:
        this.units = {
            "CEL": "°C",
            "VDC": "V dc",
            "ADC": "A dc",
            "VAC": "V ac",
            "AAC": "A ac",
            "VAC_PLUS_DC": "V <small>AC+DC</small>",
            // "VAC_PLUS_DC": "V <small>AC+DC</small>",
            "OHM": "&#8486;",
            "SIE": "Sie",
            "HZ": "Hz",
            "FAR": "°F",
            "F": "F",
            "PCT": "%",
        };

        this.multipliers = ['M', 'k', '', 'm', '&mu;', 'n', 'p'];

        this.mapUnit = function(unit, mult) {
            var res = this.units[unit];
            if (res == undefined)
                    return unit;
            var prefix = this.multipliers[-mult/3+2];
            return prefix + res ;
        }
        console.log('Started Fluke289 link manager driver..');

    }

});

