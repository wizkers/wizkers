/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * Display output of Geiger counter in numeric format
 * Geiger Link provides slightly different outputs from the Onyx, so
 * we are using a different display for it:
 * 
 * @author Edouard Lafargue, ed@lafargue.name
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
            this.maxreading_2 = 0;
            this.minreading_2 = -1;
            this.valid = false;
            this.validinit = false;
            linkManager.on('input', this.showInput, this);
        },

        events: {
        },

        render:function () {
            var self = this;
            console.log('Main render of Onyx numeric view');
            this.$el.html(template());
            // We need to force the Live view to resize the map at this
            // stage, becaure we just changed the size of the numview
            if (instrumentManager.liveViewRef() && instrumentManager.liveViewRef().rsc) {
                instrumentManager.liveViewRef().rsc();
            };
            return this;
        },

        onClose: function() {
            console.log("Onyx numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function(data) {
            
            if (data.cpm) {
                var cpm = parseFloat(data.cpm.value);
                $('#livecpm', this.el).html(cpm.toFixed(0));
                //$('#liveusvh', this.el).html((cpm*0.00294).toFixed(3) + "&nbsp;&mu;Sv/h");
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
                
                if (data.cpm2) {
                    $('.dual_input', this.el).show();
                    cpm = parseFloat(data.cpm2.value);
                    $('#livecpm_2', this.el).html(cpm.toFixed(0));
                    //$('#liveusvh', this.el).html((cpm*0.00294).toFixed(3) + "&nbsp;&mu;Sv/h");
                    if (data.cpm2.valid)
                         $('#readingvalid_2', this.el).removeClass('label-danger').addClass('label-success').html('VALID');
                    else
                        $('#readingvalid_2', this.el).removeClass('label-success').addClass('label-danger').html('INVALID');

                    if (cpm > this.maxreading_2) {
                        this.maxreading_2 = cpm;
                        $('#maxreading_2', this.el).html(cpm);
                    }
                    if (cpm < this.minreading_2 || this.minreading_2 == -1) {
                        this.minreading_2 = cpm;
                        $('#minreading_2', this.el).html(cpm);
                    }

                } else {
                    $('.dual_input', this.el).hide();
                }
                
            } else if (data.counts) {
                $('#total_count', this.el).show();
                var count = data.counts.input1; // Note: should be an integer in the json structure
                var duration = data.counts.uptime/1000;
                $('#total_pulse_count', this.el).html(count);
                $('#pulse_count_duration', this.el).html(utils.hms(duration));
                $('#pulse_count_avg',this.el).html((count/duration*60).toFixed(3) + " CPM");
                if (data.counts.input2) {
                    count = data.counts.input2;
                    $('#total_pulse_count_2', this.el).html(count);
                    $('#pulse_count_avg_2',this.el).html((count/duration*60).toFixed(3) + " CPM");
                }
            }

        },


    });
});