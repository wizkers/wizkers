/**
 * Diag and settings screen for the USB Geiger dongle
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
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
            "click #deadset": "setdeadtime",
            "keypress input#deadtime" : "setdeadtime",
            "change #output_control input": "setup_outputs",
            "click .windows-update" : "save_windows",
            "change #aux_enable": "setup_auxport"
        },

        onClose: function() {
            console.log("[USB Geiger] Diag view closing...");
            linkManager.manualCommand("d:0"); // Disable debug output
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
                linkManager.manualCommand("d:1"); // Enable debug output
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
            }
        },
        
        setup_auxport: function(evt) {
            var checked = $(evt.target).is(':checked');
            if (checked) {
                var br = parseInt($("#aux_baudrate",this.el).val());
                if (!isNaN(br))
                    linkManager.manualCommand("S:" + br);
                    $("#aux_baudrate",this.el).prop("disabled",true);
            } else {
                linkManager.manualCommand("S:0");
                $("#aux_baudrate",this.el).prop("disabled",false);
            }
            
        },
        
        save_windows: function(evt) {
            var win1_size = parseInt($("#window1_size",this.el).val());
            var win1_thr = parseInt($("#window1_threshold",this.el).val());
            var win2_size = parseInt($("#window2_size",this.el).val());
            var win2_thr = parseInt($("#window2_threshold",this.el).val());
            
            if (win1_thr > win2_thr) {
                $("#windows_warn",this.el).addClass("alert-danger").html("Error: Window 1 limit must be lower than Window 2 limit");
                return;
            } 
            $("#windows_warn",this.el).empty();
            linkManager.manualCommand("A:" + win1_size);
            linkManager.manualCommand("B:" + win2_size);
            linkManager.manualCommand("C:" + win2_thr);
            linkManager.manualCommand("E:" + win1_thr);
            $("#windows_warn",this.el).addClass("alert-success").html("Success: Window params saved to dongle.");
            
        },

        sendcmd: function(event) {
            // We react both to button press & Enter key press
            if ((event.target.id == "manualcmd" && event.keyCode==13) || (event.target.id != "manualcmd"))
                linkManager.manualCommand($('#manualcmd',this.el).val());
        },
        
        setdeadtime: function(event) {
            // We react both to button press & Enter key press
            if ((event.target.id == "deadtime" && event.keyCode==13) || (event.target.id != "deadtime"))
                linkManager.manualCommand("F:" + $('#deadtime',this.el).val());
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
                linkManager.driver.guid();
            } else if (data.cpm_output != undefined) {
                $("#cpm_output",this.el).prop("checked",(data.cpm_output[0] == "1"));
            } else if (data.count_enable != undefined) {
                $("#count_enable",this.el).prop("checked",(data.count_enable[0] == "1"));
            } else if (data.pulse_enable != undefined) {
                $("#pulse_enable",this.el).prop("checked",(data.pulse_enable[0] == "1"));
            } else if (data.cpm_factor != undefined) {
                $("#deadtime",this.el).val(data.cpm_factor[0]);
            } else if (data.window1_size != undefined) {
                $("#window1_size",this.el).val(data.window1_size[0]);
            } else if (data.window2_size != undefined) {
                $("#window2_size",this.el).val(data.window2_size[0]);
            } else if (data.window3_size != undefined) {
                $("#window3_size",this.el).val(data.window3_size[0]);
            } else if (data.window1_threshold != undefined) {
                $("#window1_threshold",this.el).val(data.window1_threshold[0]);
            } else if (data.window2_threshold != undefined) {
                $("#window2_threshold",this.el).val(data.window2_threshold[0]);
            } else if (data.aux_port_enable != undefined) {
                $("#aux_enable",this.el).prop("checked",(data.aux_port_enable[0] == "1"));
                $("#aux_baudrate",this.el).prop("disabled",(data.aux_port_enable == "1"));
                
            } else if (data.aux_port_speed != undefined) {
                $("#aux_baudrate",this.el).val(data.aux_port_speed[0]);
            } 
        }
    });
});