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
 * Live view display of the output of the Kestrel weather stations
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        simpleplot = require('app/lib/flotplot'),
        template = require('js/tpl/instruments/weatherflow/LiveView.js');

    return Backbone.View.extend({

        initialize: function (options) {

            this.showstream = settings.get('showstream');

            this.update_count = 0;
            // Get frequency and span if specified:
            var span = this.model.get('liveviewspan'); // In seconds
            var period = this.model.get('liveviewperiod'); // Polling frequency
            this.datasetlength = 0;

            var livepoints = 300; // 5 minutes @ 1 Hz
            if (span && period) {
                livepoints = span / period;
            }

            if (vizapp.type == 'cordova') {
                var wz_settings = instrumentManager.getInstrument().get('wizkers_settings');
                if (wz_settings) {
                    if (wz_settings.screen_no_dim == 'true') {
                        keepscreenon.enable();
                    } else {
                        keepscreenon.disable();
                    }
                } else {
                    // Happens when the user never explicitely set the screen dim
                    keepscreenon.disable();
                }
            }

            // Here are all the options we can define, to pass as "settings" when creating the view:
            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: livepoints,
                vertical_stretch_parent: true,
                plot_options: {
                    xaxis: {
                        mode: "time",
                        show: true,
                        timeformat: "%H:%M",
                        timezone: settings.get("timezone")
                    },
                    grid: {
                        hoverable: true
                    },
                    legend: {
                        show: false,
                        position: "ne"
                    }
                }
            };

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);

        },


        events: {},

        render: function () {
            var self = this;
            console.log('Main render of Kestrel 5 view');
            this.$el.html(template());

            // Hide the raw data stream if we don't want it
            if (!this.showstream) {
                $('#showstream', this.el).css('visibility', 'hidden');
            }

            linkManager.requestStatus();
            this.addPlot();
            return this;
        },

        addPlot: function () {
            var self = this;

            this.tempRHplot = new simpleplot({
                model:this.model,
                settings:this.plotoptions
            });

            if (this.tempRHplot != null) {
                this.$('#tempRHchart').append(this.tempRHplot.el);
                this.tempRHplot.render();
            }

            this.baroplot = new simpleplot({
                model:this.model,
                settings:this.plotoptions
            });

            if (this.baroplot != null) {
                this.$('#barochart').append(this.baroplot.el);
                this.baroplot.render();
            }


            // Haven't found a better way so far:
            var self = this;
            var rsc = function () {
                // We want the chart to be 30% of the screen
                self.$('#tempRHchart').height(window.innerHeight * 0.3);
                if (self.tempRHplot && self.tempRHplot.rsc)
                    self.tempRHplot.rsc();
                var chartheight = self.$('#tempchart_row').outerHeight();
                var numviewheight = 0;
                // We want to take the numview height into account if screen is xs or sm
                if (utils.checkBreakpoint('xs') || utils.checkBreakpoint('sm'))
                    numviewheight = $('#numview').outerHeight();
                var baroheight = window.innerHeight - $(self.el).offset().top - chartheight - numviewheight - 150;
                self.$('#barochat_row').show();
                if (baroheight < 100)
                    baroheight = 100; // If we dont' have space, just let the screen scroll, better
                                          // than a completely broken layout.
                self.$('#barochart').height(baroheight);
                if (self.baroplot && self.baroplot.rsc)
                    self.baroplot.rsc();
            }
            if (this.rsc)
                $(window).off('resize', this.rsc);
            this.rsc = rsc;
            $(window).on('resize', this.rsc);
            rsc();
        },

        onClose: function () {
            console.log("Kestrel live view closing...");
            linkManager.stopLiveStream();
            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
            if (this.rsc)
                $(window).off('resize', this.rsc);
            if (this.plot)
                this.plot.onClose();
            if (this.neutronplot)
                this.neutronplot.onClose();
        },

        updatestatus: function (data) {
            console.log("Weatherflow live display: link status update");
            if (data.portopen && ! linkManager.isStreaming() ) {
                linkManager.driver.serial();
                linkManager.startLiveStream();
            }
        },

        clear: function () {
            this.$('#tempRHchart').empty();
            this.$('#barochart').empty();
            this.addPlot();
            this.suspendGraph = true;
        },

        // Make sure the color labels for each measurement
        // match the graph color
        update_colorlabels: function() {
            var dataset = this.tempRHplot.plot.getData();
            // Skip all this if we don't have new variables
            // in our dataset that might require updating the label
            // colors
            if (dataset.length == this.datasetlength)
                return;
            this.datasetlength = dataset.length;
            for (var i = 0; i < dataset.length; ++i) {
                var series = dataset[i];
                this.$('#' + series.label + '-color').css('border', '5px solid ' + series.color);
            }
        },

        disp_wx: function (data, ts) {
            var dp;

            if (data.temperature != undefined) {
                dp = {'name': 'temperature',
                         'value': data.temperature,
                        'timestamp': ts};
                if (typeof ts != 'undefined') {
                    this.tempRHplot.fastAppendPoint(dp);
                } else {
                    this.tempRHplot.appendPoint(dp);
                    this.$('#tempreading').html(data.temperature + '&nbsp;&deg;');
                }
            }
            if (data.dew_point != undefined) {
                dp = {'name': 'dew_point',
                      'value': data.dew_point,
                      'timestamp': ts};
                if (typeof ts != 'undefined') {
                    this.tempRHplot.fastAppendPoint(dp);
                } else {
                    this.tempRHplot.appendPoint(dp);
                    this.$('#dewpointreading').html(data.dew_point + '&nbsp;&deg;');
                }
            }
            if (data.rel_humidity != undefined) {
                dp = {'name': 'rel_humidity',
                      'value': data.rel_humidity,
                      'timestamp': ts};
                if (typeof ts != 'undefined') {
                    this.tempRHplot.fastAppendPoint(dp);
                } else {
                    this.tempRHplot.appendPoint(dp);
                    this.$('#rhreading').html(data.rel_humidity + '&nbsp;%');
                }
            }

            if (data.pressure != undefined) {
                dp = {'name': 'pressure', 'value': data.pressure,
                      'timestamp': ts};
                if (typeof ts != 'undefined') {
                    this.baroplot.fastAppendPoint(dp);
                } else {
                    this.baroplot.appendPoint(dp);
                    this.$('#pressurereading').html(data.pressure + '&nbsp;mb');
                }
            }

            if (typeof ts != 'undefined')
                return;

            this.update_colorlabels();

            if (data.uv_index != undefined) {
                this.$('#uvindex').html((data.uv_index).toFixed(1));
                if (data.uv_index < 2) {
                    // this.$('#uvdiv').css('background', 'linear-gradient(to bottom, #4caf50 0%, #4caf50 63%,transparent 97%)');
                    this.$('#uvdiv').css('background', '#4caf50');
                } else if (data.uv_index < 5) { 
                    this.$('#uvdiv').css('background', '#ffd715');
                }  else if (data.uv_index < 7) {
                    this.$('#uvdiv').css('background', '#f57f20');
                } else if (data.uv_index < 10) {
                    this.$('#uvdiv').css('background', '#e51c23');
                } else {
                    this.$('#uvdiv').css('background', '#7d33f5');
                }
            }

            if(data.brightness != undefined) {
                this.$('#brightness').html((data.brightness));
            }
            if(data.solar_radiation != undefined) {
                this.$('#solar_radiation').html((data.solar_radiation));
            }


        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            var self = this;

            if (data.replay_ts != undefined) {
                this.suspend_graph = false;
                this.disp_wx(data.data, data.replay_ts);
                return;
            }

            // We're waiting for a data replay
            if (this.suspend_graph)
                return;

            // Grey out readings if we lost connectivity to the Kestrel 5 unit
            if (data.reconnecting != undefined ) {
                this.$('#liveview_in').css('color', data.reconnecting ? '#a1a1a1' : '#000000');
            }

            this.disp_wx(data);
        },
    });

});