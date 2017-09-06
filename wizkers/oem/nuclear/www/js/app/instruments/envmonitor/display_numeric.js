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
        roseplot = require('app/lib/flotwindrose'),
        template = require('js/tpl/instruments/envmonitor/NumView.js');


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
            console.log('Main render of Env monitor numeric view');
            this.$el.html(template());
            // We need to force the Live view to resize the map at this
            // stage, becaure we just changed the size of the numview
            if (instrumentManager.liveViewRef() && instrumentManager.liveViewRef().rsc) {
                instrumentManager.liveViewRef().rsc();
            };
            this.addPlot();
            return this;
        },

        onClose: function() {
            console.log("Env monitor numeric view closing...");
            if (this.plot)
                this.plot.onClose();
            linkManager.off('input', this.showInput, this);
        },

        addPlot: function () {
            var self = this;

            this.plot = new roseplot({
                model:this.model,
                settings:this.plotoptions
            });

            if (this.plot != null) {
                this.$('.roseplot').append(this.plot.el);
                this.plot.render();
            }
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

            if (data.wind != undefined) {
                this.plot.appendPoint({'name': 'Wind', 'value': data.wind});
                this.$('#windspeed').html((data.wind.speed).toFixed(1)); // Knots
            }
            if (data.temperature != undefined) {
                this.$('#temperature').html(data.temperature);
            }
            if (data.rel_humidity != undefined) {
                this.$('#rel_humidity').html(data.rel_humidity);
            }

        },


    });
});