/**
 * The controller communication manager:
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

        //////
        //  Standard API:
        // All link managers need this function:
        //////
        this.getBackendDriverName = function() {
            return 'w433';
        }

        //////
        // End of standard API
        //////


        // All commands below are fully free and depend on
        // the instrument's capabilities

        console.log('Started Aerodynes W433 receiver link manager driver..');
    }

});