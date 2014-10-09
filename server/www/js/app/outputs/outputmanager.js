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
        
        // Private utility functions
        
        // Returns 'true' if alarm is triggered
        var check_alarm = function(output, alarm, data) {
            if (alarm.field != "_unused" && alarm.field != "") {
                var value = output.plugin.resolveMapping(alarm.field, data);
                if (value != undefined) {
                    switch (alarm.comparator) {
                        case "less":
                            return (value < alarm.level);
                            break;
                        case "moreeq":
                            return (value >= alarm.level);
                            break;
                        case "eq":
                            return (value == alarm.level);
                            break;
                        default:
                            return false;
                    }
                }
            }
        }
        
        
        // Needs to be public because used in a callback below
        this.activeOutputs = []; // A list of all data output plugins that are enabled (strings)

        this.supportedOutputs = {
            "safecast":  { name: "SafeCast API", plugin: Safecast, backend: 'app/outputs/safecast/driver_backend',
                              settings: SafecastSettings },
            "rest":      { name: "http REST calls", plugin: Rest, backend: 'app/outputs/rest/driver_backend',
                              settings: RestSettings },
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
            
            // Before anything else, clear the current outputs. Somehow
            // the while loop below seems to be super fast:
            while (this.activeOutputs.length)
                this.activeOutputs.pop();
            
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
                             plugin.setup(output);
                             self.activeOutputs.push( { "plugin": plugin, "config": output, last: new Date().getTime(), last_alarm: 0 } );
                             // Also subscribe to events coming from the plugin
                             self.listenTo(plugin, 'outputTriggered', self.dispatchOutputEvents );
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
                if (this.alarm(output, data) || this.regular(output) ) {
                    output.plugin.sendData(data);
                    output.last = new Date().getTime();
                }
            }
        };
    
        // Used in Chrome/Cordova mode
        // Do we have an alarm on this output ?
        this.alarm = function(output, data) {
            var alarm1 = output.config.get('alarm1'),
                alarm2 = output.config.get('alarm2'),
                alrmbool = output.config.get('alrmbool'),
                alarm = false;
            
            var alarm1_triggered = check_alarm(output, alarm1, data);
            var alarm2_triggered = check_alarm(output, alarm2, data);
            
            switch (alrmbool) {
                case 'and':
                    alarm = (alarm1_triggered && alarm2_triggered);
                    break;
                case 'or':
                    alarm = (alarm1_triggered || alarm2_triggered);
                    break;
                default:
                    break;
            }
            if (!alarm)
                return false;
            
            var freq = output.config.get('alrmfrequency');
            if (freq = 0)
                return false;
            if (new Date().getTime() - output.last_alarm > freq*1000)
                return true;
            
            return false;
        };
    
        // Used in Chrome/Cordova mode
        // Regular output of data
        this.regular = function(output) {
            var freq = output.config.get('frequency');
            if (freq == 0)
                return false;
            if ((new Date().getTime() - output.last) > freq*1000)
                return true;
            return false;        
        }
        
        // Returns all the fields that are required/supported by a plugin type
        //
        // If a plugin supports a dynamic number of fields, these are defined in
        // the plugin metadata as "numfields". The plugin will return "variable"
        // here instead of a json structure.
        this.getOutputFields = function(type) {
            var out = this.supportedOutputs[type];
            if (out != undefined) {
                return new out.plugin().outputFields();
            }
            return {};
        }
        
        // Returns all output plugin names that make sense for this instrument.
        // we manage this through the instrument manager because there is a close interaction between
        // what the instrument can output, and the data that is then sent to the output plugin.
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

        
        // Forward events coming form outputs
        this.dispatchOutputEvents = function(evt) {
            console.log("Event from plugin");
            this.trigger('outputTriggered', evt);
        }
        
    };

    _.extend(OutputManager.prototype, Backbone.Events);
    
    return OutputManager;

});