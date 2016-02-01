/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 *
 * The Output manager handles all data output plugins
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {

    "use strict";

    var _ = require('underscore'),
        Backbone = require('backbone'),
        Instrument = require(['app/models/instrument']);

    var Safecast = require('app/outputs/safecast/safecast');
    var SafecastSettings = require('app/outputs/safecast/settings');
    var Rest = require('app/outputs/rest/rest');
    var RestSettings = require('app/outputs/rest/settings');
    var Rigctld = require('app/outputs/rigctld/rigctld');
    var RigctldSettings = require('app/outputs/rigctld/settings');
    var WebRTCOutput = require('app/outputs/webrtc/webrtc');
    var WebRTCOutputSettings = require('app/outputs/webrtc/settings');
    var TextOutput = require('app/outputs/text/text');
    var TextOutputSettings = require('app/outputs/text/settings');

    var OutputManager = function () {

        // Private utility functions

        // Returns 'true' if alarm is triggered
        var check_alarm = function (output, alarm, data) {
            if (alarm.field != "_unused" && alarm.field != "") {
                var field = output.plugin.resolveMapping(alarm.field, data);
                if (field != undefined) {
                    // If both field and alarm.level can be parsed as
                    // numbers, do it (we might have numbers as strings on both sides
                    // which will lead to a wrong comparison)
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

        // Used in Chrome/Cordova mode
        // Do we have an alarm on this output ?
        var alarm = function (output, data) {
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
            if (freq == 0)
                return false;
            if ((output.last_alarm == undefined) ||
                (new Date().getTime() - output.last_alarm > freq * 1000)
            ) {
                output.last_alarm = new Date().getTime();
                return true;
            }

            return false;
        };

        // Used in Chrome/Cordova mode
        // Regular output of data
        var regular = function (output) {
            var freq = output.config.get('frequency');
            if (freq == 0)
                return false;
            if ((new Date().getTime() - output.last) > freq * 1000)
                return true;
            return false;
        }



        // Needs to be public because used in a callback below
        this.activeOutputs = []; // A list of all data output plugins that are enabled (strings)

        this.supportedOutputs = {
            "safecast": {
                name: "SafeCast API",
                plugin: Safecast,
                backend: 'app/outputs/safecast/driver_backend',
                settings: SafecastSettings
            },
            "rest": {
                name: "http REST calls",
                plugin: Rest,
                backend: 'app/outputs/rest/driver_backend',
                settings: RestSettings
            },
            "rigctld": {
                name: "Rigctld emulation",
                plugin: Rigctld,
                backend: 'app/outputs/rigctld/driver_backend',
                settings: RigctldSettings
            },
            "webrtc": {
                name: "WebRTC",
                plugin: WebRTCOutput,
                backend: 'app/outputs/webrtc/driver_backend',
                settings: WebRTCOutputSettings
            }
        };

        // Some outputs are only supported in server mode for now:
        if (vizapp.type == 'server') {
            this.supportedOutputs['text'] = {
                name: "Text",
                plugin: TextOutput,
                backend: null,
                settings: TextOutputSettings
            };
        }

        // Called in Chrome/Cordova mode - not properly implemented
        this.reconnectOutputs = function (a, b, c) {
            console.log('a', a);
            console.log('b', b);
            console.log('c', c);
        }

        // Used by Chrome/Cordova: implements the same API as on the server
        // (outputs/outputmanager.js)
        //  id: ID of the current instrument. We do not actually need it right now
        //      because we only have one instrument connected at a time.
        // driver: this one emits data, we need to subscribe to those data events
        this.enableOutputs = function (id, driver) {
            var self = this;
            console.warn(id);
            var enabled = [];
            var outputs = instrumentManager.getInstrument().outputs;

            // Before anything else, clear the current outputs.
            while (this.activeOutputs.length) {
                // Some plugins want to be told when they are getting closed:
                var out = this.activeOutputs.pop();
                if (out.plugin.onClose)
                    out.plugin.onClose();
            }

            outputs.fetch({
                success: function () {
                    outputs.each(function (output) {
                        if (output.get('enabled')) {
                            console.warn("[outputManager] Enable output " + output.get('type'));
                            var pluginType = self.supportedOutputs[output.get('type')];
                            if (pluginType == undefined) {
                                console.warn("***** WARNING ***** we were asked to enable an output plugin that is not supported but this server");
                            } else {
                                require([pluginType.backend], function (p) {
                                    var backend = new p();
                                    // The plugin needs its metadata and the mapping for the data,
                                    // the output manager will take care of the alarms/regular output
                                    backend.setup(output);
                                    self.activeOutputs.push({
                                        "plugin": backend,
                                        "config": output,
                                        last: new Date().getTime(),
                                        last_alarm: 0
                                    });
                                    // Also subscribe to events coming from the plugin
                                    self.listenTo(backend, 'outputTriggered', self.dispatchOutputEvents);
                                });

                            }
                        }
                    });
                }
            });
        }

        // Used in Chrome/Cordova mode
        // Main feature of our manager: send the data
        // to all active output plugins according to their
        // schedule.
        // Called by chromeSocket when it gets data
        this.output = function (data) {
            for (var idx in this.activeOutputs) {
                var output = this.activeOutputs[idx];
                if (alarm(output, data) || regular(output) || output.config.get('wantsalldata')) {
                    output.plugin.sendData(data);
                    output.last = new Date().getTime();
                }
            }
        };


        // Returns all the fields that are required/supported by a plugin type
        //
        // If a plugin supports a dynamic number of fields, these are defined in
        // the plugin metadata as "numfields". The plugin will return "variable"
        // here instead of a json structure.
        //
        // Some plugins do not work with a concept of output fields, like the rigctld
        // plugin. Those return "none" to indicate there is no mapping.
        this.getOutputFields = function (type) {
            var out = this.supportedOutputs[type];
            if (out != undefined) {
                return out.plugin.outputFields();
            }
            return {};
        }

        // Check if the current plugin requests access to all data or if it wants
        // regular/alarm  settings
        this.pluginWantsAllData = function (type) {
            var out = this.supportedOutputs[type];
            if (out != undefined) {
                return out.plugin.requestAllData();
            }
            return false;
        }

        // Returns all output plugin names that make sense for this instrument.
        // we manage this through the instrument manager because there is a close interaction between
        // what the instrument can output, and the data that is then sent to the output plugin.
        this.getOutputsForCurrentInstrument = function () {
            if (instrumentManager.getInstrument() == null) return {};

            var caps = instrumentManager.getDataType();
            console.info("Caps: " + caps);
            var accepted = {};
            _.each(this.supportedOutputs, function (out, type) {
                var wo = out.plugin.wantOnly();
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
        this.dispatchOutputEvents = function (evt) {
            console.log("Event from plugin");
            this.trigger('outputTriggered', evt);
        }

    };

    _.extend(OutputManager.prototype, Backbone.Events);

    return OutputManager;

});