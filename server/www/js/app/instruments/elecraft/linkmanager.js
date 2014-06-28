/**
 * The controller communication manager:
 *  - manages the socket.io link
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
        var streaming = false;
        var streamingText = false;
        var livePoller = null; // Reference to the timer for live streaming
        var textPoller = null; // This is a poller to read from the radio TB buffer.
    
        var kxpa100 = false; // Keep track of the presence of an amplifier


        //////
        //  Standard API:
        // All link managers need this function:
        //////
        this.setBackendDriver = function() {
            lm.socket.emit('driver','elecraft');
        }

        //////
        // End of standard API
        //////

        // All commands below are fully free and depend on
        // the instrument's capabilities

        this.startTextStream = function() {
            //        this.streamingText = true;
            this.textPoller = setInterval(this.queryTB.bind(this), 700);
            return true;
        }

        this.stopTextStream = function() {
            if (typeof this.textPoller != 'undefined') {
                clearInterval(this.textPoller);
    //            this.streamingText = false;
            }
            return true;
        }
        
        this.sendText = function(text) {
            this.cc('KY ' + text +';');
        }

        this.queryTB = function() {
            this.cc('TB;');
        }

        this.cc = function(d) {
            lm.socket.emit('controllerCommand',d);
        }

        this.screen = function(n) {
            lm.socket.emit('controllerCommand', 'S:' + n);
        }

        this.getRequestedPower = function() {
            this.cc('PC;');
        }

        this.getMode = function() {
            this.cc('MD;');
        }

        this.setMode = function(code) {
            this.cc('MD' + code + ';');
        }
        
        this.setSubmode = function(submode) {
            var submodes = { "DATA A":"0", "AFSK A":"1", "FSK D":"2", "PSK D":"3"};
            this.cc('DT' + submodes[submode] + ';');
        }

        this.setVFO = function(f, vfo) {
            var freq = ("00000000000" + (parseInt(f*1e6).toString())).slice(-11); // Nifty, eh ?
            if (freq.indexOf("N") > -1) { // detect "NaN" in the string
                console.log("Invalid VFO spec");
                this.cc((vfo == 'A' || vfo == 'a') ? 'FA;' : 'FB;');
            } else {
                console.log("VFO" + vfo + ": " + freq);
                this.cc(((vfo == 'A' || vfo == 'a') ? 'FA' : 'FB') + freq + ';');
            }
            this.cc('BN;'); // Refresh band number (radio does not send it automatically)
        }    

        this.setPower = function(p) {
            var pwr = ("000" + (parseInt(p).toString())).slice(-3); // Nifty, eh ?
            if (pwr.indexOf("N") > -1) { // detect "NaN" in the pwr
                this.cc('PC;');
            } else {
                console.log('PC' + pwr + ';');
                this.cc('PC'+ pwr + ';');
            }
        }

        this.setAG = function(ag) {
            var gain = ("000" + ag).slice(-3);
            this.cc('AG' + gain + ';');
        }

        this.setMG = function(mg) {
            var gain = ("000" + mg).slice(-3);
            this.cc('MG' + gain + ';');
        }

        this.setRG = function(rg) {
            // Need to translate "-60 to 0" into "190 to 250"
            this.cc('RG' + (rg+250) + ';');
        }

        this.setBW = function(bw) { // Bandwidth in kHz (0 to 4.0)
            var bandwidth = ("0000" + Math.floor(bw*100)).slice(-4);
            this.cc('BW' + bandwidth + ';');
        }

        this.setCT = function(ct) { // Center frequency
            var center = ("0000" + Math.floor(ct*1000)).slice(-4);
            this.cc('IS ' + center + ';'); // Note the space!
        }

        this.setBand = function(band) {
            // We use a band number in meters (with a "m"), this function translates into the KX3 values:
            var bands= { "160m":"00", "80m":"01", "60m":"02", "40m":"03", "30m":"04", "20m":"05", "17m":"06", "15m":"07", "12m":"08", "10m":"09", "6m":"10" };
            var bandcode = bands[band];
            if (typeof(bandcode) != 'undefined') {
                this.cc('BN' + bandcode + ';');
            }
        }

        console.log('Started Elecraft link manager driver..');

    };
    
});

