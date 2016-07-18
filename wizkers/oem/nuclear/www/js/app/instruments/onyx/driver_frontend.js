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
 *
 *  - provides API to the backend device to use by views
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function(require) {
    "use strict";

    // linkManager is a reference to the parent link manager
    return function() {

        var self = this;
        var lm = linkManager;
        var streaming = false;
        var livePoller = null; // Reference to the timer for live streaming


        //////
        //  Standard API:
        // All link managers need this function:
        //////
        this.getBackendDriverName = function() {
            return 'onyx';
        }

        //////
        // End of standard API
        //////


        // All commands below are fully free and depend on
        // the instrument's capabilities

        this.ping = function() {
                lm.sendCommand('HELLO');
        };

        this.getCPM = function() {
                lm.sendCommand('GETCPM');
        };

        this.getlog = function() {
                lm.sendCommand('LOGPAUSE');
                setTimeout(function() {
                    lm.sendCommand('LOGXFER');
                    // Note: looking @ the firmware, the Onyx does the "log resume"
                    // by itself after transfer (as well as the log pause before, actually);
                },1000);
        };

        this.help = function() {
                lm.sendCommand('HELP');
        };

        this.version = function() {
                lm.sendCommand('{"get": "version"}');
        };

        this.guid = function() {
                lm.sendCommand('{ "get": "guid" }');
        };

        this.getcalibration = function() {
            lm.sendCommand('{"get":"cal"}');
        }

        this.getqr = function() {
            lm.sendCommand('{"get":"qr"}');
        }

        this.saveqr = function(tmpl) {
            // Simple escape of " in the template, just in case
            tmpl = tmpl.replace('"', '\\"');
            lm.sendCommand('{"set":{"qr":"' + tmpl + '"}}');
        }

        this.get_screen_dim_delay = function() {
            lm.sendCommand('{"get":"dim"}');
        }

        this.save_screen_dim_delay = function(del) {
            lm.sendCommand('{"set":{"dim":' + del + '}}');
        }

        this.setcalibration = function(cal) {
            lm.sendCommand('{"set":{"cal":' + cal + '}}');
        }

        this.logstatus = function() {
            lm.sendCommand('{ "get": "logstatus" }');
        };

        this.devicetag = function() {
                lm.sendCommand('{ "get": "devicetag" }');
        };

        this.debug_enable = function(en) {
                lm.sendCommand('{ "set": { "debug":' + (en ? 1 : 0) + '}}');
        };

        this.setdevicetag = function(tag) {
            console.log('Device tag: ' + tag);
            lm.sendCommand('{ "set": { "devicetag": "' + tag + '"}}');
        };

        this.displaytest = function() {
            lm.sendCommand('DISPLAYTEST');
        };

        this.getRTC = function() {
            lm.sendCommand('{"get":"rtc"}');
        }

        this.settime = function() {
                var unixTime = Math.round((new Date()).getTime() / 1000);
                console.log('Unix time: ' + unixTime);
                lm.sendCommand('{ "set": { "rtc": ' + unixTime + ' }}');
        };


        console.log('Started Onyx link manager driver..');
    }

});