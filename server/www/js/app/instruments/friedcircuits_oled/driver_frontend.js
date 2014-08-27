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

        //////
        //  Standard API:
        // All link managers need this function:
        //////
        this.setBackendDriver = function() {
            lm.socket.emit('driver','fcoledv1');
        }

        //////
        // End of standard API
        //////

        this.screen = function(n) {
            lm.socket.emit('controllerCommand', 'S:' + n);
        }

        this.reset = function() {
            lm.socket.emit('controllerCommand', 'Z:');
        }

        this.rate = function(r) {
            lm.socket.emit('controllerCommand', 'R:' + r);
        }

        this.alarm = function(r) {
            lm.socket.emit('controllerCommand', 'W:' + r);
        }

        // All commands below are fully free and depend on
        // the instrument's capabilities

        console.log('Started OLED Backpack link manager driver..');
    }

});