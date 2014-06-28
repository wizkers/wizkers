/**
 * The controller communication driver:
 *
 *  - provides API to the backend device to use by views
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    "use strict";

    // linkManager is a reference to the parent link manager
    return function(linkManager) {

        var self = this;
        var lm = linkManager;
        this.socket = lm.socket;
        this.battCheck = 0;
        this.ledState = "OFF";


        //////
        //  Standard API:
        // All link managers need this function:
        //////
        this.setBackendDriver = function() {
            lm.socket.emit('driver','fluke28x');
        }

        //////
        // End of standard API
        //////

        // All commands below are fully free and depend on
        // the instrument's capabilities


        // Query meter for software version & serial number
        this.version = function() {
            self.socket.emit('controllerCommand', 'IM');
            self.socket.emit('controllerCommand', 'QCCV');
            self.socket.emit('controllerCommand', 'QCVN');
        }

        // Queries the primary measurement only. Adds battery check
        // every 10 queries as a bonus.
        this.queryMeasurement = function() {
            self.battCheck = (self.battCheck+1)%10;
            if (self.battCheck == 0)
                self.socket.emit('controllerCommand', 'QBL');

            self.socket.emit('controllerCommand', 'QM');
        }

        // Extended version, queries all currently displayed
        // measurements on the meter.
        this.queryMeasurementFull = function() {
            self.battCheck = (self.battCheck+1)%10;
            if (self.battCheck == 0)
                self.socket.emit('controllerCommand', 'QBL');

            self.socket.emit('controllerCommand', 'QDDA');
        }

        this.getDevInfo = function() {
            var callQueue = [ 'QMPQ operator', 'QMPQ company', 'QMPQ site', 'QMPQ contact' ];
            var idx = 0;
            // Be nice to the device and stage the queries (our driver manages a command queue, so it
            // is not strictly necessary but hey, let's be cool).
            var caller = function() {
                self.socket.emit('controllerCommand', callQueue[idx++]);
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
                self.socket.emit('controllerCommand', 'MPQ operator,"' + operator + '"');
            if (company != '')
                self.socket.emit('controllerCommand', 'MPQ company,"' + company + '"');
            if (site != '')
                self.socket.emit('controllerCommand', 'MPQ site,"' + site + '"');
            if (contact != '')
                self.socket.emit('controllerCommand', 'MPQ contact,"' + contact + '"');
        };

        this.takeScreenshot = function() {
            self.socket.emit('controllerCommand', 'QLCDBM 0');
        }

        this.toggleLed = function() {
            (self.ledState == "OFF") ? self.ledState="ON":self.ledState="OFF";
            self.socket.emit('controllerCommand', 'LEDT ' + self.ledState);
            if (self.ledState == "ON")
                return true;
            return false;
        }

        this.off = function() {
            self.socket.emit('controllerCommand', 'OFF');
        }                                        

        this.sendKeypress = function(key) {
            self.socket.emit('controllerCommand', 'PRESS ' + key);
        }


        // Sends several queries related to memory level.
        // Note: will fail if the meter is recording something.
        this.getMemInfo = function() {
            self.socket.emit('controllerCommand', 'QMEMLEVEL');
            self.socket.emit('controllerCommand', 'QSLS');
        }

        this.getTrendlogRecord = function(address,index) {
            self.socket.emit('controllerCommand', 'QSRR ' + address + ',' + index);
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

