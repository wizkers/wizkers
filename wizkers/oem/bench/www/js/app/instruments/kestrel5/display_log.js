/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2017 Edouard Lafargue, ed@wizkers.io
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
 * Log view display of the output of the Kestrel weather stations
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
        template = require('js/tpl/instruments/kestrel5/LogView.js');

    return Backbone.View.extend({

        initialize: function (options) {


            this.deviceLogs = this.collection;


            // Here are all the options we can define, to pass as "settings" when creating the view:
            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: 0,
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

            // Now fetch all the contents, then render
            var renderGraph = _.after(this.deviceLogs.length, this.render.bind(this));
            this.deviceLogs.each(function (log) {
                log.entries.fetch({
                    success: renderGraph,
                    xhr: function () {
                        var xhr = $.ajaxSettings.xhr();
                        xhr.onprogress = self.handleProgress;
                        return xhr;
                    }
                });
            });

        },

        handleProgress: function (e) {
            $('#loadtext').html("Loaded: " + e.loaded + " bytes");
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

            this.addPlot();

            if (this.packedData == null || this.packedData.length == 0)
                this.packData();

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
                var baroheight = window.innerHeight - $(self.el).offset().top - chartheight - numviewheight - 50;
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

        // Depending on log type, we need to pack our data differently...
        packData: function () {
            var self = this;
            // Create a table of Y values with the x values from our collection
            var data = [];
            var logs = this.deviceLogs;
            // At this stage we know the logs are already fetched, btw
            for (var j = 0; j < logs.length; j++) {
                var ret = [];
                var value = logs.at(j).entries;
                var type = logs.at(j).get('logtype');
                for (var i = 0; i < value.length; i++) {
                    var entry = value.at(i);
                    var ts = new Date(entry.get('timestamp')).getTime();
                    this.disp_wx(entry.get('data'), ts);
                }
            }

            this.tempRHplot.redraw();
            this.baroplot.redraw();
            return data;
        },

        onClose: function () {
            console.log("Kestrel log view closing...");
            if (this.rsc)
                $(window).off('resize', this.rsc);
            if (this.plot)
                this.plot.onClose();
            if (this.tempRHplot)
                this.tempRHplot.onClose();
        },

        clear: function () {
            this.$('#tempRHchart').empty();
            this.$('#barochart').empty();
            this.addPlot();
            this.suspendGraph = true;
        },

        disp_wx: function (data, ts) {
            var dp;

            if (data.temperature != undefined) {
                dp = {'name': 'Temp',
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
                dp = {'name': 'Dew Point',
                      'value': data.dew_point,
                      'timestamp': ts};
                if (typeof ts != 'undefined') {
                    this.tempRHplot.fastAppendPoint(dp);
                } else {
                    this.tempRHplot.appendPoint(dp);
                    this.$('#dewpointreading').html(data.dew_point + '&nbsp;&deg;');
                }
            }
            if (data.heat_index != undefined) {
                dp = {'name': 'Heat Index',
                      'value': data.heat_index,
                      'timestamp': ts};
                if (typeof ts != 'undefined') {
                    this.tempRHplot.fastAppendPoint(dp);
                } else {
                    this.tempRHplot.appendPoint(dp);
                    this.$('#heatindexreading').html(data.heat_index + '&nbsp;&deg;');
                }
            }
            if (data.wetbulb != undefined) {
                dp = {'name': 'Wet Bulb',
                      'value': data.wetbulb,
                      'timestamp': ts};
                if (typeof ts != 'undefined') {
                    this.tempRHplot.fastAppendPoint(dp);
                } else {
                    this.tempRHplot.appendPoint(dp);
                    this.$('#wetbulbreading').html(data.wetbulb + '&nbsp;&deg;');
                }
            }
            if (data.wind_chill != undefined) {
                dp = {'name': 'Wind Chill',
                      'value': data.wind_chill,
                      'timestamp': ts};
                if (typeof ts != 'undefined') {
                    this.tempRHplot.fastAppendPoint(dp);
                } else {
                    this.tempRHplot.appendPoint(dp);
                    this.$('#windchillreading').html(data.wind_chill + '&nbsp;&deg;');
                }
            }

            if (data.rel_humidity != undefined) {
                dp = {'name': 'RH',
                      'value': data.rel_humidity,
                      'timestamp': ts};
                if (typeof ts != 'undefined') {
                    this.tempRHplot.fastAppendPoint(dp);
                } else {
                    this.tempRHplot.appendPoint(dp);
                    this.$('#rhreading').html(data.rel_humidity + '&nbsp;' + data.unit.rel_humidity);
                }
            }

            if (data.barometer != undefined) {
                dp = {'name': 'Baro',
                      'value': data.barometer,
                      'timestamp': ts};
                if (typeof ts != 'undefined') {
                    this.baroplot.fastAppendPoint(dp);
                } else {
                    this.baroplot.appendPoint(dp);
                    this.$('#baroreading').html(data.barometer + '&nbsp;' + data.unit.barometer);
                }
            }
            if (data.pressure != undefined) {
                dp = {'name': 'Pressure', 'value': data.pressure,
                      'timestamp': ts};
                if (typeof ts != 'undefined') {
                    this.baroplot.fastAppendPoint(dp);
                } else {
                    this.baroplot.appendPoint(dp);
                    this.$('#pressurereading').html(data.pressure + '&nbsp;' + data.unit.pressure);
                }
            }

            if (typeof ts != 'undefined')
                return;

            if (data.altitude != undefined) {
                this.$('#altitudereading').html(data.altitude + '&nbsp;' + data.unit.altitude);
            }
            if (data.dens_altitude != undefined) {
                this.$('#densaltitudereading').html(data.dens_altitude + '&nbsp;' + data.unit.dens_altitude);
            }
        },

    });

});