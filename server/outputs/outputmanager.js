/**
 * The module that manages recording the output of an instrument to the
 * database
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

var mongoose = require('mongoose');

var Safecast = require('./safecast.js');
// var Rest     = require('./rest.js');

module.exports = {
    
    activeOutputs: {},
    availableOutputs: { "safecast": Safecast },
    
    // Selects the active output plugins. Note that we only require
    // the instrument ID, since it stores its own list of enabled outputs,
    // and more importantly, all the settings for those.
    enableOutputs: function(insId) {
        console.log("[OutputManager] Enable outputs for instrument ID " + insId);
    },

    // Main feature of our manager: send the data
    // to all active output plugins according to their
    // schedule.
    output: function(data) {
        console.log("*** STUB: send data to output plugins ***");
    }
    
};
    


