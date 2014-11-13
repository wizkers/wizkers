/*
 * Display output of Geiger counter in numeric format
 * Geiger Link provides slightly different outputs from the Onyx, so
 * we are using a different display for it:
 * 
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils    = require('app/utils'),
        template = require('js/tpl/instruments/USBGeigerNumView.js');


    return Backbone.View.extend({

        initialize:function (options) {
            this.sessionStartStamp = new Date().getTime();
            this.maxreading = 0;
            this.minreading = -1;
            this.valid = false;
            this.validinit = false;
            linkManager.on('input', this.showInput, this);
        },

        events: {
        },

        render:function () {
            var self = this;
            console.log('Main render of Onyx numeric view');
            $(this.el).html(template());
            return this;
        },

        onClose: function() {
            console.log("Onyx numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function(data) {
            
            if (data.cpm) {
                var cpm = parseFloat(data.cpm.value);
                $('#livecpm', this.el).html(cpm.toFixed(3));
                $('#liveusvh', this.el).html((cpm*0.00294).toFixed(3) + "&nbsp;&mu;Sv/h");

                if (data.cpm.valid)
                     $('#readingvalid', this.el).removeClass('label-danger').addClass('label-success').html('VALID');
                else
                    $('#readingvalid', this.el).removeClass('label-success').addClass('label-danger').html('INVALID');

                // Update statistics:
                var sessionDuration = (new Date().getTime() - this.sessionStartStamp)/1000;
                $('#sessionlength',this.el).html(utils.hms(sessionDuration));

                if (cpm > this.maxreading) {
                    this.maxreading = cpm;
                    $('#maxreading', this.el).html(cpm);
                }
                if (cpm < this.minreading || this.minreading == -1) {
                    this.minreading = cpm;
                    $('#minreading', this.el).html(cpm);
                }
            } else if (data.count) {
                $('#total_count', this.el).show();
                var count = data.count.value; // Note: should be an integer in the json structure
                var duration = data.count.uptime/1000;
                $('#total_pulse_count', this.el).html(count);
                $('#pulse_count_duration', this.el).html(utils.hms(duration));
                $('#pulse_count_avg',this.el).html((count/duration*60).toFixed(3) + " CPM");
            }

        },


    });
});