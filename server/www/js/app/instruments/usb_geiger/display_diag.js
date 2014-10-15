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
            "click .disptest": "disptest",
            "click .setrtc": "setrtc",
            "click #cmdsend": "sendcmd",
            "keypress input#manualcmd": "sendcmd",
            "click #nameset": "setdevtag",
            "keypress input#devname": "setdevtag",
        },

        onClose: function() {
            console.log("[USB Geiger] Diag view closing...");
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
                linkManager.driver.dump_settings();
            }
        },

        disptest: function() {
            linkManager.driver.displaytest();
        },

        setrtc: function() {
            linkManager.driver.settime();
        },

        sendcmd: function(event) {
            // We react both to button press & Enter key press
            if ((event.target.id == "manualcmd" && event.keyCode==13) || (event.target.id != "manualcmd"))
                linkManager.manualCommand($('#manualcmd',this.el).val());
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

            if (data.version != undefined) {
                $('#version',this.el).html(data.version);
                linkManager.driver.guid();
            } else if (data.cpm_output != undefined) {
                $("#cpm_output",this.el).prop("checked",(data.cpm_output[0] == "1"));
            } else if (data.count_enable != undefined) {
                $("#count_enable",this.el).prop("checked",(data.count_enable[0] == "1"));
            } else if (data.pulse_enable != undefined) {
                $("#pulse_enable",this.el).prop("checked",(data.pulse_enable[0] == "1"));
            }
            

        }
    });
});