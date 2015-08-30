/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
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