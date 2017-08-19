/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/*
 * Live view display of the output of the GammaRAE.
 *  Note that the device does not support live output as far as I can tell, so this
 * only displays a couple of high level parameters (dose, serial number etc) and lets
 * the user go to "settings" and so on.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        Devicelog = require('app/models/devicelog'),
        template = require('js/tpl/instruments/gammarae/LiveView.js');

    return Backbone.View.extend({

        initialize: function (options) {
            var self = this;

            this.showstream = settings.get('showstream');
            this.doseLog = null;
            this.deviceinitdone = false;

            if (vizapp.type == 'cordova') {
                var wz_settings = instrumentManager.getInstrument().get('wizkers_settings');
                if (wz_settings) {
                    if (wz_settings.display_gmaps == 'true')
                        this.display_map = true;
                    if (wz_settings.display_graph == 'false')
                        this.display_graph = false;
                    if (wz_settings.screen_no_dim == 'true') {
                        keepscreenon.enable();
                    } else {
                        keepscreenon.disable();
                    }
                } else {
                    // Happens when the user never explicitely set the map option
                    this.display_map = true;
                }
            }

            // For the GammaRAE we are defining one specific log for the dose
            var ins = instrumentManager.getInstrument();
            ins.logs.fetch({
                success: function () {
                    // We now want to find out if the dose log already exists
                    var myLogs = ins.logs.where({ name: 'Dose log'});
                    if (myLogs.length == 0) {
                        self.createDoseLog();
                    } else {
                        console.log('Found dose log');
                        if (myLogs.length != 1) {
                            console.error('Multiple dose logs ???');
                            return;
                        }
                        self.doseLog = myLogs[0];
                        self.fetchDoseLog();
                    }
                },
                error: function (msg) {
                    console.log("[GammaRAE Live] Log fetch error: ");
                    console.log(msg);
                    console.log(logs);
                }
            });

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);

        },

        createDoseLog: function() {
            var self = this;
            console.log('Dose log does not exist');
            this.doseLog = new Devicelog.Log();
            this.doseLog.set('name', 'Dose log');
            this.doseLog.set('description', 'Dose log for the device');
            this.doseLog.set('logtype', 'dose');
            instrumentManager.getInstrument().logs.add(this.doseLog);
            this.doseLog.save(null, {
                success: function () {
                    console.log('Dose Log initialized, getting entries');
                    self.fetchDoseLog();
                },
                error: function (obj, err) {
                    console.log(err);
                }
            });
        },

        fetchDoseLog: function() {
            var self = this;
            var queryDose = function() {
                if (linkManager.isConnected())
                    linkManager.sendCommand({command: 'get_dose'});
                else
                    self.updateDoseTable();
            };
            this.doseLog.entries.fetch({
                    success: queryDose,
                });
        },

        updateDoseTable: function() {
            var self = this;
            self.$('#dosetable').empty();
            self.$('#dosetable').append('<tr><th>Date</th><th>Dose (&mu;Sv)</th></tr>');
            this.doseLog.entries.forEach(function(entry) {
                var row = '<tr><td>' + new Date(entry.get('timestamp')).toISOString() + '</td>';
                row += '<td>' + entry.get('data') + '</td></tr>';
                self.$('#dosetable').append(row);
            });
        },

        events: {
        },

        render: function () {
            var self = this;
            console.log('Main render of GammaRAE live view');
            this.$el.html(template());

            // Hide the raw data stream if we don't want it
            if (!this.showstream) {
                $("#showstream", this.el).empty();
            }
            if (linkManager.isConnected()) {
                linkManager.sendCommand({command: 'main_params'});
                this.deviceinitdone = true;
            }
            return this;
        },

        clear: function () {
        },

        onClose: function () {
            console.log("GammaRAE live view closing...");
            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
            if (this.rsc)
                $(window).off('resize', this.rsc);
            if (this.plot)
                this.plot.onClose();
        },

        updatestatus: function (data) {
            // Either the port is open and we have not done our device init,
            // or the port is closed and we have to reset the device init status
            if (data.portopen && !this.deviceinitdone) {
                linkManager.sendCommand({command: 'main_params'});
                if (this.doseLog != null)
                    linkManager.sendCommand({command: 'get_dose'});
                this.deviceinitdone = true;
            } else if (!data.portopen) {
                this.deviceinitdone = false;
            }
        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            var self = this;

            if (this.showstream) {
                // Update our raw data monitor
                var i = $('#input', this.el);
                var scroll = (i.val() + JSON.stringify(data) + '\n').split('\n');
                // Keep max 50 lines:
                if (scroll.length > 50) {
                    scroll = scroll.slice(scroll.length - 50);
                }
                i.val(scroll.join('\n'));
                // Autoscroll:
                i.scrollTop(i[0].scrollHeight - i.height());
            }

            if (data.uid != undefined) {
                this.$('#gr-uid').html(data.uid);
            }

            if (data.dose != undefined) {
                // The strategy here is that if the dose has not changed, we simply
                // update latest timestamp in the log, otherwise we create a new
                // log entry.
                // Note: if we only have one entry, don't update it, create another
                // one always, so that we have a timestamp for the first time we read
                // the accumulated dose.
                if (this.doseLog.entries.length > 1) {
                    var latest = this.doseLog.entries.at(this.doseLog.entries.length -1);
                    var ts = latest.get('timestamp');
                    var d = latest.get('data');
                    if (data.dose == d) {
                        // Update the timestamp
                        latest.save({ timestamp: new Date().getTime() });
                    } else {
                    // Create a new entry
                     this.doseLog.entries.create({
                        timestamp: new Date().getTime(),
                        logsessionid: this.doseLog.id,
                        data: data.dose
                        });
                    }
                } else {
                    // Create the first entry in the log
                     this.doseLog.entries.create({
                        timestamp: new Date().getTime(),
                        logsessionid: this.doseLog.id,
                        data: data.dose
                    });
                }
                    this.updateDoseTable();
            }

            if (data.model_name != undefined) {
                this.$('#gr-model').html(data.model_name);
            }
            if (data.model_number != undefined) {
                this.$('#gr-pn').html(data.model_number);
            }
            if (data.fw_rev != undefined) {
                this.$('#gr-fwversion').html(data.fw_rev);
            }
            if (data.battery != undefined) {
                this.$('#gr-batt').html(data.battery + ' V');
            }
            if (data.temp != undefined) {
                this.$('#gr-temp').html(data.temp+  ' &deg;C');
            }
            if (data.clock != undefined) {
                this.$('#gr-clock').html(data.clock);
            }
            if (data.sens_calib_date != undefined) {
                this.$('#sens-calib-date').html(data.sens_calib_date);
            }
        },
    });
});