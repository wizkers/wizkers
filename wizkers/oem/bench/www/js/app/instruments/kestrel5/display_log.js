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
        roseplot = require('app/lib/flotwindrose'),
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
                    crosshair: {
				        mode: "x"
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

            this.altitudereadings = [];
            this.dens_altitudereadings = [];

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
            this.dirplot = new roseplot({
                model:this.model,
                settings:this.plotoptions
            });

            if (this.dirplot != null) {
                this.$('.roseplot').append(this.dirplot.el);
                this.dirplot.render();
            }

            this.windplot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.windplot != null) {
                this.$('#windspeedchart').append(this.windplot.el);
                this.windplot.render();
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

            // Last: listen to plot hover events from the crosshair to update
            // the readings
            // we need to bind to this object, otherwise the context will be the DOM element.
            this.$('#tempRHchart').on('plothover', this.displayReadings.bind(this));
            this.$('#barochart').on('plothover', this.displayReadings.bind(this));
            this.$('#windspeedchart').on('plothover', this.displayReadings.bind(this));
        },

        // Callback for reading display, throttled
        displayReadings: function(event, pos, item) {
            this.latestPosition = pos;
			if (!this.updateLegendTimeout) {
				this.updateLegendTimeout = setTimeout(this.updateReadings.bind(this), 100);
			}
        },

        // Actual update (async, throttled)
        updateReadings: function(event, pos, item) {
            // Source for this: http://www.flotcharts.org/flot/examples/tracking/index.html
            var self = this;
            this.updateLegendTimeout = null;
            var pos = this.latestPosition;

            // Sync the crosshairs on both plots
            this.baroplot.plot.setCrosshair(pos);
            this.tempRHplot.plot.setCrosshair(pos);
            this.windplot.plot.setCrosshair(pos);

            // Update readings on Temp plot
            var update = function(plot) {
                var axes = plot.plot.getAxes();
                if (pos.x < axes.xaxis.min || pos.x > axes.xaxis.max)
                    return;

                var i, j, dataset = plot.plot.getData();
                for (i = 0; i < dataset.length; ++i) {
                    var series = dataset[i];
                    // Find the nearest points, x-wise
                    for (j = 0; j < series.data.length; ++j) {
                        if (series.data[j][0] > pos.x) {
                            break;
                        }
                    }
                    var ts = new Date(series.data[j-1][0]);
                    var tss = (settings.get("timezone") == "browser") ? ts.toString() : ts.toUTCString();
                    self.$('#timestamp').html(tss);
                    // Now Interpolate
                    var y, p1 = series.data[j - 1],
                        p2 = series.data[j];
                    if (p1 == null) {
                        y = p2[1];
                    } else if (p2 == null) {
                        y = p1[1];
                    } else {
                        y = p1[1] + (p2[1] - p1[1]) * (pos.x - p1[0]) / (p2[0] - p1[0]);
                    }
                    self.$('#' + series.label).html(y.toFixed(1));
                }
            }
            update(this.tempRHplot);
            update(this.baroplot);
            update(this.windplot);
            // Now update the altitude/dens altitude readings:
            var alt = this.altitudereadings.findIndex(function(elem) {
                return elem[0] >= pos.x
            });
            this.$('#altitudereading').html(this.altitudereadings[alt][1]);
            var dalt = this.dens_altitudereadings.findIndex(function(elem) {
                return elem[0] >= pos.x
            });
            this.$('#densaltitudereading').html(this.dens_altitudereadings[dalt][1]);

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
            this.dirplot.redraw();
            this.windplot.redraw();
            return data;
        },

        onClose: function () {
            console.log("Kestrel log view closing...");
            if (this.rsc)
                $(window).off('resize', this.rsc);
            if (this.plot)
                this.plot.onClose();
            if (this.tempRHplot) {
                this.tempRHplot.onClose();
                this.$('#tempRHchart').off('plothover', this.displayReadings);
            }
            this.$('#barochart').off('plothover', this.displayReadings);
            this.$('#windspeedchart').off('plothover', this.displayReadings);

        },

        disp_wx: function (data, ts) {
            var dp;

            if (data.temperature != undefined) {
                dp = {'name': 'tempreading',
                         'value': data.temperature,
                        'timestamp': ts};
                this.tempRHplot.fastAppendPoint(dp);
            }
            if (data.dew_point != undefined) {
                dp = {'name': 'dewpointreading',
                      'value': data.dew_point,
                      'timestamp': ts};
                this.tempRHplot.fastAppendPoint(dp);
            }
            if (data.heat_index != undefined) {
                dp = {'name': 'heatindexreading',
                      'value': data.heat_index,
                      'timestamp': ts};
                this.tempRHplot.fastAppendPoint(dp);
            }
            if (data.wetbulb != undefined) {
                dp = {'name': 'wetbulbreading',
                      'value': data.wetbulb,
                      'timestamp': ts};
                this.tempRHplot.fastAppendPoint(dp);
            }
            if (data.wind_chill != undefined) {
                dp = {'name': 'windchillreading',
                      'value': data.wind_chill,
                      'timestamp': ts};
                this.tempRHplot.fastAppendPoint(dp);
            }
            if (data.rel_humidity != undefined) {
                dp = {'name': 'rhreading',
                      'value': data.rel_humidity,
                      'timestamp': ts};
                this.tempRHplot.fastAppendPoint(dp);
            }
            if (data.barometer != undefined) {
                dp = {'name': 'baroreading',
                      'value': data.barometer,
                      'timestamp': ts};
                this.baroplot.fastAppendPoint(dp);
            }
            if (data.pressure != undefined) {
                dp = {'name': 'pressurereading', 'value': data.pressure,
                      'timestamp': ts};
                this.baroplot.fastAppendPoint(dp);
            }
            if (data.wind != undefined) {
                var dp = {'name': 'Wind',
                     'value': data.wind,
                      'timestamp': ts };
                this.dirplot.fastAppendPoint(dp);
                this.windplot.fastAppendPoint({'name': 'windspeed', 'value': data.wind.speed, 'timestamp': ts });
            }

            if (data.altitude != undefined) {
                this.altitudereadings.push([ts, data.altitude]);
            }
            if (data.dens_altitude != undefined) {
                this.dens_altitudereadings.push([ts, data.dens_altitude]);
            }
        },

    });

});