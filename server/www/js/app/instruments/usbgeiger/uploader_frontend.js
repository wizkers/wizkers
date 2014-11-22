/**
 * The front-end interface for the uploader
 *
 *  - provides API to the backend device with high level calls
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

        //////
        //  Standard API:
        // All link managers need this function:
        //////
        
        this.getBackendDriverName = function() {
            return 'stk500-leo';
        }
        
        //////
        // End of standard API
        //////


        // All commands below are fully free and depend on
        // the instrument's capabilities

        this.dump_settings = function() {
                lm.sendCommand('p:');
        };

        console.log('Started USB Geiger link uploader front end driver..');
    }

});