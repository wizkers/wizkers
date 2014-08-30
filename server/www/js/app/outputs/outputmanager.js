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
    var SafecastSettings = require('app/outputs/safecast/settings');
    var Rest     = require('app/outputs/rest/rest');
    var RestSettings = require('app/outputs/rest/settings');

    var OutputManager = function() {
        
        var enabledOutputs = []; // A list of all data output plugins that are enabled (strings)

        this.supportedOutputs = {
            "safecast":     { name: "SafeCast API", plugin: Safecast, backend: 'app/outputs/safecast/driver_backend',
                              settings: SafecastSettings },
            "rest": { name: "http REST calls", plugin: Rest, settings: RestSettings },
        };
        
        // Called upon instrument change or output enable/disable and makes sure
        // the output plugins are connected and ready to receive data from the
        // instrument backend driver
        this.reconnectOutputs = function() {
            var outputs = instrumentManager.getInstrument().outputs;
            // We need to make sure we have a current list, hence the "fetch"
            outputs.fetch({
                success: function() {
                    var enabled = [];
                    outputs.each(function(output) {
                        if (output.get('enabled'))
                            enabled.push(output.get('type'));
                    });
                    console.info("[outputManager] asking link manager to connect: " + enabled);
                    linkManager.setOutputs({ "instrument": instrumentManager.getInstrument().id,
                                            "outputs": enabled });
                }
            });
        }
        
        // Returns all the fields that are required/supported by a plugin type
        this.getOutputFields = function(type) {
            var out = this.supportedOutputs[type];
            if (out != undefined) {
                return new out.plugin().outputFields();
            }
            return {};
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