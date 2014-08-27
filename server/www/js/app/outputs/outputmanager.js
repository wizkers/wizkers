/**
 *
 * The Output manager handles all data output plugins
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    
    "use strict";
    
    var _ = require('underscore'),
        Backbone = require('backbone'),
        Instrument = require(['app/models/instrument']);

    var OutputManager = function() {
    
        this.instrument = null; // A Backbone Model
        
        this.enabledOuputs = []; // A list of all data output plugins that are enabled

        this.supportedOutputs = {
            "safecast":     { name: "SafeCast API", type: SafecastOutput },
        };
        
        /**
         * Enable an output plugin for the current instrument
         * 'output' is a string description of the output plugin (see supportedOutput above)
         */        
        this.enableOutput = function(output) {
            var type = output.get('type');
            for (var ins in this.supportedOutputs) {
            if (ins == type) {
                
                // Nifty: we extend our link manager with the methods of our instrument.
                // (since all instruments support the same API, a change of instrument
                // overrides the methods)
                var instrumentObject =new this.supportedInstruments[ins].type;
                _.extend(this,instrumentObject);
                this.trigger('instrumentChanged'); // Tell views who rely on the instrument manager...
                }
            }
        }
        
        // Disable an output plugin for the current instrument
        this.disableOuput = function(output) {
        }

        this.getEnabledOutputs = function() {
            return this.enabledOuputs;
        }
        
        // Send data coming from an instrument to all enabled output plugins
        this.dispatchData = function(data) {
            
        }
        
    };

    _.extend(OutputManager.prototype, Backbone.Events);
    
    return OutputManager;

});