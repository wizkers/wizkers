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
 * Diag and settings screen for the USB Geiger dongle
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/USBGeigerSettingsView.js');

    return Backbone.View.extend({

        initialize:function () {
            linkManager.on('input', this.showInput, this);

            if (!linkManager.isRecording())
                linkManager.stopLiveStream();
        },

        events: {
            "click .refresh": "refresh",
            "click #cmdsend": "sendcmd",
            "keypress input#manualcmd": "sendcmd",
            "click #deadset1": "setdeadtime",
            "keypress input#deadtime1" : "setdeadtime",
            "click #deadset2": "setdeadtime2",
            "keypress input#deadtime2" : "setdeadtime2",
            "change #output_control input": "setup_outputs",
            "click .windows-update" : "save_windows",
            "click #rateset": "rateset",
            "keypress input#output_rate" : "rateset",
            "change #aux_enable": "setup_auxport"
        },

        onClose: function() {
            console.log("[USB Geiger] Diag view closing...");
            linkManager.sendCommand("d:0"); // Disable debug output
            linkManager.off('input', this.showInput);
        },

        render:function () {
            var self = this;
            this.$el.html(template(this.model.toJSON()));

            this.refresh();
            return this;
        },

        refresh: function() {
            // Query controller for various info:
            this.queriesDone = false;
            if (linkManager.isConnected()) {
                linkManager.driver.version();
                linkManager.sendCommand("d:1"); // Enable debug output
                linkManager.driver.dump_settings();
            }
        },
        
        setup_outputs: function(evt) {
            var checked = $(evt.target).is(':checked');
            switch (evt.target.id) {
                case 'cpm_output':
                    linkManager.driver.cpm_output(checked);
                break;
                case 'pulse_enable':
                    linkManager.driver.pulse_enable(checked);
                break;
                case 'count_enable':
                    linkManager.driver.count_enable(checked);
                break;
                case 'dual_enable':
                    linkManager.driver.dual_enable(checked);
                break;
            }
        },
        
        setup_auxport: function(evt) {
            var checked = $(evt.target).is(':checked');
            if (checked) {
                var br = parseInt($("#aux_baudrate",this.el).val());
                if (!isNaN(br))
                    linkManager.sendCommand("S:" + br);
                    $("#aux_baudrate",this.el).prop("disabled",true);
            } else {
                linkManager.sendCommand("S:0");
                $("#aux_baudrate",this.el).prop("disabled",false);
            }
            
        },
        
        save_windows: function(evt) {
            var i1_win1_size = parseInt($("#input1_window1_size",this.el).val());
            var i1_win1_thr = parseInt($("#input1_window1_threshold",this.el).val());
            var i1_win2_size = parseInt($("#input1_window2_size",this.el).val());
            var i1_win2_thr = parseInt($("#input1_window2_threshold",this.el).val());

            var i2_win1_size = parseInt($("#input2_window1_size",this.el).val());
            var i2_win1_thr = parseInt($("#input2_window1_threshold",this.el).val());
            var i2_win2_size = parseInt($("#input2_window2_size",this.el).val());
            var i2_win2_thr = parseInt($("#input2_window2_threshold",this.el).val());

            if (i1_win1_thr > i1_win2_thr ||
                i2_win1_thr > i2_win2_thr) {
                $("#windows_warn",this.el).addClass("alert-danger").html("Error: Window 1 limit must be lower than Window 2 limit");
                return;
            } 
            $("#windows_warn",this.el).empty();
            linkManager.sendCommand("A:" + i1_win1_size + ":" + i1_win2_size + ":" +
                                           i1_win1_thr + ":" + i1_win2_thr);
            linkManager.sendCommand("B:" + i2_win1_size + ":" + i2_win2_size + ":" +
                                           i2_win1_thr + ":" + i2_win2_thr);
            
            $("#windows_warn",this.el).addClass("alert-success").html("Success: Window params saved to dongle.");
            
        },

        sendcmd: function(event) {
            // We react both to button press & Enter key press
            if ((event.target.id == "manualcmd" && event.keyCode==13) || (event.target.id != "manualcmd"))
                linkManager.sendCommand($('#manualcmd',this.el).val());
        },
        
        setdeadtime: function(event) {
            // We react both to button press & Enter key press
            if ((event.target.id == "deadtime1" && event.keyCode==13) || (event.target.id != "deadtime1"))
                linkManager.sendCommand("F:" + $('#deadtime1',this.el).val());
        },

        setdeadtime2: function(event) {
            // We react both to button press & Enter key press
            if ((event.target.id == "deadtime2" && event.keyCode==13) || (event.target.id != "deadtime2"))
                linkManager.sendCommand("G:" + $('#deadtime2',this.el).val());
        },

        rateset: function(event) {
            // We react both to button press & Enter key press
            if ((event.target.id == "output_rate" && event.keyCode==13) || (event.target.id != "output_rate"))
                linkManager.sendCommand("R:" + $('#output_rate',this.el).val());
        },
        
        setdevtag: function(event) {
            if ((event.target.id == "devname" && event.keyCode==13) || (event.target.id != "devname"))
                linkManager.driver.setdevicetag($('#devname',this.el).val());
        },


        showInput: function(data) {
            // Blink the indicator to show we're getting data
            $('.comlink', this.el).toggleClass('btn-success');
            var i = $('#input',this.el);
            i.val(i.val() + JSON.stringify(data) + '\n');
            // Autoscroll:
            i.scrollTop(i[0].scrollHeight - i.height());

            if (data.cpm != undefined) {
                $("#cpmvalue", this.el).html(" " + data.cpm.value + " CPM");
                $("#freqvalue",this.el).html((data.cpm.value/60).toFixed(3) + " Hz");
            } else if (data.HZ != undefined) {
                $("#rawfreqvalue", this.el).html(data.HZ[0] + " Hz");
                $("#current_window",this.el).html(" (" + data.HZ[4] + " sec window)");
            } else if (data.version != undefined) {
                $('#version',this.el).html(data.version);
            } else if (data.output_rate != undefined) {
                $("#output_rate",this.el).val(data.output_rate[0]);
            } else if (data.cpm_enable != undefined) {
                $("#cpm_enable",this.el).prop("checked",(data.cpm_enable[0] == "1"));
            } else if (data.dual_enable != undefined) {
                $("#dual_enable",this.el).prop("checked",(data.dual_enable[0] == "1"));
            } else if (data.count_enable != undefined) {
                $("#count_enable",this.el).prop("checked",(data.count_enable[0] == "1"));
            } else if (data.pulse_enable != undefined) {
                $("#pulse_enable",this.el).prop("checked",(data.pulse_enable[0] == "1"));
            } else if (data.cpm_factor1 != undefined) {
                $("#deadtime1",this.el).val(data.cpm_factor1[0]);
            } else if (data.cpm_factor2 != undefined) {
                $("#deadtime2",this.el).val(data.cpm_factor2[0]);
            } else if (Object.keys(data)[0].indexOf("input") == 0) {
                // This autopopulates all settings starting with "input",
                // but we have to be careful the ID of the html element matches
                // the name of the setting:
                var key = Object.keys(data)[0];
                $("#" + key, this.el).val(data[key][0]);
            } else if (data.aux_port_enable != undefined) {
                $("#aux_enable",this.el).prop("checked",(data.aux_port_enable[0] == "1"));
                $("#aux_baudrate",this.el).prop("disabled",(data.aux_port_enable == "1"));
                
            } else if (data.aux_port_speed != undefined) {
                $("#aux_baudrate",this.el).val(data.aux_port_speed[0]);
            } 
        }
    });
});