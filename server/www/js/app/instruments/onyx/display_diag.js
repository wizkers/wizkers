/**
 * Diag and settings screen
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 *
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        tpl     = require('text!tpl/instruments/OnyxDiagView.html'),
        template = null;
        
        try {
            template = _.template(tpl);
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            template = require('js/tpl/instruments/OnyxDiagView.js', function(){} , function(err) {
                            console.log("Compiled JS preloading error callback.");
                            });
        }

    return Backbone.View.extend({

        initialize:function () {
            linkManager.on('input', this.showInput, this);

            if (linkManager.streaming)
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
            console.log("Onyx Diag view closing...");
            linkManager.off('input', this.showInput);
        },

        render:function () {
            var self = this;
            this.$el.html(template(this.model.toJSON()));

            this.refresh();
            return this;
        },

        refresh: function() {
            $('#accessorydetect',this.el).empty();
            $('#post',this.el).removeClass('badge-success').removeClass('badge-important');
            $('#post',this.el).html("Waiting...");
            $('#post2',this.el).html('');
            // Query controller for various info:
            this.queriesDone = false;
            if (linkManager.connected) {
                linkManager.driver.version();            
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
            }
            if (data.guid != undefined) {
                $('#guid',this.el).html(data.guid);
                linkManager.driver.devicetag();
            }
            if (data.devicetag != undefined) {
                $('#devname', this.el).val(data.devicetag);
            }

        }
    });
});