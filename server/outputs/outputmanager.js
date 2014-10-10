/**
 * The module that manages recording the output of an instrument to the
 * database
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

var mongoose = require('mongoose');
var _ = require("underscore")._;

var Output = mongoose.model('Output');


var Safecast = require('./safecast.js');
var Rest     = require('./rest.js');


// Returns 'true' if alarm is triggered
var check_alarm = function(output, alarm, data) {
    if (alarm.field != "_unused" && alarm.field != "") {
        var field = output.plugin.resolveMapping(alarm.field, data);
        if (field != undefined) {
            // If both field and alarm.level can be parsed as
            // numbers, do it:
            var numval = parseFloat(field);
            if (!isNaN(numval))
                field = numval;
            numval = parseFloat(alarm.level);
            if (!isNaN(numval))
                alarm.level = numval;
            
            switch (alarm.comparator) {
                case "less":
                    return (field < alarm.level);
                    break;
                case "moreeq":
                    return (field >= alarm.level);
                    break;
                case "eq":
                    return (field == alarm.level);
                    break;
                default:
                    return false;
            }
        }
    }
    return false;
}

module.exports = {
    
    activeOutputs: [],
    availableOutputs: { "safecast": Safecast, "rest": Rest},
    
    // Selects the active output plugins. Note that we only require
    // the instrument ID, since it stores its own list of enabled outputs,
    // and more importantly, all the settings for those.
    enableOutputs: function(id) {
        var self = this;
        console.log('Retrieving Outputs for Instrument ID: ' + id);
        
        // TODO: nicely disable previously active outputs ?
        this.activeOutputs = [];
        
        Output.find({ instrumentid: id, enabled: true} , function(err,outputs) {
            _.each(outputs, function(output) {
                console.log(output);
                // Now we need to configure the output and put it into our activeOutputs list
                var pluginType = self.availableOutputs[output.type];
                if (pluginType == undefined) {
                    console.log("***** WARNING ***** we were asked to enable an output plugin that is not supported but this server");
                } else {
                    var plugin = new pluginType();
                    // The plugin needs its metadata and the mapping for the data,
                    // the output manager will take care of the alarms/regular output
                    plugin.setup(output);
                    self.activeOutputs.push( { "plugin": plugin, "config": output, last: new Date().getTime() } );
                }
            });
        });


    },

    // Main feature of our manager: send the data
    // to all active output plugins according to their
    // schedule.
    output: function(data) {
        for (idx in this.activeOutputs) {
            var output = this.activeOutputs[idx];
            if (this.alarm(output,data) || this.regular(output) ) {
                output.plugin.sendData(data);
                output.last = new Date().getTime();
            }
        }
    },
    
    // Do we have an alarm on this output ?
    alarm: function(output, data) {
        var alarm1 = output.config.alarm1,
            alarm2 = output.config.alarm2,
            alrmbool = output.config.alrmbool,
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

        var freq = output.config.alrmfrequency;
        if (freq = 0)
            return false;
        if ( (output.last_alarm == undefined) ||
             (new Date().getTime() - output.last_alarm > freq*1000)
           ) {
                output.last_alarm = new Date().getTime();
                return true;
        }

        return false;
    },
    
    regular: function(output) {
        var freq = output.config.frequency;
        if (freq == 0)
            return false;
        if ((new Date().getTime() - output.last) > freq*1000)
            return true;
        return false;        
    }
    
};
    


