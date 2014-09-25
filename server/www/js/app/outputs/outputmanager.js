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
        
        // Needs to be public because used in a callback below
        this.activeOutputs = []; // A list of all data output plugins that are enabled (strings)

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
                    console.info("[outputManager] asking link manager to connect outputs for intstrument " +
                                instrumentManager.getInstrument().id);
                    linkManager.setOutputs(instrumentManager.getInstrument().id);
                }
            });
        }
        
        // Used by Chrome/Cordova: implements the same API as on the server
        // (outputs/outputmanager.js)
        //  id: ID of the current instrument. We do not actually need it right now
        //      because we only have one instrument connected at a time.
        this.enableOutputs = function(id) {
            var self = this;
            console.warn(id);
            var enabled = [];
            var outputs = instrumentManager.getInstrument().outputs;
            // No need to fetch, because this is always called after "reconnectOutputs" above
            outputs.each(function(output) {
                if (output.get('enabled')) {
                    console.warn("[outputManager] Enable output " + output.get('type'));
                    var pluginType = self.supportedOutputs[output.get('type')];
                    if (pluginType == undefined) {
                        console.warn("***** WARNING ***** we were asked to enable an output plugin that is not supported but this server");
                    } else {
                         require([pluginType.backend], function(p) {
                             var plugin = new p();
                             // The plugin needs its metadata and the mapping for the data,
                             // the output manager will take care of the alarms/regular output
                             plugin.setup(output.get('metadata'), output.get('mappings'));
                             self.activeOutputs.push( { "plugin": plugin, "config": output, last: new Date().getTime() } );
                        });
                        
                }
                }
            });   
        }
        
        // Used in Chrome/Cordova mode
        // Main feature of our manager: send the data
        // to all active output plugins according to their
        // schedule.
        this.output = function(data) {
            for (var idx in this.activeOutputs) {
                var output = this.activeOutputs[idx];
                if (this.alarm(output) || this.regular(output) ) {
                    output.plugin.sendData(data);
                    output.last = new Date().getTime();
                }
            }
        };
    
        // Used in Chrome/Cordova mode
        // Do we have an alarm on this output ?
        this.alarm = function(output) {
            var alarm1 = output.config.get('alarm1'),
                alarm2 = output.config.get('alarm2'),
                alrmbool = output.config.get('alrmbool');

            return false;
        };
    
        // Used in Chrome/Cordova mode
        // Regular output of data
        this.regular = function(output) {
            var freq = output.config.get('frequency');
            if ((new Date().getTime() - output.last) > freq*1000)
                return true;
            return false;        
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