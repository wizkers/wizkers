/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2018 Edouard Lafargue, ed@wizkers.io
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
 * DESFire Commands wrapped APDUs
 */


// This detects whether we are in a server situation and act accordingly:
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
    var vizapp = { type: 'server'},
    events = require('events'),
    crypto = require('crypto');

}

define(function (require) {
    "use strict";
    

    var desfireCommands = function (driver) {

        var self = this;

// Crypto functions
        this.encipher = function() {

        }

        this.decipher = function () {

        }


        /* Gets the card application IDs
         * 906A000000
        */
        this.getApplicationIDs = function() {
            var apdu = {
                cla: "90",
                ins: "6A",
                p1: "00",
                p2: "00",
                lc: "00",
                data: "",
                le: ""
            };
            return apdu;
        }

        this.authenticateAES = function(keyNum) {
            var apdu = {
                cla: "90",
                ins: "AA",
                p1: "00",
                p2: "00",
                lc: "01",
                data: ("00" + keynum.toString(16)).slice(-2),
                le: "00"
            };
            return apdu;
        }

        // var apdu = "905a000003" + aid + "00";
        this.selectApplication = function (aid) {
            var apdu = {
                cla: "90",
                ins: "5A",
                p1: "00",
                p2: "00",
                lc: "03",
                data: aid,
                le: "00"
            };
            return apdu;
        }

        // aid : hex string
        // keysettings 1/2 : number
        this.createApplication = function(aid, keysettings1, keysettings2) {
            if (aid.length != 6)
                return;
            if (keysettings1 > 255 || keysettings2 > 255)
                return;
            var apdu = {
                cla: "90",
                ins: "CA",
                p1: "00",
                p2: "00",
                lc: "05",
                data: aid + ("00" + keysettings1.toString(16)).slice(-2) + ("00" + keysettings2.toString(16)).slice(-2),
                le: "00"
            };
            return apdu;
        }

        this.deleteApplication = function(aid) {
            if (aid.length != 6)
                return;
            var apdu = {
                cla: "90",
                ins: "DA",
                p1: "00",
                p2: "00",
                lc: "03",
                data: aid,
                le: "00"
            };
            return apdu;
        }

        // Returns key settings for currently selected application
        // Note: we should consider doing the parsing of the response on the backend as well
        this.getKeySettings = function() {
            var apdu = {
                cla: "90",
                ins: "45",
                p1: "00",
                p2: "00",
                lc: "00",
                data: "",
                le: ""
            };
            return apdu;
        }

        // Returns key version for a particular key
        this.getKeyVersion = function(keynum) {
            console.log(keynum);
            var apdu = {
                cla: "90",
                ins: "64",
                p1: "00",
                p2: "00",
                lc: "01",
                data: ("00" + keynum.toString(16)).slice(-2),
                le: "00"
            };
            return apdu;
        }

        this.requestAESAuth = function(keynum) {
            var apdu = {
                cla: "90",
                ins: "AA",
                p1: "00",
                p2: "00",
                lc: "01",
                data: ("00" + keynum.toString(16)).slice(-2),
                le: "00"
            };
            return apdu;
        }

        // resp is a 32 byte ( 64 hex characters) string
        this.replyAESAuth = function(resp) {
            if (resp.length != 64)
                console.error("Wrong response for AES Authentication");
            var apdu = {
                cla: "90",
                ins: "AF",
                p1: "00",
                p2: "00",
                lc: "20",
                data: resp.toUpperCase(),
                le: "00"
            };
            return apdu;

        }


        /* Read binary
        */
        this.readBinary = function(myReader, sector, block){
        };

    }

    // On server side, we use the Node eventing system, whereas on the
    // browser/app side, we use Bacbone's API:
    if (vizapp.type != 'server') {
        // Add event management, from the Backbone.Events class:
        _.extend(desfireCommands.prototype, Backbone.Events);
    } else {
        desfireCommands.prototype.__proto__ = events.EventEmitter.prototype;
        desfireCommands.prototype.trigger = desfireCommands.prototype.emit;
    }

    return new desfireCommands(); // Singleton
});