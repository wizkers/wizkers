/**
 * The front-end driver.
 *
 *  - provides API to the backend device to use by views
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */


define(function(require) {
    "use strict";

    // linkManager is a reference to the parent link manager
    return function() {

        var self = this;
        var lm = linkManager;
        var streaming = true;

        //////
        //  Standard API:
        // All link managers need this function:
        //////
        this.getBackendDriverName = function() {
            return 'heliumgeiger';
        }
                
        //////
        // End of standard API
        //////

        // All commands below are fully free and depend on
        // the instrument's capabilities

        this.ping = function() {
        };

        this.getCPM = function() {
            // The probes always stream
        };
        
        this.devicetag = function() {
            // The Onyx live view calls this method
        };

        this.version = function() {
                lm.sendCommand('v:');
        };

        this.dump_settings = function() {
                lm.sendCommand('p:');
        };

        this.cpm_output = function(enable) {
                lm.sendCommand('M:' + (enable ? '1' : '0') );
        };

        this.pulse_enable = function(enable) {
                lm.sendCommand('P:' + (enable ? '1' : '0') );
        };
        this.count_enable = function(enable) {
                lm.sendCommand('T:' + (enable ? '1' : '0') );
        };
        this.dual_enable = function(enable) {
                lm.sendCommand('I:' + (enable ? '2' : '1') );
        };

        console.log('Started Helium Geiger link manager front end driver..');
    }

});