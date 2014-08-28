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
    
    var Safecast = require('app/outputs/safecast/safecast');
    var Rest     = require('app/outputs/rest/rest');

    var OutputManager = function() {
        
        var enabledOuputs = []; // A list of all data output plugins that are enabled

        this.supportedOutputs = {
            "safecast":     { name: "SafeCast API", plugin: Safecast },
            // "dweet":  { name: "dtweet.io", plugin: '' },
            "rest": { name: "http REST calls", plugin: Rest },
        };
        
        /**
         * Enable an output plugin for the current instrument
         * 'output' is a string description of the output plugin (see supportedOutput above)
         */        
        this.enableOutput = function(output) {
            var type = output.get('type');
            for (var ins in this.supportedOutputs) {
            if (ins == type) {
                var outputPlugin =new this.supportedInstruments[ins].type;
                enabledOutputs.push(outputPlugin);
                }
            }
        }
        
        // Disable an output plugin for the current instrument
        this.disableOuput = function(output) {
        }

        this.getEnabledOutputs = function() {
            return this.enabledOuputs;
        }
        
        
        // Returns all output plugin names that make sense for this instrument.
        // we manage this through the instrument manager because there is a close interaction between
        // what the instrument can output, and the data that is then sent to the output plugin. For instance,
        this.getOutputsForCurrentInstrument = function() {
            if (instrumentManager.getInstrument() == null) return {};
            
            var caps = instrumentManager.getDataType();
            console.info("Caps: " + caps);
            var accepted = {};
            _.each(this.supportedOutputs, function(out, type) {
                var wo = new out.plugin().wantOnly();
                var wantit = false;
                if (wo.length > 0) {
                    for (var want in wo) {
                        wantit |= (caps.indexOf(wo[want]) != -1);
                    }
                } else {
                    wantit = true;
                }
                if (wantit)
                    accepted[type] = out;

            });
            
            return accepted;
            
        }

        
        // Send data coming from an instrument to all enabled output plugins
        this.dispatchData = function(data) {
            
        }
        
    };

    _.extend(OutputManager.prototype, Backbone.Events);
    
    return OutputManager;

});