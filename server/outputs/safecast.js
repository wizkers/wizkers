/**
 * A SafeCast API output plugin
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

var mongoose = require('mongoose');

module.exports = function safecast() {
    
    var mappings = null;
    var settings = null;
    
    // Load the settings for this plugin
    this.setup = function(metadata, mappings) {
        
        console.log("[Safecast Output plugin] Setup a new instance");
        mappings = mappings;
        settings = metadata;
        
    };
    
    this.sendData = function(data) {
        console.log("[Safecast Output plugin] ToDo: send data to Safecast");
    };
    
        
};
    


